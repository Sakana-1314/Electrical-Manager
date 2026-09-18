"""工作管理接口：工作总览 / 任务视图 / 人员视图（任务 + 工作记录）。

权限：读取对所有登录用户开放（`CurrentUser`）；写操作需要 `WorkWriter`
（超级管理员 / 工作管理员）。资源不存在按仓库约定返回 400 + `NOT_FOUND`。

三个视图的查询区间都是必填参数，且封顶 `WORK_RANGE_MAX_DAYS` 天（见 `work_service`）：
工作总览要把记录按天展开，区间越长返回的行越多。

人员不是名册实体：`/work-participants` 返回项目内历史上出现过的姓名（由工作记录的
参与人员串拆分去重），供表单的下拉辅助输入与筛选使用。
"""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import OrSearch128, OrSearch255, PageNo, PageSize
from app.core.permissions import (
    CurrentUser,
    DbSession,
    IfMatchVersion,
    WorkWriter,
    require_current_project,
)
from app.schemas import (
    Page,
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
from app.services import work_service as service

router = APIRouter(
    tags=["工作管理"],
    dependencies=[Depends(require_current_project)],
)

TaskIdsQuery = Annotated[
    str | None,
    Query(max_length=500, description="英文逗号分隔的任务 id，命中任一即返回"),
]
ParticipantsQuery = Annotated[
    str | None,
    Query(max_length=500, description="英文逗号分隔的参与人姓名，命中任一即返回（姓名精确匹配）"),
]
TaskStatusQuery = Annotated[
    str | None,
    Query(max_length=128, description="英文逗号分隔的任务状态（未开始/进行中/已完成/已暂停）"),
]
StartDateQuery = Annotated[date, Query(description="查询区间开始日期（含）")]
EndDateQuery = Annotated[date, Query(description="查询区间结束日期（含）")]


# ===== 任务 =====


@router.get(
    "/work-tasks",
    response_model=Page[WorkTaskRead],
    summary="任务列表",
)
async def list_work_tasks(
    session: DbSession,
    user: CurrentUser,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: OrSearch255 = None,
    status: TaskStatusQuery = None,
) -> Page[WorkTaskRead]:
    tasks, total = await service.list_tasks(
        session,
        keyword=keyword,
        statuses=service.parse_statuses(status),
        page=page,
        page_size=page_size,
    )
    return Page(items=tasks, page=page, page_size=page_size, total=total)


@router.get(
    "/work-tasks/{task_id}",
    response_model=WorkTaskRead,
    summary="任务详情",
)
async def get_work_task(task_id: int, session: DbSession, user: CurrentUser) -> WorkTaskRead:
    return await service.get_task_read(session, task_id)


@router.post(
    "/work-tasks",
    response_model=WorkTaskRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增任务",
)
async def create_work_task(
    data: WorkTaskCreate, session: DbSession, user: WorkWriter
) -> WorkTaskRead:
    return await service.create_task(session, data)


@router.patch(
    "/work-tasks/{task_id}",
    response_model=WorkTaskRead,
    summary="更新任务",
)
async def update_work_task(
    task_id: int,
    data: WorkTaskUpdate,
    session: DbSession,
    user: WorkWriter,
) -> WorkTaskRead:
    return await service.update_task(session, task_id, data)


@router.delete(
    "/work-tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除任务",
)
async def delete_work_task(
    task_id: int,
    session: DbSession,
    user: WorkWriter,
    if_match: IfMatchVersion,
) -> None:
    """删除任务：任务下还有工作记录时返回 409（不做级联删除）。"""
    await service.delete_task(session, task_id, if_match)


# ===== 工作记录 =====


@router.get(
    "/work-records/{record_id}",
    response_model=WorkRecordRead,
    summary="工作记录详情",
)
async def get_work_record(
    record_id: int, session: DbSession, user: CurrentUser
) -> WorkRecordRead:
    return await service.get_record_read(session, record_id)


@router.post(
    "/work-records",
    response_model=WorkRecordRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增工作记录",
)
async def create_work_record(
    data: WorkRecordCreate, session: DbSession, user: WorkWriter
) -> WorkRecordRead:
    return await service.create_record(session, data)


@router.patch(
    "/work-records/{record_id}",
    response_model=WorkRecordRead,
    summary="更新工作记录",
)
async def update_work_record(
    record_id: int,
    data: WorkRecordUpdate,
    session: DbSession,
    user: WorkWriter,
) -> WorkRecordRead:
    return await service.update_record(session, record_id, data)


@router.delete(
    "/work-records/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除工作记录",
)
async def delete_work_record(
    record_id: int,
    session: DbSession,
    user: WorkWriter,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_record(session, record_id, if_match)


# ===== 三个视图 =====


@router.get(
    "/work-overview",
    response_model=Page[WorkOverviewRowRead],
    summary="工作总览",
)
async def list_work_overview(
    session: DbSession,
    user: CurrentUser,
    start_date: StartDateQuery,
    end_date: EndDateQuery,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: OrSearch255 = None,
    task_ids: TaskIdsQuery = None,
    participants: ParticipantsQuery = None,
) -> Page[WorkOverviewRowRead]:
    """每天每个活由哪几个人在干：区间内记录按天展开，一行 = 日期 + 任务 + 时段。"""
    rows, total = await service.list_overview(
        session,
        start_date=start_date,
        end_date=end_date,
        task_ids=service.parse_id_list(task_ids),
        participants=service.parse_names(participants),
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return Page(items=rows, page=page, page_size=page_size, total=total)


@router.get(
    "/work-task-timeline",
    response_model=Page[WorkTaskTimelineRead],
    summary="任务视图时间线",
)
async def list_work_task_timeline(
    session: DbSession,
    user: CurrentUser,
    start_date: StartDateQuery,
    end_date: EndDateQuery,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: OrSearch255 = None,
    status: TaskStatusQuery = None,
) -> Page[WorkTaskTimelineRead]:
    """任务全周期时间线：每个任务一行，带区间内它的工作记录（起止 + 参与人员）。"""
    rows, total = await service.list_task_timeline(
        session,
        start_date=start_date,
        end_date=end_date,
        statuses=service.parse_statuses(status),
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return Page(items=rows, page=page, page_size=page_size, total=total)


@router.get(
    "/work-worker-timeline",
    response_model=Page[WorkWorkerTimelineRead],
    summary="人员视图时间线",
)
async def list_work_worker_timeline(
    session: DbSession,
    user: CurrentUser,
    start_date: StartDateQuery,
    end_date: EndDateQuery,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: OrSearch128 = None,
) -> Page[WorkWorkerTimelineRead]:
    """每人每天在干什么活：按参与人姓名分组，一人一行，带区间内的记录。"""
    rows, total = await service.list_worker_timeline(
        session,
        start_date=start_date,
        end_date=end_date,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return Page(items=rows, page=page, page_size=page_size, total=total)


@router.get(
    "/work-participants",
    response_model=list[str],
    summary="参与人员名单",
)
async def list_work_participants(
    session: DbSession,
    user: CurrentUser,
    keyword: OrSearch128 = None,
) -> list[str]:
    """项目内历史上出现过的参与人姓名（去重升序）：表单下拉辅助输入与筛选共用。"""
    return await service.list_participants(session, keyword=keyword)
