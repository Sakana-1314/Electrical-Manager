// Package inventory 对应原 services/inventory_service.py + repositories/inventory_repository.py：
// 出入库流水、冲销、历史回放、库存余额与近期消耗。
package inventory

import (
	"fmt"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
)

var zero = jtype.Decimal{Decimal: decimal.Zero}

// Operation 是带流水行（按 id 排序；修改后为请求顺序）的出入库流水。
type Operation struct {
	model.StockOperation
	Lines []*model.StockOperationLine
}

// ---------------- 通用 ----------------

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

func prefixCols(cols, alias string) string {
	parts := strings.Split(cols, ",")
	for i, p := range parts {
		name := strings.Trim(strings.TrimSpace(p), "`\"")
		parts[i] = alias + "`" + name + "`"
	}
	return strings.Join(parts, ", ")
}

// pyDecStr 等价 Python str(Decimal)：保留原始小数位。
func pyDecStr(d jtype.Decimal) string {
	if exp := d.Exponent(); exp < 0 {
		return d.StringFixed(-exp)
	}
	return d.Decimal.String()
}

// pyISO 等价 naive datetime.isoformat()。
func pyISO(t time.Time) string {
	base := t.Format("2006-01-02T15:04:05")
	if us := t.Nanosecond() / 1000; us != 0 {
		base += fmt.Sprintf(".%06d", us)
	}
	return base
}

func strPtrEmpty(p *string) bool { return p == nil || *p == "" }

// ---------------- 读取 ----------------

func loadLines(s *db.Session, ops []*Operation) error {
	if len(ops) == 0 {
		return nil
	}
	ids := make([]int64, len(ops))
	for i, op := range ops {
		ids[i] = op.ID
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return err
	}
	var lines []model.StockOperationLine
	if err := s.SelectIn(&lines, "SELECT "+model.ColsStockOperationLine+" FROM stock_operation_line WHERE operation_id IN (?)"+scope+" ORDER BY id", append([]any{ids}, sargs...)...); err != nil {
		return err
	}
	byOp := map[int64][]*model.StockOperationLine{}
	for i := range lines {
		byOp[lines[i].OperationID] = append(byOp[lines[i].OperationID], &lines[i])
	}
	for _, op := range ops {
		op.Lines = byOp[op.ID]
		if op.Lines == nil {
			op.Lines = []*model.StockOperationLine{}
		}
	}
	return nil
}

func findOperation(s *db.Session, where string, forUpdate bool, args ...any) (*Operation, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	q := "SELECT " + model.ColsStockOperation + " FROM stock_operation WHERE " + where + scope
	if forUpdate {
		q += " FOR UPDATE"
	}
	var m model.StockOperation
	ok, err := s.Find(&m, q, append(args, sargs...)...)
	if err != nil || !ok {
		return nil, err
	}
	op := &Operation{StockOperation: m}
	if err := loadLines(s, []*Operation{op}); err != nil {
		return nil, err
	}
	return op, nil
}

// GetOperation 对应 get_operation：不存在报 NOT_FOUND「库存流水不存在」。
func GetOperation(s *db.Session, operationID int64, forUpdate bool) (*Operation, error) {
	op, err := findOperation(s, "id = ?", forUpdate, operationID)
	if err != nil {
		return nil, err
	}
	if op == nil {
		return nil, apperr.NotFound("库存流水")
	}
	return op, nil
}

func findByClientRequestID(s *db.Session, clientRequestID string, forUpdate bool) (*Operation, error) {
	return findOperation(s, "client_request_id = ?", forUpdate, clientRequestID)
}

// SourceTypeOf 业务读路径的来源判定（common.operation_source_type）。
func SourceTypeOf(op *model.StockOperation) string { return common.OperationSourceType(op) }

// OperationRead 对应 operation_read。
func OperationRead(op *Operation) schema.StockOperationRead {
	lines := make([]schema.StockOperationLineRead, len(op.Lines))
	for i, l := range op.Lines {
		lines[i] = schema.StockOperationLineRead{
			ID: l.ID, StockMaterialID: l.StockMaterialID, MaterialName: l.MaterialNameSnapshot,
			ModelSpec: l.ModelSpecSnapshot, UnitName: l.UnitNameSnapshot, Quantity: l.Quantity,
			RemainingQty: l.RemainingQty, BeforeQty: l.BeforeQty, AfterQty: l.AfterQty,
		}
	}
	return schema.StockOperationRead{
		ID: op.ID, OperationNo: op.OperationNo, OperationType: op.OperationType,
		OccurredAt: schema.NewAwareTime(op.OccurredAt), BusinessReason: op.BusinessReason,
		ReceiverUnit: op.ReceiverUnit, ReceiverName: op.ReceiverName, SubitemNo: op.SubitemNo,
		SourceType: SourceTypeOf(&op.StockOperation), ReversalOfID: op.ReversalOfID, IsReversed: op.ReversalOfID != nil,
		ClientRequestID: op.ClientRequestID, MiniProgramUserName: op.MiniProgramUserNameSnapshot,
		Lines: lines, CreatedAt: schema.NewAwareTime(op.CreatedAt), Version: op.Version,
	}
}

type snapshotLine struct {
	StockMaterialID int64  `json:"stock_material_id"`
	Quantity        string `json:"quantity"`
}

type operationSnapshot struct {
	OperationType       string         `json:"operation_type"`
	OccurredAt          string         `json:"occurred_at"`
	SourceType          string         `json:"source_type"`
	BusinessReason      string         `json:"business_reason"`
	ReceiverUnit        *string        `json:"receiver_unit"`
	ReceiverName        *string        `json:"receiver_name"`
	SubitemNo           *string        `json:"subitem_no"`
	MiniProgramUserName *string        `json:"mini_program_user_name"`
	Lines               []snapshotLine `json:"lines"`
}

func snapshot(op *Operation) operationSnapshot {
	lines := make([]snapshotLine, len(op.Lines))
	for i, l := range op.Lines {
		lines[i] = snapshotLine{StockMaterialID: l.StockMaterialID, Quantity: pyDecStr(l.Quantity)}
	}
	return operationSnapshot{
		OperationType: op.OperationType, OccurredAt: pyISO(op.OccurredAt), SourceType: SourceTypeOf(&op.StockOperation),
		BusinessReason: op.BusinessReason, ReceiverUnit: op.ReceiverUnit, ReceiverName: op.ReceiverName,
		SubitemNo: op.SubitemNo, MiniProgramUserName: op.MiniProgramUserNameSnapshot, Lines: lines,
	}
}

// ---------------- 校验 / 锁 ----------------

func lockAndValidateMaterials(s *db.Session, lines []schema.OperationLineWrite, additional []int64) (map[int64]*model.StockMaterial, []int64, error) {
	set := map[int64]bool{}
	for _, l := range lines {
		set[l.StockMaterialID] = true
	}
	for _, id := range additional {
		set[id] = true
	}
	ids := make([]int64, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sortInt64(ids)
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, nil, err
	}
	var balances []model.StockBalance
	if err := s.SelectIn(&balances, "SELECT "+model.ColsStockBalance+" FROM stock_balance WHERE stock_material_id IN (?)"+scope+" ORDER BY stock_material_id FOR UPDATE", append([]any{ids}, sargs...)...); err != nil {
		return nil, nil, err
	}
	if len(balances) != len(ids) {
		return nil, nil, apperr.New("BALANCE_MISSING", "库存余额记录不存在").WithStatus(409)
	}
	var materials []model.StockMaterial
	if err := s.SelectIn(&materials, "SELECT "+model.ColsStockMaterial+" FROM stock_material WHERE id IN (?)"+scope+" ORDER BY id FOR UPDATE", append([]any{ids}, sargs...)...); err != nil {
		return nil, nil, err
	}
	byID := map[int64]*model.StockMaterial{}
	for i := range materials {
		byID[materials[i].ID] = &materials[i]
	}
	missing := []int64{}
	for _, id := range ids {
		if _, ok := byID[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		return nil, nil, apperr.New("NOT_FOUND", "二级库物资不存在").WithDetails(apperr.D{"ids": missing})
	}
	for _, l := range lines {
		if err := common.ValidateQuantityPrecision(l.Quantity); err != nil {
			return nil, nil, err
		}
	}
	return byID, ids, nil
}

func sortInt64(a []int64) {
	for i := 1; i < len(a); i++ {
		for j := i; j > 0 && a[j] < a[j-1]; j-- {
			a[j], a[j-1] = a[j-1], a[j]
		}
	}
}

func validateSemantics(operationType, sourceType string, receiverUnit, receiverName *string) error {
	if sourceType == domain.SourceInitialization && operationType != domain.OperationInbound {
		return apperr.New("INVALID_SOURCE_TYPE", "初始化业务只能是入库")
	}
	if sourceType == domain.SourceMiniProgram && operationType != domain.OperationOutbound {
		return apperr.New("INVALID_SOURCE_TYPE", "小程序来源只能是出库")
	}
	if operationType == domain.OperationInbound && !strPtrEmpty(receiverName) {
		return apperr.New("INVALID_RECEIVER", "只有出库业务可以填写领用人")
	}
	if operationType == domain.OperationInbound && !strPtrEmpty(receiverUnit) {
		return apperr.New("INVALID_RECEIVER_UNIT", "只有出库业务可以填写领用单位")
	}
	if operationType == domain.OperationOutbound && sourceType != domain.SourceReversal && strPtrEmpty(receiverName) {
		return apperr.New("RECEIVER_REQUIRED", "出库必须填写领用人")
	}
	return nil
}

// ---------------- 回放 ----------------

// replayMaterials 对应 replay_materials：按（发生时间, 流水 id, 行 id）重算各行前后数量并写回余额。
// inMemory 是本次请求刚写入 / 修改的行（与 SQLAlchemy identity map 一致：回放用内存中的数量值）。
func replayMaterials(s *db.Session, materialIDs []int64, inMemory map[int64]*model.StockOperationLine) error {
	set := map[int64]bool{}
	for _, id := range materialIDs {
		set[id] = true
	}
	ids := make([]int64, 0, len(set))
	for id := range set {
		ids = append(ids, id)
	}
	sortInt64(ids)
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	type row struct {
		model.StockOperationLine
		OpType string `db:"op_operation_type"`
	}
	for _, materialID := range ids {
		var balance model.StockBalance
		ok, err := s.Find(&balance, "SELECT "+model.ColsStockBalance+" FROM stock_balance WHERE stock_material_id = ? AND project_id = ? FOR UPDATE", materialID, pid)
		if err != nil {
			return err
		}
		if !ok {
			return apperr.New("BALANCE_MISSING", "库存余额记录不存在").WithStatus(409)
		}
		var rows []row
		// 锁读：读取最新已提交的流水行（并发出库在余额行锁释放后能看到彼此的行，避免丢失扣减）。
		if err := s.Select(&rows, "SELECT "+prefixCols(model.ColsStockOperationLine, "l.")+", o.operation_type AS op_operation_type FROM stock_operation_line l JOIN stock_operation o ON o.id = l.operation_id AND o.project_id = ? WHERE l.stock_material_id = ? AND l.project_id = ? ORDER BY o.occurred_at, o.id, l.id FOR UPDATE",
			pid, materialID, pid); err != nil {
			return err
		}
		running := zero
		now := common.UTCNow()
		for i := range rows {
			line := &rows[i].StockOperationLine
			if mem, ok := inMemory[line.ID]; ok {
				line = mem
			}
			before := running
			if rows[i].OpType == domain.OperationInbound {
				running = jtype.Decimal{Decimal: running.Add(line.Quantity.Decimal)}
			} else {
				running = jtype.Decimal{Decimal: running.Sub(line.Quantity.Decimal)}
			}
			changed := !line.BeforeQty.Equal(before.Decimal) || !line.AfterQty.Equal(running.Decimal)
			line.BeforeQty = before
			line.AfterQty = running
			if changed {
				line.UpdatedAt = now
				if _, err := s.Exec("UPDATE stock_operation_line SET before_qty = ?, after_qty = ?, updated_at = ? WHERE id = ? AND project_id = ?",
					line.BeforeQty, line.AfterQty, line.UpdatedAt, line.ID, pid); err != nil {
					return err
				}
			}
		}
		if _, err := s.Exec("UPDATE stock_balance SET quantity = ?, version = ?, updated_at = ? WHERE stock_material_id = ? AND project_id = ?",
			running, balance.Version+1, now, materialID, pid); err != nil {
			return err
		}
	}
	return nil
}

// ---------------- 写入 ----------------

// CreateOptions 是 CreateOperation 的可选参数（冲销 / 小程序出库）。
type CreateOptions struct {
	ReversalOfID    *int64
	ReversalOf      *Operation
	MiniProgramUser *model.MiniProgramUser
}

// CreateOperation 对应 create_operation：同 client_request_id 幂等返回既有流水；锁定余额与物资后写流水、回放、
// 记事件，非冲销流水投递 Webhook。data.OccurredAtTime 必须已填（请求校验或调用方赋值）。
func CreateOperation(s *db.Session, data schema.OperationCreate, operationType string, opt CreateOptions) (*Operation, error) {
	existing, err := findByClientRequestID(s, data.ClientRequestID, false)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	if data.SourceType == domain.SourceMiniProgram && opt.MiniProgramUser == nil {
		return nil, apperr.New("INVALID_SOURCE_TYPE", "小程序来源只能由小程序出库创建")
	}
	if opt.MiniProgramUser != nil && data.SourceType != domain.SourceMiniProgram {
		return nil, apperr.New("INVALID_SOURCE_TYPE", "小程序出库必须使用小程序来源")
	}
	if data.SourceType == domain.SourceReversal && opt.ReversalOfID == nil {
		return nil, apperr.New("INVALID_SOURCE_TYPE", "冲销来源只能由冲销接口创建")
	}
	if operationType == domain.OperationOutbound && data.BusinessReason == "" {
		return nil, apperr.New("BUSINESS_REASON_REQUIRED", "出库必须填写用途")
	}
	if err := validateSemantics(operationType, data.SourceType, data.ReceiverUnit, data.ReceiverName); err != nil {
		return nil, err
	}
	materials, materialIDs, err := lockAndValidateMaterials(s, data.Lines, nil)
	if err != nil {
		return nil, err
	}
	if existing, err = findByClientRequestID(s, data.ClientRequestID, true); err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	sourceType := data.SourceType
	if sourceType == domain.SourceMiniProgram {
		sourceType = domain.SourceManual
	}
	var miniName *string
	if opt.MiniProgramUser != nil {
		name := opt.MiniProgramUser.DisplayName
		miniName = &name
	}
	now := common.UTCNow()
	op := &Operation{StockOperation: model.StockOperation{
		OperationNo:   "TMP-" + strings.ReplaceAll(security.UUID4(), "-", "")[:20],
		OperationType: operationType, OccurredAt: data.OccurredAtTime.UTC().Truncate(time.Microsecond),
		BusinessReason: data.BusinessReason, ReceiverUnit: data.ReceiverUnit, ReceiverName: data.ReceiverName,
		SubitemNo: data.SubitemNo, SourceType: sourceType, ReversalOfID: opt.ReversalOfID,
		ClientRequestID: data.ClientRequestID, MiniProgramUserNameSnapshot: miniName,
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	id, err := s.Insert("INSERT INTO stock_operation (operation_no, operation_type, occurred_at, business_reason, receiver_unit, receiver_name, subitem_no, source_type, reversal_of_id, client_request_id, mini_program_user_name_snapshot, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		op.OperationNo, op.OperationType, op.OccurredAt, op.BusinessReason, op.ReceiverUnit, op.ReceiverName, op.SubitemNo,
		op.SourceType, op.ReversalOfID, op.ClientRequestID, op.MiniProgramUserNameSnapshot, op.ProjectID, op.CreatedAt, op.UpdatedAt, op.Version)
	if err != nil {
		return nil, err
	}
	op.ID = id
	prefix := "OUT"
	if operationType == domain.OperationInbound {
		prefix = "IN"
	}
	op.OperationNo = fmt.Sprintf("%s%s%06d", prefix, op.OccurredAt.Format("20060102"), op.ID)
	originalLines := map[int64]*model.StockOperationLine{}
	if opt.ReversalOf != nil {
		for _, l := range opt.ReversalOf.Lines {
			originalLines[l.StockMaterialID] = l
		}
	}
	quantities := map[int64]jtype.Decimal{}
	for _, l := range data.Lines {
		if opt.ReversalOf == nil {
			quantities[l.StockMaterialID] = l.Quantity
			continue
		}
		original, ok := originalLines[l.StockMaterialID]
		if !ok {
			return nil, apperr.New("INVALID_REVERSAL_LINE", "冲销行不在原流水内").WithStatus(400)
		}
		if l.Quantity.GreaterThan(original.RemainingQty.Decimal) {
			return nil, apperr.New("INSUFFICIENT_QUANTITY", "冲销数量超过剩余可冲数量 "+pyDecStr(original.RemainingQty)).WithStatus(409)
		}
		quantities[l.StockMaterialID] = l.Quantity
	}
	op.UpdatedAt = common.UTCNow()
	if _, err := s.Exec("UPDATE stock_operation SET operation_no = ?, updated_at = ? WHERE id = ? AND project_id = ?", op.OperationNo, op.UpdatedAt, op.ID, pid); err != nil {
		return nil, err
	}
	inMemory := map[int64]*model.StockOperationLine{}
	lineNow := common.UTCNow()
	for _, l := range data.Lines {
		m := materials[l.StockMaterialID]
		q := quantities[l.StockMaterialID]
		line := &model.StockOperationLine{
			OperationID: op.ID, StockMaterialID: l.StockMaterialID, Quantity: q, RemainingQty: q,
			BeforeQty: zero, AfterQty: zero, MaterialNameSnapshot: m.Name, ModelSpecSnapshot: m.ModelSpec,
			UnitNameSnapshot: m.UnitName, ProjectID: pid, CreatedAt: lineNow, UpdatedAt: lineNow, Version: 1,
		}
		lid, err := s.Insert("INSERT INTO stock_operation_line (operation_id, stock_material_id, quantity, remaining_qty, before_qty, after_qty, material_name_snapshot, model_spec_snapshot, unit_name_snapshot, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			line.OperationID, line.StockMaterialID, line.Quantity, line.RemainingQty, line.BeforeQty, line.AfterQty,
			line.MaterialNameSnapshot, line.ModelSpecSnapshot, line.UnitNameSnapshot, line.ProjectID, line.CreatedAt, line.UpdatedAt, line.Version)
		if err != nil {
			return nil, err
		}
		line.ID = lid
		op.Lines = append(op.Lines, line)
		inMemory[lid] = line
	}
	if opt.ReversalOf != nil {
		for _, l := range data.Lines {
			original := originalLines[l.StockMaterialID]
			original.RemainingQty = jtype.Decimal{Decimal: original.RemainingQty.Sub(quantities[l.StockMaterialID].Decimal)}
			original.UpdatedAt = common.UTCNow()
			if _, err := s.Exec("UPDATE stock_operation_line SET remaining_qty = ?, updated_at = ? WHERE id = ? AND project_id = ?",
				original.RemainingQty, original.UpdatedAt, original.ID, pid); err != nil {
				return nil, err
			}
			inMemory[original.ID] = original
		}
	}
	if err := replayMaterials(s, materialIDs, inMemory); err != nil {
		return nil, err
	}
	action := "CREATED"
	if opt.ReversalOfID != nil {
		action = "REVERSED"
	}
	if err := common.LogEvent(s, "STOCK_OPERATION", op.ID, action, common.EventOptions{AfterData: snapshot(op)}); err != nil {
		return nil, err
	}
	if opt.ReversalOfID == nil {
		eventType := domain.EventStockOutboundCreated
		if operationType == domain.OperationInbound {
			eventType = domain.EventStockInboundCreated
		}
		mats := make([]any, len(op.Lines))
		for i, l := range op.Lines {
			mats[i] = map[string]any{
				"name":       l.MaterialNameSnapshot,
				"model_spec": l.ModelSpecSnapshot,
				"quantity":   pyDecStr(l.Quantity),
				"unit_name":  l.UnitNameSnapshot,
				"before_qty": pyDecStr(l.BeforeQty),
				"after_qty":  pyDecStr(l.AfterQty),
			}
		}
		if err := webhook.EnqueueEvent(s, eventType, map[string]any{
			"occurred_at":     op.OccurredAt.Format("2006-01-02T15:04:05") + "Z",
			"source_type":     SourceTypeOf(&op.StockOperation),
			"business_reason": op.BusinessReason,
			"receiver_unit":   op.ReceiverUnit,
			"receiver_name":   op.ReceiverName,
			"subitem_no":      op.SubitemNo,
			"materials":       mats,
		}); err != nil {
			return nil, err
		}
	}
	return op, nil
}

// UpdateOperation 对应 update_operation：改写流水与行（按物资对齐，未出现的行删除），回放新旧物资并记 UPDATED 事件。
// 返回的 Lines 顺序与请求 lines 一致。
func UpdateOperation(s *db.Session, op *Operation, data schema.OperationUpdate) (*Operation, error) {
	if err := apperr.ValidateVersion(&data.Version, op.Version); err != nil {
		return nil, err
	}
	if op.MiniProgramUserNameSnapshot != nil && data.SourceType != domain.SourceMiniProgram {
		return nil, apperr.New("INVALID_SOURCE_TYPE", "小程序流水必须保留小程序来源")
	}
	if op.MiniProgramUserNameSnapshot == nil && data.SourceType == domain.SourceMiniProgram {
		return nil, apperr.New("INVALID_SOURCE_TYPE", "普通流水不能改为小程序来源")
	}
	if data.OperationType == domain.OperationOutbound && data.BusinessReason == "" {
		return nil, apperr.New("BUSINESS_REASON_REQUIRED", "出库必须填写用途")
	}
	if err := validateSemantics(data.OperationType, data.SourceType, data.ReceiverUnit, data.ReceiverName); err != nil {
		return nil, err
	}
	before := snapshot(op)
	oldIDs := make([]int64, 0, len(op.Lines))
	for _, l := range op.Lines {
		oldIDs = append(oldIDs, l.StockMaterialID)
	}
	materials, materialIDs, err := lockAndValidateMaterials(s, data.Lines, oldIDs)
	if err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	op.OperationType = data.OperationType
	op.OccurredAt = data.OccurredAtTime.UTC().Truncate(time.Microsecond)
	op.SourceType = data.SourceType
	if op.SourceType == domain.SourceMiniProgram {
		op.SourceType = domain.SourceManual
	}
	op.BusinessReason = data.BusinessReason
	op.ReceiverUnit = data.ReceiverUnit
	op.ReceiverName = data.ReceiverName
	op.SubitemNo = data.SubitemNo
	op.Version++
	now := common.UTCNow()
	op.UpdatedAt = now
	if _, err := s.Exec("UPDATE stock_operation SET operation_type = ?, occurred_at = ?, source_type = ?, business_reason = ?, receiver_unit = ?, receiver_name = ?, subitem_no = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		op.OperationType, op.OccurredAt, op.SourceType, op.BusinessReason, op.ReceiverUnit, op.ReceiverName, op.SubitemNo, op.Version, op.UpdatedAt, op.ID, pid); err != nil {
		return nil, err
	}
	existing := map[int64]*model.StockOperationLine{}
	for _, l := range op.Lines {
		existing[l.StockMaterialID] = l
	}
	kept := map[int64]bool{}
	updated := make([]*model.StockOperationLine, 0, len(data.Lines))
	inMemory := map[int64]*model.StockOperationLine{}
	for _, l := range data.Lines {
		m := materials[l.StockMaterialID]
		stored, ok := existing[l.StockMaterialID]
		if !ok {
			stored = &model.StockOperationLine{OperationID: op.ID, StockMaterialID: l.StockMaterialID, BeforeQty: zero, AfterQty: zero, RemainingQty: l.Quantity, ProjectID: pid}
		}
		stored.Quantity = l.Quantity
		if l.Quantity.LessThan(stored.RemainingQty.Decimal) {
			stored.RemainingQty = l.Quantity
		}
		stored.MaterialNameSnapshot = m.Name
		stored.ModelSpecSnapshot = m.ModelSpec
		stored.UnitNameSnapshot = m.UnitName
		stored.UpdatedAt = now
		if ok {
			stored.Version++
			kept[stored.ID] = true
			if _, err := s.Exec("UPDATE stock_operation_line SET quantity = ?, remaining_qty = ?, material_name_snapshot = ?, model_spec_snapshot = ?, unit_name_snapshot = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
				stored.Quantity, stored.RemainingQty, stored.MaterialNameSnapshot, stored.ModelSpecSnapshot, stored.UnitNameSnapshot, stored.Version, stored.UpdatedAt, stored.ID, pid); err != nil {
				return nil, err
			}
		}
		updated = append(updated, stored)
	}
	for _, l := range op.Lines {
		if !kept[l.ID] {
			if _, err := s.Exec("DELETE FROM stock_operation_line WHERE id = ? AND project_id = ?", l.ID, pid); err != nil {
				return nil, err
			}
		}
	}
	for _, stored := range updated {
		if stored.ID == 0 {
			stored.Version = 1
			stored.CreatedAt = now
			lid, err := s.Insert("INSERT INTO stock_operation_line (operation_id, stock_material_id, quantity, remaining_qty, before_qty, after_qty, material_name_snapshot, model_spec_snapshot, unit_name_snapshot, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
				stored.OperationID, stored.StockMaterialID, stored.Quantity, stored.RemainingQty, stored.BeforeQty, stored.AfterQty,
				stored.MaterialNameSnapshot, stored.ModelSpecSnapshot, stored.UnitNameSnapshot, stored.ProjectID, stored.CreatedAt, stored.UpdatedAt, stored.Version)
			if err != nil {
				return nil, err
			}
			stored.ID = lid
		}
		inMemory[stored.ID] = stored
	}
	op.Lines = updated
	if err := replayMaterials(s, materialIDs, inMemory); err != nil {
		return nil, err
	}
	if err := common.LogEvent(s, "STOCK_OPERATION", op.ID, "UPDATED", common.EventOptions{BeforeData: before, AfterData: snapshot(op)}); err != nil {
		return nil, err
	}
	return op, nil
}

// ReverseOperation 对应 reverse_operation：冲销流水不能再冲销；冲销时间取 max(当前, 原发生时间 + 1µs)。
func ReverseOperation(s *db.Session, original *Operation, data schema.ReverseOperationRequest) (*Operation, error) {
	existing, err := findByClientRequestID(s, data.ClientRequestID, false)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}
	if original.ReversalOfID != nil {
		return nil, apperr.New("REVERSAL_NOT_ALLOWED", "冲销记录不能再次冲销；如需恢复请修改原流水或做反向出/入库").WithStatus(409)
	}
	reverseAt := time.Now().UTC()
	if floor := original.OccurredAt.Add(time.Microsecond); floor.After(reverseAt) {
		reverseAt = floor
	}
	payload := schema.OperationCreate{
		ClientRequestID: data.ClientRequestID, SourceType: domain.SourceReversal, BusinessReason: data.Reason,
		SubitemNo: original.SubitemNo, Lines: data.Lines, OccurredAtTime: reverseAt,
	}
	reverseType := domain.OperationInbound
	if original.OperationType == domain.OperationInbound {
		reverseType = domain.OperationOutbound
	}
	id := original.ID
	return CreateOperation(s, payload, reverseType, CreateOptions{ReversalOfID: &id, ReversalOf: original})
}

// ---------------- 查询 ----------------

// OperationSearch 是 search_operations 的参数（StartAt / EndAt 为 naive UTC）。
type OperationSearch struct {
	OperationNo   *string
	OperationType *string
	MaterialName  *string
	SourceType    *string
	StartAt       *time.Time
	EndAt         *time.Time
	Page          int64
	PageSize      int64
}

// SearchOperations 对应 search_operations：按发生时间、id 倒序分页（含行）。
func SearchOperations(s *db.Session, q OperationSearch) ([]*Operation, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, "o."); err != nil {
		return nil, 0, err
	}
	from := " FROM stock_operation o"
	var joinArgs []any
	if q.OperationNo != nil && *q.OperationNo != "" {
		w.Add("o.operation_no LIKE ?", "%"+*q.OperationNo+"%")
	}
	if q.OperationType != nil && *q.OperationType != "" {
		w.Add("o.operation_type = ?", *q.OperationType)
	}
	if q.MaterialName != nil && *q.MaterialName != "" {
		scope, sargs, err := scopeAnd(s, "l.")
		if err != nil {
			return nil, 0, err
		}
		from += " JOIN stock_operation_line l ON o.id = l.operation_id" + scope
		joinArgs = sargs
		w.ContainsAny([]string{"l.material_name_snapshot", "l.model_spec_snapshot"}, q.MaterialName)
	}
	if q.SourceType != nil && *q.SourceType != "" {
		switch *q.SourceType {
		case domain.SourceMiniProgram:
			w.Add("o.mini_program_user_name_snapshot IS NOT NULL")
		case domain.SourceManual:
			w.Add("o.source_type = ? AND o.mini_program_user_name_snapshot IS NULL", domain.SourceManual)
		default:
			w.Add("o.source_type = ?", *q.SourceType)
		}
	}
	if q.StartAt != nil {
		w.Add("o.occurred_at >= ?", *q.StartAt)
	}
	if q.EndAt != nil {
		w.Add("o.occurred_at <= ?", *q.EndAt)
	}
	args := append(append([]any{}, joinArgs...), w.Args...)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM (SELECT DISTINCT o.id"+from+w.SQL()+") t", args...); err != nil {
		return nil, 0, err
	}
	var rows []model.StockOperation
	pageArgs := append(append([]any{}, args...), q.PageSize, common.Offset(q.Page, q.PageSize))
	if err := s.Select(&rows, "SELECT DISTINCT "+prefixCols(model.ColsStockOperation, "o.")+from+w.SQL()+" ORDER BY o.occurred_at DESC, o.id DESC LIMIT ? OFFSET ?", pageArgs...); err != nil {
		return nil, 0, err
	}
	ops := make([]*Operation, len(rows))
	for i := range rows {
		ops[i] = &Operation{StockOperation: rows[i]}
	}
	if err := loadLines(s, ops); err != nil {
		return nil, 0, err
	}
	return ops, total, nil
}

// monthsBeforeTime 往前退 n 个自然月（保留时刻；目标月无该日取月末）。
func monthsBeforeTime(v time.Time, months int) time.Time {
	idx := v.Year()*12 + int(v.Month()) - 1 - months
	year, zm := idx/12, idx%12
	month := time.Month(zm + 1)
	last := time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
	day := min(v.Day(), last)
	return time.Date(year, month, day, v.Hour(), v.Minute(), v.Second(), v.Nanosecond(), v.Location())
}

// RecentOutboundConsumption 对应 recent_outbound_consumption：近 6 个月未被冲销的非冲销出库数量合计。
// now 为 nil 时取当前 UTC（naive）。
func RecentOutboundConsumption(s *db.Session, materialIDs []int64, now *time.Time) (map[int64]jtype.Decimal, error) {
	out := map[int64]jtype.Decimal{}
	seen := map[int64]bool{}
	ids := []int64{}
	for _, id := range materialIDs {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return out, nil
	}
	end := common.UTCNow()
	if now != nil {
		end = *now
	}
	start := monthsBeforeTime(end, 6)
	lscope, largs, err := scopeAnd(s, "l.")
	if err != nil {
		return nil, err
	}
	oscope, oargs, err := scopeAnd(s, "o.")
	if err != nil {
		return nil, err
	}
	rscope, rargs, err := scopeAnd(s, "r.")
	if err != nil {
		return nil, err
	}
	type row struct {
		MaterialID int64         `db:"stock_material_id"`
		Total      jtype.Decimal `db:"total"`
	}
	args := append([]any{}, oargs...)
	args = append(args, rargs...)
	args = append(args, ids, domain.OperationOutbound, domain.SourceReversal, start, end)
	args = append(args, largs...)
	var rows []row
	if err := s.SelectIn(&rows, "SELECT l.stock_material_id, SUM(l.quantity) AS total FROM stock_operation_line l JOIN stock_operation o ON o.id = l.operation_id"+oscope+
		" LEFT OUTER JOIN stock_operation r ON r.reversal_of_id = o.id"+rscope+
		" WHERE l.stock_material_id IN (?) AND o.operation_type = ? AND o.source_type != ? AND o.occurred_at >= ? AND o.occurred_at <= ? AND r.id IS NULL"+lscope+
		" GROUP BY l.stock_material_id", args...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.MaterialID] = r.Total
	}
	return out, nil
}

// BalanceSearch 是 inventory_balances 的参数。
type BalanceSearch struct {
	Keyword      *string
	MinimumQty   *jtype.Decimal
	MaximumQty   *jtype.Decimal
	LowStockOnly bool
	Page         int64
	PageSize     int64
	MaterialID   *int64
}

// InventoryBalances 对应 inventory_balances（search_inventory_materials + 余额读模型组装）。
func InventoryBalances(s *db.Session, q BalanceSearch) ([]schema.InventoryBalanceRead, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, "m."); err != nil {
		return nil, 0, err
	}
	bscope, bargs, err := scopeAnd(s, "b.")
	if err != nil {
		return nil, 0, err
	}
	from := " FROM stock_material m JOIN stock_balance b ON m.id = b.stock_material_id" + bscope
	joinArgs := append([]any{}, bargs...)
	if q.LowStockOnly {
		pscope, pargs, err := scopeAnd(s, "p.")
		if err != nil {
			return nil, 0, err
		}
		from += " JOIN stock_replenishment_policy p ON m.id = p.stock_material_id" + pscope
		joinArgs = append(joinArgs, pargs...)
	}
	if q.MaterialID != nil {
		w.Add("m.id = ?", *q.MaterialID)
	}
	w.ContainsAny([]string{"m.name", "m.alias", "m.model_spec"}, q.Keyword)
	if q.MinimumQty != nil {
		w.Add("b.quantity >= ?", *q.MinimumQty)
	}
	if q.MaximumQty != nil {
		w.Add("b.quantity <= ?", *q.MaximumQty)
	}
	if q.LowStockOnly {
		w.Add("p.enabled = ? AND b.quantity <= p.minimum_qty", true)
	}
	args := append(joinArgs, w.Args...)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*)"+from+w.SQL(), args...); err != nil {
		return nil, 0, err
	}
	var materials []model.StockMaterial
	pageArgs := append(append([]any{}, args...), q.PageSize, common.Offset(q.Page, q.PageSize))
	if err := s.Select(&materials, "SELECT "+prefixCols(model.ColsStockMaterial, "m.")+from+w.SQL()+" ORDER BY m.id LIMIT ? OFFSET ?", pageArgs...); err != nil {
		return nil, 0, err
	}
	ids := make([]int64, len(materials))
	for i := range materials {
		ids[i] = materials[i].ID
	}
	balances := map[int64]*model.StockBalance{}
	policies := map[int64]*model.StockReplenishmentPolicy{}
	if len(ids) > 0 {
		scope, sargs, err := scopeAnd(s, "")
		if err != nil {
			return nil, 0, err
		}
		var bs []model.StockBalance
		if err := s.SelectIn(&bs, "SELECT "+model.ColsStockBalance+" FROM stock_balance WHERE stock_material_id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
			return nil, 0, err
		}
		for i := range bs {
			balances[bs[i].StockMaterialID] = &bs[i]
		}
		var ps []model.StockReplenishmentPolicy
		if err := s.SelectIn(&ps, "SELECT "+model.ColsStockReplenishmentPolicy+" FROM stock_replenishment_policy WHERE stock_material_id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
			return nil, 0, err
		}
		for i := range ps {
			policies[ps[i].StockMaterialID] = &ps[i]
		}
	}
	recent, err := RecentOutboundConsumption(s, ids, nil)
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.InventoryBalanceRead, len(materials))
	for i := range materials {
		m := &materials[i]
		balance := balances[m.ID]
		policy := policies[m.ID]
		current := zero
		updatedAt := m.UpdatedAt
		if balance != nil {
			current = balance.Quantity
			updatedAt = balance.UpdatedAt
		}
		var minimum *jtype.Decimal
		low := false
		if policy != nil {
			mq := policy.MinimumQty
			minimum = &mq
			low = policy.Enabled && current.LessThanOrEqual(policy.MinimumQty.Decimal)
		}
		suggested, ok := recent[m.ID]
		if !ok {
			suggested = zero
		}
		out[i] = schema.InventoryBalanceRead{
			StockMaterialID: m.ID, Name: m.Name, Alias: m.Alias, ModelSpec: m.ModelSpec, UnitName: m.UnitName,
			CurrentQty: current, MinimumQty: minimum, IsLowStock: low, SuggestedPurchaseQty: suggested,
			UpdatedAt: schema.NewAwareTime(updatedAt),
		}
	}
	return out, total, nil
}
