"""直连被测服务数据库的引擎与会话。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from tests.testkit import settings
from tests.testkit.project_scope import project_scope, system_scope


class Base(DeclarativeBase):
    pass


# 未配置时用占位地址（只在真正连库时才会失败；conftest 的 client fixture 会先检查配置）。
engine = create_async_engine(
    settings.API_DATABASE_URL or "postgresql+asyncpg://postgres@127.0.0.1:5432/postgres",
    pool_pre_ping=True,
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


@asynccontextmanager
async def project_session(project_id: int) -> AsyncIterator[AsyncSession]:
    """指定项目上下文的会话：读写项目域表只涉及该项目。"""
    with project_scope(project_id):
        async with SessionLocal() as session:
            yield session


@asynccontextmanager
async def system_session() -> AsyncIterator[AsyncSession]:
    """跨项目上下文的会话（造全局种子数据、核对全部项目的数据）。"""
    with system_scope():
        async with SessionLocal() as session:
            yield session


async def truncate_all_tables() -> None:
    """清空库里的全部业务表并重置自增序列（表清单直接取自数据库，与 init.sql 保持一致）。"""
    async with engine.begin() as connection:
        names = (
            await connection.execute(
                text("SELECT tablename FROM pg_tables WHERE schemaname = current_schema()")
            )
        ).scalars()
        tables = ", ".join(f'"{name}"' for name in names)
        if tables:
            await connection.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


async def sync_sequence(table: str, column: str = "id") -> None:
    """显式插入主键后把自增序列推到 MAX(id)，避免后续自增撞主键。"""
    async with engine.begin() as connection:
        await connection.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('\"{table}\"', '{column}'), "
                f'(SELECT MAX("{column}") FROM "{table}"))'
            )
        )
