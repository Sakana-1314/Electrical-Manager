"""台账管理接口：台账总览（台账记录）与分层标签。

权限：读取对所有登录用户开放（`CurrentUser`）；写操作需要 `LedgerWriter`
（超级管理员 / 台账管理员）。资源不存在按仓库约定返回 400 + `NOT_FOUND`。
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query, status

from app.api.deps import PageNo, PageSize
from app.core.permissions import CurrentUser, DbSession, IfMatchVersion, LedgerWriter
from app.schemas import (
    LedgerItemCreate,
    LedgerItemRead,
    LedgerItemUpdate,
    LedgerTagCreate,
    LedgerTagRead,
    LedgerTagUpdate,
    Page,
)
from app.services import ledger_service as service

router = APIRouter(tags=["台账管理"])

TagScope = Annotated[
    Literal["orphan", "tree"] | None,
    Query(description="orphan=只看孤立标签（无父无子）；tree=只看处在层级里的标签"),
]
TagIdsQuery = Annotated[
    str | None,
    Query(max_length=500, description="英文逗号分隔的标签 id，命中任一（含其子孙）即返回"),
]


# ===== 标签 =====


@router.get(
    "/ledger-tags",
    response_model=list[LedgerTagRead],
    summary="标签列表",
)
async def list_ledger_tags(
    session: DbSession,
    user: CurrentUser,
    keyword: Annotated[str | None, Query(max_length=128)] = None,
    scope: TagScope = None,
) -> list[LedgerTagRead]:
    return await service.list_tags(session, keyword=keyword, scope=scope)


@router.post(
    "/ledger-tags",
    response_model=LedgerTagRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增标签",
)
async def create_ledger_tag(
    data: LedgerTagCreate, session: DbSession, user: LedgerWriter
) -> LedgerTagRead:
    return await service.create_tag(session, data)


@router.patch(
    "/ledger-tags/{tag_id}",
    response_model=LedgerTagRead,
    summary="更新标签",
)
async def update_ledger_tag(
    tag_id: int,
    data: LedgerTagUpdate,
    session: DbSession,
    user: LedgerWriter,
) -> LedgerTagRead:
    return await service.update_tag(session, tag_id, data)


@router.delete(
    "/ledger-tags/{tag_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除标签",
)
async def delete_ledger_tag(
    tag_id: int,
    session: DbSession,
    user: LedgerWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_tag(session, tag_id, if_match)


# ===== 台账记录 =====


@router.get(
    "/ledger-items",
    response_model=Page[LedgerItemRead],
    summary="台账列表",
)
async def list_ledger_items(
    session: DbSession,
    user: CurrentUser,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: Annotated[str | None, Query(max_length=255)] = None,
    tag_ids: TagIdsQuery = None,
) -> Page[LedgerItemRead]:
    items, total = await service.list_items(
        session, keyword=keyword, tag_ids=tag_ids, page=page, page_size=page_size
    )
    return Page(items=items, page=page, page_size=page_size, total=total)


@router.get(
    "/ledger-items/{item_id}",
    response_model=LedgerItemRead,
    summary="台账详情",
)
async def get_ledger_item(item_id: int, session: DbSession, user: CurrentUser) -> LedgerItemRead:
    return await service.get_item_read(session, item_id)


@router.post(
    "/ledger-items",
    response_model=LedgerItemRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增台账",
)
async def create_ledger_item(
    data: LedgerItemCreate, session: DbSession, user: LedgerWriter
) -> LedgerItemRead:
    return await service.create_item(session, data)


@router.patch(
    "/ledger-items/{item_id}",
    response_model=LedgerItemRead,
    summary="更新台账",
)
async def update_ledger_item(
    item_id: int,
    data: LedgerItemUpdate,
    session: DbSession,
    user: LedgerWriter,
) -> LedgerItemRead:
    return await service.update_item(session, item_id, data)


@router.delete(
    "/ledger-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除台账",
)
async def delete_ledger_item(
    item_id: int,
    session: DbSession,
    user: LedgerWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_item(session, item_id, if_match)
