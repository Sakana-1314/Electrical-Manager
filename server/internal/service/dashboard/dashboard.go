// Package dashboard 对应原 services/dashboard_service.py + repositories/dashboard_repository.py：工作台概览计数。
package dashboard

import (
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// 已入库是申购记录状态的终点（状态只进不退），其余状态都算在途。
const purchaseLineDone = "已入库"

// todayRange 上海时区「今天」对应的 UTC 区间 [start, end)：stock_operation.occurred_at 按 UTC 无时区存储。
func todayRange(now time.Time) (time.Time, time.Time) {
	local := now.In(common.Shanghai)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, common.Shanghai).UTC()
	return start, start.Add(24 * time.Hour)
}

// Summary 对应 dashboard_summary：精简模式下物资数取精简表行数、低库存计 0。
//
// 所有计数合并成一条带标量子查询的语句：工作台每次进入都会调用，原来 4~5 次往返各扫一遍，
// 合并后一次往返完成，各子查询仍按 project_id 走各自索引。
func Summary(s *db.Session) (schema.DashboardSummaryRead, error) {
	var out schema.DashboardSummaryRead
	lite, err := aisearch.IsLiteSecondaryWarehouse(s)
	if err != nil {
		return out, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return out, err
	}
	stockCount := "(SELECT COUNT(id) FROM stock_material WHERE project_id = ?)"
	lowStock := "(SELECT COUNT(m.id) FROM stock_material m JOIN stock_balance b ON m.id = b.stock_material_id AND b.project_id = ? JOIN stock_replenishment_policy p ON m.id = p.stock_material_id AND p.project_id = ? WHERE p.enabled = ? AND b.quantity <= p.minimum_qty AND m.project_id = ?)"
	stockArgs := []any{pid}
	lowArgs := []any{pid, pid, true, pid}
	if lite {
		stockCount = "(SELECT COUNT(id) FROM lite_inventory WHERE project_id = ?)"
		lowStock = "0"
		lowArgs = nil
	}
	normal := domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal)
	start, end := todayRange(time.Now())
	inbound := domain.OperationType.ToDB(domain.OperationInbound)
	outbound := domain.OperationType.ToDB(domain.OperationOutbound)
	query := "SELECT " +
		stockCount + " AS stock_material_count, " +
		lowStock + " AS low_stock_count, " +
		"(SELECT COUNT(id) FROM purchase_material WHERE material_code IS NULL AND status = ? AND project_id = ?) AS uncoded_purchase_material_count, " +
		"(SELECT COUNT(id) FROM purchase_request_line WHERE project_id = ?) AS purchase_record_count, " +
		"(SELECT COUNT(pm.id) FROM purchase_material pm WHERE pm.status = ? AND pm.project_id = ? AND NOT EXISTS (SELECT 1 FROM purchase_request_line prl WHERE prl.purchase_material_id = pm.id AND prl.project_id = ?)) AS pending_purchase_plan_count, " +
		"(SELECT COUNT(id) FROM purchase_request_line WHERE status <> ? AND project_id = ?) AS purchase_in_progress_count, " +
		"(SELECT COUNT(id) FROM stock_operation WHERE operation_type = ? AND reversal_of_id IS NULL AND occurred_at >= ? AND occurred_at < ? AND project_id = ?) AS today_inbound_count, " +
		"(SELECT COUNT(id) FROM stock_operation WHERE operation_type = ? AND reversal_of_id IS NULL AND occurred_at >= ? AND occurred_at < ? AND project_id = ?) AS today_outbound_count"
	args := append([]any{}, stockArgs...)
	args = append(args, lowArgs...)
	args = append(args,
		normal, pid,
		pid,
		normal, pid, pid,
		purchaseLineDone, pid,
		inbound, start, end, pid,
		outbound, start, end, pid,
	)
	var row struct {
		StockMaterialCount           int64 `db:"stock_material_count"`
		LowStockCount                int64 `db:"low_stock_count"`
		UncodedPurchaseMaterialCount int64 `db:"uncoded_purchase_material_count"`
		PurchaseRecordCount          int64 `db:"purchase_record_count"`
		PendingPurchasePlanCount     int64 `db:"pending_purchase_plan_count"`
		PurchaseInProgressCount      int64 `db:"purchase_in_progress_count"`
		TodayInboundCount            int64 `db:"today_inbound_count"`
		TodayOutboundCount           int64 `db:"today_outbound_count"`
	}
	if err := s.Get(&row, query, args...); err != nil {
		return out, err
	}
	return schema.DashboardSummaryRead(row), nil
}
