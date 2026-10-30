package material

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// Purchase 是带 selectin 关系（关联二级库物资、图片）的申购计划。
// 注意：嵌入的 model.PurchaseMaterial.Status 是数据库存储的枚举**名称**（NORMAL / DEFERRED / ARCHIVED），
// 对外的值用 StatusValue()。
type Purchase struct {
	model.PurchaseMaterial
	StockMaterial *model.StockMaterial
	Images        []Image
}

// StatusValue 状态值（正常 / 暂不申购 / 已归档）。
func (p *Purchase) StatusValue() string { return domain.PurchasePlanStatus.FromDB(p.Status) }

// emptyPersonValues 视为「空」的需求人 / 负责人占位值。
var emptyPersonValues = []any{"", "\\", "/", "—", "-"}

// LoadPurchaseRelations 批量加载关联物资与图片。
func LoadPurchaseRelations(s *db.Session, items []*Purchase) error {
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
	images, err := loadImages(s, "purchase_material_image", "material_id", ids)
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
			it.Images = []Image{}
		}
	}
	return nil
}

func wrapPurchases(rows []model.PurchaseMaterial) []*Purchase {
	items := make([]*Purchase, len(rows))
	for i := range rows {
		items[i] = &Purchase{PurchaseMaterial: rows[i]}
	}
	return items
}

// FindPurchase 按 id 读取（含关系），不存在返回 nil。
func FindPurchase(s *db.Session, materialID int64) (*Purchase, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var m model.PurchaseMaterial
	ok, err := s.Find(&m, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material WHERE id = ?"+scope, append([]any{materialID}, sargs...)...)
	if err != nil || !ok {
		return nil, err
	}
	item := &Purchase{PurchaseMaterial: m}
	if err := LoadPurchaseRelations(s, []*Purchase{item}); err != nil {
		return nil, err
	}
	return item, nil
}

// GetPurchase 对应 get_purchase_material：不存在报 NOT_FOUND「申购计划不存在」。
func GetPurchase(s *db.Session, materialID int64) (*Purchase, error) {
	item, err := FindPurchase(s, materialID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperr.NotFound("申购计划")
	}
	return item, nil
}

// PurchaseIDsMovedToRecord 对应 purchase_material_ids_moved_to_record：已转入申购记录的计划 id 集合。
func PurchaseIDsMovedToRecord(s *db.Session, ids []int64) (map[int64]bool, error) {
	out := map[int64]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var rows []*int64
	if err := s.SelectIn(&rows, "SELECT DISTINCT purchase_material_id FROM purchase_request_line WHERE purchase_material_id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
		return nil, err
	}
	for _, v := range rows {
		if v != nil {
			out[*v] = true
		}
	}
	return out, nil
}

func purchaseReferenced(s *db.Session, materialID int64) (bool, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return false, err
	}
	var id int64
	return s.Find(&id, "SELECT id FROM purchase_request_line WHERE purchase_material_id = ?"+scope+" LIMIT 1", append([]any{materialID}, sargs...)...)
}

// PurchaseRead 对应 purchase_read。movedIDs 为 nil 时单条内联查询「是否已转入申购记录」；
// 批量场景先用 PurchaseIDsMovedToRecord 预算再传入。
func PurchaseRead(s *db.Session, item *Purchase, movedIDs map[int64]bool) (schema.PurchaseMaterialRead, error) {
	var moved bool
	if movedIDs == nil {
		var err error
		if moved, err = purchaseReferenced(s, item.ID); err != nil {
			return schema.PurchaseMaterialRead{}, err
		}
	} else {
		moved = movedIDs[item.ID]
	}
	var stockName *string
	if item.StockMaterial != nil {
		name := item.StockMaterial.Name
		stockName = &name
	}
	return schema.PurchaseMaterialRead{
		ID: item.ID, PlanNo: item.PlanNo, PlanDate: item.PlanDate, MaterialCode: item.MaterialCode, Category: item.Category,
		Urgency: item.Urgency, DemandDepartment: item.DemandDepartment, Name: item.Name, ModelSpec: item.ModelSpec,
		UnitName: item.UnitName, ActualDemandPerson: item.ActualDemandPerson, PurchaseResponsible: item.PurchaseResponsible,
		PlannedQty: item.PlannedQty, Usage: item.Usage, SubitemNo: item.SubitemNo, Remark: item.Remark,
		StockMaterialID: item.StockMaterialID, StockMaterialName: stockName, Status: item.StatusValue(),
		MovedToRecord: moved, Images: FileReads(item.Images),
		CreatedAt: schema.NewAwareTime(item.CreatedAt), UpdatedAt: schema.NewAwareTime(item.UpdatedAt), Version: item.Version,
	}, nil
}

// PurchaseReads 批量组装（一次查询 moved 集合）。
func PurchaseReads(s *db.Session, items []*Purchase) ([]schema.PurchaseMaterialRead, error) {
	ids := make([]int64, len(items))
	for i, it := range items {
		ids[i] = it.ID
	}
	moved, err := PurchaseIDsMovedToRecord(s, ids)
	if err != nil {
		return nil, err
	}
	out := make([]schema.PurchaseMaterialRead, len(items))
	for i, it := range items {
		if out[i], err = PurchaseRead(s, it, moved); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// castText 对应 SQLAlchemy cast(col, String)（PostgreSQL 的 CHAR 是 char(1)，必须写 VARCHAR）。
// CAST(x AS VARCHAR)（PostgreSQL 的 CHAR 是 char(1)，会截断）。
func castText(col string) string { return "CAST(" + col + " AS VARCHAR)" }

// NextPurchasePlanNo 对应 next_purchase_plan_no：PLAN-YYYYMMDD-NNN，取计划表与记录行快照两者最大序号 +1。
// 与上游一致不加 FOR UPDATE（PostgreSQL 不允许聚合加行锁）；并发撞号由 CreatePurchase 的保存点重试兜底。
func NextPurchasePlanNo(s *db.Session, planDate jtype.Date) (string, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return "", err
	}
	prefix := "PLAN-" + planDate.Format("20060102") + "-"
	var materialMax, snapshotMax *string
	if err := s.Get(&materialMax, "SELECT MAX(plan_no) FROM purchase_material WHERE plan_no LIKE ? AND project_id = ?", prefix+"%", pid); err != nil {
		return "", err
	}
	if err := s.Get(&snapshotMax, "SELECT MAX(plan_no_snapshot) FROM purchase_request_line WHERE plan_no_snapshot LIKE ? AND project_id = ?", prefix+"%", pid); err != nil {
		return "", err
	}
	previous := ""
	for _, v := range []*string{materialMax, snapshotMax} {
		if v != nil && *v != "" && *v > previous {
			previous = *v
		}
	}
	index := 1
	if previous != "" {
		tail := previous[strings.LastIndex(previous, "-")+1:]
		n, err := strconv.Atoi(strings.TrimSpace(tail))
		if err != nil {
			return "", err
		}
		index = n + 1
	}
	if index > 999 {
		return "", apperr.New("PLAN_DAILY_LIMIT_EXCEEDED", "同一计划日期最多创建 999 条申购计划").WithStatus(409)
	}
	return fmt.Sprintf("%s%03d", prefix, index), nil
}

// nextPlanNo 便于单测模拟并发撞号。
var nextPlanNo = NextPurchasePlanNo

// todayShanghai 上海时区的今天。
func todayShanghai() jtype.Date { return jtype.DateOf(time.Now().In(common.Shanghai)) }

func firstNonEmpty(p *string, fallback string) string {
	if p != nil && *p != "" {
		return *p
	}
	return fallback
}

// CreatePurchase 对应 create_purchase_material：撞计划号时用保存点重试，最多 3 次。
func CreatePurchase(s *db.Session, data schema.PurchaseMaterialCreate) (*Purchase, error) {
	responsible := firstNonEmpty(data.PurchaseResponsible, "\\")
	if err := common.ValidateQuantityPrecision(data.PlannedQty); err != nil {
		return nil, err
	}
	stock, err := ValidateStockLink(s, data.StockMaterialID)
	if err != nil {
		return nil, err
	}
	files, err := Files(s, data.ImageIDs)
	if err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	planDate := todayShanghai()
	if data.PlanDate != nil {
		planDate = *data.PlanDate
	}
	status := data.Status
	if status == "" {
		status = domain.PlanStatusNormal
	}
	for attempt := 0; attempt < 3; attempt++ {
		if _, err := s.Exec("SAVEPOINT purchase_plan_no"); err != nil {
			return nil, err
		}
		item, err := insertPurchase(s, pid, planDate, responsible, status, data, files)
		if err != nil {
			if db.IsIntegrity(err) {
				if _, rerr := s.Exec("ROLLBACK TO SAVEPOINT purchase_plan_no"); rerr != nil {
					return nil, rerr
				}
				continue
			}
			return nil, err
		}
		if _, err := s.Exec("RELEASE SAVEPOINT purchase_plan_no"); err != nil {
			return nil, err
		}
		item.StockMaterial = stock
		return item, nil
	}
	return nil, apperr.New("PLAN_NO_CONFLICT", "计划号生成冲突，请稍后重试").WithStatus(409)
}

func insertPurchase(s *db.Session, pid int64, planDate jtype.Date, responsible, status string, data schema.PurchaseMaterialCreate, files []model.FileObject) (*Purchase, error) {
	planNo, err := nextPlanNo(s, planDate)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	m := model.PurchaseMaterial{
		PlanNo: planNo, PlanDate: planDate, MaterialCode: data.MaterialCode, Category: data.Category,
		Urgency: data.Urgency, DemandDepartment: data.DemandDepartment, Name: data.Name, ModelSpec: data.ModelSpec,
		UnitName: data.UnitName, ActualDemandPerson: firstNonEmpty(data.ActualDemandPerson, responsible),
		PurchaseResponsible: responsible, PlannedQty: data.PlannedQty, Usage: data.Usage, SubitemNo: data.SubitemNo,
		Remark: data.Remark, StockMaterialID: data.StockMaterialID, Status: domain.PurchasePlanStatus.ToDB(status),
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO purchase_material (plan_no, plan_date, material_code, category, urgency, demand_department, name, model_spec, unit_name, actual_demand_person, purchase_responsible, planned_qty, `usage`, subitem_no, remark, stock_material_id, status, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		m.PlanNo, m.PlanDate, m.MaterialCode, m.Category, m.Urgency, m.DemandDepartment, m.Name, m.ModelSpec, m.UnitName,
		m.ActualDemandPerson, m.PurchaseResponsible, m.PlannedQty, m.Usage, m.SubitemNo, m.Remark, m.StockMaterialID,
		m.Status, m.ProjectID, m.CreatedAt, m.UpdatedAt, m.Version)
	if err != nil {
		return nil, err
	}
	m.ID = id
	if err := insertImages(s, "purchase_material_image", "material_id", id, files); err != nil {
		return nil, err
	}
	return &Purchase{PurchaseMaterial: m, Images: imagesFromFiles(files)}, nil
}

func savePurchase(s *db.Session, item *Purchase) error {
	item.Version++
	item.UpdatedAt = common.UTCNow()
	_, err := s.Exec("UPDATE purchase_material SET plan_no = ?, plan_date = ?, material_code = ?, category = ?, urgency = ?, demand_department = ?, name = ?, model_spec = ?, unit_name = ?, actual_demand_person = ?, purchase_responsible = ?, planned_qty = ?, `usage` = ?, subitem_no = ?, remark = ?, stock_material_id = ?, status = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		item.PlanNo, item.PlanDate, item.MaterialCode, item.Category, item.Urgency, item.DemandDepartment, item.Name,
		item.ModelSpec, item.UnitName, item.ActualDemandPerson, item.PurchaseResponsible, item.PlannedQty, item.Usage,
		item.SubitemNo, item.Remark, item.StockMaterialID, item.Status, item.Version, item.UpdatedAt, item.ID, item.ProjectID)
	return err
}

// UpdatePurchase 对应 update_purchase_material：image_ids 为 nil 时不动图片；status 只有显式传入才修改。
func UpdatePurchase(s *db.Session, item *Purchase, data schema.PurchaseMaterialUpdate) (*Purchase, error) {
	if err := apperr.ValidateVersion(&data.Version, item.Version); err != nil {
		return nil, err
	}
	responsible := firstNonEmpty(data.PurchaseResponsible, item.PurchaseResponsible)
	if err := common.ValidateQuantityPrecision(data.PlannedQty); err != nil {
		return nil, err
	}
	stock, err := ValidateStockLink(s, data.StockMaterialID)
	if err != nil {
		return nil, err
	}
	var files []model.FileObject
	if data.ImageIDs != nil {
		if files, err = Files(s, *data.ImageIDs); err != nil {
			return nil, err
		}
	}
	item.MaterialCode = data.MaterialCode
	item.Category = data.Category
	item.Urgency = data.Urgency
	item.DemandDepartment = data.DemandDepartment
	item.Name = data.Name
	item.ModelSpec = data.ModelSpec
	item.UnitName = data.UnitName
	item.PlannedQty = data.PlannedQty
	item.Usage = data.Usage
	item.SubitemNo = data.SubitemNo
	item.Remark = data.Remark
	item.StockMaterialID = data.StockMaterialID
	if data.PlanDate != nil && !data.PlanDate.Equal(item.PlanDate.Time) {
		if item.PlanNo, err = nextPlanNo(s, *data.PlanDate); err != nil {
			return nil, err
		}
		item.PlanDate = *data.PlanDate
	}
	if data.ActualDemandPerson != nil {
		item.ActualDemandPerson = *data.ActualDemandPerson
	}
	if status, ok := data.StatusValue(); ok {
		item.Status = domain.PurchasePlanStatus.ToDB(status)
	}
	item.PurchaseResponsible = responsible
	item.StockMaterial = stock
	if data.ImageIDs != nil {
		if err := common.LogImageChange(s, "PURCHASE_PLAN", item.ID, ImageIDs(item.Images), *data.ImageIDs, "申购计划 "+item.PlanNo); err != nil {
			return nil, err
		}
	}
	if err := savePurchase(s, item); err != nil {
		return nil, err
	}
	if data.ImageIDs != nil {
		if err := replaceImages(s, "purchase_material_image", "material_id", item.ID, files); err != nil {
			return nil, err
		}
		item.Images = imagesFromFiles(files)
	}
	return item, nil
}

// BatchUpdatePurchases 对应 batch_update_purchase_materials：锁定全部计划后按请求顺序逐条校验版本并更新。
func BatchUpdatePurchases(s *db.Session, data schema.BatchUpdatePurchasePlansRequest) ([]*Purchase, error) {
	ids := make([]int64, len(data.Materials))
	for i, ref := range data.Materials {
		ids[i] = ref.ID
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var rows []model.PurchaseMaterial
	if err := s.SelectIn(&rows, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material WHERE id IN (?)"+scope+" FOR UPDATE", append([]any{ids}, sargs...)...); err != nil {
		return nil, err
	}
	items := wrapPurchases(rows)
	byID := map[int64]*Purchase{}
	for _, it := range items {
		byID[it.ID] = it
	}
	if len(byID) != len(ids) {
		return nil, apperr.NotFound("申购计划")
	}
	if err := LoadPurchaseRelations(s, items); err != nil {
		return nil, err
	}
	updated := make([]*Purchase, 0, len(data.Materials))
	for _, ref := range data.Materials {
		item := byID[ref.ID]
		v := ref.Version
		if err := apperr.ValidateVersion(&v, item.Version); err != nil {
			return nil, err
		}
		if data.PlanDate.Present() && !data.PlanDate.V.Equal(item.PlanDate.Time) {
			if item.PlanNo, err = nextPlanNo(s, data.PlanDate.V); err != nil {
				return nil, err
			}
			item.PlanDate = data.PlanDate.V
		}
		if data.Category.Set {
			item.Category = data.Category.Ptr()
		}
		if data.Urgency.Present() {
			item.Urgency = data.Urgency.V
		}
		if data.DemandDepartment.Present() {
			item.DemandDepartment = data.DemandDepartment.V
		}
		if data.ActualDemandPerson.Present() {
			item.ActualDemandPerson = data.ActualDemandPerson.V
		}
		if data.PurchaseResponsible.Present() {
			item.PurchaseResponsible = data.PurchaseResponsible.V
		}
		if data.SubitemNo.Set {
			item.SubitemNo = data.SubitemNo.Ptr()
		}
		if data.Usage.Present() {
			item.Usage = data.Usage.V
		}
		if data.Status.Present() {
			item.Status = domain.PurchasePlanStatus.ToDB(data.Status.V)
		}
		if err := savePurchase(s, item); err != nil {
			return nil, err
		}
		updated = append(updated, item)
	}
	return updated, nil
}

// DeletePurchase 对应 delete_purchase_material：已转入申购记录的计划不能删除。
func DeletePurchase(s *db.Session, item *Purchase, version *int64) error {
	if err := apperr.ValidateVersion(version, item.Version); err != nil {
		return err
	}
	referenced, err := purchaseReferenced(s, item.ID)
	if err != nil {
		return err
	}
	if referenced {
		return apperr.New("PURCHASE_PLAN_IN_USE", "已转入申购记录的计划不能删除").WithStatus(409)
	}
	if _, err := s.Exec("DELETE FROM purchase_material_image WHERE material_id = ? AND project_id = ?", item.ID, item.ProjectID); err != nil {
		return err
	}
	_, err = s.Exec("DELETE FROM purchase_material WHERE id = ? AND project_id = ?", item.ID, item.ProjectID)
	return err
}

// ---------------- 查询 ----------------

// PurchaseSortColumns 申购计划列表可排序列白名单（sort_by → 列）。
var PurchaseSortColumns = map[string]string{
	"plan_no":              "plan_no",
	"plan_date":            "plan_date",
	"material_code":        "material_code",
	"category":             "category",
	"urgency":              "urgency",
	"demand_department":    "demand_department",
	"name":                 "name",
	"model_spec":           "model_spec",
	"unit_name":            "unit_name",
	"planned_qty":          "planned_qty",
	"actual_demand_person": "actual_demand_person",
	"purchase_responsible": "purchase_responsible",
	"subitem_no":           "subitem_no",
	"usage":                "`usage`",
}

// PurchaseSearchColumns search_field → 列表达式。
var PurchaseSearchColumns = map[string]string{
	"plan_no":       "plan_no",
	"plan_date":     castText("plan_date"),
	"material_code": "material_code",
	"category":      "category",
	"name":          "name",
	"model_spec":    "model_spec",
	"unit_name":     "unit_name",
	"planned_qty":   castText("planned_qty"),
	"usage":         "`usage`",
	"subitem_no":    "subitem_no",
	"remark":        "remark",
}

// PurchaseSearch 是 search_purchase_materials 的参数。Status 为状态**值**列表。
type PurchaseSearch struct {
	Keyword                 *string
	SearchField             *string
	SearchValue             *string
	Name                    *string
	ModelSpec               *string
	ActualDemandPerson      *string
	EmptyActualDemandPerson bool
	PurchaseResponsible     *string
	SubitemNo               *string
	EmptySubitemNo          bool
	Category                *string
	Status                  []string
	Coded                   *bool
	Moved                   *bool
	Page                    int64
	PageSize                int64
	SortBy                  *string
	SortOrder               string // "asc"（默认）/ "desc"
}

const movedExists = "EXISTS (SELECT prl.id FROM purchase_request_line prl WHERE prl.purchase_material_id = purchase_material.id%s)"

func movedCondition(s *db.Session, moved bool) (string, []any, error) {
	scope, sargs, err := scopeAnd(s, "prl.")
	if err != nil {
		return "", nil, err
	}
	cond := fmt.Sprintf(movedExists, scope)
	if !moved {
		cond = "NOT " + cond
	}
	return cond, sargs, nil
}

func pyStrip(v string) string { return strings.TrimFunc(v, common.PyIsSpace) }

func statusNames(values []string) []any {
	out := make([]any, len(values))
	for i, v := range values {
		out[i] = domain.PurchasePlanStatus.ToDB(v)
	}
	return out
}

// SearchPurchases 对应 search_purchase_materials。
func SearchPurchases(s *db.Session, q PurchaseSearch) ([]*Purchase, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{
		"plan_no", castText("plan_date"), "name", "model_spec", "material_code", "category", "unit_name",
		castText("planned_qty"), "actual_demand_person", "purchase_responsible", "`usage`", "subitem_no", "remark",
	}, q.Keyword)
	if q.SearchField != nil && *q.SearchField != "" && q.SearchValue != nil && *q.SearchValue != "" {
		col, ok := PurchaseSearchColumns[*q.SearchField]
		if !ok {
			return nil, 0, fmt.Errorf("unknown purchase search field %q", *q.SearchField)
		}
		w.ContainsAny([]string{col}, q.SearchValue)
	}
	w.ContainsAny([]string{"name"}, q.Name)
	w.ContainsAny([]string{"model_spec"}, q.ModelSpec)
	if q.EmptyActualDemandPerson {
		w.Add("(actual_demand_person IS NULL OR TRIM(actual_demand_person) IN (?, ?, ?, ?, ?))", emptyPersonValues...)
	} else {
		w.ContainsAny([]string{"actual_demand_person"}, q.ActualDemandPerson)
	}
	w.ContainsAny([]string{"purchase_responsible"}, q.PurchaseResponsible)
	if q.EmptySubitemNo {
		w.Add("(subitem_no IS NULL OR TRIM(subitem_no) = ?)", "")
	} else if q.SubitemNo != nil && *q.SubitemNo != "" {
		w.Add("TRIM(subitem_no) = ?", pyStrip(*q.SubitemNo))
	}
	if q.Category != nil && *q.Category != "" {
		w.Add("TRIM(category) = ?", pyStrip(*q.Category))
	}
	if len(q.Status) > 0 {
		w.Add("status IN ("+common.Placeholders(len(q.Status))+")", statusNames(q.Status)...)
	}
	if q.Coded != nil {
		if *q.Coded {
			w.Add("material_code IS NOT NULL")
		} else {
			w.Add("material_code IS NULL")
		}
	}
	if q.Moved != nil {
		cond, args, err := movedCondition(s, *q.Moved)
		if err != nil {
			return nil, 0, err
		}
		w.Add(cond, args...)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM purchase_material"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	order := "id DESC"
	if q.SortBy != nil {
		if col, ok := PurchaseSortColumns[*q.SortBy]; ok {
			dir := "ASC"
			if q.SortOrder != "" && q.SortOrder != "asc" {
				dir = "DESC"
			}
			order = col + " " + dir + ", id DESC"
		}
	}
	var rows []model.PurchaseMaterial
	args := append(append([]any{}, w.Args...), q.PageSize, common.Offset(q.Page, q.PageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material"+w.SQL()+" ORDER BY "+order+" LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	items := wrapPurchases(rows)
	if err := LoadPurchaseRelations(s, items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// PurchaseFilterOptions 对应 purchase_filter_options：返回（实际需求人, 采购负责人, 子项号, 分类）去重排序列表。
// status 为状态**值**（nil 表示不过滤）。
func PurchaseFilterOptions(s *db.Session, moved *bool, status *string) (actualDemandPersons, purchaseResponsibles, subitemNos, categories []string, err error) {
	extra := common.Where{}
	if err = extra.Scope(s, ""); err != nil {
		return
	}
	if status != nil {
		extra.Add("status = ?", domain.PurchasePlanStatus.ToDB(*status))
	}
	if moved != nil {
		cond, args, e := movedCondition(s, *moved)
		if e != nil {
			err = e
			return
		}
		extra.Add(cond, args...)
	}
	query := func(col, cond string, condArgs ...any) ([]string, error) {
		w := common.Where{}
		w.Add(cond, condArgs...)
		if !extra.Empty() {
			w.Add(strings.TrimPrefix(extra.SQL(), " WHERE "), extra.Args...)
		}
		var vals []*string
		if err := s.Select(&vals, "SELECT DISTINCT "+col+" FROM purchase_material"+w.SQL()+" ORDER BY "+col, w.Args...); err != nil {
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
	if subitemNos, err = query("subitem_no", "subitem_no IS NOT NULL AND TRIM(subitem_no) != ?", ""); err != nil {
		return
	}
	categories, err = query("category", "category IS NOT NULL AND TRIM(category) != ?", "")
	return
}

// PurchaseExportFilter 是 purchase_materials_for_export 的参数：MaterialIDs 为 nil 表示不按 id 过滤
// （非 nil 的空切片等价于 Python 传入 []）；Status 为状态**值**。
type PurchaseExportFilter struct {
	MaterialIDs []int64
	Keyword     *string
	Coded       *bool
	Moved       *bool
	Status      *string
}

// PurchasesForExport 对应 purchase_materials_for_export：按 id 升序；指定 id 有缺失时报 NOT_FOUND。
func PurchasesForExport(s *db.Session, f PurchaseExportFilter) ([]*Purchase, error) {
	if f.MaterialIDs != nil && len(f.MaterialIDs) == 0 {
		return []*Purchase{}, nil
	}
	w := common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, err
	}
	if f.MaterialIDs != nil {
		w.Add("id IN ("+common.Placeholders(len(f.MaterialIDs))+")", common.AnyArgs(f.MaterialIDs)...)
	}
	if f.Keyword != nil && *f.Keyword != "" {
		like := "%" + *f.Keyword + "%"
		w.Add("(name LIKE ? OR model_spec LIKE ? OR material_code LIKE ? OR plan_no LIKE ?)", like, like, like, like)
	}
	if f.Coded != nil {
		if *f.Coded {
			w.Add("material_code IS NOT NULL")
		} else {
			w.Add("material_code IS NULL")
		}
	}
	if f.Status != nil {
		w.Add("status = ?", domain.PurchasePlanStatus.ToDB(*f.Status))
	}
	if f.Moved != nil {
		cond, args, err := movedCondition(s, *f.Moved)
		if err != nil {
			return nil, err
		}
		w.Add(cond, args...)
	}
	var rows []model.PurchaseMaterial
	if err := s.Select(&rows, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material"+w.SQL()+" ORDER BY id", w.Args...); err != nil {
		return nil, err
	}
	if f.MaterialIDs != nil {
		uniq := map[int64]bool{}
		for _, id := range f.MaterialIDs {
			uniq[id] = true
		}
		if len(rows) != len(uniq) {
			return nil, apperr.NotFound("申购计划")
		}
	}
	items := wrapPurchases(rows)
	if err := LoadPurchaseRelations(s, items); err != nil {
		return nil, err
	}
	return items, nil
}

// ---------------- 导出校验 ----------------

// orderedIDs 保持字段定义顺序输出 missing_fields（与 Python dict 一致）。
type orderedIDs struct {
	keys []string
	vals map[string][]int64
}

func (o orderedIDs) MarshalJSON() ([]byte, error) {
	var b strings.Builder
	b.WriteByte('{')
	for i, k := range o.keys {
		if i > 0 {
			b.WriteByte(',')
		}
		kb, _ := jtype.Marshal(k)
		vb, _ := jtype.Marshal(o.vals[k])
		b.Write(kb)
		b.WriteByte(':')
		b.Write(vb)
	}
	b.WriteByte('}')
	return []byte(b.String()), nil
}

type exportCheck struct {
	field   string
	label   string
	missing func(p *Purchase) bool
}

func blankPtr(v *string) bool { return v == nil || pyStrip(*v) == "" }
func blankStr(v string) bool  { return pyStrip(v) == "" }

func validateExport(materials []*Purchase, checks []exportCheck, code, title string) error {
	missing := orderedIDs{vals: map[string][]int64{}}
	labels := []string{}
	for _, c := range checks {
		ids := []int64{}
		for _, m := range materials {
			if c.missing(m) {
				ids = append(ids, m.ID)
			}
		}
		if len(ids) > 0 {
			missing.keys = append(missing.keys, c.field)
			missing.vals[c.field] = ids
			labels = append(labels, c.label)
		}
	}
	if len(labels) > 0 {
		return apperr.New(code, title+strings.Join(labels, "、")).WithStatus(409).
			WithDetails(apperr.D{"missing_fields": missing})
	}
	return nil
}

// ValidatePurchaseApplicationExport 对应 validate_purchase_application_export：编码 / 子项号 / 用途必填。
func ValidatePurchaseApplicationExport(materials []*Purchase) error {
	return validateExport(materials, []exportCheck{
		{"material_code", "编码", func(p *Purchase) bool { return blankPtr(p.MaterialCode) }},
		{"subitem_no", "子项号", func(p *Purchase) bool { return blankPtr(p.SubitemNo) }},
		{"usage", "用途", func(p *Purchase) bool { return blankStr(p.Usage) }},
	}, "PURCHASE_APPLICATION_EXPORT_FIELDS_REQUIRED", "导出采购申请表前请补全：")
}

// ValidatePurchaseApprovalExport 对应 validate_purchase_approval_export：子项号、物资名称、型号、申请数量、单位、用途必填。
func ValidatePurchaseApprovalExport(materials []*Purchase) error {
	return validateExport(materials, []exportCheck{
		{"subitem_no", "子项号", func(p *Purchase) bool { return blankPtr(p.SubitemNo) }},
		{"name", "物资名称", func(p *Purchase) bool { return blankStr(p.Name) }},
		{"model_spec", "型号", func(p *Purchase) bool { return blankStr(p.ModelSpec) }},
		{"planned_qty", "申请数量", func(p *Purchase) bool { return p.PlannedQty.IsZero() }},
		{"unit_name", "单位", func(p *Purchase) bool { return blankStr(p.UnitName) }},
		{"usage", "用途", func(p *Purchase) bool { return blankStr(p.Usage) }},
	}, "PURCHASE_APPROVAL_EXPORT_FIELDS_REQUIRED", "导出申购审批表前请补全：")
}

// InTransitWindowMonths 申购审批表「在途量」统计窗口（往前 3 个自然月）。
const InTransitWindowMonths = 3

// monthsBefore anchor 往前退 n 个自然月的同一天；目标月没有该日时取该月最后一天。
func monthsBefore(anchor jtype.Date, months int) jtype.Date {
	idx := int(anchor.Month()) - 1 - months
	year := anchor.Year() + floorDiv(idx, 12)
	month := time.Month(floorMod(idx, 12) + 1)
	last := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	return jtype.NewDate(year, month, min(anchor.Day(), last))
}

func floorDiv(a, b int) int {
	q := a / b
	if (a%b != 0) && ((a < 0) != (b < 0)) {
		q--
	}
	return q
}

func floorMod(a, b int) int { return a - floorDiv(a, b)*b }

// ApprovalQuantity 是申购审批表的（库存量, 在途量）。
type ApprovalQuantity struct {
	Stock     jtype.Decimal
	InTransit jtype.Decimal
}

// PurchaseApprovalExportQuantities 对应 purchase_approval_export_quantities：按物料编码精确匹配
// 华星总库存数量之和与最近 3 个自然月申购记录数量之和；today 为 nil 时取上海时区今天。
func PurchaseApprovalExportQuantities(s *db.Session, materials []*Purchase, today *jtype.Date) (map[string]ApprovalQuantity, error) {
	codes := []string{}
	seen := map[string]bool{}
	for _, m := range materials {
		if m.MaterialCode != nil && *m.MaterialCode != "" && !seen[*m.MaterialCode] {
			seen[*m.MaterialCode] = true
			codes = append(codes, *m.MaterialCode)
		}
	}
	out := map[string]ApprovalQuantity{}
	if len(codes) == 0 {
		return out, nil
	}
	zeroQty := jtype.MustDecimal("0")
	for _, c := range codes {
		out[c] = ApprovalQuantity{Stock: zeroQty, InTransit: zeroQty}
	}
	type row struct {
		Code  string        `db:"code"`
		Total jtype.Decimal `db:"total"`
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var stockRows []row
	if err := s.SelectIn(&stockRows, "SELECT material_code AS code, COALESCE(SUM(quantity), 0) AS total FROM huaxing_inventory WHERE material_code IN (?)"+scope+" GROUP BY material_code",
		append([]any{codes}, sargs...)...); err != nil {
		return nil, err
	}
	for _, r := range stockRows {
		q := out[r.Code]
		q.Stock = r.Total
		out[r.Code] = q
	}
	anchor := todayShanghai()
	if today != nil {
		anchor = *today
	}
	lscope, largs, err := scopeAnd(s, "l.")
	if err != nil {
		return nil, err
	}
	rscope, rargs, err := scopeAnd(s, "r.")
	if err != nil {
		return nil, err
	}
	var transitRows []row
	args := append([]any{codes, monthsBefore(anchor, InTransitWindowMonths), anchor}, largs...)
	args = append(args, rargs...)
	if err := s.SelectIn(&transitRows, "SELECT l.material_code_snapshot AS code, COALESCE(SUM(l.purchase_qty), 0) AS total FROM purchase_request_line l JOIN purchase_request r ON l.purchase_request_id = r.id WHERE l.material_code_snapshot IN (?) AND r.purchase_date IS NOT NULL AND r.purchase_date >= ? AND r.purchase_date <= ?"+lscope+rscope+" GROUP BY l.material_code_snapshot",
		args...); err != nil {
		return nil, err
	}
	for _, r := range transitRows {
		q := out[r.Code]
		q.InTransit = r.Total
		out[r.Code] = q
	}
	return out, nil
}
