from __future__ import annotations

import re

import pytest
from httpx import AsyncClient

from tests.conftest import project_session
from tests.go_upstream import StartWechat
from tests.go_upstream import go_wechat as _go_wechat_fixture
from tests.testkit.accounts import create_mini_program_user
from tests.testkit.security import create_mini_program_access_token

go_wechat = _go_wechat_fixture  # 微信接口桩（pytest fixture）


async def mini_headers(display_name: str) -> dict[str, str]:
    async with project_session() as session:
        user_id = await create_mini_program_user(session, display_name)
    return {"Authorization": f"Bearer {create_mini_program_access_token(user_id)}"}


@pytest.mark.asyncio
async def test_qr_login_flow_uses_memory_session_and_mini_program_code(
    client: AsyncClient, go_wechat: StartWechat
) -> None:
    code_requests: list[dict[str, object]] = []

    def fake_login_code(body: dict[str, object]) -> bytes:
        code_requests.append(body)
        assert body["page"] == "pages/web-login/web-login"
        assert body["check_path"] is False
        assert re.fullmatch(r"[0-9a-f]{32}", str(body["scene"]))
        return b"qr-login-png"

    await go_wechat(material_code=fake_login_code)

    created = await client.post("/api/v1/auth/qr-sessions")
    assert created.status_code == 201, created.text
    session = created.json()
    assert re.fullmatch(
        r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
        session["session_id"],
    )
    assert session["expires_at"].endswith("+00:00")
    session_id = session["session_id"]

    # 未确认时轮询只返回 pending，不能拿到任何令牌。
    pending = await client.get(f"/api/v1/auth/qr-sessions/{session_id}")
    assert pending.status_code == 200
    assert pending.json()["status"] == "pending"
    assert pending.json()["access_token"] is None

    code = await client.get(f"/api/v1/auth/qr-sessions/{session_id}/code")
    assert code.status_code == 200, code.text
    assert code.headers["content-type"] == "image/png"
    assert code.headers["cache-control"] == "no-store"
    assert code.content == b"qr-login-png"
    # 同一会话第二次取码使用内存缓存，不再调微信接口。
    again = await client.get(f"/api/v1/auth/qr-sessions/{session_id}/code")
    assert again.content == b"qr-login-png"
    assert len(code_requests) == 1

    headers = await mini_headers("扫码登录用户")
    confirmed = await client.post(
        "/api/v1/mini-program/qr-login/confirm",
        headers=headers,
        json={"session_id": session_id.replace("-", "")},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json() == {"status": "confirmed"}

    result = await client.get(f"/api/v1/auth/qr-sessions/{session_id}")
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["status"] == "confirmed"
    assert body["token_type"] == "bearer"
    assert body["refresh_token"]
    assert body["user"]["display_name"] == "扫码登录用户"
    assert body["user"]["permissions"]

    # 扫码登录拿到的是管理端访问令牌，可直接访问管理端接口。
    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200, me.text
    assert me.json()["id"] == body["user"]["id"]
    assert me.json()["display_name"] == "扫码登录用户"
    assert "source" not in me.json()

    # 登录结果只能取一次；再次轮询得到 expired。
    consumed = await client.get(f"/api/v1/auth/qr-sessions/{session_id}")
    assert consumed.json()["status"] == "expired"
    assert consumed.json()["access_token"] is None


@pytest.mark.asyncio
async def test_qr_login_conflict_and_unknown_session(client: AsyncClient) -> None:
    unknown = await client.get(
        "/api/v1/auth/qr-sessions/0198f3a7-2c00-7000-8000-000000000001"
    )
    assert unknown.status_code == 200
    assert unknown.json()["status"] == "expired"

    expired_confirm = await client.post(
        "/api/v1/mini-program/qr-login/confirm",
        headers=await mini_headers("冲突用户一"),
        json={"session_id": "0198f3a72c0070008000000000000001"},
    )
    assert expired_confirm.status_code == 400
    assert expired_confirm.json()["code"] == "QR_SESSION_EXPIRED"

    created = await client.post("/api/v1/auth/qr-sessions")
    session_id = created.json()["session_id"]

    first = await mini_headers("冲突用户一")
    second = await mini_headers("冲突用户二")
    assert (
        await client.post(
            "/api/v1/mini-program/qr-login/confirm",
            headers=first,
            json={"session_id": session_id},
        )
    ).status_code == 200
    conflict = await client.post(
        "/api/v1/mini-program/qr-login/confirm",
        headers=second,
        json={"session_id": session_id},
    )
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "QR_SESSION_CONFLICT"

    result = await client.get(f"/api/v1/auth/qr-sessions/{session_id}")
    assert result.json()["status"] == "confirmed"
    assert result.json()["user"]["display_name"] == "冲突用户一"
