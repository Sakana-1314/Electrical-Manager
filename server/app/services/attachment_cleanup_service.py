"""附件清理后台任务。

每天凌晨 2 点（北京时间）扫描全库 `file_object` 中已软删除（`deleted_at` 非空）的附件：

- 复查被引用次数：软删除之后又被业务重新挂上的，撤销删除、恢复在用（不等保留期满）；
- 保留期未满（`attachment_purge_after` 未到）的继续留着，不动；
- 保留期满且仍无任何引用的，才物理删除数据库行与磁盘文件。

保留期是提交删除后的完整 7 个自然日，到期后的**第一个凌晨 2 点**才执行清除（因此实际清除时刻
是「提交删除时间 + 7 天」之后的第一个 2 点）。这样「删除」在界面上是即时生效的软删除，
真正的数据清除一定经过一次全库引用复查，既避免误删正在被引用的图片，
也给「删错了」留出 7 天可撤销的窗口。
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from app.core.constants import SHANGHAI
from app.core.database import system_session
from app.schemas import AttachmentCleanupRead
from app.services import file_service
from app.services.common import seconds_until_local_hour

logger = logging.getLogger(__name__)

_CLEANUP_HOUR = file_service.ATTACHMENT_PURGE_HOUR


def _seconds_until_two_am(now: datetime) -> float:
    """距下一个凌晨 2 点（北京时间）的秒数。纯函数便于单测。"""
    return seconds_until_local_hour(now, _CLEANUP_HOUR)


async def cleanup_deleted_attachments_once() -> AttachmentCleanupRead:
    """扫描一批待删除附件并完成物理清除，返回本次清理结果。幂等：无候选立即返回空结果。

    系统级维护：引用复查必须覆盖全部项目，需显式 `system_scope()`。
    """
    async with system_session() as session:
        return await file_service.purge_deleted_attachments(session)


async def run_cleanup_worker(stop_event: asyncio.Event) -> None:
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(
                stop_event.wait(),
                timeout=_seconds_until_two_am(datetime.now(SHANGHAI)),
            )
            break
        except TimeoutError:
            pass
        try:
            while True:
                result = await cleanup_deleted_attachments_once()
                # 保留期内的附件本轮不会被清除也不会被撤销：只要这一轮什么都没做，
                # 就说明剩下的都是继续保留的（否则 `scanned` 会一直非 0，循环停不下来）。
                if not result.purged_file_ids and not result.restored_file_ids:
                    break
        except Exception:
            logger.exception("attachment cleanup iteration failed")
