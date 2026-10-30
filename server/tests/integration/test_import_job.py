from __future__ import annotations

from datetime import timedelta
from io import BytesIO

import pytest
from httpx import AsyncClient
from openpyxl import Workbook
from sqlalchemy import select

from tests.conftest import auth_headers, project_session
from tests.testkit.constants import utcnow
from tests.testkit.enums import ExcelImportJobStatus
from tests.testkit.models import ExcelImportJob


async def _test_hook(client: AsyncClient, name: str, body: dict | None = None) -> dict:
    """后台任务函数通过测试钩子（APP_TEST_HOOKS=1 时注册）触发。"""
    response = await client.post(f"/api/v1/__test__/import-jobs/{name}", json=body or {})
    assert response.status_code == 200, response.text
    return response.json()


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


async def _insert_job(
    *,
    import_type: str,
    status: ExcelImportJobStatus,
    file_path: str,
) -> int:
    async with project_session() as session:
        job = ExcelImportJob(
            import_type=import_type,
            status=status,
            original_filename="test.xlsx",
            file_path=file_path,
        )
        session.add(job)
        await session.commit()
        await session.refresh(job)
        return job.id


@pytest.mark.asyncio
async def test_mark_stale_jobs_failed_marks_interrupted_and_unlinks(
    client: AsyncClient, tmp_path
) -> None:
    paths = [tmp_path / f"f{i}.xlsx" for i in range(4)]
    for path in paths:
        path.write_bytes(b"x")
    statuses = [
        ExcelImportJobStatus.PENDING,
        ExcelImportJobStatus.RUNNING,
        ExcelImportJobStatus.SUCCEEDED,
        ExcelImportJobStatus.FAILED,
    ]
    async with project_session() as session:
        for status, path in zip(statuses, paths, strict=False):
            session.add(
                ExcelImportJob(
                    import_type="STALE_TEST",
                    status=status,
                    original_filename="t.xlsx",
                    file_path=str(path),
                )
            )
        await session.commit()

    count = (await _test_hook(client, "mark-stale"))["count"]

    assert count == 2
    async with project_session() as session:
        rows = list(
            (await session.scalars(select(ExcelImportJob).order_by(ExcelImportJob.id))).all()
        )
    assert [row.status for row in rows] == [
        ExcelImportJobStatus.FAILED,
        ExcelImportJobStatus.FAILED,
        ExcelImportJobStatus.SUCCEEDED,
        ExcelImportJobStatus.FAILED,
    ]
    assert rows[0].error_code == "SERVER_RESTARTED"
    assert rows[1].error_code == "SERVER_RESTARTED"
    assert rows[2].error_code is None
    assert rows[3].error_code is None
    for index, path in enumerate(paths):
        assert path.exists() == (index >= 2)


@pytest.mark.asyncio
async def test_cleanup_finished_jobs_deletes_only_old_terminal_rows(
    client: AsyncClient,
) -> None:
    now = utcnow()
    async with project_session() as session:
        old_finished = ExcelImportJob(
            import_type="CLEANUP_TEST",
            status=ExcelImportJobStatus.SUCCEEDED,
            original_filename="old.xlsx",
            file_path="/tmp/old.xlsx",
            finished_at=now - timedelta(days=60),
        )
        recent_finished = ExcelImportJob(
            import_type="CLEANUP_TEST",
            status=ExcelImportJobStatus.FAILED,
            original_filename="recent.xlsx",
            file_path="/tmp/recent.xlsx",
            finished_at=now - timedelta(days=1),
        )
        running = ExcelImportJob(
            import_type="CLEANUP_TEST",
            status=ExcelImportJobStatus.RUNNING,
            original_filename="running.xlsx",
            file_path="/tmp/running.xlsx",
        )
        session.add_all([old_finished, recent_finished, running])
        await session.commit()

    count = (await _test_hook(client, "cleanup", {"retention_days": 30}))["count"]

    assert count == 1
    async with project_session() as session:
        remaining = list(
            (
                await session.scalars(select(ExcelImportJob).order_by(ExcelImportJob.id))
            ).all()
        )
    assert [row.original_filename for row in remaining] == ["recent.xlsx", "running.xlsx"]


@pytest.mark.asyncio
async def test_import_rejected_when_active_job_exists(client: AsyncClient) -> None:
    await _insert_job(
        import_type="MATERIAL_CODE_LIBRARY",
        status=ExcelImportJobStatus.PENDING,
        file_path="unused.xlsx",
    )
    headers = await auth_headers(client, "purchase")
    response = await client.post(
        "/api/v1/material-code-library/import",
        headers=headers,
        files={
            "file": (
                "codes.xlsx",
                build_workbook([["生效", "Y001", "按钮", "个", "LA38", ""]]),
                "application/octet-stream",
            )
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "IMPORT_IN_PROGRESS"


@pytest.mark.asyncio
async def test_run_job_success_marks_succeeded(client: AsyncClient, tmp_path) -> None:
    target = tmp_path / "job.xlsx"
    target.write_bytes(b"x")

    job_id = await _insert_job(
        import_type="UNIT", status=ExcelImportJobStatus.PENDING, file_path=str(target)
    )
    # 测试钩子用指定的处理器跑一次任务：ok 返回给定结果，app_error / crash 模拟两类失败。
    await _test_hook(
        client, "run", {"job_id": job_id, "processor": "ok", "result": {"imported_count": 7}}
    )

    async with project_session() as session:
        job = await session.get(ExcelImportJob, job_id)
    assert job is not None
    assert job.status == ExcelImportJobStatus.SUCCEEDED
    assert job.result == {"imported_count": 7}
    assert job.error_code is None
    assert not target.exists()


@pytest.mark.asyncio
async def test_run_job_app_error_marks_failed(client: AsyncClient, tmp_path) -> None:
    target = tmp_path / "job.xlsx"
    target.write_bytes(b"x")

    job_id = await _insert_job(
        import_type="UNIT", status=ExcelImportJobStatus.PENDING, file_path=str(target)
    )
    # 处理器抛业务错误 TEST_APP_ERROR「模拟解析失败」
    await _test_hook(client, "run", {"job_id": job_id, "processor": "app_error"})

    async with project_session() as session:
        job = await session.get(ExcelImportJob, job_id)
    assert job is not None
    assert job.status == ExcelImportJobStatus.FAILED
    assert job.error_code == "TEST_APP_ERROR"
    assert job.error_message == "模拟解析失败"
    assert not target.exists()


@pytest.mark.asyncio
async def test_run_job_unexpected_error_marks_failed(client: AsyncClient, tmp_path) -> None:
    target = tmp_path / "job.xlsx"
    target.write_bytes(b"x")

    job_id = await _insert_job(
        import_type="UNIT", status=ExcelImportJobStatus.PENDING, file_path=str(target)
    )
    # 处理器发生未预期的异常
    await _test_hook(client, "run", {"job_id": job_id, "processor": "crash"})

    async with project_session() as session:
        job = await session.get(ExcelImportJob, job_id)
    assert job is not None
    assert job.status == ExcelImportJobStatus.FAILED
    assert job.error_code == "INTERNAL_IMPORT_ERROR"
    assert job.error_message == "导入任务发生未知错误"
    assert not target.exists()
