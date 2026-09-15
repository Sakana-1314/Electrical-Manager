from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select

from app.mcp_server import mcp
from app.models import User
from tests.conftest import project_session

MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def mcp_request(method: str, params: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params or {},
    }


async def test_mcp_streamable_http_requires_api_token(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/mcp/",
        headers=MCP_HEADERS,
        json=mcp_request(
            "initialize",
            {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "pytest", "version": "1"},
            },
        ),
    )

    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_TOKEN"


async def _issue_admin_api_token(client: AsyncClient) -> str:
    """登录超管并重新生成接口令牌，拿到明文令牌（库里只存哈希，只能一次性获取）。"""
    async with project_session() as session:
        user = await session.scalar(select(User).where(User.username == "admin"))
        assert user is not None
    access_token = (
        await client.post("/api/v1/auth/login", json={"username": "admin", "password": "123456"})
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}
    users = await client.get("/api/v1/users", headers=headers)
    admin = next(item for item in users.json()["items"] if item["username"] == "admin")
    regenerated = await client.post(
        f"/api/v1/users/{admin['id']}/api-token/regenerate",
        headers=headers,
        json={"version": admin["version"]},
    )
    assert regenerated.status_code == 200, regenerated.text
    token = regenerated.json()["api_token"]
    assert token
    return token


async def test_mcp_streamable_http_with_user_token_lists_tools_and_resolves_project(
    client: AsyncClient,
) -> None:
    """MCP 端到端：工具清单可读，且项目按「请求头 → 链接 ?project_id= → 默认项目」解析。

    注意：`StreamableHTTPSessionManager.run()` 每个实例只能进一次，且必须在同一个任务里
    进出，所以工具清单与项目解析放在同一个用例、同一个上下文中。
    """
    token = await _issue_admin_api_token(client)
    client.headers.pop("X-Project-Id", None)  # 真实 MCP 客户端只配置地址，不发项目头
    try:
        # The MCP HTTP app is mounted as a sub-app, so Starlette never runs its
        # lifespan. Enter the session manager's run() (which creates the task group)
        # directly for this request, exactly as the SDK's lifespan wiring would.
        async with mcp.session_manager.run():
            response = await client.post(
                "/api/v1/mcp/",
                headers={**MCP_HEADERS, "X-API-Token": token},
                json=mcp_request("tools/list"),
            )
            assert response.status_code == 200, response.text
            tools = response.json()["result"]["tools"]
            assert {item["name"] for item in tools} == {
                "system_whoami",
                "projects_list",
                "operations_list",
                "operation_describe",
                "operation_call",
            }

            async def whoami(url: str, extra_headers: dict[str, str] | None = None) -> dict:
                call = await client.post(
                    url,
                    headers={**MCP_HEADERS, "X-API-Token": token, **(extra_headers or {})},
                    json=mcp_request(
                        "tools/call", {"name": "system_whoami", "arguments": {}}
                    ),
                )
                assert call.status_code == 200, call.text
                return call.json()["result"]["structuredContent"]

            # 既不带头也不带链接：默认项目 P05（conftest 里 P05 是默认项目）
            default = await whoami("/api/v1/mcp/")
            assert default["project_id"] == 1
            assert default["project_code"] == "P05"

            # 链接带 project_id：切到 P06（网页端复制的 MCP 地址就是这个形式）
            from_link = await whoami("/api/v1/mcp/?project_id=2")
            assert from_link["project_id"] == 2
            assert from_link["project_code"] == "P06"

            # 请求头优先于链接
            from_header = await whoami("/api/v1/mcp/?project_id=2", {"X-Project-Id": "1"})
            assert from_header["project_id"] == 1
            assert from_header["project_code"] == "P05"

            # 未知 id 不落到别的项目，而是回退默认项目
            unknown = await whoami("/api/v1/mcp/?project_id=999999")
            assert unknown["project_id"] == 1
            assert unknown["project_code"] == "P05"
    finally:
        client.headers["X-Project-Id"] = "1"
