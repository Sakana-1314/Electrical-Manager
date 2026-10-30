"""黑盒契约测试：通过真实 HTTP 调用独立运行的服务（启动方式见 tools/run_contract_tests.sh）。

服务与用例共用 API_DATABASE_URL 指向的 PostgreSQL（结构来自 init.sql）：每个用例前清空全部表、
清空上传目录，再写入固定的项目与账号种子数据；用例可以直接读写数据库造数据或核对落库结果。
"""

from __future__ import annotations

import asyncio
import shutil
import time
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import AsyncClient

from tests.testkit import settings
from tests.testkit.database import project_session as _project_session
from tests.testkit.database import sync_sequence, system_session, truncate_all_tables
from tests.testkit.enums import Role
from tests.testkit.models import Project, User
from tests.testkit.security import hash_password

# 测试库固定两个项目：默认项目（等同于线上现有项目）与第二个项目（用于隔离用例）。
# `client` fixture 默认带上 X-Project-Id=1，因此接口用例无需逐个加请求头。
DEFAULT_PROJECT_ID = 1
SECOND_PROJECT_ID = 2

# 种子账号（口令均为 123456）
SEED_USERS = (
    ("admin", "系统管理员", Role.SUPER_ADMIN),
    ("warehouse", "仓库管理员", Role.WAREHOUSE_ADMIN),
    ("purchase", "申购管理员", Role.PURCHASE_ADMIN),
    ("hazard", "隐患管理员", Role.HAZARD_ADMIN),
    ("ledger", "台账管理员", Role.LEDGER_ADMIN),
    ("work", "工作管理员", Role.WORK_ADMIN),
    ("readonly", "只读用户", Role.READ_ONLY),
)

_password_hash: str | None = None


def project_session(project_id: int = DEFAULT_PROJECT_ID):
    """直接开库会话时用：把上下文设成指定项目（默认与 client 默认头一致）。"""
    return _project_session(project_id)


def api_client() -> AsyncClient:
    """指向被测服务、不带默认请求头的客户端。"""
    return AsyncClient(base_url=settings.API_BASE_URL, timeout=30)


async def _seed() -> None:
    global _password_hash
    if _password_hash is None:
        _password_hash = hash_password("123456")
    async with system_session() as session:
        session.add_all(
            [
                Project(id=DEFAULT_PROJECT_ID, name="华星现有项目", enabled=True, is_default=True),
                Project(id=SECOND_PROJECT_ID, name="二期项目", enabled=True, is_default=False),
            ]
        )
        session.add_all(
            User(
                username=username,
                password_hash=_password_hash,
                display_name=display_name,
                role=role,
                enabled=True,
            )
            for username, display_name, role in SEED_USERS
        )
        await session.commit()
    # 显式插入的 id 不会推进自增序列，推到 MAX(id)，否则后续创建项目会撞主键。
    await sync_sequence("project")


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    missing = settings.missing_settings()
    if missing:
        pytest.fail(
            f"未设置 {', '.join(missing)}：请用 tools/run_contract_tests.sh 运行，"
            "或指向一个已启动的服务（APP_TEST_HOOKS=1）",
            pytrace=False,
        )
    upload_dir = settings.upload_dir()
    shutil.rmtree(upload_dir, ignore_errors=True)
    upload_dir.mkdir(parents=True, exist_ok=True)
    await truncate_all_tables()
    await _seed()

    async with api_client() as http:
        # 默认项目：业务接口都要求项目上下文，这样用例不用逐个加请求头。
        http.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
        yield http


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
    """轮询导出任务直到终态。"""
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
