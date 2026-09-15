"""项目（project）上下文与项目域数据的全局隔离。

背景：系统按「项目」隔离业务数据（当前只有 P05，后续可加 P06）。所有登录用户都能
访问全部项目，但同一请求只能处于一个项目；项目通过 `X-Project-Id` 请求头传入
（见 `core.middleware.project_context` 与 `core.permissions.require_current_project`）。

这里的实现是「一处声明、全局生效」，而不是在每个 service 里逐个加过滤条件：

- `do_orm_execute`：语句里出现任何项目域表时，用 `with_loader_criteria` 给这些实体
  加上 `project_id = 当前项目` 条件。SQLAlchemy 会把条件注入到所有出现该实体的位置
  （含子查询、别名、`select(func.count())` 聚合），`session.get()` 取别的主键会返回
  None，ORM 的 UPDATE / DELETE 同样受限。
- `before_flush`：新建的项目域对象自动补 `project_id`；与当前项目不一致的写入/删除
  直接拦下（`PROJECT_MISMATCH`），避免跨项目改写。

**未设定项目上下文时访问项目域表直接报错（fail-closed）**：宁可响亮失败，也不要静默
读到全部项目的数据。确实需要跨项目的系统级入口（后台清理任务、匿名分享/导出下载、
附件引用统计）必须显式使用 `system_scope()`。

注意：纯全局表的语句（`user` / `project` / `system_setting` / `file_object` / `memo` /
`webhook_*` / `business_event_log`）不受影响，登录、项目列表等接口无需项目上下文。
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from sqlalchemy.sql.util import find_tables

from app.core.errors import AppError

_current_project: ContextVar[int | None] = ContextVar("current_project_id", default=None)
_system_bypass: ContextVar[bool] = ContextVar("project_scope_bypass", default=False)

_scoped_models: tuple[type[Any], ...] | None = None
_scoped_tables: frozenset[Any] = frozenset()


def scoped_models() -> tuple[type[Any], ...]:
    """项目域 ORM 实体（惰性导入，避免 core ↔ models 循环导入）。"""
    global _scoped_models, _scoped_tables
    if _scoped_models is None:
        from app.models import PROJECT_SCOPED_MODELS

        _scoped_models = PROJECT_SCOPED_MODELS
        _scoped_tables = frozenset(model.__table__ for model in _scoped_models)
    return _scoped_models


def scoped_tables() -> frozenset[Any]:
    scoped_models()
    return _scoped_tables


def project_required_error() -> AppError:
    return AppError(
        "PROJECT_REQUIRED",
        "请先在右上角选择项目（若页面已过期，请刷新后重试）",
        status_code=400,
    )


def current_project_id() -> int:
    """当前项目 id；未设定上下文（且不在 system_scope 内）时抛 PROJECT_REQUIRED。"""
    project_id = _current_project.get()
    if project_id is None:
        raise project_required_error()
    return project_id


def current_project_id_or_none() -> int | None:
    return _current_project.get()


def system_scope_active() -> bool:
    return _system_bypass.get()


def set_current_project(project_id: int) -> None:
    """设定当前项目（供 FastAPI 依赖使用，随请求上下文自动结束，无需手动 reset）。"""
    _current_project.set(project_id)


def push_current_project(project_id: int) -> Token[int | None]:
    """设定当前项目并返回 token（供中间件在请求结束时精确复位，避免上下文外泄）。"""
    return _current_project.set(project_id)


def pop_current_project(token: Token[int | None]) -> None:
    _current_project.reset(token)


@contextmanager
def project_scope(project_id: int) -> Iterator[None]:
    """在指定项目上下文中执行：后台任务按行上记录的项目恢复上下文。"""
    token = _current_project.set(project_id)
    bypass_token = _system_bypass.set(False)
    try:
        yield
    finally:
        _system_bypass.reset(bypass_token)
        _current_project.reset(token)


@contextmanager
def system_scope() -> Iterator[None]:
    """显式声明跨项目/系统级上下文（跳过项目过滤与写入守卫）。

    只允许出现在系统级入口：后台清理任务、匿名下载与分享解析、附件引用统计等。
    这些入口本来就不属于任何单个项目，逐处显式声明便于评审与排查。
    """
    token = _system_bypass.set(True)
    try:
        yield
    finally:
        _system_bypass.reset(token)


def _project_criteria(project_id: int):
    """供 with_loader_criteria 使用的条件。

    注意：SQLAlchemy 的 lambda SQL 不允许在 lambda 内调用函数，所以项目 id 必须在外面
    取好、以闭包变量形式传入；闭包变量值会进缓存键，项目切换时会重新编译，不会串用。
    """

    def _criteria(cls: Any) -> Any:
        return cls.project_id == project_id

    return _criteria


def _apply_project_filter(state: Any) -> None:
    if system_scope_active():
        return
    if not (state.is_select or state.is_update or state.is_delete):
        return
    if not scoped_tables().intersection(find_tables(state.statement)):
        # 语句不涉及项目域表（登录、项目列表、系统配置等），无需项目上下文。
        return
    project_id = current_project_id()
    criteria = _project_criteria(project_id)
    statement = state.statement
    for model in scoped_models():
        statement = statement.options(with_loader_criteria(model, criteria, include_aliases=True))
    state.statement = statement


def _project_mismatch_error(obj: Any) -> AppError:
    return AppError(
        "PROJECT_MISMATCH",
        f"不能跨项目写入或删除数据（{type(obj).__tablename__}#{obj.id}）",
        status_code=409,
    )


def _guard_project_writes(session: Session, flush_context: Any, instances: Any) -> None:
    if system_scope_active():
        return
    models = scoped_models()
    project_id = current_project_id_or_none()
    for obj in session.new:
        if not isinstance(obj, models):
            continue
        if obj.project_id is None:
            obj.project_id = current_project_id()
        elif project_id is not None and obj.project_id != project_id:
            raise _project_mismatch_error(obj)
    for obj in list(session.dirty) + list(session.deleted):
        if not isinstance(obj, models):
            continue
        if project_id is not None and obj.project_id != project_id:
            raise _project_mismatch_error(obj)


def register_project_scope() -> None:
    """注册全局项目隔离事件（在 core.database 导入时调用一次）。"""
    event.listen(Session, "do_orm_execute", _apply_project_filter)
    event.listen(Session, "before_flush", _guard_project_writes)
