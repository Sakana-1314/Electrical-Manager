from __future__ import annotations

import asyncio
import csv
from io import BytesIO, StringIO

import pytest
import xlwt
from httpx import AsyncClient
from openpyxl import Workbook

from tests.conftest import auth_headers


def build_workbook(rows: list[list[object]]) -> bytes:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.append(["状态", "编码", "名称", "记账单位名称", "型号", "其他列"])
    for row in rows:
        worksheet.append(row)
    content = BytesIO()
    workbook.save(content)
    workbook.close()
    return content.getvalue()


def build_csv_with_headers(headers: list[str], rows: list[list[object]]) -> bytes:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue().encode("utf-8")


def build_csv(rows: list[list[object]]) -> bytes:
    return build_csv_with_headers(["状态", "编码", "名称", "记账单位名称", "型号", "其他列"], rows)


def build_xls(rows: list[list[object]]) -> bytes:
    workbook = xlwt.Workbook()
    worksheet = workbook.add_sheet("Sheet1")
    for column, value in enumerate(["状态", "编码", "名称", "记账单位名称", "型号", "其他列"]):
        worksheet.write(0, column, value)
    for row_index, row in enumerate(rows, start=1):
        for column, value in enumerate(row):
            worksheet.write(row_index, column, value)
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


async def _submit_import(
    client: AsyncClient, headers: dict[str, str], filename: str, content: bytes
):
    return await client.post(
        "/api/v1/material-code-library/import",
        headers=headers,
        files={"file": (filename, content, "application/octet-stream")},
    )


async def _wait_job(client: AsyncClient, headers: dict[str, str], job_id: int) -> dict[str, object]:
    """轮询导入任务直到终态（SUCCEEDED/FAILED），容忍后台任务占用连接期间的瞬时失败。"""
    for _ in range(200):
        response = await client.get(
            f"/api/v1/material-code-library/import-jobs/{job_id}", headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            if data["status"] in ("SUCCEEDED", "FAILED"):
                return data
        await asyncio.sleep(0.05)
    raise AssertionError("import job did not reach terminal state in time")


@pytest.mark.asyncio
async def test_import_replaces_and_searches_material_code_library(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    first_import = await _submit_import(
        client,
        purchase_headers,
        "codes.xlsx",
        build_workbook(
            [
                ["生效", "Y001", "交流接触器", "个", "CJX2-2510", "忽略"],
                ["生效", "Y002", "控制电缆", "米", "KVV 4×1.5", "忽略"],
                ["生效", "Y003", "", "箱", "", "忽略"],
            ]
        ),
    )
    assert first_import.status_code == 202, first_import.text
    job = first_import.json()
    assert job["status"] in ("PENDING", "RUNNING")
    done = await _wait_job(client, purchase_headers, job["id"])
    assert done["status"] == "SUCCEEDED", done
    assert done["result"] == {
        "imported_count": 3,
        "blank_name_count": 1,
        "blank_model_spec_count": 1,
        "truncated_model_spec_count": 0,
    }

    by_name = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"keyword": "接触器"},
    )
    assert by_name.status_code == 200, by_name.text
    assert by_name.json()["items"][0]["material_code"] == "Y001"
    assert by_name.json()["items"][0]["name"] == "交流接触器"
    assert by_name.json()["items"][0]["model_spec"] == "CJX2-2510"
    assert by_name.json()["items"][0]["unit_name"] == "个"

    by_model = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"keyword": "4×1.5"},
    )
    assert by_model.status_code == 200, by_model.text
    assert by_model.json()["items"][0]["material_code"] == "Y002"

    by_name_or_model = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"keyword": "接触器|4×1.5"},
    )
    assert by_name_or_model.status_code == 200, by_name_or_model.text
    assert {item["material_code"] for item in by_name_or_model.json()["items"]} == {
        "Y001",
        "Y002",
    }

    by_code = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"keyword": "Y001"},
    )
    assert by_code.status_code == 200, by_code.text
    assert by_code.json()["items"][0]["material_code"] == "Y001"
    assert by_code.json()["items"][0]["name"] == "交流接触器"
    assert by_code.json()["items"][0]["model_spec"] == "CJX2-2510"
    assert by_code.json()["items"][0]["unit_name"] == "个"

    combined = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"material_code": "Y00", "name": "接触器", "model_spec": "2510"},
    )
    assert combined.status_code == 200, combined.text
    assert [item["material_code"] for item in combined.json()["items"]] == ["Y001"]

    combined_or = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={
            "name": "接触器|控制电缆",
            "model_spec": "2510｜4×1.5",
            "material_code": "Y001|Y002",
        },
    )
    assert combined_or.status_code == 200, combined_or.text
    assert [item["material_code"] for item in combined_or.json()["items"]] == ["Y001", "Y002"]

    no_combined_match = await client.get(
        "/api/v1/material-code-library",
        headers=purchase_headers,
        params={"name": "接触器", "model_spec": "4×1.5"},
    )
    assert no_combined_match.status_code == 200, no_combined_match.text
    assert no_combined_match.json()["items"] == []

    replacement = await _submit_import(
        client,
        purchase_headers,
        "replacement.xlsx",
        build_workbook([["生效", "Y999", "按钮", "个", "LA38", "忽略"]]),
    )
    assert replacement.status_code == 202, replacement.text
    replacement_job = await _wait_job(client, purchase_headers, replacement.json()["id"])
    assert replacement_job["status"] == "SUCCEEDED", replacement_job
    all_items = await client.get(
        "/api/v1/material-code-library", headers=purchase_headers, params={"page_size": 200}
    )
    assert all_items.json()["total"] == 1
    assert all_items.json()["items"][0]["material_code"] == "Y999"


@pytest.mark.asyncio
async def test_invalid_import_does_not_delete_existing_codes(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    initial = build_workbook([["生效", "Y001", "交流接触器", "个", "CJX2", ""]])
    response = await _submit_import(client, purchase_headers, "codes.xlsx", initial)
    assert response.status_code == 202, response.text
    await _wait_job(client, purchase_headers, response.json()["id"])

    duplicate = build_workbook(
        [
            ["生效", "Y002", "按钮", "个", "LA38", ""],
            ["生效", "Y002", "按钮", "个", "LA38", ""],
        ]
    )
    bad_response = await _submit_import(client, purchase_headers, "duplicate.xlsx", duplicate)
    assert bad_response.status_code == 202, bad_response.text
    bad_job = await _wait_job(client, purchase_headers, bad_response.json()["id"])
    assert bad_job["status"] == "FAILED"
    assert bad_job["error_code"] == "MATERIAL_CODE_IMPORT_DUPLICATE"

    items = await client.get("/api/v1/material-code-library", headers=purchase_headers)
    assert items.json()["total"] == 1
    assert items.json()["items"][0]["material_code"] == "Y001"


@pytest.mark.asyncio
async def test_material_code_import_requires_purchase_permission(client: AsyncClient) -> None:
    readonly_headers = await auth_headers(client, "readonly")
    response = await _submit_import(
        client,
        readonly_headers,
        "codes.xlsx",
        build_workbook([["生效", "Y001", "按钮", "个", "LA38", ""]]),
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_import_rejects_unsupported_extension(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client, purchase_headers, "codes.txt", b"not excel content"
    )
    assert response.status_code == 400
    assert response.json()["code"] == "UNSUPPORTED_EXCEL_FILE"


@pytest.mark.asyncio
async def test_import_corrupted_file_marks_job_failed(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client, purchase_headers, "corrupted.xlsx", b"this is not a valid excel file"
    )
    assert response.status_code == 202, response.text
    bad_job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert bad_job["status"] == "FAILED"
    assert bad_job["error_code"] == "INVALID_EXCEL_FILE"


@pytest.mark.asyncio
async def test_import_large_file_succeeds(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    rows = [["生效", f"Y{i:04d}", f"物料{i}", "个", f"型号{i}", "忽略"] for i in range(500)]
    response = await _submit_import(client, purchase_headers, "large.xlsx", build_workbook(rows))
    assert response.status_code == 202, response.text
    job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert job["status"] == "SUCCEEDED", job
    assert job["result"]["imported_count"] == 500
    assert job["result"]["blank_name_count"] == 0
    assert job["result"]["blank_model_spec_count"] == 0


@pytest.mark.asyncio
async def test_material_code_exists_soft_check(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client,
        purchase_headers,
        "codes.xlsx",
        build_workbook([["生效", "Y001", "按钮", "个", "LA38", ""]]),
    )
    assert response.status_code == 202, response.text
    job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert job["status"] == "SUCCEEDED", job

    known = await client.get(
        "/api/v1/material-code-library/exists",
        headers=purchase_headers,
        params={"material_code": "Y001"},
    )
    assert known.status_code == 200, known.text
    assert known.json() == {"material_code": "Y001", "exists": True}

    unknown = await client.get(
        "/api/v1/material-code-library/exists",
        headers=purchase_headers,
        params={"material_code": "Z999"},
    )
    assert unknown.status_code == 200, unknown.text
    assert unknown.json() == {"material_code": "Z999", "exists": False}

    # 软校验不阻断：编码库为空时返回 exists=False 而非报错。
    empty = await client.get(
        "/api/v1/material-code-library/exists",
        headers=purchase_headers,
        params={"material_code": "X"},
    )
    assert empty.json() == {"material_code": "X", "exists": False}


@pytest.mark.asyncio
async def test_import_csv(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client,
        purchase_headers,
        "codes.csv",
        build_csv([["生效", "C001", "按钮", "个", "LA38", "忽略"]]),
    )
    assert response.status_code == 202, response.text
    job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert job["status"] == "SUCCEEDED", job
    assert job["result"] == {
        "imported_count": 1,
        "blank_name_count": 0,
        "blank_model_spec_count": 0,
        "truncated_model_spec_count": 0,
    }

    listed = await client.get("/api/v1/material-code-library", headers=purchase_headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["material_code"] == "C001"


@pytest.mark.asyncio
async def test_import_xls(client: AsyncClient) -> None:
    purchase_headers = await auth_headers(client, "purchase")
    response = await _submit_import(
        client,
        purchase_headers,
        "codes.xls",
        build_xls([["生效", "X001", "接触器", "个", "CJX2", "忽略"]]),
    )
    assert response.status_code == 202, response.text
    job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert job["status"] == "SUCCEEDED", job
    assert job["result"] == {
        "imported_count": 1,
        "blank_name_count": 0,
        "blank_model_spec_count": 0,
        "truncated_model_spec_count": 0,
    }

    listed = await client.get("/api/v1/material-code-library", headers=purchase_headers)
    assert listed.status_code == 200, listed.text
    assert listed.json()["items"][0]["material_code"] == "X001"


@pytest.mark.asyncio
async def test_import_warehouse_export_headers(client: AsyncClient) -> None:
    """仓储管理导出的物料编码表：表头叫法不同（型号列头还带 Tab），超长型号截断。"""
    purchase_headers = await auth_headers(client, "purchase")
    warehouse_headers = [
        "序号",
        "物料编码",
        "物料名称",
        "旧物料编码",
        "物料大类",
        "物料小类",
        "型号\t",
        "单位",
        "启用状态",
        "资产类型",
        "是否一次性申购",
        "参考美元单价",
        "原厂件号",
        "适配设备型号",
        "设备厂商",
    ]
    response = await _submit_import(
        client,
        purchase_headers,
        "warehouse-codes.csv",
        build_csv_with_headers(
            warehouse_headers,
            [
                [
                    "1",
                    "C011-00001",
                    "吨袋(停)",
                    "L110501-00001",
                    "包装储运物资",
                    "生产用包装",
                    "Φ115×120cm",
                    "个",
                    "停用",
                    "非资产",
                    "否",
                    "11.4",
                    "",
                    "",
                    "",
                ],
                [
                    "2",
                    "N004-00012",
                    "葡萄糖酸钠",
                    "L110301-00015",
                    "生产原料及产品",
                    "小宗辅料",
                    "型" * 300,
                    "kg",
                    "启用",
                    "非资产",
                    "否",
                    "",
                    "",
                    "",
                    "",
                ],
            ],
        ),
    )
    assert response.status_code == 202, response.text
    job = await _wait_job(client, purchase_headers, response.json()["id"])
    assert job["status"] == "SUCCEEDED", job
    assert job["result"] == {
        "imported_count": 2,
        "blank_name_count": 0,
        "blank_model_spec_count": 0,
        "truncated_model_spec_count": 1,
    }

    listed = await client.get("/api/v1/material-code-library", headers=purchase_headers)
    assert listed.status_code == 200, listed.text
    items = {item["material_code"]: item for item in listed.json()["items"]}
    assert set(items) == {"C011-00001", "N004-00012"}
    assert items["C011-00001"]["name"] == "吨袋(停)"
    assert items["C011-00001"]["model_spec"] == "Φ115×120cm"
    assert items["C011-00001"]["unit_name"] == "个"
    assert items["N004-00012"]["model_spec"] == "型" * 255
