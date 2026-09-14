"""隐患管理接口：隐患台账、隐患类型、责任单位。

权限：读取对所有登录用户开放；写操作（增删改）需要 `HazardWriter`
（超级管理员 / 隐患管理员）。资源不存在按仓库约定返回 400 + `NOT_FOUND`。
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.deps import PageNo, PageSize
from app.core.permissions import CurrentUser, DbSession, HazardWriter, IfMatchVersion
from app.domain.enums import HazardLevel, HazardStatus
from app.schemas import (
    HazardCreate,
    HazardRead,
    HazardStatsRead,
    HazardTypeCreate,
    HazardTypeRead,
    HazardTypeUpdate,
    HazardUnitCreate,
    HazardUnitRead,
    HazardUnitUpdate,
    HazardUpdate,
    Page,
)
from app.services import hazard_service as service

router = APIRouter(tags=["隐患管理"])


# ===== 隐患台账 =====


@router.get(
    "/hazards",
    response_model=Page[HazardRead],
    summary="隐患台账列表",
)
async def list_hazards(
    session: DbSession,
    user: CurrentUser,
    page: PageNo = 1,
    page_size: PageSize = 20,
    status_filter: Annotated[HazardStatus | None, Query(alias="status")] = None,
    level: Annotated[HazardLevel | None, Query()] = None,
    hazard_type_id: Annotated[int | None, Query(ge=1)] = None,
    hazard_unit_id: Annotated[int | None, Query(ge=1)] = None,
    area: Annotated[str | None, Query(max_length=128)] = None,
    keyword: Annotated[str | None, Query(max_length=255)] = None,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
) -> Page[HazardRead]:
    items, total = await service.list_hazards(
        session,
        status=status_filter,
        level=level,
        hazard_type_id=hazard_type_id,
        hazard_unit_id=hazard_unit_id,
        area=area,
        keyword=keyword,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return Page(items=items, page=page, page_size=page_size, total=total)


@router.get(
    "/hazards/stats",
    response_model=HazardStatsRead,
    summary="隐患概览统计（工作台卡片）",
)
async def hazard_stats(session: DbSession, user: CurrentUser) -> HazardStatsRead:
    return await service.hazard_stats(session)


@router.get(
    "/hazards/{hazard_id}",
    response_model=HazardRead,
    summary="隐患详情",
)
async def get_hazard(hazard_id: int, session: DbSession, user: CurrentUser) -> HazardRead:
    return service.hazard_read(await service.get_hazard(session, hazard_id))


@router.post(
    "/hazards",
    response_model=HazardRead,
    status_code=status.HTTP_201_CREATED,
    summary="登记隐患",
)
async def create_hazard(
    data: HazardCreate, session: DbSession, user: HazardWriter
) -> HazardRead:
    return await service.create_hazard(session, data)


@router.patch(
    "/hazards/{hazard_id}",
    response_model=HazardRead,
    summary="更新隐患",
)
async def update_hazard(
    hazard_id: int,
    data: HazardUpdate,
    session: DbSession,
    user: HazardWriter,
) -> HazardRead:
    return await service.update_hazard(session, hazard_id, data)


@router.delete(
    "/hazards/{hazard_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除隐患",
)
async def delete_hazard(
    hazard_id: int,
    session: DbSession,
    user: HazardWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_hazard(session, hazard_id, if_match)


# ===== 责任单位 =====


@router.get(
    "/hazard-units",
    response_model=list[HazardUnitRead],
    summary="责任单位列表",
)
async def list_hazard_units(
    session: DbSession,
    user: CurrentUser,
    keyword: Annotated[str | None, Query(max_length=128)] = None,
    enabled: Annotated[bool | None, Query()] = None,
) -> list[HazardUnitRead]:
    units = await service.list_units(session, keyword=keyword, enabled=enabled)
    return [HazardUnitRead.model_validate(unit) for unit in units]


@router.post(
    "/hazard-units",
    response_model=HazardUnitRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增责任单位",
)
async def create_hazard_unit(
    data: HazardUnitCreate, session: DbSession, user: HazardWriter
) -> HazardUnitRead:
    return HazardUnitRead.model_validate(await service.create_unit(session, data))


@router.patch(
    "/hazard-units/{unit_id}",
    response_model=HazardUnitRead,
    summary="更新责任单位",
)
async def update_hazard_unit(
    unit_id: int,
    data: HazardUnitUpdate,
    session: DbSession,
    user: HazardWriter,
) -> HazardUnitRead:
    return HazardUnitRead.model_validate(await service.update_unit(session, unit_id, data))


@router.delete(
    "/hazard-units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除责任单位",
)
async def delete_hazard_unit(
    unit_id: int,
    session: DbSession,
    user: HazardWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_unit(session, unit_id, if_match)


# ===== 隐患类型 =====


@router.get(
    "/hazard-types",
    response_model=list[HazardTypeRead],
    summary="隐患类型列表",
)
async def list_hazard_types(session: DbSession, user: CurrentUser) -> list[HazardTypeRead]:
    return [HazardTypeRead.model_validate(item) for item in await service.list_types(session)]


@router.post(
    "/hazard-types",
    response_model=HazardTypeRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增隐患类型",
)
async def create_hazard_type(
    data: HazardTypeCreate, session: DbSession, user: HazardWriter
) -> HazardTypeRead:
    return HazardTypeRead.model_validate(await service.create_type(session, data))


@router.patch(
    "/hazard-types/{type_id}",
    response_model=HazardTypeRead,
    summary="更新隐患类型",
)
async def update_hazard_type(
    type_id: int,
    data: HazardTypeUpdate,
    session: DbSession,
    user: HazardWriter,
) -> HazardTypeRead:
    return HazardTypeRead.model_validate(await service.update_type(session, type_id, data))


@router.delete(
    "/hazard-types/{type_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除隐患类型",
)
async def delete_hazard_type(
    type_id: int,
    session: DbSession,
    user: HazardWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_type(session, type_id, if_match)
