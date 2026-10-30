package schema

import (
	"bytes"
	"encoding/json"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// 申购计划转记录 / 申购记录 / 周期性计划（模板）/ 申购记录同步 / 结果导出的请求与响应模型。
// 申购计划本身的读写模型见 purchase_material.go。

// PurchasePlanResultColumns 对应 PurchasePlanResultColumn（申购计划结果导出 / 排序列）。
const PurchasePlanResultColumns = "plan_no|plan_date|material_code|category|urgency|demand_department|name|model_spec|planned_qty|unit_name|actual_demand_person|purchase_responsible|subitem_no|usage|images"

// PurchaseRecordResultColumns 对应 PurchaseRecordResultColumn（申购记录结果导出 / 排序列）。
const PurchaseRecordResultColumns = "purchase_qty|plan_date|purchase_order_no|trace_no|contract_no|vessel_no|consolidation_date|consolidation_port|sailing_date|contract_sign_date|unit_price|category|demand_department|material_name|model_spec|material_code|actual_demand_person|usage|purchase_responsible|salesperson|status|purchase_date|images|subitem_no"

func fieldLoc(loc []any, name string) []any {
	out := make([]any, 0, len(loc)+1)
	out = append(out, loc...)
	return append(out, name)
}

func uniqueInts(values []int64) bool {
	seen := make(map[int64]bool, len(values))
	for _, v := range values {
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}

func uniqueStrings(values []string) bool {
	seen := make(map[string]bool, len(values))
	for _, v := range values {
		if seen[v] {
			return false
		}
		seen[v] = true
	}
	return true
}

// PurchaseRecordFilterOptions 对应 PurchaseRecordFilterOptions。
type PurchaseRecordFilterOptions struct {
	ActualDemandPersons  []string `json:"actual_demand_persons"`
	PurchaseResponsibles []string `json:"purchase_responsibles"`
	SubitemNos           []string `json:"subitem_nos"`
	Categories           []string `json:"categories"`
	Salespersons         []string `json:"salespersons"`
	Statuses             []string `json:"statuses"`
}

// ---------------- 转入申购记录 ----------------

// MovePurchasePlanRequest：purchase_order_no 需要区分「省略」（默认申购单号）与「显式传值 / null」。
type MovePurchasePlanRequest struct {
	PurchaseOrderNo   web.Opt[string] `json:"purchase_order_no" v:"max=128"`
	TraceNo           *string         `json:"trace_no" v:"max=128"`
	ContractNo        *string         `json:"contract_no" v:"max=128"`
	VesselNo          *string         `json:"vessel_no" v:"max=128"`
	ConsolidationDate *jtype.Date     `json:"consolidation_date"`
	ConsolidationPort *string         `json:"consolidation_port" v:"max=128"`
	SailingDate       *jtype.Date     `json:"sailing_date"`
	ContractSignDate  *jtype.Date     `json:"contract_sign_date"`
	PurchaseDate      jtype.Date      `json:"purchase_date" v:"required"`
	Salesperson       *string         `json:"salesperson" v:"min=1,max=128"`
	Status            string          `json:"status" v:"min=1,max=128"`
	RecordRemark      *string         `json:"record_remark" v:"max=1000"`
}

// NewMovePurchasePlanRequest 预填默认值（status=已申购）。
func NewMovePurchasePlanRequest() MovePurchasePlanRequest {
	return MovePurchasePlanRequest{Status: "已申购"}
}

// BatchMovePurchasePlansRequest 在 MovePurchasePlanRequest 基础上增加 material_ids。
type BatchMovePurchasePlansRequest struct {
	MovePurchasePlanRequest
	MaterialIDs []int64 `json:"material_ids" v:"required,min=1,max=200"`
}

// 嵌入字段需要平铺解码：web 解码器不支持匿名嵌入，这里用独立结构体承接后再组装。
type batchMoveBody struct {
	PurchaseOrderNo   web.Opt[string] `json:"purchase_order_no" v:"max=128"`
	TraceNo           *string         `json:"trace_no" v:"max=128"`
	ContractNo        *string         `json:"contract_no" v:"max=128"`
	VesselNo          *string         `json:"vessel_no" v:"max=128"`
	ConsolidationDate *jtype.Date     `json:"consolidation_date"`
	ConsolidationPort *string         `json:"consolidation_port" v:"max=128"`
	SailingDate       *jtype.Date     `json:"sailing_date"`
	ContractSignDate  *jtype.Date     `json:"contract_sign_date"`
	PurchaseDate      jtype.Date      `json:"purchase_date" v:"required"`
	Salesperson       *string         `json:"salesperson" v:"min=1,max=128"`
	Status            string          `json:"status" v:"min=1,max=128"`
	RecordRemark      *string         `json:"record_remark" v:"max=1000"`
	MaterialIDs       []int64         `json:"material_ids" v:"required,min=1,max=200"`
}

func (b *batchMoveBody) Validate(loc []any) []web.FieldError {
	if !uniqueInts(b.MaterialIDs) {
		return []web.FieldError{web.ValueError(fieldLoc(loc, "material_ids"), "material_ids must be unique", b.MaterialIDs)}
	}
	return nil
}

// DecodeBatchMovePurchasePlans 解码批量转入请求体（预填 status 默认值）。
func DecodeBatchMovePurchasePlans(p *web.Params, raw []byte) BatchMovePurchasePlansRequest {
	body := batchMoveBody{Status: "已申购"}
	p.Add(web.DecodeJSONBody(raw, &body, []any{"body"})...)
	return BatchMovePurchasePlansRequest{
		MovePurchasePlanRequest: MovePurchasePlanRequest{
			PurchaseOrderNo: body.PurchaseOrderNo, TraceNo: body.TraceNo, ContractNo: body.ContractNo,
			VesselNo: body.VesselNo, ConsolidationDate: body.ConsolidationDate, ConsolidationPort: body.ConsolidationPort,
			SailingDate: body.SailingDate, ContractSignDate: body.ContractSignDate, PurchaseDate: body.PurchaseDate,
			Salesperson: body.Salesperson, Status: body.Status, RecordRemark: body.RecordRemark,
		},
		MaterialIDs: body.MaterialIDs,
	}
}

// ---------------- 申购记录读写 ----------------

// PurchaseRecordRead 对应 PurchaseRecordRead（created_at / updated_at 为普通 datetime 承载 aware UTC）。
type PurchaseRecordRead struct {
	LineID              int64            `json:"line_id"`
	PurchaseRequestID   int64            `json:"purchase_request_id"`
	PurchaseMaterialID  *int64           `json:"purchase_material_id"`
	PlanNo              string           `json:"plan_no"`
	PlanDate            jtype.Date       `json:"plan_date"`
	PurchaseOrderNo     *string          `json:"purchase_order_no"`
	TraceNo             *string          `json:"trace_no"`
	ContractNo          *string          `json:"contract_no"`
	VesselNo            *string          `json:"vessel_no"`
	ConsolidationDate   *jtype.Date      `json:"consolidation_date"`
	ConsolidationPort   *string          `json:"consolidation_port"`
	SailingDate         *jtype.Date      `json:"sailing_date"`
	ContractSignDate    *jtype.Date      `json:"contract_sign_date"`
	UnitPrice           *jtype.Decimal   `json:"unit_price"`
	Status              string           `json:"status"`
	MaterialCode        *string          `json:"material_code"`
	Category            *string          `json:"category"`
	DemandDepartment    string           `json:"demand_department"`
	MaterialName        string           `json:"material_name"`
	ModelSpec           string           `json:"model_spec"`
	UnitName            string           `json:"unit_name"`
	PurchaseQty         jtype.Decimal    `json:"purchase_qty"`
	ActualDemandPerson  string           `json:"actual_demand_person"`
	PurchaseResponsible string           `json:"purchase_responsible"`
	Salesperson         *string          `json:"salesperson"`
	PlanRemark          *string          `json:"plan_remark"`
	RecordRemark        *string          `json:"record_remark"`
	Usage               string           `json:"usage"`
	SubitemNo           *string          `json:"subitem_no"`
	Images              []FileObjectRead `json:"images"`
	StockMaterialID     *int64           `json:"stock_material_id"`
	PurchaseDate        *jtype.Date      `json:"purchase_date"`
	CreatedAt           AwareTime        `json:"created_at"`
	UpdatedAt           AwareTime        `json:"updated_at"`
	Version             int64            `json:"version"`
}

// PurchaseRecordUpdate 对应 PurchaseRecordUpdate：image_ids 省略（nil）＝不动图片。
type PurchaseRecordUpdate struct {
	PlanDate            jtype.Date     `json:"plan_date" v:"required"`
	MaterialCode        *string        `json:"material_code" v:"blanknil,min=1,max=64"`
	Category            *string        `json:"category" v:"blanknil,min=1,max=64"`
	DemandDepartment    string         `json:"demand_department" v:"min=1,max=128"`
	MaterialName        string         `json:"material_name" v:"required,min=1,max=128"`
	ModelSpec           string         `json:"model_spec" v:"required,min=1,max=255"`
	UnitName            string         `json:"unit_name" v:"required,min=1,max=32"`
	ActualDemandPerson  string         `json:"actual_demand_person" v:"required,min=1,max=128"`
	PurchaseResponsible string         `json:"purchase_responsible" v:"required,min=1,max=128"`
	PurchaseQty         jtype.Decimal  `json:"purchase_qty" v:"required,gt=0,digits=18,places=1"`
	Usage               string         `json:"usage" v:"required,min=1,max=500"`
	SubitemNo           *string        `json:"subitem_no" v:"min=1,max=64"`
	PlanRemark          *string        `json:"plan_remark" v:"max=1000"`
	StockMaterialID     *int64         `json:"stock_material_id"`
	ImageIDs            *[]string      `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	PurchaseOrderNo     *string        `json:"purchase_order_no" v:"max=128"`
	TraceNo             *string        `json:"trace_no" v:"max=128"`
	ContractNo          *string        `json:"contract_no" v:"max=128"`
	VesselNo            *string        `json:"vessel_no" v:"max=128"`
	ConsolidationDate   *jtype.Date    `json:"consolidation_date"`
	ConsolidationPort   *string        `json:"consolidation_port" v:"max=128"`
	SailingDate         *jtype.Date    `json:"sailing_date"`
	ContractSignDate    *jtype.Date    `json:"contract_sign_date"`
	UnitPrice           *jtype.Decimal `json:"unit_price" v:"ge=0,digits=18,places=2"`
	PurchaseDate        *jtype.Date    `json:"purchase_date"`
	Salesperson         *string        `json:"salesperson" v:"min=1,max=128"`
	Status              string         `json:"status" v:"required,min=1,max=128"`
	RecordRemark        *string        `json:"record_remark" v:"max=1000"`
	Version             int64          `json:"version" v:"required"`
}

// NewPurchaseRecordUpdate 预填默认值（demand_department）。
func NewPurchaseRecordUpdate() PurchaseRecordUpdate {
	return PurchaseRecordUpdate{DemandDepartment: purchaseDefaultDepartment}
}

type PurchaseRecordVersion struct {
	LineID  int64 `json:"line_id" v:"required"`
	Version int64 `json:"version" v:"required"`
}

// BatchUpdatePurchaseRecordsRequest：除 records 外的字段都需要区分「省略 / null」（model_fields_set）。
type BatchUpdatePurchaseRecordsRequest struct {
	Records             []PurchaseRecordVersion `json:"records" v:"required,min=1,max=200"`
	PlanDate            web.Opt[jtype.Date]     `json:"plan_date"`
	PurchaseOrderNo     web.Opt[string]         `json:"purchase_order_no" v:"max=128"`
	TraceNo             web.Opt[string]         `json:"trace_no" v:"max=128"`
	ContractNo          web.Opt[string]         `json:"contract_no" v:"max=128"`
	VesselNo            web.Opt[string]         `json:"vessel_no" v:"max=128"`
	ConsolidationDate   web.Opt[jtype.Date]     `json:"consolidation_date"`
	ConsolidationPort   web.Opt[string]         `json:"consolidation_port" v:"max=128"`
	SailingDate         web.Opt[jtype.Date]     `json:"sailing_date"`
	ContractSignDate    web.Opt[jtype.Date]     `json:"contract_sign_date"`
	UnitPrice           web.Opt[jtype.Decimal]  `json:"unit_price" v:"ge=0,digits=18,places=2"`
	PurchaseDate        web.Opt[jtype.Date]     `json:"purchase_date"`
	ActualDemandPerson  web.Opt[string]         `json:"actual_demand_person" v:"min=1,max=128"`
	PurchaseResponsible web.Opt[string]         `json:"purchase_responsible" v:"min=1,max=128"`
	Salesperson         web.Opt[string]         `json:"salesperson" v:"min=1,max=128"`
	Status              web.Opt[string]         `json:"status" v:"min=1,max=128"`
	RecordRemark        web.Opt[string]         `json:"record_remark" v:"max=1000"`
}

func (b *BatchUpdatePurchaseRecordsRequest) Validate(loc []any) []web.FieldError {
	seen := map[int64]bool{}
	for _, r := range b.Records {
		if seen[r.LineID] {
			return []web.FieldError{web.ValueError(fieldLoc(loc, "records"), "records must be unique", b.Records)}
		}
		seen[r.LineID] = true
	}
	sets := []bool{
		b.PlanDate.Set, b.PurchaseOrderNo.Set, b.TraceNo.Set, b.ContractNo.Set, b.VesselNo.Set,
		b.ConsolidationDate.Set, b.ConsolidationPort.Set, b.SailingDate.Set, b.ContractSignDate.Set,
		b.UnitPrice.Set, b.PurchaseDate.Set, b.ActualDemandPerson.Set, b.PurchaseResponsible.Set,
		b.Salesperson.Set, b.Status.Set, b.RecordRemark.Set,
	}
	selected := false
	for _, s := range sets {
		selected = selected || s
	}
	if !selected {
		return []web.FieldError{web.ValueError(loc, "at least one update field is required", b)}
	}
	required := []struct {
		name      string
		set, null bool
	}{
		{"plan_date", b.PlanDate.Set, b.PlanDate.Null},
		{"actual_demand_person", b.ActualDemandPerson.Set, b.ActualDemandPerson.Null},
		{"purchase_responsible", b.PurchaseResponsible.Set, b.PurchaseResponsible.Null},
		{"status", b.Status.Set, b.Status.Null},
	}
	for _, f := range required {
		if f.set && f.null {
			return []web.FieldError{web.ValueError(loc, f.name+" cannot be null", b)}
		}
	}
	return nil
}

// ---------------- 申购计划其它请求 ----------------

type LinkStockMaterialRequest struct {
	StockMaterialID int64  `json:"stock_material_id" v:"required"`
	Version         *int64 `json:"version"`
}

// PurchasePlanExportRequest 对应 PurchasePlanExportRequest。
type PurchasePlanExportRequest struct {
	MaterialIDs []int64 `json:"material_ids" v:"required,min=1,max=200"`
}

func (r *PurchasePlanExportRequest) Validate(loc []any) []web.FieldError {
	if !uniqueInts(r.MaterialIDs) {
		return []web.FieldError{web.ValueError(fieldLoc(loc, "material_ids"), "material_ids must be unique", r.MaterialIDs)}
	}
	return nil
}

// PurchasePlanResultExportRequest 对应 PurchasePlanResultExportRequest。
// status 可以是单个状态、状态列表或 null（PurchasePlanStatus | list[PurchasePlanStatus] | None），原样保存在 Status。
type PurchasePlanResultExportRequest struct {
	Columns                 []string        `json:"columns" v:"required,min=1,max=15,itemoneof=plan_no|plan_date|material_code|category|urgency|demand_department|name|model_spec|planned_qty|unit_name|actual_demand_person|purchase_responsible|subitem_no|usage|images"`
	Name                    *string         `json:"name" v:"max=128"`
	ModelSpec               *string         `json:"model_spec" v:"max=255"`
	ActualDemandPerson      *string         `json:"actual_demand_person" v:"max=128"`
	EmptyActualDemandPerson bool            `json:"empty_actual_demand_person"`
	SubitemNo               *string         `json:"subitem_no" v:"max=64"`
	EmptySubitemNo          bool            `json:"empty_subitem_no"`
	Status                  json.RawMessage `json:"status"`
	Category                *string         `json:"category" v:"max=64"`
	SortBy                  *string         `json:"sort_by" v:"oneof=plan_no|plan_date|material_code|category|urgency|demand_department|name|model_spec|planned_qty|unit_name|actual_demand_person|purchase_responsible|subitem_no|usage|images"`
	SortOrder               string          `json:"sort_order" v:"oneof=asc|desc"`

	statuses []string
	single   bool
}

// NewPurchasePlanResultExportRequest 预填默认值。
func NewPurchasePlanResultExportRequest() PurchasePlanResultExportRequest {
	return PurchasePlanResultExportRequest{SortOrder: "asc"}
}

func (r *PurchasePlanResultExportRequest) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	if !uniqueStrings(r.Columns) {
		errs = append(errs, web.ValueError(fieldLoc(loc, "columns"), "columns must be unique", r.Columns))
	}
	raw := bytes.TrimSpace(r.Status)
	r.statuses, r.single = nil, false
	if len(raw) == 0 || string(raw) == "null" {
		r.Status = nil
		return errs
	}
	statusLoc := fieldLoc(loc, "status")
	var single string
	if err := json.Unmarshal(raw, &single); err == nil {
		if !validPlanStatus(single) {
			errs = append(errs, purchaseStatusEnumError(statusLoc, single))
			return errs
		}
		r.statuses, r.single = []string{single}, true
		return errs
	}
	var list []any
	if err := json.Unmarshal(raw, &list); err != nil {
		var input any
		_ = json.Unmarshal(raw, &input)
		errs = append(errs, purchaseStatusEnumError(statusLoc, input))
		return errs
	}
	out := make([]string, 0, len(list))
	for i, item := range list {
		s, ok := item.(string)
		if !ok || !validPlanStatus(s) {
			errs = append(errs, purchaseStatusEnumError(append(fieldLoc(loc, "status"), i), item))
			continue
		}
		out = append(out, s)
	}
	r.statuses = out
	return errs
}

// StatusList 归一化后的状态值列表（nil 表示未传 / null）。
func (r *PurchasePlanResultExportRequest) StatusList() []string { return r.statuses }

func validPlanStatus(s string) bool {
	return s == "正常" || s == "暂不申购" || s == "已归档"
}

func purchaseStatusEnumError(loc []any, input any) web.FieldError {
	return web.FieldError{Type: "enum", Loc: loc, Msg: "Input should be " + purchasePlanStatusOneOf, Input: input,
		Ctx: map[string]any{"expected": purchasePlanStatusOneOf}}
}

// PurchaseRecordResultExportRequest 对应 PurchaseRecordResultExportRequest。
type PurchaseRecordResultExportRequest struct {
	Columns             []string `json:"columns" v:"required,min=1,max=24,itemoneof=purchase_qty|plan_date|purchase_order_no|trace_no|contract_no|vessel_no|consolidation_date|consolidation_port|sailing_date|contract_sign_date|unit_price|category|demand_department|material_name|model_spec|material_code|actual_demand_person|usage|purchase_responsible|salesperson|status|purchase_date|images|subitem_no"`
	PurchaseOrderNo     *string  `json:"purchase_order_no" v:"max=255"`
	TraceNo             *string  `json:"trace_no" v:"max=255"`
	Category            *string  `json:"category" v:"max=64"`
	Name                *string  `json:"name" v:"max=128"`
	ModelSpec           *string  `json:"model_spec" v:"max=255"`
	Usage               *string  `json:"usage" v:"max=500"`
	ActualDemandPerson  *string  `json:"actual_demand_person" v:"max=128"`
	PurchaseResponsible *string  `json:"purchase_responsible" v:"max=128"`
	Salesperson         *string  `json:"salesperson" v:"max=128"`
	Status              *string  `json:"status" v:"max=128"`
	EmptyStatus         bool     `json:"empty_status"`
	SubitemNo           *string  `json:"subitem_no" v:"max=64"`
	EmptySubitemNo      bool     `json:"empty_subitem_no"`
	SortBy              *string  `json:"sort_by" v:"oneof=purchase_qty|plan_date|purchase_order_no|trace_no|contract_no|vessel_no|consolidation_date|consolidation_port|sailing_date|contract_sign_date|unit_price|category|demand_department|material_name|model_spec|material_code|actual_demand_person|usage|purchase_responsible|salesperson|status|purchase_date|images|subitem_no"`
	SortOrder           string   `json:"sort_order" v:"oneof=asc|desc"`
}

// NewPurchaseRecordResultExportRequest 预填默认值。
func NewPurchaseRecordResultExportRequest() PurchaseRecordResultExportRequest {
	return PurchaseRecordResultExportRequest{SortOrder: "asc"}
}

func (r *PurchaseRecordResultExportRequest) Validate(loc []any) []web.FieldError {
	if !uniqueStrings(r.Columns) {
		return []web.FieldError{web.ValueError(fieldLoc(loc, "columns"), "columns must be unique", r.Columns)}
	}
	return nil
}

// ---------------- 周期性计划（申购计划模板） ----------------

// PurchasePlanTemplateCreate 对应 PurchasePlanTemplateCreate（PurchasePlanTemplateBase）。
type PurchasePlanTemplateCreate struct {
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
}

// NewPurchasePlanTemplateCreate 预填默认值。
func NewPurchasePlanTemplateCreate() PurchasePlanTemplateCreate {
	return PurchasePlanTemplateCreate{Urgency: purchaseDefaultUrgency, DemandDepartment: purchaseDefaultDepartment, ImageIDs: []string{}}
}

// PurchasePlanTemplateUpdate：image_ids 省略（nil）＝不改动图片，显式传 [] 才清空。
type PurchasePlanTemplateUpdate struct {
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
	ImageIDs            *[]string     `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version             int64         `json:"version" v:"required"`
}

// NewPurchasePlanTemplateUpdate 预填默认值。
func NewPurchasePlanTemplateUpdate() PurchasePlanTemplateUpdate {
	return PurchasePlanTemplateUpdate{Urgency: purchaseDefaultUrgency, DemandDepartment: purchaseDefaultDepartment}
}

type PurchasePlanTemplateRead struct {
	ID                  int64            `json:"id"`
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
	Images              []FileObjectRead `json:"images"`
	CreatedAt           AwareTime        `json:"created_at"`
	UpdatedAt           AwareTime        `json:"updated_at"`
	Version             int64            `json:"version"`
}

type PurchasePlanTemplateFilterOptions struct {
	ActualDemandPersons  []string `json:"actual_demand_persons"`
	PurchaseResponsibles []string `json:"purchase_responsibles"`
	Categories           []string `json:"categories"`
}

// ---------------- 申购记录同步 ----------------

type PurchaseRecordSyncTargetRead struct {
	TraceNo     string `json:"trace_no"`
	TargetCount int64  `json:"target_count"`
	CursorID    int64  `json:"cursor_id"`
}

type PurchaseRecordSyncTargetsRead struct {
	Items      []PurchaseRecordSyncTargetRead `json:"items"`
	HasMore    bool                           `json:"has_more"`
	NextCursor int64                          `json:"next_cursor"`
}

// PurchaseRecordSyncTraceUpdate 对应 PurchaseRecordSyncTraceUpdate。
type PurchaseRecordSyncTraceUpdate struct {
	Salesperson       *string        `json:"salesperson" v:"max=128"`
	ContractNo        *string        `json:"contract_no" v:"max=128"`
	VesselNo          *string        `json:"vessel_no" v:"max=128"`
	ConsolidationPort *string        `json:"consolidation_port" v:"max=128"`
	ConsolidationDate *jtype.Date    `json:"consolidation_date"`
	SailingDate       *jtype.Date    `json:"sailing_date"`
	ContractSignDate  *jtype.Date    `json:"contract_sign_date"`
	UnitPrice         *jtype.Decimal `json:"unit_price" v:"ge=0,digits=18,places=2"`
	Status            *string        `json:"status" v:"max=128"`
}

type PurchaseRecordSyncResultRead struct {
	AffectedHeaders int64 `json:"affected_headers"`
	AffectedLines   int64 `json:"affected_lines"`
}

type PurchaseRecordSyncOrderTargetRead struct {
	PurchaseOrderNo string   `json:"purchase_order_no"`
	TraceNos        []string `json:"trace_nos"`
	CursorID        int64    `json:"cursor_id"`
}

type PurchaseRecordSyncOrderTargetsRead struct {
	Items      []PurchaseRecordSyncOrderTargetRead `json:"items"`
	HasMore    bool                                `json:"has_more"`
	NextCursor int64                               `json:"next_cursor"`
}

// PurchaseRecordSyncOrderUpdateItem 整单回写里的一个追溯号结果（字段规则与单追溯号回写一致）。
type PurchaseRecordSyncOrderUpdateItem struct {
	Salesperson       *string        `json:"salesperson" v:"max=128"`
	ContractNo        *string        `json:"contract_no" v:"max=128"`
	VesselNo          *string        `json:"vessel_no" v:"max=128"`
	ConsolidationPort *string        `json:"consolidation_port" v:"max=128"`
	ConsolidationDate *jtype.Date    `json:"consolidation_date"`
	SailingDate       *jtype.Date    `json:"sailing_date"`
	ContractSignDate  *jtype.Date    `json:"contract_sign_date"`
	UnitPrice         *jtype.Decimal `json:"unit_price" v:"ge=0,digits=18,places=2"`
	Status            *string        `json:"status" v:"max=128"`
	TraceNo           string         `json:"trace_no" v:"required,min=1,max=128"`
}

// Update 返回该项的同步字段（不含 trace_no）。
func (i PurchaseRecordSyncOrderUpdateItem) Update() PurchaseRecordSyncTraceUpdate {
	return PurchaseRecordSyncTraceUpdate{
		Salesperson: i.Salesperson, ContractNo: i.ContractNo, VesselNo: i.VesselNo,
		ConsolidationPort: i.ConsolidationPort, ConsolidationDate: i.ConsolidationDate,
		SailingDate: i.SailingDate, ContractSignDate: i.ContractSignDate, UnitPrice: i.UnitPrice, Status: i.Status,
	}
}

type PurchaseRecordSyncOrderApply struct {
	Items []PurchaseRecordSyncOrderUpdateItem `json:"items" v:"required,min=1,max=200"`
}

type PurchaseRecordSyncOrderApplyRead struct {
	Applied         int64 `json:"applied"`
	NotFound        int64 `json:"not_found"`
	AffectedHeaders int64 `json:"affected_headers"`
	AffectedLines   int64 `json:"affected_lines"`
}
