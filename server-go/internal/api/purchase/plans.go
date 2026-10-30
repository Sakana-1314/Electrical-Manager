package purchase

import (
	"context"
	"fmt"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/excelexport"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/exportjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/purchaserequest"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const planSearchFields = "plan_no|plan_date|material_code|category|name|model_spec|unit_name|planned_qty|usage|subitem_no|remark"

// planResultHeaders 申购计划结果导出列 → 表头。
var planResultHeaders = map[string]string{
	"plan_no":              "计划 ID",
	"plan_date":            "需求日期",
	"material_code":        "物料编码",
	"category":             "类别",
	"urgency":              "紧急程度",
	"demand_department":    "需求部门",
	"name":                 "名称",
	"model_spec":           "型号规格",
	"planned_qty":          "计划数量",
	"unit_name":            "计量单位",
	"actual_demand_person": "提报员工",
	"purchase_responsible": "实际需求人",
	"subitem_no":           "子项号",
	"usage":                "用途",
	"images":               "图片",
}

func archivedForbidden() error {
	return apperr.New("ARCHIVED_PURCHASE_PLAN_FORBIDDEN", "仅超级管理员可查询已归档申购计划").WithStatus(403)
}

func isSuperAdmin(c *web.Ctx) bool { return auth.User(c).Role == domain.RoleSuperAdmin }

func containsStr(items []string, s string) bool {
	for _, it := range items {
		if it == s {
			return true
		}
	}
	return false
}

// normalStatusFor 非超级管理员只能看「正常」状态的计划（nil 表示不过滤）。
func normalStatusFor(c *web.Ctx) *string {
	if isSuperAdmin(c) {
		return nil
	}
	v := domain.PlanStatusNormal
	return &v
}

func expand(c *web.Ctx, value *string) (*string, error) {
	return aisearch.ExpandSearchValue(c.DB, value, false)
}

// imagePaths 计划 / 记录附带的、磁盘上真实存在的原图路径（缺失的跳过）。
func imagePaths(images []material.Image) excelexport.ImagePaths {
	out := excelexport.ImagePaths{}
	for _, img := range images {
		if file.FileExists(img.File.ID) {
			out = append(out, file.FilePath(img.File.ID))
		}
	}
	return out
}

func imageCount(rows []map[string]any) int {
	n := 0
	for _, r := range rows {
		if paths, ok := r["images"].(excelexport.ImagePaths); ok {
			n += len(paths)
		}
	}
	return n
}

func listMaterials(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	searchField := p.QueryStr("search_field", "oneof="+planSearchFields)
	searchValue := p.QueryStr("search_value", "max=255")
	name := p.QueryStr("name", "max=128")
	modelSpec := p.QueryStr("model_spec", "max=255")
	actualDemandPerson := p.QueryStr("actual_demand_person", "max=128")
	emptyActualDemandPerson := p.QueryBool("empty_actual_demand_person", false)
	purchaseResponsible := p.QueryStr("purchase_responsible", "max=128")
	subitemNo := p.QueryStr("subitem_no", "max=64")
	emptySubitemNo := p.QueryBool("empty_subitem_no", false)
	category := p.QueryStr("category", "max=64")
	status := p.QueryStrList("status", "oneof=正常|暂不申购|已归档")
	coded := p.QueryBoolPtr("coded")
	moved := p.QueryBoolPtr("moved")
	aiExpand := p.QueryBool("ai_expand", false)
	sortBy := p.QueryStr("sort_by", "oneof="+schema.PurchasePlanResultColumns)
	sortOrder := p.QueryStrDefault("sort_order", "asc", "oneof=asc|desc")
	if err := p.Err(); err != nil {
		return err
	}
	if !isSuperAdmin(c) {
		if containsStr(status, domain.PlanStatusArchived) {
			return archivedForbidden()
		}
		if len(status) == 0 {
			status = []string{domain.PlanStatusNormal}
		}
	}
	if aiExpand {
		var err error
		if keyword, err = expand(c, keyword); err != nil {
			return err
		}
		if name, err = expand(c, name); err != nil {
			return err
		}
		if searchField != nil && *searchField == "name" {
			if searchValue, err = expand(c, searchValue); err != nil {
				return err
			}
		}
	}
	items, total, err := material.SearchPurchases(c.DB, material.PurchaseSearch{
		Keyword: keyword, SearchField: searchField, SearchValue: searchValue, Name: name, ModelSpec: modelSpec,
		ActualDemandPerson: actualDemandPerson, EmptyActualDemandPerson: emptyActualDemandPerson,
		PurchaseResponsible: purchaseResponsible, SubitemNo: subitemNo, EmptySubitemNo: emptySubitemNo,
		Category: category, Status: status, Coded: coded, Moved: moved, Page: page, PageSize: size,
		SortBy: sortBy, SortOrder: sortOrder,
	})
	if err != nil {
		return err
	}
	reads, err := material.PurchaseReads(c.DB, items)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(reads, page, size, total))
}

func materialFilterOptions(c *web.Ctx) error {
	p := c.Params()
	moved := p.QueryBoolPtr("moved")
	if err := p.Err(); err != nil {
		return err
	}
	persons, responsibles, subitems, categories, err := material.PurchaseFilterOptions(c.DB, moved, normalStatusFor(c))
	if err != nil {
		return err
	}
	return c.OK(schema.PurchaseFilterOptions{
		ActualDemandPersons: persons, PurchaseResponsibles: responsibles, SubitemNos: subitems, Categories: categories,
	})
}

func createMaterial(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewPurchaseMaterialCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.CreatePurchase(c.DB, data)
	if err != nil {
		return err
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func userIDPtr(c *web.Ctx) *int64 {
	id := auth.User(c).ID
	return &id
}

// exportMaterialResults 查询结果导出（含图片，耗时较长）：202 秒回任务，渲染在后台异步执行。
func exportMaterialResults(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewPurchasePlanResultExportRequest()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	exportStatus := data.StatusList()
	if !isSuperAdmin(c) {
		if containsStr(exportStatus, domain.PlanStatusArchived) {
			return archivedForbidden()
		}
		if len(exportStatus) == 0 {
			exportStatus = []string{domain.PlanStatusNormal}
		}
	}
	job, err := exportjob.EnqueueExport(c.DB, "PURCHASE_PLAN_RESULTS", data, materialExportProcessor(data, exportStatus), userIDPtr(c))
	if err != nil {
		return err
	}
	return c.JSON(202, job)
}

func exportLimitExceeded(total int64) error {
	return apperr.New("EXPORT_RESULT_LIMIT_EXCEEDED", fmt.Sprintf("查询结果超过 %d 行，请缩小筛选范围后导出", common.ExportRowLimit)).
		WithStatus(400).WithDetails(apperr.D{"total": total, "limit": common.ExportRowLimit})
}

// materialExportProcessor 申购计划导出处理器：查库 + 拼行 + 渲染图片 Excel。
func materialExportProcessor(data schema.PurchasePlanResultExportRequest, exportStatus []string) exportjob.Processor {
	return func(ctx context.Context, s *db.Session, target string) (map[string]any, error) {
		moved := false
		items, total, err := material.SearchPurchases(s, material.PurchaseSearch{
			Name: data.Name, ModelSpec: data.ModelSpec, ActualDemandPerson: data.ActualDemandPerson,
			EmptyActualDemandPerson: data.EmptyActualDemandPerson, SubitemNo: data.SubitemNo,
			EmptySubitemNo: data.EmptySubitemNo, Category: data.Category, Status: exportStatus, Moved: &moved,
			Page: 1, PageSize: common.ExportRowLimit + 1, SortBy: data.SortBy, SortOrder: data.SortOrder,
		})
		if err != nil {
			return nil, err
		}
		if total > common.ExportRowLimit {
			return nil, exportLimitExceeded(total)
		}
		rows := make([]map[string]any, 0, len(items))
		for _, it := range items {
			rows = append(rows, map[string]any{
				"plan_no": it.PlanNo, "plan_date": it.PlanDate, "material_code": it.MaterialCode, "category": it.Category,
				"urgency": it.Urgency, "demand_department": it.DemandDepartment, "name": it.Name, "model_spec": it.ModelSpec,
				"planned_qty": it.PlannedQty, "unit_name": it.UnitName, "actual_demand_person": it.ActualDemandPerson,
				"purchase_responsible": it.PurchaseResponsible, "subitem_no": it.SubitemNo, "usage": it.Usage,
				"images": imagePaths(it.Images),
			})
		}
		columns := make([]excelexport.Column, len(data.Columns))
		for i, key := range data.Columns {
			columns[i] = excelexport.Column{Key: key, Label: planResultHeaders[key]}
		}
		content, filename, err := excelexport.RenderResultExcel("申购计划导出", columns, rows)
		if err != nil {
			return nil, err
		}
		if err := excelexport.WriteExportFile(target, content); err != nil {
			return nil, err
		}
		return map[string]any{"download_filename": filename, "rows": len(rows), "image_count": imageCount(rows)}, nil
	}
}

func exportUncodedMaterials(c *web.Ctx) error {
	p := c.Params()
	keyword := p.QueryStr("keyword", "")
	if err := p.Err(); err != nil {
		return err
	}
	coded, moved := false, false
	normal := domain.PlanStatusNormal
	materials, err := material.PurchasesForExport(c.DB, material.PurchaseExportFilter{Keyword: keyword, Coded: &coded, Moved: &moved, Status: &normal})
	if err != nil {
		return err
	}
	rows := make([]map[string]any, len(materials))
	for i, it := range materials {
		rows[i] = map[string]any{
			"serial": i + 1, "name": it.Name, "model_spec": it.ModelSpec, "unit_name": it.UnitName,
			"warranty_managed": "否", "asset_category": "非资产", "application_reason": "当前无准确编码对应，需要新增编码",
			"department": "HXNI 检修维护部", "actual_demand_person": it.ActualDemandPerson,
		}
	}
	content, filename, err := excelexport.RenderExcel("material-code-application.json", rows)
	if err != nil {
		return err
	}
	return excelexport.ExcelResponse(c, content, filename)
}

// localDatePlus date.today() + timedelta(days=n)（服务器本地时区）。
func localDatePlus(days int) jtype.Date {
	return jtype.DateOf(time.Now().AddDate(0, 0, days))
}

func exportPurchaseApplication(c *web.Ctx) error {
	p := c.Params()
	var data schema.PurchasePlanExportRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	moved := false
	materials, err := material.PurchasesForExport(c.DB, material.PurchaseExportFilter{MaterialIDs: data.MaterialIDs, Moved: &moved, Status: normalStatusFor(c)})
	if err != nil {
		return err
	}
	if err := material.ValidatePurchaseApplicationExport(materials); err != nil {
		return err
	}
	rows := make([]map[string]any, len(materials))
	for i, it := range materials {
		rows[i] = map[string]any{
			"material_code": it.MaterialCode, "name": it.Name, "planned_qty": it.PlannedQty,
			"purchase_responsible": it.PurchaseResponsible, "demand_department": it.DemandDepartment,
			"required_arrival_date": localDatePlus(90), "urgency": it.Urgency, "usage": it.Usage,
			"remark": it.Remark, "subitem_no": it.SubitemNo,
		}
	}
	content, filename, err := excelexport.RenderExcel("purchase-application.json", rows)
	if err != nil {
		return err
	}
	return excelexport.ExcelResponse(c, content, filename)
}

// exportPurchaseApproval 申购审批表导出（嵌入原图）：请求期做必填校验，202 秒回任务。
func exportPurchaseApproval(c *web.Ctx) error {
	p := c.Params()
	var data schema.PurchasePlanExportRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	exportStatus := normalStatusFor(c)
	moved := false
	materials, err := material.PurchasesForExport(c.DB, material.PurchaseExportFilter{MaterialIDs: data.MaterialIDs, Moved: &moved, Status: exportStatus})
	if err != nil {
		return err
	}
	if err := material.ValidatePurchaseApprovalExport(materials); err != nil {
		return err
	}
	job, err := exportjob.EnqueueExport(c.DB, "PURCHASE_APPROVAL", data, approvalExportProcessor(data, exportStatus), userIDPtr(c))
	if err != nil {
		return err
	}
	return c.JSON(202, job)
}

// approvalExportProcessor 申购审批表导出处理器：查库 + 必填校验 + 数量取数 + 渲染（含图片）后写盘。
func approvalExportProcessor(data schema.PurchasePlanExportRequest, exportStatus *string) exportjob.Processor {
	return func(ctx context.Context, s *db.Session, target string) (map[string]any, error) {
		moved := false
		materials, err := material.PurchasesForExport(s, material.PurchaseExportFilter{MaterialIDs: data.MaterialIDs, Moved: &moved, Status: exportStatus})
		if err != nil {
			return nil, err
		}
		if err := material.ValidatePurchaseApprovalExport(materials); err != nil {
			return nil, err
		}
		quantities, err := material.PurchaseApprovalExportQuantities(s, materials, nil)
		if err != nil {
			return nil, err
		}
		rows := make([]map[string]any, 0, len(materials))
		for i, it := range materials {
			var stockQty, inTransitQty any = 0, 0
			if it.MaterialCode != nil && *it.MaterialCode != "" {
				if q, ok := quantities[*it.MaterialCode]; ok {
					stockQty, inTransitQty = q.Stock, q.InTransit
				}
			}
			rows = append(rows, map[string]any{
				"serial": i + 1, "material_code": it.MaterialCode, "name": it.Name, "model_spec": it.ModelSpec,
				"planned_qty": it.PlannedQty, "unit_name": it.UnitName, "purchase_responsible": it.PurchaseResponsible,
				"department": "HXNI 检修维护部", "usage": it.Usage, "stock_qty": stockQty, "in_transit_qty": inTransitQty,
				"required_arrival_date": localDatePlus(80), "urgency": it.Urgency, "remark": it.Remark,
				"subitem_no": it.SubitemNo, "images": imagePaths(it.Images),
			})
		}
		content, filename, err := excelexport.RenderExcel("purchase-approval.json", rows)
		if err != nil {
			return nil, err
		}
		if err := excelexport.WriteExportFile(target, content); err != nil {
			return nil, err
		}
		return map[string]any{"download_filename": filename, "rows": len(rows), "image_count": imageCount(rows)}, nil
	}
}

func batchMoveToRecord(c *web.Ctx) error {
	p := c.Params()
	raw, _ := c.RawBody()
	data := schema.DecodeBatchMovePurchasePlans(p, raw)
	if err := p.Err(); err != nil {
		return err
	}
	lines, err := purchaserequest.BatchMovePlansToRecord(c.DB, data)
	if err != nil {
		return err
	}
	return c.OK(purchaserequest.PurchaseRecordReads(lines))
}

func batchUpdateMaterials(c *web.Ctx) error {
	p := c.Params()
	var data schema.BatchUpdatePurchasePlansRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	items, err := material.BatchUpdatePurchases(c.DB, data)
	if err != nil {
		return err
	}
	reads, err := material.PurchaseReads(c.DB, items)
	if err != nil {
		return err
	}
	return c.OK(reads)
}

func materialDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetPurchase(c.DB, id)
	if err != nil {
		return err
	}
	if item.StatusValue() == domain.PlanStatusArchived && !isSuperAdmin(c) {
		return archivedForbidden()
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func updateMaterial(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	data := schema.NewPurchaseMaterialUpdate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetPurchase(c.DB, id)
	if err != nil {
		return err
	}
	if item, err = material.UpdatePurchase(c.DB, item, data); err != nil {
		return err
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteMaterial(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	ifMatch := p.IfMatch()
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetPurchase(c.DB, id)
	if err != nil {
		return err
	}
	if err := material.DeletePurchase(c.DB, item, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

func linkStockMaterial(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	var data schema.LinkStockMaterialRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetPurchase(c.DB, id)
	if err != nil {
		return err
	}
	if err := apperr.ValidateVersion(data.Version, item.Version); err != nil {
		return err
	}
	stock, err := material.ValidateStockLink(c.DB, &data.StockMaterialID)
	if err != nil {
		return err
	}
	stockID := data.StockMaterialID
	item.StockMaterialID = &stockID
	item.StockMaterial = stock
	item.Version++
	item.UpdatedAt = common.UTCNow()
	if _, err := c.DB.Exec("UPDATE purchase_material SET stock_material_id = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		item.StockMaterialID, item.Version, item.UpdatedAt, item.ID, item.ProjectID); err != nil {
		return err
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func moveToRecord(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	data := schema.NewMovePurchasePlanRequest()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	line, err := purchaserequest.MovePlanToRecord(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(purchaserequest.PurchaseRecordRead(line))
}
