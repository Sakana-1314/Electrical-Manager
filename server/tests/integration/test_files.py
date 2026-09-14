from __future__ import annotations

import io
from datetime import date
from uuid import UUID

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import FileObject, PurchaseRequest, PurchaseRequestLine, PurchaseRequestLineImage
from app.services import attachment_cleanup_service
from tests.conftest import auth_headers


async def upload_png(
    client: AsyncClient,
    headers: dict[str, str],
    *,
    name: str = "attachment.png",
    color: str = "orange",
) -> str:
    source = io.BytesIO()
    Image.new("RGB", (16, 12), color).save(source, format="PNG")
    response = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": (name, source.getvalue(), "image/png")},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


@pytest.mark.asyncio
async def test_uploaded_image_is_reencoded_as_png(client: AsyncClient) -> None:
    headers = await auth_headers(client, "warehouse")
    source = io.BytesIO()
    Image.new("RGB", (64, 48), "red").save(source, format="JPEG", exif=b"Exif\x00\x00metadata")
    response = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("source.jpg", source.getvalue(), "image/jpeg")},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert UUID(body["id"]).version == 7
    assert "url" not in body
    assert body["mime_type"] == "image/png"

    duplicate = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("duplicate.jpg", source.getvalue(), "image/jpeg")},
    )
    assert duplicate.status_code == 201, duplicate.text
    assert duplicate.json()["id"] == body["id"]
    assert len(list(settings.upload_dir.glob("*.png"))) == 1

    stored_path = settings.upload_dir / f'{body["id"]}.png'
    stored_path.unlink()
    repaired = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": ("repair.jpg", source.getvalue(), "image/jpeg")},
    )
    assert repaired.status_code == 201, repaired.text
    assert repaired.json()["id"] == body["id"]
    assert stored_path.is_file()

    image_url = f'/api/v1/files/images/{body["id"]}'
    downloaded = await client.get(image_url)
    assert downloaded.status_code == 200
    assert downloaded.content.startswith(b"\x89PNG\r\n\x1a\n")
    expected_cache = "public, max-age=86400, s-maxage=2592000"
    assert downloaded.headers["cache-control"] == expected_cache

    preview = await client.get(image_url, params={"size": 16})
    assert preview.status_code == 200
    assert preview.headers["content-type"].startswith("image/webp")
    assert preview.headers["cache-control"] == expected_cache
    with Image.open(io.BytesIO(preview.content)) as image:
        assert image.size == (16, 12)
    assert not (settings.upload_dir / ".previews").exists()

    linked = await client.post(
        "/api/v1/stock-materials",
        headers=headers,
        json={
            "name": "带图物资",
            "model_spec": "IMG-1",
            "unit_name": "个",
            "remark": None,
            "image_ids": [body["id"]],
        },
    )
    assert linked.status_code == 201, linked.text
    assert linked.json()["images"][0]["id"] == body["id"]

    invalid_preview = await client.get(image_url, params={"size": 15})
    assert invalid_preview.status_code == 422

    async with SessionLocal() as session:
        persisted_id = await session.scalar(
            select(FileObject.id).where(FileObject.id == body["id"])
        )
        file_count = await session.scalar(select(func.count()).select_from(FileObject))
    assert persisted_id == body["id"]
    assert file_count == 1


@pytest.mark.asyncio
async def test_purchase_request_line_image_is_never_treated_as_orphan(
    client: AsyncClient,
) -> None:
    """仅被申购记录行引用的图片：不算孤儿、不能被单删（回归 20260810 行级镜像表）。"""
    warehouse_headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    source = io.BytesIO()
    Image.new("RGB", (16, 12), "purple").save(source, format="PNG")
    uploaded = await client.post(
        "/api/v1/files/images",
        headers=warehouse_headers,
        files={"file": ("record-image.png", source.getvalue(), "image/png")},
    )
    file_id = uploaded.json()["id"]

    # 构造一条只引用该图片的申购记录行（模拟 move-to-record 后的行级镜像）。
    async with SessionLocal() as session:
        request = PurchaseRequest(purchase_date=None)
        session.add(request)
        await session.flush()
        line = PurchaseRequestLine(
            purchase_request_id=request.id,
            plan_no_snapshot="PLAN-TEST-001",
            plan_date_snapshot=date(2026, 7, 1),
            demand_department_snapshot="车间",
            material_name_snapshot="记录物资",
            model_spec_snapshot="M-1",
            unit_name_snapshot="个",
            actual_demand_person_snapshot="张三",
            purchase_responsible_snapshot="李工",
            purchase_qty="1",
            usage="测试",
        )
        session.add(line)
        await session.flush()
        session.add(
            PurchaseRequestLineImage(line_id=line.id, file_id=file_id, sort_order=0)
        )
        await session.commit()

    report = await client.get(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=admin_headers
    )
    assert report.status_code == 200, report.text
    assert file_id not in [item["id"] for item in report.json()["unreferenced_records"]]

    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=warehouse_headers)
    assert removed.status_code == 409, removed.text
    assert removed.json()["code"] == "FILE_IN_USE"

    # 孤儿清理也不应删除被记录行引用的图片。
    cleaned = await client.delete(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=admin_headers
    )
    assert cleaned.status_code == 200, cleaned.text
    assert file_id not in cleaned.json()["deleted_record_ids"]
    assert (settings.upload_dir / f"{file_id}.png").exists()


@pytest.mark.asyncio
async def test_image_upload_still_requires_authentication(client: AsyncClient) -> None:
    source = io.BytesIO()
    Image.new("RGB", (16, 12), "blue").save(source, format="PNG")

    response = await client.post(
        "/api/v1/files/images",
        files={"file": ("source.png", source.getvalue(), "image/png")},
    )

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_super_admin_can_report_and_cleanup_orphan_files(client: AsyncClient) -> None:
    warehouse_headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    source = io.BytesIO()
    Image.new("RGB", (16, 12), "green").save(source, format="PNG")
    uploaded = await client.post(
        "/api/v1/files/images",
        headers=warehouse_headers,
        files={"file": ("orphan.png", source.getvalue(), "image/png")},
    )
    file_id = uploaded.json()["id"]
    untracked_id = "01900000-0000-7000-8000-000000000999"
    (settings.upload_dir / f"{untracked_id}.png").write_bytes(source.getvalue())

    forbidden = await client.get(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=warehouse_headers
    )
    assert forbidden.status_code == 403

    report = await client.get(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=admin_headers
    )
    assert report.status_code == 200, report.text
    assert [item["id"] for item in report.json()["unreferenced_records"]] == [file_id]
    assert report.json()["untracked_file_names"] == [f"{untracked_id}.png"]
    assert report.json()["missing_file_ids"] == []

    cleaned = await client.delete(
        "/api/v1/files/images/orphans?older_than_hours=0", headers=admin_headers
    )
    assert cleaned.status_code == 200, cleaned.text
    assert cleaned.json()["deleted_record_ids"] == [file_id]
    assert set(cleaned.json()["deleted_file_names"]) == {
        f"{file_id}.png",
        f"{untracked_id}.png",
    }
    assert not (settings.upload_dir / f"{file_id}.png").exists()
    assert not (settings.upload_dir / f"{untracked_id}.png").exists()


@pytest.mark.asyncio
async def test_attachment_list_reports_reference_count(client: AsyncClient) -> None:
    """附件管理列表：每张图片一行，被引用次数来自图片关联表；未被引用的为 0。"""
    headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    referenced_id = await upload_png(client, headers, name="referenced.png", color="red")
    free_id = await upload_png(client, headers, name="free.png", color="green")

    linked = await client.post(
        "/api/v1/stock-materials",
        headers=headers,
        json={
            "name": "带图物资",
            "model_spec": "ATT-1",
            "unit_name": "个",
            "remark": None,
            "image_ids": [referenced_id],
        },
    )
    assert linked.status_code == 201, linked.text

    listed = await client.get(
        "/api/v1/files/images/attachments?page_size=50", headers=admin_headers
    )
    assert listed.status_code == 200, listed.text
    rows = {item["id"]: item for item in listed.json()["items"]}
    assert rows[referenced_id]["reference_count"] == 1
    assert rows[free_id]["reference_count"] == 0
    assert rows[referenced_id]["deleted_at"] is None
    assert rows[referenced_id]["mime_type"] == "image/png"
    assert rows[referenced_id]["file_exists"] is True
    assert listed.json()["total"] == 2

    unreferenced = await client.get(
        "/api/v1/files/images/attachments?referenced=false", headers=admin_headers
    )
    assert [item["id"] for item in unreferenced.json()["items"]] == [free_id]

    by_keyword = await client.get(
        "/api/v1/files/images/attachments?keyword=referenced", headers=admin_headers
    )
    assert [item["id"] for item in by_keyword.json()["items"]] == [referenced_id]


@pytest.mark.asyncio
async def test_attachment_list_requires_super_admin(client: AsyncClient) -> None:
    warehouse_headers = await auth_headers(client, "warehouse")
    forbidden = await client.get("/api/v1/files/images/attachments", headers=warehouse_headers)
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_delete_unreferenced_image_is_soft_delete(client: AsyncClient) -> None:
    """未被引用的图片：删除只是软删除，数据库行与磁盘文件都保留到凌晨 2 点复查。"""
    headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    file_id = await upload_png(client, headers, name="soft.png", color="blue")

    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert removed.status_code == 200, removed.text
    body = removed.json()
    assert body["id"] == file_id
    assert body["deleted_at"] is not None
    assert body["purge_after"] is not None

    # 记录与文件都还在，只是打上了删除标记。
    async with SessionLocal() as session:
        item = await session.get(FileObject, file_id)
    assert item is not None
    assert item.deleted_at is not None
    assert (settings.upload_dir / f"{file_id}.png").is_file()

    # 软删除后不再对外提供读取。
    assert (await client.get(f"/api/v1/files/images/{file_id}")).status_code == 400
    # 重复删除被拒绝。
    again = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert again.status_code == 409
    assert again.json()["code"] == "FILE_ALREADY_DELETED"

    # 已删除的图片默认不出现在列表，切换 status=deleted 可见。
    active = await client.get("/api/v1/files/images/attachments", headers=admin_headers)
    assert file_id not in [item["id"] for item in active.json()["items"]]
    deleted = await client.get(
        "/api/v1/files/images/attachments?status=deleted", headers=admin_headers
    )
    assert [item["id"] for item in deleted.json()["items"]] == [file_id]


@pytest.mark.asyncio
async def test_deleted_image_can_be_restored_before_cleanup(client: AsyncClient) -> None:
    headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    file_id = await upload_png(client, headers, name="restore.png", color="purple")
    await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)

    restored = await client.post(
        f"/api/v1/files/images/attachments/{file_id}/restore", headers=admin_headers
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["deleted_at"] is None
    assert restored.json()["reference_count"] == 0

    assert (await client.get(f"/api/v1/files/images/{file_id}")).status_code == 200

    forbidden = await client.post(
        f"/api/v1/files/images/attachments/{file_id}/restore",
        headers=await auth_headers(client, "purchase"),
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_soft_deleted_image_is_not_reused_by_upload_dedup(client: AsyncClient) -> None:
    """软删除后重新上传同一张图：不能复用待删除记录（否则凌晨会被连带物理删除）。"""
    headers = await auth_headers(client, "warehouse")
    first_id = await upload_png(client, headers, name="dedup.png", color="teal")
    await client.delete(f"/api/v1/files/images/{first_id}", headers=headers)

    second_id = await upload_png(client, headers, name="dedup.png", color="teal")
    assert second_id != first_id

    async with SessionLocal() as session:
        second = await session.get(FileObject, second_id)
    assert second is not None
    assert second.deleted_at is None


@pytest.mark.asyncio
async def test_cleanup_purges_only_unreferenced_attachments(client: AsyncClient) -> None:
    """凌晨复查：无引用的待删除附件被物理清除；被重新引用的撤销删除。"""
    headers = await auth_headers(client, "warehouse")
    orphan_id = await upload_png(client, headers, name="purge.png", color="brown")
    rescued_id = await upload_png(client, headers, name="rescue.png", color="black")

    await client.delete(f"/api/v1/files/images/{orphan_id}", headers=headers)
    await client.delete(f"/api/v1/files/images/{rescued_id}", headers=headers)

    # 删除之后（当天）又被业务引用：复查必须撤销删除而不是物理清除。
    linked = await client.post(
        "/api/v1/stock-materials",
        headers=headers,
        json={
            "name": "抢救物资",
            "model_spec": "ATT-2",
            "unit_name": "个",
            "remark": None,
            "image_ids": [rescued_id],
        },
    )
    assert linked.status_code == 201, linked.text

    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.scanned == 2
    assert result.purged_file_ids == [orphan_id]
    assert result.purged_file_names == [f"{orphan_id}.png"]
    assert result.restored_file_ids == [rescued_id]

    async with SessionLocal() as session:
        assert await session.get(FileObject, orphan_id) is None
        rescued = await session.get(FileObject, rescued_id)
    assert rescued is not None
    assert rescued.deleted_at is None
    assert not (settings.upload_dir / f"{orphan_id}.png").exists()
    assert (settings.upload_dir / f"{rescued_id}.png").is_file()

    # 幂等：没有待删除附件时再跑一次是空操作。
    assert (await attachment_cleanup_service.cleanup_deleted_attachments_once()).scanned == 0


@pytest.mark.asyncio
async def test_purge_endpoint_requires_super_admin(client: AsyncClient) -> None:
    warehouse_headers = await auth_headers(client, "warehouse")
    file_id = await upload_png(client, warehouse_headers, name="manual.png", color="olive")
    await client.delete(f"/api/v1/files/images/{file_id}", headers=warehouse_headers)

    forbidden = await client.post(
        "/api/v1/files/images/attachments/purge", headers=warehouse_headers
    )
    assert forbidden.status_code == 403

    admin_headers = await auth_headers(client, "admin")
    purged = await client.post("/api/v1/files/images/attachments/purge", headers=admin_headers)
    assert purged.status_code == 200, purged.text
    assert purged.json()["purged_file_ids"] == [file_id]
    assert not (settings.upload_dir / f"{file_id}.png").exists()
