// Package recordsync 对应原 services/purchase_record_sync_service.py：申购记录同步（外部物资平台数据回写）。
//
// 只暴露「待同步目标列表」与「按追溯号 / 整单回写」几个窄操作，不允许任意 SQL。语义：文本字段仅当空才填、
// 日期仅当 NULL 才填、状态只进不退，且只在实际变更时自增 version（updated_at 同步更新）。
package recordsync

import (
	"sort"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/purchaserequest"
)

// statusProgression 状态只进不退：目标状态 → 允许的当前状态集合（不在集合里的目标值不生效）。
var statusProgression = map[string]map[string]bool{
	"已入库":  {"已申购": true, "已采购": true, "部分入库": true, "已入库": true},
	"部分入库": {"已申购": true, "已采购": true, "部分入库": true},
	"已采购":  {"已申购": true, "已采购": true},
}

var syncFields = map[string]bool{
	"salesperson": true, "contract_no": true, "vessel_no": true, "consolidation_port": true,
	"consolidation_date": true, "sailing_date": true, "contract_sign_date": true, "unit_price": true, "status": true,
}

// syncFieldConditions 各同步字段「待补全」的条件（按 Python 字典顺序）。
var syncFieldConditions = []struct {
	key  string
	cond string
}{
	{"salesperson", "(l.salesperson IS NULL OR TRIM(l.salesperson) = '')"},
	{"contract_no", "(r.contract_no IS NULL OR TRIM(r.contract_no) = '')"},
	{"vessel_no", "(r.vessel_no IS NULL OR TRIM(r.vessel_no) = '')"},
	{"consolidation_date", "r.consolidation_date IS NULL"},
	{"consolidation_port", "(r.consolidation_port IS NULL OR TRIM(r.consolidation_port) = '')"},
	{"sailing_date", "r.sailing_date IS NULL"},
	{"contract_sign_date", "l.contract_sign_date IS NULL"},
	{"unit_price", "l.unit_price IS NULL"},
}

func pyStrip(v string) string { return strings.TrimFunc(v, common.PyIsSpace) }

func isBlank(v *string) bool { return v == nil || pyStrip(*v) == "" }

// resolveActiveFields 把逗号分隔的 fields 参数解析成白名单子集；空 / nil 表示全部字段（返回 nil）。
func resolveActiveFields(fields *string) (map[string]bool, error) {
	if fields == nil || *fields == "" {
		return nil, nil
	}
	parsed := map[string]bool{}
	for _, part := range strings.Split(*fields, ",") {
		if p := pyStrip(part); p != "" {
			parsed[p] = true
		}
	}
	unknown := []string{}
	for k := range parsed {
		if !syncFields[k] {
			unknown = append(unknown, k)
		}
	}
	if len(unknown) > 0 {
		sort.Strings(unknown)
		return nil, apperr.New("VALIDATION_ERROR", "未知同步字段: "+strings.Join(unknown, ", ")).WithStatus(422)
	}
	return parsed, nil
}

// resolveOrderNoCutoff 校验并归一化申购单号区间端点；空值表示该侧不限。
func resolveOrderNoCutoff(value *string, label string) (*string, error) {
	if value == nil || *value == "" {
		return nil, nil
	}
	cutoff := pyStrip(*value)
	if len([]rune(cutoff)) > 128 {
		return nil, apperr.New("VALIDATION_ERROR", label+"过长").WithStatus(422)
	}
	return &cutoff, nil
}

// targetConditions 构造「存在待补全同步字段或未完成状态」的 OR 条件（无字段时返回空串）。
func targetConditions(active map[string]bool) string {
	parts := []string{}
	for _, c := range syncFieldConditions {
		if active == nil || active[c.key] {
			parts = append(parts, c.cond)
		}
	}
	if active == nil || active["status"] {
		parts = append(parts, "l.status IN ('已申购', '已采购', '部分入库')")
	}
	if len(parts) == 0 {
		return ""
	}
	return "(" + strings.Join(parts, " OR ") + ")"
}

const syncFrom = " FROM purchase_request_line l JOIN purchase_request r ON r.id = l.purchase_request_id"

// TargetQuery 是同步目标列表的参数。
type TargetQuery struct {
	Limit              int64
	Cursor             int64
	Fields             *string
	MinPurchaseOrderNo *string
	MaxPurchaseOrderNo *string
}

func baseWhere(s *db.Session, q TargetQuery, orderGroup bool) (*common.Where, error) {
	active, err := resolveActiveFields(q.Fields)
	if err != nil {
		return nil, err
	}
	minCut, err := resolveOrderNoCutoff(q.MinPurchaseOrderNo, "申购单号起始值")
	if err != nil {
		return nil, err
	}
	maxCut, err := resolveOrderNoCutoff(q.MaxPurchaseOrderNo, "申购单号上限值")
	if err != nil {
		return nil, err
	}
	w := &common.Where{}
	w.Add("l.trace_no IS NOT NULL")
	w.Add("TRIM(l.trace_no) != ?", "")
	orderExpr := "TRIM(r.purchase_order_no)"
	if orderGroup {
		orderExpr = "COALESCE(TRIM(r.purchase_order_no), '')"
		w.Add(orderExpr+" != ?", "")
	}
	w.Add(targetConditions(active))
	if minCut != nil {
		w.Add(orderExpr+" >= ?", *minCut)
	}
	if maxCut != nil {
		w.Add(orderExpr+" < ?", *maxCut)
	}
	if q.Cursor != 0 {
		w.Add("l.id < ?", q.Cursor)
	}
	if err := w.Scope(s, "l."); err != nil {
		return nil, err
	}
	if err := w.Scope(s, "r."); err != nil {
		return nil, err
	}
	return w, nil
}

// ListSyncTargets 对应 list_sync_targets：按追溯号分组的待同步目标。
func ListSyncTargets(s *db.Session, q TargetQuery) (schema.PurchaseRecordSyncTargetsRead, error) {
	w, err := baseWhere(s, q, false)
	if err != nil {
		return schema.PurchaseRecordSyncTargetsRead{}, err
	}
	type row struct {
		TraceNo     string `db:"trace_no"`
		TargetCount int64  `db:"target_count"`
		CursorID    int64  `db:"cursor_id"`
	}
	var rows []row
	args := append(append([]any{}, w.Args...), q.Limit+1)
	if err := s.Select(&rows, "SELECT l.trace_no AS trace_no, COUNT(*) AS target_count, MAX(l.id) AS cursor_id"+syncFrom+w.SQL()+
		" GROUP BY l.trace_no ORDER BY MAX(l.id) DESC, l.trace_no LIMIT ?", args...); err != nil {
		return schema.PurchaseRecordSyncTargetsRead{}, err
	}
	hasMore := int64(len(rows)) > q.Limit
	if hasMore {
		rows = rows[:q.Limit]
	}
	items := make([]schema.PurchaseRecordSyncTargetRead, len(rows))
	for i, r := range rows {
		items[i] = schema.PurchaseRecordSyncTargetRead{TraceNo: r.TraceNo, TargetCount: r.TargetCount, CursorID: r.CursorID}
	}
	var next int64
	if len(items) > 0 {
		next = items[len(items)-1].CursorID
	}
	return schema.PurchaseRecordSyncTargetsRead{Items: items, HasMore: hasMore, NextCursor: next}, nil
}

// ListSyncOrderTargets 对应 list_sync_order_targets：按申购单号分组，每组附带该单下全部待同步追溯号（去重保序）。
func ListSyncOrderTargets(s *db.Session, q TargetQuery) (schema.PurchaseRecordSyncOrderTargetsRead, error) {
	w, err := baseWhere(s, q, true)
	if err != nil {
		return schema.PurchaseRecordSyncOrderTargetsRead{}, err
	}
	type group struct {
		OrderNo  *string `db:"purchase_order_no"`
		CursorID int64   `db:"cursor_id"`
	}
	var groups []group
	args := append(append([]any{}, w.Args...), q.Limit+1)
	if err := s.Select(&groups, "SELECT r.purchase_order_no AS purchase_order_no, MAX(l.id) AS cursor_id"+syncFrom+w.SQL()+
		" GROUP BY r.purchase_order_no ORDER BY MAX(l.id) DESC, r.purchase_order_no LIMIT ?", args...); err != nil {
		return schema.PurchaseRecordSyncOrderTargetsRead{}, err
	}
	out := schema.PurchaseRecordSyncOrderTargetsRead{Items: []schema.PurchaseRecordSyncOrderTargetRead{}}
	if len(groups) == 0 {
		return out, nil
	}
	orderNos := make([]any, 0, len(groups))
	traces := map[string][]string{}
	for _, g := range groups {
		key := derefStr(g.OrderNo)
		orderNos = append(orderNos, key)
		traces[key] = []string{}
	}
	type detail struct {
		OrderNo *string `db:"purchase_order_no"`
		TraceNo *string `db:"trace_no"`
	}
	var details []detail
	dargs := append(append([]any{}, w.Args...), orderNos...)
	if err := s.Select(&details, "SELECT r.purchase_order_no AS purchase_order_no, l.trace_no AS trace_no"+syncFrom+w.SQL()+
		" AND r.purchase_order_no IN ("+common.Placeholders(len(orderNos))+") ORDER BY r.purchase_order_no, l.id", dargs...); err != nil {
		return out, err
	}
	for _, d := range details {
		key := derefStr(d.OrderNo)
		trace := pyStrip(derefStr(d.TraceNo))
		if trace == "" || contains(traces[key], trace) {
			continue
		}
		traces[key] = append(traces[key], trace)
	}
	hasMore := int64(len(groups)) > q.Limit
	if hasMore {
		groups = groups[:q.Limit]
	}
	for _, g := range groups {
		key := derefStr(g.OrderNo)
		out.Items = append(out.Items, schema.PurchaseRecordSyncOrderTargetRead{PurchaseOrderNo: key, TraceNos: traces[key], CursorID: g.CursorID})
	}
	out.HasMore = hasMore
	if len(out.Items) > 0 {
		out.NextCursor = out.Items[len(out.Items)-1].CursorID
	}
	return out, nil
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func contains(items []string, s string) bool {
	for _, it := range items {
		if it == s {
			return true
		}
	}
	return false
}

// applyMutation 按同步规则把 data 落到 request / line，返回 (affected_headers, affected_lines)。
func applyMutation(s *db.Session, data schema.PurchaseRecordSyncTraceUpdate, requests map[int64]*model.PurchaseRequest, lines []*model.PurchaseRequestLine) (int64, int64, error) {
	var headers, linesChanged int64
	touched := map[int64]bool{}
	for _, line := range lines {
		req := requests[line.PurchaseRequestID]
		if req == nil {
			continue
		}
		if !touched[req.ID] {
			touched[req.ID] = true
			changed := false
			for _, f := range []struct {
				value  *string
				target **string
			}{
				{data.ContractNo, &req.ContractNo},
				{data.VesselNo, &req.VesselNo},
				{data.ConsolidationPort, &req.ConsolidationPort},
			} {
				if f.value == nil || isBlank(f.value) || !isBlank(*f.target) {
					continue
				}
				v := pyStrip(*f.value)
				*f.target = &v
				changed = true
			}
			if data.ConsolidationDate != nil && req.ConsolidationDate == nil {
				v := *data.ConsolidationDate
				req.ConsolidationDate = &v
				changed = true
			}
			if data.SailingDate != nil && req.SailingDate == nil {
				v := *data.SailingDate
				req.SailingDate = &v
				changed = true
			}
			if changed {
				req.Version++
				headers++
				if err := purchaserequest.SaveRequest(s, req); err != nil {
					return 0, 0, err
				}
			}
		}
		changed := false
		if data.Salesperson != nil && !isBlank(data.Salesperson) && isBlank(line.Salesperson) {
			v := pyStrip(*data.Salesperson)
			line.Salesperson = &v
			changed = true
		}
		// 合同签订日期是物资级字段（行级），同样只补空值，不覆盖人工填写。
		if data.ContractSignDate != nil && line.ContractSignDate == nil {
			v := *data.ContractSignDate
			line.ContractSignDate = &v
			changed = true
		}
		// 采购单价同为物资级字段（行级）：只补空值，人工填写过的价格不会被平台覆盖。
		if data.UnitPrice != nil && line.UnitPrice == nil {
			v := *data.UnitPrice
			line.UnitPrice = &v
			changed = true
		}
		if data.Status != nil && !isBlank(data.Status) {
			target := pyStrip(*data.Status)
			if line.Status != target && statusProgression[target][line.Status] {
				line.Status = target
				changed = true
			}
		}
		if changed {
			line.Version++
			linesChanged++
			if err := purchaserequest.SaveLine(s, line); err != nil {
				return 0, 0, err
			}
		}
	}
	return headers, linesChanged, nil
}

func lockRequests(s *db.Session, ids []int64) (map[int64]*model.PurchaseRequest, error) {
	out := map[int64]*model.PurchaseRequest{}
	if len(ids) == 0 {
		return out, nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var rows []model.PurchaseRequest
	if err := s.SelectIn(&rows, "SELECT "+model.ColsPurchaseRequest+" FROM purchase_request WHERE id IN (?) AND project_id = ? FOR UPDATE", ids, pid); err != nil {
		return nil, err
	}
	for i := range rows {
		out[rows[i].ID] = &rows[i]
	}
	return out, nil
}

func linePtrs(rows []model.PurchaseRequestLine) []*model.PurchaseRequestLine {
	out := make([]*model.PurchaseRequestLine, len(rows))
	for i := range rows {
		out[i] = &rows[i]
	}
	return out
}

func requestIDs(lines []*model.PurchaseRequestLine) []int64 {
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

// ApplyTraceSync 对应 apply_trace_sync：按追溯号回写。
func ApplyTraceSync(s *db.Session, traceNo string, data schema.PurchaseRecordSyncTraceUpdate) (schema.PurchaseRecordSyncResultRead, error) {
	trace := pyStrip(traceNo)
	if trace == "" {
		return schema.PurchaseRecordSyncResultRead{}, apperr.New("VALIDATION_ERROR", "追溯号不能为空").WithStatus(422)
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.PurchaseRecordSyncResultRead{}, err
	}
	var rows []model.PurchaseRequestLine
	if err := s.Select(&rows, "SELECT "+model.ColsPurchaseRequestLine+" FROM purchase_request_line WHERE trace_no = ? AND project_id = ? ORDER BY id FOR UPDATE", trace, pid); err != nil {
		return schema.PurchaseRecordSyncResultRead{}, err
	}
	if len(rows) == 0 {
		return schema.PurchaseRecordSyncResultRead{}, apperr.NotFound("该追溯号的申购记录")
	}
	lines := linePtrs(rows)
	requests, err := lockRequests(s, requestIDs(lines))
	if err != nil {
		return schema.PurchaseRecordSyncResultRead{}, err
	}
	headers, changed, err := applyMutation(s, data, requests, lines)
	if err != nil {
		return schema.PurchaseRecordSyncResultRead{}, err
	}
	return schema.PurchaseRecordSyncResultRead{AffectedHeaders: headers, AffectedLines: changed}, nil
}

// ApplyOrderSync 对应 apply_order_sync：整单批量回写；某追溯号在该申购单下不存在时只计入 not_found。
func ApplyOrderSync(s *db.Session, purchaseOrderNo string, data schema.PurchaseRecordSyncOrderApply) (schema.PurchaseRecordSyncOrderApplyRead, error) {
	var out schema.PurchaseRecordSyncOrderApplyRead
	po := pyStrip(purchaseOrderNo)
	if po == "" {
		return out, apperr.New("VALIDATION_ERROR", "申购单号不能为空").WithStatus(422)
	}
	pid, err := s.ProjectID()
	if err != nil {
		return out, err
	}
	var reqRows []model.PurchaseRequest
	if err := s.Select(&reqRows, "SELECT "+model.ColsPurchaseRequest+" FROM purchase_request WHERE COALESCE(TRIM(purchase_order_no), '') = ? AND project_id = ? FOR UPDATE", po, pid); err != nil {
		return out, err
	}
	if len(reqRows) == 0 {
		return out, apperr.NotFound("该申购单的申购记录")
	}
	requests := map[int64]*model.PurchaseRequest{}
	ids := make([]int64, len(reqRows))
	for i := range reqRows {
		requests[reqRows[i].ID] = &reqRows[i]
		ids[i] = reqRows[i].ID
	}
	var lineRows []model.PurchaseRequestLine
	if err := s.SelectIn(&lineRows, "SELECT "+model.ColsPurchaseRequestLine+" FROM purchase_request_line WHERE purchase_request_id IN (?) AND project_id = ? ORDER BY id FOR UPDATE", ids, pid); err != nil {
		return out, err
	}
	if len(lineRows) == 0 {
		return out, apperr.NotFound("该申购单的申购记录")
	}
	lines := linePtrs(lineRows)
	for _, item := range data.Items {
		trace := pyStrip(item.TraceNo)
		matched := []*model.PurchaseRequestLine{}
		for _, l := range lines {
			if pyStrip(derefStr(l.TraceNo)) == trace {
				matched = append(matched, l)
			}
		}
		if len(matched) == 0 {
			out.NotFound++
			continue
		}
		out.Applied++
		h, c, err := applyMutation(s, item.Update(), requests, matched)
		if err != nil {
			return out, err
		}
		out.AffectedHeaders += h
		out.AffectedLines += c
	}
	return out, nil
}
