"""项目隔离层（core.project_scope）单测。

覆盖四件事：
1. 未设定项目上下文时，任何碰项目域表的读写都 fail-closed 报 `PROJECT_REQUIRED`；
2. 设定上下文后，查/取主键/聚合/列查询都只看到当前项目的数据；
3. `system_scope()` 显式跨项目（系统级任务）能看全量；
4. 跨项目对象写入被 `before_flush` 守卫拦下（`PROJECT_MISMATCH`）。
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.errors import AppError
from app.core.project_scope import current_project_id, project_scope, system_scope
from app.models import Ledger, StockMaterial, User
from tests.conftest import P05_PROJECT_ID, P06_PROJECT_ID, project_session, system_session


@pytest.mark.asyncio
async def test_project_required_when_context_missing(client: AsyncClient) -> None:
    # 故意不声明任何项目上下文（既不是请求上下文，也不是 system_scope）。
    async with SessionLocal() as session:
        with pytest.raises(AppError) as read_error:
            await session.scalars(select(StockMaterial))
        assert read_error.value.code == "PROJECT_REQUIRED"

        with pytest.raises(AppError) as write_error:
            session.add(
                StockMaterial(name="X", model_spec="Y", unit_name="个", identity_hash="h")
            )
            await session.flush()
        assert write_error.value.code == "PROJECT_REQUIRED"

        # 纯全局表的语句不受影响（登录、项目列表、系统配置等不需要项目上下文）。
        assert await session.scalar(select(func.count()).select_from(User)) == 6



@pytest.mark.asyncio
async def test_reads_are_filtered_by_current_project(client: AsyncClient) -> None:
    async with project_session(P05_PROJECT_ID) as session:
        session.add(
            StockMaterial(name="P05 物资", model_spec="A", unit_name="个", identity_hash="a")
        )
        await session.commit()
    async with project_session(P06_PROJECT_ID) as session:
        other = StockMaterial(name="P06 物资", model_spec="B", unit_name="个", identity_hash="a")
        session.add(other)
        await session.commit()
        p06_id = other.id

    async with project_session(P05_PROJECT_ID) as session:
        rows = list((await session.scalars(select(StockMaterial))).all())
        assert [row.name for row in rows] == ["P05 物资"]
        assert await session.scalar(select(func.count()).select_from(StockMaterial)) == 1
        # 取主键 / 只取列 / 聚合都被过滤：别的项目的主键在本项目看来「不存在」。
        assert await session.get(StockMaterial, p06_id) is None
        by_id = select(StockMaterial.id).where(StockMaterial.id == p06_id)
        by_name = select(StockMaterial.name).where(StockMaterial.id == p06_id)
        assert await session.scalar(by_id) is None
        assert await session.scalar(by_name) is None



@pytest.mark.asyncio
async def test_same_identity_hash_allowed_in_other_project(client: AsyncClient) -> None:
    """同名物资在两个项目各存一份：项目域唯一键不能跨项目互斥。"""
    for project_id in (P05_PROJECT_ID, P06_PROJECT_ID):
        async with project_session(project_id) as session:
            session.add(
                StockMaterial(name="同名物资", model_spec="A", unit_name="个", identity_hash="same")
            )
            await session.commit()
    with system_scope():
        async with system_session() as session:
            assert await session.scalar(select(func.count()).select_from(StockMaterial)) == 2



@pytest.mark.asyncio
async def test_system_scope_sees_every_project(client: AsyncClient) -> None:
    async with project_session(P05_PROJECT_ID) as session:
        session.add(Ledger(name="P05 台账", model_spec="A"))
        await session.commit()
    async with project_session(P06_PROJECT_ID) as session:
        session.add(Ledger(name="P06 台账", model_spec="B"))
        await session.commit()

    with system_scope():
        async with system_session() as session:
            names = sorted(row.name for row in (await session.scalars(select(Ledger))).all())
            assert names == ["P05 台账", "P06 台账"]

    async with project_session(P05_PROJECT_ID) as session:
        assert [row.name for row in (await session.scalars(select(Ledger))).all()] == ["P05 台账"]



@pytest.mark.asyncio
async def test_cross_project_write_is_rejected(client: AsyncClient) -> None:
    async with project_session(P06_PROJECT_ID) as session:
        session.add(Ledger(name="P06 台账", model_spec="B"))
        await session.commit()

    async with project_session(P05_PROJECT_ID) as session:
        # 显式写别的项目的数据：守卫必须拦下，避免跨项目写入/删除。
        with pytest.raises(AppError) as mismatch:
            session.add(Ledger(name="越界台账", model_spec="C", project_id=P06_PROJECT_ID))
            await session.flush()
        assert mismatch.value.code == "PROJECT_MISMATCH"



@pytest.mark.asyncio
async def test_context_is_restored_after_scope_exits(client: AsyncClient) -> None:
    with project_scope(P06_PROJECT_ID):
        assert current_project_id() == P06_PROJECT_ID
    with pytest.raises(AppError) as missing:
        current_project_id()
    assert missing.value.code == "PROJECT_REQUIRED"
