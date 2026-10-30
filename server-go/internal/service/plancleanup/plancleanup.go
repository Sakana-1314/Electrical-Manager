// Package plancleanup 对应原 services/purchase_plan_cleanup_service.py：申购计划清理后台任务。
//
// 每天凌晨 2 点（北京时间）删除已转入申购记录的申购计划，消除计划表冗余留存。记录转入时已把计划全部
// 业务字段快照到 purchase_request_line（含图片镜像），读路径不再依赖计划表，因此删除计划是安全的。
// 删除前先将记录行 purchase_material_id 置空（解绑外键），再物理删除计划。
package plancleanup

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	cleanupHour = 2
	// BatchSize 每批最多清理的计划数。
	BatchSize = 50
)

func init() {
	lifecycle.Worker("purchase-plan-cleanup", func() bool { return config.S.PurchasePlanCleanupEnabled }, RunCleanupWorker)
}

// SecondsUntilTwoAM 距下一个凌晨 2 点（北京时间）的时长。纯函数便于单测。
func SecondsUntilTwoAM(now time.Time) time.Duration {
	return common.SecondsUntilLocalHour(now, cleanupHour)
}

// CleanupMovedPlansOnce 删除一批已转入申购记录的计划，返回删除数。幂等：无候选立即返回 0。
//
// 迁移护栏：仅清理被引用的行快照已回填（plan_no_snapshot 非空）的计划。系统级维护：跨项目批量清理。
// PostgreSQL 不允许 FOR UPDATE 与 DISTINCT 同时出现：先在子查询里取去重后的候选 id，再在外层按 id 锁行。
func CleanupMovedPlansOnce(ctx context.Context) (int, error) {
	s := db.SystemSession(ctx)
	defer s.Close()
	var ids []int64
	if err := s.Select(&ids, "SELECT purchase_material.id FROM purchase_material WHERE purchase_material.id IN ("+
		"SELECT DISTINCT pm.id FROM purchase_material pm JOIN purchase_request_line prl ON prl.purchase_material_id = pm.id "+
		"WHERE prl.plan_no_snapshot IS NOT NULL AND TRIM(prl.plan_no_snapshot) != ?"+
		") ORDER BY purchase_material.id LIMIT ? FOR UPDATE SKIP LOCKED", "", BatchSize); err != nil {
		return 0, err
	}
	if len(ids) == 0 {
		return 0, nil
	}
	if _, err := s.ExecIn("UPDATE purchase_request_line SET purchase_material_id = NULL, updated_at = ? WHERE purchase_material_id IN (?)", common.UTCNow(), ids); err != nil {
		return 0, err
	}
	if _, err := s.ExecIn("DELETE FROM purchase_material WHERE id IN (?)", ids); err != nil {
		return 0, err
	}
	if err := s.Commit(); err != nil {
		return 0, err
	}
	slog.Info(fmt.Sprintf("cleaned moved purchase plans count=%d ids=%v", len(ids), ids))
	return len(ids), nil
}

// RunCleanupWorker 每天凌晨 2 点循环清理，直到没有候选。
func RunCleanupWorker(ctx context.Context) {
	for {
		timer := time.NewTimer(SecondsUntilTwoAM(time.Now().In(common.Shanghai)))
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-timer.C:
		}
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error(fmt.Sprintf("purchase plan cleanup iteration failed: %v", r))
				}
			}()
			for {
				n, err := CleanupMovedPlansOnce(ctx)
				if err != nil {
					slog.Error(fmt.Sprintf("purchase plan cleanup iteration failed: %v", err))
					return
				}
				if n == 0 {
					return
				}
			}
		}()
	}
}
