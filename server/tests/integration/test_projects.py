"""项目管理接口 + 跨项目数据隔离的集成测试。"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import StockMaterial
from app.services import mini_program_service
from tests.conftest import (
    DEFAULT_PROJECT_ID,
    SECOND_PROJECT_ID,
    auth_headers,
    project_session,
)


def _headers(user_headers: dict[str, str], project_id: int) -> dict[str, str]:
    return {**user_headers, "X-Project-Id": str(project_id)}


async def test_project_list_is_readable_by_every_role(client: AsyncClient) -> None:
    readonly = await auth_headers(client, "readonly")
    response = await client.get("/api/v1/projects", headers=readonly)
    assert response.status_code == 200, response.text
    names = [item["name"] for item in response.json()]
    assert names == ["华星现有项目", "二期项目"]
    default = [item for item in response.json() if item["is_default"]]
    assert [item["name"] for item in default] == ["华星现有项目"]


async def test_project_crud_and_guards(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")

    created = await client.post(
        "/api/v1/projects",
        headers=admin,
        json={"name": "三期项目", "remark": "新项目"},
    )
    assert created.status_code == 201, created.text
    project = created.json()
    # 项目只对外显示名称；新项目默认启用、非默认项目。
    assert project["name"] == "三期项目"
    assert project["enabled"] is True
    assert project["is_default"] is False

    duplicate = await client.post(
        "/api/v1/projects", headers=admin, json={"name": "三期项目"}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_PROJECT_NAME"

    blank_name = await client.post("/api/v1/projects", headers=admin, json={"name": "   "})
    assert blank_name.status_code == 422, blank_name.text

    updated = await client.patch(
        f"/api/v1/projects/{project['id']}",
        headers=admin,
        json={"name": "三期项目（改名）", "enabled": False, "version": project["version"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "三期项目（改名）"
    assert updated.json()["enabled"] is False

    # 停用的项目不能再作为当前项目使用。
    disabled_use = await client.get(
        "/api/v1/stock-materials", headers=_headers(admin, project["id"])
    )
    assert disabled_use.status_code == 400, disabled_use.text
    assert disabled_use.json()["code"] == "PROJECT_DISABLED"

    removed = await client.delete(
        f"/api/v1/projects/{project['id']}",
        headers={**admin, "If-Match": str(updated.json()["version"])},
    )
    assert removed.status_code == 204, removed.text


async def test_project_guards_for_default_and_non_empty_project(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")

    default_disable = await client.patch(
        f"/api/v1/projects/{DEFAULT_PROJECT_ID}",
        headers=admin,
        json={"enabled": False, "version": 1},
    )
    assert default_disable.status_code == 409, default_disable.text
    assert default_disable.json()["code"] == "PROJECT_IS_DEFAULT"

    default_delete = await client.delete(
        f"/api/v1/projects/{DEFAULT_PROJECT_ID}", headers={**admin, "If-Match": "1"}
    )
    assert default_delete.status_code == 409, default_delete.text
    assert default_delete.json()["code"] == "PROJECT_IS_DEFAULT"

    # 第二个项目有业务数据后不能删除（避免连带丢数据）。
    created = await client.post(
        "/api/v1/stock-materials",
        headers=_headers(admin, SECOND_PROJECT_ID),
        json={"name": "二期物资", "model_spec": "B", "unit_name": "个", "image_ids": []},
    )
    assert created.status_code == 201, created.text
    in_use = await client.delete(
        f"/api/v1/projects/{SECOND_PROJECT_ID}", headers={**admin, "If-Match": "1"}
    )
    assert in_use.status_code == 409, in_use.text
    assert in_use.json()["code"] == "PROJECT_IN_USE"


async def test_business_request_requires_project_header(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    # fixture 给测试客户端设了默认 X-Project-Id，这里临时摘掉以模拟「没带项目」的旧客户端。
    client.headers.pop("X-Project-Id", None)
    try:
        response = await client.get("/api/v1/stock-materials", headers=admin)
    finally:
        client.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "PROJECT_REQUIRED"

    unknown = await client.get("/api/v1/stock-materials", headers=_headers(admin, 999))
    assert unknown.status_code == 400, unknown.text
    assert unknown.json()["code"] == "PROJECT_NOT_FOUND"


async def test_data_is_isolated_between_projects(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    payload = {"name": "交流接触器", "model_spec": "CJX2-2510", "unit_name": "个", "image_ids": []}

    created = await client.post(
        "/api/v1/stock-materials", headers=_headers(admin, DEFAULT_PROJECT_ID), json=payload
    )
    assert created.status_code == 201, created.text

    # 同名的物资在另一个项目可以再建一份（项目域唯一键只在项目内生效）。
    same_name = await client.post(
        "/api/v1/stock-materials", headers=_headers(admin, SECOND_PROJECT_ID), json=payload
    )
    assert same_name.status_code == 201, same_name.text

    async with project_session(DEFAULT_PROJECT_ID) as session:
        rows = list((await session.scalars(select(StockMaterial))).all())
        assert [row.name for row in rows] == ["交流接触器"]

    # 清单接口各自只看到自己项目的物资。
    for project_id, expected_total in ((DEFAULT_PROJECT_ID, 1), (SECOND_PROJECT_ID, 1)):
        listing = await client.get("/api/v1/stock-materials", headers=_headers(admin, project_id))
        assert listing.status_code == 200, listing.text
        assert listing.json()["total"] == expected_total

    # 危害面：另一个项目里看不到默认项目的物资详情（id 归属不跨项目）。
    material_id = created.json()["id"]
    other_detail = await client.get(
        f"/api/v1/stock-materials/{material_id}", headers=_headers(admin, SECOND_PROJECT_ID)
    )
    assert other_detail.status_code == 400, other_detail.text
    assert other_detail.json()["code"] == "NOT_FOUND"


async def test_memo_stays_personal_and_not_project_scoped(client: AsyncClient) -> None:
    """备忘录按用户隔离、不随项目切换（用户已确认的例外项）。"""
    admin = await auth_headers(client, "admin")
    created = await client.post(
        "/api/v1/memos",
        headers=_headers(admin, DEFAULT_PROJECT_ID),
        json={"title": "跨项目备忘录", "content": "内容"},
    )
    assert created.status_code == 201, created.text

    switched = await client.get("/api/v1/memos", headers=_headers(admin, SECOND_PROJECT_ID))
    assert switched.status_code == 200, switched.text
    titles = [item["title"] for item in switched.json()]
    assert "跨项目备忘录" in titles


async def test_share_link_reads_its_own_project_anonymously(client: AsyncClient) -> None:
    """分享链接的记录在第二个项目，匿名读取（不带项目头）也必须读到该项目的数据。"""
    purchase = await auth_headers(client, "purchase")
    created = await client.post(
        "/api/v1/purchase-materials",
        headers=_headers(purchase, SECOND_PROJECT_ID),
        json={
            "plan_date": "2026-08-05",
            "category": "备品备件",
            "name": "二期分享物资",
            "model_spec": "SHARE-1",
            "unit_name": "个",
            "planned_qty": "3",
            "usage": "分享测试",
            "actual_demand_person": "张三",
            "purchase_responsible": "李四",
        },
    )
    assert created.status_code == 201, created.text
    plan_id = created.json()["id"]

    share = await client.post(
        "/api/v1/shares",
        headers=_headers(purchase, SECOND_PROJECT_ID),
        json={"share_type": "purchase_plan", "item_ids": [plan_id], "expires_in": "24h"},
    )
    assert share.status_code == 201, share.text
    token = share.json()["token"]

    # 匿名读取：摘掉客户端的默认项目头（真实分享页不会带）。
    client.headers.pop("X-Project-Id", None)
    try:
        view = await client.get(f"/api/v1/shares/{token}")
    finally:
        client.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
    assert view.status_code == 200, view.text
    payload = view.json()
    assert payload["item_count"] == 1
    assert [item["name"] for item in payload["items"]] == ["二期分享物资"]


async def test_mini_program_follows_project_header(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """小程序不带项目头时落默认项目，带头时按头读写该项目的数据。"""
    async def fake_exchange(code: str, app_id: str | None = None) -> tuple[str, str]:
        return app_id or "wx-test-primary", f"openid-{code}"

    monkeypatch.setattr(mini_program_service, "exchange_wechat_code", fake_exchange)

    login = await client.post("/api/v1/mini-program/auth/wx-login", json={"code": "project-test"})
    profile = await client.post(
        "/api/v1/mini-program/profile",
        headers={"Authorization": f"Bearer {login.json()['registration_token']}"},
        json={"display_name": "项目切换测试", "department_name": "华星检修维护部电气车间"},
    )
    mini_headers = {"Authorization": f"Bearer {profile.json()['access_token']}"}

    # 项目列表对小程序可读，只给名称（排序：默认项目在前）。
    projects = await client.get("/api/v1/mini-program/projects", headers=mini_headers)
    assert projects.status_code == 200, projects.text
    assert [item["name"] for item in projects.json()] == ["华星现有项目", "二期项目"]

    admin = await auth_headers(client, "admin")
    for project_id, name in ((DEFAULT_PROJECT_ID, "默认物资"), (SECOND_PROJECT_ID, "二期物资")):
        created = await client.post(
            "/api/v1/stock-materials",
            headers=_headers(admin, project_id),
            json={"name": name, "model_spec": "M", "unit_name": "个", "image_ids": []},
        )
        assert created.status_code == 201, created.text

    # 不带项目头（旧客户端）：落默认项目，只看到默认项目的物资。
    client.headers.pop("X-Project-Id", None)
    try:
        default_view = await client.get("/api/v1/mini-program/inventory", headers=mini_headers)
    finally:
        client.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
    assert default_view.status_code == 200, default_view.text
    assert [item["name"] for item in default_view.json()["items"]] == ["默认物资"]

    # 带第二个项目头：切换后只看得到该项目的物资。
    switched = await client.get(
        "/api/v1/mini-program/inventory", headers=_headers(mini_headers, SECOND_PROJECT_ID)
    )
    assert switched.status_code == 200, switched.text
    assert [item["name"] for item in switched.json()["items"]] == ["二期物资"]

    # 项目已停用时明确报错，小程序据此清掉本地项目并回落默认项目。
    admin_headers = {**admin}
    disabled = await client.patch(
        f"/api/v1/projects/{SECOND_PROJECT_ID}",
        headers=admin_headers,
        json={"enabled": False, "version": 1},
    )
    assert disabled.status_code == 200, disabled.text
    rejected = await client.get(
        "/api/v1/mini-program/inventory", headers=_headers(mini_headers, SECOND_PROJECT_ID)
    )
    assert rejected.status_code == 400, rejected.text
    assert rejected.json()["code"] == "PROJECT_DISABLED"
