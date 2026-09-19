"""小程序台账查看接口集成测试：列表搜索分页、详情字段、项目隔离与权限。

台账数据完全由管理端接口写入（小程序只读），所以这里用管理端令牌建数据、用小程序令牌读。
"""

from __future__ import annotations

from httpx import AsyncClient

from app.core.security import create_mini_program_access_token
from app.models import MiniProgramUser
from tests.conftest import SECOND_PROJECT_ID, auth_headers, project_session


async def mini_headers(display_name: str = "台账查看员") -> dict[str, str]:
    """直接造一个已启用的小程序用户并签发令牌（跳过微信登录链路）。"""
    async with project_session() as session:
        user = MiniProgramUser(display_name=display_name, enabled=True)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        user_id = user.id
    return {"Authorization": f"Bearer {create_mini_program_access_token(user_id)}"}


async def create_ledger_tag(
    client: AsyncClient, admin: dict[str, str], name: str, parent_id: int | None = None
) -> dict:
    payload: dict[str, object] = {"name": name}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    response = await client.post("/api/v1/ledger-tags", headers=admin, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def create_ledger_item(
    client: AsyncClient, admin: dict[str, str], **overrides: object
) -> dict:
    payload: dict[str, object] = {
        "name": "交流接触器",
        "model_spec": "LC1D32 AC220V",
        "quantity": 4,
        "unit_name": "台",
        "usage": "1# 回转窑主电机控制柜检修备件",
    }
    payload.update(overrides)
    response = await client.post("/api/v1/ledger-items", headers=admin, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_ledger_list_search_pagination_and_detail(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    await create_ledger_item(client, admin, name="交流接触器", model_spec="LC1D32 AC220V")
    await create_ledger_item(
        client, admin, name="熔断器芯", model_spec="RT18-32 6A", quantity=20, unit_name="个",
        subitem_no="305", usage="配电柜检修", remark="库存偏低，注意补库",
    )
    await create_ledger_item(client, admin, name="指示灯", model_spec="AD16-22DS", quantity=10, unit_name="个")

    headers = await mini_headers()

    # 全部：按创建时间倒序分页
    listing = await client.get("/api/v1/mini-program/ledger-items", headers=headers)
    assert listing.status_code == 200, listing.text
    body = listing.json()
    assert body["total"] == 3
    assert [row["name"] for row in body["items"]] == ["指示灯", "熔断器芯", "交流接触器"]
    # 列表行只带列表要用的字段，不泄漏用途 / 备注 / 标签 / 图片
    row = body["items"][0]
    assert set(row) == {"id", "name", "model_spec", "subitem_no", "quantity", "unit_name"}
    assert row["quantity"] == 10 and row["unit_name"] == "个"

    # 分页：每页 2 条，第 2 页只剩 1 条
    first_page = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"page": 1, "page_size": 2}
    )
    second_page = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"page": 2, "page_size": 2}
    )
    assert len(first_page.json()["items"]) == 2
    assert len(second_page.json()["items"]) == 1
    assert first_page.json()["total"] == second_page.json()["total"] == 3

    # 关键字：名称命中
    by_name = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"keyword": "熔断"}
    )
    assert [row["name"] for row in by_name.json()["items"]] == ["熔断器芯"]

    # 关键字：型号命中（与网页端同一份搜索口径）
    by_model = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"keyword": "AD16"}
    )
    assert [row["name"] for row in by_model.json()["items"]] == ["指示灯"]

    # 关键字：备注命中
    by_remark = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"keyword": "补库"}
    )
    assert [row["name"] for row in by_remark.json()["items"]] == ["熔断器芯"]

    # 搜不到时返回空页而不是报错
    empty = await client.get(
        "/api/v1/mini-program/ledger-items", headers=headers, params={"keyword": "不存在的物资"}
    )
    assert empty.status_code == 200
    assert empty.json()["items"] == [] and empty.json()["total"] == 0

    # 详情：补齐用途 / 备注 / 标签路径 / 图片
    target = next(row for row in body["items"] if row["name"] == "熔断器芯")
    detail = await client.get(
        f"/api/v1/mini-program/ledger-items/{target['id']}", headers=headers
    )
    assert detail.status_code == 200, detail.text
    payload = detail.json()
    assert payload["name"] == "熔断器芯"
    assert payload["model_spec"] == "RT18-32 6A"
    assert payload["subitem_no"] == "305"
    assert payload["quantity"] == 20 and payload["unit_name"] == "个"
    assert payload["usage"] == "配电柜检修"
    assert payload["remark"] == "库存偏低，注意补库"
    assert payload["tags"] == [] and payload["images"] == []


async def test_ledger_detail_carries_tag_paths_and_images(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    root = await create_ledger_tag(client, admin, "一级：电气")
    child = await create_ledger_tag(client, admin, "二级：低压电器", parent_id=root["id"])
    item = await create_ledger_item(client, admin, tag_ids=[child["id"]])

    headers = await mini_headers()
    detail = await client.get(
        f"/api/v1/mini-program/ledger-items/{item['id']}", headers=headers
    )
    assert detail.status_code == 200, detail.text
    # 标签带回完整层级路径，小程序端不用再自行拼树
    assert detail.json()["tags"] == [
        {"id": child["id"], "name": "二级：低压电器", "path": "一级：电气 / 二级：低压电器"}
    ]


async def test_ledger_detail_missing_returns_not_found(client: AsyncClient) -> None:
    headers = await mini_headers()
    response = await client.get("/api/v1/mini-program/ledger-items/999999", headers=headers)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"


async def test_ledger_list_is_project_isolated(client: AsyncClient) -> None:
    """台账按项目隔离：另一个项目看不到本项目的记录，详情也取不到。"""
    admin = await auth_headers(client, "admin")
    item = await create_ledger_item(client, admin, name="本项目台账")

    headers = await mini_headers()
    headers_other = {**headers, "X-Project-Id": str(SECOND_PROJECT_ID)}
    other_list = await client.get("/api/v1/mini-program/ledger-items", headers=headers_other)
    assert other_list.status_code == 200, other_list.text
    assert other_list.json()["items"] == [] and other_list.json()["total"] == 0

    other_detail = await client.get(
        f"/api/v1/mini-program/ledger-items/{item['id']}", headers=headers_other
    )
    assert other_detail.status_code == 400
    assert other_detail.json()["code"] == "NOT_FOUND"

    # 本项目仍能读到
    same_list = await client.get("/api/v1/mini-program/ledger-items", headers=headers)
    assert [row["name"] for row in same_list.json()["items"]] == ["本项目台账"]


async def test_ledger_endpoints_require_mini_program_token(client: AsyncClient) -> None:
    """管理端令牌不能读小程序台账端点（项目上下文与鉴权都按小程序口径）。"""
    admin = await auth_headers(client, "admin")
    response = await client.get("/api/v1/mini-program/ledger-items", headers=admin)
    assert response.status_code == 401, response.text

    anonymous = await client.get("/api/v1/mini-program/ledger-items")
    assert anonymous.status_code == 401, anonymous.text


async def test_ledger_feature_mode_defaults_to_query_only_and_round_trips(
    client: AsyncClient,
) -> None:
    """台账开关默认仅查询；超级管理员改档位后能落库并回读。"""
    features = await client.get("/api/v1/system-settings/mini-program-features")
    assert features.status_code == 200, features.text
    assert features.json()["ledger_mode"] == "query_only"

    admin = await auth_headers(client, "admin")
    # 只提交写入字段：读取结果里的 api_key / mini_program_app_ids 等是只读回显，不能原样回传
    updated = await client.put(
        "/api/v1/ai-search/settings",
        headers=admin,
        json={
            "endpoint": "",
            "api_key": "",
            "model": "",
            # 本用例只验证台账档位：模型服务停用时后端不再要求端点 / 模型 / API Key
            "enabled": False,
            "image_acceleration_server_url": "",
            "inventory_mode": "read_write",
            "huaxing_inventory_mode": "query_only",
            "purchase_plans_mode": "query_only",
            "purchase_records_mode": "query_only",
            "material_codes_mode": "query_only",
            "hazards_mode": "read_write",
            "ledger_mode": "disabled",
            "secondary_warehouse_mode": "full",
            "version": 0,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["ledger_mode"] == "disabled"

    re_read = await client.get("/api/v1/system-settings/mini-program-features")
    assert re_read.json()["ledger_mode"] == "disabled"
