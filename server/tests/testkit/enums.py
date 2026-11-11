"""测试用到的枚举。库内保存枚举「名」，对应 init.sql 里同名的 PostgreSQL ENUM 类型。"""

from enum import StrEnum


class UserSource(StrEnum):
    MANAGE = "MANAGE"
    MINI_PROGRAM = "MINI_PROGRAM"


# 内置角色（与 init.sql 种子同名同权限）：测试按角色名挂 user_role。
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "超级管理员": ["*"],
    "库房管理员": ["warehouse:read", "warehouse:write", "huaxing:read", "codes:read"],
    "采购管理员": ["purchase:read", "purchase:write", "huaxing:read", "codes:read"],
    "隐患管理员": ["hazard:read", "hazard:write"],
    "台账管理员": ["ledger:read", "ledger:write"],
    "工单管理员": ["work:read", "work:write"],
    "只读用户": [
        "warehouse:read",
        "purchase:read",
        "huaxing:read",
        "codes:read",
        "ledger:read",
        "hazard:read",
        "work:read",
    ],
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
