"""本地上游桩服务：替被测服务扮演外部上游（AI 搜索、飞书 / 钉钉 Webhook、微信接口）。

桩服务把收到的请求还原成 `httpx.Request`（URL 主机取自 Host 头，即服务改投前的原始上游，
如 open.feishu.cn），交给用例给的 handler，再把返回的 `httpx.Response` 写回。服务通过仅在
APP_TEST_HOOKS=1 时注册的 `/__test__/<kind>/upstream` 钩子把对应上游改投到桩服务。
"""

from __future__ import annotations

import asyncio
import inspect
import json
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

            do_GET = do_POST  # noqa: N815  (微信 code2session / access_token 是 GET)

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
    """测试钩子：让服务投递一条待发送的 Webhook，返回是否投递了。"""
    response = await client.post("/__test__/webhook/deliver-once")
    assert response.status_code == 200, response.text
    return bool(response.json()["delivered"])


# ---------------- 微信接口桩（小程序用例） ----------------

ExchangeFake = Callable[..., Awaitable[tuple[str, str]]]
CodeFake = Callable[[dict[str, Any]], bytes | Awaitable[bytes]]
StartWechat = Callable[..., Awaitable[UpstreamStub]]


def wechat_handler(
    exchange: ExchangeFake | None = None, material_code: CodeFake | None = None
) -> Handler:
    """把用例里伪造的 `exchange_wechat_code` / 小程序码生成函数包装成微信接口桩。

    - `GET /sns/jscode2session`：调用 `exchange(js_code, appid)`，返回 `{"openid": ...}`；
    - `GET /cgi-bin/token`：返回固定的 access_token；
    - `POST /wxa/getwxacodeunlimit`：调用 `material_code(请求体)`，以 image/png 返回其字节。
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        params = request.url.params
        if path == "/sns/jscode2session" and exchange is not None:
            _app_id, openid = await exchange(params["js_code"], params.get("appid"))
            return httpx.Response(200, json={"openid": openid, "session_key": "stub"})
        if path == "/cgi-bin/token":
            return httpx.Response(
                200, json={"access_token": f"stub-token-{params.get('appid')}", "expires_in": 7200}
            )
        if path == "/wxa/getwxacodeunlimit" and material_code is not None:
            result = material_code(json.loads(request.content))
            if inspect.isawaitable(result):
                result = await result
            return httpx.Response(200, content=result, headers={"content-type": "image/png"})
        return httpx.Response(200, json={"errcode": 40001, "errmsg": f"unexpected {path}"})

    return handler


@pytest_asyncio.fixture
async def go_wechat(client: AsyncClient) -> AsyncIterator[StartWechat]:
    """返回 `start(exchange=..., material_code=...)`：启动微信接口桩，并通过
    `/api/v1/__test__/mini-program/upstream` 让服务改投；用例结束时恢复并关闭桩服务。"""
    started: list[UpstreamStub] = []

    async def start(
        *, exchange: ExchangeFake | None = None, material_code: CodeFake | None = None
    ) -> UpstreamStub:
        stub = UpstreamStub(wechat_handler(exchange, material_code))
        stub.start()
        response = await client.post(
            "/api/v1/__test__/mini-program/upstream", json={"base_url": stub.base_url}
        )
        assert response.status_code == 200, response.text
        started.append(stub)
        return stub

    yield start
    if started:
        await client.post("/api/v1/__test__/mini-program/upstream", json={"base_url": ""})
    for stub in started:
        stub.stop()
