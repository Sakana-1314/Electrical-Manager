"""隐患管理接口集成测试：台账 CRUD、筛选统计、字典维护、权限与引用保护。"""

from __future__ import annotations

import base64
from datetime import date, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.constants import SHANGHAI
from tests.conftest import auth_headers


async def create_unit(
    client: AsyncClient, headers: dict[str, str], name: str = "电气车间", person: str = "张三"
) -> dict:
    response = await client.post(
        "/api/v1/hazard-units", headers=headers, json={"name": name, "person": person}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_type(
    client: AsyncClient, headers: dict[str, str], major: str = "电气设备", minor: str = "绝缘破损"
) -> dict:
    response = await client.post(
        "/api/v1/hazard-types", headers=headers, json={"major": major, "minor": minor}
    )
    assert response.status_code == 201, response.text
    return response.json()


async def create_hazard(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    unit_id: int,
    type_id: int,
    **overrides: object,
) -> dict:
    payload: dict[str, object] = {
        "description": "3 号配电柜进线电缆绝缘层破损",
        "hazard_unit_id": unit_id,
        "hazard_type_id": type_id,
    }
    payload.update(overrides)
    response = await client.post("/api/v1/hazards", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def today() -> date:
    return datetime.now(SHANGHAI).date()


async def test_create_hazard_applies_defaults_and_unit_person(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers, person="李建军")
    hazard_type = await create_type(client, headers)

    created = await create_hazard(client, headers, unit_id=unit["id"], type_id=hazard_type["id"])

    assert created["inspection_area"] == "华星现场"
    assert created["inspector"] == "电气自查"
    assert created["inspection_date"] == today().isoformat()
    # 要求完成时间缺省 = 检查日期 + 7 天
    assert created["due_date"] == (today() + timedelta(days=7)).isoformat()
    # 复查人员缺省同检查人员
    assert created["recheck_person"] == "电气自查"
    assert created["rectify_person"] is None
    # 责任人取自责任单位快照
    assert created["person"] == "李建军"
    assert created["hazard_unit_name"] == "电气车间"
    assert created["major"] == "电气设备"
    assert created["minor"] == "绝缘破损"
    assert created["status"] == "待整改"
    assert created["level"] == "一般隐患"
    assert created["version"] == 1
    assert created["before_images"] == []
    assert created["after_images"] == []


async def test_create_hazard_with_custom_defaults_and_explicit_dates(
    client: AsyncClient,
) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)

    created = await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=hazard_type["id"],
        inspection_area="201-冶炼主厂房",
        inspection_date="2026-09-01",
        inspector="王海涛",
        due_date="2026-09-10",
        recheck_person="陈志远",
        rectify_person="刘振华",
        level="重大隐患",
        suggestion="更换电缆并做绝缘测试",
        remark="已上报车间",
    )

    assert created["inspection_area"] == "201-冶炼主厂房"
    assert created["inspection_date"] == "2026-09-01"
    assert created["inspector"] == "王海涛"
    # 显式给了要求完成时间就不再按 +7 天推算
    assert created["due_date"] == "2026-09-10"
    assert created["recheck_person"] == "陈志远"
    assert created["rectify_person"] == "刘振华"
    assert created["level"] == "重大隐患"


async def test_create_hazard_rejects_unknown_unit_and_type(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)

    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={"description": "x", "hazard_unit_id": 9999, "hazard_type_id": hazard_type["id"]},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"

    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={"description": "x", "hazard_unit_id": unit["id"], "hazard_type_id": 9999},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"


async def test_update_hazard_keeps_person_snapshot_until_unit_changes(
    client: AsyncClient,
) -> None:
    headers = await auth_headers(client, "hazard")
    unit_a = await create_unit(client, headers, name="电气车间", person="张三")
    unit_b = await create_unit(client, headers, name="动力车间", person="李四")
    hazard_type = await create_type(client, headers)
    created = await create_hazard(
        client, headers, unit_id=unit_a["id"], type_id=hazard_type["id"], rectify_person="王五"
    )

    # 单位换了责任人，已有隐患仍保留登记时的快照
    response = await client.patch(
        f"/api/v1/hazard-units/{unit_a['id']}",
        headers=headers,
        json={"person": "赵六", "version": unit_a["version"]},
    )
    assert response.status_code == 200, response.text
    detail = await client.get(f"/api/v1/hazards/{created['id']}", headers=headers)
    assert detail.json()["person"] == "张三"

    response = await client.patch(
        f"/api/v1/hazards/{created['id']}",
        headers=headers,
        json={"status": "已整改", "remark": "已完成整改并复查", "version": created["version"]},
    )
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated["status"] == "已整改"
    assert updated["person"] == "张三"
    assert updated["rectify_person"] == "王五"
    assert updated["version"] == created["version"] + 1

    # 换责任单位时才重新快照责任人
    response = await client.patch(
        f"/api/v1/hazards/{created['id']}",
        headers=headers,
        json={"hazard_unit_id": unit_b["id"], "version": updated["version"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["person"] == "李四"
    assert response.json()["hazard_unit_name"] == "动力车间"


async def test_update_hazard_rejects_stale_version(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)
    created = await create_hazard(client, headers, unit_id=unit["id"], type_id=hazard_type["id"])

    response = await client.patch(
        f"/api/v1/hazards/{created['id']}",
        headers=headers,
        json={"description": "改一次", "version": created["version"]},
    )
    assert response.status_code == 200, response.text

    response = await client.patch(
        f"/api/v1/hazards/{created['id']}",
        headers=headers,
        json={"description": "再改一次", "version": created["version"]},
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "VERSION_CONFLICT"


async def test_list_hazards_filters_and_pagination(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    type_a = await create_type(client, headers, major="电气设备", minor="线路老化")
    type_b = await create_type(client, headers, major="安全防护", minor="警示标识缺失")
    await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=type_a["id"],
        description="配电柜线路老化",
        inspection_area="201-冶炼主厂房",
    )
    await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=type_b["id"],
        description="护栏警示标识缺失",
        inspection_area="301-选矿厂",
        level="重大隐患",
        status="整改受阻",
    )

    response = await client.get("/api/v1/hazards", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["total"] == 2
    assert body["page"] == 1
    # 创建时间倒序：后创建的排在前面
    assert [item["major"] for item in body["items"]] == ["安全防护", "电气设备"]

    by_level = await client.get("/api/v1/hazards", headers=headers, params={"level": "重大隐患"})
    assert by_level.json()["total"] == 1
    assert by_level.json()["items"][0]["minor"] == "警示标识缺失"

    by_status = await client.get("/api/v1/hazards", headers=headers, params={"status": "整改受阻"})
    assert by_status.json()["total"] == 1

    by_type = await client.get(
        "/api/v1/hazards", headers=headers, params={"hazard_type_id": type_a["id"]}
    )
    assert by_type.json()["total"] == 1
    assert by_type.json()["items"][0]["description"] == "配电柜线路老化"

    by_unit = await client.get(
        "/api/v1/hazards", headers=headers, params={"hazard_unit_id": unit["id"]}
    )
    assert by_unit.json()["total"] == 2

    assert (
        await client.get("/api/v1/hazards", headers=headers, params={"area": "选矿"})
    ).json()["total"] == 1
    assert (
        await client.get("/api/v1/hazards", headers=headers, params={"keyword": "护栏"})
    ).json()["total"] == 1
    # 关键字同时匹配责任人/检查人员
    assert (
        await client.get("/api/v1/hazards", headers=headers, params={"keyword": "张三"})
    ).json()["total"] == 2

    by_date = await client.get(
        "/api/v1/hazards",
        headers=headers,
        params={"date_from": (today() + timedelta(days=1)).isoformat()},
    )
    assert by_date.json()["total"] == 0

    paged = await client.get(
        "/api/v1/hazards", headers=headers, params={"page": 2, "page_size": 1}
    )
    assert paged.json()["total"] == 2
    assert len(paged.json()["items"]) == 1


async def test_hazard_stats_counts_and_overdue(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)
    await create_hazard(client, headers, unit_id=unit["id"], type_id=hazard_type["id"])
    await create_hazard(
        client, headers, unit_id=unit["id"], type_id=hazard_type["id"], status="整改受阻"
    )
    await create_hazard(
        client, headers, unit_id=unit["id"], type_id=hazard_type["id"], status="已整改"
    )
    # 昨天到期且未整改 → 计入逾期
    await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=hazard_type["id"],
        due_date=(today() - timedelta(days=1)).isoformat(),
    )
    # 今天到期（严格早于今天才算逾期）→ 不计入逾期
    await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=hazard_type["id"],
        due_date=today().isoformat(),
    )
    # 昨天到期但已整改 → 不计入逾期
    await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=hazard_type["id"],
        status="已整改",
        due_date=(today() - timedelta(days=1)).isoformat(),
    )

    response = await client.get("/api/v1/hazards/stats", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json() == {"pending": 3, "blocked": 1, "done": 2, "overdue": 1}


async def test_hazard_images_round_trip_and_reference_guard(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)
    uploaded = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("hazard.png", _png_bytes(), "image/png")},
    )
    assert uploaded.status_code == 201, uploaded.text
    file_id = uploaded.json()["id"]

    created = await create_hazard(
        client,
        headers,
        unit_id=unit["id"],
        type_id=hazard_type["id"],
        before_image_ids=[file_id],
    )
    assert [image["id"] for image in created["before_images"]] == [file_id]
    assert created["after_images"] == []

    # 附件管理把隐患引用计入：被引用时不允许删除
    attachments = await client.get(
        "/api/v1/files/images/attachments",
        headers=await auth_headers(client, "admin"),
        params={"keyword": uploaded.json()["original_name"]},
    )
    assert attachments.status_code == 200, attachments.text
    assert attachments.json()["items"][0]["reference_count"] == 1

    response = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "FILE_IN_USE"

    # 清空整改前图片后即可删除
    response = await client.patch(
        f"/api/v1/hazards/{created['id']}",
        headers=headers,
        json={"before_image_ids": [], "version": created["version"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["before_images"] == []
    response = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert response.status_code == 200, response.text


async def test_hazard_write_permissions(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    unit = await create_unit(client, admin)
    hazard_type = await create_type(client, admin)

    readonly = await auth_headers(client, "readonly")
    # 只读角色可以查看列表、统计与字典
    assert (await client.get("/api/v1/hazards", headers=readonly)).status_code == 200
    assert (await client.get("/api/v1/hazards/stats", headers=readonly)).status_code == 200
    assert (await client.get("/api/v1/hazard-units", headers=readonly)).status_code == 200
    assert (await client.get("/api/v1/hazard-types", headers=readonly)).status_code == 200
    # 但不能写
    response = await client.post(
        "/api/v1/hazards",
        headers=readonly,
        json={
            "description": "x",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
        },
    )
    assert response.status_code == 403, response.text
    assert response.json()["code"] == "FORBIDDEN"

    warehouse = await auth_headers(client, "warehouse")
    response = await client.post(
        "/api/v1/hazard-types", headers=warehouse, json={"major": "x", "minor": "y"}
    )
    assert response.status_code == 403, response.text

    # 隐患管理员可增删改
    hazard = await auth_headers(client, "hazard")
    created = await create_hazard(client, hazard, unit_id=unit["id"], type_id=hazard_type["id"])
    response = await client.delete(
        f"/api/v1/hazards/{created['id']}",
        headers={**hazard, "If-Match": str(created["version"])},
    )
    assert response.status_code == 204, response.text
    assert (await client.get(f"/api/v1/hazards/{created['id']}", headers=hazard)).status_code == 400


async def test_hazard_unit_crud_and_reference_guard(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)

    duplicate = await client.post(
        "/api/v1/hazard-units", headers=headers, json={"name": "电气车间", "person": "张三"}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_HAZARD_UNIT"

    response = await client.patch(
        f"/api/v1/hazard-units/{unit['id']}",
        headers=headers,
        json={"enabled": False, "version": unit["version"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["enabled"] is False
    disabled_version = response.json()["version"]

    disabled = await client.get("/api/v1/hazard-units", headers=headers, params={"enabled": False})
    assert [item["id"] for item in disabled.json()] == [unit["id"]]
    enabled = await client.get("/api/v1/hazard-units", headers=headers, params={"enabled": True})
    assert enabled.json() == []

    # 停用单位仍可被历史隐患引用
    hazard_type = await create_type(client, headers)
    await create_hazard(client, headers, unit_id=unit["id"], type_id=hazard_type["id"])

    response = await client.delete(
        f"/api/v1/hazard-units/{unit['id']}",
        headers={**headers, "If-Match": str(disabled_version)},
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "HAZARD_UNIT_IN_USE"

    # 未被引用的单位可以删除
    spare = await create_unit(client, headers, name="自动化班组", person="王五")
    response = await client.delete(
        f"/api/v1/hazard-units/{spare['id']}",
        headers={**headers, "If-Match": str(spare["version"])},
    )
    assert response.status_code == 204, response.text


async def test_hazard_type_crud_and_reference_guard(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    hazard_type = await create_type(client, headers)

    duplicate = await client.post(
        "/api/v1/hazard-types", headers=headers, json={"major": "电气设备", "minor": "绝缘破损"}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_HAZARD_TYPE"

    # 同一大类下的不同小类可以共存
    same_major = await create_type(client, headers, minor="接线不规范")
    assert same_major["major"] == "电气设备"

    response = await client.patch(
        f"/api/v1/hazard-types/{hazard_type['id']}",
        headers=headers,
        json={"minor": "绝缘老化", "version": hazard_type["version"]},
    )
    assert response.status_code == 200, response.text
    assert response.json()["minor"] == "绝缘老化"
    renamed_version = response.json()["version"]

    # 改成与已有组合重复 → 409
    response = await client.patch(
        f"/api/v1/hazard-types/{hazard_type['id']}",
        headers=headers,
        json={"minor": "接线不规范", "version": renamed_version},
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "DUPLICATE_HAZARD_TYPE"

    # 被隐患引用的类型允许改名，但不允许删除
    unit = await create_unit(client, headers)
    await create_hazard(client, headers, unit_id=unit["id"], type_id=hazard_type["id"])
    response = await client.delete(
        f"/api/v1/hazard-types/{hazard_type['id']}",
        headers={**headers, "If-Match": str(renamed_version)},
    )
    assert response.status_code == 409, response.text
    assert response.json()["code"] == "HAZARD_TYPE_IN_USE"

    response = await client.delete(
        f"/api/v1/hazard-types/{same_major['id']}",
        headers={**headers, "If-Match": str(same_major["version"])},
    )
    assert response.status_code == 204, response.text

    # 类型列表按 大类 / 小类 排序
    remaining = await client.get("/api/v1/hazard-types", headers=headers)
    assert [item["minor"] for item in remaining.json()] == ["绝缘老化"]


async def test_hazard_not_found_uses_business_error_code(client: AsyncClient) -> None:
    headers = await auth_headers(client, "hazard")
    response = await client.get("/api/v1/hazards/9999", headers=headers)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"

    response = await client.delete("/api/v1/hazards/9999", headers=headers)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"

    # 责任单位 / 隐患类型没有单条 GET，用 PATCH 校验不存在时的业务错误码
    response = await client.patch(
        "/api/v1/hazard-units/9999", headers=headers, json={"person": "张三", "version": 1}
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"

    response = await client.patch(
        "/api/v1/hazard-types/9999", headers=headers, json={"minor": "x", "version": 1}
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("status", "已关闭"),
        ("level", "特大隐患"),
    ],
)
async def test_hazard_rejects_unknown_enum(client: AsyncClient, field: str, value: str) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)
    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={
            "description": "x",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
            field: value,
        },
    )
    assert response.status_code == 422, response.text


async def test_hazard_rejects_blank_description_and_too_many_images(
    client: AsyncClient,
) -> None:
    headers = await auth_headers(client, "hazard")
    unit = await create_unit(client, headers)
    hazard_type = await create_type(client, headers)

    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={
            "description": "   ",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
        },
    )
    assert response.status_code == 422, response.text

    # 每侧最多 9 张：同一 id 重复也会被拒（去重校验）
    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={
            "description": "x",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
            "before_image_ids": [FILE_ID] * 2,
        },
    )
    assert response.status_code == 422, response.text

    # 图片不存在 → 400 INVALID_IMAGE_ID
    response = await client.post(
        "/api/v1/hazards",
        headers=headers,
        json={
            "description": "x",
            "hazard_unit_id": unit["id"],
            "hazard_type_id": hazard_type["id"],
            "before_image_ids": [FILE_ID],
        },
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "INVALID_IMAGE_ID"


FILE_ID = "01900000-0000-7000-8000-000000000001"


def _png_bytes() -> bytes:
    """最小合法 PNG（1x1 透明），供上传接口测试用。"""
    return base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7gAAAABJRU5ErkJggg=="
    )
