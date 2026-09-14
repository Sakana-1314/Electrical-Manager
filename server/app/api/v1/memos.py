"""管理端个人备忘录接口：纯文本，一级 tab 快捷切换多条。

所有登录用户（含只读角色）均可使用：个人备忘录按创建人隔离，
接口只操作当前用户自己的数据。错误遵循 docs/websites/pages/api-conventions.md
（资源不存在 → 400 + NOT_FOUND，版本冲突 → 409 + VERSION_CONFLICT）。
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.permissions import CurrentUser, DbSession
from app.models import Memo
from app.schemas import MemoCreate, MemoRead, MemoUpdate
from app.services import memo_service

router = APIRouter(prefix="/memos", tags=["备忘录"])


@router.get(
    "",
    response_model=list[MemoRead],
    summary="备忘录列表",
)
async def list_memos(session: DbSession, user: CurrentUser) -> list[Memo]:
    return await memo_service.list_memos(session, user.id)


@router.post(
    "",
    response_model=MemoRead,
    status_code=201,
    summary="新增备忘录",
)
async def create_memo(
    data: MemoCreate,
    session: DbSession,
    user: CurrentUser,
) -> Memo:
    return await memo_service.create_memo(session, user.id, data)


@router.patch(
    "/{memo_id}",
    response_model=MemoRead,
    summary="编辑备忘录",
)
async def update_memo(
    memo_id: int,
    data: MemoUpdate,
    session: DbSession,
    user: CurrentUser,
) -> Memo:
    return await memo_service.update_memo(session, memo_id, user.id, data)


@router.delete(
    "/{memo_id}",
    status_code=204,
    summary="删除备忘录",
)
async def delete_memo(memo_id: int, session: DbSession, user: CurrentUser) -> None:
    await memo_service.delete_memo(session, memo_id, user.id)
