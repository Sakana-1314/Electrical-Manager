from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import PageNo, PageSize
from app.core.errors import not_found
from app.core.permissions import DbSession, SuperAdmin, require_roles
from app.domain.enums import Role
from app.models import FileObject, User
from app.schemas import (
    AttachmentBulkDeleteRead,
    AttachmentDeleteRead,
    AttachmentRead,
    FileId,
    FileObjectRead,
    OrphanFileCleanupRead,
    OrphanFileReportRead,
    Page,
)
from app.services import file_service

router = APIRouter(prefix="/files/images", tags=["图片"])
CACHE_CONTROL = "public, max-age=86400, s-maxage=2592000"
FileWriter = Annotated[
    User,
    Depends(
        require_roles(
            Role.SUPER_ADMIN,
            Role.WAREHOUSE_ADMIN,
            Role.PURCHASE_ADMIN,
            Role.HAZARD_ADMIN,
            Role.LEDGER_ADMIN,
        )
    ),
]


@router.post(
    "",
    response_model=FileObjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="上传图片",
)
async def upload(file: UploadFile, session: DbSession, user: FileWriter) -> FileObjectRead:
    return await file_service.save_image(session, file)


@router.get(
    "/orphans",
    response_model=OrphanFileReportRead,
    summary="悬空图片报告",
)
async def orphan_report(
    session: DbSession,
    user: SuperAdmin,
    older_than_hours: Annotated[int, Query(ge=0, le=87600)] = 24,
) -> OrphanFileReportRead:
    return await file_service.inspect_orphans(session, older_than_hours)


@router.delete(
    "/orphans",
    response_model=OrphanFileCleanupRead,
    summary="清理悬空图片",
)
async def remove_orphans(
    session: DbSession,
    user: SuperAdmin,
    older_than_hours: Annotated[int, Query(ge=0, le=87600)] = 24,
) -> OrphanFileCleanupRead:
    return await file_service.cleanup_orphans(session, older_than_hours)


@router.get(
    "/attachments",
    response_model=Page[AttachmentRead],
    summary="附件列表",
)
async def list_attachments(
    session: DbSession,
    user: SuperAdmin,
    page: PageNo = 1,
    page_size: PageSize = 20,
    keyword: Annotated[str | None, Query(max_length=255)] = None,
    referenced: Annotated[bool | None, Query()] = None,
    status_filter: Annotated[
        str, Query(alias="status", pattern="^(active|deleted|all)$")
    ] = "active",
) -> Page[AttachmentRead]:
    """系统管理「附件管理」列表：每张图片一行，列出被引用次数与删除状态。"""
    items, total = await file_service.list_attachments(
        session,
        keyword=keyword,
        referenced=referenced,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    return Page(items=items, page=page, page_size=page_size, total=total)


@router.post(
    "/attachments/delete-unreferenced",
    response_model=AttachmentBulkDeleteRead,
    summary="删除未引用附件",
)
async def delete_unreferenced_attachments(
    session: DbSession, user: SuperAdmin
) -> AttachmentBulkDeleteRead:
    """把当前所有未被引用的附件批量标记为待删除。

    只做软删除：数据库记录与磁盘文件都保留，次日凌晨 2 点的定时任务复查引用后
    才真正物理清除（复查发现新增引用则自动撤销删除）。不提供手动物理删除入口。
    """
    return await file_service.soft_delete_unreferenced(session)


@router.post(
    "/attachments/{file_id}/restore",
    response_model=AttachmentRead,
    summary="撤销删除附件",
)
async def restore_attachment(
    file_id: FileId, session: DbSession, user: SuperAdmin
) -> AttachmentRead:
    await file_service.restore_image(session, file_id)
    item = await session.get(FileObject, file_id)
    if item is None:  # pragma: no cover - restore_image 已保证存在
        raise not_found("图片")
    reference_count = await file_service.count_references(session, file_id)
    return file_service.attachment_read(
        item, reference_count, file_exists=file_service.file_path(file_id).is_file()
    )


@router.get(
    "/{file_id}",
    summary="读取图片",
)
async def read_image(
    file_id: FileId,
    session: DbSession,
    size: Annotated[int | None, Query(ge=16, le=2048)] = None,
) -> Response:
    # 图片匿名读取是刻意设计：前端 <img>/小程序 image 直接加载，无法携带 Authorization 头。
    # 安全性依赖 file_id 为 UUIDv7（不可猜解）+ 仅返回系统上传的图片。若需更强保护，
    # 应改为签名/短时效 URL 而非强制鉴权（会破坏图片加载）。
    item, path = await file_service.get_image(session, file_id)
    headers = {"Cache-Control": CACHE_CONTROL}
    if size is not None:
        return Response(
            content=await file_service.render_preview(path, size),
            media_type=file_service.PREVIEW_MIME_TYPE,
            headers=headers,
        )
    return FileResponse(
        path,
        media_type=item.mime_type,
        filename=f"{item.id}.png",
        content_disposition_type="inline",
        headers=headers,
    )


@router.delete(
    "/{file_id}",
    response_model=AttachmentDeleteRead,
    summary="删除图片",
)
async def remove(file_id: FileId, session: DbSession, user: FileWriter) -> AttachmentDeleteRead:
    """软删除：被引用次数为 0 才允许；真正清除要等次日凌晨 2 点的引用复查。"""
    return await file_service.soft_delete_image(session, file_id)
