// Package attachment 对应原 services/attachment_cleanup_service.py：附件清理后台任务。
//
// 每天凌晨 2 点（北京时间）扫描全库 file_object 中已软删除（deleted_at 非空）的附件：
//
//   - 复查被引用次数：软删除之后又被业务重新挂上的，撤销删除、恢复在用（不等保留期满）；
//   - 保留期未满（AttachmentPurgeAfter 未到）的继续留着，不动；
//   - 保留期满且仍无任何引用的，才物理删除数据库行与磁盘文件。
//
// 保留期是提交删除后的完整 7 个自然日，到期后的第一个凌晨 2 点才执行清除。
package attachment

import (
	"context"
	"log/slog"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
)

const cleanupHour = file.AttachmentPurgeHour

// purgeBatchSize 与 purge_deleted_attachments 的默认 batch_size 一致。
const purgeBatchSize = 200

func init() {
	lifecycle.Worker("attachment-cleanup", func() bool { return config.S.AttachmentCleanupEnabled }, RunCleanupWorker)
}

// SecondsUntilTwoAM 距下一个凌晨 2 点（北京时间）的时长。纯函数便于单测。
func SecondsUntilTwoAM(now time.Time) time.Duration {
	return common.SecondsUntilLocalHour(now, cleanupHour)
}

// CleanupDeletedAttachmentsOnce 扫描一批待删除附件并完成物理清除，返回本次清理结果。
// 系统级维护：引用复查必须覆盖全部项目，使用系统上下文的独立会话。
func CleanupDeletedAttachmentsOnce(ctx context.Context) (schema.AttachmentCleanupRead, error) {
	s := db.SystemSession(ctx)
	defer s.Close()
	return file.PurgeDeletedAttachments(s, purgeBatchSize)
}

// RunCleanupWorker 常驻任务：等到下一个凌晨 2 点，循环清理直到某一轮既没有清除也没有撤销。
func RunCleanupWorker(ctx context.Context) {
	for {
		timer := time.NewTimer(SecondsUntilTwoAM(time.Now().In(common.Shanghai)))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		for {
			result, err := CleanupDeletedAttachmentsOnce(ctx)
			if err != nil {
				slog.Error("attachment cleanup iteration failed", "error", err)
				break
			}
			// 保留期内的附件本轮不会被清除也不会被撤销：只要这一轮什么都没做就停止。
			if len(result.PurgedFileIDs) == 0 && len(result.RestoredFileIDs) == 0 {
				break
			}
		}
	}
}
