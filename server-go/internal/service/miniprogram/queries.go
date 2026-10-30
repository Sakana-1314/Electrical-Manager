package miniprogram

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/codelib"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/huaxing"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/ledger"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/lite"
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

// ListPurchasePlans 对应 list_purchase_plans：只列出正常且未转申购记录的计划，id 倒序分页。
func ListPurchasePlans(s *db.Session, keyword *string, page, pageSize int64, actualDemandPerson, subitemNo *string) ([]model.PurchaseMaterial, int64, error) {
	w, err := activePlanWhere(s)
	if err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"pm.name", "pm.model_spec"}, keyword)
	if actualDemandPerson != nil && *actualDemandPerson != "" {
		w.ContainsAny([]string{"pm.actual_demand_person"}, actualDemandPerson)
	}
	if subitemNo != nil && *subitemNo != "" {
		w.Add("TRIM(pm.subitem_no) = ?", pyStrip(*subitemNo))
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

// ListPurchasePlanFilterOptions 对应 list_purchase_plan_filter_options：(实际需求人, 子项号) 去重升序。
func ListPurchasePlanFilterOptions(s *db.Session) ([]string, []string, error) {
	w, err := activePlanWhere(s)
	if err != nil {
		return nil, nil, err
	}
	w.Add("TRIM(pm.actual_demand_person) != ''")
	persons := []string{}
	if err := s.Select(&persons, "SELECT DISTINCT pm.actual_demand_person FROM purchase_material pm"+w.SQL()+
		" ORDER BY pm.actual_demand_person", w.Args...); err != nil {
		return nil, nil, err
	}
	w2, err := activePlanWhere(s)
	if err != nil {
		return nil, nil, err
	}
	w2.Add("pm.subitem_no IS NOT NULL")
	w2.Add("TRIM(pm.subitem_no) != ''")
	var subitems []*string
	if err := s.Select(&subitems, "SELECT DISTINCT pm.subitem_no FROM purchase_material pm"+w2.SQL()+
		" ORDER BY pm.subitem_no", w2.Args...); err != nil {
		return nil, nil, err
	}
	subitemNos := []string{}
	for _, v := range subitems {
		if v != nil {
			subitemNos = append(subitemNos, *v)
		}
	}
	return persons, subitemNos, nil
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

// ListPurchaseRecords 对应 list_purchase_records：keyword 仅 OR 匹配 名称 / 型号 / 追溯号 / 申购单号，id 倒序分页。
func ListPurchaseRecords(s *db.Session, keyword, status, subitemNo *string, page, pageSize int64) ([]schema.MiniProgramPurchaseRecordItemRead, int64, error) {
	lines, total, err := searchMiniProgramPurchaseRecords(s, keyword, status, subitemNo, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	reads, err := purchaseRecordItemReads(s, lines)
	if err != nil {
		return nil, 0, err
	}
	return reads, total, nil
}

// ListPurchaseRecordFilterOptions 对应 list_purchase_record_filter_options：(状态, 子项号) 去重升序。
func ListPurchaseRecordFilterOptions(s *db.Session) ([]string, []string, error) {
	statuses, err := purchaseStatusOptions(s)
	if err != nil {
		return nil, nil, err
	}
	subitemNos, err := purchaseSubitemOptions(s)
	if err != nil {
		return nil, nil, err
	}
	return statuses, subitemNos, nil
}

// purchaseRecordItemReads 对应 purchase_record_item_read（批量加载申购单头与图片）。
func purchaseRecordItemReads(s *db.Session, lines []model.PurchaseRequestLine) ([]schema.MiniProgramPurchaseRecordItemRead, error) {
	out := make([]schema.MiniProgramPurchaseRecordItemRead, 0, len(lines))
	if len(lines) == 0 {
		return out, nil
	}
	lineIDs := make([]int64, len(lines))
	requestIDSet := map[int64]bool{}
	requestIDs := []int64{}
	for i, l := range lines {
		lineIDs[i] = l.ID
		if !requestIDSet[l.PurchaseRequestID] {
			requestIDSet[l.PurchaseRequestID] = true
			requestIDs = append(requestIDs, l.PurchaseRequestID)
		}
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var requests []model.PurchaseRequest
	if err := s.SelectIn(&requests, "SELECT "+model.ColsPurchaseRequest+" FROM purchase_request WHERE id IN (?)"+scope,
		append([]any{requestIDs}, sargs...)...); err != nil {
		return nil, err
	}
	requestBy := map[int64]*model.PurchaseRequest{}
	for i := range requests {
		requestBy[requests[i].ID] = &requests[i]
	}
	images, err := loadImages(s, "purchase_request_line_image", "line_id", lineIDs)
	if err != nil {
		return nil, err
	}
	for i := range lines {
		l := &lines[i]
		r := requestBy[l.PurchaseRequestID]
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
			ContractSignDate: l.ContractSignDate, UnitPrice: l.UnitPrice, Images: imagesOf(images, l.ID),
		})
	}
	return out, nil
}

// PurchaseRecordDetail 对应 purchase_record_detail：按行 id 返回完整记录，不存在报「申购记录不存在」。
func PurchaseRecordDetail(s *db.Session, lineID int64) (schema.MiniProgramPurchaseRecordItemRead, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return schema.MiniProgramPurchaseRecordItemRead{}, err
	}
	var line model.PurchaseRequestLine
	ok, err := s.Find(&line, "SELECT "+model.ColsPurchaseRequestLine+" FROM purchase_request_line WHERE id = ?"+scope,
		append([]any{lineID}, sargs...)...)
	if err != nil {
		return schema.MiniProgramPurchaseRecordItemRead{}, err
	}
	if !ok {
		return schema.MiniProgramPurchaseRecordItemRead{}, apperr.NotFound("申购记录")
	}
	reads, err := purchaseRecordItemReads(s, []model.PurchaseRequestLine{line})
	if err != nil {
		return schema.MiniProgramPurchaseRecordItemRead{}, err
	}
	return reads[0], nil
}

// ---------------- 编码库 / 台账 / 华星库存 / 精简库存 ----------------

// ListMaterialCodes 对应 list_material_codes：复用编码库搜索，去掉单价字段。
func ListMaterialCodes(s *db.Session, keyword *string, page, pageSize int64) ([]schema.MiniProgramMaterialCodeRead, int64, error) {
	items, total, err := codelib.Search(s, codelib.SearchParams{Keyword: keyword, Page: page, PageSize: pageSize})
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramMaterialCodeRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramMaterialCodeRead{ID: it.ID, MaterialCode: it.MaterialCode, Name: it.Name, ModelSpec: it.ModelSpec, UnitName: it.UnitName}
	}
	return out, total, nil
}

// ListLedgerItems 对应 list_ledger_items：与网页端同一份口径（名称 / 型号 / 备注模糊搜索，创建时间倒序）。
func ListLedgerItems(s *db.Session, keyword *string, page, pageSize int64) ([]schema.MiniProgramLedgerItemRead, int64, error) {
	items, total, err := ledger.ListItems(s, keyword, nil, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramLedgerItemRead, len(items))
	for i, it := range items {
		out[i] = schema.MiniProgramLedgerItemRead{ID: it.ID, Name: it.Name, ModelSpec: it.ModelSpec, SubitemNo: it.SubitemNo, Quantity: it.Quantity, UnitName: it.UnitName}
	}
	return out, total, nil
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

// ListHuaXingInventory 对应 list_huaxing_inventory。
func ListHuaXingInventory(s *db.Session, keyword *string, page, pageSize int64) ([]schema.MiniProgramHuaXingInventoryRead, int64, error) {
	items, total, err := huaxing.Search(s, huaxing.SearchParams{Keyword: keyword, Page: page, PageSize: pageSize})
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
