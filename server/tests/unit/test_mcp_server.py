from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app import mcp_server
from app.main import app
from app.mcp_server import (
    EXCLUDED_PATHS,
    EXCLUDED_PREFIXES,
    HTTP_METHODS,
    MANAGED_HEADERS,
    _build_path,
    _operation_catalog,
    operation_call,
    operation_describe,
    operations_list,
)


def test_operation_catalog_exposes_management_apis_only() -> None:
    catalog = _operation_catalog()

    assert catalog
    assert any(item["path"] == "/api/v1/stock-materials" for item in catalog.values())
    assert any(item["path"] == "/api/v1/purchase-materials" for item in catalog.values())
    assert all(not item["path"].startswith("/api/v1/mini-program/") for item in catalog.values())
    assert all(item["path"] != "/api/v1/auth/login" for item in catalog.values())
    assert all(item["path"] != "/api/v1/auth/refresh" for item in catalog.values())


def test_every_exclusion_still_matches_a_live_route() -> None:
    """排除清单不能留陈旧项：端点被删/改名后必须同步清理 mcp_server.py 与文档。"""
    paths = list(app.openapi()["paths"])

    for path in sorted(EXCLUDED_PATHS):
        assert path in paths, f"排除的路径 {path} 已不是存活路由，请同步清理排除清单与文档"
    for prefix in EXCLUDED_PREFIXES:
        assert any(path.startswith(prefix) for path in paths), (
            f"排除的前缀 {prefix} 已匹配不到任何路由，请同步清理排除清单与文档"
        )


def test_catalog_plus_exclusions_cover_every_operation() -> None:
    """目录 + 排除项必须覆盖应用的全部业务操作，缺一个就说明 MCP 操作不到该功能。"""
    catalog = {(item["method"], item["path"]) for item in _operation_catalog().values()}
    operations = _openapi_operations()
    excluded = {
        key
        for key, path in operations.items()
        if path in EXCLUDED_PATHS or path.startswith(EXCLUDED_PREFIXES)
    }

    assert catalog == set(operations) - excluded
    assert excluded, "排除清单不应为空：至少要排除登录与刷新接口"


def test_every_catalog_operation_is_callable_by_operation_call() -> None:
    """目录里的每个操作都必须能被 operation_call 完整表达。

    新增接口若用了 operation_call 传不了的参数位置（cookie、多文件、其它表单字段、
    非 JSON/multipart 请求体），这条会失败：需要先扩展 operation_call，或把接口排除并同步文档。
    """
    for operation in _operation_catalog().values():
        arguments = operation["call_arguments"]
        locations = {item["in"] for item in operation["parameters"]}
        assert locations <= {"path", "query", "header"}, (operation["operation_id"], locations)

        content = (operation["request_body"] or {}).get("content", {})
        assert set(content) <= {"application/json", "multipart/form-data"}, (
            operation["operation_id"],
            sorted(content),
        )

        # 托管头不能出现在可传列表里（否则调用方能改令牌/项目）
        assert not ({item["name"].casefold() for item in arguments["headers"]} & MANAGED_HEADERS)

        if "multipart/form-data" in content:
            # operation_call 只按 `file` 字段名上传附件，其它表单字段都传不进去
            assert arguments["file"] == "file", operation["operation_id"]
            assert _multipart_required_fields(operation) == {"file"}, operation["operation_id"]
            assert arguments["body"] is None
        else:
            assert arguments["file"] is None
            assert arguments["body"] == (sorted(content) or None)


def test_operation_list_and_describe_use_openapi_contract() -> None:
    listed = asyncio.run(operations_list(keyword="stock"))

    assert listed["count"] > 0
    operation_id = listed["operations"][0]["operation_id"]
    described = asyncio.run(operation_describe(operation_id))
    assert described["operation_id"] == operation_id
    assert described["method"] in {"GET", "POST", "PUT", "PATCH", "DELETE"}
    referenced_names = {
        reference.removeprefix("#/components/schemas/")
        for reference in _collect_references(described)
    }
    assert referenced_names <= described["schemas"].keys()


def test_operation_describe_reports_call_arguments() -> None:
    described = asyncio.run(
        operation_describe("delete_ledger_tag_api_v1_ledger_tags__tag_id__delete")
    )

    assert described["call_arguments"] == {
        "path_params": ["tag_id"],
        "query": [],
        "headers": [
            {"name": "if-match", "note": "乐观锁版本号（String(version)）；不传则不校验版本"}
        ],
        "body": None,
        "file": None,
    }


def test_build_path_requires_exact_parameters() -> None:
    assert _build_path("/api/v1/items/{item_id}", {"item_id": "a/b"}) == (
        "/api/v1/items/a%2Fb"
    )
    with pytest.raises(ValueError, match="缺少路径参数"):
        _build_path("/api/v1/items/{item_id}", {})
    with pytest.raises(ValueError, match="未定义"):
        _build_path("/api/v1/items/{item_id}", {"item_id": 1, "other": 2})


def test_mcp_mount_is_not_part_of_business_openapi() -> None:
    assert "/api/v1/mcp" not in app.openapi()["paths"]


def test_operation_call_forwards_declared_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    """operation_call 把 If-Match 之类的已声明请求头转发给内部业务接口。"""
    captured: dict[str, Any] = {}

    async def fake_call_internal(
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        body: dict[str, Any] | list[Any] | None = None,
        file: Any = None,
    ) -> dict[str, Any]:
        captured.update(method=method, path=path, headers=headers)
        return {"status_code": 204, "data": None}

    monkeypatch.setattr(mcp_server, "_call_internal", fake_call_internal)
    operation_id = "delete_ledger_tag_api_v1_ledger_tags__tag_id__delete"

    async def scenario() -> None:
        # 头名按 HTTP 语义大小写不敏感，转发时用 OpenAPI 里声明的名字
        result = await operation_call(
            operation_id, path_params={"tag_id": "a/b"}, headers={"If-Match": '"3"'}
        )
        assert result == {"status_code": 204, "data": None}
        assert captured["method"] == "DELETE"
        assert captured["path"] == "/api/v1/ledger-tags/a%2Fb"
        assert captured["headers"] == {"if-match": '"3"'}

        # 不带 headers 时不报错
        await operation_call(operation_id, path_params={"tag_id": 1})
        assert captured["headers"] == {}

        for invalid, message in [
            ({"X-API-Token": "spoofed"}, "由 MCP 统一设置"),
            ({"X-Project-Id": "2"}, "由 MCP 统一设置"),
            ({"X-Trace": "1"}, "不接受请求头"),
            ({"If-Match": 3}, "必须是字符串"),
        ]:
            with pytest.raises(ValueError, match=message):
                await operation_call(operation_id, path_params={"tag_id": 1}, headers=invalid)

    asyncio.run(scenario())


def _openapi_operations() -> dict[tuple[str, str], str]:
    """返回 {(METHOD, path): path}，只含 MCP 支持传输的 HTTP 方法。"""
    operations: dict[tuple[str, str], str] = {}
    for path, item in app.openapi()["paths"].items():
        for method, operation in item.items():
            if method in HTTP_METHODS and isinstance(operation, dict):
                operations[(method.upper(), path)] = path
    return operations


def _multipart_required_fields(operation: dict[str, Any]) -> set[str]:
    schema = operation["request_body"]["content"]["multipart/form-data"].get("schema", {})
    reference = schema.get("$ref", "")
    prefix = "#/components/schemas/"
    if reference.startswith(prefix):
        schema = operation["schemas"].get(reference.removeprefix(prefix), schema)
    return set(schema.get("required", []))


def _collect_references(value: object) -> set[str]:
    if isinstance(value, dict):
        references = {
            item for key, item in value.items() if key == "$ref" and isinstance(item, str)
        }
        for child in value.values():
            references.update(_collect_references(child))
        return references
    if isinstance(value, list):
        references: set[str] = set()
        for child in value:
            references.update(_collect_references(child))
        return references
    return set()
