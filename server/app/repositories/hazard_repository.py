"""隐患管理的持久化查询边界。

只承载纯 SELECT / 聚合查询，不组装 read DTO、不自建 session。
筛选条件按「精确匹配 + 模糊匹配 + 日期区间」组织，全部由 service 组装后传入。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import HazardStatus
from app.models import Hazard, HazardType, HazardUnit


@dataclass(frozen=True)
class HazardFilter:
    """隐患列表筛选条件（None 表示不限制）。"""

    status: HazardStatus | None = None
    level: str | None = None
    hazard_type_id: int | None = None
    hazard_unit_id: int | None = None
    area: str | None = None
    keyword: str | None = None
    date_from: date | None = None
    date_to: date | None = None


def _apply_filter(query: Select[tuple[Hazard]], filters: HazardFilter) -> Select[tuple[Hazard]]:
    if filters.status is not None:
        query = query.where(Hazard.status == filters.status)
    if filters.level:
        query = query.where(Hazard.level == filters.level)
    if filters.hazard_type_id:
        query = query.where(Hazard.hazard_type_id == filters.hazard_type_id)
    if filters.hazard_unit_id:
        query = query.where(Hazard.hazard_unit_id == filters.hazard_unit_id)
    if filters.area:
        query = query.where(Hazard.inspection_area.contains(filters.area, autoescape=True))
    if filters.keyword:
        keyword = filters.keyword
        query = query.where(
            or_(
                Hazard.description.contains(keyword, autoescape=True),
                Hazard.suggestion.contains(keyword, autoescape=True),
                Hazard.remark.contains(keyword, autoescape=True),
                Hazard.inspection_area.contains(keyword, autoescape=True),
                Hazard.inspector.contains(keyword, autoescape=True),
                Hazard.person.contains(keyword, autoescape=True),
            )
        )
    if filters.date_from is not None:
        query = query.where(Hazard.inspection_date >= filters.date_from)
    if filters.date_to is not None:
        query = query.where(Hazard.inspection_date <= filters.date_to)
    return query


async def list_hazards(
    session: AsyncSession, filters: HazardFilter, page: int, page_size: int
) -> tuple[list[Hazard], int]:
    """按创建时间倒序分页；返回 (当前页记录, 总条数)。"""
    conditions = _apply_filter(select(Hazard), filters)
    total = int(
        (await session.scalar(_apply_filter(select(func.count(Hazard.id)), filters))) or 0
    )
    items = list(
        (
            await session.scalars(
                conditions.order_by(Hazard.created_at.desc(), Hazard.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return items, total


async def get_hazard(session: AsyncSession, hazard_id: int) -> Hazard | None:
    return await session.get(Hazard, hazard_id)


async def count_by_status(session: AsyncSession) -> dict[HazardStatus, int]:
    """按状态分组计数（缺失的状态不会出现在结果里）。"""
    rows = (
        await session.execute(select(Hazard.status, func.count(Hazard.id)).group_by(Hazard.status))
    ).all()
    return {status: int(count) for status, count in rows}


async def count_overdue(session: AsyncSession, today: date) -> int:
    """逾期未整改数：要求完成时间早于今天且状态不是已整改（今天到期不算逾期）。"""
    return int(
        (
            await session.scalar(
                select(func.count(Hazard.id)).where(
                    Hazard.due_date < today, Hazard.status != HazardStatus.DONE
                )
            )
        )
        or 0
    )


async def count_hazards_by_unit(session: AsyncSession, unit_id: int) -> int:
    return int(
        (
            await session.scalar(
                select(func.count(Hazard.id)).where(Hazard.hazard_unit_id == unit_id)
            )
        )
        or 0
    )


async def count_hazards_by_type(session: AsyncSession, type_id: int) -> int:
    return int(
        (
            await session.scalar(
                select(func.count(Hazard.id)).where(Hazard.hazard_type_id == type_id)
            )
        )
        or 0
    )


async def list_units(session: AsyncSession, keyword: str | None = None) -> list[HazardUnit]:
    query = select(HazardUnit)
    if keyword:
        query = query.where(
            or_(
                HazardUnit.name.contains(keyword, autoescape=True),
                HazardUnit.person.contains(keyword, autoescape=True),
            )
        )
    return list((await session.scalars(query.order_by(HazardUnit.id))).all())


async def get_unit(session: AsyncSession, unit_id: int) -> HazardUnit | None:
    unit: HazardUnit | None = await session.scalar(
        select(HazardUnit).where(HazardUnit.id == unit_id)
    )
    return unit


async def find_unit_by_name(session: AsyncSession, name: str) -> HazardUnit | None:
    unit: HazardUnit | None = await session.scalar(
        select(HazardUnit).where(HazardUnit.name == name)
    )
    return unit


async def list_types(session: AsyncSession) -> list[HazardType]:
    return list(
        (
            await session.scalars(
                select(HazardType).order_by(HazardType.major, HazardType.minor, HazardType.id)
            )
        ).all()
    )


async def get_type(session: AsyncSession, type_id: int) -> HazardType | None:
    hazard_type: HazardType | None = await session.scalar(
        select(HazardType).where(HazardType.id == type_id)
    )
    return hazard_type


async def find_type_by_pair(
    session: AsyncSession, major: str, minor: str, *, exclude_id: int | None = None
) -> HazardType | None:
    query = select(HazardType).where(HazardType.major == major, HazardType.minor == minor)
    if exclude_id is not None:
        query = query.where(HazardType.id != exclude_id)
    hazard_type: HazardType | None = await session.scalar(query)
    return hazard_type
