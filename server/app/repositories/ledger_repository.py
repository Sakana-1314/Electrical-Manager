"""台账管理的持久化查询边界。

只承载纯 SELECT / 聚合查询，不组装 read DTO、不自建 session。

台账记录上的标签是 `ledger.tag_ids` 里的英文逗号分隔 id 串（如 `3,12,15`），命中判断统一走
`tag_id_match()`：左右各补一个逗号再做 LIKE，`12` 不会被 `1` 误命中。这样写出来的是
MySQL（`concat()`）与测试库 SQLite（`||`）都能编译的同一条语义，不依赖 MySQL 独有的
`FIND_IN_SET`。
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ledger, LedgerTag
from app.services.common import contains_any

# 网页端台账列表的关键字匹配字段：名称、型号、备注。
_KEYWORD_COLUMNS = (Ledger.name, Ledger.model_spec, Ledger.remark)
# 标签关键字匹配字段：名称、备注。
_TAG_KEYWORD_COLUMNS = (LedgerTag.name, LedgerTag.remark)


def tag_id_match(tag_id: int) -> ColumnElement[bool]:
    """`ledger.tag_ids` 是否包含某个标签 id（`1,12` 不会被 `1` 误命中）。"""
    return ("," + Ledger.tag_ids + ",").contains(f",{tag_id},")


@dataclass(frozen=True)
class LedgerItemFilter:
    """台账列表筛选条件（None / 空 表示不限制）。

    `tag_ids` 由 service 传入选中的标签**及其全部子孙标签**，命中其中任意一个即算命中。
    """

    keyword: str | None = None
    tag_ids: tuple[int, ...] = ()


def _apply_filter[T: tuple[Any, ...]](query: Select[T], filters: LedgerItemFilter) -> Select[T]:
    keyword_condition = contains_any(_KEYWORD_COLUMNS, filters.keyword)
    if keyword_condition is not None:
        query = query.where(keyword_condition)
    if filters.tag_ids:
        query = query.where(or_(*(tag_id_match(tag_id) for tag_id in filters.tag_ids)))
    return query

async def list_items(
    session: AsyncSession, filters: LedgerItemFilter, page: int, page_size: int
) -> tuple[list[Ledger], int]:
    """按创建时间倒序分页；返回 (当前页记录, 总条数)。"""
    total = int(
        (await session.scalar(_apply_filter(select(func.count(Ledger.id)), filters))) or 0
    )
    items = list(
        (
            await session.scalars(
                _apply_filter(select(Ledger), filters)
                .order_by(Ledger.created_at.desc(), Ledger.id.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
        ).all()
    )
    return items, total


async def get_item(session: AsyncSession, item_id: int) -> Ledger | None:
    return await session.get(Ledger, item_id)


async def list_tags(session: AsyncSession, keyword: str | None = None) -> list[LedgerTag]:
    """全部标签节点，按主键升序（同级即创建顺序）；层级由 parent_id 表达。"""
    query = select(LedgerTag)
    keyword_condition = contains_any(_TAG_KEYWORD_COLUMNS, keyword)
    if keyword_condition is not None:
        query = query.where(keyword_condition)
    return list((await session.scalars(query.order_by(LedgerTag.id))).all())


async def get_tag(session: AsyncSession, tag_id: int) -> LedgerTag | None:
    return await session.get(LedgerTag, tag_id)


async def find_tag_by_sibling(
    session: AsyncSession, parent_id: int | None, name: str, exclude_id: int | None = None
) -> LedgerTag | None:
    """同一父节点下的同名标签（根节点按 `parent_id IS NULL` 比较）。"""
    sibling_filter = (
        LedgerTag.parent_id.is_(None) if parent_id is None else LedgerTag.parent_id == parent_id
    )
    query = select(LedgerTag).where(LedgerTag.name == name, sibling_filter)
    if exclude_id is not None:
        query = query.where(LedgerTag.id != exclude_id)
    tag: LedgerTag | None = await session.scalar(query)
    return tag


async def count_children(session: AsyncSession, tag_id: int) -> int:
    query = select(func.count(LedgerTag.id)).where(LedgerTag.parent_id == tag_id)
    return int((await session.scalar(query)) or 0)


async def filter_used_tag_ids(session: AsyncSession, tag_ids: Sequence[int]) -> set[int]:
    """在被台账记录引用的标签 id 中，挑出传入集合命中的那些。"""
    used: set[int] = set()
    for tag_id in tag_ids:
        query = select(Ledger.id).where(tag_id_match(tag_id)).limit(1)
        if await session.scalar(query) is not None:
            used.add(tag_id)
    return used
