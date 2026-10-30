// Package replenishment 对应原 services/replenishment_service.py：补库策略、补库默认值与低库存补库草稿。
package replenishment

import (
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/inventory"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
)

func pyDecStr(d jtype.Decimal) string {
	if exp := d.Exponent(); exp < 0 {
		return d.StringFixed(-exp)
	}
	return d.Decimal.String()
}

// Defaults 对应 replenishment_defaults：最近一条有效采购负责人 + 上海时区今天。
func Defaults(s *db.Session) (schema.ReplenishmentDefaultsRead, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return schema.ReplenishmentDefaultsRead{}, err
	}
	var latest *string
	if _, err := s.Find(&latest, "SELECT purchase_responsible FROM purchase_material WHERE TRIM(purchase_responsible) NOT IN (?, ?, ?, ?, ?) AND project_id = ? ORDER BY id DESC LIMIT 1",
		"", "\\", "/", "—", "-", pid); err != nil {
		return schema.ReplenishmentDefaultsRead{}, err
	}
	responsible := ""
	if latest != nil {
		responsible = *latest
	}
	return schema.ReplenishmentDefaultsRead{PurchaseResponsible: responsible, DemandDate: jtype.DateOf(time.Now().In(common.Shanghai))}, nil
}

// SetPolicy 对应 set_policy：首次保存新建策略，之后按 version 乐观锁更新。
func SetPolicy(s *db.Session, stock *material.Stock, data schema.ReplenishmentPolicyWrite) (*material.Stock, error) {
	if err := common.ValidateQuantityPrecision(data.MinimumQty); err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	if stock.Policy == nil {
		p := &model.StockReplenishmentPolicy{StockMaterialID: stock.ID, MinimumQty: data.MinimumQty, Enabled: data.Enabled, CreatedAt: now, UpdatedAt: now, Version: 1, ProjectID: pid}
		if _, err := s.Exec("INSERT INTO stock_replenishment_policy (stock_material_id, minimum_qty, enabled, created_at, updated_at, version, project_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
			p.StockMaterialID, p.MinimumQty, p.Enabled, p.CreatedAt, p.UpdatedAt, p.Version, p.ProjectID); err != nil {
			return nil, err
		}
		stock.Policy = p
		return stock, nil
	}
	p := stock.Policy
	if err := apperr.ValidateVersion(data.Version, p.Version); err != nil {
		return nil, err
	}
	p.MinimumQty = data.MinimumQty
	p.Enabled = data.Enabled
	p.Version++
	p.UpdatedAt = now
	if _, err := s.Exec("UPDATE stock_replenishment_policy SET minimum_qty = ?, enabled = ?, version = ?, updated_at = ? WHERE stock_material_id = ? AND project_id = ?",
		p.MinimumQty, p.Enabled, p.Version, p.UpdatedAt, p.StockMaterialID, pid); err != nil {
		return nil, err
	}
	return stock, nil
}

// CreateDraft 对应 create_replenishment_draft：低库存物资按确认数量生成申购计划。
func CreateDraft(s *db.Session, stockMaterialID int64, data schema.ReplenishmentDraftCreate) (schema.ReplenishmentDraftRead, error) {
	var out schema.ReplenishmentDraftRead
	stock, err := material.GetStock(s, stockMaterialID)
	if err != nil {
		return out, err
	}
	if stock.Balance == nil {
		return out, apperr.New("BALANCE_MISSING", "库存余额记录不存在").WithStatus(409)
	}
	policy := stock.Policy
	if policy == nil || !policy.Enabled || stock.Balance.Quantity.GreaterThan(policy.MinimumQty.Decimal) {
		return out, apperr.New("NOT_LOW_STOCK", "该物资当前不在低库存范围").WithStatus(409)
	}
	recent, err := inventory.RecentOutboundConsumption(s, []int64{stock.ID}, nil)
	if err != nil {
		return out, err
	}
	suggested, ok := recent[stock.ID]
	if !ok {
		suggested = jtype.MustDecimal("0")
	}
	if err := common.ValidateQuantityPrecision(data.PlannedQty); err != nil {
		return out, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return out, err
	}
	var previousCode *string
	if _, err := s.Find(&previousCode, "SELECT material_code FROM purchase_material WHERE stock_material_id = ? AND material_code IS NOT NULL AND project_id = ? ORDER BY id DESC LIMIT 1", stock.ID, pid); err != nil {
		return out, err
	}
	note := "补库计划：建议申购 " + pyDecStr(suggested) + " " + stock.UnitName
	if !data.PlannedQty.Equal(suggested.Decimal) {
		note += "，确认计划 " + pyDecStr(data.PlannedQty) + " " + stock.UnitName
	}
	parts := []string{}
	if stock.Remark != nil && *stock.Remark != "" {
		parts = append(parts, *stock.Remark)
	}
	parts = append(parts, note)
	remark := strings.Join(parts, "；")
	create := schema.NewPurchaseMaterialCreate()
	create.PlanDate = data.DemandDate
	create.MaterialCode = previousCode
	create.Name = stock.Name
	create.ModelSpec = stock.ModelSpec
	create.UnitName = stock.UnitName
	actual := data.ActualDemandPerson
	responsible := data.PurchaseResponsible
	create.ActualDemandPerson = &actual
	create.PurchaseResponsible = &responsible
	create.PlannedQty = data.PlannedQty
	create.Usage = "低库存补库"
	create.Remark = &remark
	id := stock.ID
	create.StockMaterialID = &id
	create.ImageIDs = material.ImageIDs(stock.Images)
	purchase, err := material.CreatePurchase(s, create)
	if err != nil {
		return out, err
	}
	return schema.ReplenishmentDraftRead{Next: "purchase_material", ResourceID: purchase.ID}, nil
}
