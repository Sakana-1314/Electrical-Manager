"""账号与角色相关的测试夹具助手：统一用户表下的角色挂载与小程序用户建档。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import uuid4

import json

from sqlalchemy import select
from tests.testkit.enums import DEFAULT_ROLE_NAMES, ROLE_PERMISSIONS, UserSource
from tests.testkit.models import Role, User, UserRole


async def _get_or_create_role(session: AsyncSession, role_name: str) -> Role:
    """按名取内置角色；缺失（种子时序问题）时按 ROLE_PERMISSIONS 现场补建。"""
    role = (
        await session.execute(select(Role).where(Role.name == role_name))
    ).scalar_one_or_none()
    if role is None:
        role = Role(
            name=role_name,
            permissions=json.dumps(ROLE_PERMISSIONS.get(role_name, [])),
            is_system=True,
        )
        session.add(role)
        await session.flush()
    return role


async def grant_role(session: AsyncSession, user_id: int, role_name: str) -> None:
    """给用户挂一个角色（按角色名取，缺失则现场补建）。"""
    role = await _get_or_create_role(session, role_name)
    session.add(UserRole(user_id=user_id, role_id=role.id))
    await session.commit()


async def create_mini_program_user(
    session: AsyncSession,
    display_name: str,
    *,
    role_names: tuple[str, ...] = DEFAULT_ROLE_NAMES,
    enabled: bool = True,
) -> int:
    """直接造一个小程序来源的统一用户（跳过微信登录链路）并挂角色，返回用户 id。"""
    user = User(
        username=f"wx_test_{uuid4().hex[:12]}",
        password_hash="",
        api_token_hash="",
        display_name=display_name,
        department_name="华星检修维护部电气车间",
        source=UserSource.MINI_PROGRAM,
        enabled=enabled,
    )
    session.add(user)
    await session.flush()
    for role_name in role_names:
        role = await _get_or_create_role(session, role_name)
        session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()
    return user.id
