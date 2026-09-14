"""隐患管理业务逻辑：隐患台账 + 隐患类型 + 责任单位。

规则要点：
- 新建隐患时按责任单位带出责任人快照，缺省值（检查区域/检查人员/要求完成时间）在服务端兜底；
- 要求完成时间缺省 = 检查日期 + 7 天（今天是按上海时区取的业务日期）；
- 责任单位停用后不再出现在新增下拉里，但历史隐患仍保留名称与责任人快照；
- 隐患类型同一「大类 + 小类」组合唯一，隐患类型与责任单位被隐患引用时不允许删除；
- 隐患、隐患类型、责任单位为物理删除（图片关联表随隐患级联删除）。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import SHANGHAI
from app.core.errors import AppError, not_found
from app.domain.enums import HazardStatus
from app.models import (
    FileObject,
    Hazard,
    HazardAfterImage,
    HazardBeforeImage,
    HazardType,
    HazardUnit,
)
from app.repositories import hazard_repository
from app.schemas import (
    HazardCreate,
    HazardRead,
    HazardStatsRead,
    HazardTypeCreate,
    HazardTypeUpdate,
    HazardUnitCreate,
    HazardUnitUpdate,
    HazardUpdate,
)
from app.services.common import file_read, utc_aware, validate_version

DEFAULT_AREA = "华星现场"
DEFAULT_INSPECTOR = "电气自查"
DEFAULT_DUE_DAYS = 7


def business_today() -> date:
    """业务「今天」按上海时区取（部署在 UTC 容器里也不会差一天）。"""
    return datetime.now(SHANGHAI).date()


def _trim(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


async def _files(session: AsyncSession, image_ids: list[str]) -> list[FileObject]:
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


def hazard_read(item: Hazard) -> HazardRead:
    return HazardRead(
        id=item.id,
        inspection_area=item.inspection_area,
        inspection_date=item.inspection_date,
        inspector=item.inspector,
        description=item.description,
        suggestion=item.suggestion,
        hazard_unit_id=item.hazard_unit_id,
        hazard_unit_name=item.unit.name if item.unit else "",
        person=item.person,
        due_date=item.due_date,
        recheck_person=item.recheck_person,
        rectify_person=item.rectify_person,
        status=item.status,
        hazard_type_id=item.hazard_type_id,
        major=item.hazard_type.major if item.hazard_type else "",
        minor=item.hazard_type.minor if item.hazard_type else "",
        level=item.level,
        remark=item.remark,
        before_images=[file_read(link.file) for link in item.before_images],
        after_images=[file_read(link.file) for link in item.after_images],
        created_at=utc_aware(item.created_at),
        updated_at=utc_aware(item.updated_at),
        version=item.version,
    )


def _link_images(item: Hazard, files: list[FileObject], *, before: bool) -> None:
    """整表替换一侧图片：按传入顺序重建关联行（sort_order = 下标）。

    关联行的 `hazard_id` 交给关系赋值在 flush 时填充，避免在对象已持久化后
    再赋值集合而触发异步上下文里的延迟加载（MissingGreenlet）。
    """
    if before:
        item.before_images = [
            HazardBeforeImage(file_id=file.id, sort_order=index)
            for index, file in enumerate(files)
        ]
    else:
        item.after_images = [
            HazardAfterImage(file_id=file.id, sort_order=index)
            for index, file in enumerate(files)
        ]


async def list_hazards(
    session: AsyncSession,
    *,
    status: HazardStatus | None,
    level: str | None,
    hazard_type_id: int | None,
    hazard_unit_id: int | None,
    area: str | None,
    keyword: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[HazardRead], int]:
    filters = hazard_repository.HazardFilter(
        status=status,
        level=level,
        hazard_type_id=hazard_type_id,
        hazard_unit_id=hazard_unit_id,
        area=_trim(area),
        keyword=_trim(keyword),
        date_from=date_from,
        date_to=date_to,
    )
    items, total = await hazard_repository.list_hazards(session, filters, page, page_size)
    return [hazard_read(item) for item in items], total


async def get_hazard(session: AsyncSession, hazard_id: int) -> Hazard:
    item = await hazard_repository.get_hazard(session, hazard_id)
    if item is None:
        raise not_found("隐患")
    return item


async def create_hazard(session: AsyncSession, data: HazardCreate) -> HazardRead:
    unit = await hazard_repository.get_unit(session, data.hazard_unit_id)
    if unit is None:
        raise not_found("责任单位")
    if not unit.person.strip():
        raise AppError(
            "HAZARD_UNIT_PERSON_REQUIRED",
            f"责任单位「{unit.name}」未配置责任人",
        )
    hazard_type = await hazard_repository.get_type(session, data.hazard_type_id)
    if hazard_type is None:
        raise not_found("隐患类型")

    inspection_date = data.inspection_date or business_today()
    inspector = _trim(data.inspector) or DEFAULT_INSPECTOR
    before_files = await _files(session, data.before_image_ids)
    after_files = await _files(session, data.after_image_ids)
    item = Hazard(
        inspection_area=_trim(data.inspection_area) or DEFAULT_AREA,
        inspection_date=inspection_date,
        inspector=inspector,
        description=data.description.strip(),
        suggestion=data.suggestion,
        hazard_unit_id=unit.id,
        person=unit.person.strip(),
        due_date=data.due_date or inspection_date + timedelta(days=DEFAULT_DUE_DAYS),
        recheck_person=_trim(data.recheck_person) or inspector,
        rectify_person=_trim(data.rectify_person),
        status=data.status,
        hazard_type_id=hazard_type.id,
        level=data.level,
        remark=data.remark,
    )
    # 关联集合在 flush 之前赋值：此时对象还是 pending，集合已初始化，不会触发延迟加载。
    _link_images(item, before_files, before=True)
    _link_images(item, after_files, before=False)
    session.add(item)
    await session.commit()
    return hazard_read(await get_hazard(session, item.id))


async def update_hazard(
    session: AsyncSession, hazard_id: int, data: HazardUpdate
) -> HazardRead:
    item = await get_hazard(session, hazard_id)
    validate_version(data.version, item.version)

    if data.inspection_area is not None:
        item.inspection_area = _trim(data.inspection_area) or DEFAULT_AREA
    if data.inspection_date is not None:
        item.inspection_date = data.inspection_date
    if data.inspector is not None:
        item.inspector = _trim(data.inspector) or DEFAULT_INSPECTOR
    if data.description is not None:
        item.description = data.description.strip()
    if data.suggestion is not None:
        item.suggestion = data.suggestion
    if data.due_date is not None:
        item.due_date = data.due_date
    if data.recheck_person is not None:
        item.recheck_person = _trim(data.recheck_person)
    if data.rectify_person is not None:
        item.rectify_person = _trim(data.rectify_person)
    if data.status is not None:
        item.status = data.status
    if data.level is not None:
        item.level = data.level
    if data.remark is not None:
        item.remark = data.remark

    # 只有换单位时才重新快照责任人；之后单位换人不回写历史隐患。
    if data.hazard_unit_id is not None and data.hazard_unit_id != item.hazard_unit_id:
        unit = await hazard_repository.get_unit(session, data.hazard_unit_id)
        if unit is None:
            raise not_found("责任单位")
        if not unit.person.strip():
            raise AppError(
                "HAZARD_UNIT_PERSON_REQUIRED",
                f"责任单位「{unit.name}」未配置责任人",
            )
        # 同时把关系指向新单位，避免响应里的 unit 快照仍是旧对象。
        item.hazard_unit_id = unit.id
        item.unit = unit
        item.person = unit.person.strip()

    if data.hazard_type_id is not None and data.hazard_type_id != item.hazard_type_id:
        hazard_type = await hazard_repository.get_type(session, data.hazard_type_id)
        if hazard_type is None:
            raise not_found("隐患类型")
        item.hazard_type_id = hazard_type.id
        item.hazard_type = hazard_type

    if data.before_image_ids is not None:
        _link_images(item, await _files(session, data.before_image_ids), before=True)
    if data.after_image_ids is not None:
        _link_images(item, await _files(session, data.after_image_ids), before=False)

    item.version += 1
    await session.commit()
    return hazard_read(await get_hazard(session, hazard_id))


async def delete_hazard(
    session: AsyncSession, hazard_id: int, expected_version: int | None
) -> None:
    item = await get_hazard(session, hazard_id)
    validate_version(expected_version, item.version)
    await session.delete(item)
    await session.commit()


async def hazard_stats(session: AsyncSession) -> HazardStatsRead:
    counts = await hazard_repository.count_by_status(session)
    return HazardStatsRead(
        pending=counts.get(HazardStatus.PENDING, 0),
        blocked=counts.get(HazardStatus.BLOCKED, 0),
        done=counts.get(HazardStatus.DONE, 0),
        overdue=await hazard_repository.count_overdue(session, business_today()),
    )


# ===== 责任单位 =====


async def list_units(
    session: AsyncSession, *, keyword: str | None = None, enabled: bool | None = None
) -> list[HazardUnit]:
    units = await hazard_repository.list_units(session, _trim(keyword))
    if enabled is not None:
        units = [unit for unit in units if unit.enabled is enabled]
    return units


async def get_unit(session: AsyncSession, unit_id: int) -> HazardUnit:
    unit = await hazard_repository.get_unit(session, unit_id)
    if unit is None:
        raise not_found("责任单位")
    return unit


async def create_unit(session: AsyncSession, data: HazardUnitCreate) -> HazardUnit:
    name = data.name.strip()
    if await hazard_repository.find_unit_by_name(session, name) is not None:
        raise AppError("DUPLICATE_HAZARD_UNIT", f"责任单位「{name}」已存在")
    unit = HazardUnit(
        name=name,
        person=data.person.strip(),
        remark=_trim(data.remark),
        enabled=data.enabled,
    )
    session.add(unit)
    await session.commit()
    return unit


async def update_unit(session: AsyncSession, unit_id: int, data: HazardUnitUpdate) -> HazardUnit:
    unit = await get_unit(session, unit_id)
    validate_version(data.version, unit.version)
    if data.name is not None:
        name = data.name.strip()
        existing = await hazard_repository.find_unit_by_name(session, name)
        if existing is not None and existing.id != unit.id:
            raise AppError("DUPLICATE_HAZARD_UNIT", f"责任单位「{name}」已存在")
        unit.name = name
    if data.person is not None:
        unit.person = data.person.strip()
    if data.remark is not None:
        unit.remark = _trim(data.remark)
    if data.enabled is not None:
        unit.enabled = data.enabled
    unit.version += 1
    await session.commit()
    return unit


async def delete_unit(session: AsyncSession, unit_id: int, expected_version: int | None) -> None:
    unit = await get_unit(session, unit_id)
    validate_version(expected_version, unit.version)
    if await hazard_repository.count_hazards_by_unit(session, unit.id) > 0:
        raise AppError(
            "HAZARD_UNIT_IN_USE",
            f"责任单位「{unit.name}」已被隐患记录引用，无法删除",
            status_code=409,
        )
    await session.delete(unit)
    await session.commit()


# ===== 隐患类型 =====


async def list_types(session: AsyncSession) -> list[HazardType]:
    return await hazard_repository.list_types(session)


async def get_type(session: AsyncSession, type_id: int) -> HazardType:
    hazard_type = await hazard_repository.get_type(session, type_id)
    if hazard_type is None:
        raise not_found("隐患类型")
    return hazard_type


async def create_type(session: AsyncSession, data: HazardTypeCreate) -> HazardType:
    major = data.major.strip()
    minor = data.minor.strip()
    if await hazard_repository.find_type_by_pair(session, major, minor) is not None:
        raise AppError(
            "DUPLICATE_HAZARD_TYPE", f"隐患类型「{major} / {minor}」已存在，无需重复新增"
        )
    hazard_type = HazardType(major=major, minor=minor)
    session.add(hazard_type)
    await session.commit()
    return hazard_type


async def update_type(
    session: AsyncSession, type_id: int, data: HazardTypeUpdate
) -> HazardType:
    hazard_type = await get_type(session, type_id)
    validate_version(data.version, hazard_type.version)
    major = data.major.strip() if data.major is not None else hazard_type.major
    minor = data.minor.strip() if data.minor is not None else hazard_type.minor
    if major != hazard_type.major or minor != hazard_type.minor:
        existing = await hazard_repository.find_type_by_pair(
            session, major, minor, exclude_id=hazard_type.id
        )
        if existing is not None:
            raise AppError(
                "DUPLICATE_HAZARD_TYPE", f"隐患类型「{major} / {minor}」与已有类型重复"
            )
    # 已被隐患引用的类型允许改名：隐患按 id 引用，不做级联校验。
    hazard_type.major = major
    hazard_type.minor = minor
    hazard_type.version += 1
    await session.commit()
    return hazard_type


async def delete_type(session: AsyncSession, type_id: int, expected_version: int | None) -> None:
    hazard_type = await get_type(session, type_id)
    validate_version(expected_version, hazard_type.version)
    if await hazard_repository.count_hazards_by_type(session, hazard_type.id) > 0:
        raise AppError(
            "HAZARD_TYPE_IN_USE",
            f"隐患类型「{hazard_type.major} / {hazard_type.minor}」已被隐患记录引用，"
            "只能修改，不能删除",
            status_code=409,
        )
    await session.delete(hazard_type)
    await session.commit()
