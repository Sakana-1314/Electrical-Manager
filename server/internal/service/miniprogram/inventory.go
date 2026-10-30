package miniprogram

import (
	"strings"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/inventory"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
)

var zero = jtype.Decimal{Decimal: decimal.Zero}

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

// ---------------- 物资 ----------------

func findMaterial(s *db.Session, where string, forUpdate bool, args ...any) (*model.StockMaterial, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	q := "SELECT " + model.ColsStockMaterial + " FROM stock_material WHERE " + where + scope
	if forUpdate {
		q += " FOR UPDATE"
	}
	var m model.StockMaterial
	ok, err := s.Find(&m, q, append(args, sargs...)...)
	if err != nil || !ok {
		return nil, err
	}
	return &m, nil
}

// GetMaterial 对应 get_material(material_uuid)：含余额 / 补库策略 / 图片；不存在报「二级库物资不存在」。
// materialUUID 为规范化的带连字符 UUID。
func GetMaterial(s *db.Session, materialUUID string) (*material.Stock, error) {
	return material.GetStockByUUID(s, materialUUID)
}

// StockStatus 对应 _stock_status：无库存 / 低于补库下限（策略启用时）/ 正常。
func StockStatus(item *material.Stock) string {
	current := zero
	if item.Balance != nil {
		current = item.Balance.Quantity
	}
	if current.LessThanOrEqual(decimal.Zero) {
		return domain.MiniProgramStockOutOfStock
	}
	if p := item.Policy; p != nil && p.Enabled && current.LessThanOrEqual(p.MinimumQty.Decimal) {
		return domain.MiniProgramStockLow
	}
	return domain.MiniProgramStockNormal
}

// ListInventory 对应 list_inventory：关键字匹配名称 / 印尼语名称 / 别名 / 型号，可按库存状态筛选，id 倒序分页。
// stockStatus 为 out_of_stock / low_stock 时筛选，其它值（normal）不过滤。
func ListInventory(s *db.Session, keyword, stockStatus *string, page, pageSize int64) ([]*material.Stock, int64, error) {
	balanceScope, bargs, err := scopeAnd(s, "b.")
	if err != nil {
		return nil, 0, err
	}
	policyScope, pargs, err := scopeAnd(s, "p.")
	if err != nil {
		return nil, 0, err
	}
	from := " FROM stock_material m" +
		" LEFT OUTER JOIN stock_balance b ON b.stock_material_id = m.id" + balanceScope +
		" LEFT OUTER JOIN stock_replenishment_policy p ON p.stock_material_id = m.id" + policyScope
	joinArgs := append(append([]any{}, bargs...), pargs...)
	w := &common.Where{}
	if err := w.Scope(s, "m."); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"m.name", "m.name_id", "m.alias", "m.model_spec"}, keyword)
	const currentQty = "COALESCE(b.quantity, 0)"
	if stockStatus != nil {
		switch *stockStatus {
		case domain.MiniProgramStockOutOfStock:
			w.Add(currentQty + " <= 0")
		case domain.MiniProgramStockLow:
			w.Add(currentQty + " > 0 AND p.enabled IS TRUE AND " + currentQty + " <= p.minimum_qty")
		}
	}
	args := append(joinArgs, w.Args...)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*)"+from+w.SQL(), args...); err != nil {
		return nil, 0, err
	}
	var rows []model.StockMaterial
	if err := s.Select(&rows, "SELECT "+model.Prefixed("m", model.ColsStockMaterial)+from+w.SQL()+
		" ORDER BY m.id DESC LIMIT ? OFFSET ?", append(args, pageSize, common.Offset(page, pageSize))...); err != nil {
		return nil, 0, err
	}
	items := make([]*material.Stock, len(rows))
	for i := range rows {
		items[i] = &material.Stock{StockMaterial: rows[i]}
	}
	if err := material.LoadStockRelations(s, items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// LocalizedMaterialName 对应 localized_material_name：印尼语（id / in）显示印尼语名称，
// 其它语言显示中文名称，有别名时附在中文名称后面。
func LocalizedMaterialName(item *model.StockMaterial, language *string) string {
	lang := ""
	if language != nil {
		lang = *language
	}
	preferred, _, _ := strings.Cut(lang, ",")
	preferred, _, _ = strings.Cut(preferred, ";")
	code := strings.ToLower(strings.ReplaceAll(strings.TrimFunc(preferred, common.PyIsSpace), "_", "-"))
	code, _, _ = strings.Cut(code, "-")
	if code == "id" || code == "in" {
		if item.NameID != nil && *item.NameID != "" {
			return *item.NameID
		}
		return item.Name
	}
	if item.Alias != nil && *item.Alias != "" {
		return item.Name + "（" + *item.Alias + "）"
	}
	return item.Name
}

func currentQty(item *material.Stock) jtype.Decimal {
	if item.Balance != nil {
		return item.Balance.Quantity
	}
	return zero
}

// InventoryItemRead 对应 inventory_item_read。
func InventoryItemRead(item *material.Stock, language *string) schema.MiniProgramInventoryItemRead {
	return schema.MiniProgramInventoryItemRead{
		UUID: item.UUID, Name: LocalizedMaterialName(&item.StockMaterial, language), ModelSpec: item.ModelSpec,
		UnitName: item.UnitName, CurrentQty: currentQty(item), StockStatus: StockStatus(item),
	}
}

// MaterialRead 对应 material_read：minimum_qty 只在补库策略启用时返回。
func MaterialRead(item *material.Stock, language *string) schema.MiniProgramMaterialRead {
	var minimum *jtype.Decimal
	if p := item.Policy; p != nil && p.Enabled {
		q := p.MinimumQty
		minimum = &q
	}
	return schema.MiniProgramMaterialRead{
		UUID: item.UUID, Name: LocalizedMaterialName(&item.StockMaterial, language), ModelSpec: item.ModelSpec,
		UnitName: item.UnitName, CurrentQty: currentQty(item), StockStatus: StockStatus(item),
		MinimumQty: minimum, Remark: item.Remark, Images: material.FileReads(item.Images),
	}
}

// ---------------- 出库 ----------------

// outboundRead 对应 _outbound_read：流水必须是该物资的单行出库，否则视为请求标识被其他业务占用。
func outboundRead(op *inventory.Operation, materialID int64, materialUUID string, user *model.MiniProgramUser) (schema.MiniProgramOutboundRead, error) {
	if op.OperationType != domain.OperationOutbound || len(op.Lines) != 1 || op.Lines[0].StockMaterialID != materialID {
		return schema.MiniProgramOutboundRead{}, apperr.New("CLIENT_REQUEST_ID_CONFLICT", "请求标识已被其他出库业务使用").WithStatus(409)
	}
	line := op.Lines[0]
	receiverName := ""
	if op.ReceiverName != nil {
		receiverName = *op.ReceiverName
	}
	executedBy := user.DisplayName
	if op.MiniProgramUserNameSnapshot != nil && *op.MiniProgramUserNameSnapshot != "" {
		executedBy = *op.MiniProgramUserNameSnapshot
	}
	return schema.MiniProgramOutboundRead{
		OperationID: op.ID, OperationNo: op.OperationNo, MaterialUUID: materialUUID,
		MaterialName: line.MaterialNameSnapshot, ModelSpec: line.ModelSpecSnapshot, UnitName: line.UnitNameSnapshot,
		Quantity: line.Quantity, BeforeQty: line.BeforeQty, AfterQty: line.AfterQty,
		OccurredAt: schema.NewAwareTime(op.OccurredAt), BusinessReason: op.BusinessReason,
		ReceiverUnit: op.ReceiverUnit, ReceiverName: receiverName, SubitemNo: op.SubitemNo, ExecutedBy: executedBy,
	}, nil
}

// ensureNotLiteSecondaryWarehouse 对应 _ensure_not_lite_secondary_warehouse：精简模式下二级库仅支持查看。
func ensureNotLiteSecondaryWarehouse(s *db.Session) error {
	lite, err := aisearch.IsLiteSecondaryWarehouse(s)
	if err != nil {
		return err
	}
	if lite {
		return apperr.New("OUTBOUND_DISABLED", "二级库精简模式下不支持出入库").WithStatus(403)
	}
	return nil
}

// RecentOutboundReasons 对应 recent_outbound_reasons：当前用户与全员各自最近使用的 3 个（子项号, 用途）。
func RecentOutboundReasons(s *db.Session, user *model.MiniProgramUser) ([]schema.MiniProgramOutboundReason, []schema.MiniProgramOutboundReason, error) {
	if err := ensureNotLiteSecondaryWarehouse(s); err != nil {
		return nil, nil, err
	}
	list := func(userName *string) ([]schema.MiniProgramOutboundReason, error) {
		w := &common.Where{}
		w.Add("operation_type = ?", domain.OperationOutbound)
		w.Add("business_reason != ''")
		if userName != nil {
			w.Add("mini_program_user_name_snapshot = ?", *userName)
		}
		if err := w.Scope(s, ""); err != nil {
			return nil, err
		}
		var rows []struct {
			SubitemNo      *string `db:"subitem_no"`
			BusinessReason string  `db:"business_reason"`
		}
		if err := s.Select(&rows, "SELECT subitem_no, business_reason FROM stock_operation"+w.SQL()+
			" GROUP BY subitem_no, business_reason ORDER BY MAX(occurred_at) DESC, MAX(id) DESC LIMIT 3", w.Args...); err != nil {
			return nil, err
		}
		out := make([]schema.MiniProgramOutboundReason, len(rows))
		for i, r := range rows {
			out[i] = schema.MiniProgramOutboundReason{SubitemNo: r.SubitemNo, Reason: r.BusinessReason}
		}
		return out, nil
	}
	name := user.DisplayName
	personal, err := list(&name)
	if err != nil {
		return nil, nil, err
	}
	system, err := list(nil)
	if err != nil {
		return nil, nil, err
	}
	return personal, system, nil
}

// CreateOutbound 对应 create_outbound：扫码出库（同 client_request_id 幂等返回既有流水）。
// data.MaterialUUID / data.OccurredAtTime 必须已填（请求校验或调用方赋值）。
func CreateOutbound(s *db.Session, data schema.MiniProgramOutboundCreate, user *model.MiniProgramUser) (schema.MiniProgramOutboundRead, error) {
	if err := ensureNotLiteSecondaryWarehouse(s); err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	m, err := findMaterial(s, "uuid = ?", true, data.MaterialUUID)
	if err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	if m == nil {
		return schema.MiniProgramOutboundRead{}, apperr.NotFound("二级库物资")
	}
	var receiverUnit *string
	if data.ReceiverUnit != "" {
		unit := data.ReceiverUnit
		receiverUnit = &unit
	}
	receiverName := user.DisplayName
	subitemNo := data.SubitemNo
	op, err := inventory.CreateOperation(s, schema.OperationCreate{
		ClientRequestID: data.ClientRequestID,
		SourceType:      domain.SourceMiniProgram,
		BusinessReason:  data.BusinessReason,
		ReceiverUnit:    receiverUnit,
		ReceiverName:    &receiverName,
		SubitemNo:       &subitemNo,
		Lines:           []schema.OperationLineWrite{{StockMaterialID: m.ID, Quantity: data.Quantity}},
		OccurredAtTime:  data.OccurredAtTime,
	}, domain.OperationOutbound, inventory.CreateOptions{MiniProgramUser: user})
	if err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	return outboundRead(op, m.ID, m.UUID, user)
}

// loadOperationLines 批量加载流水行（一次 IN 查询，按 id 排序）。
func loadOperationLines(s *db.Session, ops []*inventory.Operation) error {
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
	if err := s.SelectIn(&lines, "SELECT "+model.ColsStockOperationLine+" FROM stock_operation_line WHERE operation_id IN (?)"+scope+" ORDER BY id",
		append([]any{ids}, sargs...)...); err != nil {
		return err
	}
	by := map[int64][]*model.StockOperationLine{}
	for i := range lines {
		by[lines[i].OperationID] = append(by[lines[i].OperationID], &lines[i])
	}
	for _, op := range ops {
		op.Lines = by[op.ID]
		if op.Lines == nil {
			op.Lines = []*model.StockOperationLine{}
		}
	}
	return nil
}

// GetOutboundByNo 对应 get_outbound_by_no：只接受小程序扫码产生的出库流水（快照姓名非空），供分享结果页恢复数据。
func GetOutboundByNo(s *db.Session, operationNo string, user *model.MiniProgramUser) (schema.MiniProgramOutboundRead, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	var row model.StockOperation
	ok, err := s.Find(&row, "SELECT "+model.ColsStockOperation+" FROM stock_operation WHERE operation_no = ? AND operation_type = ? "+
		"AND mini_program_user_name_snapshot IS NOT NULL"+scope+" LIMIT 1",
		append([]any{operationNo, domain.OperationOutbound}, sargs...)...)
	if err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	var op *inventory.Operation
	if ok {
		op = &inventory.Operation{StockOperation: row}
		if err := loadOperationLines(s, []*inventory.Operation{op}); err != nil {
			return schema.MiniProgramOutboundRead{}, err
		}
	}
	if op == nil || len(op.Lines) != 1 {
		return schema.MiniProgramOutboundRead{}, apperr.NotFound("出库流水")
	}
	m, err := findMaterial(s, "id = ?", false, op.Lines[0].StockMaterialID)
	if err != nil {
		return schema.MiniProgramOutboundRead{}, err
	}
	if m == nil {
		return schema.MiniProgramOutboundRead{}, apperr.NotFound("二级库物资")
	}
	return outboundRead(op, m.ID, m.UUID, user)
}

// OperationReadRows 对应 operation_read_rows：把一条库存操作按行展平为小程序出入库记录（只用行快照字段）。
func OperationReadRows(op *inventory.Operation) []schema.MiniProgramOperationRead {
	executedBy := op.ReceiverName
	if op.MiniProgramUserNameSnapshot != nil && *op.MiniProgramUserNameSnapshot != "" {
		executedBy = op.MiniProgramUserNameSnapshot
	}
	rows := make([]schema.MiniProgramOperationRead, 0, len(op.Lines))
	for _, line := range op.Lines {
		rows = append(rows, schema.MiniProgramOperationRead{
			OperationID: op.ID, OperationNo: op.OperationNo, OperationType: op.OperationType,
			MaterialName: line.MaterialNameSnapshot, ModelSpec: line.ModelSpecSnapshot, UnitName: line.UnitNameSnapshot,
			Quantity: line.Quantity, BeforeQty: line.BeforeQty, AfterQty: line.AfterQty,
			OccurredAt: schema.NewAwareTime(op.OccurredAt), BusinessReason: op.BusinessReason,
			ReceiverUnit: op.ReceiverUnit, ReceiverName: op.ReceiverName, SubitemNo: op.SubitemNo, ExecutedBy: executedBy,
		})
	}
	return rows
}

// ListOperationsByUser 对应 list_operations_by_user：按当前用户姓名匹配领用人或小程序执行人（含管理端操作），
// 按发生时间倒序分页后按行展平；total 是流水条数。
func ListOperationsByUser(s *db.Session, user *model.MiniProgramUser, page, pageSize int64) ([]schema.MiniProgramOperationRead, int64, error) {
	w := &common.Where{}
	w.Add("(receiver_name = ? OR mini_program_user_name_snapshot = ?)", user.DisplayName, user.DisplayName)
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM stock_operation"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []model.StockOperation
	if err := s.Select(&rows, "SELECT "+model.ColsStockOperation+" FROM stock_operation"+w.SQL()+
		" ORDER BY occurred_at DESC, id DESC LIMIT ? OFFSET ?", append(w.Args, pageSize, common.Offset(page, pageSize))...); err != nil {
		return nil, 0, err
	}
	ops := make([]*inventory.Operation, len(rows))
	for i := range rows {
		ops[i] = &inventory.Operation{StockOperation: rows[i]}
	}
	if err := loadOperationLines(s, ops); err != nil {
		return nil, 0, err
	}
	out := []schema.MiniProgramOperationRead{}
	for _, op := range ops {
		out = append(out, OperationReadRows(op)...)
	}
	return out, total, nil
}
