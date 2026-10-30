"""测试用到的枚举。库内保存枚举「名」，对应 init.sql 里同名的 PostgreSQL ENUM 类型。"""

from enum import StrEnum


class Role(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    WAREHOUSE_ADMIN = "WAREHOUSE_ADMIN"
    PURCHASE_ADMIN = "PURCHASE_ADMIN"
    HAZARD_ADMIN = "HAZARD_ADMIN"
    READ_ONLY = "READ_ONLY"
    LEDGER_ADMIN = "LEDGER_ADMIN"
    WORK_ADMIN = "WORK_ADMIN"


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
