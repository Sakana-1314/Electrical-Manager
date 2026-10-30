"""测试直连数据库时的项目上下文：与服务端同样按 `project_id` 隔离项目域表。

- 读：语句里出现项目域表时，用 `with_loader_criteria` 加上 `project_id = 当前项目`；
- 写：新建的项目域对象自动补 `project_id`，跨项目写入 / 删除直接报 `PROJECT_MISMATCH`；
- 未设定上下文（且不在 `system_scope()` 内）时碰项目域表报 `PROJECT_REQUIRED`（fail-closed）。

这样用例造种子数据时会落在指定项目，核对落库结果时也只看到该项目的数据。
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from sqlalchemy.sql.util import find_tables

_current_project: ContextVar[int | None] = ContextVar("current_project_id", default=None)
_system_bypass: ContextVar[bool] = ContextVar("project_scope_bypass", default=False)


class ProjectScopeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


def current_project_id() -> int:
    """当前项目 id；未设定上下文时抛 PROJECT_REQUIRED。"""
    project_id = _current_project.get()
    if project_id is None:
        raise ProjectScopeError("PROJECT_REQUIRED", "未设定项目上下文")
    return project_id


@contextmanager
def project_scope(project_id: int) -> Iterator[None]:
    project_token = _current_project.set(project_id)
    bypass_token = _system_bypass.set(False)
    try:
        yield
    finally:
        _system_bypass.reset(bypass_token)
        _current_project.reset(project_token)


@contextmanager
def system_scope() -> Iterator[None]:
    """跨项目上下文：跳过项目过滤与写入守卫。"""
    token = _system_bypass.set(True)
    try:
        yield
    finally:
        _system_bypass.reset(token)


def _scoped_models() -> tuple[type[Any], ...]:
    from tests.testkit.models import PROJECT_SCOPED_MODELS

    return PROJECT_SCOPED_MODELS


def _apply_project_filter(state: Any) -> None:
    if _system_bypass.get() or not (state.is_select or state.is_update or state.is_delete):
        return
    models = _scoped_models()
    tables = {model.__table__ for model in models}
    if not tables.intersection(find_tables(state.statement)):
        return
    project_id = current_project_id()
    statement = state.statement
    for model in models:
        statement = statement.options(
            with_loader_criteria(
                model, lambda cls: cls.project_id == project_id, include_aliases=True
            )
        )
    state.statement = statement


def _guard_project_writes(session: Session, _flush_context: Any, _instances: Any) -> None:
    if _system_bypass.get():
        return
    models = _scoped_models()
    project_id = _current_project.get()
    for obj in session.new:
        if not isinstance(obj, models):
            continue
        if obj.project_id is None:
            obj.project_id = current_project_id()
        elif project_id is not None and obj.project_id != project_id:
            raise ProjectScopeError("PROJECT_MISMATCH", f"不能跨项目写入 {obj.__tablename__}")
    for obj in [*session.dirty, *session.deleted]:
        if isinstance(obj, models) and project_id is not None and obj.project_id != project_id:
            raise ProjectScopeError("PROJECT_MISMATCH", f"不能跨项目写入 {obj.__tablename__}")


event.listen(Session, "do_orm_execute", _apply_project_filter)
event.listen(Session, "before_flush", _guard_project_writes)
