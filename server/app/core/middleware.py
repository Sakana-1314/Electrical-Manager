from __future__ import annotations

import logging
import time
import uuid
from ipaddress import ip_address
from urllib.parse import urlsplit

from fastapi import Request, Response
from starlette.datastructures import Headers, MutableHeaders
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.database import commit_current_session
from app.core.db_timing import begin_database_timing, finish_database_timing
from app.core.project_scope import pop_current_project, push_current_project

logger = logging.getLogger("spare_parts.api")


def _project_id_from_header(request: Request) -> int | None:
    raw = (request.headers.get("X-Project-Id") or "").strip()
    if not raw:
        return None
    try:
        project_id = int(raw)
    except ValueError:
        return None
    return project_id if project_id > 0 else None


class CommitBeforeResponseMiddleware:
    """把请求事务的提交提前到响应头发出之前。

    FastAPI 的 `yield` 依赖（`get_db`）在响应发送**之后**才收尾，于是「接口返回 2xx」与
    「写库提交可见」之间存在一个窗口：客户端拿到 201 立刻回读，读到的是提交前的旧值
    （端到端模拟里表现成「出库成功但余额没变」或「刚建的物资入库报 409 BALANCE_MISSING」，
    网页端表现成保存成功后立刻刷新还是旧数据）。

    本中间件在 `http.response.start` 之前提交，让「返回成功」与「写库可见」对上。它必须是最
    内层中间件（`main.py` 里第一个注册，因而在所有 `BaseHTTPMiddleware` 之内）：只有和路由处理
    跑在同一个任务里，提交才不会与依赖收尾跨任务并发抢同一个会话，也必然早于响应字节发出。
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_after_commit(message: Message) -> None:
            if message["type"] == "http.response.start":
                await commit_current_session()
            await send(message)

        await self.app(scope, receive, send_after_commit)


async def project_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """把 `X-Project-Id` 落到请求上下文：带上该头的请求一律按项目过滤。

    这里只「设定」、不查库校验：业务路由上的 `require_current_project` 依赖负责
    校验并给出明确错误；匿名入口（分享、导出下载）与小程序、MCP 各自显式解析项目。
    没带头时保持「未设定」，项目域语句会 fail-closed 报 `PROJECT_REQUIRED`。
    """
    project_id = _project_id_from_header(request)
    if project_id is None:
        return await call_next(request)
    request.state.project_id = project_id
    token = push_current_project(project_id)
    try:
        return await call_next(request)
    finally:
        pop_current_project(token)


def _real_ip(scope: Scope) -> str | None:
    headers = Headers(scope=scope)
    candidates = (
        headers.get("EO-Connecting-IP"),
        headers.get("X-Real-IP"),
        (headers.get("X-Forwarded-For") or "").split(",", 1)[0],
    )
    for value in candidates:
        if not value or not (candidate := value.strip()):
            continue
        try:
            return str(ip_address(candidate))
        except ValueError:
            continue
    return None


def _origin_from_url(value: str | None) -> str | None:
    if not value or not (url := value.strip()):
        return None
    if url == "null":
        return url
    parsed = urlsplit(url)
    if not parsed.scheme or not parsed.netloc:
        return None
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def _cors_origin(headers: Headers, allowed_origins: list[str]) -> str | None:
    """返回允许回显的 Origin。

    Referer 优先（兼容不发 Origin 的内嵌 WebView/微信），缺失时回退 Origin。
    仅当来源在白名单内才回显；不在白名单返回 None（浏览器会拦截跨域响应）。
    """
    origin = _origin_from_url(headers.get("Referer"))
    if origin is None:
        origin = _origin_from_url(headers.get("Origin"))
    if origin is None:
        return None
    if not allowed_origins or _is_allowed_origin(origin, allowed_origins):
        return origin
    return None


def _is_allowed_origin(origin: str, allowed_origins: list[str]) -> bool:
    """精确匹配或 host 后缀匹配（.example.com 匹配 app.example.com 等子域）。"""
    parsed = urlsplit(origin)
    host = parsed.netloc.lower()
    if origin in allowed_origins:
        return True
    return any(
        allowed.lower() in ("*", host)
        or (allowed.lower().startswith(".") and host.endswith(allowed.lower()))
        for allowed in allowed_origins
    )


class RefererCORSMiddleware:
    """Allow cross-origin requests using Referer first, then Origin as fallback."""

    _allow_methods = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
    _expose_headers = (
        "Content-Disposition, X-Request-ID, X-Response-Time, "
        "X-DB-Time, X-DB-Queries, X-Compute-Time"
    )

    def __init__(
        self,
        app: ASGIApp,
        *,
        allow_credentials: bool = True,
        max_age: int = 86400,
        allowed_origins: list[str] | None = None,
    ) -> None:
        self.app = app
        self.allow_credentials = allow_credentials
        self.max_age = max_age
        # 优先使用显式传入的白名单；否则在请求时读 settings.cors_origins
        # （settings 为进程级单例，启动时从环境变量加载，生产环境安全且便于测试）。
        self.allowed_origins = allowed_origins

    def _apply_headers(self, headers: MutableHeaders, origin: str) -> None:
        headers["Access-Control-Allow-Origin"] = origin
        if self.allow_credentials:
            headers["Access-Control-Allow-Credentials"] = "true"
        headers["Access-Control-Expose-Headers"] = self._expose_headers
        headers.add_vary_header("Origin")
        headers.add_vary_header("Referer")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_headers = Headers(scope=scope)
        allowed = self.allowed_origins
        if allowed is None:
            from app.core.config import settings

            allowed = settings.cors_origins
        origin = _cors_origin(request_headers, allowed)
        if origin is None:
            await self.app(scope, receive, send)
            return

        if scope["method"] == "OPTIONS" and request_headers.get("Access-Control-Request-Method"):
            response_headers = {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Methods": self._allow_methods,
                "Access-Control-Max-Age": str(self.max_age),
                "Access-Control-Expose-Headers": self._expose_headers,
                "Vary": "Origin, Referer",
            }
            if self.allow_credentials:
                response_headers["Access-Control-Allow-Credentials"] = "true"
            if requested_headers := request_headers.get("Access-Control-Request-Headers"):
                response_headers["Access-Control-Allow-Headers"] = requested_headers
            if request_headers.get("Access-Control-Request-Private-Network") == "true":
                response_headers["Access-Control-Allow-Private-Network"] = "true"
            response = PlainTextResponse("OK", status_code=200, headers=response_headers)
            await response(scope, receive, send)
            return

        async def send_with_cors(message: Message) -> None:
            if message["type"] == "http.response.start":
                self._apply_headers(MutableHeaders(scope=message), origin)
            await send(message)

        await self.app(scope, receive, send_with_cors)


class RealIPMiddleware:
    """Expose the client IP supplied by the trusted edge proxy to downstream requests."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and (real_ip := _real_ip(scope)):
            scope = dict(scope)
            client = scope.get("client")
            scope["client"] = (real_ip, client[1] if client else 0)
        await self.app(scope, receive, send)


async def request_context(request: Request, call_next: RequestResponseEndpoint) -> Response:
    """为每个请求注入 request_id、接口性能响应头并记录访问日志。

    响应头都在服务端计量（从收到请求到生成响应），不含网络传输时间，便于定位瓶颈：

    - ``X-Response-Time``：服务端处理总耗时（毫秒）。
    - ``X-DB-Time``：其中数据库语句执行耗时合计（毫秒）。
    - ``X-Compute-Time``：其中应用计算耗时（毫秒）= 总耗时 - 数据库耗时，
      含参数校验、权限、序列化等非数据库工作。
    - ``X-DB-Queries``：本次请求执行的 SQL 条数（配合耗时判断 N+1 等问题）。
    """
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:128]
    request.state.request_id = request_id
    db_timing = begin_database_timing()
    started = time.perf_counter()
    try:
        response = await call_next(request)
    finally:
        finish_database_timing()
    elapsed_ms = (time.perf_counter() - started) * 1000
    db_ms = min(db_timing.total_ms, elapsed_ms)
    compute_ms = elapsed_ms - db_ms
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time"] = f"{elapsed_ms:.2f}"
    response.headers["X-DB-Time"] = f"{db_ms:.2f}"
    response.headers["X-Compute-Time"] = f"{compute_ms:.2f}"
    response.headers["X-DB-Queries"] = str(db_timing.statement_count)
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "HTTP %s %s -> %s | %.2f ms | db=%.2f ms/%s query | compute=%.2f ms | "
        "client_ip=%s | user=%s | request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        db_ms,
        db_timing.statement_count,
        compute_ms,
        client_ip,
        getattr(request.state, "username", "anonymous"),
        request_id,
    )
    return response
