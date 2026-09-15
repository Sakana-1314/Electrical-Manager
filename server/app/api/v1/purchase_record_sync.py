from fastapi import APIRouter, Depends, Query

from app.core.permissions import DbSession, PurchaseWriter, require_current_project
from app.schemas import (
    PurchaseRecordSyncOrderApply,
    PurchaseRecordSyncOrderApplyRead,
    PurchaseRecordSyncOrderTargetsRead,
    PurchaseRecordSyncResultRead,
    PurchaseRecordSyncTargetsRead,
    PurchaseRecordSyncTraceUpdate,
)
from app.services import purchase_record_sync_service as service

router = APIRouter(
    tags=["申购记录同步"],
    dependencies=[Depends(require_current_project)],
)


@router.get(
    "/purchase-record-sync/targets",
    response_model=PurchaseRecordSyncTargetsRead,
    summary="同步目标",
)
async def sync_targets(
    session: DbSession,
    user: PurchaseWriter,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int = Query(default=0, ge=0),
    fields: str | None = Query(
        default=None,
        description="逗号分隔的需要补全的同步字段；省略表示全部字段",
    ),
    min_purchase_order_no: str | None = Query(
        default=None,
        max_length=128,
        description="只返回申购单号（purchase_order_no）>= 该值的记录（含该值）",
    ),
) -> PurchaseRecordSyncTargetsRead:
    return await service.list_sync_targets(
        session,
        limit=limit,
        cursor=cursor,
        fields=fields,
        min_purchase_order_no=min_purchase_order_no,
    )


@router.post(
    "/purchase-record-sync/trace/{trace_no}",
    response_model=PurchaseRecordSyncResultRead,
    summary="按追溯号同步",
)
async def sync_trace(
    trace_no: str,
    data: PurchaseRecordSyncTraceUpdate,
    session: DbSession,
    user: PurchaseWriter,
) -> PurchaseRecordSyncResultRead:
    return await service.apply_trace_sync(session, trace_no, data)


@router.get(
    "/purchase-record-sync/order-targets",
    response_model=PurchaseRecordSyncOrderTargetsRead,
    summary="整单同步目标",
)
async def sync_order_targets(
    session: DbSession,
    user: PurchaseWriter,
    limit: int = Query(default=50, ge=1, le=200),
    cursor: int = Query(default=0, ge=0),
    fields: str | None = Query(
        default=None,
        description="逗号分隔的需要补全的同步字段；省略表示全部字段",
    ),
    min_purchase_order_no: str | None = Query(
        default=None,
        max_length=128,
        description="只返回申购单号（purchase_order_no）>= 该值的记录（含该值）",
    ),
) -> PurchaseRecordSyncOrderTargetsRead:
    """按申购单号列出待同步整单目标（整单一次平台查询、整单批量回写）。"""
    return await service.list_sync_order_targets(
        session,
        limit=limit,
        cursor=cursor,
        fields=fields,
        min_purchase_order_no=min_purchase_order_no,
    )


@router.post(
    "/purchase-record-sync/orders/{purchase_order_no}/apply",
    response_model=PurchaseRecordSyncOrderApplyRead,
    summary="整单同步回写",
)
async def sync_order_apply(
    purchase_order_no: str,
    data: PurchaseRecordSyncOrderApply,
    session: DbSession,
    user: PurchaseWriter,
) -> PurchaseRecordSyncOrderApplyRead:
    """整单批量回写：把一个申购单下多个追溯号的结果一次写回。"""
    return await service.apply_order_sync(session, purchase_order_no, data)
