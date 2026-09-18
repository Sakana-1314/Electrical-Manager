"""工作管理的持久化查询边界。

只承载纯 SELECT / 聚合查询，不组装 read DTO、不自建 session。

工作记录的区间命中判定统一走 `overlaps()`：`start_date <= :end AND end_date >= :start`，
即「记录的时间段与查询区间有交集」。半日档（上午 / 下午）不参与 SQL 过滤——区间边界那一天
是否真的占用，由 `work_service` 按半日规则统一判定（规则只有一处实现）。
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import ColumnElement, Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import WorkTaskStatus
from app.models import WorkRecord, WorkTask
from app.services.common import contains_any

# 网页端任务列表的关键字匹配字段：名称、描述、备注。
_TASK_KEYWORD_COLUMNS = (WorkTask.name, WorkTask.description, WorkTask.remark)
# 工作记录的关键字匹配字段：参与人员、备注，以及所属任务名称（任务名要 join 进来）。
_RECORD_KEYWORD_COLUMNS = (WorkTask.name, WorkRecord.participants, WorkRecord.remark)


@dataclass(frozen=True)
class WorkTaskFilter:
    """任务列表筛选条件（None / 空 表示不限制）。"""

    keyword: str | None = None
    statuses: tuple[WorkTaskStatus, ...] = ()


@dataclass(frozen=True)
class WorkRecordFilter:
    """工作记录筛选条件：必带查询区间（与区间有交集的记录才算命中）。"""

    start_date: date
    end_date: date
    task_ids: tuple[int, ...] = ()
    keyword: str | None = None


def overlaps(start_date: date, end_date: date) -> ColumnElement[bool]:
    """记录的时间段与 `[start_date, end_date]` 有交集。"""
    return (WorkRecord.start_date <= end_date) & (WorkRecord.end_date >= start_date)


def _apply_task_filter[T: tuple[Any, ...]](
    query: Select[T], filters: WorkTaskFilter
) -> Select[T]:
    keyword_condition = contains_any(_TASK_KEYWORD_COLUMNS, filters.keyword)
    if keyword_condition is not None:
        query = query.where(keyword_condition)
    if filters.statuses:
        query = query.where(WorkTask.status.in_(filters.statuses))
    return query


async def list_tasks(
    session: AsyncSession, filters: WorkTaskFilter, page: int, page_size: int
) -> tuple[list[WorkTask], int]:
    """按创建顺序（主键升序）分页；返回 (当前页任务, 总条数)。"""
    total = int(
        (await session.scalar(_apply_task_filter(select(func.count(WorkTask.id)), filters))) or 0
    )
    tasks = list(
        (
            await session.scalars(
                _apply_task_filter(select(WorkTask), filters)
                .order_by(WorkTask.id)
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return tasks, total


async def get_task(session: AsyncSession, task_id: int) -> WorkTask | None:
    return await session.get(WorkTask, task_id)


async def find_task_by_name(
    session: AsyncSession, name: str, exclude_id: int | None = None
) -> WorkTask | None:
    """项目内同名任务（任务名项目内唯一）。"""
    query = select(WorkTask).where(WorkTask.name == name)
    if exclude_id is not None:
        query = query.where(WorkTask.id != exclude_id)
    task: WorkTask | None = await session.scalar(query)
    return task


async def count_records_by_task(
    session: AsyncSession, task_ids: Sequence[int]
) -> dict[int, int]:
    """一次取回一批任务的工作记录条数（列表页的 `record_count`）。"""
    if not task_ids:
        return {}
    rows = await session.execute(
        select(WorkRecord.task_id, func.count(WorkRecord.id))
        .where(WorkRecord.task_id.in_(list(task_ids)))
        .group_by(WorkRecord.task_id)
    )
    return {int(task_id): int(count) for task_id, count in rows.all()}


async def count_records_of_task(session: AsyncSession, task_id: int) -> int:
    query = select(func.count(WorkRecord.id)).where(WorkRecord.task_id == task_id)
    return int((await session.scalar(query)) or 0)


def _apply_record_filter[T: tuple[Any, ...]](
    query: Select[T], filters: WorkRecordFilter
) -> Select[T]:
    query = query.where(overlaps(filters.start_date, filters.end_date))
    if filters.task_ids:
        query = query.where(WorkRecord.task_id.in_(filters.task_ids))
    keyword_condition = contains_any(_RECORD_KEYWORD_COLUMNS, filters.keyword)
    if keyword_condition is not None:
        query = query.where(keyword_condition)
    return query


async def list_records(
    session: AsyncSession, filters: WorkRecordFilter
) -> list[WorkRecord]:
    """区间内（有交集）的工作记录，按开始日期升序。

    区间已由接口层封顶（`WORK_RANGE_MAX_DAYS`），这里不再分页：三个视图的筛选、按天展开与
    按人分组都在 service 里基于这批记录完成（车间量级，一次取回比逐条查询更省往返）。
    """
    query = _apply_record_filter(
        select(WorkRecord).join(WorkTask, WorkRecord.task_id == WorkTask.id), filters
    )
    return list(
        (
            await session.scalars(
                query.options(selectinload(WorkRecord.task)).order_by(
                    WorkRecord.start_date, WorkRecord.start_half, WorkRecord.id
                )
            )
        ).all()
    )


async def list_records_of_task(
    session: AsyncSession, task_id: int, start_date: date, end_date: date
) -> list[WorkRecord]:
    """单个任务在查询区间内的记录（任务视图展开某一行时用）。"""
    return await list_records(
        session, WorkRecordFilter(start_date=start_date, end_date=end_date, task_ids=(task_id,))
    )


async def get_record(session: AsyncSession, record_id: int) -> WorkRecord | None:
    """取记录并显式带上所属任务：读模型要用任务名与状态，异步会话里不能触发延迟加载。"""
    query = (
        select(WorkRecord)
        .where(WorkRecord.id == record_id)
        .options(selectinload(WorkRecord.task))
    )
    record: WorkRecord | None = await session.scalar(query)
    return record


async def list_participant_texts(session: AsyncSession) -> list[str]:
    """全部工作记录的参与人员串（窄列全量取回，供历史姓名去重）。

    姓名是记录上的一段文本、没有独立的人员表，逐姓名发查询反而更慢；一次取回窄列后
    由 service 按分隔符拆分并去重（口径与写入时的规范化一致）。
    """
    return list((await session.scalars(select(WorkRecord.participants))).all())
