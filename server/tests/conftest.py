from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

os.environ["APP_DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
# 设置 GO_SERVER_URL 时，接口测试改为通过真实 HTTP 调用独立运行的 Go 服务（黑盒契约测试）：
# 双方共用 TEST_DATABASE_URL 指向的 MySQL（结构来自 init.sql），每个用例前清空全部表再写种子数据。
GO_SERVER_URL = os.environ.get("GO_SERVER_URL", "").rstrip("/")
GO_UPLOAD_DIR = os.environ.get("GO_UPLOAD_DIR", "")
os.environ["APP_JWT_SECRET"] = "test-secret-that-is-long-enough-123456"
os.environ["APP_WECHAT_MINI_PROGRAM_APP_ID"] = "wx-test-primary,wx-test-secondary"
os.environ["APP_WECHAT_MINI_PROGRAM_APP_SECRET"] = (
    "test-primary-secret,test-secondary-secret"
)

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base, engine, system_session  # noqa: F401  (测试复用)
from app.core.database import project_session as _project_session
from app.core.security import hash_password
from app.domain.enums import Role
from app.main import app
from app.models import Project, User

settings.template_dir = Path(__file__).parents[1] / "app" / "templates"

# 测试库固定两个项目：默认项目（等同于线上现有项目）与第二个项目（用于隔离用例）。
# `client` fixture 默认带上 X-Project-Id=1，因此既有接口测试无需逐个改请求头。
DEFAULT_PROJECT_ID = 1
SECOND_PROJECT_ID = 2


def project_session(project_id: int = DEFAULT_PROJECT_ID):
    """测试里直接开库会话时用：把上下文设成指定项目（默认与 client 默认头一致）。"""
    return _project_session(project_id)


async def _truncate_all_tables() -> None:
    from sqlalchemy import text

    tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    async with engine.begin() as connection:
        await connection.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))


@pytest_asyncio.fixture
async def client(tmp_path) -> AsyncIterator[AsyncClient]:
    if GO_SERVER_URL:
        import shutil

        settings.upload_dir = Path(GO_UPLOAD_DIR)
        shutil.rmtree(settings.upload_dir, ignore_errors=True)
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        await _truncate_all_tables()
    else:
        settings.upload_dir = tmp_path / "uploads"
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
    async with system_session() as session:
        session.add_all(
            [
                Project(
                    id=DEFAULT_PROJECT_ID,
                    name="华星现有项目",
                    enabled=True,
                    is_default=True,
                ),
                Project(
                    id=SECOND_PROJECT_ID,
                    name="二期项目",
                    enabled=True,
                    is_default=False,
                ),
            ]
        )
        session.add_all(
            [
                User(
                    username="admin",
                    password_hash=hash_password("123456"),
                    display_name="系统管理员",
                    role=Role.SUPER_ADMIN,
                    enabled=True,
                ),
                User(
                    username="warehouse",
                    password_hash=hash_password("123456"),
                    display_name="仓库管理员",
                    role=Role.WAREHOUSE_ADMIN,
                    enabled=True,
                ),
                User(
                    username="purchase",
                    password_hash=hash_password("123456"),
                    display_name="申购管理员",
                    role=Role.PURCHASE_ADMIN,
                    enabled=True,
                ),
                User(
                    username="hazard",
                    password_hash=hash_password("123456"),
                    display_name="隐患管理员",
                    role=Role.HAZARD_ADMIN,
                    enabled=True,
                ),
                User(
                    username="ledger",
                    password_hash=hash_password("123456"),
                    display_name="台账管理员",
                    role=Role.LEDGER_ADMIN,
                    enabled=True,
                ),
                User(
                    username="work",
                    password_hash=hash_password("123456"),
                    display_name="工作管理员",
                    role=Role.WORK_ADMIN,
                    enabled=True,
                ),
                User(
                    username="readonly",
                    password_hash=hash_password("123456"),
                    display_name="只读用户",
                    role=Role.READ_ONLY,
                    enabled=True,
                ),
            ]
        )
        await session.commit()
        # PostgreSQL 的自增序列不会因为显式插入 id=1/2 而前进，这里把 project 序列推到
        # MAX(id)，否则后续创建项目会撞主键（SQLite 会自己取 MAX+1，无需处理）。
        if engine.dialect.name == "postgresql":
            await session.execute(
                text(
                    "SELECT setval(pg_get_serial_sequence('project', 'id'), "
                    "(SELECT MAX(id) FROM project))"
                )
            )
            await session.commit()

    if GO_SERVER_URL:
        http_client = AsyncClient(base_url=GO_SERVER_URL, timeout=30)
    else:
        http_client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    async with http_client as http:
        # 默认项目：业务接口都要求项目上下文，这样既有测试不用逐个加请求头。
        http.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
        yield http

    if not GO_SERVER_URL:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)


async def auth_headers(client: AsyncClient, username: str) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login", json={"username": username, "password": "123456"}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


async def await_export_job(
    client: AsyncClient,
    headers: dict[str, str],
    job_id: int,
    *,
    timeout_seconds: float = 2.0,
) -> dict:
    """轮询导出任务直到终态（后台任务与测试同事件循环，正常瞬时完成）。"""
    import asyncio
    import time

    deadline = time.monotonic() + timeout_seconds
    while True:
        response = await client.get(f"/api/v1/excel-export-jobs/{job_id}", headers=headers)
        assert response.status_code == 200, response.text
        job = response.json()
        if job["status"] in ("SUCCEEDED", "FAILED"):
            return job
        if time.monotonic() > deadline:
            raise AssertionError(f"export job {job_id} did not finish: {job}")
        await asyncio.sleep(0.05)


async def create_stock(
    client: AsyncClient, headers: dict[str, str], name: str = "交流接触器"
) -> int:
    response = await client.post(
        "/api/v1/stock-materials",
        headers=headers,
        json={
            "name": name,
            "model_spec": "CJX2-2510 220V",
            "unit_name": "个",
            "remark": "测试",
            "image_ids": [],
        },
    )
    assert response.status_code == 201, response.text
    return int(response.json()["id"])
