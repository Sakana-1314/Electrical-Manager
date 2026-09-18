"""工作管理接口集成测试：任务与工作记录 CRUD、半日区间语义、三个视图、权限与项目隔离。"""

from __future__ import annotations

import io
from typing import Any

from httpx import AsyncClient
from PIL import Image

from tests.conftest import DEFAULT_PROJECT_ID, SECOND_PROJECT_ID, auth_headers


async def upload_png(client: AsyncClient, headers: dict[str, str]) -> str:
    source = io.BytesIO()
    Image.new("RGB", (16, 12), "skyblue").save(source, format="PNG")
    response = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("work.png", source.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def create_task(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "1# 皮带电机更换",
    **overrides: object,
) -> dict[str, Any]:
    payload: dict[str, object] = {"name": name, **overrides}
    response = await client.post("/api/v1/work-tasks", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def create_record(
    client: AsyncClient,
    headers: dict[str, str],
    task_id: int,
    *,
    start_date: str = "2026-09-01",
    start_half: str = "AM",
    end_date: str = "2026-09-01",
    end_half: str = "PM",
    participants: list[str] | None = None,
    **overrides: object,
) -> dict[str, Any]:
    payload: dict[str, object] = {
        "task_id": task_id,
        "start_date": start_date,
        "start_half": start_half,
        "end_date": end_date,
        "end_half": end_half,
        "participants": participants or ["李建军", "王海涛"],
        **overrides,
    }
    response = await client.post("/api/v1/work-records", headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


async def test_task_crud_and_optimistic_lock(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(
        client,
        admin,
        name="2# 除尘风机轴承更换",
        description="停机窗口内完成",
        status="进行中",
        plan_start_date="2026-09-01",
        plan_end_date="2026-09-05",
        remark="备件已到货",
    )
    assert task["status"] == "进行中"
    assert task["record_count"] == 0
    assert task["version"] == 1

    # 列表与详情
    listed = await client.get("/api/v1/work-tasks", headers=admin)
    assert listed.status_code == 200, listed.text
    assert [item["name"] for item in listed.json()["items"]] == ["2# 除尘风机轴承更换"]
    detail = await client.get(f"/api/v1/work-tasks/{task['id']}", headers=admin)
    assert detail.status_code == 200

    # 乐观锁：用过期版本号改动 → 409
    stale = await client.patch(
        f"/api/v1/work-tasks/{task['id']}",
        headers=admin,
        json={"status": "已完成", "version": 2},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"

    updated = await client.patch(
        f"/api/v1/work-tasks/{task['id']}",
        headers=admin,
        json={"status": "已完成", "plan_end_date": None, "version": 1},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "已完成"
    assert updated.json()["plan_end_date"] is None
    assert updated.json()["version"] == 2


async def test_duplicate_task_name_and_plan_range(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    await create_task(client, admin, name="重复名称任务")

    duplicate = await client.post(
        "/api/v1/work-tasks", headers=admin, json={"name": "重复名称任务"}
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "DUPLICATE_WORK_TASK"

    bad_plan = await client.post(
        "/api/v1/work-tasks",
        headers=admin,
        json={
            "name": "计划倒挂任务",
            "plan_start_date": "2026-09-05",
            "plan_end_date": "2026-09-01",
        },
    )
    assert bad_plan.status_code == 400, bad_plan.text
    assert bad_plan.json()["code"] == "WORK_DATE_RANGE"


async def test_task_images_are_returned_and_referenced(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    file_id = await upload_png(client, admin)
    task = await create_task(client, admin, name="带图片的任务", image_ids=[file_id])
    assert [image["id"] for image in task["images"]] == [file_id]

    # 任务图片计入附件引用：附件管理里能看到引用次数为 1，不会被当成未引用图片
    attachments = await client.get(
        "/api/v1/files/images/attachments?page_size=50", headers=admin
    )
    assert attachments.status_code == 200, attachments.text
    rows = {item["id"]: item for item in attachments.json()["items"]}
    assert rows[file_id]["reference_count"] == 1


async def test_record_participants_are_normalized(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="清洗冷却器")
    record = await create_record(
        client,
        admin,
        task["id"],
        # 一次填多人（顿号 / 逗号 / 空格混合）+ 重复 + 多余空白
        participants=["李建军、王海涛", " 陈志远 ", "李建军", "刘振华,杨明辉"],
    )
    assert record["participants"] == ["李建军", "王海涛", "陈志远", "刘振华", "杨明辉"]

    # 历史姓名清单按项目去重升序
    names = await client.get("/api/v1/work-participants", headers=admin)
    assert names.status_code == 200, names.text
    assert names.json() == ["刘振华", "李建军", "杨明辉", "王海涛", "陈志远"]


async def test_record_date_range_validation(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="校验区间的任务")

    reversed_range = await client.post(
        "/api/v1/work-records",
        headers=admin,
        json={
            "task_id": task["id"],
            "start_date": "2026-09-05",
            "start_half": "AM",
            "end_date": "2026-09-01",
            "end_half": "PM",
            "participants": ["李建军"],
        },
    )
    assert reversed_range.status_code == 400, reversed_range.text
    assert reversed_range.json()["code"] == "WORK_DATE_RANGE"

    same_day_reversed = await client.post(
        "/api/v1/work-records",
        headers=admin,
        json={
            "task_id": task["id"],
            "start_date": "2026-09-01",
            "start_half": "PM",
            "end_date": "2026-09-01",
            "end_half": "AM",
            "participants": ["李建军"],
        },
    )
    assert same_day_reversed.status_code == 400, same_day_reversed.text
    assert same_day_reversed.json()["code"] == "WORK_DATE_RANGE"

    # 半天档必须成对提交（只改日期不改上下午 → 422）
    record = await create_record(client, admin, task["id"])
    half_without_date = await client.patch(
        f"/api/v1/work-records/{record['id']}",
        headers=admin,
        json={"start_half": "PM", "version": 1},
    )
    assert half_without_date.status_code == 422, half_without_date.text

    unknown_task = await client.post(
        "/api/v1/work-records",
        headers=admin,
        json={
            "task_id": 99999,
            "start_date": "2026-09-01",
            "start_half": "AM",
            "end_date": "2026-09-01",
            "end_half": "PM",
            "participants": ["李建军"],
        },
    )
    assert unknown_task.status_code == 400, unknown_task.text
    assert unknown_task.json()["code"] == "INVALID_WORK_TASK_ID"


async def test_delete_task_requires_records_removed_first(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="删除保护任务")
    record = await create_record(client, admin, task["id"])

    blocked = await client.delete(
        f"/api/v1/work-tasks/{task['id']}", headers={**admin, "If-Match": "1"}
    )
    assert blocked.status_code == 409, blocked.text
    assert blocked.json()["code"] == "WORK_TASK_HAS_RECORDS"

    deleted_record = await client.delete(
        f"/api/v1/work-records/{record['id']}", headers={**admin, "If-Match": "1"}
    )
    assert deleted_record.status_code == 204, deleted_record.text

    deleted_task = await client.delete(
        f"/api/v1/work-tasks/{task['id']}", headers={**admin, "If-Match": "1"}
    )
    assert deleted_task.status_code == 204, deleted_task.text
    assert (await client.get(f"/api/v1/work-tasks/{task['id']}", headers=admin)).status_code == 400


async def test_overview_expands_records_by_day_and_slot(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="总览任务", status="进行中")
    # 9/1 下午 → 9/3 上午：中间那天是全天
    await create_record(
        client,
        admin,
        task["id"],
        start_date="2026-09-01",
        start_half="PM",
        end_date="2026-09-03",
        end_half="AM",
        participants=["李建军"],
    )

    response = await client.get(
        "/api/v1/work-overview",
        headers=admin,
        params={"start_date": "2026-09-01", "end_date": "2026-09-03"},
    )
    assert response.status_code == 200, response.text
    rows = response.json()
    assert rows["total"] == 3
    # 最近的日期在前
    assert [(row["date"], row["slot"]) for row in rows["items"]] == [
        ("2026-09-03", "上午"),
        ("2026-09-02", "全天"),
        ("2026-09-01", "下午"),
    ]
    assert all(row["participants"] == ["李建军"] for row in rows["items"])
    assert all(row["task_name"] == "总览任务" for row in rows["items"])


async def test_overview_filters_and_range_limit(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    first = await create_task(client, admin, name="甲任务")
    second = await create_task(client, admin, name="乙任务")
    await create_record(client, admin, first["id"], participants=["张三"])
    await create_record(
        client,
        admin,
        first["id"],
        start_date="2026-09-02",
        end_date="2026-09-02",
        participants=["张三丰"],
    )
    await create_record(
        client,
        admin,
        second["id"],
        start_date="2026-09-03",
        end_date="2026-09-03",
        participants=["李四"],
    )

    base = {"start_date": "2026-09-01", "end_date": "2026-09-10"}
    # 人员精确匹配：「张三」不命中「张三丰」
    by_person = await client.get(
        "/api/v1/work-overview", headers=admin, params={**base, "participants": "张三"}
    )
    assert [row["date"] for row in by_person.json()["items"]] == ["2026-09-01"]

    by_tasks = await client.get(
        "/api/v1/work-overview", headers=admin, params={**base, "task_ids": str(second["id"])}
    )
    assert [row["task_name"] for row in by_tasks.json()["items"]] == ["乙任务"]

    by_keyword = await client.get(
        "/api/v1/work-overview", headers=admin, params={**base, "keyword": "李四"}
    )
    assert [row["task_name"] for row in by_keyword.json()["items"]] == ["乙任务"]

    too_long = await client.get(
        "/api/v1/work-overview",
        headers=admin,
        params={"start_date": "2026-01-01", "end_date": "2026-06-01"},
    )
    assert too_long.status_code == 400, too_long.text
    assert too_long.json()["code"] == "WORK_RANGE_TOO_LONG"


async def test_task_timeline_returns_records_in_range_only(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="时间线任务")
    inside = await create_record(
        client,
        admin,
        task["id"],
        start_date="2026-09-02",
        end_date="2026-09-04",
        participants=["李建军"],
    )
    await create_record(
        client,
        admin,
        task["id"],
        start_date="2026-10-01",
        end_date="2026-10-02",
        participants=["李建军"],
    )

    response = await client.get(
        "/api/v1/work-task-timeline",
        headers=admin,
        params={"start_date": "2026-09-01", "end_date": "2026-09-07"},
    )
    assert response.status_code == 200, response.text
    page = response.json()
    assert page["total"] == 1
    row = page["items"][0]
    assert row["task"]["name"] == "时间线任务"
    assert row["task"]["record_count"] == 2  # 计数是全量，不受查询区间影响
    assert [record["id"] for record in row["records"]] == [inside["id"]]
    assert row["records"][0]["task_name"] == "时间线任务"
    assert row["records"][0]["start_half"] == "AM"

    # 状态筛选
    filtered = await client.get(
        "/api/v1/work-task-timeline",
        headers=admin,
        params={
            "start_date": "2026-09-01",
            "end_date": "2026-09-07",
            "status": "已完成",
        },
    )
    assert filtered.json()["total"] == 0


async def test_worker_timeline_groups_records_by_name(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="人员分组任务")
    await create_record(client, admin, task["id"], participants=["李建军", "王海涛"])
    await create_record(
        client,
        admin,
        task["id"],
        start_date="2026-09-05",
        end_date="2026-09-05",
        participants=["李建军"],
    )

    response = await client.get(
        "/api/v1/work-worker-timeline",
        headers=admin,
        params={"start_date": "2026-09-01", "end_date": "2026-09-10"},
    )
    assert response.status_code == 200, response.text
    page = response.json()
    assert page["total"] == 2
    by_name = {row["name"]: row for row in page["items"]}
    assert by_name["李建军"]["record_count"] == 2
    assert by_name["王海涛"]["record_count"] == 1
    # 组内记录保留完整参与人列表，便于编辑时回填
    assert by_name["王海涛"]["records"][0]["participants"] == ["李建军", "王海涛"]

    # 姓名关键字筛选
    filtered = await client.get(
        "/api/v1/work-worker-timeline",
        headers=admin,
        params={"start_date": "2026-09-01", "end_date": "2026-09-10", "keyword": "王"},
    )
    assert [row["name"] for row in filtered.json()["items"]] == ["王海涛"]

    # 区间外的记录不计入
    empty = await client.get(
        "/api/v1/work-worker-timeline",
        headers=admin,
        params={"start_date": "2026-09-06", "end_date": "2026-09-10"},
    )
    assert empty.json()["total"] == 0


async def test_write_permissions(client: AsyncClient) -> None:
    work = await auth_headers(client, "work")
    readonly = await auth_headers(client, "readonly")
    warehouse = await auth_headers(client, "warehouse")

    # 工作管理员可以写，也可传任务图片
    file_id = await upload_png(client, work)
    task = await create_task(client, work, name="工作管理员建的任务", image_ids=[file_id])

    # 其他角色写 → 403
    denied = await client.post(
        "/api/v1/work-tasks", headers=warehouse, json={"name": "越权任务"}
    )
    assert denied.status_code == 403, denied.text
    assert denied.json()["code"] == "FORBIDDEN"
    denied_delete = await client.delete(
        f"/api/v1/work-tasks/{task['id']}", headers={**warehouse, "If-Match": "1"}
    )
    assert denied_delete.status_code == 403

    # 读取对所有登录用户开放
    for headers in (readonly, warehouse):
        listed = await client.get("/api/v1/work-tasks", headers=headers)
        assert listed.status_code == 200, listed.text
        detail = await client.get(f"/api/v1/work-tasks/{task['id']}", headers=headers)
        assert detail.status_code == 200


async def test_records_and_participants_are_project_scoped(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="项目隔离任务")
    await create_record(client, admin, task["id"], participants=["李建军"])

    other = {**admin, "X-Project-Id": str(SECOND_PROJECT_ID)}
    tasks = await client.get("/api/v1/work-tasks", headers=other)
    assert tasks.status_code == 200, tasks.text
    assert tasks.json()["items"] == []

    # 另一个项目可以用同名任务（项目域唯一键带 project_id）
    created = await client.post(
        "/api/v1/work-tasks", headers=other, json={"name": "项目隔离任务"}
    )
    assert created.status_code == 201, created.text

    names = await client.get("/api/v1/work-participants", headers=other)
    assert names.json() == []

    # 直接按 id 取另一个项目的任务 → 不可见（读过滤生效）
    detail = await client.get(f"/api/v1/work-tasks/{task['id']}", headers=other)
    assert detail.status_code == 400

    # 缺项目头 → PROJECT_REQUIRED（fixture 给客户端设了默认头，这里临时摘掉）
    client.headers.pop("X-Project-Id", None)
    try:
        no_project = await client.get("/api/v1/work-tasks", headers=admin)
    finally:
        client.headers["X-Project-Id"] = str(DEFAULT_PROJECT_ID)
    assert no_project.status_code == 400, no_project.text
    assert no_project.json()["code"] == "PROJECT_REQUIRED"


async def test_overview_requires_date_range(client: AsyncClient) -> None:
    """三个视图的查询区间必填：缺参由 FastAPI 拦成 422，不落到 service。"""
    admin = await auth_headers(client, "admin")
    missing_range = await client.get("/api/v1/work-overview", headers=admin)
    assert missing_range.status_code == 422, missing_range.text
