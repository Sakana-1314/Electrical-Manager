// Package purchaserequest 对应原 services/purchase_request_service.py + repositories/purchase_request_repository.py：
// 申购计划转入申购记录、申购记录读写 / 批量编辑 / 退回计划，以及记录列表与筛选项查询。
package purchaserequest

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
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

// Line 是带 selectin 关系（所属申购单头、图片）的申购记录行。
type Line struct {
	model.PurchaseRequestLine
	Request *model.PurchaseRequest
	Images  []material.Image
}

// UsageHash 对应 PurchaseRequestLine._sync_usage_hash：usage 的 SHA-256 十六进制前 32 位。
func UsageHash(usage string) string {
	sum := sha256.Sum256([]byte(usage))
	return hex.EncodeToString(sum[:])[:32]
}

// scopeAnd 返回 " AND <alias>project_id = ?"（系统上下文返回空串）。
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

// DefaultPurchaseOrderNo 对应 default_purchase_order_no：「申购 YYYY/M/D」（上海时区）。
func DefaultPurchaseOrderNo() string {
	now := time.Now().In(common.Shanghai)
	return fmt.Sprintf("申购 %d/%d/%d", now.Year(), int(now.Month()), now.Day())
}

// PurchaseRecordRead 对应 purchase_record_read（line 的 Request / Images 必须已加载）。
func PurchaseRecordRead(line *Line) schema.PurchaseRecordRead {
	req := line.Request
	updated := req.UpdatedAt
	if line.UpdatedAt.After(updated) {
		updated = line.UpdatedAt
	}
	return schema.PurchaseRecordRead{
		LineID: line.ID, PurchaseRequestID: req.ID, PurchaseMaterialID: line.PurchaseMaterialID,
		PlanNo: line.PlanNoSnapshot, PlanDate: line.PlanDateSnapshot, PurchaseOrderNo: req.PurchaseOrderNo,
		TraceNo: line.TraceNo, ContractNo: req.ContractNo, VesselNo: req.VesselNo,
		ConsolidationDate: req.ConsolidationDate, ConsolidationPort: req.ConsolidationPort, SailingDate: req.SailingDate,
		ContractSignDate: line.ContractSignDate, UnitPrice: line.UnitPrice, Status: line.Status,
		MaterialCode: line.MaterialCodeSnapshot, Category: line.CategorySnapshot,
		DemandDepartment: line.DemandDepartmentSnapshot, MaterialName: line.MaterialNameSnapshot,
		ModelSpec: line.ModelSpecSnapshot, UnitName: line.UnitNameSnapshot, PurchaseQty: line.PurchaseQty,
		ActualDemandPerson: line.ActualDemandPersonSnapshot, PurchaseResponsible: line.PurchaseResponsibleSnapshot,
		Salesperson: line.Salesperson, PlanRemark: line.PlanRemarkSnapshot, RecordRemark: req.Remark,
		Usage: line.Usage, SubitemNo: line.SubitemNo, Images: material.FileReads(line.Images),
		StockMaterialID: line.StockMaterialIDSnapshot, PurchaseDate: req.PurchaseDate,
		CreatedAt: schema.NewAwareTime(req.CreatedAt), UpdatedAt: schema.NewAwareTime(updated), Version: req.Version,
	}
}

// PurchaseRecordReads 批量组装。
func PurchaseRecordReads(lines []*Line) []schema.PurchaseRecordRead {
	out := make([]schema.PurchaseRecordRead, len(lines))
	for i, l := range lines {
		out[i] = PurchaseRecordRead(l)
	}
	return out
}

// ---------------- 关系加载 ----------------

func wrapLines(rows []model.PurchaseRequestLine) []*Line {
	out := make([]*Line, len(rows))
	for i := range rows {
		out[i] = &Line{PurchaseRequestLine: rows[i]}
	}
	return out
}

type imageRow struct {
	OwnerID   int64 `db:"link_owner_id"`
	SortOrder int64 `db:"link_sort_order"`
	model.FileObject
}

// loadLineImages 一次 IN 查询加载多行的图片（按 sort_order）。
func loadLineImages(s *db.Session, lineIDs []int64) (map[int64][]material.Image, error) {
	out := map[int64][]material.Image{}
	if len(lineIDs) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "i.")
	if err != nil {
		return nil, err
	}
	var rows []imageRow
	q := "SELECT i.line_id AS link_owner_id, i.sort_order AS link_sort_order, " + model.Prefixed("f", model.ColsFileObject) +
		" FROM purchase_request_line_image i JOIN file_object f ON f.id = i.file_id WHERE i.line_id IN (?)" + scope +
		" ORDER BY i.line_id, i.sort_order"
	if err := s.SelectIn(&rows, q, append([]any{lineIDs}, sargs...)...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.OwnerID] = append(out[r.OwnerID], material.Image{FileID: r.FileObject.ID, SortOrder: r.SortOrder, File: r.FileObject})
	}
	return out, nil
}

// loadRequests 按 id 批量加载申购单头（可加行锁）。
func loadRequests(s *db.Session, ids []int64, forUpdate bool) (map[int64]*model.PurchaseRequest, error) {
	out := map[int64]*model.PurchaseRequest{}
	if len(ids) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	q := "SELECT " + model.ColsPurchaseRequest + " FROM purchase_request WHERE id IN (?)" + scope
	if forUpdate {
		q += " FOR UPDATE"
	}
	var rows []model.PurchaseRequest
	if err := s.SelectIn(&rows, q, append([]any{ids}, sargs...)...); err != nil {
		return nil, err
	}
	for i := range rows {
		out[rows[i].ID] = &rows[i]
	}
	return out, nil
}

func uniqueRequestIDs(lines []*Line) []int64 {
	seen := map[int64]bool{}
	ids := []int64{}
	for _, l := range lines {
		if !seen[l.PurchaseRequestID] {
			seen[l.PurchaseRequestID] = true
			ids = append(ids, l.PurchaseRequestID)
		}
	}
	return ids
}

// LoadLineRelations 批量加载申购单头与图片（selectin）。
func LoadLineRelations(s *db.Session, lines []*Line) error {
	if len(lines) == 0 {
		return nil
	}
	requests, err := loadRequests(s, uniqueRequestIDs(lines), false)
	if err != nil {
		return err
	}
	ids := make([]int64, len(lines))
	for i, l := range lines {
		ids[i] = l.ID
	}
	images, err := loadLineImages(s, ids)
	if err != nil {
		return err
	}
	for _, l := range lines {
		l.Request = requests[l.PurchaseRequestID]
		l.Images = images[l.ID]
		if l.Images == nil {
			l.Images = []material.Image{}
		}
	}
	return nil
}

// LinesByIDs 按 id 读取申购记录行（含关系，按传入 id 不保证顺序）。
func LinesByIDs(s *db.Session, ids []int64) ([]*Line, error) {
	if len(ids) == 0 {
		return []*Line{}, nil
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var rows []model.PurchaseRequestLine
	if err := s.SelectIn(&rows, "SELECT "+model.ColsPurchaseRequestLine+" FROM purchase_request_line WHERE id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
		return nil, err
	}
	lines := wrapLines(rows)
	if err := LoadLineRelations(s, lines); err != nil {
		return nil, err
	}
	return lines, nil
}

// ---------------- 读取单条 ----------------

// FindPurchaseRecord 对应 repository.get_purchase_record：不存在返回 nil。
func FindPurchaseRecord(s *db.Session, lineID int64, forUpdate bool) (*Line, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	q := "SELECT " + model.ColsPurchaseRequestLine + " FROM purchase_request_line WHERE id = ?" + scope
	if forUpdate {
		q += " FOR UPDATE"
	}
	var row model.PurchaseRequestLine
	ok, err := s.Find(&row, q, append([]any{lineID}, sargs...)...)
	if err != nil || !ok {
		return nil, err
	}
	line := &Line{PurchaseRequestLine: row}
	if err := LoadLineRelations(s, []*Line{line}); err != nil {
		return nil, err
	}
	return line, nil
}

// GetPurchaseRecord 对应 get_purchase_record：不存在报 NOT_FOUND「申购记录不存在」。
func GetPurchaseRecord(s *db.Session, lineID int64, forUpdate bool) (*Line, error) {
	line, err := FindPurchaseRecord(s, lineID, forUpdate)
	if err != nil {
		return nil, err
	}
	if line == nil {
		return nil, apperr.NotFound("申购记录")
	}
	return line, nil
}

// ---------------- 写入辅助 ----------------

func emptyToNil(p *string) *string {
	if p == nil || *p == "" {
		return nil
	}
	return p
}

func saveRequest(s *db.Session, r *model.PurchaseRequest) error {
	r.UpdatedAt = common.UTCNow()
	_, err := s.Exec("UPDATE purchase_request SET purchase_order_no = ?, contract_no = ?, vessel_no = ?, consolidation_date = ?, consolidation_port = ?, sailing_date = ?, remark = ?, purchase_date = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		r.PurchaseOrderNo, r.ContractNo, r.VesselNo, r.ConsolidationDate, r.ConsolidationPort, r.SailingDate, r.Remark,
		r.PurchaseDate, r.Version, r.UpdatedAt, r.ID, r.ProjectID)
	return err
}

// SaveRequest 写回申购单头（updated_at 置当前时间）。
func SaveRequest(s *db.Session, r *model.PurchaseRequest) error { return saveRequest(s, r) }

func saveLine(s *db.Session, l *model.PurchaseRequestLine) error {
	l.UpdatedAt = common.UTCNow()
	l.UsageHash = UsageHash(l.Usage)
	_, err := s.Exec("UPDATE purchase_request_line SET purchase_material_id = ?, plan_no_snapshot = ?, plan_date_snapshot = ?, material_code_snapshot = ?, category_snapshot = ?, demand_department_snapshot = ?, material_name_snapshot = ?, model_spec_snapshot = ?, unit_name_snapshot = ?, actual_demand_person_snapshot = ?, purchase_responsible_snapshot = ?, plan_remark_snapshot = ?, stock_material_id_snapshot = ?, purchase_qty = ?, status = ?, `usage` = ?, usage_hash = ?, subitem_no = ?, trace_no = ?, salesperson = ?, contract_sign_date = ?, unit_price = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		l.PurchaseMaterialID, l.PlanNoSnapshot, l.PlanDateSnapshot, l.MaterialCodeSnapshot, l.CategorySnapshot,
		l.DemandDepartmentSnapshot, l.MaterialNameSnapshot, l.ModelSpecSnapshot, l.UnitNameSnapshot,
		l.ActualDemandPersonSnapshot, l.PurchaseResponsibleSnapshot, l.PlanRemarkSnapshot, l.StockMaterialIDSnapshot,
		l.PurchaseQty, l.Status, l.Usage, l.UsageHash, l.SubitemNo, l.TraceNo, l.Salesperson, l.ContractSignDate,
		l.UnitPrice, l.Version, l.UpdatedAt, l.ID, l.ProjectID)
	return err
}

// SaveLine 写回申购记录行（updated_at 置当前时间、usage_hash 随 usage 重算）。
func SaveLine(s *db.Session, l *model.PurchaseRequestLine) error { return saveLine(s, l) }

func insertLineImages(s *db.Session, pid, lineID int64, fileIDs []string) error {
	if len(fileIDs) == 0 {
		return nil
	}
	values := make([]string, len(fileIDs))
	args := make([]any, 0, len(fileIDs)*4)
	for i, id := range fileIDs {
		values[i] = "(?, ?, ?, ?)"
		args = append(args, lineID, id, i, pid)
	}
	_, err := s.Exec("INSERT INTO purchase_request_line_image (line_id, file_id, sort_order, project_id) VALUES "+strings.Join(values, ", "), args...)
	return err
}

func imagesFromFiles(files []model.FileObject) []material.Image {
	out := make([]material.Image, len(files))
	for i, f := range files {
		out[i] = material.Image{FileID: f.ID, SortOrder: int64(i), File: f}
	}
	return out
}

// ---------------- 转入申购记录 ----------------

// MovePlanToRecord 对应 move_plan_to_record。
func MovePlanToRecord(s *db.Session, materialID int64, data schema.MovePurchasePlanRequest) (*Line, error) {
	lines, err := MovePlansToRecord(s, []int64{materialID}, data)
	if err != nil {
		return nil, err
	}
	return lines[0], nil
}

// BatchMovePlansToRecord 对应 batch_move_plans_to_record。
func BatchMovePlansToRecord(s *db.Session, data schema.BatchMovePurchasePlansRequest) ([]*Line, error) {
	return MovePlansToRecord(s, data.MaterialIDs, data.MovePurchasePlanRequest)
}

// MovePlansToRecord 对应 move_plans_to_record：锁定计划 → 校验已编码、未转入 → 新建一张申购单与对应行（快照 + 图片镜像）。
func MovePlansToRecord(s *db.Session, materialIDs []int64, data schema.MovePurchasePlanRequest) ([]*Line, error) {
	seen := map[int64]bool{}
	ids := []int64{}
	for _, id := range materialIDs {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var rows []model.PurchaseMaterial
	if err := s.SelectIn(&rows, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material WHERE id IN (?) AND project_id = ? ORDER BY id FOR UPDATE", ids, pid); err != nil {
		return nil, err
	}
	if len(rows) != len(ids) {
		return nil, apperr.NotFound("申购计划")
	}
	materials := make([]*material.Purchase, len(rows))
	for i := range rows {
		materials[i] = &material.Purchase{PurchaseMaterial: rows[i]}
	}
	if err := material.LoadPurchaseRelations(s, materials); err != nil {
		return nil, err
	}
	uncoded := []int64{}
	for _, m := range materials {
		if m.MaterialCode == nil || *m.MaterialCode == "" {
			uncoded = append(uncoded, m.ID)
		}
	}
	if len(uncoded) > 0 {
		return nil, apperr.New("MATERIAL_CODE_REQUIRED", "未编码物资不能转入申购记录").WithStatus(409).
			WithDetails(apperr.D{"material_ids": uncoded})
	}
	var movedRows []*int64
	if err := s.SelectIn(&movedRows, "SELECT purchase_material_id FROM purchase_request_line WHERE purchase_material_id IN (?) AND project_id = ? FOR UPDATE", ids, pid); err != nil {
		return nil, err
	}
	movedSet := map[int64]bool{}
	for _, v := range movedRows {
		if v != nil {
			movedSet[*v] = true
		}
	}
	if len(movedSet) > 0 {
		moved := make([]int64, 0, len(movedSet))
		for id := range movedSet {
			moved = append(moved, id)
		}
		sort.Slice(moved, func(i, j int) bool { return moved[i] < moved[j] })
		return nil, apperr.New("PLAN_ALREADY_MOVED", "部分申购计划已转入申购记录").WithStatus(409).
			WithDetails(apperr.D{"material_ids": moved})
	}

	now := common.UTCNow()
	var orderNo *string
	if data.PurchaseOrderNo.Set {
		orderNo = emptyToNil(data.PurchaseOrderNo.Ptr())
	} else {
		v := DefaultPurchaseOrderNo()
		orderNo = &v
	}
	req := &model.PurchaseRequest{
		PurchaseOrderNo: orderNo, ContractNo: emptyToNil(data.ContractNo), VesselNo: emptyToNil(data.VesselNo),
		ConsolidationDate: data.ConsolidationDate, ConsolidationPort: emptyToNil(data.ConsolidationPort),
		SailingDate: data.SailingDate, Remark: data.RecordRemark, PurchaseDate: &data.PurchaseDate,
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	reqID, err := s.Insert("INSERT INTO purchase_request (purchase_order_no, contract_no, vessel_no, consolidation_date, consolidation_port, sailing_date, remark, purchase_date, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		req.PurchaseOrderNo, req.ContractNo, req.VesselNo, req.ConsolidationDate, req.ConsolidationPort, req.SailingDate,
		req.Remark, req.PurchaseDate, req.ProjectID, req.CreatedAt, req.UpdatedAt, req.Version)
	if err != nil {
		return nil, err
	}
	req.ID = reqID
	lines := make([]*Line, 0, len(materials))
	for _, m := range materials {
		mid := m.ID
		l := model.PurchaseRequestLine{
			PurchaseRequestID: reqID, PurchaseMaterialID: &mid, PlanNoSnapshot: m.PlanNo, PlanDateSnapshot: m.PlanDate,
			MaterialCodeSnapshot: m.MaterialCode, CategorySnapshot: m.Category, DemandDepartmentSnapshot: m.DemandDepartment,
			MaterialNameSnapshot: m.Name, ModelSpecSnapshot: m.ModelSpec, UnitNameSnapshot: m.UnitName,
			ActualDemandPersonSnapshot: m.ActualDemandPerson, PurchaseResponsibleSnapshot: m.PurchaseResponsible,
			PlanRemarkSnapshot: m.Remark, StockMaterialIDSnapshot: m.StockMaterialID, PurchaseQty: m.PlannedQty,
			Status: data.Status, Usage: m.Usage, UsageHash: UsageHash(m.Usage), SubitemNo: m.SubitemNo,
			TraceNo: emptyToNil(data.TraceNo), Salesperson: data.Salesperson, ContractSignDate: data.ContractSignDate,
			ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
		}
		id, err := s.Insert("INSERT INTO purchase_request_line (purchase_request_id, purchase_material_id, plan_no_snapshot, plan_date_snapshot, material_code_snapshot, category_snapshot, demand_department_snapshot, material_name_snapshot, model_spec_snapshot, unit_name_snapshot, actual_demand_person_snapshot, purchase_responsible_snapshot, plan_remark_snapshot, stock_material_id_snapshot, purchase_qty, status, `usage`, usage_hash, subitem_no, trace_no, salesperson, contract_sign_date, unit_price, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			l.PurchaseRequestID, l.PurchaseMaterialID, l.PlanNoSnapshot, l.PlanDateSnapshot, l.MaterialCodeSnapshot,
			l.CategorySnapshot, l.DemandDepartmentSnapshot, l.MaterialNameSnapshot, l.ModelSpecSnapshot, l.UnitNameSnapshot,
			l.ActualDemandPersonSnapshot, l.PurchaseResponsibleSnapshot, l.PlanRemarkSnapshot, l.StockMaterialIDSnapshot,
			l.PurchaseQty, l.Status, l.Usage, l.UsageHash, l.SubitemNo, l.TraceNo, l.Salesperson, l.ContractSignDate,
			l.UnitPrice, l.ProjectID, l.CreatedAt, l.UpdatedAt, l.Version)
		if err != nil {
			return nil, err
		}
		l.ID = id
		fileIDs := material.ImageIDs(m.Images)
		if err := insertLineImages(s, pid, id, fileIDs); err != nil {
			return nil, err
		}
		images := make([]material.Image, len(m.Images))
		for i, img := range m.Images {
			images[i] = material.Image{FileID: img.FileID, SortOrder: int64(i), File: img.File}
		}
		lines = append(lines, &Line{PurchaseRequestLine: l, Request: req, Images: images})
	}
	return lines, nil
}

// ---------------- 编辑 ----------------

// UpdatePurchaseRecord 对应 update_purchase_record：image_ids 为 nil 时不动图片。
func UpdatePurchaseRecord(s *db.Session, line *Line, data schema.PurchaseRecordUpdate) (*Line, error) {
	req := line.Request
	v := data.Version
	if err := apperr.ValidateVersion(&v, req.Version); err != nil {
		return nil, err
	}
	var files []model.FileObject
	if data.ImageIDs != nil {
		var err error
		if files, err = material.Files(s, *data.ImageIDs); err != nil {
			return nil, err
		}
	}
	req.PurchaseOrderNo = emptyToNil(data.PurchaseOrderNo)
	line.TraceNo = emptyToNil(data.TraceNo)
	req.ContractNo = emptyToNil(data.ContractNo)
	req.VesselNo = emptyToNil(data.VesselNo)
	req.ConsolidationDate = data.ConsolidationDate
	req.ConsolidationPort = emptyToNil(data.ConsolidationPort)
	req.SailingDate = data.SailingDate
	req.PurchaseDate = data.PurchaseDate
	line.Salesperson = data.Salesperson
	line.ContractSignDate = data.ContractSignDate
	line.UnitPrice = data.UnitPrice
	req.Remark = data.RecordRemark
	req.Version++
	line.PlanDateSnapshot = data.PlanDate
	line.MaterialCodeSnapshot = data.MaterialCode
	line.CategorySnapshot = data.Category
	line.DemandDepartmentSnapshot = data.DemandDepartment
	line.MaterialNameSnapshot = data.MaterialName
	line.ModelSpecSnapshot = data.ModelSpec
	line.UnitNameSnapshot = data.UnitName
	line.ActualDemandPersonSnapshot = data.ActualDemandPerson
	line.PurchaseResponsibleSnapshot = data.PurchaseResponsible
	line.PlanRemarkSnapshot = data.PlanRemark
	line.StockMaterialIDSnapshot = data.StockMaterialID
	line.PurchaseQty = data.PurchaseQty
	line.Status = data.Status
	line.Usage = data.Usage
	line.SubitemNo = data.SubitemNo
	if data.ImageIDs != nil {
		label := fmt.Sprintf("申购记录 %d", line.ID)
		if req.PurchaseOrderNo != nil && *req.PurchaseOrderNo != "" {
			label = "申购记录 " + *req.PurchaseOrderNo
		}
		if err := common.LogImageChange(s, "PURCHASE_RECORD", line.ID, material.ImageIDs(line.Images), *data.ImageIDs, label); err != nil {
			return nil, err
		}
	}
	line.Version++
	if err := saveRequest(s, req); err != nil {
		return nil, err
	}
	if err := saveLine(s, &line.PurchaseRequestLine); err != nil {
		return nil, err
	}
	if data.ImageIDs != nil {
		if _, err := s.Exec("DELETE FROM purchase_request_line_image WHERE line_id = ? AND project_id = ?", line.ID, line.ProjectID); err != nil {
			return nil, err
		}
		if err := insertLineImages(s, line.ProjectID, line.ID, *data.ImageIDs); err != nil {
			return nil, err
		}
		line.Images = imagesFromFiles(files)
	}
	return line, nil
}

// BatchUpdatePurchaseRecords 对应 batch_update_purchase_records：锁定行与申购单头，按申购单头版本校验后批量改写。
func BatchUpdatePurchaseRecords(s *db.Session, data schema.BatchUpdatePurchaseRecordsRequest) ([]*Line, error) {
	lineIDs := make([]int64, len(data.Records))
	for i, r := range data.Records {
		lineIDs[i] = r.LineID
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var rows []model.PurchaseRequestLine
	if err := s.SelectIn(&rows, "SELECT "+model.ColsPurchaseRequestLine+" FROM purchase_request_line WHERE id IN (?) AND project_id = ? FOR UPDATE", lineIDs, pid); err != nil {
		return nil, err
	}
	lines := wrapLines(rows)
	byID := map[int64]*Line{}
	for _, l := range lines {
		byID[l.ID] = l
	}
	if len(byID) != len(lineIDs) {
		return nil, apperr.NotFound("申购记录")
	}
	requests, err := loadRequests(s, uniqueRequestIDs(lines), true)
	if err != nil {
		return nil, err
	}
	for _, ref := range data.Records {
		v := ref.Version
		if err := apperr.ValidateVersion(&v, requests[byID[ref.LineID].PurchaseRequestID].Version); err != nil {
			return nil, err
		}
	}
	// 申购单头字段：选中的申购单全部改写并各自 version + 1（即使只改行字段也会 + 1）。
	selected := []int64{}
	seenReq := map[int64]bool{}
	for _, ref := range data.Records {
		rid := byID[ref.LineID].PurchaseRequestID
		if !seenReq[rid] {
			seenReq[rid] = true
			selected = append(selected, rid)
		}
	}
	for _, rid := range selected {
		r := requests[rid]
		if data.PurchaseOrderNo.Set {
			r.PurchaseOrderNo = emptyToNil(data.PurchaseOrderNo.Ptr())
		}
		if data.ContractNo.Set {
			r.ContractNo = emptyToNil(data.ContractNo.Ptr())
		}
		if data.VesselNo.Set {
			r.VesselNo = emptyToNil(data.VesselNo.Ptr())
		}
		if data.ConsolidationDate.Set {
			r.ConsolidationDate = data.ConsolidationDate.Ptr()
		}
		if data.ConsolidationPort.Set {
			r.ConsolidationPort = emptyToNil(data.ConsolidationPort.Ptr())
		}
		if data.SailingDate.Set {
			r.SailingDate = data.SailingDate.Ptr()
		}
		if data.PurchaseDate.Set {
			r.PurchaseDate = data.PurchaseDate.Ptr()
		}
		if data.RecordRemark.Set {
			r.Remark = data.RecordRemark.Ptr()
		}
		r.Version++
		if err := saveRequest(s, r); err != nil {
			return nil, err
		}
	}

	updated := make([]*Line, 0, len(data.Records))
	for _, ref := range data.Records {
		line := byID[ref.LineID]
		dirty := false
		if data.PlanDate.Set && !data.PlanDate.V.Equal(line.PlanDateSnapshot.Time) {
			if line.PlanNoSnapshot, err = material.NextPurchasePlanNo(s, data.PlanDate.V); err != nil {
				return nil, err
			}
			line.PlanDateSnapshot = data.PlanDate.V
			line.Version++
			// 立即写回，让下一条 NextPurchasePlanNo 能看到本行新快照号。
			if err := saveLine(s, &line.PurchaseRequestLine); err != nil {
				return nil, err
			}
		}
		if data.ActualDemandPerson.Set {
			line.ActualDemandPersonSnapshot = data.ActualDemandPerson.V
			line.Version++
			dirty = true
		}
		if data.PurchaseResponsible.Set {
			line.PurchaseResponsibleSnapshot = data.PurchaseResponsible.V
			line.Version++
			dirty = true
		}
		if data.Status.Set {
			line.Status = data.Status.V
			line.Version++
			dirty = true
		}
		if data.TraceNo.Set {
			line.TraceNo = emptyToNil(data.TraceNo.Ptr())
			line.Version++
			dirty = true
		}
		if data.Salesperson.Set {
			line.Salesperson = data.Salesperson.Ptr()
			line.Version++
			dirty = true
		}
		if data.ContractSignDate.Set {
			line.ContractSignDate = data.ContractSignDate.Ptr()
			line.Version++
			dirty = true
		}
		if data.UnitPrice.Set {
			line.UnitPrice = data.UnitPrice.Ptr()
			line.Version++
			dirty = true
		}
		if dirty {
			if err := saveLine(s, &line.PurchaseRequestLine); err != nil {
				return nil, err
			}
		}
		updated = append(updated, line)
	}
	ids := make([]int64, len(lines))
	for i, l := range lines {
		ids[i] = l.ID
	}
	images, err := loadLineImages(s, ids)
	if err != nil {
		return nil, err
	}
	for _, l := range lines {
		l.Request = requests[l.PurchaseRequestID]
		l.Images = images[l.ID]
		if l.Images == nil {
			l.Images = []material.Image{}
		}
	}
	return updated, nil
}

// ---------------- 退回申购计划 ----------------

// insertPlanFromLine 从记录快照重建申购计划（原计划已被定时清理时使用，保留原计划号）。
func insertPlanFromLine(s *db.Session, line *Line) (int64, error) {
	now := common.UTCNow()
	id, err := s.Insert("INSERT INTO purchase_material (plan_no, plan_date, material_code, category, urgency, demand_department, name, model_spec, unit_name, actual_demand_person, purchase_responsible, planned_qty, `usage`, subitem_no, remark, stock_material_id, status, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		line.PlanNoSnapshot, line.PlanDateSnapshot, line.MaterialCodeSnapshot, line.CategorySnapshot, "正常",
		line.DemandDepartmentSnapshot, line.MaterialNameSnapshot, line.ModelSpecSnapshot, line.UnitNameSnapshot,
		line.ActualDemandPersonSnapshot, line.PurchaseResponsibleSnapshot, line.PurchaseQty, line.Usage, line.SubitemNo,
		line.PlanRemarkSnapshot, line.StockMaterialIDSnapshot, domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal),
		line.ProjectID, now, now, 1)
	if err != nil {
		return 0, err
	}
	if len(line.Images) > 0 {
		values := make([]string, len(line.Images))
		args := make([]any, 0, len(line.Images)*4)
		for i, img := range line.Images {
			values[i] = "(?, ?, ?, ?)"
			args = append(args, id, img.FileID, img.SortOrder, line.ProjectID)
		}
		if _, err := s.Exec("INSERT INTO purchase_material_image (material_id, file_id, sort_order, project_id) VALUES "+strings.Join(values, ", "), args...); err != nil {
			return 0, err
		}
	}
	return id, nil
}

// RestorePurchaseRecordToPlan 对应 restore_purchase_record_to_plan：计划恢复为「正常」（已被清理则从快照重建），
// 申购单只剩这一行时整单删除，否则删除该行并 version + 1。
func RestorePurchaseRecordToPlan(s *db.Session, line *Line, version *int64) (*material.Purchase, error) {
	requests, err := loadRequests(s, []int64{line.PurchaseRequestID}, true)
	if err != nil {
		return nil, err
	}
	req := requests[line.PurchaseRequestID]
	if req == nil {
		return nil, apperr.NotFound("申购记录")
	}
	if err := apperr.ValidateVersion(version, req.Version); err != nil {
		return nil, err
	}
	var existing *material.Purchase
	if line.PurchaseMaterialID != nil {
		if existing, err = material.FindPurchase(s, *line.PurchaseMaterialID); err != nil {
			return nil, err
		}
	}
	var materialID int64
	if existing == nil {
		if materialID, err = insertPlanFromLine(s, line); err != nil {
			return nil, err
		}
	} else {
		materialID = existing.ID
		if _, err := s.Exec("UPDATE purchase_material SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND project_id = ?",
			domain.PurchasePlanStatus.ToDB(domain.PlanStatusNormal), common.UTCNow(), existing.ID, existing.ProjectID); err != nil {
			return nil, err
		}
	}
	var otherID int64
	other, err := s.Find(&otherID, "SELECT id FROM purchase_request_line WHERE purchase_request_id = ? AND id != ? AND project_id = ? LIMIT 1", req.ID, line.ID, req.ProjectID)
	if err != nil {
		return nil, err
	}
	if _, err := s.Exec("DELETE FROM purchase_request_line_image WHERE line_id = ? AND project_id = ?", line.ID, line.ProjectID); err != nil {
		return nil, err
	}
	if _, err := s.Exec("DELETE FROM purchase_request_line WHERE id = ? AND project_id = ?", line.ID, line.ProjectID); err != nil {
		return nil, err
	}
	if !other {
		if _, err := s.Exec("DELETE FROM purchase_request WHERE id = ? AND project_id = ?", req.ID, req.ProjectID); err != nil {
			return nil, err
		}
	} else {
		req.Version++
		if err := saveRequest(s, req); err != nil {
			return nil, err
		}
	}
	return material.GetPurchase(s, materialID)
}

// ---------------- 查询 ----------------

// PurchaseRecordSortColumns 申购记录列表可排序列白名单（sort_by → 列）。
var PurchaseRecordSortColumns = map[string]string{
	"plan_date":            "l.plan_date_snapshot",
	"category":             "l.category_snapshot",
	"demand_department":    "l.demand_department_snapshot",
	"material_name":        "l.material_name_snapshot",
	"model_spec":           "l.model_spec_snapshot",
	"material_code":        "l.material_code_snapshot",
	"actual_demand_person": "l.actual_demand_person_snapshot",
	"purchase_responsible": "l.purchase_responsible_snapshot",
	"purchase_date":        "r.purchase_date",
	"purchase_order_no":    "r.purchase_order_no",
	"contract_no":          "r.contract_no",
	"vessel_no":            "r.vessel_no",
	"consolidation_date":   "r.consolidation_date",
	"consolidation_port":   "r.consolidation_port",
	"sailing_date":         "r.sailing_date",
	"trace_no":             "l.trace_no",
	"contract_sign_date":   "l.contract_sign_date",
	"unit_price":           "l.unit_price",
	"purchase_qty":         "l.purchase_qty",
	"usage":                "l.`usage`",
	"subitem_no":           "l.subitem_no",
	"salesperson":          "l.salesperson",
	"status":               "l.status",
}

func castText(col string) string { return "CAST(" + col + " AS VARCHAR)" }

// PurchaseRecordSearchColumns search_field → 列表达式。
var PurchaseRecordSearchColumns = map[string]string{
	"plan_no":            "l.plan_no_snapshot",
	"plan_date":          castText("l.plan_date_snapshot"),
	"purchase_order_no":  "r.purchase_order_no",
	"trace_no":           "l.trace_no",
	"contract_no":        "r.contract_no",
	"vessel_no":          "r.vessel_no",
	"consolidation_date": castText("r.consolidation_date"),
	"consolidation_port": "r.consolidation_port",
	"sailing_date":       castText("r.sailing_date"),
	"contract_sign_date": castText("l.contract_sign_date"),
	"unit_price":         castText("l.unit_price"),
	"category":           "l.category_snapshot",
	"material_code":      "l.material_code_snapshot",
	"material_name":      "l.material_name_snapshot",
	"model_spec":         "l.model_spec_snapshot",
	"unit_name":          "l.unit_name_snapshot",
	"purchase_qty":       castText("l.purchase_qty"),
	"salesperson":        "l.salesperson",
	"status":             "l.status",
	"purchase_date":      castText("r.purchase_date"),
	"usage":              "l.`usage`",
	"subitem_no":         "l.subitem_no",
	"plan_remark":        "l.plan_remark_snapshot",
	"record_remark":      "r.remark",
}

var recordKeywordColumns = []string{
	"r.purchase_order_no", "l.trace_no", "r.contract_no", "r.vessel_no", castText("r.consolidation_date"),
	"r.consolidation_port", castText("r.sailing_date"), castText("l.contract_sign_date"), castText("l.unit_price"),
	"l.salesperson", "r.remark", "l.plan_no_snapshot", castText("l.plan_date_snapshot"), "l.status",
	"l.material_code_snapshot", "l.category_snapshot", "l.material_name_snapshot", "l.model_spec_snapshot",
	"l.unit_name_snapshot", castText("l.purchase_qty"), "l.`usage`", "l.subitem_no", "l.actual_demand_person_snapshot",
	"l.purchase_responsible_snapshot", "l.plan_remark_snapshot", castText("r.purchase_date"),
}

const recordFrom = " FROM purchase_request_line l JOIN purchase_request r ON r.id = l.purchase_request_id"

func pyStrip(v string) string { return strings.TrimFunc(v, common.PyIsSpace) }

func recordScope(s *db.Session) (*common.Where, error) {
	w := &common.Where{}
	if err := w.Scope(s, "l."); err != nil {
		return nil, err
	}
	if err := w.Scope(s, "r."); err != nil {
		return nil, err
	}
	return w, nil
}

// RecordSearch 是 search_purchase_records 的参数。
type RecordSearch struct {
	Status              *string
	EmptyStatus         bool
	Keyword             *string
	SearchField         *string
	SearchValue         *string
	PurchaseOrderNo     *string
	TraceNo             *string
	Category            *string
	Name                *string
	ModelSpec           *string
	Usage               *string
	ActualDemandPerson  *string
	PurchaseResponsible *string
	Salesperson         *string
	SubitemNo           *string
	EmptySubitemNo      bool
	Page                int64
	PageSize            int64
	SortBy              *string
	SortOrder           string // "asc"（默认）/ "desc"
}

func nonEmpty(p *string) bool { return p != nil && *p != "" }

// SearchPurchaseRecords 对应 search_purchase_records。
func SearchPurchaseRecords(s *db.Session, q RecordSearch) ([]*Line, int64, error) {
	w, err := recordScope(s)
	if err != nil {
		return nil, 0, err
	}
	if q.EmptyStatus {
		w.Add("(l.status IS NULL OR TRIM(l.status) = ?)", "")
	} else if nonEmpty(q.Status) {
		w.Add("l.status = ?", *q.Status)
	}
	w.ContainsAny(recordKeywordColumns, q.Keyword)
	if nonEmpty(q.SearchField) && nonEmpty(q.SearchValue) {
		col, ok := PurchaseRecordSearchColumns[*q.SearchField]
		if !ok {
			return nil, 0, fmt.Errorf("unknown purchase record search field %q", *q.SearchField)
		}
		w.ContainsAny([]string{col}, q.SearchValue)
	}
	if nonEmpty(q.Category) {
		w.Add("TRIM(l.category_snapshot) = ?", pyStrip(*q.Category))
	}
	if q.EmptySubitemNo {
		w.Add("(l.subitem_no IS NULL OR TRIM(l.subitem_no) = ?)", "")
	} else if nonEmpty(q.SubitemNo) {
		w.Add("TRIM(l.subitem_no) = ?", pyStrip(*q.SubitemNo))
	}
	w.ContainsAny([]string{"r.purchase_order_no"}, q.PurchaseOrderNo)
	w.ContainsAny([]string{"l.trace_no"}, q.TraceNo)
	w.ContainsAny([]string{"l.material_name_snapshot"}, q.Name)
	w.ContainsAny([]string{"l.model_spec_snapshot"}, q.ModelSpec)
	w.ContainsAny([]string{"l.`usage`"}, q.Usage)
	w.ContainsAny([]string{"l.actual_demand_person_snapshot"}, q.ActualDemandPerson)
	w.ContainsAny([]string{"l.purchase_responsible_snapshot"}, q.PurchaseResponsible)
	w.ContainsAny([]string{"l.salesperson"}, q.Salesperson)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*)"+recordFrom+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var order string
	if col, ok := PurchaseRecordSortColumns[derefStr(q.SortBy)]; ok && nonEmpty(q.SortBy) {
		dir := "ASC"
		if q.SortOrder != "" && q.SortOrder != "asc" {
			dir = "DESC"
		}
		order = col + " " + dir + ", l.id DESC"
	} else {
		order = "(r.purchase_order_no IS NULL OR TRIM(r.purchase_order_no) = ''), r.purchase_order_no DESC, " +
			"(l.trace_no IS NULL OR TRIM(l.trace_no) = ''), l.trace_no DESC, l.id DESC"
	}
	args := append(append([]any{}, w.Args...), q.PageSize, common.Offset(q.Page, q.PageSize))
	var rows []model.PurchaseRequestLine
	if err := s.Select(&rows, "SELECT "+model.Prefixed("l", model.ColsPurchaseRequestLine)+recordFrom+w.SQL()+" ORDER BY "+order+" LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	lines := wrapLines(rows)
	if err := LoadLineRelations(s, lines); err != nil {
		return nil, 0, err
	}
	return lines, total, nil
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// SearchMiniProgramPurchaseRecords 对应 search_mini_program_purchase_records：keyword 仅 OR 匹配
// 名称 / 型号 / 追溯号 / 申购单号；按行 id 倒序。
func SearchMiniProgramPurchaseRecords(s *db.Session, keyword, status, subitemNo *string, page, pageSize int64) ([]*Line, int64, error) {
	w, err := recordScope(s)
	if err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"l.material_name_snapshot", "l.model_spec_snapshot", "l.trace_no", "r.purchase_order_no"}, keyword)
	if nonEmpty(status) {
		w.Add("TRIM(l.status) = ?", pyStrip(*status))
	}
	if nonEmpty(subitemNo) {
		w.Add("TRIM(l.subitem_no) = ?", pyStrip(*subitemNo))
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*)"+recordFrom+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	var rows []model.PurchaseRequestLine
	if err := s.Select(&rows, "SELECT "+model.Prefixed("l", model.ColsPurchaseRequestLine)+recordFrom+w.SQL()+" ORDER BY l.id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	lines := wrapLines(rows)
	if err := LoadLineRelations(s, lines); err != nil {
		return nil, 0, err
	}
	return lines, total, nil
}

// distinctLineValues SELECT DISTINCT col FROM purchase_request_line WHERE cond AND scope ORDER BY col（去掉 NULL）。
func distinctLineValues(s *db.Session, col, cond string, condArgs ...any) ([]string, error) {
	w := common.Where{}
	w.Add(cond, condArgs...)
	if err := w.Scope(s, ""); err != nil {
		return nil, err
	}
	var vals []*string
	if err := s.Select(&vals, "SELECT DISTINCT "+col+" FROM purchase_request_line"+w.SQL()+" ORDER BY "+col, w.Args...); err != nil {
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

// PurchaseSalespersonOptions 对应 purchase_salesperson_options。
func PurchaseSalespersonOptions(s *db.Session) ([]string, error) {
	return distinctLineValues(s, "salesperson", "salesperson IS NOT NULL AND TRIM(salesperson) != ?", "")
}

// PurchaseStatusOptions 对应 purchase_status_options。
func PurchaseStatusOptions(s *db.Session) ([]string, error) {
	return distinctLineValues(s, "status", "status IS NOT NULL AND TRIM(status) != ?", "")
}

// PurchaseSubitemOptions 对应 purchase_subitem_options。
func PurchaseSubitemOptions(s *db.Session) ([]string, error) {
	return distinctLineValues(s, "subitem_no", "subitem_no IS NOT NULL AND TRIM(subitem_no) != ?", "")
}

var emptyPersonValues = []any{"", "\\", "/", "—", "-"}

// PurchaseRecordFilterOptions 对应 purchase_record_filter_options：（实际需求人, 采购负责人, 子项号, 分类）。
func PurchaseRecordFilterOptions(s *db.Session) (actualDemandPersons, purchaseResponsibles, subitemNos, categories []string, err error) {
	if actualDemandPersons, err = distinctLineValues(s, "actual_demand_person_snapshot", "TRIM(actual_demand_person_snapshot) NOT IN (?, ?, ?, ?, ?)", emptyPersonValues...); err != nil {
		return
	}
	if purchaseResponsibles, err = distinctLineValues(s, "purchase_responsible_snapshot", "TRIM(purchase_responsible_snapshot) != ?", ""); err != nil {
		return
	}
	if subitemNos, err = PurchaseSubitemOptions(s); err != nil {
		return
	}
	categories, err = distinctLineValues(s, "category_snapshot", "category_snapshot IS NOT NULL AND TRIM(category_snapshot) != ?", "")
	return
}

// QuantityText 对应 api 层 _quantity_text：format(value, "f").rstrip("0").rstrip(".") or "0"。
func QuantityText(v jtype.Decimal) string {
	var s string
	if exp := v.Exponent(); exp < 0 {
		s = v.StringFixed(-exp)
	} else {
		s = v.Decimal.String()
	}
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" {
		return "0"
	}
	return s
}
