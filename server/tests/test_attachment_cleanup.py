from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient

from app.models import FileObject
from app.services import attachment_cleanup_service, file_service
from app.services.common import next_local_hour, seconds_until_local_hour
from tests.conftest import auth_headers, project_session
from tests.integration.test_files import upload_png
from tests.integration.test_purchase_plan_template import create_template


def test_seconds_until_two_am() -> None:
    shanghai = timezone(timedelta(hours=8))
    before = datetime(2026, 8, 10, 1, 30, 0, tzinfo=shanghai)
    assert attachment_cleanup_service._seconds_until_two_am(before) == 1800.0
    at_two = datetime(2026, 8, 10, 2, 0, 0, tzinfo=shanghai)
    assert attachment_cleanup_service._seconds_until_two_am(at_two) == 86400.0
    after = datetime(2026, 8, 10, 14, 0, 0, tzinfo=shanghai)
    assert attachment_cleanup_service._seconds_until_two_am(after) == 43200.0


def test_purge_schedule_helpers_agree() -> None:
    shanghai = timezone(timedelta(hours=8))
    now = datetime(2026, 8, 10, 14, 0, 0, tzinfo=shanghai)
    target = next_local_hour(now, 2)
    assert target == datetime(2026, 8, 11, 2, 0, 0, tzinfo=shanghai)
    assert seconds_until_local_hour(now, 2) == (target - now).total_seconds()
    # inclusive：刚好落在整点上时取当下这一天，不顺延
    at_two = datetime(2026, 8, 10, 2, 0, 0, tzinfo=shanghai)
    assert next_local_hour(at_two, 2) == datetime(2026, 8, 11, 2, 0, 0, tzinfo=shanghai)
    assert next_local_hour(at_two, 2, inclusive=True) == at_two


def test_attachment_purge_after_is_first_two_am_after_seven_full_days() -> None:
    """清除时刻 = 提交删除的完整 7 天后的第一个凌晨 2 点（北京时间）。"""
    shanghai = timezone(timedelta(hours=8))
    assert file_service.ATTACHMENT_RETENTION_DAYS == 7
    # 下午提交：7 天后同一时刻（09-29 14:30）已过当天 2 点，顺延到 09-30 02:00
    assert file_service.attachment_purge_after(
        datetime(2026, 9, 22, 14, 30, 0, tzinfo=shanghai)
    ) == datetime(2026, 9, 30, 2, 0, 0, tzinfo=shanghai)
    # 凌晨 2 点前提交：7 天后同一时刻（09-22 01:30）仍在当天 2 点前，当天 02:00 即到期
    assert file_service.attachment_purge_after(
        datetime(2026, 9, 15, 1, 30, 0, tzinfo=shanghai)
    ) == datetime(2026, 9, 22, 2, 0, 0, tzinfo=shanghai)
    # 正好落在 2 点整：当天 2 点即算到期（含边界），不再多留一天
    assert file_service.attachment_purge_after(
        datetime(2026, 9, 15, 2, 0, 0, tzinfo=shanghai)
    ) == datetime(2026, 9, 22, 2, 0, 0, tzinfo=shanghai)
    # 入参兼容 UTC：同一时刻换时区表示，结果一致
    utc_deleted_at = datetime(2026, 9, 22, 6, 30, 0, tzinfo=timezone.utc)
    assert file_service.attachment_purge_after(utc_deleted_at) == datetime(
        2026, 9, 30, 2, 0, 0, tzinfo=shanghai
    )


@pytest.mark.asyncio
async def test_plan_template_image_counts_as_reference(client: AsyncClient) -> None:
    """回归：计划模板图片同样是引用，不能被当成未被引用而删除。"""
    headers = await auth_headers(client, "purchase")
    admin_headers = await auth_headers(client, "admin")
    file_id = await upload_png(client, headers, name="template.png", color="magenta")

    template = await create_template(
        client, headers, "模板带图", code="ATT-TPL-1", image_ids=[file_id]
    )
    assert any(image["id"] == file_id for image in template["images"])  # type: ignore[union-attr]

    listed = await client.get(
        "/api/v1/files/images/attachments?keyword=template", headers=admin_headers
    )
    rows = {item["id"]: item for item in listed.json()["items"]}
    assert rows[file_id]["reference_count"] == 1

    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert removed.status_code == 409
    assert removed.json()["code"] == "FILE_IN_USE"

    # 悬空图片报告同样不应把模板在用图片列为孤儿。
    report = await client.get(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=admin_headers
    )
    assert report.status_code == 200, report.text
    assert file_id not in [item["id"] for item in report.json()["unreferenced_records"]]


@pytest.mark.asyncio
async def test_cleanup_restores_attachment_rescued_by_business(client: AsyncClient) -> None:
    """软删除后被业务重新引用：复查撤销删除，记录与文件都保留。"""
    headers = await auth_headers(client, "purchase")
    file_id = await upload_png(client, headers, name="rescue2.png", color="cyan")
    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert removed.status_code == 200, removed.text

    # 模拟删除后业务重新挂上该图片（引用表新增一行）。
    await create_template(client, headers, "抢救模板", code="ATT-TPL-2", image_ids=[file_id])

    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.restored_file_ids == [file_id]
    assert result.purged_file_ids == []

    async with project_session() as session:
        item = await session.get(FileObject, file_id)
        assert item is not None
        assert item.deleted_at is None
        assert await file_service.count_references(session, file_id) == 1
