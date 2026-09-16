from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from contextvars import ContextVar

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import (
    AsyncAttrs,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.db_timing import register_database_timing
from app.core.project_scope import project_scope, register_project_scope, system_scope

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(AsyncAttrs, DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


engine_kwargs: dict[str, object] = {"pool_pre_ping": True}
if settings.database_url.startswith("sqlite+aiosqlite:///:memory:"):
    engine_kwargs["poolclass"] = StaticPool

engine = create_async_engine(settings.database_url, **engine_kwargs)
# 统计每条 SQL 的服务端执行耗时，供 X-DB-Time / X-DB-Queries 响应头与访问日志使用。
register_database_timing(engine)
# 项目域数据的全局隔离（读过滤 + 写入守卫），见 core/project_scope.py。
register_project_scope()
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

# 当前请求正在使用的会话：`get_db` 建立时登记，供 CommitBeforeResponseMiddleware 在
# 响应发出前提交（见 core/middleware.py 的类文档）。后台任务不走 `get_db`，取到 None。
_current_session: ContextVar[AsyncSession | None] = ContextVar("request_session", default=None)


async def commit_current_session() -> None:
    """提交当前请求的写事务（没有待提交事务时什么都不做）。

    由 `CommitBeforeResponseMiddleware` 在响应头发出之前调用，保证「接口返回 2xx」
    与「写库可见」在客户端看来是同一时刻。
    """
    session = _current_session.get()
    if session is not None and session.in_transaction():
        await session.commit()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        token = _current_session.set(session)
        try:
            yield session
            # 兜底：正常响应的事务已由 CommitBeforeResponseMiddleware 提前提交，
            # 这里只负责「响应发出之后」才写库的部分（响应上挂的后台任务）。
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            _current_session.reset(token)


@asynccontextmanager
async def project_session(project_id: int) -> AsyncIterator[AsyncSession]:
    """指定项目上下文的自开会话：后台任务按行上记录的项目恢复上下文时使用。"""
    with project_scope(project_id):
        async with SessionLocal() as session:
            yield session


@asynccontextmanager
async def system_session() -> AsyncIterator[AsyncSession]:
    """跨项目（系统级）上下文的自开会话：清理任务、附件引用统计等使用。

    这些入口不属于任何单个项目，必须显式声明，避免被项目过滤悄悄收窄范围。
    """
    with system_scope():
        async with SessionLocal() as session:
            yield session
