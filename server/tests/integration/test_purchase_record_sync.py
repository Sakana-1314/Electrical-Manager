"""申购记录同步专用接口测试：/purchase-record-sync/*。

覆盖：目标列表与游标分页、按追溯号回写（空才填/状态只进不退/version 自增）、
权限校验、NOT_FOUND。
"""

import pytest

from tests.conftest import auth_headers
from tests.integration.test_procurement import create_purchase_plan

pytestmark = pytest.mark.asyncio


async def _move_plan(
    client, headers, plan_id, trace_no, *, purchase_order_no="SYNC-PO", contract_sign_date=None
):
    response = await client.post(
        f"/api/v1/purchase-materials/{plan_id}/move-to-record",
        headers=headers,
        json={
            "purchase_order_no": purchase_order_no,
            "trace_no": trace_no,
            "contract_no": None,
            "vessel_no": None,
            "consolidation_date": None,
            "consolidation_port": None,
            "sailing_date": None,
            "contract_sign_date": contract_sign_date,
            "purchase_date": "2026-07-18",
            "salesperson": None,
            "status": "已申购",
            "record_remark": "同步测试",
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _apply_trace(client, headers, trace_no, payload):
    response = await client.post(
        f"/api/v1/purchase-record-sync/trace/{trace_no}", headers=headers, json=payload
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _targets(client, headers, **params):
    response = await client.get(
        "/api/v1/purchase-record-sync/targets", headers=headers, params=params
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _record(client, headers, line_id):
    response = await client.get(f"/api/v1/purchase-records/{line_id}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


async def test_sync_targets_apply_and_version(client) -> None:
    headers = await auth_headers(client, "purchase")
    motor = await create_purchase_plan(client, headers, "同步电机A", code="SYNC-A")
    record = await _move_plan(client, headers, int(motor["id"]), "SYNC-001")

    targets = await _targets(client, headers)
    assert [item["trace_no"] for item in targets["items"]] == ["SYNC-001"]

    result = await _apply_trace(
        client,
        headers,
        "SYNC-001",
        {
            "salesperson": "赵经理",
            "contract_no": "HT-SYNC-1",
            "vessel_no": "VESSEL-SYNC-1",
            "status": "已采购",
        },
    )
    assert result == {"affected_headers": 1, "affected_lines": 1}

    rec = await _record(client, headers, record["line_id"])
    assert rec["contract_no"] == "HT-SYNC-1"
    assert rec["vessel_no"] == "VESSEL-SYNC-1"
    assert rec["salesperson"] == "赵经理"
    assert rec["status"] == "已采购"
    assert rec["version"] == 2


async def test_sync_only_fills_empty_and_advances_status(client) -> None:
    headers = await auth_headers(client, "purchase")
    motor = await create_purchase_plan(client, headers, "同步电机B", code="SYNC-B")
    record = await _move_plan(client, headers, int(motor["id"]), "SYNC-002")

    await _apply_trace(
        client,
        headers,
        "SYNC-002",
        {
            "salesperson": "赵经理",
            "contract_no": "HT-SYNC-2",
            "vessel_no": "VESSEL-2",
            "status": "已采购",
        },
    )

    # 已填字段不被覆盖、状态不回退
    result = await _apply_trace(
        client, headers, "SYNC-002", {"salesperson": "新业务员", "status": "已申购"}
    )
    assert result == {"affected_headers": 0, "affected_lines": 0}
    rec = await _record(client, headers, record["line_id"])
    assert rec["salesperson"] == "赵经理"
    assert rec["status"] == "已采购"

    # 前进到已入库后，若按新脚本关心的字段（不含集港/发运）筛选，该追溯号不再是目标
    result = await _apply_trace(client, headers, "SYNC-002", {"status": "已入库"})
    assert result == {"affected_headers": 0, "affected_lines": 1}
    targets = await _targets(
        client, headers, fields="contract_no,vessel_no,salesperson,status"
    )
    assert all(item["trace_no"] != "SYNC-002" for item in targets["items"])
    # 但按全部字段（含集港/发运）筛选时，因集港/发运仍为空，仍视为目标
    targets_all = await _targets(client, headers)
    assert any(item["trace_no"] == "SYNC-002" for item in targets_all["items"])


async def test_sync_targets_min_purchase_order_no(client) -> None:
    headers = await auth_headers(client, "purchase")
    for name, code, po, trace in [
        ("同步电机P1", "SYNC-P1", "P05SG0299", "SYNC-P1"),
        ("同步电机P2", "SYNC-P2", "P05SG0300", "SYNC-P2"),
    ]:
        motor = await create_purchase_plan(client, headers, name, code=code)
        await _move_plan(client, headers, int(motor["id"]), trace, purchase_order_no=po)

    both = await _targets(client, headers)
    assert {item["trace_no"] for item in both["items"]} == {"SYNC-P1", "SYNC-P2"}

    filtered = await _targets(client, headers, min_purchase_order_no="P05SG0300")
    assert [item["trace_no"] for item in filtered["items"]] == ["SYNC-P2"]


async def test_sync_targets_max_purchase_order_no(client) -> None:
    """上界不含端点：max 只返回严格小于该值的申购单号（旧系统脚本按阈值分流用）。"""
    headers = await auth_headers(client, "purchase")
    for name, code, po in [
        ("同步电机Q1", "SYNC-Q1", "P05SG0299"),
        ("同步电机Q2", "SYNC-Q2", "P05SG0300"),
        ("同步电机Q3", "SYNC-Q3", "P05SG0301"),
    ]:
        motor = await create_purchase_plan(client, headers, name, code=code)
        await _move_plan(client, headers, int(motor["id"]), code, purchase_order_no=po)

    below = await _targets(client, headers, max_purchase_order_no="P05SG0300")
    assert [item["trace_no"] for item in below["items"]] == ["SYNC-Q1"]

    # 半开区间 [min, max)：只留下恰好在阈值上的那一单
    window = await _targets(
        client,
        headers,
        min_purchase_order_no="P05SG0300",
        max_purchase_order_no="P05SG0301",
    )
    assert [item["trace_no"] for item in window["items"]] == ["SYNC-Q2"]


async def test_sync_targets_rejects_over_long_order_no_bounds(client) -> None:
    headers = await auth_headers(client, "purchase")
    for params in (
        {"min_purchase_order_no": "P" * 129},
        {"max_purchase_order_no": "P" * 129},
    ):
        response = await client.get(
            "/api/v1/purchase-record-sync/targets", headers=headers, params=params
        )
        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"


async def test_sync_targets_invalid_fields(client) -> None:
    headers = await auth_headers(client, "purchase")
    response = await client.get(
        "/api/v1/purchase-record-sync/targets", headers=headers, params={"fields": "nope"}
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


async def test_sync_targets_cursor_pagination(client) -> None:
    headers = await auth_headers(client, "purchase")
    for index in range(1, 4):
        motor = await create_purchase_plan(
            client, headers, f"同步电机E{index}", code=f"SYNC-E{index}"
        )
        await _move_plan(client, headers, int(motor["id"]), f"SYNC-E{index}")

    first = await _targets(client, headers, limit=2)
    assert len(first["items"]) == 2
    assert first["has_more"] is True
    next_cursor = first["next_cursor"]
    assert next_cursor > 0

    second = await _targets(client, headers, limit=2, cursor=next_cursor)
    assert len(second["items"]) == 1
    assert second["has_more"] is False
    trace_nos = {item["trace_no"] for item in first["items"]} | {
        item["trace_no"] for item in second["items"]
    }
    assert trace_nos == {"SYNC-E1", "SYNC-E2", "SYNC-E3"}


async def test_sync_requires_purchase_writer(client) -> None:
    readonly = await auth_headers(client, "readonly")
    response = await client.get("/api/v1/purchase-record-sync/targets", headers=readonly)
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"

    response = await client.post(
        "/api/v1/purchase-record-sync/trace/ANY", headers=readonly, json={}
    )
    assert response.status_code == 403


async def test_sync_trace_not_found(client) -> None:
    headers = await auth_headers(client, "purchase")
    response = await client.post(
        "/api/v1/purchase-record-sync/trace/NO-SUCH", headers=headers, json={}
    )
    assert response.status_code == 400
    assert response.json()["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 按申购单号整单目标 / 整单批量回写（华兴帆软脚本）
# ---------------------------------------------------------------------------


async def _order_targets(client, headers, **params):
    response = await client.get(
        "/api/v1/purchase-record-sync/order-targets", headers=headers, params=params
    )
    assert response.status_code == 200, response.text
    return response.json()


async def _apply_order(client, headers, purchase_order_no, items):
    response = await client.post(
        f"/api/v1/purchase-record-sync/orders/{purchase_order_no}/apply",
        headers=headers,
        json={"items": items},
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_sync_order_targets_groups_traces_by_order(client) -> None:
    headers = await auth_headers(client, "purchase")
    motor_a = await create_purchase_plan(client, headers, "整单电机A", code="ORD-A")
    await _move_plan(client, headers, int(motor_a["id"]), "TR-ORD-1", purchase_order_no="PO-ONE")
    motor_b = await create_purchase_plan(client, headers, "整单电机B", code="ORD-B")
    await _move_plan(client, headers, int(motor_b["id"]), "TR-ORD-2", purchase_order_no="PO-TWO")
    motor_c = await create_purchase_plan(client, headers, "整单电机C", code="ORD-C")
    await _move_plan(client, headers, int(motor_c["id"]), "TR-ORD-3", purchase_order_no="PO-TWO")

    result = await _order_targets(client, headers)
    by_po = {item["purchase_order_no"]: item["trace_nos"] for item in result["items"]}
    assert by_po == {
        "PO-ONE": ["TR-ORD-1"],
        "PO-TWO": ["TR-ORD-2", "TR-ORD-3"],
    }


async def test_sync_order_targets_cursor_pagination(client) -> None:
    headers = await auth_headers(client, "purchase")
    for index in range(1, 4):
        motor = await create_purchase_plan(
            client, headers, f"整单电机P{index}", code=f"ORD-P{index}"
        )
        await _move_plan(
            client, headers, int(motor["id"]), f"TR-ORD-P{index}",
            purchase_order_no=f"PO-P{index}",
        )

    first = await _order_targets(client, headers, limit=2)
    assert len(first["items"]) == 2
    assert first["has_more"] is True
    second = await _order_targets(client, headers, limit=2, cursor=first["next_cursor"])
    assert second["has_more"] is False
    assert len(second["items"]) == 1
    order_nos = {item["purchase_order_no"] for item in first["items"]} | {
        item["purchase_order_no"] for item in second["items"]
    }
    assert order_nos == {"PO-P1", "PO-P2", "PO-P3"}


async def test_sync_order_targets_min_purchase_order_no(client) -> None:
    headers = await auth_headers(client, "purchase")
    for name, code, po in [
        ("整单电机L1", "ORD-L1", "P05SG0299"),
        ("整单电机L2", "ORD-L2", "P05SG0300"),
    ]:
        motor = await create_purchase_plan(client, headers, name, code=code)
        await _move_plan(client, headers, int(motor["id"]), f"TR-{code}", purchase_order_no=po)

    filtered = await _order_targets(client, headers, min_purchase_order_no="P05SG0300")
    assert [item["purchase_order_no"] for item in filtered["items"]] == ["P05SG0300"]


async def test_sync_order_targets_max_purchase_order_no(client) -> None:
    """旧系统脚本按阈值分流：max 只返回严格小于该值的整单，端点归属上界之外。"""
    headers = await auth_headers(client, "purchase")
    for name, code, po in [
        ("整单电机M1", "ORD-M1", "P05SG0299"),
        ("整单电机M2", "ORD-M2", "P05SG0300"),
        ("整单电机M3", "ORD-M3", "P05SG0301"),
    ]:
        motor = await create_purchase_plan(client, headers, name, code=code)
        await _move_plan(client, headers, int(motor["id"]), f"TR-{code}", purchase_order_no=po)

    below = await _order_targets(client, headers, max_purchase_order_no="P05SG0300")
    assert [item["purchase_order_no"] for item in below["items"]] == ["P05SG0299"]

    window = await _order_targets(
        client,
        headers,
        min_purchase_order_no="P05SG0300",
        max_purchase_order_no="P05SG0301",
    )
    assert [item["purchase_order_no"] for item in window["items"]] == ["P05SG0300"]

    response = await client.get(
        "/api/v1/purchase-record-sync/order-targets",
        headers=headers,
        params={"max_purchase_order_no": "P" * 129},
    )
    assert response.status_code == 422
    assert response.json()["code"] == "VALIDATION_ERROR"


async def test_sync_order_apply_writes_whole_order_in_one_call(client) -> None:
    headers = await auth_headers(client, "purchase")
    motor_a = await create_purchase_plan(client, headers, "整单回写电机A", code="WRITE-A")
    record_a = await _move_plan(
        client, headers, int(motor_a["id"]), "TR-WRITE-A", purchase_order_no="PO-WRITE"
    )
    motor_b = await create_purchase_plan(client, headers, "整单回写电机B", code="WRITE-B")
    record_b = await _move_plan(
        client, headers, int(motor_b["id"]), "TR-WRITE-B", purchase_order_no="PO-WRITE"
    )

    result = await _apply_order(
        client,
        headers,
        "PO-WRITE",
        [
            {
                "trace_no": "TR-WRITE-A",
                "salesperson": "王经理",
                "contract_no": "HT-WRITE",
                "vessel_no": "V-WRITE",
                "status": "已采购",
            },
            {"trace_no": "TR-WRITE-B", "salesperson": "李经理", "status": "已采购"},
        ],
    )
    assert result == {
        "applied": 2,
        "not_found": 0,
        "affected_headers": 1,
        "affected_lines": 2,
    }

    rec_a = await _record(client, headers, record_a["line_id"])
    assert rec_a["contract_no"] == "HT-WRITE"
    assert rec_a["vessel_no"] == "V-WRITE"
    assert rec_a["salesperson"] == "王经理"
    assert rec_a["status"] == "已采购"
    assert rec_a["version"] == 2

    rec_b = await _record(client, headers, record_b["line_id"])
    assert rec_b["salesperson"] == "李经理"
    assert rec_b["status"] == "已采购"

    # 规则不变：已填不覆盖、状态不回退
    again = await _apply_order(
        client,
        headers,
        "PO-WRITE",
        [
            {
                "trace_no": "TR-WRITE-A",
                "salesperson": "赵经理",
                "contract_no": "HT-OTHER",
                "status": "已申购",
            }
        ],
    )
    assert again == {
        "applied": 1,
        "not_found": 0,
        "affected_headers": 0,
        "affected_lines": 0,
    }
    rec_a = await _record(client, headers, record_a["line_id"])
    assert rec_a["contract_no"] == "HT-WRITE"
    assert rec_a["salesperson"] == "王经理"
    assert rec_a["status"] == "已采购"


async def test_sync_contract_sign_date_is_line_level_and_only_fills_empty(client) -> None:
    """合同签订日期（平台「合同签订时间」）为物资级字段：只补空值、按追溯号逐行写。"""
    headers = await auth_headers(client, "purchase")
    motor_a = await create_purchase_plan(client, headers, "签订日期同步A", code="SIGN-A")
    record_a = await _move_plan(client, headers, int(motor_a["id"]), "TR-SIGN-A")
    motor_b = await create_purchase_plan(client, headers, "签订日期同步B", code="SIGN-B")
    record_b = await _move_plan(
        client, headers, int(motor_b["id"]), "TR-SIGN-B", contract_sign_date="2026-07-01"
    )

    # 该字段可单独作为待补全字段筛选：已填写签订日期的行不再是目标
    targets = await _targets(client, headers, fields="contract_sign_date")
    assert [item["trace_no"] for item in targets["items"]] == ["TR-SIGN-A"]

    # 整单回写（新脚本路径）：A 补空、B 的人工值不被覆盖
    result = await _apply_order(
        client,
        headers,
        "SYNC-PO",
        [
            {"trace_no": "TR-SIGN-A", "contract_sign_date": "2026-08-20"},
            {"trace_no": "TR-SIGN-B", "contract_sign_date": "2026-08-21"},
        ],
    )
    assert result == {
        "applied": 2,
        "not_found": 0,
        "affected_headers": 0,
        "affected_lines": 1,
    }

    rec_a = await _record(client, headers, record_a["line_id"])
    assert rec_a["contract_sign_date"] == "2026-08-20"
    rec_b = await _record(client, headers, record_b["line_id"])
    assert rec_b["contract_sign_date"] == "2026-07-01"

    # 幂等：再次回写同一字段不产生变更
    repeat = await _apply_trace(client, headers, "TR-SIGN-A", {"contract_sign_date": "2026-09-09"})
    assert repeat == {"affected_headers": 0, "affected_lines": 0}
    rec_a = await _record(client, headers, record_a["line_id"])
    assert rec_a["contract_sign_date"] == "2026-08-20"

    # 补全后该字段不再产生待同步目标
    targets = await _targets(client, headers, fields="contract_sign_date")
    assert targets["items"] == []


async def test_sync_order_apply_counts_unknown_trace(client) -> None:
    headers = await auth_headers(client, "purchase")
    motor = await create_purchase_plan(client, headers, "整单回写电机C", code="WRITE-C")
    record = await _move_plan(
        client, headers, int(motor["id"]), "TR-WRITE-C", purchase_order_no="PO-WRITE-C"
    )
    result = await _apply_order(
        client,
        headers,
        "PO-WRITE-C",
        [
            {"trace_no": "TR-WRITE-C", "salesperson": "孙经理"},
            {"trace_no": "NO-SUCH-TRACE", "salesperson": "路人甲"},
        ],
    )
    assert result == {
        "applied": 1,
        "not_found": 1,
        "affected_headers": 0,
        "affected_lines": 1,
    }
    rec = await _record(client, headers, record["line_id"])
    assert rec["salesperson"] == "孙经理"


async def test_sync_order_targets_and_apply_require_purchase_writer(client) -> None:
    readonly = await auth_headers(client, "readonly")
    response = await client.get(
        "/api/v1/purchase-record-sync/order-targets", headers=readonly
    )
    assert response.status_code == 403
    assert response.json()["code"] == "FORBIDDEN"

    response = await client.post(
        "/api/v1/purchase-record-sync/orders/ANY-PO/apply",
        headers=readonly,
        json={"items": [{"trace_no": "X"}]},
    )
    assert response.status_code == 403


async def test_sync_order_apply_order_not_found(client) -> None:
    headers = await auth_headers(client, "purchase")
    response = await client.post(
        "/api/v1/purchase-record-sync/orders/NO-SUCH-PO/apply",
        headers=headers,
        json={"items": [{"trace_no": "TR-X"}]},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "NOT_FOUND"
