"""端到端模拟用户操作脚本。

由 GitHub Actions（e2e-simulation.yml）在真实 MySQL + 后端实例上运行：
通过 HTTP 模拟六种角色用户的核心操作（仓库 / 申购 / 隐患 / 台账 / 只读 / 超管），
验证主流程可用，并验证「业务数据按项目隔离」这条主线。任一步骤失败即以非零码退出。
写库的可见性也在验证范围内：出入库返回后**立刻**回读余额必须是提交后的值，不对这种情况
做重试或等待——「返回 2xx」与「写库可见」必须同时成立（见 `_post`）。

项目上下文：业务接口都要求 `X-Project-Id`，脚本先用超管读项目列表、取默认项目
（init.sql 种子的那个项目），之后所有角色请求都带上它。用法：
    E2E_BASE_URL=http://127.0.0.1:8000 python scripts/e2e_simulation.py
"""

from __future__ import annotations

import os
import sys
import uuid

import httpx

BASE_URL = os.environ.get("E2E_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
PASSWORD = "123456"


def _auth(client: httpx.Client, username: str, project_id: int | None = None) -> dict[str, str]:
    """登录并返回请求头；给了 project_id 就带上 X-Project-Id（业务接口都需要）。"""
    response = client.post(
        "/api/v1/auth/login", json={"username": username, "password": PASSWORD}
    )
    response.raise_for_status()
    token = response.json().get("access_token")
    if not token:
        raise RuntimeError(f"登录 {username} 未返回 access_token")
    headers = {"Authorization": f"Bearer {token}"}
    if project_id is not None:
        headers["X-Project-Id"] = str(project_id)
    return headers


def _post(
    client: httpx.Client,
    path: str,
    headers: dict[str, str],
    json: dict[str, object],
    *,
    expect: int = 201,
) -> httpx.Response:
    """POST 并断言期望状态码。

    不做重试：写接口返回 2xx 时事务必须已经提交（`CommitBeforeResponseMiddleware`），
    所以「刚建好的物资」紧接着入库不能再出现 `BALANCE_MISSING`(409) 这类可见性竞态。
    """
    response = client.post(path, headers=headers, json=json)
    assert response.status_code == expect, response.text
    return response


def main() -> int:
    run = uuid.uuid4().hex[:8]
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # 1. 健康检查（匿名）
        health = client.get("/health")
        assert health.status_code == 200 and health.json()["database"] == "ok", "健康检查失败"
        print("✅ 健康检查")

        # 2. 默认项目与七种角色登录
        admin = _auth(client, "admin")
        listed_projects = client.get("/api/v1/projects", headers=admin)
        assert listed_projects.status_code == 200, listed_projects.text
        default_projects = [item for item in listed_projects.json() if item["is_default"]]
        assert default_projects, f"项目列表里没有默认项目: {listed_projects.text}"
        project_id = int(default_projects[0]["id"])

        warehouse = _auth(client, "warehouse", project_id)
        purchase = _auth(client, "purchase", project_id)
        hazard = _auth(client, "hazard", project_id)
        ledger = _auth(client, "ledger", project_id)
        work = _auth(client, "work", project_id)
        readonly = _auth(client, "readonly", project_id)
        admin = _auth(client, "admin", project_id)
        print(f"✅ 默认项目 {default_projects[0]['name']}（#{project_id}）与七种角色登录")

        # 2.1 业务接口缺项目上下文必须被拦下（fail-closed，不允许静默看全库）
        no_project = client.get(
            "/api/v1/stock-materials", headers={"Authorization": readonly["Authorization"]}
        )
        assert no_project.status_code == 400, no_project.text
        assert no_project.json()["code"] == "PROJECT_REQUIRED", no_project.text
        disabled_or_unknown = client.get(
            "/api/v1/stock-materials", headers={**readonly, "X-Project-Id": "999999"}
        )
        assert disabled_or_unknown.status_code == 400, disabled_or_unknown.text
        assert disabled_or_unknown.json()["code"] == "PROJECT_NOT_FOUND", disabled_or_unknown.text
        print("✅ 缺项目上下文 / 未知项目被拒绝")

        # 3. 只读用户越权创建物资应 403
        denied = client.post(
            "/api/v1/stock-materials",
            headers=readonly,
            json={
                "name": f"E2E-越权-{run}",
                "model_spec": "E2E",
                "unit_name": "个",
                "image_ids": [],
            },
        )
        assert denied.status_code == 403, f"只读用户越权未被拒绝: {denied.text}"
        print("✅ 只读用户越权拦截")

        # 4. 仓库管理员创建物资
        material = client.post(
            "/api/v1/stock-materials",
            headers=warehouse,
            json={
                "name": f"E2E 测试物资 {run}",
                "model_spec": "E2E-MODEL",
                "unit_name": "个",
                "remark": "端到端模拟",
                "image_ids": [],
            },
        )
        assert material.status_code == 201, material.text
        material_id = material.json()["id"]
        print(f"✅ 创建物资 #{material_id}")

        # 5. 入库 10
        _post(
            client,
            "/api/v1/inventory/inbounds",
            headers=warehouse,
            json={
                "client_request_id": uuid.uuid4().hex,
                "occurred_at": "2026-08-15T10:00:00+08:00",
                "source_type": "MANUAL",
                "business_reason": "E2E 入库",
                "lines": [{"stock_material_id": material_id, "quantity": "10"}],
            },
        )
        print("✅ 入库 10")

        # 5.1 刚入库就回读必须看到 10（写接口返回时事务已提交，见 _post 文档）
        after_inbound = client.get(
            f"/api/v1/inventory/balances/{material_id}", headers=warehouse
        )
        assert after_inbound.status_code == 200, after_inbound.text
        assert after_inbound.json()["current_qty"] == "10", after_inbound.json()
        print("✅ 入库后立刻回读 = 10")

        # 6. 出库 3
        _post(
            client,
            "/api/v1/inventory/outbounds",
            headers=warehouse,
            json={
                "client_request_id": uuid.uuid4().hex,
                "occurred_at": "2026-08-15T11:00:00+08:00",
                "source_type": "MANUAL",
                "business_reason": "E2E 出库",
                "receiver_name": "E2E 领用人",
                "lines": [{"stock_material_id": material_id, "quantity": "3"}],
            },
        )
        print("✅ 出库 3")

        # 7. 余额应为 7（不等待、不重试：出库返回成功时新余额就应该已经可见）
        balance = client.get(f"/api/v1/inventory/balances/{material_id}", headers=warehouse)
        assert balance.status_code == 200, balance.text
        assert balance.json()["current_qty"] == "7", balance.json()
        print("✅ 出库后立刻回读余额 = 7")

        # 8. 库存列表查询
        inventory = client.get(
            "/api/v1/inventory/balances", headers=warehouse, params={"page": 1, "page_size": 20}
        )
        assert inventory.status_code == 200, inventory.text
        print("✅ 库存列表查询")

        # 9. 出入库记录查询
        records = client.get(
            "/api/v1/inventory/operations", headers=warehouse, params={"page": 1, "page_size": 20}
        )
        assert records.status_code == 200, records.text
        print("✅ 出入库记录查询")

        # 10. 申购管理员创建申购计划
        plan = client.post(
            "/api/v1/purchase-materials",
            headers=purchase,
            json={
                "plan_date": "2026-08-20",
                "name": f"E2E 申购物资 {run}",
                "model_spec": "E2E-MODEL",
                "unit_name": "个",
                "actual_demand_person": "E2E 需求人",
                "purchase_responsible": "E2E 负责人",
                "planned_qty": "5",
                "usage": "端到端模拟",
                "image_ids": [],
            },
        )
        assert plan.status_code == 201, plan.text
        print("✅ 创建申购计划")

        # 11. 超级管理员查询申购计划
        plans = client.get(
            "/api/v1/purchase-materials", headers=admin, params={"page": 1, "page_size": 20}
        )
        assert plans.status_code == 200, plans.text
        print("✅ 申购计划列表查询")

        # 12. 隐患管理员登记责任单位与隐患类型
        unit = client.post(
            "/api/v1/hazard-units",
            headers=hazard,
            json={"name": f"E2E 责任单位 {run}", "person": "E2E 责任人"},
        )
        assert unit.status_code == 201, unit.text
        unit_id = unit.json()["id"]
        hazard_type = client.post(
            "/api/v1/hazard-types",
            headers=hazard,
            json={"major": "E2E 大类", "minor": f"E2E 小类 {run}"},
        )
        assert hazard_type.status_code == 201, hazard_type.text
        print("✅ 创建责任单位与隐患类型")

        # 13. 登记隐患（默认值由服务端兜底：区域/检查人员/要求完成时间=检查日期+7 天）
        created = client.post(
            "/api/v1/hazards",
            headers=hazard,
            json={
                "description": f"E2E 隐患 {run}",
                "hazard_unit_id": unit_id,
                "hazard_type_id": hazard_type.json()["id"],
            },
        )
        assert created.status_code == 201, created.text
        hazard_row = created.json()
        assert hazard_row["person"] == "E2E 责任人" and hazard_row["status"] == "待整改"
        print(f"✅ 登记隐患 #{hazard_row['id']}")

        # 14. 只读用户不能写隐患，但可以看到统计
        denied_hazard = client.post(
            "/api/v1/hazards",
            headers=readonly,
            json={
                "description": "E2E 越权",
                "hazard_unit_id": unit_id,
                "hazard_type_id": hazard_type.json()["id"],
            },
        )
        assert denied_hazard.status_code == 403, denied_hazard.text
        stats = client.get("/api/v1/hazards/stats", headers=readonly)
        assert stats.status_code == 200, stats.text
        print("✅ 隐患写权限拦截与工作台统计")

        # 15. 被隐患引用的责任单位不可删除
        in_use = client.delete(
            f"/api/v1/hazard-units/{unit_id}",
            headers={**hazard, "If-Match": str(unit.json()["version"])},
        )
        assert in_use.status_code == 409, in_use.text
        print("✅ 责任单位引用保护")

        # 16. 整改闭环：更新状态为已整改并删除隐患
        updated = client.patch(
            f"/api/v1/hazards/{hazard_row['id']}",
            headers=hazard,
            json={"status": "已整改", "version": hazard_row["version"]},
        )
        assert updated.status_code == 200, updated.text
        deleted = client.delete(
            f"/api/v1/hazards/{hazard_row['id']}",
            headers={**hazard, "If-Match": str(updated.json()["version"])},
        )
        assert deleted.status_code == 204, deleted.text
        print("✅ 隐患整改与删除")

        # 17. 台账管理员建标签（配电柜 / 低压柜两级）并登记台账记录
        root_tag = client.post(
            "/api/v1/ledger-tags",
            headers=ledger,
            json={"name": f"E2E 配电柜 {run}"},
        )
        assert root_tag.status_code == 201, root_tag.text
        child_tag = client.post(
            "/api/v1/ledger-tags",
            headers=ledger,
            json={"name": "E2E 低压柜", "parent_id": root_tag.json()["id"]},
        )
        assert child_tag.status_code == 201, child_tag.text
        assert child_tag.json()["level"] == 2, child_tag.text
        # 三层已是最深层级：再挂子标签应被拒绝
        too_deep = client.post(
            "/api/v1/ledger-tags",
            headers=ledger,
            json={"name": "E2E 抽屉柜", "parent_id": child_tag.json()["id"]},
        )
        assert too_deep.status_code == 201, too_deep.text
        over_deep = client.post(
            "/api/v1/ledger-tags",
            headers=ledger,
            json={"name": "E2E 第四层", "parent_id": too_deep.json()["id"]},
        )
        assert over_deep.status_code == 400, over_deep.text
        assert over_deep.json()["code"] == "LEDGER_TAG_MAX_LEVEL", over_deep.text
        print("✅ 台账标签三级层级与超限拦截")

        # 18. 登记台账记录：多标签以逗号分隔 id 落库，选父标签能筛到子标签的记录
        item = client.post(
            "/api/v1/ledger-items",
            headers=ledger,
            json={
                "name": f"E2E 抽屉柜 {run}",
                "model_spec": "MNS-400",
                "subitem_no": f"TG-E2E-{run}",
                "quantity": 2,
                "unit_name": "面",
                "usage": "E2E 台账用途",
                "tag_ids": [child_tag.json()["id"], too_deep.json()["id"]],
            },
        )
        assert item.status_code == 201, item.text
        item_row = item.json()
        assert item_row["tag_ids"] == sorted([child_tag.json()["id"], too_deep.json()["id"]])
        # 子项号 / 单位 / 用途随台账一起回读（列表按「2 面」展示）
        assert item_row["subitem_no"] == f"TG-E2E-{run}", item_row
        assert (item_row["quantity"], item_row["unit_name"]) == (2, "面"), item_row
        assert item_row["usage"] == "E2E 台账用途", item_row
        listed = client.get(
            "/api/v1/ledger-items",
            headers=readonly,
            params={"tag_ids": str(root_tag.json()["id"])},
        )
        assert listed.status_code == 200 and item_row["id"] in [
            row["id"] for row in listed.json()["items"]
        ], listed.text
        # 标签上的使用数量只算直接挂了该标签的记录：父标签不因子标签被引用而计数
        tag_counts = {
            row["id"]: row["item_count"]
            for row in client.get("/api/v1/ledger-tags", headers=ledger).json()
            if row["id"] in {root_tag.json()["id"], child_tag.json()["id"], too_deep.json()["id"]}
        }
        assert tag_counts == {
            root_tag.json()["id"]: 0,
            child_tag.json()["id"]: 1,
            too_deep.json()["id"]: 1,
        }, tag_counts
        print(f"✅ 登记台账 #{item_row['id']} 与父标签筛选、标签使用数量")

        # 19. 只读用户不能写台账；被台账引用的标签不能删除
        denied_item = client.post(
            "/api/v1/ledger-items",
            headers=readonly,
            json={
                "name": "E2E 越权",
                "model_spec": "X",
                "unit_name": "台",
                "usage": "越权用例",
            },
        )
        assert denied_item.status_code == 403, denied_item.text
        tag_in_use = client.delete(
            f"/api/v1/ledger-tags/{too_deep.json()['id']}",
            headers={**ledger, "If-Match": str(too_deep.json()["version"])},
        )
        assert tag_in_use.status_code == 409, tag_in_use.text
        print("✅ 台账写权限拦截与标签引用保护")

        # 清理本次模拟创建的数据（标签树自底向上删）
        removed_item = client.delete(
            f"/api/v1/ledger-items/{item_row['id']}",
            headers={**ledger, "If-Match": str(item_row["version"])},
        )
        assert removed_item.status_code == 204, removed_item.text
        for tag in (too_deep.json(), child_tag.json(), root_tag.json()):
            response = client.delete(
                f"/api/v1/ledger-tags/{tag['id']}",
                headers={**ledger, "If-Match": str(tag["version"])},
            )
            assert response.status_code == 204, response.text
        print("✅ 台账模拟数据清理")

        # 20. 工作管理：建任务 → 排一段跨天（下午 → 上午）的活 → 三个视图都能看到
        #     → 只读用户不能写 → 有记录的任务不能删 → 清理后任务可删
        task = client.post(
            "/api/v1/work-tasks",
            headers=work,
            json={
                "name": f"E2E 主电机轴承更换 {run}",
                "description": "E2E 覆盖停机窗口更换轴承",
                "status": "进行中",
                "plan_start_date": "2026-09-07",
                "plan_end_date": "2026-09-18",
            },
        )
        assert task.status_code == 201, task.text
        task_row = task.json()
        # 一条记录多个人：顿号串提交后规范化成姓名列表
        record = client.post(
            "/api/v1/work-records",
            headers=work,
            json={
                "task_id": task_row["id"],
                "start_date": "2026-09-07",
                "start_half": "PM",
                "end_date": "2026-09-08",
                "end_half": "AM",
                "participants": ["李建军、王海涛", "李建军"],
                "remark": "E2E 拆卸与回装",
            },
        )
        assert record.status_code == 201, record.text
        record_row = record.json()
        assert record_row["participants"] == ["李建军", "王海涛"], record_row

        # 工作总览：按天 + 时段展开（9/7 下午、9/8 上午）
        overview = client.get(
            "/api/v1/work-overview",
            headers=readonly,
            params={"start_date": "2026-09-07", "end_date": "2026-09-08"},
        )
        assert overview.status_code == 200, overview.text
        assert [(row["date"], row["slot"]) for row in overview.json()["items"]] == [
            ("2026-09-08", "上午"),
            ("2026-09-07", "下午"),
        ], overview.text

        # 任务视图：任务带出区间内的记录；人员视图：按姓名分组
        timeline = client.get(
            "/api/v1/work-task-timeline",
            headers=work,
            params={"start_date": "2026-09-01", "end_date": "2026-09-30"},
        )
        assert timeline.status_code == 200, timeline.text
        matched = [row for row in timeline.json()["items"] if row["task"]["id"] == task_row["id"]]
        assert matched and len(matched[0]["records"]) == 1, timeline.text

        workers = client.get(
            "/api/v1/work-worker-timeline",
            headers=work,
            params={"start_date": "2026-09-01", "end_date": "2026-09-30", "keyword": "李建军"},
        )
        assert workers.status_code == 200, workers.text
        assert [row["name"] for row in workers.json()["items"]] == ["李建军"], workers.text

        # 参与人下拉的历史姓名：项目内去重升序
        names = client.get(
            "/api/v1/work-participants", headers=work, params={"keyword": "王海涛"}
        )
        assert names.status_code == 200 and names.json() == ["王海涛"], names.text
        print(
            f"✅ 工作管理：任务 #{task_row['id']} + 记录 #{record_row['id']}，"
            "三个视图与人员清单一致"
        )

        # 只读用户与仓库管理员不能写工作数据
        denied_task = client.post(
            "/api/v1/work-tasks", headers=readonly, json={"name": "E2E 越权任务"}
        )
        assert denied_task.status_code == 403, denied_task.text
        # 有记录的任务不允许直接删除，先删记录再删任务
        task_in_use = client.delete(
            f"/api/v1/work-tasks/{task_row['id']}",
            headers={**work, "If-Match": str(task_row["version"])},
        )
        assert task_in_use.status_code == 409, task_in_use.text
        assert task_in_use.json()["code"] == "WORK_TASK_HAS_RECORDS", task_in_use.text
        removed_record = client.delete(
            f"/api/v1/work-records/{record_row['id']}",
            headers={**work, "If-Match": str(record_row["version"])},
        )
        assert removed_record.status_code == 204, removed_record.text
        removed_task = client.delete(
            f"/api/v1/work-tasks/{task_row['id']}",
            headers={**work, "If-Match": str(task_row["version"])},
        )
        assert removed_task.status_code == 204, removed_task.text
        print("✅ 工作管理写权限拦截、删除保护与模拟数据清理")

        # 21. 跨项目隔离：新建项目后看不到本项目的数据，同 ID 资源在别的项目里「不存在」
        new_project = client.post(
            "/api/v1/projects",
            headers=admin,
            json={"name": f"E2E 临时项目 {run}"},
        )
        assert new_project.status_code == 201, new_project.text
        other_project = int(new_project.json()["id"])
        other = {**admin, "X-Project-Id": str(other_project)}

        other_materials = client.get(
            "/api/v1/inventory/balances", headers=other, params={"page": 1, "page_size": 20}
        )
        assert other_materials.status_code == 200, other_materials.text
        assert other_materials.json()["total"] == 0, other_materials.text
        cross_read = client.get(f"/api/v1/inventory/balances/{material_id}", headers=other)
        assert cross_read.status_code == 400, cross_read.text
        assert cross_read.json()["code"] == "NOT_FOUND", cross_read.text
        print(
            f"✅ 项目隔离：临时项目（#{other_project}）读不到本项目（#{project_id}）的数据"
            f"（余额 total=0，跨项目读详情 400 NOT_FOUND）"
        )

        removed_project = client.delete(
            f"/api/v1/projects/{other_project}",
            headers={**admin, "If-Match": str(new_project.json()["version"])},
        )
        assert removed_project.status_code == 204, removed_project.text
        print("✅ 临时项目清理")

    print(f"🎉 模拟用户操作全部通过（run={run}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
