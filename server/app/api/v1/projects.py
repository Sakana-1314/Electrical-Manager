"""项目管理接口：项目列表（所有登录用户）+ 增删改（超级管理员）。

项目列表要供右上角的项目切换器使用，因此读取权限对所有登录用户开放；增删改只允许超级
管理员。项目不存在按仓库约定返回 400 + `NOT_FOUND`，默认项目/有数据的项目不可删除
（409 `PROJECT_IS_DEFAULT` / `PROJECT_IN_USE`）。
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.core.permissions import CurrentUser, DbSession, IfMatchVersion, SuperAdmin
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import project_service as service

router = APIRouter(tags=["项目管理"])


@router.get(
    "/projects",
    response_model=list[ProjectRead],
    summary="项目列表",
)
async def list_projects(session: DbSession, user: CurrentUser) -> list[ProjectRead]:
    return [ProjectRead.model_validate(item) for item in await service.list_projects(session)]


@router.post(
    "/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="新增项目",
)
async def add_project(
    data: ProjectCreate, session: DbSession, user: SuperAdmin
) -> ProjectRead:
    return ProjectRead.model_validate(await service.create_project(session, data))


@router.patch(
    "/projects/{item_id}",
    response_model=ProjectRead,
    summary="编辑项目",
)
async def edit_project(
    item_id: int, data: ProjectUpdate, session: DbSession, user: SuperAdmin
) -> ProjectRead:
    return ProjectRead.model_validate(await service.update_project(session, item_id, data))


@router.delete(
    "/projects/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除项目",
)
async def remove_project(
    item_id: int,
    session: DbSession,
    user: SuperAdmin,
    if_match: IfMatchVersion,
) -> None:
    await service.delete_project(session, item_id, if_match)
