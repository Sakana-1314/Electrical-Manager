"""台账管理业务逻辑：台账总览（台账记录）+ 分层标签。

规则要点：
- 标签是自引用邻接表，至多 3 层：新增时「父节点层级 + 1」超过 3 直接拒绝（400）。
- 同一父节点下不允许同名标签（不同分支可同名），重名返回 409；改名同样校验同级。
- 标签还有子节点、或（连同子孙）已被台账记录引用时不允许删除（409），删除是物理删除。
- 台账记录可挂多个标签：落库前统一规范化为「去重 + 升序 + 英文逗号分隔」的 id 串，
  读出来还原成 id 列表，并附标签名称与完整层级路径，列表页无需再自行解析。
- 按标签筛选命中「选中标签及其全部子孙标签」的记录。
- 图片沿用全站口径：单个标签节点 / 单条台账记录最多 9 张，先上传拿 file_id 再随整表提交。
- 写操作走乐观锁：PATCH 用请求体 `version`，DELETE 用 `If-Match` 头。
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, not_found
from app.models import FileObject, Ledger, LedgerImage, LedgerTag, LedgerTagImage
from app.repositories import ledger_repository
from app.schemas import (
    LedgerItemCreate,
    LedgerItemRead,
    LedgerItemUpdate,
    LedgerTagCreate,
    LedgerTagRead,
    LedgerTagRefRead,
    LedgerTagUpdate,
)
from app.services.common import file_read, utc_aware, validate_version

# 标签最多 3 层：根节点为第 1 层。
MAX_TAG_LEVEL = 3


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


def parse_tag_ids(value: str | None) -> list[int]:
    """把 `ledger.tag_ids` 的逗号分隔 id 串解析成去重升序的正整数列表。"""
    if not value:
        return []
    ids = {int(part) for part in value.split(",") if part.strip().isdigit()}
    return sorted(tag_id for tag_id in ids if tag_id > 0)


def format_tag_ids(tag_ids: Iterable[int]) -> str:
    """规范化写入：去重、升序、英文逗号分隔；空集合写空串。"""
    unique = {tag_id for tag_id in tag_ids if tag_id > 0}
    return ",".join(str(tag_id) for tag_id in sorted(unique))


async def _tag_map(session: AsyncSession) -> dict[int, LedgerTag]:
    """一次取全部标签节点，供层级 / 路径 / 子孙计算复用（标签是字典量级）。"""
    return {tag.id: tag for tag in await ledger_repository.list_tags(session)}


def _child_counts(tags: Iterable[LedgerTag]) -> dict[int, int]:
    counts: dict[int, int] = {}
    for tag in tags:
        if tag.parent_id is not None:
            counts[tag.parent_id] = counts.get(tag.parent_id, 0) + 1
    return counts


def _children_map(tags: Iterable[LedgerTag]) -> dict[int, list[int]]:
    children: dict[int, list[int]] = {}
    for tag in tags:
        if tag.parent_id is not None:
            children.setdefault(tag.parent_id, []).append(tag.id)
    return children


def _subtree_ids(children: dict[int, list[int]], root_id: int) -> list[int]:
    """根节点及其全部子孙（层级上限保证深度有界）。"""
    collected: list[int] = []
    stack = [root_id]
    while stack:
        current = stack.pop()
        collected.append(current)
        stack.extend(children.get(current, ()))
    return collected


def _tag_level(tags_by_id: dict[int, LedgerTag], tag: LedgerTag) -> int:
    """节点层级（从 1 起）：沿 parent_id 往上数；父节点缺失（数据被手工改坏）时按当前结果封顶。"""
    level = 1
    current = tag
    visited = {tag.id}
    while current.parent_id is not None:
        parent = tags_by_id.get(current.parent_id)
        if parent is None or parent.id in visited:
            break
        visited.add(parent.id)
        current = parent
        level += 1
    return level


def tag_path(tags_by_id: dict[int, LedgerTag], tag: LedgerTag) -> str:
    """完整层级路径，如「配电柜 / 低压柜 / 抽屉柜」。"""
    names = [tag.name]
    current = tag
    visited = {tag.id}
    while current.parent_id is not None:
        parent = tags_by_id.get(current.parent_id)
        if parent is None or parent.id in visited:
            break
        visited.add(parent.id)
        names.append(parent.name)
        current = parent
    return " / ".join(reversed(names))


def _is_in_subtree(tags_by_id: dict[int, LedgerTag], node: LedgerTag, root_id: int) -> bool:
    """node 是否就是 root 或 root 的子孙。"""
    current: LedgerTag | None = node
    visited: set[int] = set()
    while current is not None and current.id not in visited:
        if current.id == root_id:
            return True
        visited.add(current.id)
        current = tags_by_id.get(current.parent_id) if current.parent_id is not None else None
    return False


def tag_read(
    tag: LedgerTag, tags_by_id: dict[int, LedgerTag], child_counts: dict[int, int]
) -> LedgerTagRead:
    return LedgerTagRead(
        id=tag.id,
        parent_id=tag.parent_id,
        name=tag.name,
        remark=tag.remark,
        level=_tag_level(tags_by_id, tag),
        child_count=child_counts.get(tag.id, 0),
        images=[file_read(link.file) for link in tag.images],
        created_at=utc_aware(tag.created_at),
        updated_at=utc_aware(tag.updated_at),
        version=tag.version,
    )


def item_read(item: Ledger, tags_by_id: dict[int, LedgerTag]) -> LedgerItemRead:
    refs: list[LedgerTagRefRead] = []
    for tag_id in parse_tag_ids(item.tag_ids):
        tag = tags_by_id.get(tag_id)
        if tag is None:
            # 防御：标签被手工删除后残留的 id 直接跳过，界面上不留悬空标签。
            continue
        refs.append(LedgerTagRefRead(id=tag.id, name=tag.name, path=tag_path(tags_by_id, tag)))
    return LedgerItemRead(
        id=item.id,
        name=item.name,
        model_spec=item.model_spec,
        quantity=item.quantity,
        remark=item.remark,
        tag_ids=[ref.id for ref in refs],
        tags=refs,
        images=[file_read(link.file) for link in item.images],
        created_at=utc_aware(item.created_at),
        updated_at=utc_aware(item.updated_at),
        version=item.version,
    )


# ===== 标签 =====


async def list_tags(
    session: AsyncSession, *, keyword: str | None = None, scope: str | None = None
) -> list[LedgerTagRead]:
    """标签列表（平铺）。

    `scope=orphan` 只留「既无父节点又无子节点」的孤立标签；`scope=tree` 只留有父或
    有子、处在层级里的节点——这类节点对祖先闭合，剪枝后仍能拼出完整子树。
    """
    tags = await ledger_repository.list_tags(session, _trim(keyword))
    tags_by_id = {tag.id: tag for tag in tags}
    child_counts = _child_counts(tags)
    rows = [tag_read(tag, tags_by_id, child_counts) for tag in tags]
    if scope == "orphan":
        return [row for row in rows if row.parent_id is None and row.child_count == 0]
    if scope == "tree":
        return [row for row in rows if row.parent_id is not None or row.child_count > 0]
    return rows


async def get_tag_read(session: AsyncSession, tag_id: int) -> LedgerTagRead:
    tags = await ledger_repository.list_tags(session)
    tags_by_id = {tag.id: tag for tag in tags}
    tag = tags_by_id.get(tag_id)
    if tag is None:
        raise not_found("标签")
    return tag_read(tag, tags_by_id, _child_counts(tags))


async def create_tag(session: AsyncSession, data: LedgerTagCreate) -> LedgerTagRead:
    tags = await ledger_repository.list_tags(session)
    tags_by_id = {tag.id: tag for tag in tags}
    if data.parent_id is not None:
        parent = tags_by_id.get(data.parent_id)
        if parent is None:
            raise not_found("上级标签")
        if _tag_level(tags_by_id, parent) >= MAX_TAG_LEVEL:
            raise AppError(
                "LEDGER_TAG_MAX_LEVEL",
                f"标签最多 {MAX_TAG_LEVEL} 层，不能再往下新增子标签",
            )
    if await ledger_repository.find_tag_by_sibling(session, data.parent_id, data.name) is not None:
        raise AppError("DUPLICATE_LEDGER_TAG", f"同一层级下已有标签「{data.name}」")
    files = await _files(session, data.image_ids)
    tag = LedgerTag(parent_id=data.parent_id, name=data.name, remark=_trim(data.remark))
    # 关联集合在 flush 之前赋值：此时对象还是 pending，不会触发异步上下文里的延迟加载。
    tag.images = [
        LedgerTagImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
    ]
    session.add(tag)
    await session.commit()
    return await get_tag_read(session, tag.id)


async def update_tag(
    session: AsyncSession, tag_id: int, data: LedgerTagUpdate
) -> LedgerTagRead:
    tag = await ledger_repository.get_tag(session, tag_id)
    if tag is None:
        raise not_found("标签")
    validate_version(data.version, tag.version)
    if data.name is not None and data.name != tag.name:
        existing = await ledger_repository.find_tag_by_sibling(
            session, tag.parent_id, data.name, exclude_id=tag.id
        )
        if existing is not None:
            raise AppError("DUPLICATE_LEDGER_TAG", f"同一层级下已有标签「{data.name}」")
        tag.name = data.name
    if data.remark is not None:
        tag.remark = _trim(data.remark)
    if data.image_ids is not None:
        files = await _files(session, data.image_ids)
        tag.images = [
            LedgerTagImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
        ]
    tag.version += 1
    await session.commit()
    return await get_tag_read(session, tag_id)


async def delete_tag(session: AsyncSession, tag_id: int, expected_version: int | None) -> None:
    tags = await ledger_repository.list_tags(session)
    tags_by_id = {tag.id: tag for tag in tags}
    tag = tags_by_id.get(tag_id)
    if tag is None:
        raise not_found("标签")
    validate_version(expected_version, tag.version)
    if await ledger_repository.count_children(session, tag.id) > 0:
        raise AppError(
            "LEDGER_TAG_HAS_CHILDREN",
            f"标签「{tag.name}」下还有子标签，请先删除子标签",
            status_code=409,
        )
    # 子孙一并检查：删除父节点会带走整棵子树，子树里有任何一个被引用都不允许删。
    subtree = [item.id for item in tags if _is_in_subtree(tags_by_id, item, tag.id)]
    used = await ledger_repository.filter_used_tag_ids(session, subtree)
    if used:
        names = "、".join(tags_by_id[item_id].name for item_id in sorted(used))
        raise AppError(
            "LEDGER_TAG_IN_USE",
            f"标签「{tag.name}」已被台账记录引用（{names}），请先解除引用",
            status_code=409,
        )
    await session.delete(tag)
    await session.commit()


# ===== 台账记录 =====


async def list_items(
    session: AsyncSession,
    *,
    keyword: str | None = None,
    tag_ids: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[LedgerItemRead], int]:
    tags = await ledger_repository.list_tags(session)
    tags_by_id = {tag.id: tag for tag in tags}
    selected = parse_tag_ids(tag_ids)
    matched: set[int] = set()
    if selected:
        children = _children_map(tags)
        for tag_id in selected:
            if tag_id in tags_by_id:
                matched.update(_subtree_ids(children, tag_id))
        if not matched:
            # 选中的标签都不存在（例如手改 URL）：明确返回空结果，不当作「不限」。
            return [], 0
    filters = ledger_repository.LedgerItemFilter(
        keyword=_trim(keyword), tag_ids=tuple(sorted(matched))
    )
    items, total = await ledger_repository.list_items(session, filters, page, page_size)
    return [item_read(item, tags_by_id) for item in items], total


async def get_item_read(session: AsyncSession, item_id: int) -> LedgerItemRead:
    item = await ledger_repository.get_item(session, item_id)
    if item is None:
        raise not_found("台账记录")
    return item_read(item, await _tag_map(session))


def _validated_tag_ids(tags_by_id: dict[int, LedgerTag], tag_ids: list[int]) -> list[int]:
    """校验标签 id 全部存在，返回去重升序的规范化列表。"""
    missing = sorted({tag_id for tag_id in tag_ids if tag_id not in tags_by_id})
    if missing:
        raise AppError("INVALID_TAG_ID", "标签不存在", details={"tag_ids": missing})
    return sorted(set(tag_ids))


async def create_item(session: AsyncSession, data: LedgerItemCreate) -> LedgerItemRead:
    tags_by_id = await _tag_map(session)
    tag_ids = _validated_tag_ids(tags_by_id, data.tag_ids)
    files = await _files(session, data.image_ids)
    item = Ledger(
        name=data.name,
        model_spec=data.model_spec,
        quantity=data.quantity,
        remark=_trim(data.remark),
        tag_ids=format_tag_ids(tag_ids),
    )
    item.images = [
        LedgerImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
    ]
    session.add(item)
    await session.commit()
    return await get_item_read(session, item.id)


async def update_item(
    session: AsyncSession, item_id: int, data: LedgerItemUpdate
) -> LedgerItemRead:
    item = await ledger_repository.get_item(session, item_id)
    if item is None:
        raise not_found("台账记录")
    validate_version(data.version, item.version)
    if data.name is not None:
        item.name = data.name
    if data.model_spec is not None:
        item.model_spec = data.model_spec
    if data.quantity is not None:
        item.quantity = data.quantity
    if data.remark is not None:
        item.remark = _trim(data.remark)
    if data.tag_ids is not None:
        tags_by_id = await _tag_map(session)
        item.tag_ids = format_tag_ids(_validated_tag_ids(tags_by_id, data.tag_ids))
    if data.image_ids is not None:
        files = await _files(session, data.image_ids)
        item.images = [
            LedgerImage(file_id=file.id, sort_order=index) for index, file in enumerate(files)
        ]
    item.version += 1
    await session.commit()
    return await get_item_read(session, item_id)


async def delete_item(session: AsyncSession, item_id: int, expected_version: int | None) -> None:
    item = await ledger_repository.get_item(session, item_id)
    if item is None:
        raise not_found("台账记录")
    validate_version(expected_version, item.version)
    await session.delete(item)
    await session.commit()
