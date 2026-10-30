// Package huaxing 对应原 services/huaxing_inventory_service.py：华星总库存导入与查询。
package huaxing

import (
	"context"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
)

// ExpectedHeaders 是华星库存报表的必需列。
var ExpectedHeaders = []string{
	"首次入库日期", "仓库", "货品编码", "货品名称", "型号", "数量", "单位", "申购人", "申购部门", "子项号名称",
}

// HeaderAliases 用户口径「首次入库时间」对应报表实际表头「首次入库日期」。
var HeaderAliases = map[string]string{"首次入库时间": "首次入库日期"}

const (
	MaxImportBytes = 50 * 1024 * 1024
	// JobType 是导入任务类型。
	JobType = "HUAXING_INVENTORY"
)

// Row 是解析出的一行华星库存。
type Row struct {
	FirstInboundDate   *jtype.Date
	Warehouse          *string
	MaterialCode       string
	Name               *string
	ModelSpec          *string
	Quantity           *decimal.Decimal
	UnitName           *string
	Purchaser          *string
	PurchaseDepartment *string
	SubitemNoName      *string
}

// dedupeKey 全字段相同视为重复行。
func (r Row) dedupeKey() string {
	date := "\x01"
	if r.FirstInboundDate != nil {
		date = r.FirstInboundDate.String()
	}
	return strings.Join([]string{
		date, importfile.StrKey(r.Warehouse), r.MaterialCode, importfile.StrKey(r.Name), importfile.StrKey(r.ModelSpec),
		importfile.DecimalKey(r.Quantity), importfile.StrKey(r.UnitName), importfile.StrKey(r.Purchaser),
		importfile.StrKey(r.PurchaseDepartment), importfile.StrKey(r.SubitemNoName),
	}, "\x00")
}

func validateLength(value string, maximum, rowNumber int, header string) error {
	return importfile.ValidateLength("HUAXING_IMPORT_VALUE_TOO_LONG", value, maximum, rowNumber, header)
}

// ParseFile 对应 parse_huaxing_file。
func ParseFile(path string) ([]Row, error) {
	rows, err := importfile.ReadTabularRows(path)
	if err != nil {
		return nil, err
	}
	headerRow, idx, ok := importfile.FindHeaders(rows, ExpectedHeaders, func(h string) string {
		if a, ok := HeaderAliases[h]; ok {
			return a
		}
		return h
	})
	if !ok {
		return nil, apperr.New("HUAXING_IMPORT_HEADERS_MISSING",
			"表格缺少必需列：首次入库日期、仓库、货品编码、货品名称、型号、数量、单位、申购人、申购部门、子项号名称")
	}
	dateIndex := idx["首次入库日期"]
	quantityIndex := idx["数量"]
	var parsed []Row
	for index := headerRow + 1; index < len(rows); index++ {
		rowNumber := index + 1
		row := rows[index]
		values, empty := importfile.RowValues(row, idx)
		if empty {
			continue
		}
		code := values["货品编码"]
		if code == "" {
			return nil, apperr.New("HUAXING_IMPORT_CODE_REQUIRED", fmt.Sprintf("第 %d 行缺少货品编码", rowNumber)).
				WithDetails(apperr.D{"row": rowNumber})
		}
		for _, c := range []struct {
			h   string
			max int
		}{{"货品编码", 64}, {"仓库", 128}, {"货品名称", 255}, {"型号", 255}, {"单位", 32}, {"申购人", 128}, {"申购部门", 128}, {"子项号名称", 255}} {
			if err := validateLength(values[c.h], c.max, rowNumber, c.h); err != nil {
				return nil, err
			}
		}
		var quantity *decimal.Decimal
		if quantityIndex < len(row) {
			if quantity, err = importfile.ParseQuantity("HUAXING_IMPORT_INVALID_QUANTITY", row[quantityIndex], rowNumber); err != nil {
				return nil, err
			}
		}
		parsed = append(parsed, Row{
			FirstInboundDate:   importfile.ParseCellDate(importfile.Cell(row, dateIndex)),
			Warehouse:          importfile.NilIfEmpty(values["仓库"]),
			MaterialCode:       code,
			Name:               importfile.NilIfEmpty(values["货品名称"]),
			ModelSpec:          importfile.NilIfEmpty(values["型号"]),
			Quantity:           quantity,
			UnitName:           importfile.NilIfEmpty(values["单位"]),
			Purchaser:          importfile.NilIfEmpty(values["申购人"]),
			PurchaseDepartment: importfile.NilIfEmpty(values["申购部门"]),
			SubitemNoName:      importfile.NilIfEmpty(values["子项号名称"]),
		})
	}
	if len(parsed) == 0 {
		return nil, apperr.New("HUAXING_IMPORT_EMPTY", "表格中没有可导入的华星库存数据")
	}
	return parsed, nil
}

// ProcessImportFile 是异步导入处理器：解析 → 全量替换（完全重复的行只保留一条）→ 返回导入条数与去重统计。
func ProcessImportFile(ctx context.Context, s *db.Session, filePath string) (map[string]any, error) {
	rows, err := ParseFile(filePath)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	args := make([][]any, 0, len(rows))
	for _, r := range rows {
		k := r.dedupeKey()
		if seen[k] {
			continue
		}
		seen[k] = true
		var date any
		if r.FirstInboundDate != nil {
			date = *r.FirstInboundDate
		}
		args = append(args, []any{date, r.Warehouse, r.MaterialCode, r.Name, r.ModelSpec, importfile.DecimalArg(r.Quantity),
			r.UnitName, r.Purchaser, r.PurchaseDepartment, r.SubitemNoName})
	}
	cols := []string{"first_inbound_date", "warehouse", "material_code", "name", "model_spec", "quantity",
		"unit_name", "purchaser", "purchase_department", "subitem_no_name"}
	if err := importjob.ReplaceProjectRows(s, model.TableHuaxingInventory, cols, args); err != nil {
		return nil, err
	}
	return map[string]any{
		"imported_count":     len(args),
		"deduplicated_count": len(rows) - len(args),
	}, nil
}

// ListFilterOptions 华星库存筛选下拉选项：申购部门 / 申购人去空后的 distinct 值。
func ListFilterOptions(s *db.Session) ([]string, []string, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return nil, nil, err
	}
	departments := []string{}
	if err := s.Select(&departments,
		"SELECT DISTINCT purchase_department FROM huaxing_inventory WHERE project_id = ? AND purchase_department IS NOT NULL AND TRIM(purchase_department) != '' ORDER BY purchase_department",
		pid); err != nil {
		return nil, nil, err
	}
	purchasers := []string{}
	if err := s.Select(&purchasers,
		"SELECT DISTINCT purchaser FROM huaxing_inventory WHERE project_id = ? AND purchaser IS NOT NULL AND TRIM(purchaser) != '' ORDER BY purchaser",
		pid); err != nil {
		return nil, nil, err
	}
	return departments, purchasers, nil
}

// SearchParams 是 Search 的筛选条件。
type SearchParams struct {
	Keyword            *string
	MaterialCode       *string
	Name               *string
	ModelSpec          *string
	PurchaseDepartment *string
	Purchaser          *string
	DateFrom           *jtype.Date
	DateTo             *jtype.Date
	Page               int64
	PageSize           int64
}

// Search 对应 search_huaxing_inventory：文本字段内多关键词 OR，字段之间 AND；申购部门 / 申购人精确多值；
// 首次入库日期闭区间；keyword 兼容旧调用（编码 / 名称 / 型号 / 申购人跨列 OR）。
func Search(s *db.Session, p SearchParams) ([]schema.HuaXingInventoryRead, int64, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"material_code"}, p.MaterialCode)
	w.ContainsAny([]string{"name"}, p.Name)
	w.ContainsAny([]string{"model_spec"}, p.ModelSpec)
	for _, f := range []struct {
		col   string
		value *string
	}{{"purchase_department", p.PurchaseDepartment}, {"purchaser", p.Purchaser}} {
		if terms := common.SplitOrSearchTerms(f.value); len(terms) > 0 {
			w.Add(f.col+" IN ("+common.Placeholders(len(terms))+")", common.AnyArgs(terms)...)
		}
	}
	if p.DateFrom != nil {
		w.Add("first_inbound_date >= ?", *p.DateFrom)
	}
	if p.DateTo != nil {
		w.Add("first_inbound_date <= ?", *p.DateTo)
	}
	w.ContainsAny([]string{"material_code", "name", "model_spec", "purchaser"}, p.Keyword)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM huaxing_inventory"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []model.HuaxingInventory
	args := append(append([]any{}, w.Args...), p.PageSize, common.Offset(p.Page, p.PageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsHuaxingInventory+" FROM huaxing_inventory"+w.SQL()+" ORDER BY id LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	items := make([]schema.HuaXingInventoryRead, len(rows))
	for i, r := range rows {
		items[i] = schema.HuaXingInventoryRead{
			ID: r.ID, FirstInboundDate: r.FirstInboundDate, Warehouse: r.Warehouse, MaterialCode: r.MaterialCode,
			Name: r.Name, ModelSpec: r.ModelSpec, Quantity: r.Quantity, UnitName: r.UnitName, Purchaser: r.Purchaser,
			PurchaseDepartment: r.PurchaseDepartment, SubitemNoName: r.SubitemNoName,
		}
	}
	return items, total, nil
}
