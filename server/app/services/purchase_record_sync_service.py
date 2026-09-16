"""申购记录同步（外部物资平台数据回写）专用服务。

替代被移除的 /agent/database/execute：只暴露「待同步目标列表」与「按追溯号回写」两个
窄操作，不允许任意 SQL。语义与旧油猴脚本一致：文本字段仅当空才填、日期仅当 NULL 才填、
状态只进不退，且只在实际变更时自增 version（updated_at 由 ORM onupdate 自动更新）。

华兴帆软同步脚本另有两个端点：`list_sync_order_targets` 按「申购单号」分组整单目标
（含该单待同步追溯号），`apply_order_sync` 接收整单多个追溯号的结果并一次回写，配合
脚本侧「每单一次平台查询、每单一次批量回写」，避免按追溯号逐条查询产生大量平台请求。
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, not_found
from app.models import PurchaseRequest, PurchaseRequestLine
from app.repositories import purchase_request_repository
from app.schemas import (
    PurchaseRecordSyncOrderApply,
    PurchaseRecordSyncOrderApplyRead,
    PurchaseRecordSyncOrderTargetRead,
    PurchaseRecordSyncOrderTargetsRead,
    PurchaseRecordSyncResultRead,
    PurchaseRecordSyncTargetRead,
    PurchaseRecordSyncTargetsRead,
    PurchaseRecordSyncTraceUpdate,
)

# 状态只进不退：目标状态 -> 允许的当前状态集合（不在集合里的目标值不生效）
_STATUS_PROGRESSION = {
    "已入库": {"已申购", "已采购", "部分入库", "已入库"},
    "部分入库": {"已申购", "已采购", "部分入库"},
    "已采购": {"已申购", "已采购"},
}

_SYNC_FIELDS = frozenset(
    {
        "salesperson",
        "contract_no",
        "vessel_no",
        "consolidation_port",
        "consolidation_date",
        "sailing_date",
        "contract_sign_date",
        "status",
    }
)


def _is_blank(value: str | None) -> bool:
    return value is None or not value.strip()


def _resolve_active_fields(fields: str | None) -> set[str] | None:
    """把逗号分隔的 fields 参数解析成白名单子集；空/None 表示全部字段。"""
    if not fields:
        return None
    parsed = {part.strip() for part in fields.split(",") if part.strip()}
    unknown = parsed - _SYNC_FIELDS
    if unknown:
        raise AppError(
            "VALIDATION_ERROR",
            f"未知同步字段: {', '.join(sorted(unknown))}",
            status_code=422,
        )
    return parsed


def _resolve_order_no_cutoff(value: str | None, label: str) -> str | None:
    """校验并归一化申购单号区间端点（下界 / 上界）；空值表示该侧不限。"""
    if not value:
        return None
    cutoff = value.strip()
    if len(cutoff) > 128:
        raise AppError("VALIDATION_ERROR", f"{label}过长", status_code=422)
    return cutoff


async def list_sync_targets(
    session: AsyncSession,
    *,
    limit: int,
    cursor: int,
    fields: str | None = None,
    min_purchase_order_no: str | None = None,
    max_purchase_order_no: str | None = None,
) -> PurchaseRecordSyncTargetsRead:
    active_fields = _resolve_active_fields(fields)
    cutoff = _resolve_order_no_cutoff(min_purchase_order_no, "申购单号起始值")
    max_cutoff = _resolve_order_no_cutoff(max_purchase_order_no, "申购单号上限值")
    rows = await purchase_request_repository.list_sync_targets(
        session,
        limit=limit,
        cursor=cursor,
        fields=active_fields,
        min_purchase_order_no=cutoff,
        max_purchase_order_no=max_cutoff,
    )
    has_more = len(rows) > limit
    items = [
        PurchaseRecordSyncTargetRead(trace_no=trace_no, target_count=count, cursor_id=cursor_id)
        for trace_no, count, cursor_id in rows[:limit]
    ]
    next_cursor = items[-1].cursor_id if items else 0
    return PurchaseRecordSyncTargetsRead(items=items, has_more=has_more, next_cursor=next_cursor)


async def list_sync_order_targets(
    session: AsyncSession,
    *,
    limit: int,
    cursor: int,
    fields: str | None = None,
    min_purchase_order_no: str | None = None,
    max_purchase_order_no: str | None = None,
) -> PurchaseRecordSyncOrderTargetsRead:
    """按申购单号列出待同步整单目标（供整单一次平台查询、整单批量回写）。"""
    active_fields = _resolve_active_fields(fields)
    cutoff = _resolve_order_no_cutoff(min_purchase_order_no, "申购单号起始值")
    max_cutoff = _resolve_order_no_cutoff(max_purchase_order_no, "申购单号上限值")
    rows = await purchase_request_repository.list_sync_order_targets(
        session,
        limit=limit,
        cursor=cursor,
        fields=active_fields,
        min_purchase_order_no=cutoff,
        max_purchase_order_no=max_cutoff,
    )
    has_more = len(rows) > limit
    items = [
        PurchaseRecordSyncOrderTargetRead(
            purchase_order_no=purchase_order_no,
            trace_nos=trace_nos,
            cursor_id=cursor_id,
        )
        for purchase_order_no, trace_nos, cursor_id in rows[:limit]
    ]
    next_cursor = items[-1].cursor_id if items else 0
    return PurchaseRecordSyncOrderTargetsRead(
        items=items, has_more=has_more, next_cursor=next_cursor
    )


def _apply_mutation(
    data: PurchaseRecordSyncTraceUpdate,
    requests_by_id: dict[int, PurchaseRequest],
    lines: list[PurchaseRequestLine],
) -> tuple[int, int]:
    """按同步规则把 data 落到 request/line，返回 (affected_headers, affected_lines)。

    文本字段仅当空才填、日期仅当 NULL 才填、状态只进不退；只在实际变更时自增 version。
    requests_by_id 必须包含这些 line 所属的已加锁 PurchaseRequest。
    """
    affected_headers = 0
    affected_lines = 0
    touched_request_ids: set[int] = set()
    for line in lines:
        request = requests_by_id.get(line.purchase_request_id)
        if request is None:
            continue
        if request.id not in touched_request_ids:
            touched_request_ids.add(request.id)
            changed = False
            for field in ("contract_no", "vessel_no", "consolidation_port"):
                value = getattr(data, field)
                if value is None or _is_blank(value) or not _is_blank(getattr(request, field)):
                    continue
                setattr(request, field, value.strip())
                changed = True
            for field in ("consolidation_date", "sailing_date"):
                value = getattr(data, field)
                if value is None or getattr(request, field) is not None:
                    continue
                setattr(request, field, value)
                changed = True
            if changed:
                request.version += 1
                affected_headers += 1

        changed = False
        if (
            data.salesperson is not None
            and not _is_blank(data.salesperson)
            and _is_blank(line.salesperson)
        ):
            line.salesperson = data.salesperson.strip()
            changed = True
        # 合同签订日期是物资级字段（行级），同样只补空值，不覆盖人工填写。
        if data.contract_sign_date is not None and line.contract_sign_date is None:
            line.contract_sign_date = data.contract_sign_date
            changed = True
        if (
            data.status is not None
            and not _is_blank(data.status)
            and line.status != data.status.strip()
            and line.status in _STATUS_PROGRESSION.get(data.status.strip(), set())
        ):
            line.status = data.status.strip()
            changed = True
        if changed:
            line.version += 1
            affected_lines += 1
    return affected_headers, affected_lines


async def _locked_lines_and_requests(
    session: AsyncSession, trace_no: str
) -> tuple[list[PurchaseRequestLine], dict[int, PurchaseRequest]]:
    lines = list(
        (
            await session.scalars(
                select(PurchaseRequestLine)
                .where(PurchaseRequestLine.trace_no == trace_no)
                .order_by(PurchaseRequestLine.id)
                .with_for_update()
            )
        )
        .unique()
        .all()
    )
    if not lines:
        raise not_found("该追溯号的申购记录")
    request_ids = {line.purchase_request_id for line in lines}
    requests = list(
        (
            await session.scalars(
                select(PurchaseRequest)
                .where(PurchaseRequest.id.in_(request_ids))
                .with_for_update()
            )
        )
        .unique()
        .all()
    )
    return lines, {request.id: request for request in requests}


async def apply_trace_sync(
    session: AsyncSession, trace_no: str, data: PurchaseRecordSyncTraceUpdate
) -> PurchaseRecordSyncResultRead:
    trace = trace_no.strip()
    if not trace:
        raise AppError("VALIDATION_ERROR", "追溯号不能为空", status_code=422)
    lines, requests_by_id = await _locked_lines_and_requests(session, trace)
    affected_headers, affected_lines = _apply_mutation(data, requests_by_id, lines)
    await session.flush()
    return PurchaseRecordSyncResultRead(
        affected_headers=affected_headers, affected_lines=affected_lines
    )


async def apply_order_sync(
    session: AsyncSession,
    purchase_order_no: str,
    data: PurchaseRecordSyncOrderApply,
) -> PurchaseRecordSyncOrderApplyRead:
    """整单批量回写：把某申购单下多个追溯号的结果一次落到行/头，返回应用统计。

    items 按追溯号命中该申购单的行执行（规则同 apply_trace_sync）；某追溯号在该申购单下
    不存在时只计入 not_found 并继续处理其余项，不整单失败。
    """
    po = purchase_order_no.strip()
    if not po:
        raise AppError("VALIDATION_ERROR", "申购单号不能为空", status_code=422)
    requests = list(
        (
            await session.scalars(
                select(PurchaseRequest)
                .where(func.coalesce(func.trim(PurchaseRequest.purchase_order_no), "") == po)
                .with_for_update()
            )
        )
        .unique()
        .all()
    )
    if not requests:
        raise not_found("该申购单的申购记录")
    request_ids = {request.id for request in requests}
    lines = list(
        (
            await session.scalars(
                select(PurchaseRequestLine)
                .where(PurchaseRequestLine.purchase_request_id.in_(request_ids))
                .with_for_update()
            )
        )
        .unique()
        .all()
    )
    if not lines:
        raise not_found("该申购单的申购记录")
    requests_by_id = {request.id: request for request in requests}

    applied = 0
    unmatched = 0
    affected_headers = 0
    affected_lines = 0
    for item in data.items:
        trace = item.trace_no.strip()
        matched = [
            line for line in lines if (line.trace_no or "").strip() == trace
        ]
        if not matched:
            unmatched += 1
            continue
        applied += 1
        headers, lines_changed = _apply_mutation(item, requests_by_id, matched)
        affected_headers += headers
        affected_lines += lines_changed

    await session.flush()
    return PurchaseRecordSyncOrderApplyRead(
        applied=applied,
        not_found=unmatched,
        affected_headers=affected_headers,
        affected_lines=affected_lines,
    )
