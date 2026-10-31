package excelexport

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math"
	"strings"
	"time"

	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/width"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
)

// Today 是导出文件名使用的「今天」（服务器本地日期，与 date.today() 一致；测试可替换）。
var Today = func() time.Time { return time.Now() }

// RenderExcel 按模板渲染 Excel，返回（文件内容, 下载文件名）。
// 模板缺失 → EXPORT_TEMPLATE_MISSING；编码 / JSON / 内容错误 → EXPORT_TEMPLATE_INVALID。
func RenderExcel(templateFile string, rows []map[string]any) ([]byte, string, error) {
	var buf bytes.Buffer
	filename, err := RenderExcelTo(&buf, templateFile, rows)
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), filename, nil
}

// RenderExcelTo 按模板渲染 Excel 并流式写到 w（嵌入的原图从磁盘直接复制，不整体读入内存），返回下载文件名。
func RenderExcelTo(w io.Writer, templateFile string, rows []map[string]any) (filename string, err error) {
	spec, err := loadSpec(templateFile)
	if err != nil {
		return "", err
	}
	defer func() {
		if r := recover(); r != nil {
			var se *specError
			if e, ok := r.(error); ok && errors.As(e, &se) {
				filename = ""
				err = apperr.New("EXPORT_TEMPLATE_INVALID", fmt.Sprintf("Excel 导出模板内容不完整或无效：%s", templateFile)).
					WithDetails(apperr.D{"template": templateFile})
				return
			}
			panic(r)
		}
	}()
	if _, invalid := spec["__invalid__"]; invalid {
		bad("template is not an object")
	}
	var b *book
	if templateFile == "material-code-application.json" {
		b = materialCodeWorkbook(spec, rows)
	} else {
		b = purchaseApplicationWorkbook(spec, rows)
	}
	b.saveTo(w)
	today := Today()
	filename = formatFilename(asString(req(spec, "output_filename")), today)
	return filename, nil
}

// formatFilename 对应 str.format(date=..., date_compact=...)（只支持这两个占位符，其它占位符视为模板无效）。
func formatFilename(tpl string, today time.Time) string {
	var b strings.Builder
	for i := 0; i < len(tpl); {
		c := tpl[i]
		switch {
		case c == '{' && i+1 < len(tpl) && tpl[i+1] == '{':
			b.WriteByte('{')
			i += 2
		case c == '}' && i+1 < len(tpl) && tpl[i+1] == '}':
			b.WriteByte('}')
			i += 2
		case c == '{':
			j := strings.IndexByte(tpl[i:], '}')
			if j < 0 {
				bad("Single '{' encountered in format string")
			}
			switch tpl[i+1 : i+j] {
			case "date":
				b.WriteString(today.Format("2006-01-02"))
			case "date_compact":
				b.WriteString(today.Format("20060102"))
			default:
				bad("unknown placeholder %q", tpl[i+1:i+j])
			}
			i += j + 1
		case c == '}':
			bad("Single '}' encountered in format string")
		default:
			b.WriteByte(c)
			i++
		}
	}
	return b.String()
}

func (b *book) setStyled(cell string, value any, style map[string]any) {
	nf, err := b.writeValue(cell, value)
	b.must(err)
	b.styleCell(cell, b.templateStyle(style, nf))
}

func styleOf(styles map[string]any, name any) map[string]any {
	return asMap(req(styles, asString(name)))
}

func materialCodeWorkbook(spec map[string]any, rows []map[string]any) *book {
	sheetSpec := asMap(req(spec, "sheet"))
	title := asString(req(sheetSpec, "title"))
	b, err := newBook(title)
	b.mustNil(err)
	if !truthy(get(sheetSpec, "show_grid_lines", true)) {
		off := false
		b.must(b.f.SetSheetView(b.sheet, 0, &excelize.ViewOptions{ShowGridLines: &off}))
	}
	b.setDimensions(sheetSpec)
	styles := asMap(req(spec, "styles"))
	for _, m := range asList(get(sheetSpec, "merged_cells", []any{})) {
		parts := strings.Split(asString(m), ":")
		if len(parts) != 2 {
			bad("invalid merged range %v", m)
		}
		b.must(b.f.MergeCell(b.sheet, parts[0], parts[1]))
	}
	b.setStyled(asString(req(sheetSpec, "title_cell")), title, styleOf(styles, "title"))
	for _, s := range asList(get(sheetSpec, "sections", []any{})) {
		sec := asMap(s)
		b.setStyled(asString(req(sec, "cell")), asString(req(sec, "label")), styleOf(styles, "section"))
	}
	headerRow := asInt(req(sheetSpec, "header_row"))
	requiredRow := asInt(req(sheetSpec, "required_row"))
	instructionRow := asInt(req(sheetSpec, "instruction_row"))
	b.setStyled(fmt.Sprintf("B%d", instructionRow), "说明", styleOf(styles, "instruction"))
	columns := asList(req(spec, "columns"))
	for _, c := range columns {
		column := asMap(c)
		letter := asString(req(column, "column"))
		for _, item := range []struct {
			row int
			key string
		}{{headerRow, "header"}, {requiredRow, "required"}, {instructionRow, "instruction"}} {
			b.setStyled(fmt.Sprintf("%s%d", letter, item.row), jsonToValue(get(column, item.key, nil)),
				styleOf(styles, get(column, item.key+"_style", "instruction")))
		}
	}
	dataStart := asInt(req(sheetSpec, "data_start_row"))
	count := max(len(rows), asInt(get(sheetSpec, "minimum_data_rows", float64(1))))
	for offset := 0; offset < count; offset++ {
		row := map[string]any{}
		if offset < len(rows) {
			row = rows[offset]
		}
		for _, c := range columns {
			column := asMap(c)
			cell := fmt.Sprintf("%s%d", asString(req(column, "column")), dataStart+offset)
			b.setStyled(cell, cellValue(row, column), styleOf(styles, get(column, "data_style", "data")))
		}
		b.must(b.f.SetRowHeight(b.sheet, dataStart+offset, 24))
	}
	b.printArea(fmt.Sprintf("B2:AA%d", dataStart+count-1))
	return b
}

func (b *book) mustNil(err error) {
	if err != nil {
		panic(&specError{err.Error()})
	}
}

func purchaseApplicationWorkbook(spec map[string]any, rows []map[string]any) *book {
	sheetSpec := asMap(req(spec, "sheet"))
	b, err := newBook(asString(req(sheetSpec, "title")))
	b.mustNil(err)
	if fp := get(sheetSpec, "freeze_panes", nil); fp != nil {
		b.freezePanes(asString(fp))
	}
	widths := b.setDimensions(sheetSpec)
	styles := asMap(req(spec, "styles"))
	headerRow := asInt(req(sheetSpec, "header_row"))
	dataStart := asInt(req(sheetSpec, "data_start_row"))
	columns := asList(req(spec, "columns"))
	for _, c := range columns {
		column := asMap(c)
		b.setStyled(fmt.Sprintf("%s%d", asString(req(column, "column")), headerRow), asString(req(column, "header")), styleOf(styles, "header"))
	}
	b.must(b.f.SetRowHeight(b.sheet, headerRow, 34))

	imageSlots := map[string]int{}
	var slotOrder []string
	for offset, row := range rows {
		rowNo := dataStart + offset
		rowHeight := 24.0
		for _, c := range columns {
			column := asMap(c)
			letter := asString(req(column, "column"))
			cell := fmt.Sprintf("%s%d", letter, rowNo)
			style := styleOf(styles, get(column, "style", "data"))
			var raw any
			if field := get(column, "field", nil); truthy(field) {
				raw = row[asString(field)]
			}
			if paths, ok := isImageList(raw); ok {
				b.setStyled(cell, nil, style)
				if _, seen := imageSlots[letter]; !seen {
					slotOrder = append(slotOrder, letter)
				}
				imageSlots[letter] = max(imageSlots[letter], len(paths))
				colIdx, err := excelize.ColumnNameToNumber(letter)
				b.must(err)
				if b.embedRowImages(rowNo, colIdx, paths) > 0 {
					rowHeight = math.Max(rowHeight, imageRowHeight)
				}
				continue
			}
			b.setStyled(cell, cellValue(row, column), style)
		}
		b.must(b.f.SetRowHeight(b.sheet, rowNo, rowHeight))
	}
	// 图片列按最多图片数放宽，保证同一行的图片都能落在本列内。
	for _, letter := range slotOrder {
		slots := imageSlots[letter]
		if slots == 0 {
			continue
		}
		current, ok := widths[strings.ToUpper(letter)]
		if !ok {
			current = defaultColW
		}
		want := float64(slots*(imageDisplay+imageGapPx)/7 + 2)
		b.must(b.f.SetColWidth(b.sheet, letter, letter, math.Max(current, want)))
	}

	lastColumn := columnLetter(len(columns))
	lastRow := max(dataStart, dataStart+len(rows)-1)
	validationLists := get(spec, "validation_lists", nil)
	for _, c := range columns {
		column := asMap(c)
		name := get(column, "validation", nil)
		if !truthy(name) {
			continue
		}
		if validationLists == nil {
			bad("missing validation_lists")
		}
		options := asList(req(asMap(validationLists), asString(name)))
		strs := make([]string, len(options))
		for i, o := range options {
			strs[i] = asString(o)
		}
		letter := asString(req(column, "column"))
		errMsg, errTitle := "请选择下拉列表中的值", "无效选项"
		dv := &excelize.DataValidation{
			Type:       "list",
			AllowBlank: true,
			Formula1:   `"` + strings.Join(strs, ",") + `"`,
			Error:      &errMsg,
			ErrorTitle: &errTitle,
			Sqref:      fmt.Sprintf("%s%d:%s%d", letter, dataStart, letter, lastRow),
		}
		b.must(b.f.AddDataValidation(b.sheet, dv))
	}
	if len(rows) > 0 && truthy(get(sheetSpec, "highlight_missing_first_column", false)) {
		fill, err := b.f.NewConditionalStyle(&excelize.Style{Fill: excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"FCE8E6"}}})
		b.must(err)
		b.must(b.f.SetConditionalFormat(b.sheet, fmt.Sprintf("A%d:%s%d", dataStart, lastColumn, lastRow),
			[]excelize.ConditionalFormatOptions{{Type: "formula", Criteria: fmt.Sprintf("LEN($A%d)=0", dataStart), Format: &fill}}))
	}
	ref := fmt.Sprintf("A%d:%s%d", headerRow, lastColumn, lastRow)
	b.must(b.f.AutoFilter(b.sheet, ref, nil))
	b.printArea(ref)
	return b
}

// ---------------- 结果导出 ----------------

// displayWidth 对应 _display_width：按行取最大显示宽度（东亚宽字符记 2）。
func displayWidth(text string) int {
	best := 0
	lines := pySplitLines(text)
	if len(lines) == 0 {
		lines = []string{""}
	}
	for _, line := range lines {
		w := 0
		for _, r := range line {
			switch width.LookupRune(r).Kind() {
			case width.EastAsianWide, width.EastAsianFullwidth:
				w += 2
			default:
				w++
			}
		}
		best = max(best, w)
	}
	return best
}

// pySplitLines 等价 Python str.splitlines()。
func pySplitLines(s string) []string {
	var out []string
	var cur strings.Builder
	rs := []rune(s)
	for i := 0; i < len(rs); i++ {
		r := rs[i]
		switch r {
		case '\n', '\v', '\f', 0x1c, 0x1d, 0x1e, 0x85, 0x2028, 0x2029:
			out = append(out, cur.String())
			cur.Reset()
		case '\r':
			if i+1 < len(rs) && rs[i+1] == '\n' {
				i++
			}
			out = append(out, cur.String())
			cur.Reset()
		default:
			cur.WriteRune(r)
		}
	}
	if cur.Len() > 0 {
		out = append(out, cur.String())
	}
	return out
}

// pyStrValue 对应 str(value)（结果导出列宽计算用）。
func pyStrValue(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case jtype.Date:
		return x.String()
	case time.Time:
		return importfile.PyStr(x)
	case float32:
		return importfile.PyFloatRepr(float64(x))
	}
	return importfile.PyStr(v)
}

// resultCellValue 对应 _result_cell_value：Decimal → float；字符串去非法字符并防公式注入；
// 非图片列表：空列表 → 空串，否则 ", " 合并。
func resultCellValue(v any) any {
	v = deref(v)
	switch x := v.(type) {
	case jtype.Decimal:
		f, _ := x.Float64()
		return f
	case decimal.Decimal:
		f, _ := x.Float64()
		return f
	case jtype.UTCTime:
		return x.Time.UTC()
	case jtype.NaiveTime:
		return x.Time
	case string:
		return sanitize(x)
	case []string:
		return strings.Join(x, ", ")
	case []any:
		parts := make([]string, len(x))
		for i, item := range x {
			parts[i] = pyStrValue(deref(item))
		}
		return strings.Join(parts, ", ")
	}
	return v
}

// RenderResultExcel 渲染查询结果导出（可见列 + 斑马纹 + 冻结表头 + 嵌入图片），返回（内容, 文件名）。
func RenderResultExcel(filenamePrefix string, columns []Column, rows []map[string]any) ([]byte, string, error) {
	var buf bytes.Buffer
	filename, err := RenderResultExcelTo(&buf, filenamePrefix, columns, rows)
	if err != nil {
		return nil, "", err
	}
	return buf.Bytes(), filename, nil
}

// RenderResultExcelTo 渲染查询结果导出并流式写到 w（嵌入的原图从磁盘直接复制），返回下载文件名。
func RenderResultExcelTo(w io.Writer, filenamePrefix string, columns []Column, rows []map[string]any) (filename string, err error) {
	defer func() {
		if r := recover(); r != nil {
			var se *specError
			if e, ok := r.(error); ok && errors.As(e, &se) {
				filename, err = "", e
				return
			}
			panic(r)
		}
	}()
	title := string([]rune(filenamePrefix)[:min(31, len([]rune(filenamePrefix)))])
	b, err := newBook(title)
	if err != nil {
		return "", err
	}
	b.freezePanes("A2")
	off, zoom := false, 90.0
	b.must(b.f.SetSheetView(b.sheet, 0, &excelize.ViewOptions{ShowGridLines: &off, ZoomScale: &zoom}))
	border := thinBorder("D8DEE8")
	headerStyle, err := b.f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Family: "等线", Size: 11, Bold: true, Color: "344054"},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"E9EDF3"}},
		Border:    border,
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	b.must(err)
	dataStyles := map[[2]string]int{}
	dataStyle := func(alt bool, numFmt string) int {
		key := [2]string{fmt.Sprint(alt), numFmt}
		if id, ok := dataStyles[key]; ok {
			return id
		}
		st := &excelize.Style{
			Font:      &excelize.Font{Family: "等线", Size: 11, Color: "344054"},
			Border:    border,
			Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
		}
		if alt {
			st.Fill = excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"F7F9FC"}}
		}
		if numFmt != "" {
			nf := numFmt
			st.CustomNumFmt = &nf
		}
		id, err := b.f.NewStyle(st)
		b.must(err)
		dataStyles[key] = id
		return id
	}

	widths := make([]int, len(columns))
	for i, col := range columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		b.must(b.f.SetCellStr(b.sheet, cell, col.Label))
		b.styleCell(cell, headerStyle)
		widths[i] = displayWidth(col.Label)
	}
	b.must(b.f.SetRowHeight(b.sheet, 1, 32))

	imageColumns := map[int]bool{}
	imageSlots := map[int]int{}
	for ri, row := range rows {
		rowIndex := ri + 2
		rowHeight := 30.0
		alt := rowIndex%2 == 0
		for ci, col := range columns {
			colIndex := ci + 1
			cell, _ := excelize.CoordinatesToCellName(colIndex, rowIndex)
			raw := row[col.Key]
			if paths, ok := isImageList(raw); ok {
				b.styleCell(cell, dataStyle(alt, ""))
				imageColumns[colIndex] = true
				imageSlots[colIndex] = max(imageSlots[colIndex], len(paths))
				if b.embedRowImages(rowIndex, colIndex, paths) > 0 {
					rowHeight = math.Max(rowHeight, imageRowHeight)
				}
				continue
			}
			value := resultCellValue(raw)
			nf, err := b.writeValue(cell, value)
			if err != nil {
				return "", err
			}
			b.styleCell(cell, dataStyle(alt, nf))
			widths[ci] = max(widths[ci], displayWidth(pyStrValue(value)))
		}
		b.must(b.f.SetRowHeight(b.sheet, rowIndex, rowHeight))
	}

	lastColumn := columnLetter(len(columns))
	lastRow := max(1, len(rows)+1)
	ref := fmt.Sprintf("A1:%s%d", lastColumn, lastRow)
	b.must(b.f.AutoFilter(b.sheet, ref, nil))
	b.printArea(ref)
	orientation, fitW, fitH := "landscape", 1, 0
	b.must(b.f.SetPageLayout(b.sheet, &excelize.PageLayoutOptions{Orientation: &orientation, FitToWidth: &fitW, FitToHeight: &fitH}))

	for i, w := range widths {
		colIndex := i + 1
		capW := 42
		if imageColumns[colIndex] {
			capW = 255
			w = max(w, imageSlots[colIndex]*(imageDisplay+imageGapPx)/7+2)
		}
		letter := columnLetter(colIndex)
		b.must(b.f.SetColWidth(b.sheet, letter, letter, float64(min(max(w+4, 14), capW))))
	}
	b.saveTo(w)
	return fmt.Sprintf("%s_%s.xlsx", filenamePrefix, Today().Format("20060102")), nil
}
