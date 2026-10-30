"""凌晨清理已转入申购记录的计划：记录自包含快照，删除计划后记录仍可读。

调度时刻（凌晨 2 点）与批量大小常量的单测在 Go 侧：
internal/service/plancleanup/plancleanup_test.go。
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers, project_session
from tests.integration.test_procurement import (
    cleanup_moved_plans_once,
    create_purchase_plan,
    move_to_record,
)
from tests.testkit.constants import PLAN_CLEANUP_BATCH_SIZE
from tests.testkit.models import PurchaseMaterial, PurchaseRequestLine


@pytest.mark.asyncio
async def test_cleanup_removes_moved_plans_and_keeps_record(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    plan = await create_purchase_plan(client, headers, "待清理计划", code="DQ-CLEAN-1")
    record = await move_to_record(client, headers, int(plan["id"]))

    deleted = await cleanup_moved_plans_once(client)
    assert deleted == 1

    async with project_session() as session:
        assert await session.get(PurchaseMaterial, int(plan["id"])) is None
        line = await session.get(PurchaseRequestLine, int(record["line_id"]))
        assert line is not None
        assert line.purchase_material_id is None
        assert line.plan_no_snapshot == plan["plan_no"]

    after = await client.get(
        f"/api/v1/purchase-records/{record['line_id']}", headers=headers
    )
    assert after.status_code == 200, after.text
    assert after.json()["material_name"] == plan["name"]
    assert after.json()["plan_no"] == plan["plan_no"]


@pytest.mark.asyncio
async def test_cleanup_is_idempotent(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    plan = await create_purchase_plan(client, headers, "幂等计划", code="DQ-IDEMP-1")
    await move_to_record(client, headers, int(plan["id"]))

    assert await cleanup_moved_plans_once(client) == 1
    assert await cleanup_moved_plans_once(client) == 0


@pytest.mark.asyncio
async def test_cleanup_skips_unmigrated_snapshot(client: AsyncClient) -> None:
    """迁移护栏：plan_no_snapshot 为空（未回填）的计划不被清理。"""
    headers = await auth_headers(client, "purchase")
    plan = await create_purchase_plan(client, headers, "未迁移计划", code="DQ-NOMIG-1")
    record = await move_to_record(client, headers, int(plan["id"]))

    async with project_session() as session:
        line = await session.get(PurchaseRequestLine, int(record["line_id"]))
        assert line is not None
        line.plan_no_snapshot = ""  # 模拟旧库未回填（NULL 或空值）
        await session.commit()

    assert await cleanup_moved_plans_once(client) == 0
    async with project_session() as session:
        assert await session.get(PurchaseMaterial, int(plan["id"])) is not None


@pytest.mark.asyncio
async def test_cleanup_batches_over_limit(client: AsyncClient) -> None:
    headers = await auth_headers(client, "purchase")
    plan_ids: list[int] = []
    for index in range(PLAN_CLEANUP_BATCH_SIZE + 5):
        plan = await create_purchase_plan(
            client, headers, f"批量清理{index}", code=f"DQ-BATCH-{index:02d}"
        )
        plan_ids.append(int(plan["id"]))
        await move_to_record(client, headers, int(plan["id"]))

    total_deleted = 0
    while (deleted := await cleanup_moved_plans_once(client)) > 0:
        total_deleted += deleted
        assert deleted <= PLAN_CLEANUP_BATCH_SIZE
    assert total_deleted == len(plan_ids)
