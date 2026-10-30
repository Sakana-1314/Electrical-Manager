"""测试直连数据库用的 ORM 模型：只包含用例读写到的表，列与 init.sql 一致。

数据库默认值（`created_at DEFAULT now()`、`version DEFAULT 1` 等）交给数据库生成，这里只给
init.sql 里没有默认值、又必须由写入方生成的列补默认值（令牌哈希、uuid、usage_hash 等）。
项目域表（带 `project_id`）列在 `PROJECT_SCOPED_MODELS`，由 testkit.project_scope 自动过滤与补全。
"""

from __future__ import annotations

import hashlib
import os
import time
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, BigInteger, ForeignKey, Integer, Numeric, SmallInteger, String, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from tests.testkit.database import Base
from tests.testkit.enums import (
    ExcelExportJobStatus,
    ExcelImportJobStatus,
    PurchasePlanStatus,
    Role,
    ShareType,
    WebhookDeliveryStatus,
    WebhookEventType,
    WebhookPlatform,
)


def uuid7_string() -> str:
    """UUIDv7（毫秒时间戳前缀 + 随机位），与服务端生成的令牌格式一致。"""
    value = (int(time.time() * 1000) << 80) | int.from_bytes(os.urandom(10))
    value = (value & ~(0xF << 76)) | (0x7 << 76)
    value = (value & ~(0x3 << 62)) | (0x2 << 62)
    return str(uuid.UUID(int=value))


NOW = text("now()")


def _enum(enum_cls: type) -> SAEnum:
    """init.sql 已建好同名 ENUM 类型（类名小写），库内存枚举名。"""
    return SAEnum(enum_cls, create_type=False)


class AuditColumns:
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)
    version: Mapped[int] = mapped_column(Integer, server_default="1")


class ProjectScoped:
    project_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("project.id"))


class Project(AuditColumns, Base):
    __tablename__ = "project"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    enabled: Mapped[bool] = mapped_column(server_default="true")
    is_default: Mapped[bool] = mapped_column(server_default="false")
    remark: Mapped[str | None] = mapped_column(String(500))


class User(AuditColumns, Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str] = mapped_column(String(64))
    password_hash: Mapped[str] = mapped_column(String(255))
    api_token_hash: Mapped[str] = mapped_column(
        String(64), default=lambda: hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()
    )
    api_token_enc: Mapped[str] = mapped_column(String(512), server_default="")
    display_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[Role] = mapped_column(_enum(Role))
    enabled: Mapped[bool] = mapped_column(server_default="true")


class MiniProgramUser(AuditColumns, Base):
    __tablename__ = "mini_program_user"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(128))
    department_name: Mapped[str] = mapped_column(
        String(128), server_default="华星检修维护部电气车间"
    )
    enabled: Mapped[bool] = mapped_column(server_default="true")
    last_used_at: Mapped[datetime | None]


class BusinessEventLog(Base):
    __tablename__ = "business_event_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    business_type: Mapped[str] = mapped_column(String(64))
    business_id: Mapped[int] = mapped_column(BigInteger)
    action: Mapped[str] = mapped_column(String(64))
    old_status: Mapped[str | None] = mapped_column(String(32))
    new_status: Mapped[str | None] = mapped_column(String(32))
    occurred_at: Mapped[datetime] = mapped_column(server_default=NOW)
    remark: Mapped[str | None] = mapped_column(String(1000))
    before_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    after_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class SystemSetting(Base):
    __tablename__ = "system_setting"

    setting_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    setting_value: Mapped[dict[str, Any]] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)


class WebhookChannel(AuditColumns, Base):
    __tablename__ = "webhook_channel"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    platform: Mapped[WebhookPlatform] = mapped_column(_enum(WebhookPlatform))
    enabled: Mapped[bool] = mapped_column(server_default="false")
    webhook_url_encrypted: Mapped[str] = mapped_column(String(2000), server_default="")
    secret_encrypted: Mapped[str] = mapped_column(String(2000), server_default="")
    subscribed_events: Mapped[list[str]] = mapped_column(JSON, default=list)


class WebhookDelivery(Base):
    __tablename__ = "webhook_delivery"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    event_id: Mapped[str] = mapped_column(String(36))
    event_type: Mapped[WebhookEventType] = mapped_column(_enum(WebhookEventType))
    channel_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("webhook_channel.id"))
    payload: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[WebhookDeliveryStatus] = mapped_column(
        _enum(WebhookDeliveryStatus), server_default="PENDING"
    )
    attempts: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    next_retry_at: Mapped[datetime] = mapped_column(server_default=NOW)
    response_status: Mapped[int | None]
    response_excerpt: Mapped[str | None] = mapped_column(String(1000))
    last_error: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)
    delivered_at: Mapped[datetime | None]


class FileObject(AuditColumns, Base):
    __tablename__ = "file_object"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(32), default="image/png")
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int]
    height: Mapped[int]
    sha256: Mapped[str] = mapped_column(String(64))
    source_sha256: Mapped[str | None] = mapped_column(String(64))
    source_probes: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    deleted_at: Mapped[datetime | None]


class ExcelImportJob(ProjectScoped, Base):
    __tablename__ = "excel_import_job"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    import_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[ExcelImportJobStatus] = mapped_column(
        _enum(ExcelImportJobStatus), server_default="PENDING"
    )
    original_filename: Mapped[str] = mapped_column(String(255))
    file_path: Mapped[str] = mapped_column(String(500))
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(1000))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)


class ExcelExportJob(ProjectScoped, Base):
    __tablename__ = "excel_export_job"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    export_type: Mapped[str] = mapped_column(String(32))
    status: Mapped[ExcelExportJobStatus] = mapped_column(
        _enum(ExcelExportJobStatus), server_default="PENDING"
    )
    download_filename: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    params: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(1000))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)
    started_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)


class ShareLink(ProjectScoped, Base):
    __tablename__ = "share_link"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    token: Mapped[str] = mapped_column(String(36), default=uuid7_string)
    share_type: Mapped[ShareType] = mapped_column(_enum(ShareType))
    item_ids: Mapped[list[int]] = mapped_column(JSON)
    columns: Mapped[list[str] | None] = mapped_column(JSON)
    expires_at: Mapped[datetime | None]
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(server_default=NOW)


class HuaXingInventory(ProjectScoped, Base):
    __tablename__ = "huaxing_inventory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    first_inbound_date: Mapped[date | None]
    warehouse: Mapped[str | None] = mapped_column(String(128))
    material_code: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(255))
    model_spec: Mapped[str | None] = mapped_column(String(255))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    unit_name: Mapped[str | None] = mapped_column(String(32))
    purchaser: Mapped[str | None] = mapped_column(String(128))
    purchase_department: Mapped[str | None] = mapped_column(String(128))
    subitem_no_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(server_default=NOW)


class StockMaterial(ProjectScoped, AuditColumns, Base):
    __tablename__ = "stock_material"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(128))
    name_id: Mapped[str | None] = mapped_column(String(128))
    alias: Mapped[str | None] = mapped_column(String(128))
    model_spec: Mapped[str] = mapped_column(String(255))
    unit_name: Mapped[str] = mapped_column(String(32))
    remark: Mapped[str | None] = mapped_column(String(1000))
    identity_hash: Mapped[str] = mapped_column(String(64))


class PurchaseMaterial(ProjectScoped, AuditColumns, Base):
    __tablename__ = "purchase_material"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    plan_no: Mapped[str] = mapped_column(String(32))
    plan_date: Mapped[date]
    material_code: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    urgency: Mapped[str] = mapped_column(String(32), server_default="正常")
    demand_department: Mapped[str] = mapped_column(String(128), server_default="HXNI 检修维护部")
    name: Mapped[str] = mapped_column(String(128))
    model_spec: Mapped[str] = mapped_column(String(255))
    unit_name: Mapped[str] = mapped_column(String(32))
    actual_demand_person: Mapped[str] = mapped_column(String(128))
    purchase_responsible: Mapped[str] = mapped_column(String(128))
    planned_qty: Mapped[Decimal] = mapped_column(Numeric(18, 1))
    usage: Mapped[str] = mapped_column(String(500))
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    remark: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_material.id")
    )
    status: Mapped[PurchasePlanStatus] = mapped_column(
        _enum(PurchasePlanStatus), server_default="NORMAL"
    )
    images: Mapped[list[PurchaseMaterialImage]] = relationship(
        lazy="selectin", order_by="PurchaseMaterialImage.sort_order"
    )


class PurchaseMaterialImage(ProjectScoped, Base):
    __tablename__ = "purchase_material_image"

    material_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_material.id"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(SmallInteger, server_default="0")


class PurchasePlanTemplate(ProjectScoped, AuditColumns, Base):
    __tablename__ = "purchase_plan_template"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    material_code: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    urgency: Mapped[str] = mapped_column(String(32), server_default="正常")
    demand_department: Mapped[str] = mapped_column(String(128), server_default="HXNI 检修维护部")
    name: Mapped[str] = mapped_column(String(128))
    model_spec: Mapped[str] = mapped_column(String(255))
    unit_name: Mapped[str] = mapped_column(String(32))
    actual_demand_person: Mapped[str] = mapped_column(String(128))
    purchase_responsible: Mapped[str] = mapped_column(String(128))
    planned_qty: Mapped[Decimal] = mapped_column(Numeric(18, 1))
    usage: Mapped[str] = mapped_column(String(500))
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    remark: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("stock_material.id")
    )


class PurchaseRequest(ProjectScoped, AuditColumns, Base):
    __tablename__ = "purchase_request"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    purchase_order_no: Mapped[str | None] = mapped_column(String(128))
    contract_no: Mapped[str | None] = mapped_column(String(128))
    vessel_no: Mapped[str | None] = mapped_column(String(128))
    consolidation_date: Mapped[date | None]
    consolidation_port: Mapped[str | None] = mapped_column(String(128))
    sailing_date: Mapped[date | None]
    remark: Mapped[str | None] = mapped_column(String(1000))
    purchase_date: Mapped[date | None]


class PurchaseRequestLine(ProjectScoped, AuditColumns, Base):
    __tablename__ = "purchase_request_line"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    purchase_request_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_request.id")
    )
    purchase_material_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("purchase_material.id")
    )
    plan_no_snapshot: Mapped[str] = mapped_column(String(32))
    plan_date_snapshot: Mapped[date]
    material_code_snapshot: Mapped[str | None] = mapped_column(String(64))
    category_snapshot: Mapped[str | None] = mapped_column(String(64))
    demand_department_snapshot: Mapped[str] = mapped_column(String(128))
    material_name_snapshot: Mapped[str] = mapped_column(String(128))
    model_spec_snapshot: Mapped[str] = mapped_column(String(255))
    unit_name_snapshot: Mapped[str] = mapped_column(String(32))
    actual_demand_person_snapshot: Mapped[str] = mapped_column(String(128))
    purchase_responsible_snapshot: Mapped[str] = mapped_column(String(128))
    plan_remark_snapshot: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id_snapshot: Mapped[int | None] = mapped_column(BigInteger)
    purchase_qty: Mapped[Decimal] = mapped_column(Numeric(18, 1))
    status: Mapped[str] = mapped_column(String(128), server_default="已申购")
    usage: Mapped[str] = mapped_column(String(500))
    # usage 的 SHA-256 十六进制前 32 位，进唯一键替代 500 字符的 usage（写 usage 时同步）
    usage_hash: Mapped[str] = mapped_column(String(32))
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    trace_no: Mapped[str | None] = mapped_column(String(128))
    salesperson: Mapped[str | None] = mapped_column(String(128))
    contract_sign_date: Mapped[date | None]
    unit_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))

    @validates("usage")
    def _sync_usage_hash(self, _key: str, value: str) -> str:
        self.usage_hash = hashlib.sha256((value or "").encode("utf-8")).hexdigest()[:32]
        return value


class PurchaseRequestLineImage(ProjectScoped, Base):
    __tablename__ = "purchase_request_line_image"

    line_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("purchase_request_line.id"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(SmallInteger, server_default="0")


class Ledger(ProjectScoped, AuditColumns, Base):
    __tablename__ = "ledger"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    model_spec: Mapped[str] = mapped_column(String(255))
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, server_default="0")
    unit_name: Mapped[str] = mapped_column(String(32))
    usage: Mapped[str] = mapped_column(String(500))
    remark: Mapped[str | None] = mapped_column(String(1000))
    tag_ids: Mapped[str] = mapped_column(String(500), server_default="")


PROJECT_SCOPED_MODELS: tuple[type[Any], ...] = (
    ExcelExportJob,
    ExcelImportJob,
    HuaXingInventory,
    Ledger,
    PurchaseMaterial,
    PurchaseMaterialImage,
    PurchasePlanTemplate,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseRequestLineImage,
    ShareLink,
    StockMaterial,
)
