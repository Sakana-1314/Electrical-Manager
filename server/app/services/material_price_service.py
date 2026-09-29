"""物料价格：物料编码库页面「价格表」的导入与查询。

价格表（SAP对账收发存汇总表导出）里「货品编码」才是真实的物料编码，「全成本单价-人民币」
才是单价：导入只取这两列，其余列（物料编码、物料名称、型号、主单位、结存、结算单价、
更新月份、备注等）一律不导入。导入语义与物料表一致：整项目全量替换（先解析后变更，
坏文件不会动现有数据），价格表里出现而编码库暂时没有的编码同样入库，列表按编码左匹配展示。

行级规则：没有「货品编码」的行跳过（空单元格，或平台导出把「没有货品编码」写进该列），
单价不是有效数值的行也跳过（空单元格、「-」这类占位符，或「配件」这种非价格文本），
两类跳过各自计数随任务结果回报；只有单价能解析成数值但超出 DECIMAL(18, 6) 可存范围
（负数 / 整数超过 12 位）才整表失败 —— 那是脏数据，不是「没有价格」。

表头匹配只做书写层面的归一化（空白字符、全角破折号、括号形式），不做同义扩展，
避免把别的报表误当成价格表。
"""

from __future__ import annotations

import asyncio
import re
from decimal import Decimal, InvalidOperation
from pathlib import Path

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import SessionLocal
from app.core.errors import AppError
from app.models import MaterialPrice
from app.services.import_file_reader import read_tabular_rows

CODE_HEADER = "货品编码"
PRICE_HEADER = "全成本单价-人民币"
EXPECTED_HEADERS = (CODE_HEADER, PRICE_HEADER)
# 书写差异归一：全角破折号 / 连字符变体统一成半角「-」；括号写法各留一个别名。
HEADER_ALIASES = {
    "全成本单价": PRICE_HEADER,
    "全成本单价(人民币)": PRICE_HEADER,
    "全成本单价（人民币）": PRICE_HEADER,
}
MAX_IMPORT_BYTES = 50 * 1024 * 1024
INSERT_BATCH_SIZE = 2_000
# `unit_price` 是 DECIMAL(18, 6)：整数部分最多 12 位，超出直接报错而不是静默截断。
PRICE_QUANTUM = Decimal("0.000001")
MAX_PRICE = Decimal("1000000000000")
_DASH_VARIANTS = "－—–−‐‑"
_TRANSLATION = str.maketrans({variant: "-" for variant in _DASH_VARIANTS})
# 「货品编码」缺失的占位写法：整格匹配（去空白、统一破折号变体、转小写）。平台导出的
# SAP 对账表把没有编码的行写成「没有货品编码」，这些值一律当没有编码、跳过整行。
_MISSING_CODE_TOKENS = frozenset(
    {
        "",
        "-",
        "--",
        "/",
        "\\",
        "n/a",
        "na",
        "null",
        "none",
        "无",
        "暂无",
        "没有货品编码",
        "没有物料编码",
        "无货品编码",
    }
)


def _cell_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _normalize_header(value: str) -> str:
    return re.sub(r"\s+", "", value.translate(_TRANSLATION))


def _normalized_alias(header: str) -> str:
    normalized = _normalize_header(header)
    return HEADER_ALIASES.get(normalized, normalized)


_NORMALIZED_EXPECTED = tuple(_normalized_alias(header) for header in EXPECTED_HEADERS)
_NORMALIZED_PRICE_HEADER = _normalized_alias(PRICE_HEADER)


def _validate_length(value: str, maximum: int, *, row_number: int, header: str) -> None:
    if len(value) > maximum:
        raise AppError(
            "MATERIAL_PRICE_IMPORT_VALUE_TOO_LONG",
            f"第 {row_number} 行“{header}”超过 {maximum} 个字符",
            details={"row": row_number, "column": header, "max_length": maximum},
        )


def _invalid_price(row_number: int, value: object) -> AppError:
    return AppError(
        "MATERIAL_PRICE_IMPORT_INVALID_PRICE",
        (
            f"第 {row_number} 行“{PRICE_HEADER}”超出可存范围（需为 0 到 999999999999 之间的数值）："
            f"{_cell_text(value) or '空值'}"
        ),
        details={"row": row_number, "column": PRICE_HEADER},
    )


def _is_missing_code(value: str) -> bool:
    """货品编码是否缺失：空单元格，或平台导出里的占位文本（如「没有货品编码」）。"""
    text = value.strip().lower().translate(_TRANSLATION)
    return text in _MISSING_CODE_TOKENS


def _cell_price(value: object, *, row_number: int) -> Decimal | None:
    """把单元格转成单价；解析不出数值（空、「-」、「配件」这类文本）返回 None 表示该行没有价格。

    能解析成数值但超出 `DECIMAL(18, 6)`（负数 / 整数超过 12 位）直接报错：那是脏数据，
    静默跳过会悄悄丢价格。
    """
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float, Decimal)):
        # 数值单元格（openpyxl / xlrd 给的是 float）：先转字符串再进 Decimal，避免二进制误差。
        text = str(value).strip()
    else:
        text = str(value).strip().replace(",", "").replace("￥", "").replace("¥", "")
    if not text:
        return None
    try:
        price = Decimal(text)
    except InvalidOperation:
        return None
    if not price.is_finite():
        return None
    if price < 0 or price >= MAX_PRICE:
        raise _invalid_price(row_number, value)
    return price.quantize(PRICE_QUANTUM)


def parse_price_file(path: Path) -> tuple[list[dict[str, object]], int, int]:
    """解析价格表，返回（可导入行、缺货品编码跳过数、缺价格跳过数）。"""
    rows = read_tabular_rows(path)

    header_row_index = 0
    header_indexes: dict[str, int] = {}
    for index in range(min(20, len(rows))):
        headers = [_normalized_alias(_cell_text(cell)) for cell in rows[index]]
        indexes = {header: i for i, header in enumerate(headers) if header}
        if all(header in indexes for header in _NORMALIZED_EXPECTED):
            header_row_index = index
            header_indexes = {header: indexes[header] for header in _NORMALIZED_EXPECTED}
            break
    if not header_indexes:
        raise AppError(
            "MATERIAL_PRICE_IMPORT_HEADERS_MISSING",
            f"表格缺少必需列：{CODE_HEADER}、{PRICE_HEADER}",
        )

    code_index = header_indexes[_normalized_alias(CODE_HEADER)]
    price_index = header_indexes[_normalized_alias(_NORMALIZED_PRICE_HEADER)]
    parsed: list[dict[str, object]] = []
    seen_codes: dict[str, int] = {}
    skipped_missing_code = 0
    skipped_missing_price = 0
    for index in range(header_row_index + 1, len(rows)):
        row_number = index + 1
        row = rows[index]
        material_code = _cell_text(row[code_index]) if code_index < len(row) else ""
        raw_price = row[price_index] if price_index < len(row) else None
        if _is_missing_code(material_code):
            # 整行空白（表格尾部常见）安静跳过；只要这行还有别的内容，就是一条缺编码的行。
            if any(_cell_text(cell) for cell in row):
                skipped_missing_code += 1
            continue
        unit_price = _cell_price(raw_price, row_number=row_number)
        if unit_price is None:
            skipped_missing_price += 1
            continue
        if material_code in seen_codes:
            raise AppError(
                "MATERIAL_PRICE_IMPORT_DUPLICATE",
                (
                    f"{CODE_HEADER}“{material_code}”在第 {seen_codes[material_code]} 行"
                    f"和第 {row_number} 行重复"
                ),
                details={
                    "material_code": material_code,
                    "first_row": seen_codes[material_code],
                    "duplicate_row": row_number,
                },
            )
        _validate_length(material_code, 64, row_number=row_number, header=CODE_HEADER)
        seen_codes[material_code] = row_number
        parsed.append({"material_code": material_code, "unit_price": unit_price})
    if not parsed:
        raise AppError(
            "MATERIAL_PRICE_IMPORT_EMPTY",
            f"表格中没有可导入的物料价格数据（需要同时有{CODE_HEADER}和{PRICE_HEADER}）",
        )
    return parsed, skipped_missing_code, skipped_missing_price


async def process_import_file(file_path: Path) -> dict[str, object]:
    """异步导入处理器：解析（线程池）→ 全量替换 → 返回结果摘要。"""
    rows, skipped_missing_code, skipped_missing_price = await asyncio.to_thread(
        parse_price_file, file_path
    )
    async with SessionLocal() as session:
        await session.execute(delete(MaterialPrice))
        for offset in range(0, len(rows), INSERT_BATCH_SIZE):
            batch = rows[offset : offset + INSERT_BATCH_SIZE]
            await session.execute(insert(MaterialPrice), batch)
        await session.commit()
    return {
        "imported_count": len(rows),
        "skipped_missing_code": skipped_missing_code,
        "skipped_missing_price": skipped_missing_price,
    }


async def load_unit_prices(session: AsyncSession, material_codes: list[str]) -> dict[str, Decimal]:
    """按物料编码批量取单价（供物料编码库列表装配；价格表里没有的编码不出现在结果里）。"""
    if not material_codes:
        return {}
    result = await session.execute(
        select(MaterialPrice.material_code, MaterialPrice.unit_price).where(
            MaterialPrice.material_code.in_(material_codes)
        )
    )
    return {str(material_code): unit_price for material_code, unit_price in result.all()}
