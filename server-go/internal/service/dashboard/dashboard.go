// Package dashboard 对应原 services/dashboard_service.py + repositories/dashboard_repository.py：工作台概览计数。
package dashboard

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
)

func count(s *db.Session, query string, args ...any) (int64, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return 0, err
	}
	var n int64
	err = s.Get(&n, query, append(args, pid)...)
	return n, err
}

// Summary 对应 dashboard_summary：精简模式下物资数取精简表行数、低库存计 0。
func Summary(s *db.Session) (schema.DashboardSummaryRead, error) {
	var out schema.DashboardSummaryRead
	lite, err := aisearch.IsLiteSecondaryWarehouse(s)
	if err != nil {
		return out, err
	}
	if lite {
		if out.StockMaterialCount, err = count(s, "SELECT COUNT(id) FROM lite_inventory WHERE project_id = ?"); err != nil {
			return out, err
		}
	} else {
		if out.StockMaterialCount, err = count(s, "SELECT COUNT(id) FROM stock_material WHERE project_id = ?"); err != nil {
			return out, err
		}
		pid, err := s.ProjectID()
		if err != nil {
			return out, err
		}
		if err := s.Get(&out.LowStockCount,
			"SELECT COUNT(m.id) FROM stock_material m JOIN stock_balance b ON m.id = b.stock_material_id AND b.project_id = ? JOIN stock_replenishment_policy p ON m.id = p.stock_material_id AND p.project_id = ? WHERE p.enabled = ? AND b.quantity <= p.minimum_qty AND m.project_id = ?",
			pid, pid, true, pid); err != nil {
			return out, err
		}
	}
	if out.UncodedPurchaseMaterialCount, err = count(s, "SELECT COUNT(id) FROM purchase_material WHERE material_code IS NULL AND status = ? AND project_id = ?",
		domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal)); err != nil {
		return out, err
	}
	if out.PurchaseRecordCount, err = count(s, "SELECT COUNT(id) FROM purchase_request_line WHERE project_id = ?"); err != nil {
		return out, err
	}
	return out, nil
}
