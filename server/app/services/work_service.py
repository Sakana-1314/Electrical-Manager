"""工作管理业务逻辑：工作总览（按天展开）+ 任务视图 + 人员视图。

规则要点：
- 一条工作记录 = 一个任务 + 一段起止时间（起止都精确到上午 / 下午）+ 参与人员 + 备注；
  参与人员是自由文本的姓名列表（不是人员名册），落库时按全站统一分隔符拆分、去重保序，
  再以「、」连接存进 `work_record.participants` 一列，读出来还原成姓名列表。
- 半日占用判定（`occupied_halves`）只有这里一处实现：某天是否占用上午 / 下午决定了
  工作总览行的时段（全天 / 上午 / 下午）与时间线上色块的边界。
- 任务名在项目内唯一；任务下的工作记录不允许级联删除，删任务前必须先删记录。
- 三个视图都要求查询区间（必填）并封顶 `WORK_RANGE_MAX_DAYS` 天：总览要按天展开，
  区间越长行数越多。筛选、按天展开、按人分组都在本层完成（区间封顶后是车间量级的数据）。
- 人员视图的人员清单由记录里的姓名派生：按姓名分组、组内记录按开始日期升序。
- 写操作走乐观锁：PATCH 用请求体 `version`，DELETE 用 `If-Match` 头。
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, not_found
from app.domain.enums import WorkHalfDay, WorkTaskStatus
from app.models import FileObject, WorkRecord, WorkTask, WorkTaskImage
from app.repositories import work_repository
from app.schemas import (
    PARTICIPANT_SEPARATORS,
    WORK_RANGE_MAX_DAYS,
    WorkOverviewRowRead,
    WorkRecordCreate,
    WorkRecordRead,
    WorkRecordUpdate,
    WorkTaskCreate,
    WorkTaskRead,
    WorkTaskTimelineRead,
    WorkTaskUpdate,
    WorkWorkerTimelineRead,
)
from app.services.common import file_read, utc_aware, validate_version

# 总览行的时段排序权重：同一天同一任务先「全天」再「上午」再「下午」。
_SLOT_ORDER = {"全天": 0, "上午": 1, "下午": 2}


def _trim(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


async def _files(session: AsyncSession, image_ids: list[str]) -> list[FileObject]:
    """按传入顺序取图片对象；任一 id 不存在即视为非法提交。"""
    if not image_ids:
        return []
    files = list(
        (await session.scalars(select(FileObject).where(FileObject.id.in_(image_ids)))).all()
    )
    by_id = {item.id: item for item in files}
    missing = [item_id for item_id in image_ids if item_id not in by_id]
    if missing:
        raise AppError("INVALID_IMAGE_ID", "图片不存在", details={"file_ids": missing})
    return [by_id[item_id] for item_id in image_ids]


# ===== 参与人员与时间段的纯逻辑 =====


def parse_participants(value: str | None) -> list[str]:
    """把 `work_record.participants` 的姓名串解析成去重保序的姓名列表。"""
    if not value:
        return []
    names: list[str] = []
    for part in PARTICIPANT_SEPARATORS.split(value):
        name = part.strip()
        if name and name not in names:
            names.append(name)
    return names


def format_participants(names: Iterable[str]) -> str:
    """规范化写入：去重保序、以「、」连接（与 `parse_participants` 同一分隔符集合）。"""
    unique: list[str] = []
    for name in names:
        trimmed = name.strip()
        if trimmed and trimmed not in unique:
            unique.append(trimmed)
    return "、".join(unique)


def validate_record_range(
    start_date: date, start_half: WorkHalfDay, end_date: date, end_half: WorkHalfDay
) -> None:
    """结束不得早于开始；同一天时「下午 → 上午」这种空区间也要拦掉。"""
    if end_date < start_date:
        raise AppError("WORK_DATE_RANGE", "结束日期不能早于开始日期")
    if end_date == start_date and start_half == WorkHalfDay.PM and end_half == WorkHalfDay.AM:
        raise AppError("WORK_DATE_RANGE", "当天的结束时段不能早于开始时段")


def validate_plan_range(plan_start_date: date | None, plan_end_date: date | None) -> None:
    """任务计划起止：两者都填时结束不得早于开始。"""
    if plan_start_date is None or plan_end_date is None:
        return
    if plan_end_date < plan_start_date:
        raise AppError("WORK_DATE_RANGE", "计划结束日期不能早于计划开始日期")


def validate_query_range(start_date: date, end_date: date) -> None:
    """查询区间：结束不得早于开始，且最长 `WORK_RANGE_MAX_DAYS` 天（含端点）。"""
    if end_date < start_date:
        raise AppError("WORK_DATE_RANGE", "查询区间的结束日期不能早于开始日期")
    if (end_date - start_date).days + 1 > WORK_RANGE_MAX_DAYS:
        raise AppError(
            "WORK_RANGE_TOO_LONG",
            f"查询区间最长 {WORK_RANGE_MAX_DAYS} 天，请缩小范围后重试",
        )


def occupied_halves(record: WorkRecord, day: date) -> tuple[bool, bool]:
    """记录在 `day` 这一天的占用情况 `(上午, 下午)`；不在区间内返回 `(False, False)`。

    - 起始日之后的所有天，上午都被占用；起始日只在 `start_half == AM` 时占用上午；
    - 结束日之前的所有天，下午都被占用；结束日只在 `end_half == PM` 时占用下午。
    """
    if day < record.start_date or day > record.end_date:
        return False, False
    morning = day > record.start_date or record.start_half == WorkHalfDay.AM
    afternoon = day < record.end_date or record.end_half == WorkHalfDay.PM
    return morning, afternoon


def record_slots(record: WorkRecord, day: date) -> str | None:
    """记录在 `day` 的时段标签：`全天` / `上午` / `下午`；当天完全没占用返回 `None`。"""
    morning, afternoon = occupied_halves(record, day)
    if morning and afternoon:
        return "全天"
    if morning:
        return "上午"
    if afternoon:
        return "下午"
    return None


def record_days(record: WorkRecord, start_date: date, end_date: date) -> list[tuple[date, str]]:
    """把一条记录展开成 `(日期, 时段)` 列表（只覆盖查询区间内的天）。"""
    first = max(record.start_date, start_date)
    last = min(record.end_date, end_date)
    rows: list[tuple[date, str]] = []
    day = first
    while day <= last:
        slot = record_slots(record, day)
        if slot is not None:
            rows.append((day, slot))
        day += timedelta(days=1)
    return rows


# ===== 查询参数的解析（逗号分隔串 → 结构化值） =====


def parse_id_list(value: str | None) -> list[int]:
    """英文逗号分隔的正整数 id 串 → 去重升序列表（非数字项直接丢弃）。"""
    if not value:
        return []
    ids = {int(part) for part in value.split(",") if part.strip().isdigit()}
    return sorted(item for item in ids if item > 0)


def parse_names(value: str | None) -> list[str]:
    """英文逗号分隔的姓名串 → 去重保序的姓名列表（姓名本身不含逗号）。"""
    if not value:
        return []
    names: list[str] = []
    for part in value.split(","):
        name = part.strip()
        if name and name not in names:
            names.append(name)
    return names


def parse_statuses(value: str | None) -> list[WorkTaskStatus]:
    """英文逗号分隔的任务状态串 → 状态列表；无法识别的值直接丢弃。"""
    if not value:
        return []
    statuses: list[WorkTaskStatus] = []
    for part in value.split(","):
        try:
            status = WorkTaskStatus(part.strip())
        except ValueError:
            continue
        if status not in statuses:
            statuses.append(status)
    return statuses


def _matches_keyword(name: str, keyword: str | None) -> bool:
    """姓名筛选：与全站 OR 搜索同口径（`|` / `｜` 分隔，命中任一即可）。"""
    if not keyword:
        return True
    terms = [term.strip() for term in keyword.replace("｜", "|").split("|")]
    return any(term in name for term in terms if term)


# ===== 读模型组装 =====


def task_read(task: WorkTask, record_count: int) -> WorkTaskRead:
    return WorkTaskRead(
        id=task.id,
        name=task.name,
        description=task.description,
        status=task.status,
        plan_start_date=task.plan_start_date,
        plan_end_date=task.plan_end_date,
        remark=task.remark,
        images=[file_read(link.file) for link in task.images],
        record_count=record_count,
        created_at=utc_aware(task.created_at),
        updated_at=utc_aware(task.updated_at),
        version=task.version,
    )


def record_read(record: WorkRecord) -> WorkRecordRead:
    return WorkRecordRead(
        id=record.id,
        task_id=record.task_id,
        task_name=record.task.name,
        task_status=record.task.status,
        start_date=record.start_date,
        start_half=record.start_half,
        end_date=record.end_date,
        end_half=record.end_half,
        participants=parse_participants(record.participants),
        remark=record.remark,
        created_at=utc_aware(record.created_at),
        updated_at=utc_aware(record.updated_at),
        version=record.version,
    )


async def _task_read_fresh(session: AsyncSession, task_id: int) -> WorkTaskRead:
    task = await work_repository.get_task(session, task_id)
    if task is None:
        raise not_found("任务")
    return task_read(task, await work_repository.count_records_of_task(session, task_id))


async def _record_read_fresh(session: AsyncSession, record_id: int) -> WorkRecordRead:
    record = await work_repository.get_record(session, record_id)
    if record is None:
        raise not_found("工作记录")
    return record_read(record)


# ===== 任务 =====


async def list_tasks(
    session: AsyncSession,
    *,
    keyword: str | None = None,
    statuses: Sequence[WorkTaskStatus] = (),
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[WorkTaskRead], int]:
    tasks, total = await work_repository.list_tasks(
        session,
        work_repository.WorkTaskFilter(keyword=_trim(keyword), statuses=tuple(statuses)),
        page,
        page_size,
    )
    counts = await work_repository.count_records_by_task(session, [task.id for task in tasks])
    return [task_read(task, counts.get(task.id, 0)) for task in tasks], total


async def get_task_read(session: AsyncSession, task_id: int) -> WorkTaskRead:
    return await _task_read_fresh(session, task_id)


async def _ensure_task_name_free(session: AsyncSession, name: str, exclude_id: int | None) -> None:
    if await work_repository.find_task_by_name(session, name, exclude_id=exclude_id) is not None:
        raise AppError("DUPLICATE_WORK_TASK", f"任务「{name}」已存在，请直接编辑该任务")


async def create_task(session: AsyncSession, data: WorkTaskCreate) -> WorkTaskRead:
    await _ensure_task_name_free(session, data.name, None)
    validate_plan_range(data.plan_start_date, data.plan_end_date)
    files = await _files(session, data.image_ids)
    task = WorkTask(
        name=data.name,
        description=_trim(data.description),
        status=data.status,
        plan_start_date=data.plan_start_date,
        plan_end_date=data.plan_end_date,
        remark=_trim(data.remark),
    )
    task.images = [
        WorkTaskImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
    ]
    session.add(task)
    await session.commit()
    return await _task_read_fresh(session, task.id)


async def update_task(
    session: AsyncSession, task_id: int, data: WorkTaskUpdate
) -> WorkTaskRead:
    task = await work_repository.get_task(session, task_id)
    if task is None:
        raise not_found("任务")
    validate_version(data.version, task.version)
    if data.name is not None and data.name != task.name:
        await _ensure_task_name_free(session, data.name, task_id)
        task.name = data.name
    if data.status is not None:
        task.status = data.status
    # 计划日期 / 描述 / 备注用「字段是否出现在请求里」区分：传 null 或空串表示清空，不传表示不改。
    if "plan_start_date" in data.model_fields_set:
        task.plan_start_date = data.plan_start_date
    if "plan_end_date" in data.model_fields_set:
        task.plan_end_date = data.plan_end_date
    validate_plan_range(task.plan_start_date, task.plan_end_date)
    if "description" in data.model_fields_set:
        task.description = _trim(data.description)
    if "remark" in data.model_fields_set:
        task.remark = _trim(data.remark)
    if data.image_ids is not None:
        files = await _files(session, data.image_ids)
        task.images = [
            WorkTaskImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
        ]
    task.version += 1
    await session.commit()
    return await _task_read_fresh(session, task_id)


async def delete_task(session: AsyncSession, task_id: int, expected_version: int | None) -> None:
    task = await work_repository.get_task(session, task_id)
    if task is None:
        raise not_found("任务")
    validate_version(expected_version, task.version)
    count = await work_repository.count_records_of_task(session, task_id)
    if count:
        raise AppError(
            "WORK_TASK_HAS_RECORDS",
            f"任务「{task.name}」下还有 {count} 条工作记录，请先删除记录",
            status_code=409,
        )
    await session.delete(task)
    await session.commit()


# ===== 工作记录 =====


async def get_record_read(session: AsyncSession, record_id: int) -> WorkRecordRead:
    return await _record_read_fresh(session, record_id)


async def _require_task(session: AsyncSession, task_id: int) -> WorkTask:
    task = await work_repository.get_task(session, task_id)
    if task is None:
        raise AppError("INVALID_WORK_TASK_ID", "任务不存在", details={"task_id": task_id})
    return task


async def create_record(session: AsyncSession, data: WorkRecordCreate) -> WorkRecordRead:
    await _require_task(session, data.task_id)
    validate_record_range(data.start_date, data.start_half, data.end_date, data.end_half)
    record = WorkRecord(
        task_id=data.task_id,
        start_date=data.start_date,
        start_half=data.start_half,
        end_date=data.end_date,
        end_half=data.end_half,
        participants=format_participants(data.participants),
        remark=_trim(data.remark),
    )
    session.add(record)
    await session.commit()
    return await _record_read_fresh(session, record.id)


async def update_record(
    session: AsyncSession, record_id: int, data: WorkRecordUpdate
) -> WorkRecordRead:
    record = await work_repository.get_record(session, record_id)
    if record is None:
        raise not_found("工作记录")
    validate_version(data.version, record.version)
    if data.task_id is not None and data.task_id != record.task_id:
        await _require_task(session, data.task_id)
        record.task_id = data.task_id
    # 日期与上下午档成对提交（schema 已校验），这里按落库后的值整体校验区间。
    start_date = data.start_date if data.start_date is not None else record.start_date
    start_half = data.start_half if data.start_half is not None else record.start_half
    end_date = data.end_date if data.end_date is not None else record.end_date
    end_half = data.end_half if data.end_half is not None else record.end_half
    validate_record_range(start_date, start_half, end_date, end_half)
    record.start_date = start_date
    record.start_half = start_half
    record.end_date = end_date
    record.end_half = end_half
    if data.participants is not None:
        record.participants = format_participants(data.participants)
    if "remark" in data.model_fields_set:
        record.remark = _trim(data.remark)
    record.version += 1
    await session.commit()
    return await _record_read_fresh(session, record_id)


async def delete_record(
    session: AsyncSession, record_id: int, expected_version: int | None
) -> None:
    record = await work_repository.get_record(session, record_id)
    if record is None:
        raise not_found("工作记录")
    validate_version(expected_version, record.version)
    await session.delete(record)
    await session.commit()


# ===== 三个视图 =====


async def list_overview(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
    task_ids: Sequence[int] = (),
    participants: Sequence[str] = (),
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[WorkOverviewRowRead], int]:
    """工作总览：区间内的记录按天展开成 `(日期, 任务, 时段)` 行，再筛选、排序、分页。

    人员筛选按拆分后的姓名做精确匹配（不是子串匹配，「张三」不会命中「张三丰」）。
    """
    validate_query_range(start_date, end_date)
    records = await work_repository.list_records(
        session,
        work_repository.WorkRecordFilter(
            start_date=start_date,
            end_date=end_date,
            task_ids=tuple(task_ids),
            keyword=_trim(keyword),
        ),
    )
    wanted = set(participants)
    rows: list[WorkOverviewRowRead] = []
    for record in records:
        names = parse_participants(record.participants)
        if wanted and not wanted.intersection(names):
            continue
        for day, slot in record_days(record, start_date, end_date):
            rows.append(
                WorkOverviewRowRead(
                    date=day,
                    record_id=record.id,
                    task_id=record.task_id,
                    task_name=record.task.name,
                    task_status=record.task.status,
                    slot=slot,
                    participants=names,
                    remark=record.remark,
                )
            )
    # 最近的日期在前；同一天内按任务名、时段、记录 id 稳定排序。
    rows.sort(
        key=lambda row: (
            -row.date.toordinal(),
            row.task_name,
            _SLOT_ORDER[row.slot],
            row.record_id,
        )
    )
    total = len(rows)
    start = (page - 1) * page_size
    return rows[start : start + page_size], total


async def list_task_timeline(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
    statuses: Sequence[WorkTaskStatus] = (),
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[WorkTaskTimelineRead], int]:
    """任务视图：任务按分页返回，每个任务带上区间内它的工作记录（按开始日期升序）。"""
    validate_query_range(start_date, end_date)
    tasks, total = await work_repository.list_tasks(
        session,
        work_repository.WorkTaskFilter(keyword=_trim(keyword), statuses=tuple(statuses)),
        page,
        page_size,
    )
    task_ids = [task.id for task in tasks]
    counts = await work_repository.count_records_by_task(session, task_ids)
    records: list[WorkRecord] = []
    if task_ids:
        records = await work_repository.list_records(
            session,
            work_repository.WorkRecordFilter(
                start_date=start_date, end_date=end_date, task_ids=tuple(task_ids)
            ),
        )
    by_task: dict[int, list[WorkRecord]] = {}
    for record in records:
        by_task.setdefault(record.task_id, []).append(record)
    return (
        [
            WorkTaskTimelineRead(
                task=task_read(task, counts.get(task.id, 0)),
                records=[record_read(record) for record in by_task.get(task.id, [])],
            )
            for task in tasks
        ],
        total,
    )


async def list_worker_timeline(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[WorkWorkerTimelineRead], int]:
    """人员视图：把区间内的记录按参与人姓名分组，一人一行（组内记录按开始日期升序）。

    姓名分组在应用层完成（姓名是记录上的一段文本）；`keyword` 过滤姓名本身。
    """
    validate_query_range(start_date, end_date)
    records = await work_repository.list_records(
        session,
        work_repository.WorkRecordFilter(start_date=start_date, end_date=end_date),
    )
    groups: dict[str, list[WorkRecord]] = {}
    for record in records:
        for name in parse_participants(record.participants):
            groups.setdefault(name, []).append(record)
    names = [name for name in sorted(groups) if _matches_keyword(name, _trim(keyword))]
    total = len(names)
    start = (page - 1) * page_size
    return (
        [
            WorkWorkerTimelineRead(
                name=name,
                record_count=len(groups[name]),
                records=[record_read(record) for record in groups[name]],
            )
            for name in names[start : start + page_size]
        ],
        total,
    )


async def list_participants(session: AsyncSession, *, keyword: str | None = None) -> list[str]:
    """项目内历史上出现过的参与人姓名（去重升序），供输入辅助与筛选下拉使用。"""
    texts = await work_repository.list_participant_texts(session)
    names = sorted({name for text in texts for name in parse_participants(text)})
    return [name for name in names if _matches_keyword(name, _trim(keyword))]
