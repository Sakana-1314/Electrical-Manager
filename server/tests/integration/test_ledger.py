"""台账管理接口集成测试：标签树（层级 / 重名 / 引用保护）、台账 CRUD、筛选、权限与图片引用。"""

from __future__ import annotations

import io
from typing import Any

from httpx import AsyncClient
from PIL import Image

from tests.conftest import auth_headers


async def upload_png(
    client: AsyncClient, headers: dict[str, str], *, color: str = "skyblue"
) -> str:
    source = io.BytesIO()
    Image.new("RGB", (16, 12), color).save(source, format="PNG")
    response = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("ledger.png", source.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def create_tag(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str,
    parent_id: int | None = None,
    remark: str | None = None,
    image_ids: list[str] | None = None,
) -> dict:
    payload: dict[str, object] = {"name": name}
    if parent_id is not None:
        payload["parent_id"] = parent_id
    if remark is not None:
        payload["remark"] = remark
    if image_ids is not None:
        payload["image_ids"] = image_ids
    response = await client.post("/api/v1/ledger-tags", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def create_item(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "1# 回转窑主电机",
    model_spec: str = "YVFE3-315L1-4",
    unit_name: str = "台",
    usage: str = "窑尾收尘系统备机",
    **overrides: object,
) -> dict:
    payload: dict[str, object] = {
        "name": name,
        "model_spec": model_spec,
        "unit_name": unit_name,
        "usage": usage,
    }
    payload.update(overrides)
    response = await client.post("/api/v1/ledger-items", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_tag_tree_keeps_three_levels_and_rejects_the_fourth(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    child = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    leaf = await create_tag(client, headers, name="抽屉柜", parent_id=child["id"])

    assert (root["level"], child["level"], leaf["level"]) == (1, 2, 3)
    assert root["parent_id"] is None and child["parent_id"] == root["id"]
    # 父节点的子节点数用于页面展示与「还能不能加子标签」判断
    assert (await client.get("/api/v1/ledger-tags", headers=headers)).json()[:1] == [
        {**root, "child_count": 1}
    ]

    too_deep = await client.post(
        "/api/v1/ledger-tags",
        headers=headers,
        json={"name": "第四层", "parent_id": leaf["id"]},
    )
    assert too_deep.status_code == 400, too_deep.text
    assert too_deep.json()["code"] == "LEDGER_TAG_MAX_LEVEL"


async def test_tag_duplicate_name_checks_the_same_parent_only(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    other_root = await create_tag(client, headers, name="电动机")
    await create_tag(client, headers, name="低压柜", parent_id=root["id"])

    duplicate_root = await client.post(
        "/api/v1/ledger-tags", headers=headers, json={"name": "配电柜"}
    )
    assert duplicate_root.status_code == 409, duplicate_root.text
    assert duplicate_root.json()["code"] == "DUPLICATE_LEDGER_TAG"

    duplicate_sibling = await client.post(
        "/api/v1/ledger-tags", headers=headers, json={"name": "低压柜", "parent_id": root["id"]}
    )
    assert duplicate_sibling.status_code == 409, duplicate_sibling.text
    assert duplicate_sibling.json()["code"] == "DUPLICATE_LEDGER_TAG"

    # 不同父节点下可以同名
    same_name_elsewhere = await create_tag(
        client, headers, name="低压柜", parent_id=other_root["id"]
    )
    assert same_name_elsewhere["parent_id"] == other_root["id"]


async def test_tag_unknown_parent_is_not_found(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    response = await client.post(
        "/api/v1/ledger-tags", headers=headers, json={"name": "孤儿", "parent_id": 9999}
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "NOT_FOUND"


async def test_tag_scope_filters_orphan_and_tree(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    child = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    orphan = await create_tag(client, headers, name="临时标签")

    orphans = (await client.get("/api/v1/ledger-tags?scope=orphan", headers=headers)).json()
    assert [row["id"] for row in orphans] == [orphan["id"]]

    tree = (await client.get("/api/v1/ledger-tags?scope=tree", headers=headers)).json()
    assert {row["id"] for row in tree} == {root["id"], child["id"]}

    every = (await client.get("/api/v1/ledger-tags", headers=headers)).json()
    assert {row["id"] for row in every} == {root["id"], child["id"], orphan["id"]}

    # 关键字按节点自身匹配名称 / 备注
    matched = (await client.get("/api/v1/ledger-tags?keyword=低压", headers=headers)).json()
    assert [row["id"] for row in matched] == [child["id"]]


async def test_delete_tag_blocks_children_and_references(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    child = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    leaf = await create_tag(client, headers, name="抽屉柜", parent_id=child["id"])
    await create_item(client, headers, tag_ids=[leaf["id"]])

    blocked_by_children = await client.delete(
        f"/api/v1/ledger-tags/{root['id']}",
        headers={**headers, "If-Match": str(root["version"])},
    )
    assert blocked_by_children.status_code == 409, blocked_by_children.text
    assert blocked_by_children.json()["code"] == "LEDGER_TAG_HAS_CHILDREN"

    # 被引用的叶子：直接删与「删父节点带走整棵子树」都应被拦截
    in_use = await client.delete(
        f"/api/v1/ledger-tags/{leaf['id']}",
        headers={**headers, "If-Match": str(leaf["version"])},
    )
    assert in_use.status_code == 409, in_use.text
    assert in_use.json()["code"] == "LEDGER_TAG_IN_USE"

    free = await create_tag(client, headers, name="未使用标签")
    removed = await client.delete(
        f"/api/v1/ledger-tags/{free['id']}",
        headers={**headers, "If-Match": str(free["version"])},
    )
    assert removed.status_code == 204, removed.text


async def test_update_tag_renames_and_checks_duplicates(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    first = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    second = await create_tag(client, headers, name="高压柜", parent_id=root["id"])

    renamed = await client.patch(
        f"/api/v1/ledger-tags/{second['id']}",
        headers=headers,
        json={"name": "中压柜", "remark": "6kV 系统", "version": second["version"]},
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "中压柜"
    assert renamed.json()["remark"] == "6kV 系统"
    assert renamed.json()["version"] == second["version"] + 1

    duplicate = await client.patch(
        f"/api/v1/ledger-tags/{second['id']}",
        headers=headers,
        json={"name": first["name"], "version": renamed.json()["version"]},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_LEDGER_TAG"

    stale = await client.patch(
        f"/api/v1/ledger-tags/{second['id']}",
        headers=headers,
        json={"name": "又改名", "version": second["version"]},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"


async def _tag_rows(client: AsyncClient, headers: dict[str, str]) -> dict[int, dict[str, Any]]:
    """当前全部标签，按 id 建索引，便于断言层级与子节点计数。"""
    response = await client.get("/api/v1/ledger-tags", headers=headers)
    assert response.status_code == 200, response.text
    return {row["id"]: row for row in response.json()}


async def test_update_tag_reparents_and_guards_hierarchy(client: AsyncClient) -> None:
    """改上级：传 null 移为一级、传父 id 换父；环与超 3 层都按 LEDGER_TAG_MAX_LEVEL 拒绝。"""
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    branch = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    leaf = await create_tag(client, headers, name="抽屉柜", parent_id=branch["id"])
    other_root = await create_tag(client, headers, name="电动机")

    # 带子标签的节点整棵子树换父：两侧父节点的计数跟着变，子孙层级随根平移
    moved = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": other_root["id"], "version": branch["version"]},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["parent_id"] == other_root["id"]
    # 原来在第 2 层，挂到另一个一级节点下仍是第 2 层；子标签仍在第 3 层
    assert moved.json()["level"] == 2
    rows = await _tag_rows(client, headers)
    assert rows[root["id"]]["child_count"] == 0
    assert rows[other_root["id"]]["child_count"] == 1
    assert rows[leaf["id"]]["level"] == 3

    # parent_id = null：节点（连同子树）升级为一级标签，子树整体上移一层
    promoted = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": None, "version": moved.json()["version"]},
    )
    assert promoted.status_code == 200, promoted.text
    assert promoted.json()["parent_id"] is None
    assert promoted.json()["level"] == 1
    rows = await _tag_rows(client, headers)
    assert rows[other_root["id"]]["child_count"] == 0
    assert rows[leaf["id"]]["level"] == 2

    # 不传 parent_id：只改名称 / 备注，上级保持不变（旧客户端与既有用法行为不变）
    renamed = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={
            "name": "低压柜（改）",
            "remark": "只改名，不动层级",
            "version": promoted.json()["version"],
        },
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["parent_id"] is None
    assert renamed.json()["level"] == 1
    version = renamed.json()["version"]

    # 环：移到自己、或移到自己子孙下都被拒绝
    for parent_id in (branch["id"], leaf["id"]):
        onto_cycle = await client.patch(
            f"/api/v1/ledger-tags/{branch['id']}",
            headers=headers,
            json={"parent_id": parent_id, "version": version},
        )
        assert onto_cycle.status_code == 400, onto_cycle.text
        assert onto_cycle.json()["code"] == "LEDGER_TAG_MAX_LEVEL"

    # 超 3 层：带子标签的节点挂到第 2 层节点下 → 第 3 层的子标签会到第 4 层；挂到第 3 层下同理
    level2 = await create_tag(client, headers, name="第二层", parent_id=other_root["id"])
    level3 = await create_tag(client, headers, name="第三层", parent_id=level2["id"])
    for parent_id in (level2["id"], level3["id"]):
        over_limit = await client.patch(
            f"/api/v1/ledger-tags/{branch['id']}",
            headers=headers,
            json={"parent_id": parent_id, "version": version},
        )
        assert over_limit.status_code == 400, over_limit.text
        assert over_limit.json()["code"] == "LEDGER_TAG_MAX_LEVEL"

    # 叶子（子树只有自己）挂到第 2 层是允许的：正好占满第 3 层
    leaf_move = await client.patch(
        f"/api/v1/ledger-tags/{leaf['id']}",
        headers=headers,
        json={"parent_id": level2["id"], "version": leaf["version"]},
    )
    assert leaf_move.status_code == 200, leaf_move.text
    assert leaf_move.json()["level"] == 3

    # 换父后按「新父下同名」判断重名：新父下已有同名 → 409
    await create_tag(client, headers, name="低压柜（改）", parent_id=root["id"])
    duplicate = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": root["id"], "version": version},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_LEDGER_TAG"

    # 换父 + 改名一起提交：按新父下的同名判断（新父下没有同名就放行，上层同名不受影响）
    new_root = await create_tag(client, headers, name="干净上级")
    renamed_after_move = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": new_root["id"], "name": "配电柜", "version": version},
    )
    assert renamed_after_move.status_code == 200, renamed_after_move.text
    assert renamed_after_move.json()["name"] == "配电柜"
    assert renamed_after_move.json()["parent_id"] == new_root["id"]
    rows = await _tag_rows(client, headers)
    assert rows[root["id"]]["child_count"] == 1  # 只剩新加的「低压柜（改）」
    assert rows[new_root["id"]]["child_count"] == 1

    # 未知上级 → NOT_FOUND；旧 version → VERSION_CONFLICT
    unknown_parent = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": 9999, "version": renamed_after_move.json()["version"]},
    )
    assert unknown_parent.status_code == 400, unknown_parent.text
    assert unknown_parent.json()["code"] == "NOT_FOUND"

    stale = await client.patch(
        f"/api/v1/ledger-tags/{branch['id']}",
        headers=headers,
        json={"parent_id": root["id"], "version": version},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"


async def test_create_item_normalizes_tags_and_rejects_unknown_tag(
    client: AsyncClient,
) -> None:
    headers = await auth_headers(client, "ledger")
    first = await create_tag(client, headers, name="配电柜")
    second = await create_tag(client, headers, name="电动机")

    created = await create_item(
        client,
        headers,
        name="抽屉柜",
        model_spec="MNS-400",
        quantity=3,
        remark="201 冶炼主厂房",
        tag_ids=[second["id"], first["id"]],
    )
    # 落库与回读都规范化为升序
    assert created["tag_ids"] == sorted([first["id"], second["id"]])
    assert [ref["path"] for ref in created["tags"]] == ["配电柜", "电动机"]
    assert created["quantity"] == 3
    assert created["version"] == 1
    # 子项号 / 单位 / 用途：前两个可留空，单位与用途必填
    assert created["subitem_no"] is None
    assert created["unit_name"] == "台"
    assert created["usage"] == "窑尾收尘系统备机"

    missing_unit = await client.post(
        "/api/v1/ledger-items", headers=headers, json={"name": "x", "model_spec": "y"}
    )
    assert missing_unit.status_code == 422, missing_unit.text

    blank_usage = await client.post(
        "/api/v1/ledger-items",
        headers=headers,
        json={"name": "x", "model_spec": "y", "unit_name": "台", "usage": "   "},
    )
    assert blank_usage.status_code == 422, blank_usage.text

    unknown = await client.post(
        "/api/v1/ledger-items",
        headers=headers,
        json={
            "name": "x",
            "model_spec": "y",
            "unit_name": "台",
            "usage": "测试用途",
            "tag_ids": [9999],
        },
    )
    assert unknown.status_code == 400, unknown.text
    assert unknown.json()["code"] == "INVALID_TAG_ID"
    assert unknown.json()["details"]["tag_ids"] == [9999]

    duplicated = await client.post(
        "/api/v1/ledger-items",
        headers=headers,
        json={
            "name": "x",
            "model_spec": "y",
            "unit_name": "台",
            "usage": "测试用途",
            "tag_ids": [first["id"], first["id"]],
        },
    )
    assert duplicated.status_code == 422, duplicated.text

    negative = await client.post(
        "/api/v1/ledger-items",
        headers=headers,
        json={
            "name": "x",
            "model_spec": "y",
            "unit_name": "台",
            "usage": "测试用途",
            "quantity": -1,
        },
    )
    assert negative.status_code == 422, negative.text


async def test_item_tag_path_uses_full_hierarchy(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    root = await create_tag(client, headers, name="配电柜")
    child = await create_tag(client, headers, name="低压柜", parent_id=root["id"])
    leaf = await create_tag(client, headers, name="抽屉柜", parent_id=child["id"])

    created = await create_item(client, headers, tag_ids=[leaf["id"]])
    assert [ref["path"] for ref in created["tags"]] == ["配电柜 / 低压柜 / 抽屉柜"]


async def test_list_items_filters_keyword_and_tag_subtree(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    parent = await create_tag(client, headers, name="配电柜")
    child = await create_tag(client, headers, name="低压柜", parent_id=parent["id"])
    leaf = await create_tag(client, headers, name="抽屉柜", parent_id=child["id"])
    other = await create_tag(client, headers, name="电动机")

    tagged_deep = await create_item(
        client, headers, name="抽屉柜", model_spec="MNS-400", tag_ids=[leaf["id"]]
    )
    tagged_other = await create_item(
        client,
        headers,
        name="引风机电机",
        model_spec="YKK-450",
        remark="窑尾高温风机",
        tag_ids=[other["id"]],
    )
    untagged = await create_item(client, headers, name="无标签备件", model_spec="X-1")
    await create_item(client, headers, name="另一个抽屉柜", model_spec="MNS-600")

    # 选父标签命中其子孙标签的记录
    by_parent = (
        await client.get(f"/api/v1/ledger-items?tag_ids={parent['id']}", headers=headers)
    ).json()
    assert [row["id"] for row in by_parent["items"]] == [tagged_deep["id"]]

    # 多标签按「命中任一」计算
    either = (
        await client.get(
            f"/api/v1/ledger-items?tag_ids={leaf['id']},{other['id']}", headers=headers
        )
    ).json()
    assert {row["id"] for row in either["items"]} == {tagged_deep["id"], tagged_other["id"]}

    # 关键字支持「|」或检索，命中名称 / 型号 / 备注
    keyword = (
        await client.get("/api/v1/ledger-items?keyword=YKK|无标签", headers=headers)
    ).json()
    assert {row["id"] for row in keyword["items"]} == {tagged_other["id"], untagged["id"]}

    # 标签精确匹配：12 不会被 1 命中（用 unknown id 验证不返还全部数据）
    unknown_tag = (
        await client.get("/api/v1/ledger-items?tag_ids=9999", headers=headers)
    ).json()
    assert unknown_tag == {"items": [], "page": 1, "page_size": 20, "total": 0}

    # 分页
    first_page = (
        await client.get("/api/v1/ledger-items?page=1&page_size=2", headers=headers)
    ).json()
    assert first_page["total"] == 4 and len(first_page["items"]) == 2


async def test_update_and_delete_item(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    tag = await create_tag(client, headers, name="配电柜")
    created = await create_item(client, headers, quantity=1)

    updated = await client.patch(
        f"/api/v1/ledger-items/{created['id']}",
        headers=headers,
        json={
            "quantity": 5,
            "unit_name": "套",
            "usage": "备用抽屉柜",
            "subitem_no": "TG-2026-018",
            "remark": "已核对",
            "tag_ids": [tag["id"]],
            "version": created["version"],
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["quantity"] == 5
    assert updated.json()["unit_name"] == "套"
    assert updated.json()["usage"] == "备用抽屉柜"
    assert updated.json()["subitem_no"] == "TG-2026-018"
    assert updated.json()["tag_ids"] == [tag["id"]]
    assert updated.json()["version"] == created["version"] + 1

    # 子项号传空串表示清空；未传的字段保持原值
    cleared = await client.patch(
        f"/api/v1/ledger-items/{created['id']}",
        headers=headers,
        json={"subitem_no": "  ", "version": updated.json()["version"]},
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["subitem_no"] is None
    assert cleared.json()["unit_name"] == "套"
    assert cleared.json()["usage"] == "备用抽屉柜"

    stale = await client.patch(
        f"/api/v1/ledger-items/{created['id']}",
        headers=headers,
        json={"quantity": 9, "version": created["version"]},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"

    removed = await client.delete(
        f"/api/v1/ledger-items/{created['id']}",
        headers={**headers, "If-Match": str(cleared.json()["version"])},
    )
    assert removed.status_code == 204, removed.text

    missing = await client.get(f"/api/v1/ledger-items/{created['id']}", headers=headers)
    assert missing.status_code == 400, missing.text
    assert missing.json()["code"] == "NOT_FOUND"


async def test_ledger_write_requires_ledger_admin(client: AsyncClient) -> None:
    ledger_headers = await auth_headers(client, "ledger")
    readonly_headers = await auth_headers(client, "readonly")
    warehouse_headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")

    created = await create_tag(client, ledger_headers, name="配电柜")

    # 读取对所有登录用户开放
    assert (await client.get("/api/v1/ledger-tags", headers=readonly_headers)).status_code == 200
    assert (await client.get("/api/v1/ledger-items", headers=readonly_headers)).status_code == 200

    denied_tag = await client.post(
        "/api/v1/ledger-tags", headers=readonly_headers, json={"name": "越权标签"}
    )
    assert denied_tag.status_code == 403, denied_tag.text

    denied_item = await client.post(
        "/api/v1/ledger-items",
        headers=warehouse_headers,
        json={"name": "越权台账", "model_spec": "X"},
    )
    assert denied_item.status_code == 403, denied_item.text

    denied_delete = await client.delete(
        f"/api/v1/ledger-tags/{created['id']}",
        headers={**readonly_headers, "If-Match": str(created["version"])},
    )
    assert denied_delete.status_code == 403, denied_delete.text

    # 超级管理员不受台账角色限制
    assert (
        await client.post(
            "/api/v1/ledger-tags", headers=admin_headers, json={"name": "管理员标签"}
        )
    ).status_code == 201


async def test_ledger_images_are_counted_as_attachments(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    tag_image = await upload_png(client, headers, color="green")
    item_image = await upload_png(client, headers, color="orange")

    tag = await create_tag(client, headers, name="配电柜", image_ids=[tag_image])
    item = await create_item(client, headers, tag_ids=[tag["id"]], image_ids=[item_image])

    assert len(tag["images"]) == 1
    assert len(item["images"]) == 1

    # 被标签 / 台账引用时不允许删除（附件管理与引用登记是否同步的直接验证）
    for file_id in (tag_image, item_image):
        response = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
        assert response.status_code == 409, response.text
        assert response.json()["code"] == "FILE_IN_USE"

    # 解除引用后即可软删除
    cleared = await client.patch(
        f"/api/v1/ledger-items/{item['id']}",
        headers=headers,
        json={"image_ids": [], "version": item["version"]},
    )
    assert cleared.status_code == 200, cleared.text
    response = await client.delete(f"/api/v1/files/images/{item_image}", headers=headers)
    assert response.status_code == 200, response.text


async def test_invalid_image_id_is_rejected(client: AsyncClient) -> None:
    headers = await auth_headers(client, "ledger")
    response = await client.post(
        "/api/v1/ledger-tags",
        headers=headers,
        json={"name": "标签", "image_ids": ["00000000-0000-7000-8000-000000000000"]},
    )
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "INVALID_IMAGE_ID"
