from __future__ import annotations

import hashlib
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.dialects.mysql import BIGINT, DATETIME, TINYINT
from sqlalchemy.dialects.mysql import INTEGER as MYSQL_INTEGER
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base
from app.core.identifiers import uuid7_string
from app.core.project_scope import current_project_id
from app.domain.enums import (
    ExcelExportJobStatus,
    ExcelImportJobStatus,
    HazardLevel,
    HazardStatus,
    OperationType,
    PurchasePlanStatus,
    Role,
    ShareType,
    SourceType,
    WebhookDeliveryStatus,
    WebhookEventType,
    WebhookPlatform,
)

BIGINT_ID = BIGINT(unsigned=True).with_variant(Integer, "sqlite")
UINT = MYSQL_INTEGER(unsigned=True).with_variant(Integer, "sqlite")
UTINYINT = TINYINT(unsigned=True).with_variant(SmallInteger, "sqlite")
UTC_DATETIME = DATETIME(fsp=6).with_variant(DateTime(timezone=False), "sqlite")
QTY = Numeric(18, 1)


def _utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _hash_api_token(token: str) -> str:
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class AuditMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow
    )
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1")


class ProjectScoped:
    """项目域数据混入：所有业务表都带 `project_id`，由全局隔离层自动读写。

    `default=current_project_id` 让 Core `insert()`（Excel 导入的批量插入）也能从当前
    上下文补上项目；上下文缺失时直接报 `PROJECT_REQUIRED`，绝不静默落到某个项目。
    """

    project_id: Mapped[int] = mapped_column(
        BIGINT_ID,
        ForeignKey("project.id"),
        nullable=False,
        index=True,
        default=current_project_id,
    )


class Project(AuditMixin, Base):
    """项目：业务数据的隔离维度，对外只用名称，标识是内部自增 id（不对外暴露）。

    `is_default` 标记唯一的默认项目：小程序 / MCP 未指定项目时的兜底，由 service 保证
    「至多一个默认」；默认项目不可停用、不可删除，也不可把停用的项目设为默认。
    名称是唯一的人读标识，因此建库级唯一约束，避免切换器里出现两个同名项目。
    """

    __tablename__ = "project"
    __table_args__ = (UniqueConstraint("name", name="uq_project_name"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    remark: Mapped[str | None] = mapped_column(String(500))


class User(Base):
    __tablename__ = "user"
    __allow_unmapped__ = True

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # 接口令牌双列存储（AGENTS.md「回显约定」）：哈希用于认证快速查找（不可逆），
    # Fernet 密文用于可逆还原，读取接口每次解密回显，避免用户反复重新生成令牌。
    api_token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, default=lambda: _hash_api_token(str(uuid4()))
    )
    api_token_enc: Mapped[str] = mapped_column(
        String(512), nullable=False, default="", server_default=""
    )
    # 非持久化字段：承载刚生成或读取时解密出的明文令牌，用于 DTO 回显。
    api_token: str | None = None
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[Role] = mapped_column(SAEnum(Role), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow
    )
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1")


class MiniProgramUser(AuditMixin, Base):
    __tablename__ = "mini_program_user"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    department_name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        default="华星检修维护部电气车间",
        server_default="华星检修维护部电气车间",
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    # 最近一次登录小程序的时间（管理端「小程序用户」页展示的活跃度依据）。
    # 写它时不自增 version：用户每次打开小程序都会刷新，递增会让管理端乐观锁频繁失效。
    last_used_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True)
    identities: Mapped[list[MiniProgramIdentity]] = relationship(
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="MiniProgramIdentity.app_id",
    )


class MiniProgramIdentity(AuditMixin, Base):
    __tablename__ = "mini_program_identity"
    __table_args__ = (
        UniqueConstraint("app_id", "wechat_openid"),
        UniqueConstraint("mini_program_user_id", "app_id"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    mini_program_user_id: Mapped[int] = mapped_column(
        BIGINT_ID,
        ForeignKey("mini_program_user.id", ondelete="CASCADE"),
        nullable=False,
    )
    app_id: Mapped[str] = mapped_column(String(64), nullable=False)
    wechat_openid: Mapped[str] = mapped_column(String(128), nullable=False)
    user: Mapped[MiniProgramUser] = relationship(back_populates="identities")


class MaterialCodeLibrary(ProjectScoped, Base):
    __tablename__ = "material_code_library"
    # 编码库按项目唯一：不同项目的物料编码库互不干扰（导入是整项目替换）。
    __table_args__ = (
        UniqueConstraint(
            "project_id", "material_code", name="uq_material_code_library_project_material_code"
        ),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    material_code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str | None] = mapped_column(String(128))
    model_spec: Mapped[str | None] = mapped_column(String(255))
    unit_name: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now()
    )


class ExcelImportJob(ProjectScoped, Base):
    __tablename__ = "excel_import_job"
    __table_args__ = (Index("ix_excel_import_job_type_status", "import_type", "status", "id"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    import_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[ExcelImportJobStatus] = mapped_column(
        SAEnum(ExcelImportJobStatus),
        nullable=False,
        default=ExcelImportJobStatus.PENDING,
        server_default=ExcelImportJobStatus.PENDING.value,
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(1000))
    created_by: Mapped[int | None] = mapped_column(BIGINT_ID, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)
    finished_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_utcnow,
        server_default=func.now(),
        onupdate=_utcnow,
        nullable=False,
    )


class HuaXingInventory(ProjectScoped, Base):
    __tablename__ = "huaxing_inventory"
    # 首次入库日期是列表页的区间筛选条件，单独建索引（其余字段只做文本包含匹配）。
    __table_args__ = (Index("ix_huaxing_inventory_first_inbound_date", "first_inbound_date"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    first_inbound_date: Mapped[date | None] = mapped_column(Date)
    warehouse: Mapped[str | None] = mapped_column(String(128))
    material_code: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(255))
    model_spec: Mapped[str | None] = mapped_column(String(255))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    unit_name: Mapped[str | None] = mapped_column(String(32))
    purchaser: Mapped[str | None] = mapped_column(String(128))
    purchase_department: Mapped[str | None] = mapped_column(String(128))
    subitem_no_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )


class LiteInventory(ProjectScoped, Base):
    """精简二级库：Excel 一次性全量导入 + 只读查询（独立于完整模式 stock_material 等表）。

    仅当二级库处于精简模式时被读取/写入；完整模式数据不受影响。
    """

    __tablename__ = "lite_inventory"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec: Mapped[str | None] = mapped_column(String(255))
    unit_name: Mapped[str | None] = mapped_column(String(32))
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(18, 2))
    remark: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )


class ExcelExportJob(ProjectScoped, Base):
    """异步 Excel 导出任务（申购记录 / 申购计划结果导出共用）。

    与 excel_import_job 对称：PENDING → RUNNING → SUCCEEDED | FAILED。
    区别在于文件方向相反——file_path 指向后台生成的待下载文件（成功保留至保留期，
    失败/过期由 excel_export_job_service 清理），download_filename 为下载文件名。
    """

    __tablename__ = "excel_export_job"
    __table_args__ = (
        Index("ix_excel_export_job_type_status", "export_type", "status", "id"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    export_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[ExcelExportJobStatus] = mapped_column(
        SAEnum(ExcelExportJobStatus),
        nullable=False,
        default=ExcelExportJobStatus.PENDING,
        server_default=ExcelExportJobStatus.PENDING.value,
    )
    download_filename: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))

    @property
    def file_uuid(self) -> str | None:
        """导出文件 uuid（exports 目录文件名去掉 .xlsx 后缀）；无文件时为 None。

        下载端点按此 uuid 匿名访问（uuid7 不可猜解），故无需独立 DB 列。
        """
        if not self.file_path:
            return None
        name = Path(self.file_path).name
        return name.removesuffix(".xlsx") if name.endswith(".xlsx") else None
    # 导出请求参数快照（筛选条件/列），用于排查与潜在的重跑。
    params: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    error_message: Mapped[str | None] = mapped_column(String(1000))
    created_by: Mapped[int | None] = mapped_column(BIGINT_ID, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)
    finished_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_utcnow,
        server_default=func.now(),
        onupdate=_utcnow,
        nullable=False,
    )


class FileObject(AuditMixin, Base):
    __tablename__ = "file_object"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(32), nullable=False, default="image/png")
    size_bytes: Mapped[int] = mapped_column(BIGINT_ID, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 软删除时间：非空表示已提交删除、等待次日凌晨 2 点的引用复查，
    # 复查确认仍无任何引用后才物理删除数据库行与磁盘文件（见 attachment_cleanup_service）。
    deleted_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME, nullable=True, index=True)


class StockMaterial(ProjectScoped, AuditMixin, Base):
    __tablename__ = "stock_material"
    # 项目域唯一：同一项目内「名称 + 型号 + 单位」唯一，不同项目可各有一份同名物资。
    __table_args__ = (
        UniqueConstraint(
            "project_id", "identity_hash", name="uq_stock_material_project_identity_hash"
        ),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    uuid: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid4())
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    name_id: Mapped[str | None] = mapped_column(String(128))
    alias: Mapped[str | None] = mapped_column(String(128))
    model_spec: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(32), nullable=False)
    remark: Mapped[str | None] = mapped_column(String(1000))
    identity_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    balance: Mapped[StockBalance | None] = relationship(
        back_populates="material", uselist=False, lazy="selectin", cascade="all, delete-orphan"
    )
    replenishment_policy: Mapped[StockReplenishmentPolicy | None] = relationship(
        back_populates="material", uselist=False, lazy="selectin", cascade="all, delete-orphan"
    )
    images: Mapped[list[StockMaterialImage]] = relationship(
        back_populates="material",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="StockMaterialImage.sort_order",
    )


class StockMaterialImage(ProjectScoped, Base):
    __tablename__ = "stock_material_image"

    material_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    material: Mapped[StockMaterial] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class StockReplenishmentPolicy(ProjectScoped, Base):
    __tablename__ = "stock_replenishment_policy"
    __table_args__ = (CheckConstraint("minimum_qty >= 0", name="minimum_nonnegative"),)

    stock_material_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id", ondelete="CASCADE"), primary_key=True
    )
    minimum_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow
    )
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1")
    material: Mapped[StockMaterial] = relationship(back_populates="replenishment_policy")


class StockBalance(ProjectScoped, Base):
    __tablename__ = "stock_balance"

    stock_material_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id", ondelete="CASCADE"), primary_key=True
    )
    quantity: Mapped[Decimal] = mapped_column(QTY, default=Decimal("0"), server_default="0")
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow
    )
    material: Mapped[StockMaterial] = relationship(back_populates="balance")


class PurchaseMaterial(ProjectScoped, AuditMixin, Base):
    __tablename__ = "purchase_material"
    # 计划号按项目唯一：编号规则是「本项目当天 MAX + 1」，跨项目必须允许同号。
    __table_args__ = (
        UniqueConstraint("project_id", "plan_no", name="uq_purchase_material_project_plan_no"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    plan_no: Mapped[str] = mapped_column(String(32), nullable=False)
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    material_code: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    urgency: Mapped[str] = mapped_column(
        String(32), nullable=False, default="正常", server_default="正常"
    )
    demand_department: Mapped[str] = mapped_column(
        String(128), nullable=False, default="HXNI 检修维护部", server_default="HXNI 检修维护部"
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(32), nullable=False)
    actual_demand_person: Mapped[str] = mapped_column(String(128), nullable=False)
    purchase_responsible: Mapped[str] = mapped_column(String(128), nullable=False)
    planned_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    usage: Mapped[str] = mapped_column(String(500), nullable=False)
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    remark: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id: Mapped[int | None] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id"), index=True
    )
    status: Mapped[PurchasePlanStatus] = mapped_column(
        SAEnum(PurchasePlanStatus),
        nullable=False,
        default=PurchasePlanStatus.NORMAL,
        server_default=PurchasePlanStatus.NORMAL.name,
        index=True,
    )
    stock_material: Mapped[StockMaterial | None] = relationship(lazy="selectin")
    images: Mapped[list[PurchaseMaterialImage]] = relationship(
        back_populates="material",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PurchaseMaterialImage.sort_order",
    )


class PurchaseMaterialImage(ProjectScoped, Base):
    __tablename__ = "purchase_material_image"

    material_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("purchase_material.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    material: Mapped[PurchaseMaterial] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class PurchasePlanTemplate(ProjectScoped, AuditMixin, Base):
    """周期性计划（申购计划模板）：字段与申购计划对齐，供手动一键生成申购计划。

    生成时复制为 purchase_material（plan_no/plan_date/status 在生成时赋值），
    模板本身不删除、可反复使用；生成日期取生成当天（北京时间）。
    """

    __tablename__ = "purchase_plan_template"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    material_code: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(64))
    urgency: Mapped[str] = mapped_column(
        String(32), nullable=False, default="正常", server_default="正常"
    )
    demand_department: Mapped[str] = mapped_column(
        String(128), nullable=False, default="HXNI 检修维护部", server_default="HXNI 检修维护部"
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_name: Mapped[str] = mapped_column(String(32), nullable=False)
    actual_demand_person: Mapped[str] = mapped_column(String(128), nullable=False)
    purchase_responsible: Mapped[str] = mapped_column(String(128), nullable=False)
    planned_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    usage: Mapped[str] = mapped_column(String(500), nullable=False)
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    remark: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id: Mapped[int | None] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id"), index=True
    )
    stock_material: Mapped[StockMaterial | None] = relationship(lazy="selectin")
    images: Mapped[list[PurchasePlanTemplateImage]] = relationship(
        back_populates="template",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PurchasePlanTemplateImage.sort_order",
    )


class PurchasePlanTemplateImage(ProjectScoped, Base):
    __tablename__ = "purchase_plan_template_image"

    plan_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("purchase_plan_template.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    template: Mapped[PurchasePlanTemplate] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class PurchaseRequest(ProjectScoped, AuditMixin, Base):
    __tablename__ = "purchase_request"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    purchase_order_no: Mapped[str | None] = mapped_column(String(128))
    contract_no: Mapped[str | None] = mapped_column(String(128))
    vessel_no: Mapped[str | None] = mapped_column(String(128))
    consolidation_date: Mapped[date | None] = mapped_column(Date)
    consolidation_port: Mapped[str | None] = mapped_column(String(128))
    sailing_date: Mapped[date | None] = mapped_column(Date)
    remark: Mapped[str | None] = mapped_column(String(1000))
    purchase_date: Mapped[date | None] = mapped_column(Date)

    lines: Mapped[list[PurchaseRequestLine]] = relationship(
        back_populates="request",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PurchaseRequestLine.id",
    )


class PurchaseRequestLine(ProjectScoped, AuditMixin, Base):
    __tablename__ = "purchase_request_line"
    __table_args__ = (
        CheckConstraint("purchase_qty > 0", name="purchase_positive"),
        # usage 最长 500 字符，直接进唯一索引浪费空间；改用 usage_hash 保持等值语义。
        UniqueConstraint(
            "purchase_request_id", "purchase_material_id", "subitem_no", "usage_hash"
        ),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    purchase_request_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("purchase_request.id", ondelete="CASCADE"), nullable=False
    )
    purchase_material_id: Mapped[int | None] = mapped_column(
        BIGINT_ID, ForeignKey("purchase_material.id", ondelete="SET NULL")
    )
    # 记录自包含快照：转入时从计划复制，读路径不再依赖 purchase_material（清理计划后仍可读）
    plan_no_snapshot: Mapped[str] = mapped_column(String(32), nullable=False)
    plan_date_snapshot: Mapped[date] = mapped_column(Date, nullable=False)
    material_code_snapshot: Mapped[str | None] = mapped_column(String(64))
    category_snapshot: Mapped[str | None] = mapped_column(String(64))
    demand_department_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    material_name_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_name_snapshot: Mapped[str] = mapped_column(String(32), nullable=False)
    actual_demand_person_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    purchase_responsible_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    plan_remark_snapshot: Mapped[str | None] = mapped_column(String(1000))
    stock_material_id_snapshot: Mapped[int | None] = mapped_column(BIGINT_ID)
    purchase_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    status: Mapped[str] = mapped_column(String(128), nullable=False, default="已申购")
    usage: Mapped[str] = mapped_column(String(500), nullable=False)
    # usage 的归一化哈希（SHA-256 十六进制前 32 位），进唯一索引以替代 500 字符的 usage。
    usage_hash: Mapped[str] = mapped_column(String(32), nullable=False)
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    trace_no: Mapped[str | None] = mapped_column(String(128), index=True)
    salesperson: Mapped[str | None] = mapped_column(String(128))
    # 合同签订日期为物资级字段：同一申购单下不同物资可分别签订，故挂在行表而非头表。
    contract_sign_date: Mapped[date | None] = mapped_column(Date)

    @validates("usage")
    def _sync_usage_hash(self, _key: str, value: str) -> str:
        usage = value if isinstance(value, str) else (value or "")
        self.usage_hash = hashlib.sha256(usage.encode("utf-8")).hexdigest()[:32]
        return value

    request: Mapped[PurchaseRequest] = relationship(back_populates="lines", lazy="selectin")
    purchase_material: Mapped[PurchaseMaterial | None] = relationship(lazy="selectin")
    images: Mapped[list[PurchaseRequestLineImage]] = relationship(
        back_populates="line",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="PurchaseRequestLineImage.sort_order",
    )


class PurchaseRequestLineImage(ProjectScoped, Base):
    __tablename__ = "purchase_request_line_image"

    line_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("purchase_request_line.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    line: Mapped[PurchaseRequestLine] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class StockOperation(ProjectScoped, AuditMixin, Base):
    __tablename__ = "stock_operation"
    __table_args__ = (
        # 操作单号 / 幂等键按项目唯一：不同项目的流水互不干扰，同号允许并存。
        UniqueConstraint(
            "project_id", "operation_no", name="uq_stock_operation_project_operation_no"
        ),
        UniqueConstraint(
            "project_id",
            "client_request_id",
            name="uq_stock_operation_project_client_request_id",
        ),
        Index("ix_stock_operation_type_occurred", "operation_type", "occurred_at"),
        Index("ix_stock_operation_source_occurred", "source_type", "occurred_at"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    operation_no: Mapped[str] = mapped_column(String(32), nullable=False)
    operation_type: Mapped[OperationType] = mapped_column(SAEnum(OperationType), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(UTC_DATETIME, nullable=False, index=True)
    business_reason: Mapped[str] = mapped_column(String(500), nullable=False)
    receiver_unit: Mapped[str | None] = mapped_column(String(128))
    receiver_name: Mapped[str | None] = mapped_column(String(64))
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    source_type: Mapped[SourceType] = mapped_column(SAEnum(SourceType), nullable=False)
    reversal_of_id: Mapped[int | None] = mapped_column(
        BIGINT_ID, ForeignKey("stock_operation.id"), index=True
    )
    client_request_id: Mapped[str] = mapped_column(String(64), nullable=False)
    mini_program_user_name_snapshot: Mapped[str | None] = mapped_column(String(128))

    lines: Mapped[list[StockOperationLine]] = relationship(
        back_populates="operation",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="StockOperationLine.id",
    )


class StockOperationLine(ProjectScoped, AuditMixin, Base):
    __tablename__ = "stock_operation_line"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="operation_quantity_positive"),
        UniqueConstraint("operation_id", "stock_material_id"),
        Index("ix_operation_line_material_operation", "stock_material_id", "operation_id"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    operation_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("stock_operation.id", ondelete="CASCADE"), nullable=False
    )
    stock_material_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("stock_material.id"), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    remaining_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    before_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    after_qty: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    material_name_snapshot: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_name_snapshot: Mapped[str] = mapped_column(String(32), nullable=False)

    operation: Mapped[StockOperation] = relationship(back_populates="lines")
    stock_material: Mapped[StockMaterial] = relationship(lazy="selectin")


class ShareLink(ProjectScoped, Base):
    """匿名分享链接：把勾选的申购计划/申购记录分享为无鉴权页面。

    与导出文件的匿名下载同一信任模型——安全性依赖 token 为 UUIDv7（不可猜解），
    且匿名读取端点仅按 token 返回该分享的数据。expires_at 为空表示永久有效；
    过期后读取端点拒绝访问，行由 share_link_service 定期清理。
    """

    __tablename__ = "share_link"
    __table_args__ = (Index("ix_share_link_expires_at", "expires_at"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(
        String(36), unique=True, nullable=False, default=uuid7_string
    )
    share_type: Mapped[ShareType] = mapped_column(SAEnum(ShareType), nullable=False, index=True)
    # 被分享的数据行 id（申购计划 id / 申购记录 line_id），读取时按 id 实时查库快照。
    item_ids: Mapped[list[int]] = mapped_column(JSON, nullable=False)
    # 分享页展示列（键名）；NULL = 展示该类型全部默认列，否则仅展示列出的列。
    columns: Mapped[list[str] | None] = mapped_column(JSON)
    # 失效时间；NULL = 永久有效。
    expires_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)
    created_by: Mapped[int | None] = mapped_column(BIGINT_ID, ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_utcnow,
        server_default=func.now(),
        onupdate=_utcnow,
        nullable=False,
    )


class BusinessEventLog(Base):
    __tablename__ = "business_event_log"
    __table_args__ = (Index("ix_business_event_entity", "business_type", "business_id", "id"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    business_type: Mapped[str] = mapped_column(String(64), nullable=False)
    business_id: Mapped[int] = mapped_column(BIGINT_ID, nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    old_status: Mapped[str | None] = mapped_column(String(32))
    new_status: Mapped[str | None] = mapped_column(String(32))
    occurred_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    remark: Mapped[str | None] = mapped_column(String(1000))
    before_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    after_data: Mapped[dict[str, Any] | None] = mapped_column(JSON)


class Memo(Base):
    """管理端个人备忘录：纯文本记录，一级 tab 快捷切换多条。

    按创建人（created_by）隔离：每个登录用户只能看到和操作自己的备忘录，
    不随系统管理员共享；删除用户时级联删除其备忘录。
    """

    __tablename__ = "memo"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="未命名备忘录",
        server_default="未命名备忘录",
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    created_by: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME,
        default=_utcnow,
        server_default=func.now(),
        onupdate=_utcnow,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1", nullable=False)


class SystemSetting(Base):
    """系统设置键值表：替代把配置塞进 business_event_log 的做法。"""

    __tablename__ = "system_setting"

    setting_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    setting_value: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(UINT, default=1, server_default="1", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow
    )


class WebhookChannel(AuditMixin, Base):
    __tablename__ = "webhook_channel"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    platform: Mapped[WebhookPlatform] = mapped_column(
        SAEnum(WebhookPlatform), unique=True, nullable=False
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    webhook_url_encrypted: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    secret_encrypted: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    subscribed_events: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)


class WebhookDelivery(Base):
    __tablename__ = "webhook_delivery"
    __table_args__ = (
        UniqueConstraint("event_id", "channel_id"),
        Index("ix_webhook_delivery_pending", "status", "next_retry_at", "id"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False)
    event_type: Mapped[WebhookEventType] = mapped_column(SAEnum(WebhookEventType), nullable=False)
    channel_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("webhook_channel.id"), nullable=False
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    status: Mapped[WebhookDeliveryStatus] = mapped_column(
        SAEnum(WebhookDeliveryStatus),
        nullable=False,
        default=WebhookDeliveryStatus.PENDING,
        server_default=WebhookDeliveryStatus.PENDING.value,
    )
    attempts: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0, server_default="0")
    next_retry_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    response_status: Mapped[int | None] = mapped_column(Integer)
    response_excerpt: Mapped[str | None] = mapped_column(String(1000))
    last_error: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTC_DATETIME, default=_utcnow, server_default=func.now(), onupdate=_utcnow, nullable=False
    )
    delivered_at: Mapped[datetime | None] = mapped_column(UTC_DATETIME)

    channel: Mapped[WebhookChannel] = relationship(lazy="joined")


class HazardUnit(ProjectScoped, AuditMixin, Base):
    """隐患责任单位：每个单位对应一个责任人，隐患登记时按单位带出责任人快照。

    停用（enabled=False）的单位不再出现在新增隐患的下拉里，但历史隐患仍保留其名称快照。
    单位名称按项目唯一。
    """

    __tablename__ = "hazard_unit"
    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_hazard_unit_project_name"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    person: Mapped[str] = mapped_column(String(64), nullable=False)
    remark: Mapped[str | None] = mapped_column(String(255))
    enabled: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1", nullable=False
    )


class HazardType(ProjectScoped, AuditMixin, Base):
    """隐患类型：一行一个「大类 + 小类」组合，无父子层级，同一组合在项目内唯一。

    隐患只引用本表 id；删除为物理删除，删除前校验是否被隐患引用。
    """

    __tablename__ = "hazard_type"
    __table_args__ = (
        UniqueConstraint("project_id", "major", "minor", name="uq_hazard_type_project_major"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    major: Mapped[str] = mapped_column(String(128), nullable=False)
    minor: Mapped[str] = mapped_column(String(128), nullable=False)


class Hazard(ProjectScoped, AuditMixin, Base):
    """隐患台账主表：检查信息 + 责任单位与责任人快照 + 整改前/后图片 + 整改状态。

    责任人（person）是登记时从责任单位带出的快照，之后单位换人不会回写历史隐患；
    整改前/后图片各一张关联表（`hazard_before_image` / `hazard_after_image`），
    附件管理按这两张表统计引用次数。
    """

    __tablename__ = "hazard"
    __table_args__ = (
        UniqueConstraint(
            "project_id", "client_request_id", name="uq_hazard_project_client_request_id"
        ),
        Index("ix_hazard_unit_id", "hazard_unit_id"),
        Index("ix_hazard_type_id", "hazard_type_id"),
        Index("ix_hazard_status", "status"),
        Index("ix_hazard_due_date", "due_date"),
    )

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    inspection_area: Mapped[str] = mapped_column(
        String(128), nullable=False, default="华星现场", server_default="华星现场"
    )
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    inspector: Mapped[str] = mapped_column(
        String(64), nullable=False, default="电气自查", server_default="电气自查"
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    suggestion: Mapped[str | None] = mapped_column(Text)
    hazard_unit_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("hazard_unit.id"), nullable=False
    )
    # 责任人快照：登记时取自责任单位，之后单位换人不回写历史隐患。
    person: Mapped[str] = mapped_column(String(64), nullable=False, default="", server_default="")
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    recheck_person: Mapped[str | None] = mapped_column(String(64))
    # 整改员工：实际执行整改的员工，可选（与责任人/复查人都不是同一概念）。
    rectify_person: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[HazardStatus] = mapped_column(
        SAEnum(HazardStatus),
        nullable=False,
        default=HazardStatus.PENDING,
        server_default=HazardStatus.PENDING.value,
    )
    hazard_type_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("hazard_type.id"), nullable=False
    )
    level: Mapped[HazardLevel] = mapped_column(
        SAEnum(HazardLevel),
        nullable=False,
        default=HazardLevel.GENERAL,
        server_default=HazardLevel.GENERAL.value,
    )
    remark: Mapped[str | None] = mapped_column(Text)
    # 小程序登记的幂等键（形如 `mp-<时间戳>-<随机串>`）：手机端弱网重试时避免重复登记；
    # 网页端登记留空。它也用来区分「小程序登记」与「后台登记」的来源。
    client_request_id: Mapped[str | None] = mapped_column(String(64))

    unit: Mapped[HazardUnit] = relationship(lazy="selectin")
    hazard_type: Mapped[HazardType] = relationship(lazy="selectin")
    before_images: Mapped[list[HazardBeforeImage]] = relationship(
        back_populates="hazard",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="HazardBeforeImage.sort_order",
    )
    after_images: Mapped[list[HazardAfterImage]] = relationship(
        back_populates="hazard",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="HazardAfterImage.sort_order",
    )


class HazardBeforeImage(ProjectScoped, Base):
    """隐患「整改前」图片关联：一张图一行，sort_order 保留上传顺序。"""

    __tablename__ = "hazard_before_image"

    hazard_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("hazard.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    hazard: Mapped[Hazard] = relationship(back_populates="before_images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class HazardAfterImage(ProjectScoped, Base):
    """隐患「整改后」图片关联：与整改前分表，便于附件管理分别统计引用次数。"""

    __tablename__ = "hazard_after_image"

    hazard_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("hazard.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    hazard: Mapped[Hazard] = relationship(back_populates="after_images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class LedgerTag(ProjectScoped, AuditMixin, Base):
    """台账标签节点：自引用邻接表，至多 3 层（根节点 `parent_id IS NULL`）。

    层级上限与「同级名称唯一」都由 service 校验：MySQL 唯一索引对 `parent_id IS NULL`
    不去重，覆盖不到根节点，所以不建库级唯一索引，让这两条规则只有一处实现。
    节点为物理删除，有子节点或已被台账记录引用时由 service 返回 409 拦截。
    """

    __tablename__ = "ledger_tag"
    __table_args__ = (Index("ix_ledger_tag_parent_id", "parent_id"),)

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    parent_id: Mapped[int | None] = mapped_column(
        BIGINT_ID, ForeignKey("ledger_tag.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # 备注与图片供标签节点悬停浮层展示。
    remark: Mapped[str | None] = mapped_column(String(500))

    parent: Mapped[LedgerTag | None] = relationship(
        back_populates="children", remote_side="LedgerTag.id", lazy="selectin"
    )
    children: Mapped[list[LedgerTag]] = relationship(
        back_populates="parent", lazy="selectin", order_by="LedgerTag.id"
    )
    images: Mapped[list[LedgerTagImage]] = relationship(
        back_populates="tag",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="LedgerTagImage.sort_order",
    )


class LedgerTagImage(ProjectScoped, Base):
    """标签节点图片关联：一个节点最多 9 张，sort_order 保留上传顺序。"""

    __tablename__ = "ledger_tag_image"

    tag_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("ledger_tag.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    tag: Mapped[LedgerTag] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


class Ledger(ProjectScoped, AuditMixin, Base):
    """台账记录：电气台账总览的一行。

    字段：名称 / 型号 / 子项号 / 数量 / 单位 / 用途 / 备注 + 标签 + 图片。

    单位与数量一起展示（界面按「12 台」呈现），子项号沿用申购计划的技改项目子项号口径。

    `tag_ids` 是英文逗号分隔的标签 id（如 `3,12,15`），由 service 统一规范化写入
    （去重、升序、无空格；空串表示未挂标签）。按标签筛选时用「左右补逗号再精确命中」
    表达集合成员关系，MySQL 与测试库 SQLite 能编译出同一条语义的 SQL，不依赖 FIND_IN_SET。
    """

    __tablename__ = "ledger"

    id: Mapped[int] = mapped_column(BIGINT_ID, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    model_spec: Mapped[str] = mapped_column(String(255), nullable=False)
    # 子项号：技改项目下的子项编号，可留空（口径与申购计划的 subitem_no 一致）。
    subitem_no: Mapped[str | None] = mapped_column(String(64))
    # 数量是整数件数（按台/套/件统计，不做小数），单位与数量一起展示。
    quantity: Mapped[int] = mapped_column(UINT, nullable=False, default=0, server_default="0")
    unit_name: Mapped[str] = mapped_column(String(32), nullable=False)
    usage: Mapped[str] = mapped_column(String(500), nullable=False)
    remark: Mapped[str | None] = mapped_column(String(1000))
    tag_ids: Mapped[str] = mapped_column(String(500), nullable=False, default="", server_default="")
    images: Mapped[list[LedgerImage]] = relationship(
        back_populates="ledger",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="LedgerImage.sort_order",
    )


class LedgerImage(ProjectScoped, Base):
    """台账记录图片关联：一张图一行，sort_order 保留上传顺序。"""

    __tablename__ = "ledger_image"

    ledger_id: Mapped[int] = mapped_column(
        BIGINT_ID, ForeignKey("ledger.id", ondelete="CASCADE"), primary_key=True
    )
    file_id: Mapped[str] = mapped_column(String(36), ForeignKey("file_object.id"), primary_key=True)
    sort_order: Mapped[int] = mapped_column(UTINYINT, nullable=False, default=0)
    ledger: Mapped[Ledger] = relationship(back_populates="images")
    file: Mapped[FileObject] = relationship(lazy="selectin")


# 项目域实体清单：全局隔离层（core.project_scope）按它给语句注入 `project_id` 过滤，
# 并在 flush 时给新对象补项目。新增业务表时**必须**同时继承 ProjectScoped 并登记在这里，
# 否则该表不会被隔离（详见 AGENTS.md「项目隔离约定」）。
PROJECT_SCOPED_MODELS: tuple[type[ProjectScoped], ...] = (
    ExcelExportJob,
    ExcelImportJob,
    Hazard,
    HazardAfterImage,
    HazardBeforeImage,
    HazardType,
    HazardUnit,
    HuaXingInventory,
    Ledger,
    LedgerImage,
    LedgerTag,
    LedgerTagImage,
    LiteInventory,
    MaterialCodeLibrary,
    PurchaseMaterial,
    PurchaseMaterialImage,
    PurchasePlanTemplate,
    PurchasePlanTemplateImage,
    PurchaseRequest,
    PurchaseRequestLine,
    PurchaseRequestLineImage,
    ShareLink,
    StockBalance,
    StockMaterial,
    StockMaterialImage,
    StockOperation,
    StockOperationLine,
    StockReplenishmentPolicy,
)


__all__ = [
    "PROJECT_SCOPED_MODELS",
    "Base",
    "BusinessEventLog",
    "ExcelExportJob",
    "ExcelImportJob",
    "FileObject",
    "Hazard",
    "HazardAfterImage",
    "HazardBeforeImage",
    "HazardType",
    "HazardUnit",
    "HuaXingInventory",
    "Ledger",
    "LedgerImage",
    "LedgerTag",
    "LedgerTagImage",
    "LiteInventory",
    "MaterialCodeLibrary",
    "Memo",
    "MiniProgramUser",
    "Project",
    "ProjectScoped",
    "PurchaseMaterial",
    "PurchaseMaterialImage",
    "PurchasePlanTemplate",
    "PurchasePlanTemplateImage",
    "PurchaseRequest",
    "PurchaseRequestLine",
    "PurchaseRequestLineImage",
    "ShareLink",
    "StockBalance",
    "StockMaterial",
    "StockMaterialImage",
    "StockOperation",
    "StockOperationLine",
    "StockReplenishmentPolicy",
    "User",
    "WebhookChannel",
    "WebhookDelivery",
]
