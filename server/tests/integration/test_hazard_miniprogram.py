"""小程序隐患管理接口集成测试：筛选搜索、登记幂等、整改跟进与图片上传。"""

from __future__ import annotations

import base64
from datetime import date, datetime, timedelta

from httpx import AsyncClient

from app.core.constants import SHANGHAI
from app.core.security import create_mini_program_access_token
from app.models import MiniProgramUser
from tests.conftest import auth_headers, project_session


def today() -> date:
    return datetime.now(SHANGHAI).date()


async def mini_headers(display_name: str = "隐患巡检员") -> dict[str, str]:
    """直接造一个已启用的小程序用户并签发令牌（跳过微信登录链路）。"""
    async with project_session() as session:
        user = MiniProgramUser(display_name=display_name, enabled=True)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        user_id = user.id
    return {"Authorization": f"Bearer {create_mini_program_access_token(user_id)}"}


async def setup_dictionaries(client: AsyncClient, admin: dict[str, str]) -> tuple[dict, dict, dict]:
    """建两个责任单位（其中一个停用）与两个隐患类型。"""
    unit = await client.post(
        "/api/v1/hazard-units",
        headers=admin,
        json={"name": "电气车间", "person": "李建军"},
    )
    disabled_unit = await client.post(
        "/api/v1/hazard-units",
        headers=admin,
        json={"name": "停用单位", "person": "张三", "enabled": False},
    )
    hazard_type = await client.post(
        "/api/v1/hazard-types",
        headers=admin,
        json={"major": "电气设备", "minor": "绝缘破损"},
    )
    assert unit.status_code == disabled_unit.status_code == hazard_type.status_code == 201
    return unit.json(), disabled_unit.json(), hazard_type.json()


async def create_hazard(
    client: AsyncClient, headers: dict[str, str], unit_id: int, type_id: int, **overrides: object
) -> dict:
    payload: dict[str, object] = {
        "description": "3 号配电柜电缆绝缘破损",
        "hazard_unit_id": unit_id,
        "hazard_type_id": type_id,
    }
    payload.update(overrides)
    response = await client.post("/api/v1/hazards", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_mini_program_hazard_list_search_and_filters(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    unit, _, hazard_type = await setup_dictionaries(client, admin)
    await create_hazard(
        client,
        admin,
        unit["id"],
        hazard_type["id"],
        description="配电柜电缆绝缘破损",
        inspection_area="201-冶炼主厂房",
        rectify_person="孙浩宇",
    )
    await create_hazard(
        client,
        admin,
        unit["id"],
        hazard_type["id"],
        description="护栏警示标识缺失",
        inspection_area="301-选矿厂",
        status="已整改",
        rectify_person="周立新",
    )
    # 这条只有「检查人员/责任人」含关键字，用来验证小程序搜索不匹配这些字段
    await create_hazard(
        client,
        admin,
        unit["id"],
        hazard_type["id"],
        description="现场照明不足",
        inspection_area="401-公辅设施",
        inspector="王海涛",
        remark="待备件到货后处理",
    )

    headers = await mini_headers()

    all_rows = await client.get("/api/v1/mini-program/hazards", headers=headers)
    assert all_rows.status_code == 200, all_rows.text
    assert all_rows.json()["total"] == 3

    # 搜索命中「检查区域」
    by_area = await client.get(
        "/api/v1/mini-program/hazards", headers=headers, params={"keyword": "选矿"}
    )
    assert by_area.json()["total"] == 1
    assert by_area.json()["items"][0]["inspection_area"] == "301-选矿厂"

    # 搜索命中「隐患描述」
    by_description = await client.get(
        "/api/v1/mini-program/hazards", headers=headers, params={"keyword": "绝缘破损"}
    )
    assert by_description.json()["total"] == 1

    # 搜索不匹配检查人员与备注（小程序搜索范围只有区域 + 描述）
    for keyword in ("王海涛", "备件到货"):
        hit = await client.get(
            "/api/v1/mini-program/hazards", headers=headers, params={"keyword": keyword}
        )
        assert hit.json()["total"] == 0, keyword

    # 按整改状态筛选
    by_status = await client.get(
        "/api/v1/mini-program/hazards", headers=headers, params={"status": "已整改"}
    )
    assert by_status.json()["total"] == 1
    assert by_status.json()["items"][0]["status"] == "已整改"

    # 按整改员工筛选
    by_person = await client.get(
        "/api/v1/mini-program/hazards", headers=headers, params={"rectify_person": "孙浩宇"}
    )
    assert by_person.json()["total"] == 1
    assert by_person.json()["items"][0]["rectify_person"] == "孙浩宇"

    # 组合筛选
    combined = await client.get(
        "/api/v1/mini-program/hazards",
        headers=headers,
        params={"keyword": "选矿", "rectify_person": "孙浩宇"},
    )
    assert combined.json()["total"] == 0


async def test_mini_program_hazard_options(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    unit, disabled_unit, hazard_type = await setup_dictionaries(client, admin)
    await create_hazard(client, admin, unit["id"], hazard_type["id"], rectify_person="孙浩宇")
    await create_hazard(client, admin, unit["id"], hazard_type["id"], rectify_person="周立新")
    await create_hazard(client, admin, unit["id"], hazard_type["id"], rectify_person="孙浩宇")

    headers = await mini_headers()

    filters = await client.get("/api/v1/mini-program/hazards/filter-options", headers=headers)
    assert filters.status_code == 200, filters.text
    assert filters.json()["rectify_persons"] == ["周立新", "孙浩宇"]

    form = await client.get("/api/v1/mini-program/hazards/form-options", headers=headers)
    assert form.status_code == 200, form.text
    # 登记下拉只列启用中的单位
    assert [item["id"] for item in form.json()["units"]] == [unit["id"]]
    assert disabled_unit["id"] not in [item["id"] for item in form.json()["units"]]
    assert [item["minor"] for item in form.json()["types"]] == ["绝缘破损"]


async def test_mini_program_register_hazard_defaults_and_idempotency(
    client: AsyncClient,
) -> None:
    admin = await auth_headers(client, "admin")
    unit, _, hazard_type = await setup_dictionaries(client, admin)
    headers = await mini_headers(display_name="陈志远")

    payload = {
        "client_request_id": "mp-1700000000000-abcdef12",
        "description": "巡检发现接线盒进水",
        "hazard_unit_id": unit["id"],
        "hazard_type_id": hazard_type["id"],
    }
    created = await client.post("/api/v1/mini-program/hazards", headers=headers, json=payload)
    assert created.status_code == 201, created.text
    body = created.json()
    # 检查人员缺省为当前小程序用户姓名，责任人仍是单位快照
    assert body["inspector"] == "陈志远"
    assert body["person"] == "李建军"
    assert body["recheck_person"] == "陈志远"
    assert body["inspection_area"] == "华星现场"
    assert body["inspection_date"] == today().isoformat()
    assert body["due_date"] == (today() + timedelta(days=7)).isoformat()
    assert body["status"] == "待整改"

    # 同一幂等键重复提交：返回同一条记录，不新增
    replayed = await client.post("/api/v1/mini-program/hazards", headers=headers, json=payload)
    assert replayed.status_code == 201, replayed.text
    assert replayed.json()["id"] == body["id"]

    listed = await client.get("/api/v1/mini-program/hazards", headers=headers)
    assert listed.json()["total"] == 1


async def test_mini_program_follow_up_hazard_with_images(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    unit, _, hazard_type = await setup_dictionaries(client, admin)
    headers = await mini_headers(display_name="孙浩宇")

    async def upload(name: str) -> str:
        response = await client.post(
            "/api/v1/mini-program/hazards/images",
            headers=headers,
            files={"file": (name, _png_bytes(), "image/png")},
        )
        assert response.status_code == 201, response.text
        return response.json()["id"]

    before_id = await upload("hazard-before.png")
    after_id = await upload("hazard-after.png")

    created = await client.post(
        "/api/v1/mini-program/hazards",
        headers=headers,
        json={
            "client_request_id": "mp-1700000000001-abcdef12",
            "description": "配电室门口警示标识缺失",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
            "before_image_ids": [before_id],
        },
    )
    assert created.status_code == 201, created.text
    hazard = created.json()
    assert [image["id"] for image in hazard["before_images"]] == [before_id]

    # 详情可读
    detail = await client.get(f"/api/v1/mini-program/hazards/{hazard['id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["description"] == "配电室门口警示标识缺失"

    # 跟进整改：状态 + 整改员工 + 整改后图片
    updated = await client.patch(
        f"/api/v1/mini-program/hazards/{hazard['id']}",
        headers=headers,
        json={
            "status": "已整改",
            "rectify_person": "孙浩宇",
            "after_image_ids": [after_id],
            "remark": "标识已重新张贴",
            "version": hazard["version"],
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["status"] == "已整改"
    assert body["rectify_person"] == "孙浩宇"
    assert body["remark"] == "标识已重新张贴"
    assert [image["id"] for image in body["after_images"]] == [after_id]
    assert body["version"] == hazard["version"] + 1

    # 旧版本号再提交：乐观锁拒绝
    stale = await client.patch(
        f"/api/v1/mini-program/hazards/{hazard['id']}",
        headers=headers,
        json={"status": "待整改", "version": hazard["version"]},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"

    # 被隐患引用的图片不允许删除（与网页端同一套附件规则）
    delete_image = await client.delete(
        f"/api/v1/files/images/{before_id}", headers=admin
    )
    assert delete_image.status_code == 409, delete_image.text
    assert delete_image.json()["code"] == "FILE_IN_USE"


async def test_mini_program_hazard_identity_isolation(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    await setup_dictionaries(client, admin)
    headers = await mini_headers()

    # 管理端令牌不能访问小程序接口
    management_on_mini = await client.get("/api/v1/mini-program/hazards", headers=admin)
    assert management_on_mini.status_code == 401, management_on_mini.text

    # 小程序令牌不能访问管理端隐患接口
    mini_on_management = await client.get("/api/v1/hazards", headers=headers)
    assert mini_on_management.status_code == 401, mini_on_management.text

    # 未启用的小程序用户被拒（账号待审核）
    async with project_session() as session:
        disabled = MiniProgramUser(display_name="待审核用户", enabled=False)
        session.add(disabled)
        await session.commit()
        await session.refresh(disabled)
        disabled_id = disabled.id
    disabled_headers = {
        "Authorization": f"Bearer {create_mini_program_access_token(disabled_id)}"
    }
    blocked = await client.get("/api/v1/mini-program/hazards", headers=disabled_headers)
    assert blocked.status_code == 403, blocked.text
    assert blocked.json()["code"] == "ACCOUNT_DISABLED"


async def test_web_hazard_rectify_person_filter_and_options(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    unit, _, hazard_type = await setup_dictionaries(client, admin)
    await create_hazard(client, admin, unit["id"], hazard_type["id"], rectify_person="孙浩宇")
    await create_hazard(client, admin, unit["id"], hazard_type["id"], rectify_person="周立新")
    await create_hazard(client, admin, unit["id"], hazard_type["id"])

    options = await client.get("/api/v1/hazards/filter-options", headers=admin)
    assert options.status_code == 200, options.text
    assert options.json()["rectify_persons"] == ["周立新", "孙浩宇"]

    filtered = await client.get(
        "/api/v1/hazards", headers=admin, params={"rectify_person": "周立新"}
    )
    assert filtered.status_code == 200, filtered.text
    assert filtered.json()["total"] == 1
    assert filtered.json()["items"][0]["rectify_person"] == "周立新"


async def test_mini_program_register_requires_existing_unit_and_type(
    client: AsyncClient,
) -> None:
    admin = await auth_headers(client, "admin")
    unit, _, hazard_type = await setup_dictionaries(client, admin)
    headers = await mini_headers()

    missing_unit = await client.post(
        "/api/v1/mini-program/hazards",
        headers=headers,
        json={
            "client_request_id": "mp-1700000000002-abcdef12",
            "description": "x",
            "hazard_unit_id": 9999,
            "hazard_type_id": hazard_type["id"],
        },
    )
    assert missing_unit.status_code == 400, missing_unit.text
    assert missing_unit.json()["code"] == "NOT_FOUND"

    missing_type = await client.post(
        "/api/v1/mini-program/hazards",
        headers=headers,
        json={
            "client_request_id": "mp-1700000000003-abcdef12",
            "description": "x",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": 9999,
        },
    )
    assert missing_type.status_code == 400, missing_type.text
    assert missing_type.json()["code"] == "NOT_FOUND"


def _png_bytes() -> bytes:
    """最小合法 PNG（1x1 透明）。"""
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7gAAAABJRU5ErkJggg=="
    )
