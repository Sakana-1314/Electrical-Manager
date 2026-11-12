from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import func, select

from tests.conftest import create_stock, project_session
from tests.go_upstream import (  # noqa: F401  （go_upstream 是 fixture）
    StartUpstream,
    deliver_pending_once,
    go_upstream,
)
from tests.testkit.enums import WebhookDeliveryStatus, WebhookPlatform
from tests.testkit.models import WebhookDelivery
from tests.testkit.security import create_mini_program_registration_token


async def configure_channel(
    client: AsyncClient,
    platform: str,
    webhook_url: str,
    events: list[str],
) -> None:
    """APP_TEST_HOOKS：覆盖服务端环境变量里的一个 Webhook 渠道。"""
    response = await client.post(
        "/__test__/webhook/settings",
        json={
            "platform": platform,
            "enabled": True,
            "webhook_url": webhook_url,
            "secret": f"{platform.lower()}-secret",
            "subscribed_events": events,
        },
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_webhook_config_is_env_only(client: AsyncClient) -> None:
    """管理端不再有 Webhook 配置接口：未配置环境变量时渠道为空，事件不产生投递。"""
    async with project_session() as session:
        count = await session.scalar(select(func.count()).select_from(WebhookDelivery))
        assert count == 0


@pytest.mark.asyncio
async def test_selected_events_are_enqueued_once_and_delivered_to_both_platforms(
    client: AsyncClient, go_upstream: StartUpstream
) -> None:
    warehouse = await client.post(
        "/api/v1/auth/login", json={"username": "warehouse", "password": "123456"}
    )
    warehouse_headers = {"Authorization": f"Bearer {warehouse.json()['access_token']}"}
    await configure_channel(
        client,
        "FEISHU",
        "https://open.feishu.cn/open-apis/bot/v2/hook/feishu-token",
        [
            "stock.outbound.created",
            "stock.inbound.created",
            "mini_program.user.bound",
        ],
    )
    await configure_channel(
        client,
        "DINGTALK",
        "https://oapi.dingtalk.com/robot/send?access_token=dingtalk-token",
        ["stock.outbound.created", "mini_program.user.bound"],
    )

    material_id = await create_stock(client, warehouse_headers, "Webhook 测试物资")
    inbound_payload = {
        "client_request_id": "webhook-inbound",
        "occurred_at": "2026-07-31T08:00:00+08:00",
        "source_type": "MANUAL",
        "business_reason": "Webhook 入库测试",
        "lines": [{"stock_material_id": material_id, "quantity": "10"}],
    }
    inbound = await client.post(
        "/api/v1/inventory/inbounds", headers=warehouse_headers, json=inbound_payload
    )
    assert inbound.status_code == 201, inbound.text

    outbound_payload = {
        "client_request_id": "webhook-outbound",
        "occurred_at": "2026-07-31T09:00:00+08:00",
        "source_type": "MANUAL",
        "business_reason": "Webhook 出库测试",
        "receiver_name": "测试领用人",
        "lines": [{"stock_material_id": material_id, "quantity": "2"}],
    }
    outbound = await client.post(
        "/api/v1/inventory/outbounds", headers=warehouse_headers, json=outbound_payload
    )
    replayed = await client.post(
        "/api/v1/inventory/outbounds", headers=warehouse_headers, json=outbound_payload
    )
    assert outbound.status_code == replayed.status_code == 201
    assert outbound.json()["id"] == replayed.json()["id"]

    updated = await client.patch(
        f"/api/v1/inventory/operations/{outbound.json()['id']}",
        headers=warehouse_headers,
        json={
            "version": outbound.json()["version"],
            "operation_type": "OUTBOUND",
            "occurred_at": outbound_payload["occurred_at"],
            "source_type": "MANUAL",
            "business_reason": "管理员修改用途",
            "receiver_name": "测试领用人",
            "lines": outbound_payload["lines"],
        },
    )
    assert updated.status_code == 200, updated.text

    registration_token = create_mini_program_registration_token(
        "wx-test-primary", "webhook-new-user-openid"
    )
    profile = await client.post(
        "/api/v1/mini-program/profile",
        headers={"Authorization": f"Bearer {registration_token}"},
        json={"display_name": "Webhook 用户", "department_name": "电气车间"},
    )
    replayed_profile = await client.post(
        "/api/v1/mini-program/profile",
        headers={"Authorization": f"Bearer {registration_token}"},
        json={"display_name": "重复用户", "department_name": "重复部门"},
    )
    assert profile.status_code == replayed_profile.status_code == 200
    assert profile.json()["user"]["id"] == replayed_profile.json()["user"]["id"]

    async with project_session() as session:
        deliveries = list(
            (await session.scalars(select(WebhookDelivery).order_by(WebhookDelivery.id))).all()
        )
        assert len(deliveries) == 5
        assert [item.event_type.value for item in deliveries].count(
            "stock.inbound.created"
        ) == 1
        assert [item.event_type.value for item in deliveries].count(
            "stock.outbound.created"
        ) == 2
        assert [item.event_type.value for item in deliveries].count(
            "mini_program.user.bound"
        ) == 2
        assert {item.platform for item in deliveries} == {
            WebhookPlatform.FEISHU.value,
            WebhookPlatform.DINGTALK.value,
        }

    captured: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.host == "open.feishu.cn":
            return httpx.Response(200, json={"code": 0, "msg": "success"})
        return httpx.Response(200, json={"errcode": 0, "errmsg": "ok"})

    # 推送改投到本地桩服务，再用测试钩子逐条触发投递。
    await go_upstream("webhook", handler)
    while await deliver_pending_once(client):
        pass

    assert len(captured) == 5
    feishu_requests = [item for item in captured if item.url.host == "open.feishu.cn"]
    dingtalk_requests = [item for item in captured if item.url.host == "oapi.dingtalk.com"]
    assert len(feishu_requests) == 3
    assert len(dingtalk_requests) == 2
    feishu_body = __import__("json").loads(feishu_requests[0].content)
    assert feishu_body["msg_type"] == "text"
    assert feishu_body["timestamp"]
    assert feishu_body["sign"]
    sent_text = "\n".join(
        __import__("json").loads(item.content)["content"]["text"]
        for item in feishu_requests
    )
    assert "出库通知" in sent_text
    assert "入库通知" in sent_text
    assert "新用户绑定通知" in sent_text
    dingtalk_query = parse_qs(urlparse(str(dingtalk_requests[0].url)).query)
    assert dingtalk_query["timestamp"]
    assert dingtalk_query["sign"]

    async with project_session() as session:
        succeeded = await session.scalar(
            select(func.count())
            .select_from(WebhookDelivery)
            .where(WebhookDelivery.status == WebhookDeliveryStatus.SUCCEEDED)
        )
        assert succeeded == 5
