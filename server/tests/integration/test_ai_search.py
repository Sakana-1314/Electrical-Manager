from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest
from httpx import AsyncClient

from tests.conftest import auth_headers
from tests.go_upstream import StartUpstream, go_upstream  # noqa: F401  （go_upstream 是 fixture）
from tests.integration.test_procurement import create_purchase_plan, move_to_record

# AI 上游桩返回的内容
AI_EXPANSION_RESPONSE: dict[str, Any] = {
    "choices": [{"message": {"content": '{"expansions":[["电机","电动机"]]}'}}]
}
GLM_RESPONSE: dict[str, Any] = {
    "choices": [
        {
            "message": {
                "reasoning_content": "需要为电机补充常用规范名称。",
                "content": '输出如下：\n{"expansions":["电机","电动机"]}',
            }
        }
    ]
}


async def configure_ai(
    client: AsyncClient,
    *,
    enabled: bool = True,
    endpoint: str = "https://example.test/v1",
    api_key: str = "secret-key",
    model: str = "fast-model",
) -> None:
    """APP_TEST_HOOKS 测试钩子：覆盖服务端环境变量里的 AI 配置。"""
    response = await client.post(
        "/__test__/ai-search/settings",
        json={
            "enabled": enabled,
            "endpoint": endpoint,
            "api_key": api_key,
            "model": model,
        },
    )
    assert response.status_code == 200, response.text


@pytest.mark.asyncio
async def test_ai_status_follows_server_environment_config(client: AsyncClient) -> None:
    """AI 配置只来自服务端环境变量：未配置时状态为不可用，配置完整后立即可用。"""
    purchase = await auth_headers(client, "purchase")
    await configure_ai(client, enabled=False, endpoint="", api_key="", model="")
    disabled = await client.get("/api/v1/ai-search/status", headers=purchase)
    assert disabled.status_code == 200
    assert disabled.json() == {"available": False}

    await configure_ai(client)
    enabled = await client.get("/api/v1/ai-search/status", headers=purchase)
    assert enabled.status_code == 200
    assert enabled.json() == {"available": True}


@pytest.mark.asyncio
async def test_ai_expansion_applies_to_plans_and_records(
    client: AsyncClient, go_upstream: StartUpstream
) -> None:
    purchase = await auth_headers(client, "purchase")
    # AI 上游改投到本地桩服务。
    await go_upstream(
        "ai-search", lambda _request: httpx.Response(200, json=AI_EXPANSION_RESPONSE)
    )
    await configure_ai(client)

    expanded = await client.post(
        "/api/v1/ai-search/expand",
        headers=purchase,
        json={"value": "电机"},
    )
    assert expanded.status_code == 200, expanded.text
    assert expanded.json() == {"original": "电机", "expanded": "电机|电动机"}

    motor = await create_purchase_plan(client, purchase, "电机", code="AI-001")
    electric_motor = await create_purchase_plan(client, purchase, "电动机", code="AI-002")

    normal = await client.get(
        "/api/v1/purchase-materials", headers=purchase, params={"name": "电机"}
    )
    empowered = await client.get(
        "/api/v1/purchase-materials",
        headers=purchase,
        params={"name": "电机", "ai_expand": True},
    )
    assert {item["id"] for item in normal.json()["items"]} == {motor["id"]}
    assert {item["id"] for item in empowered.json()["items"]} == {
        motor["id"],
        electric_motor["id"],
    }

    first_record = await move_to_record(client, purchase, int(motor["id"]), "AI-R-001")
    second_record = await move_to_record(
        client, purchase, int(electric_motor["id"]), "AI-R-002"
    )
    records = await client.get(
        "/api/v1/purchase-records",
        headers=purchase,
        params={"name": "电机", "ai_expand": True},
    )
    assert {item["line_id"] for item in records.json()["items"]} == {
        first_record["line_id"],
        second_record["line_id"],
    }


@pytest.mark.asyncio
async def test_ai_response_timeout_returns_specific_bad_request(
    client: AsyncClient, go_upstream: StartUpstream
) -> None:
    admin = await auth_headers(client, "admin")

    # 桩服务迟迟不返回；实际等待缩短为 0.3 秒（文案与 details 仍按接口默认超时）。
    async def slow_handler(_request: httpx.Request) -> httpx.Response:
        await asyncio.sleep(2)
        return httpx.Response(200, json=AI_EXPANSION_RESPONSE)

    await go_upstream("ai-search", slow_handler, response_timeout_seconds=0.3)
    await configure_ai(client, model="slow-model")

    response = await client.post(
        "/api/v1/ai-search/expand",
        headers=admin,
        json={"value": "电机"},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "AI_RESPONSE_TIMEOUT"
    assert "slow-model" in response.json()["message"]
    assert "https://example.test/v1/chat/completions" in response.json()["message"]
    assert response.json()["details"]["phase"] == "response_wait"
    assert response.json()["details"]["timeout_seconds"] == 10.0


@pytest.mark.asyncio
async def test_glm_models_disable_thinking_and_request_json_output(
    client: AsyncClient, go_upstream: StartUpstream
) -> None:
    admin = await auth_headers(client, "admin")
    sent: list[dict[str, Any]] = []

    # 桩服务返回 GLM 风格的响应，并记录服务端发出的请求体。
    def glm_handler(request: httpx.Request) -> httpx.Response:
        sent.append(json.loads(request.content))
        return httpx.Response(200, json=GLM_RESPONSE)

    await go_upstream("ai-search", glm_handler)
    await configure_ai(
        client,
        endpoint="https://open.bigmodel.cn/api/paas/v4",
        model="glm-4.7-flash",
    )

    response = await client.post(
        "/api/v1/ai-search/expand", headers=admin, json={"value": "电机"}
    )
    assert response.status_code == 200, response.text
    assert response.json()["expanded"] == "电机|电动机"
    assert len(sent) == 1
    request_json = sent[0]
    assert request_json["thinking"] == {"type": "disabled"}
    assert request_json["response_format"] == {"type": "json_object"}
    assert request_json["stream"] is False
    assert request_json["messages"][0]["role"] == "system"
    assert "仅包含 1 个子数组" in request_json["messages"][0]["content"]
    assert request_json["messages"][1] == {
        "role": "user",
        "content": '{"input_terms": ["电机"]}',
    }
