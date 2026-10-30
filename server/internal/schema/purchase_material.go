package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// 申购计划（purchase_material）读写模型：申购计划 / 分享 / 小程序模块复用。

const purchasePlanStatusOneOf = "'正常', '暂不申购' or '已归档'"

// 默认值与 services/common.py、domain.PurchasePlanStatus 一致。
const (
	purchaseDefaultUrgency    = "正常"
	purchaseDefaultDepartment = "HXNI 检修维护部"
	purchaseDefaultStatus     = "正常"
)

type PurchaseFilterOptions struct {
	ActualDemandPersons  []string `json:"actual_demand_persons"`
	PurchaseResponsibles []string `json:"purchase_responsibles"`
	SubitemNos           []string `json:"subitem_nos"`
	Categories           []string `json:"categories"`
}

// PurchaseMaterialCreate 对应 PurchaseMaterialCreate（PurchaseMaterialBase）。用 NewPurchaseMaterialCreate 预填默认值。
type PurchaseMaterialCreate struct {
	PlanDate            *jtype.Date   `json:"plan_date"`
	MaterialCode        *string       `json:"material_code" v:"blanknil,min=1,max=64"`
	Category            *string       `json:"category" v:"blanknil,min=1,max=64"`
	Urgency             string        `json:"urgency" v:"min=1,max=32"`
	DemandDepartment    string        `json:"demand_department" v:"min=1,max=128"`
	Name                string        `json:"name" v:"required,min=1,max=128"`
	ModelSpec           string        `json:"model_spec" v:"required,min=1,max=255"`
	UnitName            string        `json:"unit_name" v:"required,min=1,max=32"`
	ActualDemandPerson  *string       `json:"actual_demand_person" v:"min=1,max=128"`
	PurchaseResponsible *string       `json:"purchase_responsible" v:"min=1,max=128"`
	PlannedQty          jtype.Decimal `json:"planned_qty" v:"required,gt=0,digits=18,places=1"`
	Usage               string        `json:"usage" v:"required,min=1,max=500"`
	SubitemNo           *string       `json:"subitem_no" v:"min=1,max=64"`
	Remark              *string       `json:"remark" v:"max=1000"`
	StockMaterialID     *int64        `json:"stock_material_id"`
	ImageIDs            []string      `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Status              string        `json:"status" v:"oneof=正常|暂不申购|已归档"`
}

// NewPurchaseMaterialCreate 预填 Pydantic 默认值（urgency / demand_department / status / image_ids）。
func NewPurchaseMaterialCreate() PurchaseMaterialCreate {
	return PurchaseMaterialCreate{
		Urgency:          purchaseDefaultUrgency,
		DemandDepartment: purchaseDefaultDepartment,
		ImageIDs:         []string{},
		Status:           purchaseDefaultStatus,
	}
}

// PurchaseMaterialUpdate：`image_ids` 省略（nil）＝不改动图片；status 需要区分「省略」（model_fields_set）。
// 用 NewPurchaseMaterialUpdate 预填默认值（注意：未传的 urgency / demand_department 等会按默认值写回，与原版一致）。
type PurchaseMaterialUpdate struct {
	PlanDate            *jtype.Date     `json:"plan_date"`
	MaterialCode        *string         `json:"material_code" v:"blanknil,min=1,max=64"`
	Category            *string         `json:"category" v:"blanknil,min=1,max=64"`
	Urgency             string          `json:"urgency" v:"min=1,max=32"`
	DemandDepartment    string          `json:"demand_department" v:"min=1,max=128"`
	Name                string          `json:"name" v:"required,min=1,max=128"`
	ModelSpec           string          `json:"model_spec" v:"required,min=1,max=255"`
	UnitName            string          `json:"unit_name" v:"required,min=1,max=32"`
	ActualDemandPerson  *string         `json:"actual_demand_person" v:"min=1,max=128"`
	PurchaseResponsible *string         `json:"purchase_responsible" v:"min=1,max=128"`
	PlannedQty          jtype.Decimal   `json:"planned_qty" v:"required,gt=0,digits=18,places=1"`
	Usage               string          `json:"usage" v:"required,min=1,max=500"`
	SubitemNo           *string         `json:"subitem_no" v:"min=1,max=64"`
	Remark              *string         `json:"remark" v:"max=1000"`
	StockMaterialID     *int64          `json:"stock_material_id"`
	ImageIDs            *[]string       `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Status              web.Opt[string] `json:"status" v:"oneof=正常|暂不申购|已归档"`
	Version             int64           `json:"version" v:"required"`
}

// NewPurchaseMaterialUpdate 预填 Pydantic 默认值。
func NewPurchaseMaterialUpdate() PurchaseMaterialUpdate {
	return PurchaseMaterialUpdate{Urgency: purchaseDefaultUrgency, DemandDepartment: purchaseDefaultDepartment}
}

func (u *PurchaseMaterialUpdate) Validate(loc []any) []web.FieldError {
	if u.Status.Set && u.Status.Null {
		return []web.FieldError{purchaseStatusNullError(stockLoc(loc, "status"))}
	}
	return nil
}

// StatusValue 显式传入的状态值（未传返回 ""）。
func (u *PurchaseMaterialUpdate) StatusValue() (string, bool) {
	if u.Status.Present() {
		return u.Status.V, true
	}
	return "", false
}

func purchaseStatusNullError(loc []any) web.FieldError {
	return web.FieldError{Type: "enum", Loc: loc, Msg: "Input should be " + purchasePlanStatusOneOf, Input: nil,
		Ctx: map[string]any{"expected": purchasePlanStatusOneOf}}
}

type PurchasePlanVersion struct {
	ID      int64 `json:"id" v:"required"`
	Version int64 `json:"version" v:"required"`
}

// BatchUpdatePurchasePlansRequest：除 materials 外的字段都需要区分「省略 / null」（model_fields_set）。
type BatchUpdatePurchasePlansRequest struct {
	Materials           []PurchasePlanVersion `json:"materials" v:"required,min=1,max=200"`
	PlanDate            web.Opt[jtype.Date]   `json:"plan_date"`
	Category            web.Opt[string]       `json:"category" v:"min=1,max=64"`
	Urgency             web.Opt[string]       `json:"urgency" v:"min=1,max=32"`
	DemandDepartment    web.Opt[string]       `json:"demand_department" v:"min=1,max=128"`
	ActualDemandPerson  web.Opt[string]       `json:"actual_demand_person" v:"min=1,max=128"`
	PurchaseResponsible web.Opt[string]       `json:"purchase_responsible" v:"min=1,max=128"`
	SubitemNo           web.Opt[string]       `json:"subitem_no" v:"min=1,max=64"`
	Usage               web.Opt[string]       `json:"usage" v:"min=1,max=500"`
	Status              web.Opt[string]       `json:"status" v:"oneof=正常|暂不申购|已归档"`
}

func (b *BatchUpdatePurchasePlansRequest) Validate(loc []any) []web.FieldError {
	seen := map[int64]bool{}
	for _, m := range b.Materials {
		if seen[m.ID] {
			return []web.FieldError{web.ValueError(stockLoc(loc, "materials"), "materials must be unique", b.Materials)}
		}
		seen[m.ID] = true
	}
	type field struct {
		name     string
		set      bool
		null     bool
		nullable bool
	}
	fields := []field{
		{"plan_date", b.PlanDate.Set, b.PlanDate.Null, false},
		{"category", b.Category.Set, b.Category.Null, true},
		{"urgency", b.Urgency.Set, b.Urgency.Null, false},
		{"demand_department", b.DemandDepartment.Set, b.DemandDepartment.Null, false},
		{"actual_demand_person", b.ActualDemandPerson.Set, b.ActualDemandPerson.Null, false},
		{"purchase_responsible", b.PurchaseResponsible.Set, b.PurchaseResponsible.Null, false},
		{"subitem_no", b.SubitemNo.Set, b.SubitemNo.Null, true},
		{"usage", b.Usage.Set, b.Usage.Null, false},
		{"status", b.Status.Set, b.Status.Null, false},
	}
	selected := 0
	for _, f := range fields {
		if f.set {
			selected++
		}
	}
	if selected == 0 {
		return []web.FieldError{web.ValueError(loc, "at least one update field is required", b)}
	}
	for _, f := range fields {
		if f.set && f.null && !f.nullable {
			return []web.FieldError{web.ValueError(loc, f.name+" cannot be null", b)}
		}
	}
	return nil
}

type PurchaseMaterialRead struct {
	ID                  int64            `json:"id"`
	PlanNo              string           `json:"plan_no"`
	PlanDate            jtype.Date       `json:"plan_date"`
	MaterialCode        *string          `json:"material_code"`
	Category            *string          `json:"category"`
	Urgency             string           `json:"urgency"`
	DemandDepartment    string           `json:"demand_department"`
	Name                string           `json:"name"`
	ModelSpec           string           `json:"model_spec"`
	UnitName            string           `json:"unit_name"`
	ActualDemandPerson  string           `json:"actual_demand_person"`
	PurchaseResponsible string           `json:"purchase_responsible"`
	PlannedQty          jtype.Decimal    `json:"planned_qty"`
	Usage               string           `json:"usage"`
	SubitemNo           *string          `json:"subitem_no"`
	Remark              *string          `json:"remark"`
	StockMaterialID     *int64           `json:"stock_material_id"`
	StockMaterialName   *string          `json:"stock_material_name"`
	Status              string           `json:"status"`
	MovedToRecord       bool             `json:"moved_to_record"`
	Images              []FileObjectRead `json:"images"`
	CreatedAt           AwareTime        `json:"created_at"`
	UpdatedAt           AwareTime        `json:"updated_at"`
	Version             int64            `json:"version"`
}
