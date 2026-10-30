// Package plantemplate 对应原 services/purchase_plan_template_service.py + repositories/purchase_plan_template_repository.py：
// 周期性计划（申购计划模板）维护与「一键生成申购计划」。
//
// 「生成申购计划」把模板完整复制为一条新的 purchase_material（plan_no / plan_date / status 在生成时赋值，
// plan_date = 生成当天），模板本身不删除、可反复使用，也不改动既有申购计划。
package plantemplate

import (
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
)

// Template 是带 selectin 关系（关联二级库物资、图片）的周期性计划。
type Template struct {
	model.PurchasePlanTemplate
	StockMaterial *model.StockMaterial
	Images        []material.Image
}

func scopeAnd(s *db.Session, alias string) (string, []any, error) {
	cond, args, err := s.ScopeFilter(alias)
	if err != nil {
		return "", nil, err
	}
	if cond == "1=1" {
		return "", nil, nil
	}
	return " AND " + cond, args, nil
}

type imageRow struct {
	OwnerID   int64 `db:"link_owner_id"`
	SortOrder int64 `db:"link_sort_order"`
	model.FileObject
}

func loadImages(s *db.Session, ids []int64) (map[int64][]material.Image, error) {
	out := map[int64][]material.Image{}
	if len(ids) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "i.")
	if err != nil {
		return nil, err
	}
	var rows []imageRow
	q := "SELECT i.plan_id AS link_owner_id, i.sort_order AS link_sort_order, " + model.Prefixed("f", model.ColsFileObject) +
		" FROM purchase_plan_template_image i JOIN file_object f ON f.id = i.file_id WHERE i.plan_id IN (?)" + scope +
		" ORDER BY i.plan_id, i.sort_order"
	if err := s.SelectIn(&rows, q, append([]any{ids}, sargs...)...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.OwnerID] = append(out[r.OwnerID], material.Image{FileID: r.FileObject.ID, SortOrder: r.SortOrder, File: r.FileObject})
	}
	return out, nil
}

// LoadRelations 批量加载关联物资与图片。
func LoadRelations(s *db.Session, items []*Template) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, len(items))
	stockIDs := []int64{}
	for i, it := range items {
		ids[i] = it.ID
		if it.StockMaterialID != nil {
			stockIDs = append(stockIDs, *it.StockMaterialID)
		}
	}
	stockBy := map[int64]*model.StockMaterial{}
	if len(stockIDs) > 0 {
		scope, sargs, err := scopeAnd(s, "")
		if err != nil {
			return err
		}
		var stocks []model.StockMaterial
		if err := s.SelectIn(&stocks, "SELECT "+model.ColsStockMaterial+" FROM stock_material WHERE id IN (?)"+scope, append([]any{stockIDs}, sargs...)...); err != nil {
			return err
		}
		for i := range stocks {
			stockBy[stocks[i].ID] = &stocks[i]
		}
	}
	images, err := loadImages(s, ids)
	if err != nil {
		return err
	}
	for _, it := range items {
		it.StockMaterial = nil
		if it.StockMaterialID != nil {
			it.StockMaterial = stockBy[*it.StockMaterialID]
		}
		it.Images = images[it.ID]
		if it.Images == nil {
			it.Images = []material.Image{}
		}
	}
	return nil
}

// TemplateRead 对应 template_read。
func TemplateRead(t *Template) schema.PurchasePlanTemplateRead {
	var stockName *string
	if t.StockMaterial != nil {
		name := t.StockMaterial.Name
		stockName = &name
	}
	return schema.PurchasePlanTemplateRead{
		ID: t.ID, MaterialCode: t.MaterialCode, Category: t.Category, Urgency: t.Urgency,
		DemandDepartment: t.DemandDepartment, Name: t.Name, ModelSpec: t.ModelSpec, UnitName: t.UnitName,
		ActualDemandPerson: t.ActualDemandPerson, PurchaseResponsible: t.PurchaseResponsible, PlannedQty: t.PlannedQty,
		Usage: t.Usage, SubitemNo: t.SubitemNo, Remark: t.Remark, StockMaterialID: t.StockMaterialID,
		StockMaterialName: stockName, Images: material.FileReads(t.Images),
		CreatedAt: schema.NewAwareTime(t.CreatedAt), UpdatedAt: schema.NewAwareTime(t.UpdatedAt), Version: t.Version,
	}
}

// GetTemplate 对应 get_template：不存在报 NOT_FOUND「周期性计划不存在」。
func GetTemplate(s *db.Session, templateID int64) (*Template, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var row model.PurchasePlanTemplate
	ok, err := s.Find(&row, "SELECT "+model.ColsPurchasePlanTemplate+" FROM purchase_plan_template WHERE id = ?"+scope, append([]any{templateID}, sargs...)...)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.NotFound("周期性计划")
	}
	t := &Template{PurchasePlanTemplate: row}
	if err := LoadRelations(s, []*Template{t}); err != nil {
		return nil, err
	}
	return t, nil
}

func imagesFromFiles(files []model.FileObject) []material.Image {
	out := make([]material.Image, len(files))
	for i, f := range files {
		out[i] = material.Image{FileID: f.ID, SortOrder: int64(i), File: f}
	}
	return out
}

func insertImages(s *db.Session, table, ownerCol string, pid, ownerID int64, images []material.Image) error {
	if len(images) == 0 {
		return nil
	}
	values := make([]string, len(images))
	args := make([]any, 0, len(images)*4)
	for i, img := range images {
		values[i] = "(?, ?, ?, ?)"
		args = append(args, ownerID, img.FileID, img.SortOrder, pid)
	}
	_, err := s.Exec("INSERT INTO "+table+" ("+ownerCol+", file_id, sort_order, project_id) VALUES "+strings.Join(values, ", "), args...)
	return err
}

func firstNonEmpty(p *string, fallback string) string {
	if p != nil && *p != "" {
		return *p
	}
	return fallback
}

// CreateTemplate 对应 create_template。
func CreateTemplate(s *db.Session, data schema.PurchasePlanTemplateCreate) (*Template, error) {
	responsible := firstNonEmpty(data.PurchaseResponsible, "\\")
	if err := common.ValidateQuantityPrecision(data.PlannedQty); err != nil {
		return nil, err
	}
	stock, err := material.ValidateStockLink(s, data.StockMaterialID)
	if err != nil {
		return nil, err
	}
	files, err := material.Files(s, data.ImageIDs)
	if err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	t := model.PurchasePlanTemplate{
		MaterialCode: data.MaterialCode, Category: data.Category, Urgency: data.Urgency,
		DemandDepartment: data.DemandDepartment, Name: data.Name, ModelSpec: data.ModelSpec, UnitName: data.UnitName,
		ActualDemandPerson: firstNonEmpty(data.ActualDemandPerson, responsible), PurchaseResponsible: responsible,
		PlannedQty: data.PlannedQty, Usage: data.Usage, SubitemNo: data.SubitemNo, Remark: data.Remark,
		StockMaterialID: data.StockMaterialID, ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO purchase_plan_template (material_code, category, urgency, demand_department, name, model_spec, unit_name, actual_demand_person, purchase_responsible, planned_qty, `usage`, subitem_no, remark, stock_material_id, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		t.MaterialCode, t.Category, t.Urgency, t.DemandDepartment, t.Name, t.ModelSpec, t.UnitName, t.ActualDemandPerson,
		t.PurchaseResponsible, t.PlannedQty, t.Usage, t.SubitemNo, t.Remark, t.StockMaterialID, t.ProjectID,
		t.CreatedAt, t.UpdatedAt, t.Version)
	if err != nil {
		return nil, err
	}
	t.ID = id
	images := imagesFromFiles(files)
	if err := insertImages(s, "purchase_plan_template_image", "plan_id", pid, id, images); err != nil {
		return nil, err
	}
	return &Template{PurchasePlanTemplate: t, StockMaterial: stock, Images: images}, nil
}

// UpdateTemplate 对应 update_template：image_ids 为 nil 时不动图片。
func UpdateTemplate(s *db.Session, t *Template, data schema.PurchasePlanTemplateUpdate) (*Template, error) {
	v := data.Version
	if err := apperr.ValidateVersion(&v, t.Version); err != nil {
		return nil, err
	}
	responsible := firstNonEmpty(data.PurchaseResponsible, t.PurchaseResponsible)
	if err := common.ValidateQuantityPrecision(data.PlannedQty); err != nil {
		return nil, err
	}
	stock, err := material.ValidateStockLink(s, data.StockMaterialID)
	if err != nil {
		return nil, err
	}
	var files []model.FileObject
	if data.ImageIDs != nil {
		if files, err = material.Files(s, *data.ImageIDs); err != nil {
			return nil, err
		}
	}
	t.MaterialCode = data.MaterialCode
	t.Category = data.Category
	t.Urgency = data.Urgency
	t.DemandDepartment = data.DemandDepartment
	t.Name = data.Name
	t.ModelSpec = data.ModelSpec
	t.UnitName = data.UnitName
	t.PlannedQty = data.PlannedQty
	t.Usage = data.Usage
	t.SubitemNo = data.SubitemNo
	t.Remark = data.Remark
	t.StockMaterialID = data.StockMaterialID
	if data.ActualDemandPerson != nil {
		t.ActualDemandPerson = *data.ActualDemandPerson
	}
	t.PurchaseResponsible = responsible
	t.StockMaterial = stock
	if data.ImageIDs != nil {
		if err := common.LogImageChange(s, "PURCHASE_PLAN_TEMPLATE", t.ID, material.ImageIDs(t.Images), *data.ImageIDs, "申购计划模板"); err != nil {
			return nil, err
		}
	}
	t.Version++
	t.UpdatedAt = common.UTCNow()
	if _, err := s.Exec("UPDATE purchase_plan_template SET material_code = ?, category = ?, urgency = ?, demand_department = ?, name = ?, model_spec = ?, unit_name = ?, actual_demand_person = ?, purchase_responsible = ?, planned_qty = ?, `usage` = ?, subitem_no = ?, remark = ?, stock_material_id = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		t.MaterialCode, t.Category, t.Urgency, t.DemandDepartment, t.Name, t.ModelSpec, t.UnitName, t.ActualDemandPerson,
		t.PurchaseResponsible, t.PlannedQty, t.Usage, t.SubitemNo, t.Remark, t.StockMaterialID, t.Version, t.UpdatedAt,
		t.ID, t.ProjectID); err != nil {
		return nil, err
	}
	if data.ImageIDs != nil {
		if _, err := s.Exec("DELETE FROM purchase_plan_template_image WHERE plan_id = ? AND project_id = ?", t.ID, t.ProjectID); err != nil {
			return nil, err
		}
		images := imagesFromFiles(files)
		if err := insertImages(s, "purchase_plan_template_image", "plan_id", t.ProjectID, t.ID, images); err != nil {
			return nil, err
		}
		t.Images = images
	}
	return t, nil
}

// DeleteTemplate 对应 delete_template。
func DeleteTemplate(s *db.Session, t *Template, version *int64) error {
	if err := apperr.ValidateVersion(version, t.Version); err != nil {
		return err
	}
	if _, err := s.Exec("DELETE FROM purchase_plan_template_image WHERE plan_id = ? AND project_id = ?", t.ID, t.ProjectID); err != nil {
		return err
	}
	_, err := s.Exec("DELETE FROM purchase_plan_template WHERE id = ? AND project_id = ?", t.ID, t.ProjectID)
	return err
}

// GeneratePurchasePlan 对应 generate_purchase_plan：把模板完整复制为一条今天（上海时区）的申购计划。模板不改动、不删除。
func GeneratePurchasePlan(s *db.Session, t *Template) (*material.Purchase, error) {
	today := jtype.DateOf(time.Now().In(common.Shanghai))
	planNo, err := material.NextPurchasePlanNo(s, today)
	if err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	m := model.PurchaseMaterial{
		PlanNo: planNo, PlanDate: today, MaterialCode: t.MaterialCode, Category: t.Category, Urgency: t.Urgency,
		DemandDepartment: t.DemandDepartment, Name: t.Name, ModelSpec: t.ModelSpec, UnitName: t.UnitName,
		ActualDemandPerson: t.ActualDemandPerson, PurchaseResponsible: t.PurchaseResponsible, PlannedQty: t.PlannedQty,
		Usage: t.Usage, SubitemNo: t.SubitemNo, Remark: t.Remark, StockMaterialID: t.StockMaterialID,
		Status: domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal), ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO purchase_material (plan_no, plan_date, material_code, category, urgency, demand_department, name, model_spec, unit_name, actual_demand_person, purchase_responsible, planned_qty, `usage`, subitem_no, remark, stock_material_id, status, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		m.PlanNo, m.PlanDate, m.MaterialCode, m.Category, m.Urgency, m.DemandDepartment, m.Name, m.ModelSpec, m.UnitName,
		m.ActualDemandPerson, m.PurchaseResponsible, m.PlannedQty, m.Usage, m.SubitemNo, m.Remark, m.StockMaterialID,
		m.Status, m.ProjectID, m.CreatedAt, m.UpdatedAt, m.Version)
	if err != nil {
		return nil, err
	}
	m.ID = id
	// 生成时按引用复制镜像：复用同一 file_id，不复制文件本体。
	images := make([]material.Image, len(t.Images))
	copy(images, t.Images)
	if err := insertImages(s, "purchase_material_image", "material_id", pid, id, images); err != nil {
		return nil, err
	}
	return &material.Purchase{PurchaseMaterial: m, StockMaterial: t.StockMaterial, Images: images}, nil
}

// ---------------- 查询 ----------------

// SortColumns 列表可排序列白名单（sort_by → 列）。
var SortColumns = map[string]string{
	"material_code":        "material_code",
	"category":             "category",
	"urgency":              "urgency",
	"demand_department":    "demand_department",
	"name":                 "name",
	"model_spec":           "model_spec",
	"unit_name":            "unit_name",
	"actual_demand_person": "actual_demand_person",
	"purchase_responsible": "purchase_responsible",
	"planned_qty":          "planned_qty",
	"subitem_no":           "subitem_no",
	"usage":                "`usage`",
}

// Search 是 search_templates 的参数。
type Search struct {
	Keyword             *string
	Name                *string
	ModelSpec           *string
	ActualDemandPerson  *string
	PurchaseResponsible *string
	Category            *string
	Page                int64
	PageSize            int64
	SortBy              *string
	SortOrder           string
}

// SearchTemplates 对应 search_templates。
func SearchTemplates(s *db.Session, q Search) ([]*Template, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"name", "model_spec", "material_code", "category", "unit_name", "actual_demand_person",
		"purchase_responsible", "`usage`", "subitem_no"}, q.Keyword)
	w.ContainsAny([]string{"name"}, q.Name)
	w.ContainsAny([]string{"model_spec"}, q.ModelSpec)
	w.ContainsAny([]string{"actual_demand_person"}, q.ActualDemandPerson)
	w.ContainsAny([]string{"purchase_responsible"}, q.PurchaseResponsible)
	if q.Category != nil && *q.Category != "" {
		w.Add("TRIM(category) = ?", strings.TrimFunc(*q.Category, common.PyIsSpace))
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM purchase_plan_template"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	order := "id DESC"
	if q.SortBy != nil && *q.SortBy != "" {
		if col, ok := SortColumns[*q.SortBy]; ok {
			dir := "ASC"
			if q.SortOrder != "asc" {
				dir = "DESC"
			}
			order = col + " " + dir + ", id DESC"
		}
	}
	var rows []model.PurchasePlanTemplate
	args := append(append([]any{}, w.Args...), q.PageSize, common.Offset(q.Page, q.PageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsPurchasePlanTemplate+" FROM purchase_plan_template"+w.SQL()+" ORDER BY "+order+" LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	items := make([]*Template, len(rows))
	for i := range rows {
		items[i] = &Template{PurchasePlanTemplate: rows[i]}
	}
	if err := LoadRelations(s, items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

var emptyPersonValues = []any{"", "\\", "/", "—", "-"}

// FilterOptions 对应 template_filter_options：（实际需求人, 采购负责人, 分类）。
func FilterOptions(s *db.Session) (actualDemandPersons, purchaseResponsibles, categories []string, err error) {
	query := func(col, cond string, args ...any) ([]string, error) {
		w := common.Where{}
		w.Add(cond, args...)
		if err := w.Scope(s, ""); err != nil {
			return nil, err
		}
		var vals []*string
		if err := s.Select(&vals, "SELECT DISTINCT "+col+" FROM purchase_plan_template"+w.SQL()+" ORDER BY "+col, w.Args...); err != nil {
			return nil, err
		}
		out := []string{}
		for _, v := range vals {
			if v != nil {
				out = append(out, *v)
			}
		}
		return out, nil
	}
	if actualDemandPersons, err = query("actual_demand_person", "TRIM(actual_demand_person) NOT IN (?, ?, ?, ?, ?)", emptyPersonValues...); err != nil {
		return
	}
	if purchaseResponsibles, err = query("purchase_responsible", "TRIM(purchase_responsible) != ?", ""); err != nil {
		return
	}
	categories, err = query("category", "category IS NOT NULL AND TRIM(category) != ?", "")
	return
}
