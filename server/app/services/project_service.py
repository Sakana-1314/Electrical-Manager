"""项目管理（系统管理 → 项目管理）与「默认项目」解析。

项目是业务数据的隔离维度：项目表本身是全局表（不受项目过滤影响），因此这里所有查询都
正常执行；只有统计「项目下是否已有业务数据」时必须显式用 `system_scope()`，否则会被
当前项目的过滤条件收窄成「只看当前项目」。

约定：
- 任意登录用户都能读项目列表（右上角切换器要用），只有超级管理员能增删改（路由层控制）。
- 系统里始终有且仅有一个默认项目（`is_default=True`）：小程序 / MCP 未指定项目时兜底。
  默认项目不能被停用、不能被删除，也不能直接取消默认（改设别的项目为默认即可）。
- 删除只用于「建错的空项目」；已有业务数据的项目请停用（`enabled=False`）而不是删除。
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, not_found
from app.core.project_scope import system_scope
from app.models import PROJECT_SCOPED_MODELS, Project
from app.schemas import ProjectCreate, ProjectUpdate
from app.services.common import validate_version


async def list_projects(session: AsyncSession) -> list[Project]:
    """全部项目（含停用）：默认项目排最前，其余按创建顺序。

    切换器只展示启用的项目，项目管理页展示全部。
    """
    return list(
        (
            await session.scalars(
                select(Project).order_by(Project.is_default.desc(), Project.id)
            )
        ).all()
    )


async def get_project(session: AsyncSession, project_id: int) -> Project:
    project = await session.get(Project, project_id)
    if project is None:
        raise AppError("PROJECT_NOT_FOUND", "项目不存在", status_code=400)
    return project


async def default_project(session: AsyncSession) -> Project | None:
    """默认项目：`is_default=True` 且启用；没有默认标记时退回第一个启用项目。"""
    project = await session.scalar(
        select(Project)
        .where(Project.is_default.is_(True), Project.enabled.is_(True))
        .order_by(Project.id)
        .limit(1)
    )
    if project is not None:
        return project
    return await session.scalar(
        select(Project).where(Project.enabled.is_(True)).order_by(Project.id).limit(1)
    )


async def require_default_project(session: AsyncSession) -> Project:
    """默认项目（小程序 / MCP 未指定项目时用）；一个启用的项目都没有时明确报错。"""
    project = await default_project(session)
    if project is None:
        raise AppError(
            "PROJECT_NOT_FOUND",
            "系统里还没有可用项目，请在「系统管理 → 项目管理」中创建",
            status_code=400,
        )
    return project


async def count_project_rows(session: AsyncSession, project_id: int) -> int:
    """项目下的业务数据行数合计（用于删除前校验）。

    必须在 `system_scope()` 下统计：否则当前项目的过滤条件会把结果收窄成「只看当前项目」。
    """
    total = 0
    with system_scope():
        for model in PROJECT_SCOPED_MODELS:
            count = await session.scalar(
                select(func.count()).select_from(model).where(model.project_id == project_id)
            )
            total += int(count or 0)
    return total


async def _clear_other_defaults(session: AsyncSession, keep_id: int | None) -> None:
    projects = list(
        (await session.scalars(select(Project).where(Project.is_default.is_(True)))).all()
    )
    for project in projects:
        if project.id != keep_id:
            project.is_default = False
            project.version += 1


async def create_project(session: AsyncSession, data: ProjectCreate) -> Project:
    if data.is_default and not data.enabled:
        raise AppError("PROJECT_IS_DEFAULT", "默认项目必须是启用状态", status_code=409)
    item = Project(
        name=data.name,
        enabled=data.enabled,
        is_default=data.is_default,
        remark=data.remark,
    )
    session.add(item)
    try:
        await session.flush()
    except IntegrityError as exc:
        raise AppError("DUPLICATE_PROJECT_NAME", "项目名称已存在", status_code=409) from exc
    if item.is_default:
        await _clear_other_defaults(session, keep_id=item.id)
    return item


async def update_project(session: AsyncSession, item_id: int, data: ProjectUpdate) -> Project:
    item = await session.get(Project, item_id)
    if item is None:
        raise not_found("项目")
    validate_version(data.version, item.version)
    enabled = data.enabled if data.enabled is not None else item.enabled
    if item.is_default:
        if data.enabled is False:
            raise AppError("PROJECT_IS_DEFAULT", "默认项目不能停用", status_code=409)
        if data.is_default is False:
            raise AppError(
                "PROJECT_IS_DEFAULT", "不能取消默认项目，请改设其他项目为默认", status_code=409
            )
    if data.is_default and not enabled:
        raise AppError("PROJECT_IS_DEFAULT", "默认项目必须是启用状态", status_code=409)
    for key in ("name", "enabled", "is_default", "remark"):
        value = getattr(data, key)
        if value is not None:
            setattr(item, key, value)
    item.version += 1
    try:
        await session.flush()
    except IntegrityError as exc:
        raise AppError("DUPLICATE_PROJECT_NAME", "项目名称已存在", status_code=409) from exc
    if item.is_default:
        await _clear_other_defaults(session, keep_id=item.id)
    return item


async def delete_project(session: AsyncSession, item_id: int, if_match: int | None) -> None:
    item = await session.get(Project, item_id)
    if item is None:
        raise not_found("项目")
    validate_version(if_match, item.version)
    if item.is_default:
        raise AppError("PROJECT_IS_DEFAULT", "默认项目不能删除", status_code=409)
    if await count_project_rows(session, item.id):
        raise AppError(
            "PROJECT_IN_USE",
            "该项目下已有业务数据，不能删除；如需停用请改为「停用」",
            status_code=409,
        )
    try:
        await session.delete(item)
        await session.flush()
    except IntegrityError as exc:  # 兜底：外键仍拦下说明有并发写入
        raise AppError(
            "PROJECT_IN_USE", "该项目下已有业务数据，不能删除", status_code=409
        ) from exc
