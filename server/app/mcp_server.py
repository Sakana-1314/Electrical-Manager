from __future__ import annotations

import base64
import binascii
import re
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import parse_qs, quote

import httpx
from fastapi import FastAPI
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.database import SessionLocal
from app.core.permissions import find_user_by_api_token
from app.models import Project

MAX_BINARY_RESPONSE_BYTES = 25 * 1024 * 1024
EXCLUDED_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/refresh",
}
EXCLUDED_PREFIXES = ("/api/v1/mini-program/",)
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
# 由 MCP 层统一设置、不接受调用方覆盖的请求头：令牌与项目都来自 MCP 连接本身。
MANAGED_HEADERS = frozenset({"x-api-token", "x-project-id"})
# 已知请求头的中文说明，补进 operation_describe 的参数落位提示。
HEADER_NOTES = {
    "if-match": "乐观锁版本号（String(version)）；不传则不校验版本",
}


@dataclass(frozen=True)
class McpIdentity:
    id: int
    username: str
    display_name: str
    role: str


class McpFileInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)
    mime_type: str = Field(default="application/octet-stream", min_length=1, max_length=128)


_application: FastAPI | None = None
_token_context: ContextVar[str | None] = ContextVar("mcp_api_token", default=None)
_identity_context: ContextVar[McpIdentity | None] = ContextVar("mcp_identity", default=None)
# 当前 MCP 请求的项目：调用方可用 `X-Project-Id` 头指定，缺省落到默认项目。
_project_context: ContextVar[int | None] = ContextVar("mcp_project_id", default=None)
# 项目从哪里解析出来（header / link / default），供 system_whoami 回显。
_project_source_context: ContextVar[str | None] = ContextVar("mcp_project_source", default=None)

mcp = MCPServer(
    "spare-parts-management",
    title="备件管理系统",
    description="通过受控业务接口操作备件、库存、申购、用户、系统配置和附件。",
    instructions=(
        "先调用 operations_list 查找操作，再调用 operation_describe 确认参数，最后使用 "
        "operation_call 执行。operation_describe 的 call_arguments 说明每个参数该放进 "
        "path_params / query / headers / body / file 的哪一个；带乐观锁的写操作把版本号放进 "
        "headers（如 {\"If-Match\": \"3\"}）。当前项目由 MCP 连接决定（请求头 X-Project-Id 优先，"
        "其次链接参数 ?project_id=，都缺省时用默认项目），可用 system_whoami 查看。"
        "不得猜测 operation_id 或绕过现有业务接口。"
    ),
)


def bind_application(application: FastAPI) -> None:
    global _application
    _application = application


def _require_application() -> FastAPI:
    if _application is None:
        raise RuntimeError("MCP 服务尚未绑定应用")
    return _application


def _require_token() -> str:
    token = _token_context.get()
    if token is None:
        raise RuntimeError("MCP 请求未通过接口令牌认证")
    return token


def _project_header() -> dict[str, str]:
    """转发给内部业务接口的项目头。

    业务接口都要求项目上下文（`X-Project-Id`），MCP 客户端可以在请求头里指定，也可以在
    MCP 链接上带 `?project_id=`；都没给时由认证中间件解析出系统默认项目，因此 AI 调用开箱即用。
    """
    project_id = _project_context.get()
    return {"X-Project-Id": str(project_id)} if project_id else {}


def _operation_catalog() -> dict[str, dict[str, Any]]:
    schema = _require_application().openapi()
    schemas = schema.get("components", {}).get("schemas", {})
    catalog: dict[str, dict[str, Any]] = {}
    for path, path_item in schema.get("paths", {}).items():
        if path in EXCLUDED_PATHS or path.startswith(EXCLUDED_PREFIXES):
            continue
        for method, operation in path_item.items():
            if method not in HTTP_METHODS or not isinstance(operation, dict):
                continue
            operation_id = operation.get("operationId")
            if not operation_id:
                continue
            details = {
                "operation_id": operation_id,
                "method": method.upper(),
                "path": path,
                "summary": operation.get("summary", ""),
                "description": operation.get("description", ""),
                "tags": operation.get("tags", []),
                "parameters": operation.get("parameters", []),
                "request_body": operation.get("requestBody"),
                "responses": operation.get("responses", {}),
            }
            details["schemas"] = _referenced_schemas(details, schemas)
            details["call_arguments"] = _call_arguments(details)
            catalog[operation_id] = details
    return catalog


def _call_arguments(details: dict[str, Any]) -> dict[str, Any]:
    """把 OpenAPI 里声明的参数映射到 `operation_call` 的实参位置。

    让 Agent 一眼看出每个参数该放进 `path_params` / `query` / `headers` / `body` / `file` 的哪一个；
    同时也是「目录里的操作都能被 operation_call 完整表达」这一约定的可断言形式。
    令牌与项目头不列入（由 MCP 层统一设置）。
    """
    parameters = details.get("parameters", [])
    content = (details.get("request_body") or {}).get("content", {})
    file_field = _multipart_file_field(details)
    return {
        "path_params": [item["name"] for item in parameters if item.get("in") == "path"],
        "query": [item["name"] for item in parameters if item.get("in") == "query"],
        "headers": [
            {
                "name": item["name"],
                # OpenAPI 里的头名是设备无关的小写形式（如 if-match），转发时按 HTTP 语义匹配
                "note": HEADER_NOTES.get(str(item["name"]).casefold(), ""),
            }
            for item in parameters
            if item.get("in") == "header" and str(item["name"]).casefold() not in MANAGED_HEADERS
        ],
        # multipart 走 file 参数而不是 body，所以此时 body 为 None
        "body": None if file_field else sorted(content) or None,
        "file": file_field,
    }


def _multipart_file_field(details: dict[str, Any]) -> str | None:
    """返回 multipart 表单里的文件字段名（没有 multipart 请求体时返回 None）。"""
    schema = (details.get("request_body") or {}).get("content", {}).get("multipart/form-data")
    if not schema:
        return None
    resolved = schema.get("schema", {})
    reference = resolved.get("$ref")
    prefix = "#/components/schemas/"
    if isinstance(reference, str) and reference.startswith(prefix):
        resolved = details.get("schemas", {}).get(reference.removeprefix(prefix), resolved)
    properties = resolved.get("properties", {})
    for name, spec in properties.items():
        if isinstance(spec, dict) and spec.get("format") == "binary":
            return str(name)
    return next(iter(properties), None)


def _referenced_schemas(value: Any, schemas: dict[str, Any]) -> dict[str, Any]:
    names: set[str] = set()

    def collect(node: Any) -> None:
        if isinstance(node, dict):
            reference = node.get("$ref")
            prefix = "#/components/schemas/"
            if isinstance(reference, str) and reference.startswith(prefix):
                name = reference.removeprefix(prefix)
                if name not in names and name in schemas:
                    names.add(name)
                    collect(schemas[name])
            for child in node.values():
                collect(child)
        elif isinstance(node, list):
            for child in node:
                collect(child)

    collect(value)
    return {name: schemas[name] for name in sorted(names)}


@mcp.tool(
    title="查看当前身份",
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def system_whoami() -> dict[str, Any]:
    """返回当前 MCP 令牌对应的管理端用户、角色，以及本次调用所属的项目。

    多项目隔离下业务数据只在「当前项目」内可见，这里显式回显项目与项目来源（请求头 / 链接参数 /
    默认项目），便于 Agent 自检。
    """
    identity = _identity_context.get()
    if identity is None:
        raise RuntimeError("MCP 请求未通过接口令牌认证")
    payload: dict[str, Any] = dict(asdict(identity))
    project_id = _project_context.get()
    payload["project_id"] = project_id
    payload["project_source"] = _project_source_context.get()
    if project_id is not None:
        async with SessionLocal() as session:
            project = await session.get(Project, project_id)
            if project is not None:
                payload["project_name"] = project.name
    return payload


@mcp.tool(
    title="查看可用项目",
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def projects_list() -> dict[str, Any]:
    """列出全部项目（多项目数据隔离：业务接口只操作当前项目的数据）。"""
    response = await _call_internal("GET", "/api/v1/projects")
    return response


@mcp.tool(
    title="查询可用操作",
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def operations_list(
    category: str | None = None, keyword: str | None = None
) -> dict[str, Any]:
    """列出可调用的业务操作。category 按接口标签筛选，keyword 按名称和说明搜索。"""
    operations = list(_operation_catalog().values())
    if category:
        normalized_category = category.casefold()
        operations = [
            item
            for item in operations
            if any(normalized_category in str(tag).casefold() for tag in item["tags"])
        ]
    if keyword:
        normalized_keyword = keyword.casefold()
        operations = [
            item
            for item in operations
            if normalized_keyword
            in " ".join(
                [item["operation_id"], item["summary"], item["description"], *item["tags"]]
            ).casefold()
        ]
    concise = [
        {
            "operation_id": item["operation_id"],
            "method": item["method"],
            "path": item["path"],
            "summary": item["summary"],
            "tags": item["tags"],
        }
        for item in operations
    ]
    return {"count": len(concise), "operations": concise}


@mcp.tool(
    title="查看操作参数",
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=False,
    ),
)
async def operation_describe(operation_id: str) -> dict[str, Any]:
    """返回指定业务操作的路径参数、查询参数、请求体和响应契约。"""
    operation = _operation_catalog().get(operation_id)
    if operation is None:
        raise ValueError(f"未知或不允许的 operation_id: {operation_id}")
    return operation


def _build_path(path_template: str, path_params: dict[str, Any]) -> str:
    required = set(re.findall(r"{([^{}]+)}", path_template))
    missing = required - path_params.keys()
    extra = path_params.keys() - required
    if missing:
        raise ValueError(f"缺少路径参数: {', '.join(sorted(missing))}")
    if extra:
        raise ValueError(f"存在未定义的路径参数: {', '.join(sorted(extra))}")
    path = path_template
    for name in required:
        path = path.replace(f"{{{name}}}", quote(str(path_params[name]), safe=""))
    return path


def _binary_result(response: httpx.Response) -> dict[str, Any]:
    if len(response.content) > MAX_BINARY_RESPONSE_BYTES:
        raise ValueError("接口返回文件超过 25 MB，无法通过 MCP 返回")
    disposition = response.headers.get("content-disposition", "")
    filename_match = re.search(r'filename="?([^";]+)', disposition, flags=re.IGNORECASE)
    return {
        "status_code": response.status_code,
        "content_type": response.headers.get("content-type", "application/octet-stream"),
        "filename": filename_match.group(1) if filename_match else None,
        "content_base64": base64.b64encode(response.content).decode("ascii"),
    }


@mcp.tool(
    title="执行业务操作",
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=True,
        idempotentHint=False,
        openWorldHint=False,
    ),
)
async def operation_call(
    operation_id: str,
    path_params: dict[str, Any] | None = None,
    query: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | list[Any] | None = None,
    file: McpFileInput | None = None,
) -> dict[str, Any]:
    """调用一个已登记的业务操作。

    path 参数放 `path_params`，查询参数放 `query`，JSON 请求体放 `body`，附件用
    `file.content_base64`；带乐观锁的写操作把版本号放 `headers`（如 `{"If-Match": "3"}`）。
    具体落位见 operation_describe 的 `call_arguments`。
    """
    operation = _operation_catalog().get(operation_id)
    if operation is None:
        raise ValueError(f"未知或不允许的 operation_id: {operation_id}")
    path = _build_path(operation["path"], path_params or {})
    return await _call_internal(
        operation["method"],
        path,
        params=query or {},
        headers=_operation_headers(operation, headers),
        body=body,
        file=file,
    )


def _operation_headers(operation: dict[str, Any], headers: dict[str, str] | None) -> dict[str, str]:
    """校验并归一化调用方传入的请求头：只允许该操作声明过的头，且不允许覆盖托管头。"""
    if not headers:
        return {}
    declared = {
        str(item["name"]).casefold(): str(item["name"])
        for item in operation.get("parameters", [])
        if item.get("in") == "header"
    }
    resolved: dict[str, str] = {}
    for name, value in headers.items():
        key = str(name).casefold()
        if key in MANAGED_HEADERS:
            raise ValueError(
                f"请求头 {name} 由 MCP 统一设置（令牌与项目取自 MCP 连接），不能通过 headers 传入"
            )
        if key not in declared:
            available = "、".join(sorted(declared)) or "无"
            raise ValueError(
                f"操作 {operation['operation_id']} 不接受请求头 {name}；可用：{available}"
            )
        if not isinstance(value, str):
            raise ValueError(f"请求头 {name} 的值必须是字符串")
        resolved[declared[key]] = value
    return resolved


async def _call_internal(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    body: dict[str, Any] | list[Any] | None = None,
    file: McpFileInput | None = None,
) -> dict[str, Any]:
    """按令牌 + 当前项目调用应用自身的 HTTP 接口（进程内 ASGI 转发）。"""
    # 托管头放在最后：即使调用方传了同名头也覆盖不了令牌与项目。
    request_headers = {
        **(headers or {}),
        "X-API-Token": _require_token(),
        **_project_header(),
    }
    request_kwargs: dict[str, Any] = {
        "method": method,
        "url": path,
        "params": params or {},
        "headers": request_headers,
    }
    if file is not None:
        if body is not None:
            raise ValueError("文件上传操作不能同时传 body")
        try:
            content = base64.b64decode(file.content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("file.content_base64 不是有效的 Base64") from exc
        request_kwargs["files"] = {
            "file": (file.filename, content, file.mime_type),
        }
    elif body is not None:
        request_kwargs["json"] = body

    transport = httpx.ASGITransport(app=_require_application())
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://mcp.internal",
        follow_redirects=True,
        timeout=60,
    ) as client:
        response = await client.request(**request_kwargs)

    content_type = response.headers.get("content-type", "").lower()
    if response.status_code == 204 or not response.content:
        return {"status_code": response.status_code, "data": None}
    if "application/json" in content_type:
        return {"status_code": response.status_code, "data": response.json()}
    return _binary_result(response)


async def _resolve_project_id(
    session: Any,
    headers: dict[bytes, bytes],
    query_project: str | None = None,
) -> tuple[int | None, str | None]:
    """MCP 请求的项目：`X-Project-Id` 头 → MCP 链接上的 `?project_id=` → 默认项目。

    优先级按「显式请求头覆盖链接默认值」排列（与其它接口的项目约定一致）。
    合法但已停用/不存在的 id 不回退，直接忽略并按下一档继续解析，避免把数据写到别处；
    三档都拿不到时返回 `(None, None)`（工具调用仍会因缺项目上下文而明确报错）。
    MCP 没有网页端的项目切换器，所以最后兜底到系统默认项目，保证 AI Agent 开箱可用。
    第二个返回值是来源（header / link / default），由 system_whoami 回显便于自检。
    """
    from app.services import project_service

    candidates = [
        ("header", (headers.get(b"x-project-id", b"") or b"").decode("latin-1").strip()),
        ("link", (query_project or "").strip()),
    ]
    for source, raw in candidates:
        if not raw:
            continue
        try:
            requested = int(raw)
        except ValueError:
            continue
        if requested <= 0:
            continue
        project = await session.get(Project, requested)
        if project is not None and project.enabled:
            return project.id, source
    project = await project_service.default_project(session)
    return (project.id, "default") if project is not None else (None, None)


async def _send_auth_error(send: Send, message: str) -> None:
    body = (f'{{"code":"INVALID_TOKEN","message":"{message}"}}').encode()
    await send(
        {
            "type": "http.response.start",
            "status": 401,
            "headers": [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})


class McpTokenAuthMiddleware:
    def __init__(self, application: ASGIApp):
        self.application = application

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.application(scope, receive, send)
            return
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        query = parse_qs(scope.get("query_string", b"").decode("utf-8"))
        token = query.get("token", [None])[0]
        if not token:
            token = headers.get(b"x-api-token", b"").decode("latin-1") or None
            authorization = headers.get(b"authorization", b"").decode("latin-1")
            scheme, _, credential = authorization.partition(" ")
            if not token and scheme.casefold() == "bearer" and credential:
                token = credential
        if not token:
            await _send_auth_error(send, "缺少 MCP 接口令牌")
            return

        async with SessionLocal() as session:
            user = await find_user_by_api_token(session, token)
            # 持久化懒迁移回写的令牌密文（见 permissions.find_user_by_api_token）
            await session.commit()
            project_id, project_source = await _resolve_project_id(
                session, headers, query.get("project_id", [None])[0]
            )
        if user is None or not user.enabled:
            await _send_auth_error(send, "MCP 接口令牌无效或用户已停用")
            return

        identity = McpIdentity(
            id=user.id,
            username=user.username,
            display_name=user.display_name,
            role=user.role.value,
        )
        token_marker = _token_context.set(token)
        identity_marker = _identity_context.set(identity)
        project_marker = _project_context.set(project_id)
        source_marker = _project_source_context.set(project_source)
        try:
            await self.application(scope, receive, send)
        finally:
            _project_source_context.reset(source_marker)
            _project_context.reset(project_marker)
            _identity_context.reset(identity_marker)
            _token_context.reset(token_marker)


# The endpoint is deployed behind a reverse proxy (1panel/nginx) and
# authenticated by McpTokenAuthMiddleware (X-API-Token header or ?token query),
# not by ambient browser cookies, so the SDK's default localhost-only DNS
# rebinding allowlist would reject the real public Host header with 421. Keep
# the transport-level host check disabled.
mcp_http_app = McpTokenAuthMiddleware(
    mcp.streamable_http_app(
        streamable_http_path="/",
        stateless_http=True,
        json_response=True,
        max_request_body_size=16 * 1024 * 1024,
        transport_security=TransportSecuritySettings(
            enable_dns_rebinding_protection=False,
        ),
    )
)
