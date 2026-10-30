// Package lite 对应原 services/lite_inventory_service.py：精简二级库（Excel 一次性全量导入 + 只读查询）。
package lite

import (
	"context"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
)

// ExpectedHeaders 是精简二级库表格的必需列。
var ExpectedHeaders = []string{"物资名称", "型号规格", "单位", "数量", "备注"}

const (
	MaxImportBytes = 50 * 1024 * 1024
	// JobType 是导入任务类型。
	JobType = "LITE_INVENTORY"
)

// Row 是解析出的一行精简库存。
type Row struct {
	Name      string
	ModelSpec *string
	UnitName  *string
	Quantity  *decimal.Decimal
	Remark    *string
}

func (r Row) dedupeKey() string {
	return strings.Join([]string{r.Name, importfile.StrKey(r.ModelSpec), importfile.StrKey(r.UnitName),
		importfile.DecimalKey(r.Quantity), importfile.StrKey(r.Remark)}, "\x00")
}

// ParseFile 对应 parse_lite_file。
func ParseFile(path string) ([]Row, error) {
	rows, err := importfile.ReadTabularRows(path)
	if err != nil {
		return nil, err
	}
	headerRow, idx, ok := importfile.FindHeaders(rows, ExpectedHeaders, nil)
	if !ok {
		return nil, apperr.New("LITE_IMPORT_HEADERS_MISSING", "表格缺少必需列：物资名称、型号规格、单位、数量、备注")
	}
	var parsed []Row
	for index := headerRow + 1; index < len(rows); index++ {
		rowNumber := index + 1
		values, empty := importfile.RowValues(rows[index], idx)
		if empty {
			continue
		}
		name := values["物资名称"]
		if name == "" {
			return nil, apperr.New("LITE_IMPORT_NAME_REQUIRED", fmt.Sprintf("第 %d 行缺少物资名称", rowNumber)).
				WithDetails(apperr.D{"row": rowNumber})
		}
		for _, c := range []struct {
			h   string
			max int
		}{{"物资名称", 128}, {"型号规格", 255}, {"单位", 32}, {"备注", 1000}} {
			if err := importfile.ValidateLength("LITE_IMPORT_VALUE_TOO_LONG", values[c.h], c.max, rowNumber, c.h); err != nil {
				return nil, err
			}
		}
		quantity, err := importfile.ParseQuantity("LITE_IMPORT_INVALID_QUANTITY", values["数量"], rowNumber)
		if err != nil {
			return nil, err
		}
		parsed = append(parsed, Row{
			Name:      name,
			ModelSpec: importfile.NilIfEmpty(values["型号规格"]),
			UnitName:  importfile.NilIfEmpty(values["单位"]),
			Quantity:  quantity,
			Remark:    importfile.NilIfEmpty(values["备注"]),
		})
	}
	if len(parsed) == 0 {
		return nil, apperr.New("LITE_IMPORT_EMPTY", "表格中没有可导入的二级库数据")
	}
	return parsed, nil
}

// ProcessImportFile 是异步导入处理器：解析 → 全量替换 lite_inventory（完全重复的行只保留一条）。
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
		args = append(args, []any{r.Name, r.ModelSpec, r.UnitName, importfile.DecimalArg(r.Quantity), r.Remark})
	}
	cols := []string{"name", "model_spec", "unit_name", "quantity", "remark"}
	if err := importjob.ReplaceProjectRows(s, model.TableLiteInventory, cols, args); err != nil {
		return nil, err
	}
	return map[string]any{
		"imported_count":     len(args),
		"deduplicated_count": len(rows) - len(args),
	}, nil
}

// SearchParams 是 Search 的筛选条件。
type SearchParams struct {
	Keyword   *string
	Name      *string
	ModelSpec *string
	Page      int64
	PageSize  int64
}

// Search 对应 search_lite_inventory：名称 / 型号字段内多关键词 OR、字段之间 AND；
// keyword 兼容旧调用（小程序端按名称 / 型号 / 备注跨列 OR 匹配）。
func Search(s *db.Session, p SearchParams) ([]schema.LiteInventoryRead, int64, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"name"}, p.Name)
	w.ContainsAny([]string{"model_spec"}, p.ModelSpec)
	w.ContainsAny([]string{"name", "model_spec", "remark"}, p.Keyword)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM lite_inventory"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []model.LiteInventory
	args := append(append([]any{}, w.Args...), p.PageSize, common.Offset(p.Page, p.PageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsLiteInventory+" FROM lite_inventory"+w.SQL()+" ORDER BY id LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	items := make([]schema.LiteInventoryRead, len(rows))
	for i, r := range rows {
		items[i] = schema.LiteInventoryRead{ID: r.ID, Name: r.Name, ModelSpec: r.ModelSpec, UnitName: r.UnitName, Quantity: r.Quantity, Remark: r.Remark}
	}
	return items, total, nil
}
