from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import re
import secrets
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import Select, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.core.config import settings
from app.core.constants import SHANGHAI
from app.core.errors import AppError, not_found
from app.core.identifiers import uuid7_string
from app.models import (
    FileObject,
    HazardAfterImage,
    HazardBeforeImage,
    LedgerImage,
    LedgerTagImage,
    PurchaseMaterialImage,
    PurchasePlanTemplateImage,
    PurchaseRequestLineImage,
    StockMaterialImage,
    WorkTaskImage,
)
from app.schemas import (
    AttachmentBulkDeleteRead,
    AttachmentCleanupRead,
    AttachmentDeleteRead,
    AttachmentRead,
    FileObjectRead,
    OrphanFileCleanupRead,
    OrphanFileRead,
    OrphanFileReportRead,
)
from app.services.common import (
    file_read,
    next_local_hour,
    utc_aware,
    utcnow,
)

ACCEPTED_TYPES = {"image/jpeg", "image/png", "image/webp"}
PREVIEW_MIME_TYPE = "image/webp"
# 前端「本地摘要校验、命中免上传」的阈值：只对大于 1MB 的图片记挑战材料并允许查重，
# 与 web/src/utils/image.ts 的 dedupMinBytes 一一对应。
DEDUP_MIN_BYTES = 1024 * 1024
# 二次校验的窗口大小与取窗位置：窗口都开在文件的中间一半，避开编码器头部固定字段。
PROBE_WINDOW_BYTES = 64 * 1024
PROBE_FRACTIONS = (0.25, 0.5, 0.75)
# 摘要命中时最多取几条候选来随机挑选（正常情况下同一份原始字节只有一行）。
MATCH_CANDIDATE_LIMIT = 5
logger = logging.getLogger(__name__)
MANAGED_FILE_NAME = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$"
)
# 附件删除的物理清除时刻（北京时间凌晨 2 点），与 attachment_cleanup_service 的后台任务一致。
ATTACHMENT_PURGE_HOUR = 2
# 软删除后的保留期：完整 7 个自然日，给「删错了」留出可撤销的窗口。
ATTACHMENT_RETENTION_DAYS = 7
# 所有可能引用 file_object 的图片关联表。新增引用表时必须同步这里，
# 否则附件管理会低估「被引用次数」并误删在用图片。
REFERENCE_MODELS: tuple[type[Any], ...] = (
    StockMaterialImage,
    PurchaseMaterialImage,
    PurchasePlanTemplateImage,
    PurchaseRequestLineImage,
    HazardBeforeImage,
    HazardAfterImage,
    LedgerImage,
    LedgerTagImage,
    WorkTaskImage,
)


def _reference_count_expression() -> ColumnElement[int]:
    """被引用次数表达式：全部图片关联表中指向 `FileObject.id` 的记录数之和。

    以相关子查询形式书写，可直接放进 select 列或 where 条件（不依赖 group by）。
    """
    parts: list[ColumnElement[int]] = [
        select(func.count())
        .select_from(model)
        .where(model.file_id == FileObject.id)
        .scalar_subquery()
        for model in REFERENCE_MODELS
    ]
    expression = parts[0]
    for part in parts[1:]:
        expression = expression + part
    return expression


def attachment_purge_after(deleted_at: datetime) -> datetime:
    """软删除后的物理清除时刻：保留期满后的第一个凌晨 2 点（北京时间）。

    规则：保留 `ATTACHMENT_RETENTION_DAYS` 个完整自然日，到期那一刻之后的第一个 2 点由
    `attachment_cleanup_service` 的定时任务复查引用并清除（`deleted_at` 恰好落在 2 点整时
    当天 2 点即算到期，因此用含边界的 `inclusive`）。纯函数便于单测；返回 UTC（aware）。
    """
    deadline = utc_aware(deleted_at).astimezone(SHANGHAI) + timedelta(
        days=ATTACHMENT_RETENTION_DAYS
    )
    return next_local_hour(deadline, ATTACHMENT_PURGE_HOUR, inclusive=True).astimezone(UTC)


@dataclass
class DigestLockEntry:
    lock: asyncio.Lock
    users: int = 0


_digest_locks: dict[str, DigestLockEntry] = {}
_digest_locks_guard = threading.Lock()


def file_path(file_id: str) -> Path:
    return settings.upload_dir / f"{file_id}.png"


@dataclass(frozen=True)
class SourceFingerprint:
    """原始上传字节的指纹（重编码前的原文件），供前端「先比对摘要、命中免上传」使用。"""

    sha256: str
    probes: dict[str, Any]


def _probe_windows(raw: bytes) -> dict[str, Any] | None:
    """中间片段挑战材料：{"size": 原始字节数, "windows": [{offset, length, sha256}, …]}。

    二次校验要求客户端对本地同位置字节算出同样的摘要，所以窗口位置与摘要必须来自**原始上传
    字节**；但服务端不留原始副本，磁盘上始终只有重编码后的 PNG（见 `save_image`）。
    不超过 `DEDUP_MIN_BYTES` 的文件返回 None：前端本来就不会为它们提交摘要。
    """
    size = len(raw)
    if size <= DEDUP_MIN_BYTES:
        return None
    length = min(PROBE_WINDOW_BYTES, size // 4)
    low = size // 4
    high = size - size // 4
    windows: list[dict[str, Any]] = []
    seen: set[int] = set()
    for fraction in PROBE_FRACTIONS:
        offset = min(max(int(size * fraction) - length // 2, low), high - length)
        if offset < 0 or offset in seen:
            continue
        seen.add(offset)
        windows.append(
            {
                "offset": offset,
                "length": length,
                "sha256": hashlib.sha256(raw[offset : offset + length]).hexdigest(),
            }
        )
    return {"size": size, "windows": windows}


def source_fingerprint(raw: bytes) -> SourceFingerprint | None:
    """（原始字节摘要, 挑战材料）；不超过 `DEDUP_MIN_BYTES` 的返回 None。"""
    probes = _probe_windows(raw)
    if probes is None:
        return None
    return SourceFingerprint(sha256=hashlib.sha256(raw).hexdigest(), probes=probes)


async def find_source_match(
    session: AsyncSession, *, sha256: str, size_bytes: int
) -> tuple[FileObject, dict[str, Any]] | None:
    """按前端提交的原始字节摘要找可复用附件，并随机挑一个中间片段作为二次校验材料。

    任一条件不满足都算未命中（调用方返回 `matched=false`，前端退回正常上传）：
    摘要一致且未软删除、记过挑战材料、挑战材料里的原始字节数与前端声明一致、磁盘 PNG 还在
    （否则复用回去的图片打不开）。
    """
    candidates = list(
        (
            await session.scalars(
                select(FileObject)
                .where(
                    FileObject.source_sha256 == sha256.lower(),
                    FileObject.source_probes.is_not(None),
                    FileObject.deleted_at.is_(None),
                )
                .order_by(FileObject.created_at, FileObject.id)
                .limit(MATCH_CANDIDATE_LIMIT)
            )
        ).all()
    )
    usable = [
        item
        for item in candidates
        if (probes := item.source_probes or {}).get("size") == size_bytes
        and probes.get("windows")
        and file_path(item.id).is_file()
    ]
    if not usable:
        return None
    item = secrets.choice(usable)
    probes = item.source_probes or {}
    return item, secrets.choice(probes["windows"])


@asynccontextmanager
async def _digest_lock(digest: str) -> AsyncIterator[None]:
    with _digest_locks_guard:
        entry = _digest_locks.setdefault(digest, DigestLockEntry(lock=asyncio.Lock()))
        entry.users += 1
    try:
        async with entry.lock:
            yield
    finally:
        with _digest_locks_guard:
            entry.users -= 1
            if entry.users == 0:
                _digest_locks.pop(digest, None)


def _unreferenced() -> ColumnElement[bool]:
    return (
        ~exists().where(StockMaterialImage.file_id == FileObject.id)
        & ~exists().where(PurchaseMaterialImage.file_id == FileObject.id)
        & ~exists().where(PurchasePlanTemplateImage.file_id == FileObject.id)
        & ~exists().where(PurchaseRequestLineImage.file_id == FileObject.id)
        & ~exists().where(HazardBeforeImage.file_id == FileObject.id)
        & ~exists().where(HazardAfterImage.file_id == FileObject.id)
        & ~exists().where(LedgerImage.file_id == FileObject.id)
        & ~exists().where(LedgerTagImage.file_id == FileObject.id)
        & ~exists().where(WorkTaskImage.file_id == FileObject.id)
    )


def _managed_disk_files() -> dict[str, Path]:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    return {
        path.name: path
        for path in settings.upload_dir.iterdir()
        if path.is_file() and MANAGED_FILE_NAME.fullmatch(path.name)
    }


def _render_preview(source: Path, size: int) -> bytes:
    output = io.BytesIO()
    with Image.open(source) as image:
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        converted = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        converted.save(output, format="WEBP", quality=82, method=6)
    return output.getvalue()


async def save_image(session: AsyncSession, upload: UploadFile) -> FileObjectRead:
    if upload.content_type not in ACCEPTED_TYPES:
        raise AppError("INVALID_IMAGE_TYPE", "仅支持 JPEG、PNG 或 WebP 图片")
    raw = await upload.read(settings.max_image_bytes + 1)
    if len(raw) > settings.max_image_bytes:
        raise AppError("IMAGE_TOO_LARGE", "单张图片不能超过 10 MB", status_code=413)
    try:
        with Image.open(io.BytesIO(raw)) as source:
            source.load()
            converted = source.convert("RGBA" if "A" in source.getbands() else "RGB")
            width, height = converted.size
            output = io.BytesIO()
            converted.save(output, format="PNG", optimize=True)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise AppError("INVALID_IMAGE", "图片无法解码") from exc

    data = output.getvalue()
    digest = hashlib.sha256(data).hexdigest()
    # 原始字节指纹在进摘要锁之前算好：只对 >1MB 的文件记录，用于前端免重复上传
    # （见 source_fingerprint）。
    fingerprint = source_fingerprint(raw)
    async with _digest_lock(digest):
        existing_items = list(
            (
                await session.scalars(
                    select(FileObject)
                    .where(FileObject.sha256 == digest, FileObject.deleted_at.is_(None))
                    .order_by(FileObject.created_at, FileObject.id)
                )
            ).all()
        )
        missing_item: FileObject | None = None
        for existing in existing_items:
            existing_path = file_path(existing.id)
            if not existing_path.is_file():
                missing_item = missing_item or existing
                continue
            if existing.size_bytes != len(data):
                continue
            existing_data = await asyncio.to_thread(existing_path.read_bytes)
            if existing_data == data:
                return file_read(existing)

        if missing_item is not None:
            target = file_path(missing_item.id)
            settings.upload_dir.mkdir(parents=True, exist_ok=True)
            await asyncio.to_thread(target.write_bytes, data)
            missing_item.mime_type = "image/png"
            missing_item.size_bytes = len(data)
            missing_item.width = width
            missing_item.height = height
            try:
                await session.commit()
            except Exception:
                await session.rollback()
                await asyncio.to_thread(target.unlink, missing_ok=True)
                raise
            return file_read(missing_item)

        file_id = uuid7_string()
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        target = file_path(file_id)
        await asyncio.to_thread(target.write_bytes, data)
        item = FileObject(
            id=file_id,
            original_name=Path(upload.filename or "image").name[:255],
            mime_type="image/png",
            size_bytes=len(data),
            width=width,
            height=height,
            sha256=digest,
            source_sha256=fingerprint.sha256 if fingerprint else None,
            source_probes=fingerprint.probes if fingerprint else None,
        )
        session.add(item)
        try:
            await session.flush()
            # 上传是独立事务。只有数据库记录真正提交后才向客户端返回成功。
            await session.commit()
        except Exception:
            await session.rollback()
            await asyncio.to_thread(target.unlink, missing_ok=True)
            raise
        return file_read(item)


async def get_image(session: AsyncSession, file_id: str) -> tuple[FileObject, Path]:
    item = await session.get(FileObject, file_id)
    # 已软删除（保留期内等待凌晨清理）的图片不再对外提供，避免刚删掉又能在业务里打开。
    if item is None or item.deleted_at is not None:
        raise not_found("图片")
    path = file_path(file_id)
    if not path.is_file():
        raise AppError("FILE_MISSING", "图片文件不存在")
    return item, path


async def render_preview(path: Path, size: int) -> bytes:
    try:
        return await asyncio.to_thread(_render_preview, path, size)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise AppError("INVALID_IMAGE", "图片无法生成预览") from exc


async def count_references(session: AsyncSession, file_id: str) -> int:
    """该图片当前的被引用次数（全部图片关联表之和）。"""
    return int(
        await session.scalar(
            select(_reference_count_expression()).where(FileObject.id == file_id)
        )
        or 0
    )


def attachment_read(item: FileObject, reference_count: int, *, file_exists: bool) -> AttachmentRead:
    return AttachmentRead(
        id=item.id,
        original_name=item.original_name,
        mime_type=item.mime_type,
        size_bytes=item.size_bytes,
        width=item.width,
        height=item.height,
        created_at=utc_aware(item.created_at),
        reference_count=reference_count,
        deleted_at=utc_aware(item.deleted_at),
        file_exists=file_exists,
    )


async def list_attachments(
    session: AsyncSession,
    *,
    keyword: str | None = None,
    referenced: bool | None = None,
    status: str = "active",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AttachmentRead], int]:
    """附件管理列表：每张图片一行，带被引用次数与软删除状态。

    `referenced` 为 True/False 时只看「已被引用 / 未被引用」；`status` 取 active / deleted / all。
    """
    reference_count = _reference_count_expression()
    query: Select[tuple[FileObject, int]] = select(FileObject, reference_count)
    conditions: list[ColumnElement[bool]] = []
    if keyword:
        conditions.append(FileObject.original_name.contains(keyword, autoescape=True))
    if status == "active":
        conditions.append(FileObject.deleted_at.is_(None))
    elif status == "deleted":
        conditions.append(FileObject.deleted_at.is_not(None))
    if referenced is True:
        conditions.append(reference_count > 0)
    elif referenced is False:
        conditions.append(reference_count == 0)
    if conditions:
        query = query.where(*conditions)
    query = query.order_by(FileObject.created_at.desc(), FileObject.id.desc())

    # 计数直接对 file_object 计数（引用子查询只在需要按引用筛选时进入 where），
    # 避免把「每行的引用次数」也算一遍。
    total = int(
        await session.scalar(select(func.count()).select_from(FileObject).where(*conditions)) or 0
    )
    rows = (
        await session.execute(query.offset((page - 1) * page_size).limit(page_size))
    ).unique().all()
    disk_files = await asyncio.to_thread(_managed_disk_files)
    items = [
        attachment_read(item, int(count), file_exists=f"{item.id}.png" in disk_files)
        for item, count in rows
    ]
    return items, total


async def soft_delete_image(session: AsyncSession, file_id: str) -> AttachmentDeleteRead:
    """软删除：仅当被引用次数为 0 时允许，落 `deleted_at` 但不删文件。

    保留 `ATTACHMENT_RETENTION_DAYS` 个完整自然日（期间可撤销删除），到期后的第一个凌晨 2 点
    才由引用复查物理清除（见 attachment_cleanup_service）。
    """
    item = await session.get(FileObject, file_id)
    if item is None:
        raise not_found("图片")
    if item.deleted_at is not None:
        raise AppError(
            "FILE_ALREADY_DELETED",
            f"图片已提交删除，保留 {ATTACHMENT_RETENTION_DAYS} 天后由凌晨清理任务清除",
            status_code=409,
        )
    if await count_references(session, file_id) > 0:
        raise AppError("FILE_IN_USE", "图片已被业务引用，不能删除", status_code=409)
    deleted_at = utcnow()
    item.deleted_at = deleted_at
    await session.commit()
    return AttachmentDeleteRead(
        id=file_id,
        deleted_at=utc_aware(deleted_at),
        purge_after=attachment_purge_after(deleted_at),
    )


async def soft_delete_unreferenced(session: AsyncSession) -> AttachmentBulkDeleteRead:
    """批量软删除：把所有「在用且被引用次数为 0」的附件一次性标记为待删除。

    引用条件直接写在 UPDATE 的 WHERE 里（不先查后改），避免两次操作之间被新引用插进来；
    这里只落 `deleted_at`，物理删除仍由保留期满后的凌晨 2 点引用复查执行。
    """
    deleted_at = utcnow()
    result = await session.execute(
        update(FileObject)
        .where(FileObject.deleted_at.is_(None), _reference_count_expression() == 0)
        .values(deleted_at=deleted_at)
    )
    await session.commit()
    return AttachmentBulkDeleteRead(
        deleted_count=int(result.rowcount or 0),
        purge_after=attachment_purge_after(deleted_at),
    )


async def restore_image(session: AsyncSession, file_id: str) -> None:
    """撤销删除：把待清理的图片恢复为在用（物理删除尚未发生，可撤销）。"""
    item = await session.get(FileObject, file_id)
    if item is None:
        raise not_found("图片")
    if item.deleted_at is None:
        return
    item.deleted_at = None
    await session.commit()


async def purge_deleted_attachments(
    session: AsyncSession, *, batch_size: int = 200
) -> AttachmentCleanupRead:
    """引用复查：扫描全库待删除附件，确认无引用**且保留期满**才物理删除数据库行与磁盘文件。

    - 复查发现又被引用（软删除后被重新挂到业务上）→ 撤销删除，保留文件与记录（不必等到保留期满）；
    - 复查仍无引用但保留期未满（`attachment_purge_after` 还没到）→ 原样保留，等下一个凌晨 2 点的任务；
    - 复查仍无引用且已到 `attachment_purge_after`（提交删除的完整 7 天后的第一个 2 点）→ 物理清除。
    """
    now = datetime.now(UTC)
    candidates = list(
        (
            await session.scalars(
                select(FileObject)
                .where(FileObject.deleted_at.is_not(None))
                .order_by(FileObject.deleted_at, FileObject.id)
                .limit(batch_size)
                .with_for_update(skip_locked=True)
            )
        ).all()
    )
    purged_ids: list[str] = []
    restored_ids: list[str] = []
    for item in candidates:
        if await count_references(session, item.id) > 0:
            item.deleted_at = None
            restored_ids.append(item.id)
            continue
        if item.deleted_at is None or attachment_purge_after(item.deleted_at) > now:
            # 还在保留期内：留给后面的定时任务，不在本轮清除
            continue
        purged_ids.append(item.id)
        await session.delete(item)
    await session.commit()

    deleted_file_names: list[str] = []
    for file_id in purged_ids:
        path = file_path(file_id)
        if path.is_file():
            await asyncio.to_thread(path.unlink)
            deleted_file_names.append(path.name)
    if purged_ids or restored_ids:
        logger.info(
            "attachment cleanup scanned=%s purged=%s restored=%s",
            len(candidates),
            len(purged_ids),
            len(restored_ids),
        )
    return AttachmentCleanupRead(
        scanned=len(candidates),
        purged_file_ids=purged_ids,
        purged_file_names=deleted_file_names,
        restored_file_ids=restored_ids,
    )


async def inspect_orphans(
    session: AsyncSession, older_than_hours: int
) -> OrphanFileReportRead:
    cutoff = utcnow() - timedelta(hours=older_than_hours)
    unreferenced = list(
        (
            await session.scalars(
                select(FileObject)
                .where(
                    FileObject.created_at <= cutoff,
                    FileObject.deleted_at.is_(None),
                    _unreferenced(),
                )
                .order_by(FileObject.created_at, FileObject.id)
            )
        ).all()
    )
    all_records = list(
        (
            await session.execute(
                select(FileObject.id, FileObject.created_at).where(
                    FileObject.deleted_at.is_(None)
                )
            )
        ).all()
    )
    disk_files = await asyncio.to_thread(_managed_disk_files)
    cutoff_timestamp = cutoff.replace(tzinfo=UTC).timestamp()
    record_ids = {file_id for file_id, _ in all_records}
    untracked = sorted(
        name
        for name, path in disk_files.items()
        if name.removesuffix(".png") not in record_ids and path.stat().st_mtime <= cutoff_timestamp
    )
    missing = sorted(
        file_id
        for file_id, created_at in all_records
        if created_at <= cutoff and f"{file_id}.png" not in disk_files
    )
    return OrphanFileReportRead(
        cutoff=utc_aware(cutoff),
        unreferenced_records=[
            OrphanFileRead(
                id=item.id,
                original_name=item.original_name,
                size_bytes=item.size_bytes,
                created_at=utc_aware(item.created_at),
                file_exists=f"{item.id}.png" in disk_files,
            )
            for item in unreferenced
        ],
        untracked_file_names=untracked,
        missing_file_ids=missing,
    )


async def cleanup_orphans(
    session: AsyncSession, older_than_hours: int
) -> OrphanFileCleanupRead:
    report = await inspect_orphans(session, older_than_hours)
    record_ids = [item.id for item in report.unreferenced_records]
    if record_ids:
        records = list(
            (
                await session.scalars(
                    select(FileObject).where(
                        FileObject.id.in_(record_ids),
                        FileObject.deleted_at.is_(None),
                        _unreferenced(),
                    )
                )
            ).all()
        )
        deleted_record_ids = [item.id for item in records]
        for item in records:
            await session.delete(item)
        await session.commit()
    else:
        deleted_record_ids = []

    candidates = [f"{file_id}.png" for file_id in deleted_record_ids]
    candidates.extend(report.untracked_file_names)
    deleted_file_names: list[str] = []
    for name in sorted(set(candidates)):
        path = settings.upload_dir / name
        if path.is_file():
            await asyncio.to_thread(path.unlink)
            deleted_file_names.append(name)
    return OrphanFileCleanupRead(
        cutoff=report.cutoff,
        deleted_record_ids=deleted_record_ids,
        deleted_file_names=deleted_file_names,
    )
