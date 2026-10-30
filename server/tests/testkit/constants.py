"""契约常量与时间工具：服务端约定的取值，用作断言的期望值。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

# 上海时区（业务时间展示 / 默认值基准）
SHANGHAI = timezone(timedelta(hours=8))

# 导出行数上限
EXPORT_ROW_LIMIT = 10_000

# 图片上传大小上限（10MB）
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# 附件软删除后保留完整 7 个自然日，到期后的第一个凌晨 2 点（北京时间）复查引用并物理删除
ATTACHMENT_PURGE_HOUR = 2
ATTACHMENT_RETENTION_DAYS = 7
# 「删除未引用附件」的新人保护期：上传后这么多天内、且从未被引用过的附件不进回收队列
ATTACHMENT_UNREFERENCED_MIN_AGE_DAYS = 7
# 免重复上传二次校验的片段窗口大小
PROBE_WINDOW_BYTES = 64 * 1024

# 已转入申购记录的计划清理任务每批最多删除的条数
PLAN_CLEANUP_BATCH_SIZE = 50


def utcnow() -> datetime:
    """数据库口径的当前时间：UTC、无时区（TIMESTAMP 列）。"""
    return datetime.now(UTC).replace(tzinfo=None)


def attachment_purge_after(deleted_at: datetime) -> datetime:
    """软删除附件的物理清除时刻：保留期满后的第一个凌晨 2 点（含边界），返回 UTC。"""
    if deleted_at.tzinfo is None:
        deleted_at = deleted_at.replace(tzinfo=UTC)
    deadline = deleted_at.astimezone(SHANGHAI) + timedelta(days=ATTACHMENT_RETENTION_DAYS)
    target = deadline.replace(hour=ATTACHMENT_PURGE_HOUR, minute=0, second=0, microsecond=0)
    if deadline > target:
        target += timedelta(days=1)
    return target.astimezone(UTC)
