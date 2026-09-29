"""物料价格（物料编码库页面的「价格表」）导入与展示。"""

from __future__ import annotations

import asyncio
import csv
from io import BytesIO, StringIO

import pytest
from httpx import AsyncClient
from openpyxl import Workbook

from tests.conftest import auth_headers

MATERIAL_HEADERS = ["状态", "编码", "名称", "记账单位名称", "型号", "其他列"]
PRICE_HEADERS = ["货品分类", "货品编码", "货品名称", "全成本单价-人民币", "备注"]
# 平台实际导出的「SAP对账收发存汇总表」表头：只取「货品编码 + 全成本单价-人民币」两列。
SAP_PRICE_HEADERS = [
    "序号",
    "库存组织",
    "货品编码",
    "物料编码",
    "物料名称",
    "型号",
    "主单位",
    "追溯码",
    "合同号",
    "系统物料代码",
    "结存",
    "sap备注",
    "全成本单价-人民币",
    "结算单价（加10%管理费）-人民币",
    "更新月份",
    "备注",
]


def _workbook(headers: list[str], rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(headers)
    for row in rows:
        worksheet.append(row)
    content = BytesIO()
    workbook.save(content)
    workbook.close()
    return content.getvalue()


def build_material_workbook(rows: list[list[object]]) -> bytes:
    return _workbook(MATERIAL_HEADERS, rows)


def build_price_workbook(rows: list[list[object]]) -> bytes:
    return _workbook(PRICE_HEADERS, rows)


def build_price_csv(rows: list[list[object]], headers: list[str] | None = None) -> bytes:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers or PRICE_HEADERS)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue().encode("utf-8")


async def _submit_import(
    client: AsyncClient,
    headers: dict[str, str],
    filename: str,
    content: bytes,
    *,
    table: str | None = None,
):
    params = {"table": table} if table else None
    return await client.post(
        "/api/v1/material-code-library/import",
        headers=headers,
        params=params,
        files={"file": (filename, content, "application/octet-stream")},
    )


async def _drain_import_tasks() -> None:
    """先等后台导入任务跑完，再发轮询请求。

    测试库是单连接的内存 SQLite（`StaticPool`）：后台导入的写事务与轮询请求的读会话共用
    同一条连接，轮询插进「DELETE → INSERT」中间会把写事务搅乱（随机出现唯一键冲突 /
    数据丢失）。等任务结束再查状态，既避免并发，也更接近真实完成时刻。
    """
    for _ in range(400):
        pending = [
            task
            for task in asyncio.all_tasks()
            if (task.get_name() or "").startswith("import-job-")
        ]
        if not pending:
            return
        await asyncio.gather(*pending, return_exceptions=True)
    raise AssertionError("import job task did not finish in time")


async def _wait_job(
    client: AsyncClient,
    headers: dict[str, str],
    job_id: int,
    *,
    table: str | None = None,
) -> dict[str, object]:
    params = {"table": table} if table else None
    await _drain_import_tasks()
    for _ in range(200):
        response = await client.get(
            f"/api/v1/material-code-library/import-jobs/{job_id}",
            headers=headers,
            params=params,
        )
        if response.status_code == 200:
            data = response.json()
            if data["status"] in ("SUCCEEDED", "FAILED"):
                return data
        await asyncio.sleep(0.05)
    raise AssertionError("import job did not reach terminal state in time")


async def _import(
    client: AsyncClient,
    headers: dict[str, str],
    filename: str,
    content: bytes,
    *,
    table: str | None = None,
) -> dict[str, object]:
    response = await _submit_import(client, headers, filename, content, table=table)
    assert response.status_code == 202, response.text
    return await _wait_job(client, headers, response.json()["id"], table=table)


async def _library_by_code(client: AsyncClient, headers: dict[str, str]) -> dict[str, object]:
    response = await client.get(
        "/api/v1/material-code-library", headers=headers, params={"page_size": 200}
    )
    assert response.status_code == 200, response.text
    return {item["material_code"]: item for item in response.json()["items"]}


@pytest.mark.asyncio
async def test_price_table_shows_unit_price_in_material_code_library(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    material_job = await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook(
            [
                ["生效", "Y001", "交流接触器", "个", "CJX2", ""],
                ["生效", "Y002", "控制电缆", "米", "KVV", ""],
                ["生效", "Y003", "按钮", "个", "LA38", ""],
            ]
        ),
    )
    assert material_job["status"] == "SUCCEEDED", material_job

    # 「货品编码」才是物料编码，「全成本单价-人民币」才是单价；Z999 不在编码库里也照常入库。
    # Y003 没有价格、空编码那一行也没有货品编码：两者都跳过，不写进价格表。
    price_job = await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook(
            [
                ["低压电器", "Y001", "交流接触器", 12.5, ""],
                ["电缆", "Y002", "控制电缆", "3.20", ""],
                ["低压电器", "Y003", "按钮", None, "空价"],
                ["其他", "", "缺编码的行", 6.6, ""],
                ["其他", "Z999", "未收录物料", 9.9, ""],
                [None, None, None, None, None],
            ]
        ),
        table="price",
    )
    assert price_job["status"] == "SUCCEEDED", price_job
    assert price_job["import_type"] == "MATERIAL_PRICE"
    assert price_job["result"] == {
        "imported_count": 3,
        "skipped_missing_code": 1,
        "skipped_missing_price": 1,
    }

    items = await _library_by_code(client, headers)
    assert set(items) == {"Y001", "Y002", "Y003"}
    assert items["Y001"]["unit_price"] == "12.5"
    assert items["Y002"]["unit_price"] == "3.2"
    # Y003 的价格行因为没有价格被跳过，所以编码库列表里它没有单价。
    assert items["Y003"]["unit_price"] is None

    # 未匹配的编码不进编码库列表，但仍留在价格表里（后续补编码库即可显示）。
    assert "Z999" not in items


@pytest.mark.asyncio
async def test_price_import_skips_missing_code_or_price_rows(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    ok = await _import(
        client,
        headers,
        "prices-ok.xlsx",
        build_price_workbook(
            [
                ["", "Y001", "交流接触器", 10, ""],
                ["", "Y002", "控制电缆", "-", "占位符"],
                ["", "Y003", "按钮", "—", "占位符"],
                ["", "Y004", "按钮", "配件", "非价格文本"],
                ["", "", "只有名称", "", ""],
                ["", "没有货品编码", "空分装置备件:热电阻(停)", 2899.656, ""],
                ["", "Y005", "按钮", "0", "零元也是价格"],
                ["", "  Y006  ", "按钮", " 1,234.50 ", "首尾空白与千分位"],
            ]
        ),
        table="price",
    )
    assert ok["status"] == "SUCCEEDED", ok
    assert ok["result"] == {
        "imported_count": 3,
        "skipped_missing_code": 2,
        "skipped_missing_price": 3,
    }

    # 只导价格、还没导编码库时，价格表里就已经是「编码 → 单价」，编码库补上即可显示。
    material = await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook(
            [
                ["生效", "Y001", "交流接触器", "个", "CJX2", ""],
                ["生效", "Y002", "控制电缆", "米", "KVV", ""],
                ["生效", "Y003", "按钮", "个", "LA38", ""],
                ["生效", "Y005", "指示灯", "个", "AD16", ""],
                ["生效", "Y006", "其他", "个", "X", ""],
            ]
        ),
    )
    assert material["status"] == "SUCCEEDED", material
    items = await _library_by_code(client, headers)
    assert items["Y001"]["unit_price"] == "10"
    assert items["Y002"]["unit_price"] is None
    assert items["Y003"]["unit_price"] is None
    assert items["Y005"]["unit_price"] == "0"
    assert items["Y006"]["unit_price"] == "1234.5"


def _sap_row(
    index: int,
    code: object,
    price: object,
    *,
    material_code: str = "J190136-05774",
    name: str = "空分装置备件",
    settle_price: object = None,
    stock: int = 1,
    sap_remark: object = "-",
    remark: object = None,
) -> list[object]:
    """按平台 SAP 对账表的 16 列布局拼一行：业务上只用得到「货品编码 + 全成本单价-人民币」。"""
    return [
        index,
        "华星项目",
        code,
        material_code,
        name,
        "型号",
        "个",
        "P05XZ00010001",
        None,
        "SYS||X",
        stock,
        sap_remark,
        price,
        settle_price,
        "2025年11月及以前",
        remark,
    ]


@pytest.mark.asyncio
async def test_price_import_matches_sap_export_layout(client: AsyncClient) -> None:
    """平台导出的 SAP 对账表：占位编码「没有货品编码」与非价格文本「配件」都跳过。"""
    headers = await auth_headers(client, "purchase")
    junk_row: list[object] = [None] * 10 + ["s"] + [None] * 5
    job = await _import(
        client,
        headers,
        "华星价格清单.xlsx",
        _workbook(
            SAP_PRICE_HEADERS,
            [
                junk_row,
                _sap_row(1, "X008-00264", 1268.57, settle_price=1395.427, stock=11),
                _sap_row(2, "D005-10003", 3001.5642, material_code="J190208-00997", remark="调整"),
                _sap_row(3, "没有货品编码", "配件", settle_price="配件"),
                _sap_row(4, "没有货品编码", 2899.656, material_code="J190136-06073", stock=14),
                _sap_row(5, "X008-00143", 1480, name="衣柜", settle_price=1628, sap_remark=None),
            ],
        ),
        table="price",
    )
    assert job["status"] == "SUCCEEDED", job
    assert job["result"] == {
        "imported_count": 3,
        "skipped_missing_code": 3,
        "skipped_missing_price": 0,
    }

    # 单价取「全成本单价-人民币」，不是「结算单价（加10%管理费）-人民币」。
    material = await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook([["生效", "X008-00264", "单人床床头", "套", "1500mm", ""]]),
    )
    assert material["status"] == "SUCCEEDED", material
    items = await _library_by_code(client, headers)
    assert items["X008-00264"]["unit_price"] == "1268.57"


@pytest.mark.asyncio
async def test_price_import_without_any_usable_row_fails(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    empty = await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "", "只有名称", "", ""], [None, None, None, None, None]]),
        table="price",
    )
    assert empty["status"] == "FAILED"
    assert empty["error_code"] == "MATERIAL_PRICE_IMPORT_EMPTY"


@pytest.mark.asyncio
async def test_price_import_replaces_previous_prices(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook(
            [
                ["生效", "Y001", "交流接触器", "个", "CJX2", ""],
                ["生效", "Y002", "控制电缆", "米", "KVV", ""],
            ]
        ),
    )
    first = await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook(
            [["", "Y001", "交流接触器", 10, ""], ["", "Y002", "控制电缆", 20, ""]]
        ),
        table="price",
    )
    assert first["result"] == {
        "imported_count": 2,
        "skipped_missing_code": 0,
        "skipped_missing_price": 0,
    }

    second = await _import(
        client,
        headers,
        "prices-2.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 11.11, ""]]),
        table="price",
    )
    assert second["status"] == "SUCCEEDED", second

    items = await _library_by_code(client, headers)
    assert items["Y001"]["unit_price"] == "11.11"
    # 全量替换：文件里没有的编码不再有价格。
    assert items["Y002"]["unit_price"] is None


@pytest.mark.asyncio
async def test_invalid_price_import_keeps_existing_prices(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook([["生效", "Y001", "交流接触器", "个", "CJX2", ""]]),
    )
    await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 12.5, ""]]),
        table="price",
    )

    bad = await _import(
        client,
        headers,
        "bad.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", -12.5, ""]]),
        table="price",
    )
    assert bad["status"] == "FAILED"
    assert bad["error_code"] == "MATERIAL_PRICE_IMPORT_INVALID_PRICE"

    duplicate = await _import(
        client,
        headers,
        "duplicate.xlsx",
        build_price_workbook([["", "Y001", "a", 1, ""], ["", "Y001", "b", 2, ""]]),
        table="price",
    )
    assert duplicate["status"] == "FAILED"
    assert duplicate["error_code"] == "MATERIAL_PRICE_IMPORT_DUPLICATE"

    items = await _library_by_code(client, headers)
    assert items["Y001"]["unit_price"] == "12.5"


@pytest.mark.asyncio
async def test_price_table_headers_are_required_and_normalized(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook([["生效", "Y001", "交流接触器", "个", "CJX2", ""]]),
    )

    # 物料表当成价格表导入：缺「货品编码 / 全成本单价-人民币」，整表失败且不动数据。
    wrong_table = await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook([["生效", "Y001", "交流接触器", "个", "CJX2", ""]]),
        table="price",
    )
    assert wrong_table["status"] == "FAILED"
    assert wrong_table["error_code"] == "MATERIAL_PRICE_IMPORT_HEADERS_MISSING"

    # 价格表当成物料表导入：同样失败。
    wrong_way = await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 12.5, ""]]),
        table="material",
    )
    assert wrong_way["status"] == "FAILED"
    assert wrong_way["error_code"] == "MATERIAL_CODE_IMPORT_HEADERS_MISSING"

    # 表头书写差异（全角破折号、表头两侧空格）能识别。
    normalized_headers = ["货品分类", " 货品编码 ", "货品名称", "全成本单价—人民币", "备注"]
    xlsx_job = await _import(
        client,
        headers,
        "dash.xlsx",
        _workbook(normalized_headers, [["", "Y001", "交流接触器", 12.5, ""]]),
        table="price",
    )
    assert xlsx_job["status"] == "SUCCEEDED", xlsx_job
    assert xlsx_job["result"] == {
        "imported_count": 1,
        "skipped_missing_code": 0,
        "skipped_missing_price": 0,
    }

    # 「（人民币）」括号别名 + CSV 同样支持。
    csv_headers = ["货品分类", "货品编码", "货品名称", "全成本单价（人民币）", "备注"]
    csv_job = await _import(
        client,
        headers,
        "prices.csv",
        build_price_csv([["", "Y001", "交流接触器", 12.5, ""]], csv_headers),
        table="price",
    )
    assert csv_job["status"] == "SUCCEEDED", csv_job
    items = await _library_by_code(client, headers)
    assert items["Y001"]["unit_price"] == "12.5"


@pytest.mark.asyncio
async def test_price_import_requires_purchase_permission(client: AsyncClient) -> None:
    headers = await auth_headers(client, "readonly")
    response = await _submit_import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 12.5, ""]]),
        table="price",
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_import_table_argument_is_validated_and_last_import_is_per_table(
    client: AsyncClient,
) -> None:
    headers = await auth_headers(client, "purchase")
    invalid = await _submit_import(
        client, headers, "prices.xlsx", build_price_workbook([]), table="unknown"
    )
    assert invalid.status_code == 422

    before_material = await client.get("/api/v1/material-code-library/last-import", headers=headers)
    before_price = await client.get(
        "/api/v1/material-code-library/last-import", headers=headers, params={"table": "price"}
    )
    assert before_material.json() == {"last_import_at": None}
    assert before_price.json() == {"last_import_at": None}

    await _import(
        client,
        headers,
        "materials.xlsx",
        build_material_workbook([["生效", "Y001", "交流接触器", "个", "CJX2", ""]]),
    )
    after_material = await client.get("/api/v1/material-code-library/last-import", headers=headers)
    after_price = await client.get(
        "/api/v1/material-code-library/last-import", headers=headers, params={"table": "price"}
    )
    assert after_material.json()["last_import_at"] is not None
    # 两种导入各自记录：只导过物料表时价格表仍是「从未导入」。
    assert after_price.json() == {"last_import_at": None}

    await _import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 12.5, ""]]),
        table="price",
    )
    price_after = await client.get(
        "/api/v1/material-code-library/last-import", headers=headers, params={"table": "price"}
    )
    assert price_after.json()["last_import_at"] is not None


@pytest.mark.asyncio
async def test_import_jobs_are_scoped_to_their_table(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client,
        headers,
        "prices.xlsx",
        build_price_workbook([["", "Y001", "交流接触器", 12.5, ""]]),
        table="price",
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["id"]
    await _wait_job(client, headers, job_id, table="price")

    # 用另一种表类型查同一个任务 id：查不到，避免前端串台。
    wrong = await client.get(f"/api/v1/material-code-library/import-jobs/{job_id}", headers=headers)
    assert wrong.status_code == 400
    assert wrong.json()["code"] == "NOT_FOUND"
