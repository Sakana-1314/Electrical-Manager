"""账号相关的测试夹具助手：统一用户表下的权限位授予与小程序用户建档。"""

from __future__ import annotations

from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from tests.testkit.enums import DEFAULT_PERMISSION_KEYS, permission_bits, UserSource
from tests.testkit.models import User


async def grant_permissions(
    session: AsyncSession, user_id: int, keys: tuple[str, ...] | list[str]
) -> None:
    """给用户追加权限位（按位或，写权限自动带上同模块读权限）。"""
    user = await session.get(User, user_id)
    assert user is not None, f"user {user_id} not found"
    user.permissions |= permission_bits(*keys)
    await session.commit()


async def set_permissions(
    session: AsyncSession, user_id: int, keys: tuple[str, ...] | list[str]
) -> None:
    """全量替换用户权限位。"""
    user = await session.get(User, user_id)
    assert user is not None, f"user {user_id} not found"
    user.permissions = permission_bits(*keys)
    await session.commit()


async def create_mini_program_user(
    session: AsyncSession,
    display_name: str,
    *,
    permissions: tuple[str, ...] = DEFAULT_PERMISSION_KEYS,
    enabled: bool = True,
) -> int:
    """直接造一个小程序来源的统一用户（跳过微信登录链路）并写权限位，返回用户 id。"""
    user = User(
        username=f"wx_test_{uuid4().hex[:12]}",
        password_hash="",
        api_token_hash="",
        display_name=display_name,
        department_name="华星检修维护部电气车间",
        source=UserSource.MINI_PROGRAM,
        wechat_openid=f"openid-test-{uuid4().hex[:12]}",
        permissions=permission_bits(*permissions),
        enabled=enabled,
    )
    session.add(user)
    await session.flush()
    await session.commit()
    return user.id
