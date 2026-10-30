"""Go 黑盒契约测试专用：本地上游桩服务（替代 Python 用例里对 httpx 客户端的 monkeypatch）。

只在设置了 GO_SERVER_URL 时使用：桩服务把收到的请求还原成 `httpx.Request`（URL 主机取自 Host 头，
即 Go 服务改投前的原始上游，如 open.feishu.cn），交给用例原有的 handler，再把返回的
`httpx.Response` 写回。Go 服务通过仅在 APP_TEST_HOOKS=1 时注册的 `/__test__/<kind>/upstream`
钩子把对应上游（`ai-search` / `webhook`）改投到桩服务。
"""

from __future__ import annotations

import asyncio
import inspect
import threading
from collections.abc import AsyncIterator, Awaitable, Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import httpx
import pytest_asyncio
from httpx import AsyncClient

Handler = Callable[[httpx.Request], httpx.Response | Awaitable[httpx.Response]]


class UpstreamStub:
    def __init__(self, handler: Handler) -> None:
        self.handler = handler
        self.requests: list[httpx.Request] = []
        stub = self

        class _RequestHandler(BaseHTTPRequestHandler):
            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                content = self.rfile.read(length)
                host = (self.headers.get("Host") or "").split(":")[0]
                request = httpx.Request(
                    self.command,
                    f"https://{host}{self.path}",
                    headers=[(k, v) for k, v in self.headers.items() if k.lower() != "host"],
                    content=content,
                )
                stub.requests.append(request)
                result = stub.handler(request)
                if inspect.isawaitable(result):
                    result = asyncio.run(_await(result))
                assert isinstance(result, httpx.Response)
                body = result.content
                try:
                    self.send_response(result.status_code)
                    for key, value in result.headers.items():
                        if key.lower() not in {"content-length", "transfer-encoding"}:
                            self.send_header(key, value)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *_args: Any) -> None:
                return None

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), _RequestHandler)
        self._server.daemon_threads = True
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        host, port = self._server.server_address[:2]
        return f"http://{host}:{port}"

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._server.shutdown()
        self._server.server_close()


async def _await(value: Awaitable[httpx.Response]) -> httpx.Response:
    return await value


StartUpstream = Callable[..., Awaitable[UpstreamStub]]


@pytest_asyncio.fixture
async def go_upstream(client: AsyncClient) -> AsyncIterator[StartUpstream]:
    """返回 `start(kind, handler, response_timeout_seconds=0)`；用例结束时取消改投并关闭桩服务。"""
    started: list[tuple[str, UpstreamStub]] = []

    async def start(
        kind: str, handler: Handler, *, response_timeout_seconds: float = 0
    ) -> UpstreamStub:
        stub = UpstreamStub(handler)
        stub.start()
        body: dict[str, Any] = {"base_url": stub.base_url}
        if kind == "ai-search":
            body["response_timeout_seconds"] = response_timeout_seconds
        response = await client.post(f"/__test__/{kind}/upstream", json=body)
        assert response.status_code == 200, response.text
        started.append((kind, stub))
        return stub

    yield start
    for kind, stub in started:
        await client.post(f"/__test__/{kind}/upstream", json={"base_url": ""})
        stub.stop()


async def deliver_pending_once(client: AsyncClient) -> bool:
    """等价 `await webhook_service.deliver_pending_once()`：让 Go 服务投递一条。"""
    response = await client.post("/__test__/webhook/deliver-once")
    assert response.status_code == 200, response.text
    return bool(response.json()["delivered"])
