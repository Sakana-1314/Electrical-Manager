package miniprogram

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/codelib"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/huaxing"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/ledger"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/lite"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/purchaserequest"
)

func pyStrip(v string) string { return strings.TrimFunc(v, common.PyIsSpace) }

// ---------------- 图片 ----------------

type ownedFile struct {
	OwnerID int64 `db:"owner_id"`
	model.FileObject
}

// loadImages 批量加载某个图片关联表（按 sort_order）的文件读模型：owner id → 图片列表。
func loadImages(s *db.Session, table, ownerCol string, ownerIDs []int64) (map[int64][]schema.FileObjectRead, error) {
	out := map[int64][]schema.FileObjectRead{}
	if len(ownerIDs) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "x.")
	if err != nil {
		return nil, err
	}
	var rows []ownedFile
	if err := s.SelectIn(&rows, "SELECT x."+ownerCol+" AS owner_id, "+model.Prefixed("f", model.ColsFileObject)+
		" FROM "+table+" x JOIN file_object f ON f.id = x.file_id WHERE x."+ownerCol+" IN (?)"+scope+
		" ORDER BY x."+ownerCol+", x.sort_order", append([]any{ownerIDs}, sargs...)...); err != nil {
		return nil, err
	}
	for i := range rows {
		out[rows[i].OwnerID] = append(out[rows[i].OwnerID], schema.FileRead(&rows[i].FileObject))
	}
	return out, nil
}

func imagesOf(images map[int64][]schema.FileObjectRead, id int64) []schema.FileObjectRead {
	if items := images[id]; items != nil {
		return items
	}
	return []schema.FileObjectRead{}
}

// ---------------- 申购计划 ----------------

// activePlanWhere 是「正常且尚未转为申购记录」的申购计划条件（alias 形如 "pm."）。
func activePlanWhere(s *db.Session) (*common.Where, error) {
	lineScope, largs, err := scopeAnd(s, "l.")
	if err != nil {
		return nil, err
	}
	w := &common.Where{}
	if err := w.Scope(s, "pm."); err != nil {
		return nil, err
	}
	w.Add("pm.status = ?", domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal))
	w.Add("NOT (EXISTS (SELECT l.id FROM purchase_request_line l WHERE l.purchase_material_id = pm.id"+lineScope+"))", largs...)
	return w, nil
}

// MiniProgramPlanFilter 是小程序申购计划的筛选条件（nil / 空串表示不限）。
//
// 字段与网页端列表对齐：Name / ModelSpec / MaterialCode 是「分字段搜索」的单字段条件，
// Keyword 是「综合」搜索（跨名称 / 型号 / 编码），两者可同时使用、互不覆盖。
type MiniProgramPlanFilter struct {
	Keyword             *string
	Name                *string
	ModelSpec           *string
	MaterialCode        *string
	ActualDemandPerson  *string
	SubitemNo           *string
	Urgency             *string
	Category            *string
	DemandDepartment    *string
	PurchaseResponsible *string
	PlanDateFrom        *jtype.Date
	PlanDateTo          *jtype.Date
}

// ListPurchasePlans 对应 list_purchase_plans：只列出正常且未转申购记录的计划，id 倒序分页。
// keyword 匹配名称 / 型号 / 物料编码，便于按编码或型号快速定位。
func ListPurchasePlans(s *db.Session, f MiniProgramPlanFilter, page, pageSize int64) ([]model.PurchaseMaterial, int64, error) {
	w, err := activePlanWhere(s)
	if err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"pm.name", "pm.model_spec", "pm.material_code"}, f.Keyword)
	// 分字段搜索：每项只匹配自己的列（网页端同名筛选口径）。
	w.ContainsAny([]string{"pm.name"}, f.Name)
	w.ContainsAny([]string{"pm.model_spec"}, f.ModelSpec)
	w.ContainsAny([]string{"pm.material_code"}, f.MaterialCode)
	if f.ActualDemandPerson != nil && *f.ActualDemandPerson != "" {
		w.ContainsAny([]string{"pm.actual_demand_person"}, f.ActualDemandPerson)
	}
	if f.PurchaseResponsible != nil && *f.PurchaseResponsible != "" {
		w.ContainsAny([]string{"pm.purchase_responsible"}, f.PurchaseResponsible)
	}
	if f.DemandDepartment != nil && *f.DemandDepartment != "" {
		w.Add("TRIM(pm.demand_department) = ?", pyStrip(*f.DemandDepartment))
	}
	if f.SubitemNo != nil && *f.SubitemNo != "" {
		w.Add("TRIM(pm.subitem_no) = ?", pyStrip(*f.SubitemNo))
	}
	if f.Urgency != nil && *f.Urgency != "" {
		w.Add("TRIM(pm.urgency) = ?", pyStrip(*f.Urgency))
	}
	if f.Category != nil && *f.Category != "" {
		w.Add("TRIM(pm.category) = ?", pyStrip(*f.Category))
	}
	if f.PlanDateFrom != nil {
		w.Add("pm.plan_date >= ?", *f.PlanDateFrom)
	}
	if f.PlanDateTo != nil {
		w.Add("pm.plan_date <= ?", *f.PlanDateTo)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM purchase_material pm"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var items []model.PurchaseMaterial
	if err := s.Select(&items, "SELECT "+model.Prefixed("pm", model.ColsPurchaseMaterial)+" FROM purchase_material pm"+w.SQL()+
		" ORDER BY pm.id DESC LIMIT ? OFFSET ?", append(w.Args, pageSize, common.Offset(page, pageSize))...); err != nil {
		return nil, 0, err
	}
	if items == nil {
		items = []model.PurchaseMaterial{}
	}
	return items, total, nil
}

// planDistinct 取在途计划里某列的去重非空值（升序）。
func planDistinct(s *db.Session, col string) ([]string, error) {
	w, err := activePlanWhere(s)
	if err != nil {
		return nil, err
	}
	w.Add(col + " IS NOT NULL").Add("TRIM(" + col + ") != ''")
	var rows []*string
	if err := s.Select(&rows, "SELECT DISTINCT TRIM("+col+") FROM purchase_material pm"+w.SQL()+
		" ORDER BY TRIM("+col+")", w.Args...); err != nil {
		return nil, err
	}
	out := []string{}
	for _, v := range rows {
		if v != nil && *v != "" {
			out = append(out, *v)
		}
	}
	return out, nil
}

// PlanFilterOptions 是申购计划的筛选下拉候选值（与网页端列表对齐）。
type PlanFilterOptions struct {
	ActualDemandPersons  []string
	PurchaseResponsibles []string
	DemandDepartments    []string
	SubitemNos           []string
	Urgencies            []string
	Categories           []string
}

// ListPurchasePlanFilterOptions 对应 list_purchase_plan_filter_options：
// 各维度去重升序，只统计在途计划，避免选项里出现已转记录的值。
func ListPurchasePlanFilterOptions(s *db.Session) (PlanFilterOptions, error) {
	out := PlanFilterOptions{}
	columns := []struct {
		col string
		dst *[]string
	}{
		{"pm.actual_demand_person", &out.ActualDemandPersons},
		{"pm.purchase_responsible", &out.PurchaseResponsibles},
		{"pm.demand_department", &out.DemandDepartments},
		{"pm.subitem_no", &out.SubitemNos},
		{"pm.urgency", &out.Urgencies},
		{"pm.category", &out.Categories},
	}
	for _, c := range columns {
		values, err := planDistinct(s, c.col)
		if err != nil {
			return PlanFilterOptions{}, err
		}
		*c.dst = values
	}
	return out, nil
}

// PurchasePlanItemRead 对应 purchase_plan_item_read。
func PurchasePlanItemRead(item *model.PurchaseMaterial) schema.MiniProgramPurchasePlanItemRead {
	return schema.MiniProgramPurchasePlanItemRead{
		ID: item.ID, PlanNo: item.PlanNo, PlanDate: item.PlanDate, Name: item.Name, ModelSpec: item.ModelSpec,
		UnitName: item.UnitName, PlannedQty: item.PlannedQty, ActualDemandPerson: item.ActualDemandPerson,
		PurchaseResponsible: item.PurchaseResponsible, Urgency: item.Urgency,
	}
}

// PurchasePlanDetail 对应 purchase_plan_detail：只看正常且未转记录的计划；next_id 为列表顺序（id 倒序）中的下一条。
func PurchasePlanDetail(s *db.Session, materialID int64) (schema.MiniProgramPurchasePlanDetailRead, error) {
	w, err := activePlanWhere(s)
	if err != nil {
		return schema.MiniProgramPurchasePlanDetailRead{}, err
	}
	w.Add("pm.id = ?", materialID)
	var item model.PurchaseMaterial
	ok, err := s.Find(&item, "SELECT "+model.Prefixed("pm", model.ColsPurchaseMaterial)+" FROM purchase_material pm"+w.SQL(), w.Args...)
	if err != nil {
		return schema.MiniProgramPurchasePlanDetailRead{}, err
	}
	if !ok {
		return schema.MiniProgramPurchasePlanDetailRead{}, apperr.NotFound("申购计划")
	}
	nw, err := activePlanWhere(s)
	if err != nil {
		return schema.MiniProgramPurchasePlanDetailRead{}, err
	}
	nw.Add("pm.id < ?", item.ID)
	var nextID *int64
	var next int64
	found, err := s.Find(&next, "SELECT pm.id FROM purchase_material pm"+nw.SQL()+" ORDER BY pm.id DESC LIMIT 1", nw.Args...)
	if err != nil {
		return schema.MiniProgramPurchasePlanDetailRead{}, err
	}
	if found {
		nextID = &next
	}
	images, err := loadImages(s, "purchase_material_image", "material_id", []int64{item.ID})
	if err != nil {
		return schema.MiniProgramPurchasePlanDetailRead{}, err
	}
	return schema.MiniProgramPurchasePlanDetailRead{
		MiniProgramPurchasePlanItemRead: PurchasePlanItemRead(&item),
		MaterialCode:                    item.MaterialCode,
		Category:                        item.Category,
		DemandDepartment:                item.DemandDepartment,
		Usage:                           item.Usage,
		SubitemNo:                       item.SubitemNo,
		Remark:                          item.Remark,
		Images:                          imagesOf(images, item.ID),
		NextID:                          nextID,
	}, nil
}

// ---------------- 申购记录 ----------------

// MiniProgramRecordFilter 是小程序申购记录的筛选条件（nil / 空串表示不限）。
type MiniProgramRecordFilter = purchaserequest.MiniProgramRecordFilter

// ListPurchaseRecords 对应 list_purchase_records：keyword 匹配 名称 / 型号 / 物料编码 / 追溯号 / 申购单号，id 倒序分页。
func ListPurchaseRecords(s *db.Session, f MiniProgramRecordFilter, page, pageSize int64) ([]schema.MiniProgramPurchaseRecordItemRead, int64, error) {
	lines, total, err := purchaserequest.SearchMiniProgramPurchaseRecords(s, f, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	return purchaseRecordItemReads(lines), total, nil
}

// RecordFilterOptions 是申购记录的筛选下拉候选值（与网页端列表对齐）。
type RecordFilterOptions struct {
	Statuses             []string
	SubitemNos           []string
	Categories           []string
	Salespersons         []string
	ActualDemandPersons  []string
	PurchaseResponsibles []string
}

// ListPurchaseRecordFilterOptions 对应 list_purchase_record_filter_options：各维度去重升序。
func ListPurchaseRecordFilterOptions(s *db.Session) (RecordFilterOptions, error) {
	out := RecordFilterOptions{}
	var err error
	if out.Statuses, err = purchaserequest.PurchaseStatusOptions(s); err != nil {
		return RecordFilterOptions{}, err
	}
	if out.SubitemNos, err = purchaserequest.PurchaseSubitemOptions(s); err != nil {
		return RecordFilterOptions{}, err
	}
	if out.Categories, err = purchaserequest.PurchaseRecordCategoryOptions(s); err != nil {
		return RecordFilterOptions{}, err
	}
	if out.Salespersons, err = purchaserequest.PurchaseSalespersonOptions(s); err != nil {
		return RecordFilterOptions{}, err
	}
	if out.ActualDemandPersons, err = purchaserequest.PurchaseActualDemandPersonOptions(s); err != nil {
		return RecordFilterOptions{}, err
	}
	out.PurchaseResponsibles, err = purchaserequest.PurchaseResponsibleOptions(s)
	return out, err
}

// purchaseRecordItemReads 对应 purchase_record_item_read（行上已加载申购单头与图片）。
func purchaseRecordItemReads(lines []*purchaserequest.Line) []schema.MiniProgramPurchaseRecordItemRead {
	out := make([]schema.MiniProgramPurchaseRecordItemRead, 0, len(lines))
	for _, line := range lines {
		l := &line.PurchaseRequestLine
		r := line.Request
		if r == nil {
			r = &model.PurchaseRequest{}
		}
		out = append(out, schema.MiniProgramPurchaseRecordItemRead{
			LineID: l.ID, MaterialName: l.MaterialNameSnapshot, ModelSpec: l.ModelSpecSnapshot,
			PurchaseOrderNo: r.PurchaseOrderNo, TraceNo: l.TraceNo, Status: l.Status, UnitName: l.UnitNameSnapshot,
			PurchaseQty: l.PurchaseQty, PlanDate: l.PlanDateSnapshot, SubitemNo: l.SubitemNo,
			MaterialCode: l.MaterialCodeSnapshot, Category: l.CategorySnapshot, PlanNo: l.PlanNoSnapshot,
			DemandDepartment: l.DemandDepartmentSnapshot, ActualDemandPerson: l.ActualDemandPersonSnapshot,
			PurchaseResponsible: l.PurchaseResponsibleSnapshot, Usage: l.Usage, Remark: r.Remark,
			PurchaseDate: r.PurchaseDate, Salesperson: l.Salesperson, ContractNo: r.ContractNo, VesselNo: r.VesselNo,
			ConsolidationDate: r.ConsolidationDate, ConsolidationPort: r.ConsolidationPort, SailingDate: r.SailingDate,
			ContractSignDate: l.ContractSignDate, UnitPrice: l.UnitPrice, Images: material.FileReads(line.Images),
		})
	}
	return out
}

// PurchaseRecordDetail 对应 purchase_record_detail：按行 id 返回完整记录，不存在报「申购记录不存在」。
func PurchaseRecordDetail(s *db.Session, lineID int64) (schema.MiniProgramPurchaseRecordItemRead, error) {
	line, err := purchaserequest.FindPurchaseRecord(s, lineID, false)
	if err != nil {
		return schema.MiniProgramPurchaseRecordItemRead{}, err
	}
	if line == nil {
		return schema.MiniProgramPurchaseRecordItemRead{}, apperr.NotFound("申购记录")
	}
	return purchaseRecordItemReads([]*purchaserequest.Line{line})[0], nil
}

// ---------------- 编码库 / 台账 / 华星库存 / 精简库存 ----------------

// MiniProgramCodeFilter 是小程序物料编码的筛选条件（nil / 空串表示不限）。
type MiniProgramCodeFilter struct {
	Keyword      *string
	Name         *string
	ModelSpec    *string
	MaterialCode *string
}

// ListMaterialCodes 对应 list_material_codes：复用编码库搜索，去掉单价字段。
// Name / ModelSpec / MaterialCode 是「分字段搜索」的单字段条件，Keyword 是综合搜索。
func ListMaterialCodes(s *db.Session, f MiniProgramCodeFilter, page, pageSize int64) ([]schema.MiniProgramMaterialCodeRead, int64, error) {
	items, total, err := codelib.Search(s, codelib.SearchParams{
		Keyword: f.Keyword, Name: f.Name, ModelSpec: f.ModelSpec, MaterialCode: f.MaterialCode,
		Page: page, PageSize: pageSize,
	})
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramMaterialCodeRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramMaterialCodeRead{ID: it.ID, MaterialCode: it.MaterialCode, Name: it.Name, ModelSpec: it.ModelSpec, UnitName: it.UnitName}
	}
	return out, total, nil
}

// MiniProgramLedgerFilter 是小程序台账的筛选条件（nil / 空串表示不限）。
// TagIDs 为英文逗号分隔的标签 id（与网页端一致：选中父标签会一并包含子标签）。
type MiniProgramLedgerFilter struct {
	Keyword *string
	TagIDs  *string
}

// ListLedgerItems 对应 list_ledger_items：与网页端同一份口径（名称 / 型号 / 备注模糊搜索，可筛标签，创建时间倒序）。
func ListLedgerItems(s *db.Session, f MiniProgramLedgerFilter, page, pageSize int64) ([]schema.MiniProgramLedgerItemRead, int64, error) {
	items, total, err := ledger.ListItems(s, f.Keyword, f.TagIDs, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramLedgerItemRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramLedgerItemRead{ID: it.ID, Name: it.Name, ModelSpec: it.ModelSpec, SubitemNo: it.SubitemNo, Quantity: it.Quantity, UnitName: it.UnitName}
	}
	return out, total, nil
}

// LedgerTagOptions 是台账标签筛选的候选值：平铺返回 id / 名称 / 层级路径，
// 小程序只做单选下拉，路径直接给出（如「一级 / 二级」）避免在手机上画树。
func LedgerTagOptions(s *db.Session) ([]schema.MiniProgramLedgerTagOption, error) {
	refs, err := ledger.TagPathOptions(s)
	if err != nil {
		return nil, err
	}
	out := make([]schema.MiniProgramLedgerTagOption, len(refs))
	for i, ref := range refs {
		out[i] = schema.MiniProgramLedgerTagOption{ID: ref.ID, Name: ref.Name, Path: ref.Path}
	}
	return out, nil
}

// LedgerItemDetail 对应 ledger_item_detail。
func LedgerItemDetail(s *db.Session, itemID int64) (schema.MiniProgramLedgerItemDetailRead, error) {
	it, err := ledger.GetItemRead(s, itemID)
	if err != nil {
		return schema.MiniProgramLedgerItemDetailRead{}, err
	}
	return schema.MiniProgramLedgerItemDetailRead{
		MiniProgramLedgerItemRead: schema.MiniProgramLedgerItemRead{ID: it.ID, Name: it.Name, ModelSpec: it.ModelSpec, SubitemNo: it.SubitemNo, Quantity: it.Quantity, UnitName: it.UnitName},
		Usage:                     it.Usage, Remark: it.Remark, Tags: it.Tags, Images: it.Images,
	}, nil
}

// MiniProgramHuaXingFilter 是小程序华星库存的筛选条件（nil / 空串表示不限）。
//
// 字段与网页端列表对齐：Name / ModelSpec / MaterialCode 是「分字段搜索」的单字段条件，
// Keyword 是综合搜索；FirstInboundFrom / FirstInboundTo 是首次入库日期闭区间。
type MiniProgramHuaXingFilter struct {
	Keyword            *string
	Name               *string
	ModelSpec          *string
	MaterialCode       *string
	PurchaseDepartment *string
	Purchaser          *string
	FirstInboundFrom   *jtype.Date
	FirstInboundTo     *jtype.Date
}

// ListHuaXingInventory 对应 list_huaxing_inventory。
func ListHuaXingInventory(s *db.Session, f MiniProgramHuaXingFilter, page, pageSize int64) ([]schema.MiniProgramHuaXingInventoryRead, int64, error) {
	items, total, err := huaxing.Search(s, huaxing.SearchParams{
		Keyword: f.Keyword, MaterialCode: f.MaterialCode, Name: f.Name, ModelSpec: f.ModelSpec,
		PurchaseDepartment: f.PurchaseDepartment, Purchaser: f.Purchaser,
		DateFrom: f.FirstInboundFrom, DateTo: f.FirstInboundTo,
		Page: page, PageSize: pageSize,
	})
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramHuaXingInventoryRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramHuaXingInventoryRead{
			ID: it.ID, FirstInboundDate: it.FirstInboundDate, Warehouse: it.Warehouse, MaterialCode: it.MaterialCode,
			Name: it.Name, ModelSpec: it.ModelSpec, Quantity: it.Quantity, UnitName: it.UnitName,
			Purchaser: it.Purchaser, PurchaseDepartment: it.PurchaseDepartment, SubitemNoName: it.SubitemNoName,
		}
	}
	return out, total, nil
}

// ListLiteInventory 对应 list_lite_inventory：精简二级库列表（仅查看，无出入库）。
func ListLiteInventory(s *db.Session, keyword *string, page, pageSize int64) ([]schema.MiniProgramLiteInventoryItemRead, int64, error) {
	items, total, err := lite.Search(s, lite.SearchParams{Keyword: keyword, Page: page, PageSize: pageSize})
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramLiteInventoryItemRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramLiteInventoryItemRead{ID: it.ID, Name: it.Name, ModelSpec: it.ModelSpec, UnitName: it.UnitName, Quantity: it.Quantity}
	}
	return out, total, nil
}
