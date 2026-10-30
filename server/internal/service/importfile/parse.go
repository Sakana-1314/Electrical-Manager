package importfile

import (
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// 以下是各导入 service 共用的解析小工具（对应各 service 中重复的私有函数）。

// HeaderScanRows 表头只在前 20 行内查找。
const HeaderScanRows = 20

// FindHeaders 在前 20 行里找同时包含 expected 全部表头的一行，返回该行下标与表头 → 列下标；
// normalize 把单元格文本映射成用于匹配的表头（nil 表示原样）。同名表头取最后一列。
func FindHeaders(rows [][]any, expected []string, normalize func(string) string) (int, map[string]int, bool) {
	for index := 0; index < min(HeaderScanRows, len(rows)); index++ {
		indexes := map[string]int{}
		for i, cell := range rows[index] {
			h := CellText(cell)
			if normalize != nil {
				h = normalize(h)
			}
			if h != "" {
				indexes[h] = i
			}
		}
		found := map[string]int{}
		ok := true
		for _, h := range expected {
			i, has := indexes[h]
			if !has {
				ok = false
				break
			}
			found[h] = i
		}
		if ok {
			return index, found, true
		}
	}
	return 0, nil, false
}

// RowValues 取一行中各表头列的文本（列越界为空串），并返回是否整行为空。
func RowValues(row []any, headerIndexes map[string]int) (map[string]string, bool) {
	values := make(map[string]string, len(headerIndexes))
	empty := true
	for h, col := range headerIndexes {
		v := ""
		if col < len(row) {
			v = CellText(row[col])
		}
		values[h] = v
		if v != "" {
			empty = false
		}
	}
	return values, empty
}

// Cell 取一行中指定列的原始值（越界为 nil）。
func Cell(row []any, col int) any {
	if col < len(row) {
		return row[col]
	}
	return nil
}

// ValidateLength 对应 _validate_length：按字符数校验，超长报 <code>。
func ValidateLength(code, value string, maximum, rowNumber int, header string) error {
	if utf8.RuneCountInString(value) > maximum {
		return apperr.New(code, fmt.Sprintf("第 %d 行“%s”超过 %d 个字符", rowNumber, header, maximum)).
			WithDetails(apperr.D{"row": rowNumber, "column": header, "max_length": maximum})
	}
	return nil
}

// NilIfEmpty 对应 `value or None`。
func NilIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// ParseQuantity 对应 _cell_quantity：None / 空白 → nil；Decimal(text) 失败报 <code>（第 N 行数量不是有效数值）。
// Infinity / NaN 在 Python 里是合法 Decimal、但写库失败（导入任务记未知错误），这里返回普通错误。
func ParseQuantity(code string, value any, rowNumber int) (*decimal.Decimal, error) {
	if value == nil {
		return nil, nil
	}
	text := PyStrip(PyStr(value))
	if text == "" {
		return nil, nil
	}
	d, kind, ok := ParsePyDecimal(text)
	if !ok {
		return nil, apperr.New(code, fmt.Sprintf("第 %d 行数量不是有效数值", rowNumber)).WithDetails(apperr.D{"row": rowNumber})
	}
	if kind != DecimalFinite || d.Exponent() > 64 || d.Exponent() < -64 {
		return nil, fmt.Errorf("quantity %q cannot be stored", text)
	}
	return &d, nil
}

// ParseCellDate 对应华星的 _cell_date：datetime → 日期；其余按 str(value).strip()[:10] 做 date.fromisoformat。
func ParseCellDate(value any) *jtype.Date {
	switch v := value.(type) {
	case nil:
		return nil
	case time.Time:
		d := jtype.DateOf(v)
		return &d
	}
	text := PyStrip(PyStr(value))
	if text == "" {
		return nil
	}
	r := []rune(text)
	if len(r) > 10 {
		r = r[:10]
	}
	s := string(r)
	for _, layout := range []string{"2006-01-02", "20060102"} {
		if len(s) != len(layout) || strings.ContainsAny(s, "+ ") {
			continue
		}
		if t, err := time.Parse(layout, s); err == nil {
			d := jtype.DateOf(t)
			return &d
		}
	}
	return nil
}

// DecimalKey 返回十进制数的规范化键（Decimal("25") == Decimal("25.0")）。
func DecimalKey(d *decimal.Decimal) string {
	if d == nil {
		return "\x01"
	}
	return d.String()
}

// StrKey 返回可空字符串的去重键。
func StrKey(s *string) string {
	if s == nil {
		return "\x01"
	}
	return "\x02" + *s
}

// DecimalArg 把可空十进制数转为 SQL 参数。
func DecimalArg(d *decimal.Decimal) any {
	if d == nil {
		return nil
	}
	return d.String()
}
