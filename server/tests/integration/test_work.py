"""工作管理接口集成测试：一行一个任务的 CRUD、标签 / 完成度 / 关键字筛选、图片、权限与项目隔离。"""

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


async def test_task_crud_and_optimistic_lock(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(
        client,
        admin,
        name="2# 除尘风机轴承更换",
        steps="停机窗口内完成",
        start_date="2026-09-01",
        end_date="2026-09-05",
        owner="李建军，王海涛",
        progress=40,
        remark="备件已到货",
        tags="检修,风机",
    )
    assert task["steps"] == "停机窗口内完成"
    assert task["owner"] == "李建军，王海涛"
    assert task["progress"] == 40
    assert task["tags"] == "检修,风机"
    assert task["version"] == 1

    listed = await client.get("/api/v1/work-tasks", headers=admin)
    assert listed.status_code == 200, listed.text
    assert [item["name"] for item in listed.json()["items"]] == ["2# 除尘风机轴承更换"]
    detail = await client.get(f"/api/v1/work-tasks/{task['id']}", headers=admin)
    assert detail.status_code == 200

    # 乐观锁：用过期版本号改动 → 409
    stale = await client.patch(
        f"/api/v1/work-tasks/{task['id']}",
        headers=admin,
        json={"progress": 100, "version": 2},
    )
    assert stale.status_code == 409, stale.text
    assert stale.json()["code"] == "VERSION_CONFLICT"

    updated = await client.patch(
        f"/api/v1/work-tasks/{task['id']}",
        headers=admin,
        json={"progress": 100, "end_date": None, "version": 1},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["progress"] == 100
    assert updated.json()["end_date"] is None
    assert updated.json()["version"] == 2

    deleted = await client.delete(
        f"/api/v1/work-tasks/{task['id']}", headers={**admin, "If-Match": "2"}
    )
    assert deleted.status_code == 204, deleted.text
    assert (await client.get(f"/api/v1/work-tasks/{task['id']}", headers=admin)).status_code == 400


async def test_duplicate_names_allowed_and_date_range(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    # 同一件活可以在不同周重复登记：任务名允许重复
    await create_task(client, admin, name="重复名称任务")
    again = await create_task(client, admin, name="重复名称任务")
    assert again["id"] > 0

    bad_range = await client.post(
        "/api/v1/work-tasks",
        headers=admin,
        json={
            "name": "完成早于开始的任务",
            "start_date": "2026-09-05",
            "end_date": "2026-09-01",
        },
    )
    assert bad_range.status_code == 400, bad_range.text
    assert bad_range.json()["code"] == "WORK_DATE_RANGE"

    # 只填一端允许
    partial = await create_task(
        client, admin, name="只填开始时间", start_date="2026-09-05"
    )
    assert partial["start_date"] == "2026-09-05"
    assert partial["end_date"] is None


async def test_tags_are_normalized_and_filterable(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    first = await create_task(
        client,
        admin,
        name="304 脱硫风机检查",
        tags=" 安全 ，检修 ,, 安全 ",
        start_date="2026-09-02",
    )
    second = await create_task(
        client,
        admin,
        name="107 立磨校称",
        tags="校称",
        start_date="2026-09-03",
    )
    await create_task(
        client,
        admin,
        name="无标签任务",
        start_date="2026-09-04",
    )
    # 中文 / 英文逗号都认，去空白、去重后按英文逗号落库
    assert first["tags"] == "安全,检修"
    assert second["tags"] == "校称"

    # 项目内标签清单去重升序
    tags = await client.get("/api/v1/work-task-tags", headers=admin)
    assert tags.status_code == 200, tags.text
    assert tags.json() == ["安全", "校称", "检修"]

    one = await client.get("/api/v1/work-tasks", headers=admin, params={"tags": "检修"})
    assert [item["name"] for item in one.json()["items"]] == ["304 脱硫风机检查"]

    # 多个标签命中任意一个即可
    any_tag = await client.get(
        "/api/v1/work-tasks", headers=admin, params={"tags": "检修,校称"}
    )
    assert [item["name"] for item in any_tag.json()["items"]] == [
        "107 立磨校称",
        "304 脱硫风机检查",
    ]

    # 子串不命中：标签「安」不会命中「安全」
    partial_tag = await client.get("/api/v1/work-tasks", headers=admin, params={"tags": "安"})
    assert partial_tag.json()["items"] == []


async def test_progress_and_keyword_filters(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    await create_task(
        client,
        admin,
        name="未完成任务",
        steps="等备件",
        owner="赵玉军",
        progress=10,
        tags="待办",
        start_date="2026-09-01",
    )
    await create_task(
        client,
        admin,
        name="已完成任务",
        owner="高振华",
        progress=100,
        tags="完成",
        start_date="2026-09-02",
    )

    undone = await client.get("/api/v1/work-tasks", headers=admin, params={"status": "未完成"})
    assert [item["name"] for item in undone.json()["items"]] == ["未完成任务"]
    done = await client.get("/api/v1/work-tasks", headers=admin, params={"status": "已完成"})
    assert [item["name"] for item in done.json()["items"]] == ["已完成任务"]

    # 关键字覆盖工作任务 / 事项或步骤 / 责任人 / 备注 / 标签，并支持 | 或搜索
    by_owner = await client.get("/api/v1/work-tasks", headers=admin, params={"keyword": "赵玉军"})
    assert [item["name"] for item in by_owner.json()["items"]] == ["未完成任务"]
    by_or = await client.get(
        "/api/v1/work-tasks", headers=admin, params={"keyword": "备件|高振华"}
    )
    assert {item["name"] for item in by_or.json()["items"]} == {"未完成任务", "已完成任务"}
    by_tag = await client.get("/api/v1/work-tasks", headers=admin, params={"keyword": "已"})
    assert [item["name"] for item in by_tag.json()["items"]] == ["已完成任务"]


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
    assert denied.json()["code"] == "PERMISSION_DENIED"
    denied_delete = await client.delete(
        f"/api/v1/work-tasks/{task['id']}", headers={**warehouse, "If-Match": "1"}
    )
    assert denied_delete.status_code == 403

    # 读取按 work:read 门禁：只读用户有该权限位，仓库管理员没有
    listed = await client.get("/api/v1/work-tasks", headers=readonly)
    assert listed.status_code == 200, listed.text
    detail = await client.get(f"/api/v1/work-tasks/{task['id']}", headers=readonly)
    assert detail.status_code == 200
    denied_read = await client.get("/api/v1/work-tasks", headers=warehouse)
    assert denied_read.status_code == 403, denied_read.text
    assert denied_read.json()["code"] == "PERMISSION_DENIED"


async def test_tasks_and_tags_are_project_scoped(client: AsyncClient) -> None:
    admin = await auth_headers(client, "admin")
    task = await create_task(client, admin, name="项目隔离任务", tags="公用电检")

    other = {**admin, "X-Project-Id": str(SECOND_PROJECT_ID)}
    tasks = await client.get("/api/v1/work-tasks", headers=other)
    assert tasks.status_code == 200, tasks.text
    assert tasks.json()["items"] == []
    tags = await client.get("/api/v1/work-task-tags", headers=other)
    assert tags.json() == []

    # 另一个项目可以用同名任务（任务名本来就不唯一）
    created = await client.post(
        "/api/v1/work-tasks", headers=other, json={"name": "项目隔离任务"}
    )
    assert created.status_code == 201, created.text

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
