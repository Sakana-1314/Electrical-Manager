from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    WithJsonSchema,
    field_validator,
    model_validator,
)

from app.domain.enums import (
    ExcelExportJobStatus,
    ExcelImportJobStatus,
    HazardLevel,
    HazardStatus,
    MiniProgramCodeEnv,
    MiniProgramFeatureMode,
    MiniProgramStockStatus,
    OperationType,
    PurchasePlanStatus,
    Role,
    SecondaryWarehouseMode,
    ShareExpiryOption,
    ShareType,
    SourceType,
    WebhookEventType,
    WebhookPlatform,
)

PositiveQuantity = Annotated[Decimal, Field(gt=0, max_digits=18, decimal_places=1)]
NonnegativeQuantity = Annotated[Decimal, Field(ge=0, max_digits=18, decimal_places=1)]
NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
FileId = Annotated[
    str,
    StringConstraints(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    ),
]
ApiToken = Annotated[
    str,
    StringConstraints(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    ),
]


def _ensure_unique_image_ids(value: list[str]) -> list[str]:
    if len(value) != len(set(value)):
        raise ValueError("image_ids contains duplicates")
    return value


def _empty_string_to_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


class RequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ReadModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        json_encoders={Decimal: lambda value: format(value.normalize(), "f")},
    )


def _to_utc_iso(value: datetime) -> str:
    """naive 值按 UTC 处理（存储层 utcnow() 即 naive UTC），aware 值转为 UTC。

    约定：服务端一律输出带 +00:00 的 ISO 字符串，客户端按上海时区展示。
    """
    aware = value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
    return aware.isoformat()


# 用于需要统一输出 UTC 时区的 datetime 字段（尤其是经 model_validate 直接序列化的读模型）。
# WithJsonSchema 显式声明 JSON Schema，避免 PlainSerializer 使 openapi 丢失 format: date-time。
UtcDateTime = Annotated[
    datetime,
    PlainSerializer(_to_utc_iso, return_type=str),
    WithJsonSchema({"type": "string", "format": "date-time"}),
]


class Page[T](ReadModel):
    items: list[T]
    page: int
    page_size: int
    total: int


class PurchaseFilterOptions(ReadModel):
    actual_demand_persons: list[str]
    purchase_responsibles: list[str]
    subitem_nos: list[str]
    categories: list[str]


class PurchaseRecordFilterOptions(PurchaseFilterOptions):
    salespersons: list[str]
    statuses: list[str]


class ApiError(ReadModel):
    code: str
    message: str
    details: dict[str, object] = Field(default_factory=dict)
    request_id: str


class UserRead(ReadModel):
    id: int
    username: str
    display_name: str
    role: Role
    enabled: bool
    version: int


class UserApiTokenRead(UserRead):
    # 接口令牌以 Fernet 密文入库（api_token_enc），读取接口每次解密回显，避免反复重新生成。
    # 仅存哈希的旧数据在令牌下次成功用于接口调用时自动回写密文，在此之前为 None。
    api_token: ApiToken | None = Field(
        default=None,
        description=(
            "当前生效接口令牌的解密回显（加密入库，每次读取返回，令牌可多处复用无需反复重置）。"
            "仅存哈希的旧数据首次读取可能为空，待该令牌用于一次接口调用后自动加密回写即可持续回显。"
        ),
    )


class LoginRequest(RequestModel):
    username: NonBlank
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(ReadModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead


class RefreshTokenRequest(RequestModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


class TokenPairResponse(ReadModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class UserCreate(RequestModel):
    username: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64)]
    password: str = Field(min_length=6, max_length=128)
    display_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]
    role: Role
    enabled: bool = True


class UserUpdate(RequestModel):
    username: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64)] | None
    ) = None
    display_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: Role | None = None
    enabled: bool | None = None
    version: int


class UserApiTokenRegenerate(RequestModel):
    version: int


# 项目没有对外编码：标识是内部自增 id（不暴露给界面），对外只有名称。
ProjectName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
]
ProjectRemark = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]


class ProjectRead(ReadModel):
    """项目：业务数据的隔离维度，切换当前项目后只能看到该项目的数据。"""

    id: int
    name: str
    enabled: bool
    is_default: bool
    remark: str | None = None
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class ProjectCreate(RequestModel):
    name: ProjectName
    enabled: bool = True
    is_default: bool = False
    remark: ProjectRemark | None = None


class ProjectUpdate(RequestModel):
    name: ProjectName | None = None
    enabled: bool | None = None
    is_default: bool | None = None
    remark: ProjectRemark | None = None
    version: int


class MiniProgramIdentityRead(ReadModel):
    id: int
    app_id: str
    wechat_openid: str
    created_at: UtcDateTime


class MiniProgramUserRead(ReadModel):
    id: int
    display_name: str
    department_name: str
    enabled: bool
    # 最近一次登录小程序的时间；本字段上线前建档的历史数据为 null。
    last_used_at: UtcDateTime | None = None
    identities: list[MiniProgramIdentityRead]
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class MiniProgramUserUpdate(RequestModel):
    display_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
        | None
    ) = None
    department_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    enabled: bool | None = None
    version: int


class MiniProgramUserMergeRequest(RequestModel):
    source_user_id: int = Field(gt=0)
    source_version: int
    target_version: int


class MemoRead(ReadModel):
    """管理端个人备忘录（纯文本）：一级 tab 快捷切换多条，按创建人隔离。"""

    id: int
    title: str
    content: str
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


# 单条备忘录纯文本正文上限（字符）。MySQL TEXT 列（utf8mb4）最坏 4 字节/字符，
# 配 10000 上限可保证落入 64KB 内且足够长文备忘录使用。
MEMO_CONTENT_MAX_LENGTH = 10000


class MemoCreate(RequestModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] = ""
    content: str = Field(default="", max_length=MEMO_CONTENT_MAX_LENGTH)


class MemoUpdate(RequestModel):
    title: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] | None
    ) = None
    content: str | None = Field(default=None, max_length=MEMO_CONTENT_MAX_LENGTH)
    version: int


class MiniProgramLoginResponse(ReadModel):
    access_token: str | None = None
    registration_token: str | None = None
    token_type: Literal["bearer"] = "bearer"
    user: MiniProgramUserRead | None = None
    requires_profile: bool


class MiniProgramWechatLoginRequest(RequestModel):
    code: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=256)]
    app_id: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
        | None
    ) = None


class MiniProgramProfileUpdate(RequestModel):
    display_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]
    department_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]


class AiSearchSettingsRead(ReadModel):
    endpoint: str
    api_key: str
    model: str
    enabled: bool
    mini_program_code_env: MiniProgramCodeEnv
    mini_program_code_app_id: str
    mini_program_app_ids: list[str]
    mini_program_registration_enabled: bool
    mini_program_new_user_enabled: bool
    image_acceleration_server_url: str
    inventory_mode: MiniProgramFeatureMode
    huaxing_inventory_mode: MiniProgramFeatureMode
    purchase_plans_mode: MiniProgramFeatureMode
    purchase_records_mode: MiniProgramFeatureMode
    material_codes_mode: MiniProgramFeatureMode
    hazards_mode: MiniProgramFeatureMode
    secondary_warehouse_mode: SecondaryWarehouseMode
    updated_at: datetime | None = None
    version: int


class AiSearchSettingsUpdate(RequestModel):
    endpoint: str = Field(default="", max_length=500)
    api_key: str = Field(default="", max_length=1000)
    model: str = Field(default="", max_length=128)
    enabled: bool = True
    mini_program_code_env: MiniProgramCodeEnv = MiniProgramCodeEnv.RELEASE
    mini_program_code_app_id: str = Field(default="", max_length=64)
    mini_program_registration_enabled: bool = True
    mini_program_new_user_enabled: bool = True
    image_acceleration_server_url: str = Field(default="", max_length=500)
    inventory_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.READ_WRITE
    huaxing_inventory_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.QUERY_ONLY
    purchase_plans_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.QUERY_ONLY
    purchase_records_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.QUERY_ONLY
    material_codes_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.QUERY_ONLY
    hazards_mode: MiniProgramFeatureMode = MiniProgramFeatureMode.READ_WRITE
    secondary_warehouse_mode: SecondaryWarehouseMode = SecondaryWarehouseMode.FULL
    version: int = Field(ge=0)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        value = value.strip()
        if value and not value.startswith(("http://", "https://")):
            raise ValueError("端点必须使用 http:// 或 https://")
        return value

    @field_validator("image_acceleration_server_url")
    @classmethod
    def validate_image_acceleration_server_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if value and not value.startswith(("http://", "https://")):
            raise ValueError("图片加速服务器必须使用 http:// 或 https://")
        return value

    @field_validator("model")
    @classmethod
    def validate_model(cls, value: str) -> str:
        value = value.strip()
        return value

    @field_validator("api_key")
    @classmethod
    def strip_api_key(cls, value: str) -> str:
        value = value.strip()
        return value

    @model_validator(mode="after")
    def require_enabled_model_config(self) -> AiSearchSettingsUpdate:
        if self.enabled and not (self.endpoint and self.api_key and self.model):
            raise ValueError("启用模型服务时必须填写端点、模型和 API Key")
        return self


class WebhookChannelRead(ReadModel):
    platform: WebhookPlatform
    enabled: bool
    subscribed_events: list[WebhookEventType]
    webhook_url: str
    secret: str
    webhook_configured: bool
    secret_configured: bool
    updated_at: datetime | None = None
    version: int


class WebhookChannelUpdate(RequestModel):
    enabled: bool = False
    webhook_url: str = Field(default="", max_length=2000)
    secret: str = Field(default="", max_length=1000)
    subscribed_events: list[WebhookEventType] = Field(default_factory=list, max_length=3)
    version: int = Field(ge=0)

    @field_validator("subscribed_events")
    @classmethod
    def unique_subscribed_events(cls, value: list[WebhookEventType]) -> list[WebhookEventType]:
        if len(value) != len(set(value)):
            raise ValueError("subscribed_events contains duplicates")
        return value


class WebhookTestRead(ReadModel):
    platform: WebhookPlatform
    success: bool
    message: str


class WebhookTestRequest(RequestModel):
    webhook_url: str = Field(max_length=2000)
    secret: str = Field(default="", max_length=1000)


class AiSearchStatusRead(BaseModel):
    available: bool


class ImageAccelerationSettingsRead(BaseModel):
    image_acceleration_server_url: str


class MiniProgramFeaturesRead(BaseModel):
    inventory_mode: MiniProgramFeatureMode
    huaxing_inventory_mode: MiniProgramFeatureMode
    purchase_plans_mode: MiniProgramFeatureMode
    purchase_records_mode: MiniProgramFeatureMode
    material_codes_mode: MiniProgramFeatureMode
    hazards_mode: MiniProgramFeatureMode
    secondary_warehouse_mode: SecondaryWarehouseMode


class AiSearchExpandRequest(RequestModel):
    value: str = Field(min_length=1, max_length=500)

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value


class AiSearchExpandRead(BaseModel):
    original: str
    expanded: str


class AiSearchTestRead(BaseModel):
    original: str
    expanded: str


class AiSearchTestRequest(RequestModel):
    endpoint: str = Field(max_length=500)
    api_key: str = Field(max_length=1000)
    model: str = Field(max_length=128)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith(("http://", "https://")):
            raise ValueError("端点必须使用 http:// 或 https://")
        return value

    @field_validator("api_key", "model")
    @classmethod
    def require_value(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("不能为空")
        return value


class FileObjectRead(ReadModel):
    id: FileId
    original_name: str
    mime_type: Literal["image/png"] = "image/png"
    size_bytes: int
    width: int
    height: int


class OrphanFileRead(ReadModel):
    id: FileId
    original_name: str
    size_bytes: int
    created_at: datetime
    file_exists: bool


class OrphanFileReportRead(ReadModel):
    cutoff: datetime
    unreferenced_records: list[OrphanFileRead]
    untracked_file_names: list[str]
    missing_file_ids: list[FileId]


class OrphanFileCleanupRead(ReadModel):
    cutoff: datetime
    deleted_record_ids: list[FileId]
    deleted_file_names: list[str]


class AttachmentRead(ReadModel):
    """附件管理列表行：图片对象 + 被引用次数 + 软删除状态。"""

    id: FileId
    original_name: str
    mime_type: Literal["image/png"] = "image/png"
    size_bytes: int
    width: int
    height: int
    created_at: UtcDateTime
    # 被引用次数 = 四张图片关联表中指向本文件的记录数之和；为 0 才允许删除。
    reference_count: int
    # 非空表示已提交删除、等待次日凌晨 2 点复查引用后物理清除。
    deleted_at: UtcDateTime | None = None
    file_exists: bool = True


class AttachmentDeleteRead(ReadModel):
    """软删除回执：真正物理删除要等次日凌晨 2 点的引用复查。"""

    id: FileId
    deleted_at: UtcDateTime
    purge_after: UtcDateTime


class AttachmentBulkDeleteRead(ReadModel):
    """批量软删除未引用附件的回执：真正物理删除仍要等次日凌晨 2 点的引用复查。"""

    deleted_count: int
    purge_after: UtcDateTime


class AttachmentCleanupRead(ReadModel):
    """凌晨 2 点引用复查的清理结果（仅供后台任务内部使用，不对外暴露接口）。"""

    scanned: int
    purged_file_ids: list[FileId]
    purged_file_names: list[str]
    restored_file_ids: list[FileId]


class ReplenishmentPolicyRead(ReadModel):
    minimum_qty: Decimal
    enabled: bool
    version: int = 1


class ReplenishmentPolicyWrite(RequestModel):
    minimum_qty: NonnegativeQuantity
    enabled: bool = True
    version: int | None = None


class StockMaterialBase(RequestModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    name_id: Annotated[
        str | None, StringConstraints(strip_whitespace=True, max_length=128)
    ] = None
    alias: Annotated[
        str | None, StringConstraints(strip_whitespace=True, max_length=128)
    ] = None
    model_spec: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    unit_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    remark: str | None = Field(default=None, max_length=1000)
    image_ids: list[FileId] = Field(default_factory=list, max_length=9)

    @field_validator("image_ids")
    @classmethod
    def unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)


class StockMaterialCreate(StockMaterialBase):
    pass


class StockMaterialUpdate(StockMaterialBase):
    version: int


class StockMaterialRead(ReadModel):
    id: int
    uuid: UUID
    name: str
    name_id: str | None = None
    alias: str | None = None
    model_spec: str
    unit_name: str
    remark: str | None = None
    current_qty: Decimal
    images: list[FileObjectRead]
    replenishment_policy: ReplenishmentPolicyRead | None = None
    has_operation_records: bool = False
    created_at: datetime
    updated_at: datetime
    version: int


class InventoryBalanceRead(ReadModel):
    stock_material_id: int
    name: str
    alias: str | None = None
    model_spec: str
    unit_name: str
    current_qty: Decimal
    minimum_qty: Decimal | None = None
    is_low_stock: bool
    suggested_purchase_qty: Decimal
    updated_at: datetime


class OperationLineWrite(RequestModel):
    stock_material_id: int
    quantity: PositiveQuantity


def _require_aware_datetime(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("occurred_at must include a timezone")
    return value


def _ensure_unique_operation_materials(
    value: list[OperationLineWrite],
) -> list[OperationLineWrite]:
    ids = [line.stock_material_id for line in value]
    if len(ids) != len(set(ids)):
        raise ValueError("one operation may only contain a material once")
    return value


class OperationCreate(RequestModel):
    client_request_id: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]
    occurred_at: datetime
    source_type: SourceType
    business_reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""
    receiver_unit: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    receiver_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    lines: list[OperationLineWrite] = Field(min_length=1)

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        return _require_aware_datetime(value)

    @field_validator("lines")
    @classmethod
    def unique_materials(cls, value: list[OperationLineWrite]) -> list[OperationLineWrite]:
        return _ensure_unique_operation_materials(value)


class OperationUpdate(RequestModel):
    version: int
    operation_type: OperationType
    occurred_at: datetime
    source_type: SourceType
    business_reason: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] = ""
    receiver_unit: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    receiver_name: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    lines: list[OperationLineWrite] = Field(min_length=1)

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        return _require_aware_datetime(value)

    @field_validator("lines")
    @classmethod
    def unique_materials(cls, value: list[OperationLineWrite]) -> list[OperationLineWrite]:
        return _ensure_unique_operation_materials(value)


class ReverseOperationRequest(RequestModel):
    client_request_id: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    lines: list[OperationLineWrite] = Field(min_length=1)

    @field_validator("lines")
    @classmethod
    def unique_materials(cls, value: list[OperationLineWrite]) -> list[OperationLineWrite]:
        return _ensure_unique_operation_materials(value)


class StockOperationLineRead(ReadModel):
    id: int
    stock_material_id: int
    material_name: str
    model_spec: str
    unit_name: str
    quantity: Decimal
    remaining_qty: Decimal
    before_qty: Decimal
    after_qty: Decimal


class StockOperationRead(ReadModel):
    id: int
    operation_no: str
    operation_type: OperationType
    occurred_at: datetime
    business_reason: str
    receiver_unit: str | None = None
    receiver_name: str | None = None
    subitem_no: str | None = None
    source_type: SourceType
    reversal_of_id: int | None = None
    is_reversed: bool = False
    client_request_id: str
    mini_program_user_name: str | None = None
    lines: list[StockOperationLineRead]
    created_at: datetime
    version: int


class MiniProgramMaterialRead(ReadModel):
    uuid: UUID
    name: str
    model_spec: str
    unit_name: str
    current_qty: Decimal
    stock_status: MiniProgramStockStatus
    minimum_qty: Decimal | None = None
    remark: str | None = None
    images: list[FileObjectRead] = Field(default_factory=list)


class MiniProgramInventoryItemRead(ReadModel):
    uuid: UUID
    name: str
    model_spec: str
    unit_name: str
    current_qty: Decimal
    stock_status: MiniProgramStockStatus


class MiniProgramPurchasePlanItemRead(ReadModel):
    id: int
    plan_no: str
    plan_date: date
    name: str
    model_spec: str
    unit_name: str
    planned_qty: Decimal
    actual_demand_person: str
    purchase_responsible: str
    urgency: str


class MiniProgramPurchasePlanDetailRead(MiniProgramPurchasePlanItemRead):
    material_code: str | None = None
    category: str | None = None
    demand_department: str
    usage: str
    subitem_no: str | None = None
    remark: str | None = None
    images: list[FileObjectRead] = Field(default_factory=list)
    next_id: int | None = None


class MiniProgramPurchasePlanFilterOptions(ReadModel):
    actual_demand_persons: list[str]
    subitem_nos: list[str]


class MiniProgramPurchaseRecordItemRead(ReadModel):
    line_id: int
    material_name: str
    model_spec: str
    purchase_order_no: str | None = None
    trace_no: str | None = None
    status: str
    unit_name: str
    purchase_qty: Decimal
    plan_date: date
    subitem_no: str | None = None
    material_code: str | None = None
    category: str | None = None
    plan_no: str
    demand_department: str
    actual_demand_person: str
    purchase_responsible: str
    usage: str
    remark: str | None = None
    purchase_date: date | None = None
    salesperson: str | None = None
    images: list[FileObjectRead] = Field(default_factory=list)


class MiniProgramPurchaseRecordFilterOptions(ReadModel):
    statuses: list[str]
    subitem_nos: list[str]


class MiniProgramMaterialCodeRead(ReadModel):
    id: int
    material_code: str
    name: str | None = None
    model_spec: str | None = None
    unit_name: str


class MiniProgramHuaXingInventoryRead(ReadModel):
    id: int
    first_inbound_date: date | None = None
    warehouse: str | None = None
    material_code: str | None = None
    name: str | None = None
    model_spec: str | None = None
    quantity: Decimal | None = None
    unit_name: str | None = None
    purchaser: str | None = None
    purchase_department: str | None = None
    subitem_no_name: str | None = None


class MiniProgramOutboundCreate(RequestModel):
    client_request_id: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]
    material_uuid: UUID
    occurred_at: datetime
    quantity: PositiveQuantity
    business_reason: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)
    ]
    receiver_unit: Annotated[
        str, StringConstraints(strip_whitespace=True, max_length=128)
    ] = ""
    subitem_no: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]

    @field_validator("occurred_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        return _require_aware_datetime(value)


class MiniProgramOutboundRead(ReadModel):
    operation_id: int
    operation_no: str
    material_uuid: UUID
    material_name: str
    model_spec: str
    unit_name: str
    quantity: Decimal
    before_qty: Decimal
    after_qty: Decimal
    occurred_at: datetime
    business_reason: str
    receiver_unit: str | None = None
    receiver_name: str
    subitem_no: str | None = None
    executed_by: str


class MiniProgramOutboundReason(ReadModel):
    subitem_no: str | None = None
    reason: str


class MiniProgramOutboundReasonOptions(ReadModel):
    personal_reasons: list[MiniProgramOutboundReason]
    system_reasons: list[MiniProgramOutboundReason]


class MiniProgramOperationRead(ReadModel):
    """小程序端出入库记录（按姓名匹配，行级展平）。

    兼容入库/出库、小程序/管理端来源；多行操作按行展平为多条记录。
    """

    operation_id: int
    operation_no: str
    operation_type: OperationType
    material_name: str
    model_spec: str
    unit_name: str
    quantity: Decimal
    before_qty: Decimal
    after_qty: Decimal
    occurred_at: datetime
    business_reason: str
    receiver_unit: str | None = None
    receiver_name: str | None = None
    subitem_no: str | None = None
    executed_by: str | None = None


class PurchaseMaterialBase(RequestModel):
    plan_date: date | None = None
    material_code: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    category: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    urgency: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ] = "正常"
    demand_department: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ] = "HXNI 检修维护部"
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    model_spec: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    unit_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    actual_demand_person: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    purchase_responsible: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    planned_qty: PositiveQuantity
    usage: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    remark: str | None = Field(default=None, max_length=1000)
    stock_material_id: int | None = None
    image_ids: list[FileId] = Field(default_factory=list, max_length=9)
    status: PurchasePlanStatus = PurchasePlanStatus.NORMAL

    @field_validator("image_ids")
    @classmethod
    def unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)

    @field_validator("material_code", "category", mode="before")
    @classmethod
    def empty_optional_text_to_none(cls, value: object) -> object:
        return _empty_string_to_none(value)


class PurchaseMaterialCreate(PurchaseMaterialBase):
    pass


class PurchaseMaterialUpdate(PurchaseMaterialBase):
    version: int


class MaterialCodeLibraryRead(ReadModel):
    id: int
    material_code: str
    name: str | None
    model_spec: str | None
    unit_name: str


class MaterialCodeExistsRead(ReadModel):
    material_code: str
    exists: bool


class MaterialCodeLibraryImportRead(ReadModel):
    imported_count: int
    blank_name_count: int
    blank_model_spec_count: int


class ExcelImportJobRead(ReadModel):
    id: int
    import_type: str
    status: ExcelImportJobStatus
    original_filename: str
    result: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: UtcDateTime
    started_at: UtcDateTime | None = None
    finished_at: UtcDateTime | None = None


class ExcelExportJobRead(ReadModel):
    id: int
    export_type: str
    status: ExcelExportJobStatus
    download_filename: str | None = None
    # 导出文件 uuid（exports 目录下文件名去掉 .xlsx），用于匿名下载链接；
    # 仅 SUCCEEDED 任务非空。由 ExcelExportJob.file_uuid 派生属性填充。
    file_uuid: str | None = None
    params: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None
    created_at: UtcDateTime
    started_at: UtcDateTime | None = None
    finished_at: UtcDateTime | None = None


class HuaXingInventoryRead(ReadModel):
    id: int
    first_inbound_date: date | None = None
    warehouse: str | None = None
    material_code: str | None = None
    name: str | None = None
    model_spec: str | None = None
    quantity: Decimal | None = None
    unit_name: str | None = None
    purchaser: str | None = None
    purchase_department: str | None = None
    subitem_no_name: str | None = None


class HuaXingFilterOptions(ReadModel):
    purchase_departments: list[str]
    purchasers: list[str]


class LastImportRead(ReadModel):
    last_import_at: UtcDateTime | None = None


class LiteInventoryRead(ReadModel):
    """管理端精简二级库行（Excel 一次性导入 + 只读查询）。"""

    id: int
    name: str
    model_spec: str | None = None
    unit_name: str | None = None
    quantity: Decimal | None = None
    remark: str | None = None


class MiniProgramLiteInventoryItemRead(ReadModel):
    """小程序端精简二级库行（无出入库，仅查看）。"""

    id: int
    name: str
    model_spec: str | None = None
    unit_name: str | None = None
    quantity: Decimal | None = None


class PurchasePlanVersion(RequestModel):
    id: int
    version: int


class BatchUpdatePurchasePlansRequest(RequestModel):
    materials: list[PurchasePlanVersion] = Field(min_length=1, max_length=200)
    plan_date: date | None = None
    category: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    urgency: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)] | None
    ) = None
    demand_department: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    actual_demand_person: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    purchase_responsible: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    usage: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
        | None
    ) = None
    status: PurchasePlanStatus | None = None

    @field_validator("materials")
    @classmethod
    def unique_materials(cls, value: list[PurchasePlanVersion]) -> list[PurchasePlanVersion]:
        ids = [item.id for item in value]
        if len(ids) != len(set(ids)):
            raise ValueError("materials must be unique")
        return value

    @model_validator(mode="after")
    def validate_updates(self) -> BatchUpdatePurchasePlansRequest:
        update_fields = {
            "plan_date",
            "category",
            "urgency",
            "demand_department",
            "actual_demand_person",
            "purchase_responsible",
            "subitem_no",
            "usage",
            "status",
        }
        selected_fields = self.model_fields_set & update_fields
        if not selected_fields:
            raise ValueError("at least one update field is required")
        for field in selected_fields - {"category", "subitem_no"}:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class PurchaseMaterialRead(ReadModel):
    id: int
    plan_no: str
    plan_date: date
    material_code: str | None = None
    category: str | None = None
    urgency: str
    demand_department: str
    name: str
    model_spec: str
    unit_name: str
    actual_demand_person: str
    purchase_responsible: str
    planned_qty: Decimal
    usage: str
    subitem_no: str | None = None
    remark: str | None = None
    stock_material_id: int | None = None
    stock_material_name: str | None = None
    status: PurchasePlanStatus
    moved_to_record: bool
    images: list[FileObjectRead]
    created_at: datetime
    updated_at: datetime
    version: int


class PurchasePlanTemplateBase(RequestModel):
    """周期性计划（申购计划模板）公共字段：与申购计划业务字段一致，无 plan_no/plan_date/status。"""

    material_code: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    category: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    urgency: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ] = "正常"
    demand_department: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ] = "HXNI 检修维护部"
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    model_spec: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    unit_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    actual_demand_person: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    purchase_responsible: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    planned_qty: PositiveQuantity
    usage: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    remark: str | None = Field(default=None, max_length=1000)
    stock_material_id: int | None = None
    image_ids: list[FileId] = Field(default_factory=list, max_length=9)

    @field_validator("image_ids")
    @classmethod
    def unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)

    @field_validator("material_code", "category", mode="before")
    @classmethod
    def empty_optional_text_to_none(cls, value: object) -> object:
        return _empty_string_to_none(value)


class PurchasePlanTemplateCreate(PurchasePlanTemplateBase):
    pass


class PurchasePlanTemplateUpdate(PurchasePlanTemplateBase):
    version: int


class PurchasePlanTemplateRead(ReadModel):
    id: int
    material_code: str | None = None
    category: str | None = None
    urgency: str
    demand_department: str
    name: str
    model_spec: str
    unit_name: str
    actual_demand_person: str
    purchase_responsible: str
    planned_qty: Decimal
    usage: str
    subitem_no: str | None = None
    remark: str | None = None
    stock_material_id: int | None = None
    stock_material_name: str | None = None
    images: list[FileObjectRead]
    created_at: datetime
    updated_at: datetime
    version: int


class PurchasePlanTemplateFilterOptions(ReadModel):
    actual_demand_persons: list[str]
    purchase_responsibles: list[str]
    categories: list[str]


class LinkStockMaterialRequest(RequestModel):
    stock_material_id: int
    version: int | None = None


class ActionVersion(RequestModel):
    version: int | None = None


class MovePurchasePlanRequest(RequestModel):
    purchase_order_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    trace_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = None
    contract_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    vessel_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    consolidation_date: date | None = None
    consolidation_port: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    sailing_date: date | None = None
    contract_sign_date: date | None = None
    purchase_date: date
    salesperson: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    status: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ] = "已申购"
    record_remark: str | None = Field(default=None, max_length=1000)


class BatchMovePurchasePlansRequest(MovePurchasePlanRequest):
    material_ids: list[int] = Field(min_length=1, max_length=200)

    @field_validator("material_ids")
    @classmethod
    def unique_material_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("material_ids must be unique")
        return value


class PurchasePlanExportRequest(RequestModel):
    material_ids: list[int] = Field(min_length=1, max_length=200)

    @field_validator("material_ids")
    @classmethod
    def unique_material_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("material_ids must be unique")
        return value


PurchasePlanResultColumn = Literal[
    "plan_no",
    "plan_date",
    "material_code",
    "category",
    "urgency",
    "demand_department",
    "name",
    "model_spec",
    "planned_qty",
    "unit_name",
    "actual_demand_person",
    "purchase_responsible",
    "subitem_no",
    "usage",
    "images",
]


class PurchasePlanResultExportRequest(RequestModel):
    columns: list[PurchasePlanResultColumn] = Field(min_length=1, max_length=15)
    name: str | None = Field(default=None, max_length=128)
    model_spec: str | None = Field(default=None, max_length=255)
    actual_demand_person: str | None = Field(default=None, max_length=128)
    empty_actual_demand_person: bool = False
    subitem_no: str | None = Field(default=None, max_length=64)
    empty_subitem_no: bool = False
    status: PurchasePlanStatus | list[PurchasePlanStatus] | None = None
    category: str | None = Field(default=None, max_length=64)
    sort_by: PurchasePlanResultColumn | None = None
    sort_order: Literal["asc", "desc"] = "asc"

    @field_validator("columns")
    @classmethod
    def unique_columns(
        cls, value: list[PurchasePlanResultColumn]
    ) -> list[PurchasePlanResultColumn]:
        if len(value) != len(set(value)):
            raise ValueError("columns must be unique")
        return value


class PurchaseRecordUpdate(RequestModel):
    plan_date: date
    material_code: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    category: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    demand_department: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ] = "HXNI 检修维护部"
    material_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]
    model_spec: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ]
    unit_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
    ]
    actual_demand_person: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]
    purchase_responsible: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]
    purchase_qty: PositiveQuantity
    usage: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    subitem_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)] | None
    ) = None
    plan_remark: str | None = Field(default=None, max_length=1000)
    stock_material_id: int | None = None
    image_ids: list[FileId] = Field(default_factory=list, max_length=9)
    purchase_order_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    trace_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = None
    contract_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    vessel_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    consolidation_date: date | None = None
    consolidation_port: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    sailing_date: date | None = None
    contract_sign_date: date | None = None
    purchase_date: date | None = None
    salesperson: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    status: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
    record_remark: str | None = Field(default=None, max_length=1000)
    version: int

    @field_validator("image_ids")
    @classmethod
    def unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)

    @field_validator("material_code", "category", mode="before")
    @classmethod
    def empty_optional_text_to_none(cls, value: object) -> object:
        return _empty_string_to_none(value)


class PurchaseRecordVersion(RequestModel):
    line_id: int
    version: int


class BatchUpdatePurchaseRecordsRequest(RequestModel):
    records: list[PurchaseRecordVersion] = Field(min_length=1, max_length=200)
    plan_date: date | None = None
    purchase_order_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    trace_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = None
    contract_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    vessel_no: Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None = (
        None
    )
    consolidation_date: date | None = None
    consolidation_port: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    sailing_date: date | None = None
    contract_sign_date: date | None = None
    purchase_date: date | None = None
    actual_demand_person: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    purchase_responsible: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    salesperson: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    status: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
        | None
    ) = None
    record_remark: str | None = Field(default=None, max_length=1000)

    @field_validator("records")
    @classmethod
    def unique_records(cls, value: list[PurchaseRecordVersion]) -> list[PurchaseRecordVersion]:
        line_ids = [item.line_id for item in value]
        if len(line_ids) != len(set(line_ids)):
            raise ValueError("records must be unique")
        return value

    @model_validator(mode="after")
    def validate_updates(self) -> BatchUpdatePurchaseRecordsRequest:
        update_fields = {
            "plan_date",
            "purchase_order_no",
            "trace_no",
            "contract_no",
            "vessel_no",
            "consolidation_date",
            "consolidation_port",
            "sailing_date",
            "contract_sign_date",
            "purchase_date",
            "actual_demand_person",
            "purchase_responsible",
            "salesperson",
            "status",
            "record_remark",
        }
        selected_fields = self.model_fields_set & update_fields
        if not selected_fields:
            raise ValueError("at least one update field is required")
        required_fields = {"plan_date", "actual_demand_person", "purchase_responsible", "status"}
        for field in selected_fields & required_fields:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class PurchaseRecordRead(ReadModel):
    line_id: int
    purchase_request_id: int
    purchase_material_id: int | None
    plan_no: str
    plan_date: date
    purchase_order_no: str | None = None
    trace_no: str | None = None
    contract_no: str | None = None
    vessel_no: str | None = None
    consolidation_date: date | None = None
    consolidation_port: str | None = None
    sailing_date: date | None = None
    contract_sign_date: date | None = None
    status: str
    material_code: str | None = None
    category: str | None = None
    demand_department: str
    material_name: str
    model_spec: str
    unit_name: str
    purchase_qty: Decimal
    actual_demand_person: str
    purchase_responsible: str
    salesperson: str | None = None
    plan_remark: str | None = None
    record_remark: str | None = None
    usage: str
    subitem_no: str | None = None
    images: list[FileObjectRead]
    stock_material_id: int | None = None
    purchase_date: date | None = None
    created_at: datetime
    updated_at: datetime
    version: int


PurchaseRecordResultColumn = Literal[
    "purchase_qty",
    "plan_date",
    "purchase_order_no",
    "trace_no",
    "contract_no",
    "vessel_no",
    "consolidation_date",
    "consolidation_port",
    "sailing_date",
    "contract_sign_date",
    "category",
    "demand_department",
    "material_name",
    "model_spec",
    "material_code",
    "actual_demand_person",
    "usage",
    "purchase_responsible",
    "salesperson",
    "status",
    "purchase_date",
    "images",
    "subitem_no",
]


class PurchaseRecordResultExportRequest(RequestModel):
    columns: list[PurchaseRecordResultColumn] = Field(min_length=1, max_length=23)
    purchase_order_no: str | None = Field(default=None, max_length=255)
    trace_no: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=64)
    name: str | None = Field(default=None, max_length=128)
    model_spec: str | None = Field(default=None, max_length=255)
    actual_demand_person: str | None = Field(default=None, max_length=128)
    purchase_responsible: str | None = Field(default=None, max_length=128)
    salesperson: str | None = Field(default=None, max_length=128)
    status: str | None = Field(default=None, max_length=128)
    empty_status: bool = False
    subitem_no: str | None = Field(default=None, max_length=64)
    empty_subitem_no: bool = False
    sort_by: PurchaseRecordResultColumn | None = None
    sort_order: Literal["asc", "desc"] = "asc"

    @field_validator("columns")
    @classmethod
    def unique_columns(
        cls, value: list[PurchaseRecordResultColumn]
    ) -> list[PurchaseRecordResultColumn]:
        if len(value) != len(set(value)):
            raise ValueError("columns must be unique")
        return value


# 分享页可展示列（键名与前端 ShareView 表头一致）。NULL/缺省 = 展示全部默认列。
SharePlanColumn = Literal[
    "plan_date",
    "material_code",
    "category",
    "urgency",
    "demand_department",
    "name",
    "model_spec",
    "planned_qty",
    "actual_demand_person",
    "purchase_responsible",
    "subitem_no",
    "usage",
    "status",
    "images",
]

ShareRecordColumn = Literal[
    "plan_date",
    "purchase_order_no",
    "trace_no",
    "category",
    "demand_department",
    "material_name",
    "model_spec",
    "purchase_qty",
    "actual_demand_person",
    "purchase_responsible",
    "salesperson",
    "subitem_no",
    "usage",
    "status",
    "images",
]


def _validate_share_columns(value: list[str] | None) -> list[str] | None:
    """校验分享页展示列：None 表示全部；否则至少 1 项、去重（键的合法性按分享类型另行校验）。"""
    if value is None:
        return None
    if len(value) < 1:
        raise ValueError("columns must not be empty")
    if len(value) != len(set(value)):
        raise ValueError("columns must be unique")
    return value


class ShareCreateRequest(RequestModel):
    """创建匿名分享链接：把勾选的申购计划/申购记录分享为无鉴权页面。"""

    share_type: ShareType
    item_ids: list[int] = Field(min_length=1, max_length=200)
    expires_in: ShareExpiryOption
    # 分享页展示列；NULL = 展示全部默认列，否则仅展示列出的列（键名按分享类型校验）。
    columns: list[str] | None = None

    @field_validator("item_ids")
    @classmethod
    def unique_item_ids(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("item_ids must be unique")
        return value

    @field_validator("columns")
    @classmethod
    def validate_columns(cls, value: list[str] | None) -> list[str] | None:
        return _validate_share_columns(value)


class ShareUpdateRequest(RequestModel):
    """更新分享链接：展示列 + 到期时间。缺省/为 None 表示对应项不修改。"""

    columns: list[str] | None = None
    expires_in: ShareExpiryOption | None = None

    @field_validator("columns")
    @classmethod
    def validate_columns(cls, value: list[str] | None) -> list[str] | None:
        return _validate_share_columns(value)


class ShareRead(ReadModel):
    token: str
    share_type: ShareType
    item_count: int
    # 失效时间（UTC ISO）；NULL = 永久有效。
    expires_at: UtcDateTime | None = None
    created_at: UtcDateTime
    # 分享页展示列；NULL = 展示全部默认列。
    columns: list[str] | None = None


class ShareListRead(ReadModel):
    """管理端「分享链接」列表项。"""

    token: str
    share_type: ShareType
    item_count: int
    expires_at: UtcDateTime | None = None
    created_at: UtcDateTime
    created_by: int | None = None
    created_by_name: str | None = None
    columns: list[str] | None = None


class SharePublicView(ReadModel):
    """匿名读取端点返回体：分享类型 + 按分享时的 id 实时读取的数据行快照。

    当 columns 为 NULL 时 items 为完整类型行；否则 items 为仅含所选列（+行身份键）的字典行，
    隐藏列的数据不会随响应下发。
    """

    share_type: ShareType
    item_count: int
    # 失效时间（UTC ISO）；NULL = 永久有效。
    expires_at: UtcDateTime | None = None
    created_at: UtcDateTime
    # 分享页展示列；NULL = 展示全部默认列。
    columns: list[str] | None = None
    items: list[dict[str, Any]]


class PurchaseRecordSyncTargetRead(ReadModel):
    trace_no: str
    target_count: int
    cursor_id: int


class PurchaseRecordSyncTargetsRead(ReadModel):
    items: list[PurchaseRecordSyncTargetRead]
    has_more: bool
    next_cursor: int = 0


class PurchaseRecordSyncTraceUpdate(RequestModel):
    salesperson: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    contract_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    vessel_no: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    consolidation_port: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None
    consolidation_date: date | None = None
    sailing_date: date | None = None
    # 物资级字段：按追溯号（行）回写，与集港/发船等单据级日期不同。
    contract_sign_date: date | None = None
    status: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)] | None
    ) = None


class PurchaseRecordSyncResultRead(ReadModel):
    affected_headers: int
    affected_lines: int


class PurchaseRecordSyncOrderTargetRead(ReadModel):
    purchase_order_no: str
    trace_nos: list[str]
    cursor_id: int


class PurchaseRecordSyncOrderTargetsRead(ReadModel):
    items: list[PurchaseRecordSyncOrderTargetRead]
    has_more: bool
    next_cursor: int = 0


class PurchaseRecordSyncOrderUpdateItem(PurchaseRecordSyncTraceUpdate):
    """整单回写里的一个追溯号结果（字段规则与单追溯号回写一致）。"""

    trace_no: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]


class PurchaseRecordSyncOrderApply(RequestModel):
    items: list[PurchaseRecordSyncOrderUpdateItem] = Field(min_length=1, max_length=200)


class PurchaseRecordSyncOrderApplyRead(ReadModel):
    applied: int
    not_found: int
    affected_headers: int
    affected_lines: int


class VersionInfoRead(ReadModel):
    app_name: str
    version: str
    commit: str | None = None
    build_time: str | None = None


class ReplenishmentDraftCreate(RequestModel):
    planned_qty: PositiveQuantity
    demand_date: date | None = None
    actual_demand_person: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]
    purchase_responsible: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)
    ]


class ReplenishmentDefaultsRead(ReadModel):
    purchase_responsible: str
    demand_date: date


class ReplenishmentDraftRead(ReadModel):
    next: Literal["purchase_material"]
    resource_id: int


class DashboardSummaryRead(ReadModel):
    stock_material_count: int
    low_stock_count: int
    uncoded_purchase_material_count: int
    purchase_record_count: int


# ===== 隐患管理（隐患台账 / 隐患类型 / 责任单位） =====
# 单条隐患每侧（整改前 / 整改后）最多 9 张图片，与全站 ImageUploader 默认上限一致。
HAZARD_IMAGE_LIMIT = 9
HazardText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=128)]
HazardPerson = Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)]
HazardImageIds = Annotated[list[FileId], Field(max_length=HAZARD_IMAGE_LIMIT)]


class HazardUnitRead(ReadModel):
    """责任单位（单位与责任人一一对应）。"""

    id: int
    name: str
    person: str
    remark: str | None = None
    enabled: bool
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class HazardUnitCreate(RequestModel):
    name: NonBlank
    person: NonBlank
    remark: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    enabled: bool = True


class HazardUnitUpdate(RequestModel):
    name: NonBlank | None = None
    person: NonBlank | None = None
    remark: Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)] | None = None
    enabled: bool | None = None
    version: int


class HazardTypeRead(ReadModel):
    """隐患类型：一行一个「大类 + 小类」组合。"""

    id: int
    major: str
    minor: str
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class HazardTypeCreate(RequestModel):
    major: NonBlank
    minor: NonBlank


class HazardTypeUpdate(RequestModel):
    major: NonBlank | None = None
    minor: NonBlank | None = None
    version: int


class HazardRead(ReadModel):
    """隐患台账记录：含责任单位/类型名称快照与整改前/后图片。"""

    id: int
    inspection_area: str
    inspection_date: date
    inspector: str
    description: str
    suggestion: str | None = None
    hazard_unit_id: int
    hazard_unit_name: str
    person: str
    due_date: date
    recheck_person: str | None = None
    rectify_person: str | None = None
    status: HazardStatus
    hazard_type_id: int
    major: str
    minor: str
    level: HazardLevel
    remark: str | None = None
    before_images: list[FileObjectRead]
    after_images: list[FileObjectRead]
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class HazardCreate(RequestModel):
    inspection_area: HazardText | None = None
    inspection_date: date | None = None
    inspector: HazardPerson | None = None
    description: NonBlank
    suggestion: Annotated[str, StringConstraints(max_length=2000)] | None = None
    hazard_unit_id: int
    due_date: date | None = None
    recheck_person: HazardPerson | None = None
    rectify_person: HazardPerson | None = None
    status: HazardStatus = HazardStatus.PENDING
    hazard_type_id: int
    level: HazardLevel = HazardLevel.GENERAL
    remark: Annotated[str, StringConstraints(max_length=2000)] | None = None
    before_image_ids: HazardImageIds = Field(default_factory=list)
    after_image_ids: HazardImageIds = Field(default_factory=list)

    @field_validator("before_image_ids", "after_image_ids")
    @classmethod
    def _unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)


class HazardUpdate(RequestModel):
    inspection_area: HazardText | None = None
    inspection_date: date | None = None
    inspector: HazardPerson | None = None
    description: NonBlank | None = None
    suggestion: Annotated[str, StringConstraints(max_length=2000)] | None = None
    hazard_unit_id: int | None = None
    due_date: date | None = None
    recheck_person: HazardPerson | None = None
    rectify_person: HazardPerson | None = None
    status: HazardStatus | None = None
    hazard_type_id: int | None = None
    level: HazardLevel | None = None
    remark: Annotated[str, StringConstraints(max_length=2000)] | None = None
    before_image_ids: list[FileId] | None = Field(default=None, max_length=HAZARD_IMAGE_LIMIT)
    after_image_ids: list[FileId] | None = Field(default=None, max_length=HAZARD_IMAGE_LIMIT)
    version: int

    @field_validator("before_image_ids", "after_image_ids")
    @classmethod
    def _unique_images(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _ensure_unique_image_ids(value)


class HazardStatsRead(ReadModel):
    """工作台隐患概览：三状态计数 + 逾期未整改数（今天到期不算逾期）。"""

    pending: int
    blocked: int
    done: int
    overdue: int


class HazardFilterOptionsRead(ReadModel):
    """隐患列表筛选项：整改员工是自由文本，选项由库中已有值去重得出。"""

    rectify_persons: list[str]


class HazardFormOptionsRead(ReadModel):
    """小程序登记隐患用的字典：启用的责任单位 + 全部隐患类型。"""

    units: list[HazardUnitRead]
    types: list[HazardTypeRead]


class MiniProgramHazardCreate(HazardCreate):
    """小程序登记隐患：在网页端请求体上增加幂等键，弱网重试不会重复登记。"""

    client_request_id: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)
    ]


class MiniProgramHazardUpdate(RequestModel):
    """小程序跟进隐患：只开放整改闭环需要的字段（状态、整改员工、复查、整改后图片、备注）。"""

    status: HazardStatus | None = None
    rectify_person: HazardPerson | None = None
    recheck_person: HazardPerson | None = None
    remark: Annotated[str, StringConstraints(max_length=2000)] | None = None
    after_image_ids: list[FileId] | None = Field(default=None, max_length=HAZARD_IMAGE_LIMIT)
    version: int

    @field_validator("after_image_ids")
    @classmethod
    def _unique_images(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _ensure_unique_image_ids(value)


# ===== 台账管理（台账总览 / 标签管理） =====
# 标签节点与台账记录各自最多 9 张图片，与全站 ImageUploader 默认上限一致。
LEDGER_IMAGE_LIMIT = 9
# 一条台账记录最多挂 20 个标签：`ledger.tag_ids` 是 VARCHAR(500)，id 是 BIGINT（至多 19 位），
# 取 20 时最坏情况 20 × 20 = 400 字符，必定放得下——不需要再为「超长」单独加一条错误码。
LEDGER_TAG_LIMIT = 20
LedgerName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=128)]
LedgerModelSpec = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
LedgerRemark = Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)]
# 子项号：技改项目下的子项编号，可留空（与申购计划的 subitem_no 同口径）。
# 不设 min_length：与 remark 一样，PATCH 传空串表示「清空该字段」。
LedgerSubitemNo = Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)]
# 单位与数量一起展示（列表按「12 台」呈现），因此必填。
LedgerUnitName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=32)
]
LedgerUsage = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
LedgerTagRemark = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
# 数量是整数件数（按台 / 套 / 件统计）。
LedgerQuantity = Annotated[int, Field(ge=0)]
LedgerTagId = Annotated[int, Field(ge=1)]
LedgerImageIds = Annotated[list[FileId], Field(max_length=LEDGER_IMAGE_LIMIT)]
LedgerTagIds = Annotated[list[LedgerTagId], Field(max_length=LEDGER_TAG_LIMIT)]


class LedgerTagRead(ReadModel):
    """台账标签节点：平铺返回（靠 `parent_id` 表达层级），前端据此拼横向树。

    `level`（1..3，由祖先链算出）与 `child_count`（直接子节点数）供页面判断
    「还能不能再挂子标签」与节点计数展示。
    """

    id: int
    parent_id: int | None = None
    name: str
    remark: str | None = None
    level: int
    child_count: int
    images: list[FileObjectRead]
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class LedgerTagCreate(RequestModel):
    parent_id: int | None = None
    name: LedgerName
    remark: LedgerTagRemark | None = None
    image_ids: LedgerImageIds = Field(default_factory=list)

    @field_validator("image_ids")
    @classmethod
    def _unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)


class LedgerTagUpdate(RequestModel):
    """编辑标签：名称 / 备注 / 图片，以及上级节点。

    `parent_id` 走「字段是否出现」区分：传 `null` 表示移为一级标签，**不传该字段表示不改上级**
    （旧客户端与只改名称 / 备注 / 图片的调用照旧）。改上级后整棵子树重新计入层级，
    「超过 3 层」或「移到自己子孙下」由 service 拒绝（`LEDGER_TAG_MAX_LEVEL`）。
    """

    parent_id: int | None = None
    name: LedgerName | None = None
    remark: LedgerTagRemark | None = None
    image_ids: LedgerImageIds | None = None
    version: int

    @field_validator("image_ids")
    @classmethod
    def _unique_images(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _ensure_unique_image_ids(value)


class LedgerTagRefRead(ReadModel):
    """台账记录上的标签引用：id + 名称 + 完整层级路径（列表「标签」列直接展示 `path`）。"""

    id: int
    name: str
    path: str


class LedgerItemRead(ReadModel):
    """台账记录：标签以 id 列表返回，并附名称与完整路径，列表页无需再解析。"""

    id: int
    name: str
    model_spec: str
    subitem_no: str | None = None
    quantity: int
    unit_name: str
    usage: str
    remark: str | None = None
    tag_ids: list[int]
    tags: list[LedgerTagRefRead]
    images: list[FileObjectRead]
    created_at: UtcDateTime
    updated_at: UtcDateTime
    version: int


class LedgerItemCreate(RequestModel):
    name: LedgerName
    model_spec: LedgerModelSpec
    subitem_no: LedgerSubitemNo | None = None
    quantity: LedgerQuantity = 0
    unit_name: LedgerUnitName
    usage: LedgerUsage
    remark: LedgerRemark | None = None
    tag_ids: LedgerTagIds = Field(default_factory=list)
    image_ids: LedgerImageIds = Field(default_factory=list)

    @field_validator("tag_ids")
    @classmethod
    def _unique_tags(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("tag_ids contains duplicates")
        return value

    @field_validator("image_ids")
    @classmethod
    def _unique_images(cls, value: list[str]) -> list[str]:
        return _ensure_unique_image_ids(value)


class LedgerItemUpdate(RequestModel):
    name: LedgerName | None = None
    model_spec: LedgerModelSpec | None = None
    subitem_no: LedgerSubitemNo | None = None
    quantity: LedgerQuantity | None = None
    unit_name: LedgerUnitName | None = None
    usage: LedgerUsage | None = None
    remark: LedgerRemark | None = None
    tag_ids: LedgerTagIds | None = None
    image_ids: LedgerImageIds | None = None
    version: int

    @field_validator("tag_ids")
    @classmethod
    def _unique_tags(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("tag_ids contains duplicates")
        return value

    @field_validator("image_ids")
    @classmethod
    def _unique_images(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _ensure_unique_image_ids(value)


__all__ = [name for name in globals() if not name.startswith("_")]
