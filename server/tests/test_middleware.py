from __future__ import annotations

import asyncio
import re
from typing import Any, cast

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.middleware import CommitBeforeResponseMiddleware, RealIPMiddleware
from app.main import app


def _scope(headers: list[tuple[bytes, bytes]], client: tuple[str, int] | None = None) -> Scope:
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "server": ("testserver", 80),
        "client": client,
        "scheme": "http",
        "method": "GET",
        "root_path": "",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": headers,
        "state": {},
    }


async def _receive() -> Message:
    return {"type": "http.request", "body": b"", "more_body": False}


async def _send(message: Message) -> None:
    pass


async def _captured_client(scope: Scope) -> tuple[str, int] | None:
    captured: dict[str, Any] = {}

    async def endpoint(inner_scope: Scope, receive: Receive, send: Send) -> None:
        captured["client"] = inner_scope.get("client")

    await RealIPMiddleware(endpoint)(scope, _receive, _send)
    return captured["client"]


@pytest.mark.asyncio
async def test_real_ip_header_priority() -> None:
    client = await _captured_client(
        _scope(
            [
                (b"eo-connecting-ip", b"203.0.113.10"),
                (b"x-real-ip", b"203.0.113.20"),
                (b"x-forwarded-for", b"203.0.113.30, 10.0.0.1"),
            ],
            ("10.0.0.2", 4321),
        )
    )

    assert client == ("203.0.113.10", 4321)


@pytest.mark.asyncio
async def test_real_ip_uses_first_forwarded_address() -> None:
    client = await _captured_client(
        _scope([(b"x-forwarded-for", b" 2001:db8::1, 10.0.0.1")], ("10.0.0.2", 80))
    )

    assert client == ("2001:db8::1", 80)


@pytest.mark.asyncio
async def test_real_ip_skips_invalid_headers_and_handles_missing_client() -> None:
    client = await _captured_client(
        _scope(
            [(b"eo-connecting-ip", b"invalid"), (b"x-real-ip", b"198.51.100.9")]
        )
    )

    assert client == ("198.51.100.9", 0)


@pytest.mark.asyncio
async def test_real_ip_keeps_original_client_without_valid_proxy_header() -> None:
    client = await _captured_client(
        _scope([(b"x-forwarded-for", b"not-an-ip")], ("10.0.0.2", 1234))
    )

    assert client == ("10.0.0.2", 1234)


@pytest.mark.asyncio
async def test_request_context_adds_response_time_header(client: AsyncClient) -> None:
    """每个响应都带 X-Response-Time（毫秒，非负数字）与 X-Request-ID。"""
    response = await client.get("/health")

    assert response.status_code == 200
    assert response.headers["X-Request-ID"]
    response_time = response.headers["X-Response-Time"]
    assert re.fullmatch(r"\d+(\.\d+)?", response_time)
    assert float(response_time) >= 0


def test_commit_middleware_is_innermost() -> None:
    """`CommitBeforeResponseMiddleware` 必须站在最内层（所有 BaseHTTPMiddleware 之内）。

    只有与路由处理同任务，它才能在响应字节发出之前提交、且不与依赖收尾并发抢同一个会话；
    注册顺序被挪动时这里直接失败（理由见类文档）。
    """
    # `Starlette.build_middleware_stack` 从 user_middleware 末尾开始反向套娃，末尾即最内层。
    innermost = cast(object, app.user_middleware[-1].cls)

    assert innermost is CommitBeforeResponseMiddleware


class _RecordingApp:
    """把 app 包一层，记录响应头（`http.response.start`）发出的先后顺序。"""

    def __init__(self, asgi_app: ASGIApp, events: list[str]) -> None:
        self.asgi_app = asgi_app
        self.events = events

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.asgi_app(scope, receive, send)
            return

        async def recorded_send(message: Message) -> None:
            if message["type"] == "http.response.start":
                self.events.append("response.start")
            await send(message)

        await self.asgi_app(scope, receive, recorded_send)


@pytest.mark.asyncio
async def test_write_transaction_is_committed_before_response_start(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """写接口的事务必须在响应头发给客户端之前提交。

    否则客户端拿到 201 立刻回读，读到的是提交前的旧值（端到端模拟里就是
    「出库返回成功、余额却没变」）。这里把 commit 放慢，让「提交晚于响应」的实现无处可藏：
    提交慢不影响结论，因为提交必须发生在响应头之前。
    """
    events: list[str] = []
    recorder = _RecordingApp(app, events)
    original_commit = AsyncSession.commit

    async def slow_commit(session: AsyncSession) -> None:
        events.append("commit")
        await asyncio.sleep(0.2)
        await original_commit(session)

    monkeypatch.setattr(AsyncSession, "commit", slow_commit)

    async with AsyncClient(transport=ASGITransport(app=recorder), base_url="http://test") as http:
        http.headers["X-Project-Id"] = "1"
        login = await http.post(
            "/api/v1/auth/login", json={"username": "warehouse", "password": "123456"}
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        events.clear()  # 只观察业务写请求本身
        created = await http.post(
            "/api/v1/stock-materials",
            headers=headers,
            json={"name": "提交顺序校验物资", "model_spec": "COMMIT", "unit_name": "个"},
        )

    assert created.status_code == 201, created.text
    assert "commit" in events and "response.start" in events, (
        f"写请求没有产生提交/响应事件: {events}"
    )
    assert events.index("commit") < events.index("response.start"), (
        f"事务提交晚于响应头：{events}"
    )
