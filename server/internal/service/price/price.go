// Package price 对应原 services/material_price_service.py：物料编码库页面「价格表」的导入与查询。
//
// 价格表里「货品编码」才是真实的物料编码，「全成本单价-人民币」才是单价：导入只取这两列。
// 没有货品编码（含占位文本）的行、单价不是有效数值的行跳过并分别计数；单价能解析成数值但超出
// DECIMAL(18, 6) 可存范围（负数 / 整数超过 12 位）才整表失败。表头只做书写层面的归一化。
package price

import (
	"context"
	"fmt"
	"math/big"
	"strings"
	"unicode/utf8"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
)

const (
	CodeHeader     = "货品编码"
	PriceHeader    = "全成本单价-人民币"
	MaxImportBytes = 50 * 1024 * 1024
	// JobType 是导入任务类型。
	JobType = "MATERIAL_PRICE"
)

// HeaderAliases 书写差异归一：括号写法各留一个别名。
var HeaderAliases = map[string]string{
	"全成本单价":      PriceHeader,
	"全成本单价(人民币)": PriceHeader,
	"全成本单价（人民币）": PriceHeader,
}

var (
	maxPrice = decimal.New(1, 12)
	// 全角破折号 / 连字符变体（－—–−‐‑）统一成半角「-」。
	dashReplacer  = strings.NewReplacer("－", "-", "—", "-", "–", "-", "−", "-", "‐", "-", "‑", "-")
	missingTokens = map[string]bool{
		"": true, "-": true, "--": true, "/": true, "\\": true, "n/a": true, "na": true, "null": true, "none": true,
		"无": true, "暂无": true, "没有货品编码": true, "没有物料编码": true, "无货品编码": true,
	}
)

func normalizeHeader(v string) string {
	v = dashReplacer.Replace(v)
	return strings.Map(func(r rune) rune {
		if importfile.PyIsSpace(r) {
			return -1
		}
		return r
	}, v)
}

func normalizedAlias(h string) string {
	n := normalizeHeader(h)
	if a, ok := HeaderAliases[n]; ok {
		return a
	}
	return n
}

func isMissingCode(v string) bool {
	return missingTokens[dashReplacer.Replace(strings.ToLower(importfile.PyStrip(v)))]
}

func invalidPrice(rowNumber int, value any) error {
	text := importfile.CellText(value)
	if text == "" {
		text = "空值"
	}
	return apperr.New("MATERIAL_PRICE_IMPORT_INVALID_PRICE",
		fmt.Sprintf("第 %d 行“%s”超出可存范围（需为 0 到 999999999999 之间的数值）：%s", rowNumber, PriceHeader, text)).
		WithDetails(apperr.D{"row": rowNumber, "column": PriceHeader})
}

// cellPrice 对应 _cell_price：解析不出数值返回 nil（该行没有价格）；超出可存范围报错。
func cellPrice(value any, rowNumber int) (*decimal.Decimal, error) {
	var text string
	switch v := value.(type) {
	case bool:
		return nil, nil
	case int64, float64, *big.Int, int:
		text = importfile.PyStrip(importfile.PyStr(v))
	default:
		text = importfile.PyStrip(importfile.PyStr(v))
		text = strings.NewReplacer(",", "", "￥", "", "¥", "").Replace(text)
	}
	if text == "" {
		return nil, nil
	}
	d, kind, ok := importfile.ParsePyDecimal(text)
	if !ok || kind != importfile.DecimalFinite {
		return nil, nil
	}
	if d.Sign() < 0 || d.GreaterThanOrEqual(maxPrice) {
		return nil, invalidPrice(rowNumber, value)
	}
	q := d.RoundBank(6)
	return &q, nil
}

// Row 是解析出的一行价格。
type Row struct {
	MaterialCode string
	UnitPrice    decimal.Decimal
}

// ParseFile 解析价格表，返回（可导入行、缺货品编码跳过数、缺价格跳过数）。
func ParseFile(path string) ([]Row, int, int, error) {
	rows, err := importfile.ReadTabularRows(path)
	if err != nil {
		return nil, 0, 0, err
	}
	expected := []string{normalizedAlias(CodeHeader), normalizedAlias(PriceHeader)}
	headerRow, idx, ok := importfile.FindHeaders(rows, expected, normalizedAlias)
	if !ok {
		return nil, 0, 0, apperr.New("MATERIAL_PRICE_IMPORT_HEADERS_MISSING",
			fmt.Sprintf("表格缺少必需列：%s、%s", CodeHeader, PriceHeader))
	}
	codeIndex, priceIndex := idx[expected[0]], idx[expected[1]]
	var parsed []Row
	seen := map[string]int{}
	skippedCode, skippedPrice := 0, 0
	for index := headerRow + 1; index < len(rows); index++ {
		rowNumber := index + 1
		row := rows[index]
		code := ""
		if codeIndex < len(row) {
			code = importfile.CellText(row[codeIndex])
		}
		rawPrice := importfile.Cell(row, priceIndex)
		if isMissingCode(code) {
			for _, cell := range row {
				if importfile.CellText(cell) != "" {
					skippedCode++
					break
				}
			}
			continue
		}
		unitPrice, err := cellPrice(rawPrice, rowNumber)
		if err != nil {
			return nil, 0, 0, err
		}
		if unitPrice == nil {
			skippedPrice++
			continue
		}
		if first, dup := seen[code]; dup {
			return nil, 0, 0, apperr.New("MATERIAL_PRICE_IMPORT_DUPLICATE",
				fmt.Sprintf("%s“%s”在第 %d 行和第 %d 行重复", CodeHeader, code, first, rowNumber)).
				WithDetails(apperr.D{"material_code": code, "first_row": first, "duplicate_row": rowNumber})
		}
		if utf8.RuneCountInString(code) > 64 {
			return nil, 0, 0, importfile.ValidateLength("MATERIAL_PRICE_IMPORT_VALUE_TOO_LONG", code, 64, rowNumber, CodeHeader)
		}
		seen[code] = rowNumber
		parsed = append(parsed, Row{MaterialCode: code, UnitPrice: *unitPrice})
	}
	if len(parsed) == 0 {
		return nil, 0, 0, apperr.New("MATERIAL_PRICE_IMPORT_EMPTY",
			fmt.Sprintf("表格中没有可导入的物料价格数据（需要同时有%s和%s）", CodeHeader, PriceHeader))
	}
	return parsed, skippedCode, skippedPrice, nil
}

// ProcessImportFile 是异步导入处理器：解析 → 全量替换 → 返回结果摘要。
func ProcessImportFile(ctx context.Context, s *db.Session, filePath string) (map[string]any, error) {
	rows, skippedCode, skippedPrice, err := ParseFile(filePath)
	if err != nil {
		return nil, err
	}
	args := make([][]any, len(rows))
	for i, r := range rows {
		args[i] = []any{r.MaterialCode, r.UnitPrice.StringFixed(6)}
	}
	if err := importjob.ReplaceProjectRows(s, model.TableMaterialPrice, []string{"material_code", "unit_price"}, args); err != nil {
		return nil, err
	}
	return map[string]any{
		"imported_count":        len(rows),
		"skipped_missing_code":  skippedCode,
		"skipped_missing_price": skippedPrice,
	}, nil
}

// LoadUnitPrices 按物料编码批量取当前项目的单价（价格表里没有的编码不出现在结果里）。
func LoadUnitPrices(s *db.Session, codes []string) (map[string]jtype.Decimal, error) {
	out := map[string]jtype.Decimal{}
	if len(codes) == 0 {
		return out, nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var rows []struct {
		MaterialCode string        `db:"material_code"`
		UnitPrice    jtype.Decimal `db:"unit_price"`
	}
	if err := s.SelectIn(&rows, "SELECT material_code, unit_price FROM material_price WHERE project_id = ? AND material_code IN (?)", pid, codes); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.MaterialCode] = r.UnitPrice
	}
	return out, nil
}
