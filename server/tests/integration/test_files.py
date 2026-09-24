from __future__ import annotations

import hashlib
import io
import random
from datetime import date, datetime, timedelta
from uuid import UUID

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import func, select

from app.core.config import settings
from app.core.constants import SHANGHAI
from app.models import FileObject, PurchaseRequest, PurchaseRequestLine, PurchaseRequestLineImage
from app.services import attachment_cleanup_service, file_service
from app.services.common import utcnow
from tests.conftest import auth_headers, project_session

# 免重复上传的阈值是 1MB：测试里调小阈值，用几十 KB 的等价图片覆盖同一条链路。
SMALL_DEDUP_THRESHOLD = 8 * 1024


def noisy_png(width: int = 96, height: int = 96) -> bytes:
    """确定性噪声图：压缩不掉，字节数稳定，用来造「大于阈值」的图片。"""
    pixels = random.Random(20260913).randbytes(width * height * 3)
    source = io.BytesIO()
    Image.frombytes("RGB", (width, height), pixels).save(source, format="PNG")
    return source.getvalue()


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


async def upload_bytes(
    client: AsyncClient, headers: dict[str, str], raw: bytes, *, name: str = "big.png"
) -> str:
    response = await client.post(
        "/api/v1/files/images",
        headers=headers,
        files={"file": (name, raw, "image/png")},
    )
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def digest_check(
    client: AsyncClient, headers: dict[str, str], *, sha256: str, size_bytes: int
):
    return await client.post(
        "/api/v1/files/images/dedup-check",
        headers=headers,
        json={"sha256": sha256, "size_bytes": size_bytes},
    )


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

    async with project_session() as session:
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
    async with project_session() as session:
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
    """未被引用的图片：删除只是软删除，数据库行与磁盘文件保留到保留期满后的第一个凌晨 2 点。"""
    headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    file_id = await upload_png(client, headers, name="soft.png", color="blue")

    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert removed.status_code == 200, removed.text
    body = removed.json()
    assert body["id"] == file_id
    assert body["deleted_at"] is not None
    # 回执给出的清除时刻 = 提交删除的完整 7 天后的第一个凌晨 2 点（北京时间）
    purge_after = datetime.fromisoformat(body["purge_after"])
    deleted_at = datetime.fromisoformat(body["deleted_at"])
    assert purge_after == file_service.attachment_purge_after(deleted_at)
    assert purge_after.astimezone(SHANGHAI).hour == file_service.ATTACHMENT_PURGE_HOUR
    assert purge_after >= deleted_at + timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS)
    assert purge_after < deleted_at + timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS + 1)

    # 记录与文件都还在，只是打上了删除标记。
    async with project_session() as session:
        item = await session.get(FileObject, file_id)
    assert item is not None
    assert item.deleted_at is not None
    assert (settings.upload_dir / f"{file_id}.png").is_file()

    # 保留期内跑清理任务：复查过但没有到期的，原样保留（不物理清除）。
    kept = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert kept.scanned == 1
    assert kept.purged_file_ids == []
    assert kept.restored_file_ids == []
    async with project_session() as session:
        assert await session.get(FileObject, file_id) is not None
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
async def test_purge_only_after_retention_period(client: AsyncClient) -> None:
    """保留期满（提交删除的完整 7 天后的第一个凌晨 2 点）才由复查任务物理清除。"""
    headers = await auth_headers(client, "warehouse")
    file_id = await upload_png(client, headers, name="retention.png", color="gray")

    removed = await client.delete(f"/api/v1/files/images/{file_id}", headers=headers)
    assert removed.status_code == 200, removed.text

    # 保留期未满（刚过 6 天）：不清除。
    async with project_session() as session:
        item = await session.get(FileObject, file_id)
        assert item is not None
        item.deleted_at = utcnow() - timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS - 1)
        await session.commit()
    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.purged_file_ids == []
    assert (settings.upload_dir / f"{file_id}.png").is_file()

    # 保留期满（超过 7 天）：物理清除数据库行与磁盘文件。
    async with project_session() as session:
        item = await session.get(FileObject, file_id)
        assert item is not None
        item.deleted_at = utcnow() - timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS + 1)
        await session.commit()
    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.purged_file_ids == [file_id]
    assert result.purged_file_names == [f"{file_id}.png"]
    async with project_session() as session:
        assert await session.get(FileObject, file_id) is None
    assert not (settings.upload_dir / f"{file_id}.png").exists()


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

    async with project_session() as session:
        second = await session.get(FileObject, second_id)
    assert second is not None
    assert second.deleted_at is None


@pytest.mark.asyncio
async def test_cleanup_purges_only_unreferenced_attachments(client: AsyncClient) -> None:
    """凌晨复查：保留期满且无引用的待删除附件被物理清除；被重新引用的当场撤销删除。"""
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

    # 保留期内先跑一次：无引用的那张也要继续留着（只复查，不清除）。
    kept = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert kept.scanned == 2
    assert kept.purged_file_ids == []
    assert kept.restored_file_ids == [rescued_id]
    async with project_session() as session:
        assert await session.get(FileObject, orphan_id) is not None
    assert (settings.upload_dir / f"{orphan_id}.png").is_file()

    # 被引用的那张已撤销删除，所以只剩一张候选；把它放到保留期外再复查 → 物理清除。
    async with project_session() as session:
        item = await session.get(FileObject, orphan_id)
        assert item is not None
        item.deleted_at = utcnow() - timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS + 1)
        await session.commit()

    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.scanned == 1
    assert result.purged_file_ids == [orphan_id]
    assert result.purged_file_names == [f"{orphan_id}.png"]
    assert result.restored_file_ids == []

    async with project_session() as session:
        assert await session.get(FileObject, orphan_id) is None
        rescued = await session.get(FileObject, rescued_id)
    assert rescued is not None
    assert rescued.deleted_at is None
    assert not (settings.upload_dir / f"{orphan_id}.png").exists()
    assert (settings.upload_dir / f"{rescued_id}.png").is_file()

    # 幂等：没有待删除附件时再跑一次是空操作。
    assert (await attachment_cleanup_service.cleanup_deleted_attachments_once()).scanned == 0


@pytest.mark.asyncio
async def test_delete_unreferenced_requires_super_admin(client: AsyncClient) -> None:
    warehouse_headers = await auth_headers(client, "warehouse")
    forbidden = await client.post(
        "/api/v1/files/images/attachments/delete-unreferenced", headers=warehouse_headers
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_delete_unreferenced_soft_deletes_only_unreferenced(client: AsyncClient) -> None:
    """「删除未引用」只批量软删除 0 引用的附件：被引用的保持不动，且不物理删除。"""
    headers = await auth_headers(client, "warehouse")
    admin_headers = await auth_headers(client, "admin")
    used_id = await upload_png(client, headers, name="used.png", color="red")
    # 两张未引用图片必须用不同颜色：同色同尺寸会被内容去重成同一个文件。
    free_ids = [
        await upload_png(client, headers, name=f"free-{index}.png", color=color)
        for index, color in enumerate(("green", "blue"))
    ]
    linked = await client.post(
        "/api/v1/stock-materials",
        headers=headers,
        json={
            "name": "批量删除物资",
            "model_spec": "ATT-BULK-1",
            "unit_name": "个",
            "remark": None,
            "image_ids": [used_id],
        },
    )
    assert linked.status_code == 201, linked.text

    response = await client.post(
        "/api/v1/files/images/attachments/delete-unreferenced", headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["deleted_count"] == len(free_ids)
    assert response.json()["purge_after"] is not None

    # 只做软删除：数据库记录与磁盘文件都还在；被引用的图片不受影响。
    async with project_session() as session:
        used = await session.get(FileObject, used_id)
        free = [await session.get(FileObject, file_id) for file_id in free_ids]
    assert used is not None and used.deleted_at is None
    assert all(item is not None and item.deleted_at is not None for item in free)
    for file_id in [used_id, *free_ids]:
        assert (settings.upload_dir / f"{file_id}.png").is_file()

    # 再次执行不会重复计数（已软删除的不再是候选）。
    again = await client.post(
        "/api/v1/files/images/attachments/delete-unreferenced", headers=admin_headers
    )
    assert again.json()["deleted_count"] == 0

    # 保留期内跑复查任务：只复查、不清除（批量删除同样受 7 天保留期约束）。
    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert result.purged_file_ids == []
    async with project_session() as session:
        for file_id in free_ids:
            assert await session.get(FileObject, file_id) is not None

    # 物理删除仍只由保留期满后的凌晨 2 点复查任务执行：把删除时间改到保留期外再跑一次。
    async with project_session() as session:
        for file_id in free_ids:
            item = await session.get(FileObject, file_id)
            assert item is not None
            item.deleted_at = utcnow() - timedelta(days=file_service.ATTACHMENT_RETENTION_DAYS + 1)
        await session.commit()
    result = await attachment_cleanup_service.cleanup_deleted_attachments_once()
    assert sorted(result.purged_file_ids) == sorted(free_ids)
    async with project_session() as session:
        assert await session.get(FileObject, used_id) is not None
        for file_id in free_ids:
            assert await session.get(FileObject, file_id) is None
    assert (settings.upload_dir / f"{used_id}.png").is_file()


@pytest.mark.asyncio
async def test_manual_physical_purge_endpoint_is_gone(client: AsyncClient) -> None:
    """物理删除必须定时执行：不存在手动物理清理接口。"""
    admin_headers = await auth_headers(client, "admin")
    response = await client.post("/api/v1/files/images/attachments/purge", headers=admin_headers)
    # 未匹配路由按全局约定重映射为 400 + ROUTE_NOT_FOUND（项目不对外 404）。
    assert response.status_code == 400
    assert response.json()["code"] == "ROUTE_NOT_FOUND"


@pytest.mark.asyncio
async def test_large_upload_records_source_fingerprint_for_dedup(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """大于阈值的图片：记原始字节摘要 + 中间片段窗口摘要，且磁盘上仍只有重编码后的 PNG。"""
    monkeypatch.setattr(file_service, "DEDUP_MIN_BYTES", SMALL_DEDUP_THRESHOLD)
    headers = await auth_headers(client, "warehouse")
    raw = noisy_png()
    file_id = await upload_bytes(client, headers, raw)

    async with project_session() as session:
        item = await session.get(FileObject, file_id)
    assert item is not None
    assert item.source_sha256 == hashlib.sha256(raw).hexdigest()
    probes = item.source_probes
    assert probes is not None
    assert probes["size"] == len(raw)
    windows = probes["windows"]
    assert len(windows) == 3
    assert len({window["offset"] for window in windows}) == 3
    for window in windows:
        offset, length = window["offset"], window["length"]
        assert len(raw) // 4 <= offset
        assert offset + length <= len(raw) - len(raw) // 4
        assert window["sha256"] == hashlib.sha256(raw[offset : offset + length]).hexdigest()
    # 只留摘要不留原文：磁盘上只有一张重编码的 PNG
    assert [path.name for path in settings.upload_dir.iterdir()] == [f"{file_id}.png"]


@pytest.mark.asyncio
async def test_small_upload_records_no_fingerprint(client: AsyncClient) -> None:
    """不超过 1MB 的图片：不记挑战材料，永远不参与前端查重。"""
    headers = await auth_headers(client, "warehouse")
    file_id = await upload_png(client, headers, name="tiny.png", color="olive")

    async with project_session() as session:
        item = await session.get(FileObject, file_id)
    assert item is not None
    assert item.source_sha256 is None
    assert item.source_probes is None


@pytest.mark.asyncio
async def test_dedup_check_returns_reusable_file_and_middle_slice(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """摘要命中：返回可复用文件 + 一段中间片段的挑战材料（客户端据此本地二次校验）。"""
    monkeypatch.setattr(file_service, "DEDUP_MIN_BYTES", SMALL_DEDUP_THRESHOLD)
    headers = await auth_headers(client, "warehouse")
    raw = noisy_png()
    file_id = await upload_bytes(client, headers, raw)
    digest = hashlib.sha256(raw).hexdigest()

    response = await digest_check(client, headers, sha256=digest, size_bytes=len(raw))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["matched"] is True
    assert body["file"]["id"] == file_id
    assert body["file"]["mime_type"] == "image/png"
    offset, length = body["offset"], body["length"]
    # 窗口长度取「64 KiB」与「文件 1/4」中较小者（测试里阈值调小，图片不到 4×64 KiB）
    assert length == min(file_service.PROBE_WINDOW_BYTES, len(raw) // 4)
    assert len(raw) // 4 <= offset
    assert offset + length <= len(raw) - len(raw) // 4
    assert body["slice_sha256"] == hashlib.sha256(raw[offset : offset + length]).hexdigest()

    # 服务端是「随机挑一个已记录的窗口」：把它固定成最后一个窗口，结果必须与之完全一致
    async with project_session() as session:
        item = await session.get(FileObject, file_id)
    assert item is not None and item.source_probes is not None
    last = item.source_probes["windows"][-1]
    monkeypatch.setattr(file_service.secrets, "choice", lambda candidates: candidates[-1])
    again = await digest_check(client, headers, sha256=digest.upper(), size_bytes=len(raw))
    assert again.status_code == 200, again.text
    assert again.json()["offset"] == last["offset"]
    assert again.json()["length"] == last["length"]
    assert again.json()["slice_sha256"] == last["sha256"]


@pytest.mark.asyncio
async def test_dedup_check_misses_unknown_digest_or_size(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """摘要不存在、字节数对不上：都算未命中（客户端退回正常上传），不报错也不返回 404。"""
    monkeypatch.setattr(file_service, "DEDUP_MIN_BYTES", SMALL_DEDUP_THRESHOLD)
    headers = await auth_headers(client, "warehouse")
    raw = noisy_png()
    await upload_bytes(client, headers, raw)
    digest = hashlib.sha256(raw).hexdigest()

    unknown = await digest_check(client, headers, sha256="0" * 64, size_bytes=len(raw))
    assert unknown.status_code == 200, unknown.text
    assert unknown.json() == {
        "matched": False,
        "file": None,
        "offset": None,
        "length": None,
        "slice_sha256": None,
    }

    wrong_size = await digest_check(client, headers, sha256=digest, size_bytes=len(raw) + 1)
    assert wrong_size.status_code == 200, wrong_size.text
    assert wrong_size.json()["matched"] is False


@pytest.mark.asyncio
async def test_dedup_check_skips_deleted_or_missing_files(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """已软删除、磁盘文件缺失的行都不能复用（复用回去的图片会打不开）。"""
    monkeypatch.setattr(file_service, "DEDUP_MIN_BYTES", SMALL_DEDUP_THRESHOLD)
    headers = await auth_headers(client, "warehouse")

    deleted_raw = noisy_png()
    deleted_id = await upload_bytes(client, headers, deleted_raw, name="deleted.png")
    removed = await client.delete(f"/api/v1/files/images/{deleted_id}", headers=headers)
    assert removed.status_code == 200, removed.text
    soft_deleted = await digest_check(
        client, headers, sha256=hashlib.sha256(deleted_raw).hexdigest(), size_bytes=len(deleted_raw)
    )
    assert soft_deleted.status_code == 200, soft_deleted.text
    assert soft_deleted.json()["matched"] is False

    other_raw = noisy_png(width=80, height=80)
    missing_id = await upload_bytes(client, headers, other_raw, name="missing.png")
    (settings.upload_dir / f"{missing_id}.png").unlink()
    missing = await digest_check(
        client, headers, sha256=hashlib.sha256(other_raw).hexdigest(), size_bytes=len(other_raw)
    )
    assert missing.status_code == 200, missing.text
    assert missing.json()["matched"] is False


@pytest.mark.asyncio
async def test_dedup_check_requires_image_writer(client: AsyncClient) -> None:
    """查重与上传同权限：未认证 401，只读角色 403。"""
    payload = {"sha256": "a" * 64, "size_bytes": 1024}

    anonymous = await client.post("/api/v1/files/images/dedup-check", json=payload)
    assert anonymous.status_code == 401

    readonly = await auth_headers(client, "readonly")
    forbidden = await client.post(
        "/api/v1/files/images/dedup-check", headers=readonly, json=payload
    )
    assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_dedup_check_validates_payload(client: AsyncClient) -> None:
    """摘要必须是 64 位十六进制、字节数必须为 1..10MB。"""
    headers = await auth_headers(client, "warehouse")

    for payload in (
        {"sha256": "not-a-digest", "size_bytes": 1024},
        {"sha256": "a" * 64, "size_bytes": 0},
        {"sha256": "a" * 64, "size_bytes": settings.max_image_bytes + 1},
    ):
        response = await client.post(
            "/api/v1/files/images/dedup-check", headers=headers, json=payload
        )
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "VALIDATION_ERROR"
