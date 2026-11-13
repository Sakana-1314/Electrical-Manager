"""测试用到的枚举。库内保存枚举「名」，对应 init.sql 里同名的 PostgreSQL ENUM 类型。"""

from enum import StrEnum


# 权限位（与 server/internal/domain/permissions.go 的 PermissionCatalog 一致）：
# 用户权限直接存 app_user.permissions（BIGINT 位图），测试按位组合。
PERMISSION_BITS: dict[str, int] = {
    "system:admin": 1 << 0,
    "warehouse:read": 1 << 1,
    "warehouse:write": 1 << 2,
    "purchase:read": 1 << 3,
    "purchase:write": 1 << 4,
    "huaxing:read": 1 << 5,
    # 位 6 退役（原 codes:read，物料编码库并入申购权限），保留空位不重排。
    "ledger:read": 1 << 7,
    "ledger:write": 1 << 8,
    "hazard:read": 1 << 9,
    "hazard:write": 1 << 10,
    "work:read": 1 << 11,
    "work:write": 1 << 12,
    "lite:read": 1 << 13,
    "lite:write": 1 << 14,
}


def permission_bits(*keys: str) -> int:
    """权限键 → 位图（写权限自动带上同模块读权限）。"""
    bits = 0
    for key in keys:
        bits |= PERMISSION_BITS[key]
        if key.endswith(":write"):
            bits |= PERMISSION_BITS[key[: -len(":write")] + ":read"]
    return bits


ALL_PERMISSIONS = 0
for _bit in PERMISSION_BITS.values():
    ALL_PERMISSIONS |= _bit


# 小程序新用户默认权限：精简二级库 / 申购 / 华星只读
DEFAULT_PERMISSION_KEYS: tuple[str, ...] = (
    "lite:read",
    "purchase:read",
    "huaxing:read",
)
DEFAULT_REGISTRATION_PERMISSIONS = permission_bits(*DEFAULT_PERMISSION_KEYS)

# 种子账号权限位（与 init.sql 种子一致）
SEED_USER_PERMISSIONS: dict[str, int] = {
    "admin": ALL_PERMISSIONS,
    # 仓库管理员同时持标准 / 精简两套二级库权限（测试两种数据源都要用到）
    "warehouse": permission_bits("warehouse:read", "warehouse:write", "lite:read", "lite:write"),
    "purchase": permission_bits("purchase:read", "purchase:write"),
    "hazard": permission_bits("hazard:read", "hazard:write"),
    "ledger": permission_bits("ledger:read", "ledger:write"),
    "work": permission_bits("work:read", "work:write"),
    "readonly": permission_bits(
        "warehouse:read",
        "lite:read",
        "purchase:read",
        "huaxing:read",
        "ledger:read",
        "hazard:read",
        "work:read",
    ),
}


class PurchasePlanStatus(StrEnum):
    NORMAL = "正常"
    DEFERRED = "暂不申购"
    ARCHIVED = "已归档"


class MiniProgramCodeEnv(StrEnum):
    TRIAL = "trial"
    RELEASE = "release"


class ShareType(StrEnum):
    PURCHASE_PLAN = "purchase_plan"
    PURCHASE_RECORD = "purchase_record"


class WebhookPlatform(StrEnum):
    FEISHU = "FEISHU"
    DINGTALK = "DINGTALK"


class WebhookEventType(StrEnum):
    STOCK_OUTBOUND_CREATED = "stock.outbound.created"
    STOCK_INBOUND_CREATED = "stock.inbound.created"
    MINI_PROGRAM_USER_BOUND = "mini_program.user.bound"


class WebhookDeliveryStatus(StrEnum):
    PENDING = "PENDING"
    SENDING = "SENDING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class ExcelImportJobStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


class ExcelExportJobStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"
