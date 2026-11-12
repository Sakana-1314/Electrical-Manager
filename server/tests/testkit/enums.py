"""测试用到的枚举。库内保存枚举「名」，对应 init.sql 里同名的 PostgreSQL ENUM 类型。"""

from enum import StrEnum


class UserSource(StrEnum):
    MANAGE = "MANAGE"
    MINI_PROGRAM = "MINI_PROGRAM"


# 内置角色（与 init.sql 种子同名同权限，顺序一致以保证种子 id 稳定）：测试按角色名挂 user_role。
ROLE_PERMISSIONS: dict[str, list[str]] = {
    "超级管理员": ["*"],
    "二级库只读": ["warehouse:read"],
    "二级库读写": ["warehouse:read", "warehouse:write"],
    "申购只读": ["purchase:read"],
    "申购读写": ["purchase:read", "purchase:write"],
    "隐患只读": ["hazard:read"],
    "隐患读写": ["hazard:read", "hazard:write"],
    "台账只读": ["ledger:read"],
    "台账读写": ["ledger:read", "ledger:write"],
    "工单只读": ["work:read"],
    "工单读写": ["work:read", "work:write"],
    "华星只读": ["huaxing:read"],
    "编码库只读": ["codes:read"],
}

# 小程序新用户默认挂载的全部只读角色
DEFAULT_ROLE_NAMES = (
    "二级库只读",
    "申购只读",
    "隐患只读",
    "台账只读",
    "工单只读",
    "华星只读",
    "编码库只读",
)


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
