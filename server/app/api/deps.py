"""API 层共享依赖注入：跨路由文件重复的 Annotated 参数类型。"""

from collections.abc import AsyncIterator
from typing import Annotated, Literal

from fastapi import Depends, Query

from app.core.errors import AppError
from app.core.permissions import DbSession
from app.core.project_scope import system_scope
from app.services import ai_search_service

PageNo = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=200)]

StatusFilter = Annotated[str | None, Query(alias="status", max_length=128)]

SortOrder = Annotated[Literal["asc", "desc"], Query()]

OR_SEARCH_DESCRIPTION = "可使用 | 或 ｜ 分隔多个关键词，同一参数内匹配任意关键词"
OrSearch = Annotated[str | None, Query(description=OR_SEARCH_DESCRIPTION)]
OrSearch128 = Annotated[str | None, Query(max_length=128, description=OR_SEARCH_DESCRIPTION)]
OrSearch255 = Annotated[str | None, Query(max_length=255, description=OR_SEARCH_DESCRIPTION)]


async def _require_full_secondary_warehouse(session: DbSession) -> None:
    """二级库精简模式下只允许导入与查询：拦截完整模式写接口（防绕过）。"""
    if await ai_search_service.is_lite_secondary_warehouse(session):
        raise AppError(
            "SECONDARY_WAREHOUSE_LITE_MODE",
            "精简模式下二级库仅支持导入与查询",
            status_code=403,
        )


RequireFullSecondaryWarehouse = Annotated[None, Depends(_require_full_secondary_warehouse)]


async def system_scope_dependency() -> AsyncIterator[None]:
    """把整个请求放进「跨项目」上下文（`system_scope`）。

    只给系统级接口用：附件管理/清理面向全局附件池（`file_object` 按 sha256 全局去重、
    引用计数跨项目），如果按当前项目统计引用，会把别的项目仍在引用的文件判成可清理。
    """
    with system_scope():
        yield


SystemScope = Annotated[None, Depends(system_scope_dependency)]
