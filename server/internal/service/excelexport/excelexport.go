// Package excelexport 对应原 services/excel_export_service.py：按 JSON 模板渲染 Excel（物料编码申请表 /
// 采购申请表 / 申购审批表）与查询结果导出（含嵌入图片）。
//
// 行数据用 map[string]any 传入，值的类型约定（对应 Python 侧的值类型）：
//
//	nil / 空指针                 ↔ None
//	string                        ↔ str
//	int / int64 / ...             ↔ int
//	float64 / float32             ↔ float
//	bool                          ↔ bool
//	jtype.Decimal / decimal.Decimal ↔ Decimal
//	jtype.Date                    ↔ date（写成日期序列值 + yyyy-mm-dd 格式）
//	time.Time                     ↔ datetime（naive，写成 yyyy-mm-dd h:mm:ss）
//	ImagePaths                    ↔ list[Path]（本地图片路径列表：嵌入原图，空列表只留空单元格）
//	[]string / []any              ↔ 其他 list（结果导出合并为 ", " 分隔文本）
package excelexport

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // 注册解码器
	_ "image/jpeg" // 注册解码器
	"image/png"
	"io"
	"math"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/shopspring/decimal"
	"github.com/xuri/excelize/v2"
	_ "golang.org/x/image/bmp"  // 注册解码器（非 png/jpeg/gif 转存为 PNG，与 openpyxl 一致）
	_ "golang.org/x/image/tiff" // 注册解码器
	_ "golang.org/x/image/webp" // 注册解码器

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// XLSXContentType 是 xlsx 的 MIME 类型。
const XLSXContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

// 导出图片：显示尺寸统一约 96px（等比缩放），横向 96+8px 一槽位；有图行行高 74。
const (
	imageDisplay   = 96
	imageGapPx     = 8
	imageRowHeight = 74
	defaultColW    = 13.0 // openpyxl DEFAULT_COLUMN_WIDTH
)

// ImagePaths 是图片列的值：本地图片文件路径列表（缺失 / 无法识别的文件跳过）。
type ImagePaths []string

// Column 是结果导出的一列（字段键 + 表头）。
type Column struct {
	Key   string
	Label string
}

var illegalExcelChars = regexp.MustCompile(`[\x00-\x08\x0b-\x0c\x0e-\x1f]`)

// ExcelResponseHeaders 返回 Excel 下载响应头（Content-Disposition: attachment; filename*=UTF-8”<quote>）。
func ExcelResponseHeaders(filename string) map[string]string {
	return map[string]string{"Content-Disposition": "attachment; filename*=UTF-8''" + web.PyQuote(filename, "/")}
}

// ExcelResponse 登记 Excel 下载响应（各导出路由共用，统一 Content-Type 与文件名）。
func ExcelResponse(c *web.Ctx, content []byte, filename string) error {
	return c.Bytes(200, XLSXContentType, content, ExcelResponseHeaders(filename))
}

// WriteExportFile 原子写入导出文件：先写 .tmp 再改名，避免中途失败留下「完成态」文件。
func WriteExportFile(target string, content []byte) error {
	tmp := filepath.Join(filepath.Dir(target), filepath.Base(target)+".tmp")
	if err := os.WriteFile(tmp, content, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, target)
}

// ---------------- 模板 ----------------

// specError 是模板内容不完整 / 无效（对应 Python 渲染时的 KeyError / TypeError / ValueError）。
type specError struct{ msg string }

func (e *specError) Error() string { return e.msg }

func bad(format string, args ...any) { panic(&specError{fmt.Sprintf(format, args...)}) }

func asMap(v any) map[string]any {
	m, ok := v.(map[string]any)
	if !ok {
		bad("expected object, got %T", v)
	}
	return m
}

func req(m map[string]any, key string) any {
	v, ok := m[key]
	if !ok {
		bad("missing key %q", key)
	}
	return v
}

func asString(v any) string {
	s, ok := v.(string)
	if !ok {
		bad("expected string, got %T", v)
	}
	return s
}

func asInt(v any) int {
	f, ok := v.(float64)
	if !ok || f != math.Trunc(f) {
		bad("expected integer, got %v", v)
	}
	return int(f)
}

func asFloat(v any) float64 {
	f, ok := v.(float64)
	if !ok {
		bad("expected number, got %v", v)
	}
	return f
}

func asList(v any) []any {
	l, ok := v.([]any)
	if !ok {
		bad("expected list, got %T", v)
	}
	return l
}

// truthy 对应 Python 的真值判断。
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case float64:
		return x != 0
	case string:
		return x != ""
	case []any:
		return len(x) > 0
	case map[string]any:
		return len(x) > 0
	}
	return true
}

func get(m map[string]any, key string, def any) any {
	if v, ok := m[key]; ok {
		return v
	}
	return def
}

func loadSpec(fileName string) (map[string]any, error) {
	path := filepath.Join(config.S.TemplateDir, fileName)
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, apperr.New("EXPORT_TEMPLATE_MISSING",
				fmt.Sprintf("Excel 导出模板缺失：%s，请检查后端模板目录 templates", fileName)).
				WithDetails(apperr.D{"template": fileName, "template_dir": config.S.TemplateDir})
		}
		return nil, err
	}
	if !utf8.Valid(raw) {
		return nil, apperr.New("EXPORT_TEMPLATE_INVALID", fmt.Sprintf("Excel 导出模板编码错误：%s", fileName)).
			WithDetails(apperr.D{"template": fileName})
	}
	var spec any
	if err := json.Unmarshal(bytes.TrimPrefix(raw, []byte("\xef\xbb\xbf")), &spec); err != nil {
		return nil, apperr.New("EXPORT_TEMPLATE_INVALID", fmt.Sprintf("Excel 导出模板格式错误：%s", fileName)).
			WithDetails(apperr.D{"template": fileName})
	}
	m, ok := spec.(map[string]any)
	if !ok {
		// json.loads 可以得到非 dict（如列表）；渲染时访问键会 TypeError → 模板内容无效。
		return map[string]any{"__invalid__": spec}, nil
	}
	return m, nil
}

// ---------------- 样式 ----------------

type styleKey struct {
	spec      string
	numFmt    string
	hasNumFmt bool
}

type book struct {
	f      *excelize.File
	sheet  string
	styles map[styleKey]int
	// 已写单元格的最大行列（用于 <dimension>，与 openpyxl 一致）。
	maxRow, maxCol int
}

// styleCell 设置单元格样式并记录已用区域。
func (b *book) styleCell(cell string, style int) {
	b.must(b.f.SetCellStyle(b.sheet, cell, cell, style))
	col, row, err := excelize.CellNameToCoordinates(cell)
	b.must(err)
	b.maxRow = max(b.maxRow, row)
	b.maxCol = max(b.maxCol, col)
}

func newBook(title string) (*book, error) {
	f := excelize.NewFile()
	if title != "Sheet1" {
		if err := f.SetSheetName("Sheet1", title); err != nil {
			return nil, &specError{err.Error()}
		}
	}
	return &book{f: f, sheet: title, styles: map[styleKey]int{}}, nil
}

func (b *book) must(err error) {
	if err != nil {
		panic(&specError{err.Error()})
	}
}

// templateStyle 把模板样式字典转成 excelize 样式（对应 _style）；numFmt 为单元格值带来的默认日期格式。
func (b *book) templateStyle(style map[string]any, defaultNumFmt string) int {
	keyJSON, _ := json.Marshal(style)
	nf := defaultNumFmt
	if v, ok := style["number_format"]; ok && truthy(v) {
		nf = asString(v)
	}
	key := styleKey{spec: string(keyJSON), numFmt: nf, hasNumFmt: nf != ""}
	if id, ok := b.styles[key]; ok {
		return id
	}
	st := &excelize.Style{
		Font: &excelize.Font{
			Family: asString(get(style, "font_name", "等线")),
			Size:   asFloat(get(style, "font_size", float64(11))),
			Bold:   truthy(get(style, "bold", false)),
		},
		Alignment: &excelize.Alignment{WrapText: truthy(get(style, "wrap_text", false))},
	}
	if v := get(style, "horizontal", nil); v != nil {
		st.Alignment.Horizontal = asString(v)
	}
	if v := get(style, "vertical", nil); v != nil {
		st.Alignment.Vertical = asString(v)
	}
	if color := get(style, "fill", nil); truthy(color) {
		st.Fill = excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{asString(color)}}
	}
	if truthy(get(style, "border", nil)) {
		st.Border = thinBorder("000000")
	}
	if nf != "" {
		st.CustomNumFmt = &nf
	}
	id, err := b.f.NewStyle(st)
	b.must(err)
	b.styles[key] = id
	return id
}

func thinBorder(color string) []excelize.Border {
	out := make([]excelize.Border, 0, 4)
	for _, side := range []string{"left", "right", "top", "bottom"} {
		out = append(out, excelize.Border{Type: side, Color: color, Style: 1})
	}
	return out
}

// ---------------- 值 ----------------

// deref 解引用指针（空指针 → nil）。
func deref(v any) any {
	if v == nil {
		return nil
	}
	rv := reflect.ValueOf(v)
	for rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return nil
		}
		rv = rv.Elem()
	}
	return rv.Interface()
}

func sanitize(s string) string {
	s = illegalExcelChars.ReplaceAllString(s, "")
	if strings.HasPrefix(s, "=") || strings.HasPrefix(s, "+") || strings.HasPrefix(s, "-") || strings.HasPrefix(s, "@") {
		return "'" + s
	}
	return s
}

var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

// toExcelSerial 复刻 openpyxl.utils.datetime.to_excel（naive 日期 / 日期时间 → 序列值）。
func toExcelSerial(t time.Time) float64 {
	d := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	days := int(math.Floor(d.Sub(excelEpoch).Hours() / 24))
	if days > 0 && days <= 60 {
		days--
	}
	secs := float64(t.Hour()*3600+t.Minute()*60+t.Second()) + float64(t.Nanosecond()/1000)/1e6
	return float64(days) + secs/86400
}

// writeValue 写单元格值，返回该值附带的默认数字格式（日期类）。
func (b *book) writeValue(cell string, v any) (string, error) {
	switch x := v.(type) {
	case nil:
		return "", nil
	case string:
		return "", b.f.SetCellStr(b.sheet, cell, x)
	case bool:
		return "", b.f.SetCellBool(b.sheet, cell, x)
	case int:
		return "", b.f.SetCellInt(b.sheet, cell, int64(x))
	case int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return "", b.f.SetCellValue(b.sheet, cell, x)
	case float64:
		return "", b.f.SetCellFloat(b.sheet, cell, x, -1, 64)
	case float32:
		return "", b.f.SetCellFloat(b.sheet, cell, float64(x), -1, 32)
	case jtype.Decimal:
		return "", b.f.SetCellDefault(b.sheet, cell, x.Decimal.String())
	case decimal.Decimal:
		return "", b.f.SetCellDefault(b.sheet, cell, x.String())
	case jtype.Date:
		return "yyyy-mm-dd", b.f.SetCellFloat(b.sheet, cell, toExcelSerial(x.Time), -1, 64)
	case time.Time:
		return "yyyy-mm-dd h:mm:ss", b.f.SetCellFloat(b.sheet, cell, toExcelSerial(x), -1, 64)
	case jtype.UTCTime:
		return "yyyy-mm-dd h:mm:ss", b.f.SetCellFloat(b.sheet, cell, toExcelSerial(x.Time.UTC()), -1, 64)
	case jtype.NaiveTime:
		return "yyyy-mm-dd h:mm:ss", b.f.SetCellFloat(b.sheet, cell, toExcelSerial(x.Time), -1, 64)
	}
	return "", fmt.Errorf("Cannot convert %v to Excel", v)
}

// cellValue 对应 _cell_value：空值（None / ""）取列默认值；字符串去非法字符并防公式注入。
func cellValue(row map[string]any, column map[string]any) any {
	var value any
	if field := get(column, "field", nil); truthy(field) {
		value = deref(row[asString(field)])
	}
	result := value
	if value == nil || value == "" {
		result = jsonToValue(get(column, "default", nil))
	}
	if s, ok := result.(string); ok {
		return sanitize(s)
	}
	return result
}

// jsonToValue 把模板 JSON 里的默认值转为单元格值（整数保持整数）。
func jsonToValue(v any) any {
	if f, ok := v.(float64); ok && f == math.Trunc(f) && math.Abs(f) < 1<<53 {
		return int64(f)
	}
	return v
}

func isImageList(v any) (ImagePaths, bool) {
	switch x := v.(type) {
	case ImagePaths:
		return x, true
	case *ImagePaths:
		if x != nil {
			return *x, true
		}
	}
	return nil, false
}

// ---------------- 图片 ----------------

// loadImage 对应 openpyxl Image(path)：返回嵌入字节、扩展名与像素尺寸；无法识别返回 ok=false。
func loadImage(path string) ([]byte, string, int, int, bool) {
	st, err := os.Stat(path)
	if err != nil || !st.Mode().IsRegular() {
		return nil, "", 0, 0, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", 0, 0, false
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return nil, "", 0, 0, false
	}
	switch format {
	case "png", "jpeg", "gif":
		return data, "." + format, cfg.Width, cfg.Height, true
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", 0, 0, false
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil, "", 0, 0, false
	}
	return buf.Bytes(), ".png", cfg.Width, cfg.Height, true
}

func pyRound(f float64) int { return int(math.RoundToEven(f)) }

// embedRowImages 把一行的一张或多张原图按固定显示尺寸嵌入到指定单元格，返回成功嵌入数量。
func (b *book) embedRowImages(row, col int, paths ImagePaths) int {
	x, added := 0, 0
	cell, err := excelize.CoordinatesToCellName(col, row)
	b.must(err)
	for _, p := range paths {
		data, ext, w, h, ok := loadImage(p)
		if !ok {
			continue
		}
		scale := math.Min(math.Min(float64(imageDisplay)/float64(w), float64(imageDisplay)/float64(h)), 1.0)
		nw := max(1, pyRound(float64(w)*scale))
		nh := max(1, pyRound(float64(h)*scale))
		err := b.f.AddPictureFromBytes(b.sheet, cell, &excelize.Picture{
			Extension: ext,
			File:      data,
			Format: &excelize.GraphicOptions{
				OffsetX:     x,
				ScaleX:      (float64(nw) + 0.5) / float64(w),
				ScaleY:      (float64(nh) + 0.5) / float64(h),
				Positioning: "oneCell",
			},
		})
		if err != nil {
			continue
		}
		x += imageDisplay + imageGapPx
		added++
	}
	return added
}

// ---------------- 工作表通用 ----------------

func (b *book) setDimensions(sheetSpec map[string]any) map[string]float64 {
	widths := map[string]float64{}
	for col, w := range asMap(get(sheetSpec, "column_widths", map[string]any{})) {
		width := asFloat(w)
		b.must(b.f.SetColWidth(b.sheet, col, col, width))
		widths[strings.ToUpper(col)] = width
	}
	for row, h := range asMap(get(sheetSpec, "row_heights", map[string]any{})) {
		n, err := strconv.Atoi(strings.TrimSpace(row))
		if err != nil {
			bad("invalid row %q", row)
		}
		b.must(b.f.SetRowHeight(b.sheet, n, asFloat(h)))
	}
	return widths
}

// freezePanes 对应 openpyxl ws.freeze_panes = cell（"A1" / 空表示不冻结）。
func (b *book) freezePanes(cell string) {
	if cell == "" {
		return
	}
	col, row, err := excelize.CellNameToCoordinates(cell)
	b.must(err)
	if col == 1 && row == 1 {
		return
	}
	panes := &excelize.Panes{Freeze: true, XSplit: col - 1, YSplit: row - 1, TopLeftCell: cell}
	switch {
	case col > 1 && row > 1:
		panes.ActivePane = "bottomRight"
		panes.Selection = []excelize.Selection{{Pane: "topRight"}, {Pane: "bottomLeft"}, {Pane: "bottomRight", ActiveCell: cell, SQRef: cell}}
	case col > 1:
		panes.ActivePane = "topRight"
		panes.Selection = []excelize.Selection{{Pane: "topRight", ActiveCell: cell, SQRef: cell}}
	default:
		panes.ActivePane = "bottomLeft"
		panes.Selection = []excelize.Selection{{Pane: "bottomLeft", ActiveCell: cell, SQRef: cell}}
	}
	b.must(b.f.SetPanes(b.sheet, panes))
}

func absRange(ref string) string {
	parts := strings.Split(ref, ":")
	for i, p := range parts {
		col, row, err := excelize.CellNameToCoordinates(p)
		if err != nil {
			bad("invalid range %q", ref)
		}
		name, _ := excelize.CoordinatesToCellName(col, row, true)
		parts[i] = name
	}
	return strings.Join(parts, ":")
}

func (b *book) printArea(ref string) {
	b.must(b.f.SetDefinedName(&excelize.DefinedName{
		Name:     "_xlnm.Print_Area",
		RefersTo: "'" + strings.ReplaceAll(b.sheet, "'", "''") + "'!" + absRange(ref),
		Scope:    b.sheet,
	}))
}

func (b *book) save() []byte {
	if b.maxRow > 0 {
		last, err := excelize.CoordinatesToCellName(b.maxCol, b.maxRow)
		b.must(err)
		b.must(b.f.SetSheetDimension(b.sheet, "A1:"+last))
	}
	buf, err := b.f.WriteToBuffer()
	b.must(err)
	out, err := normalizeAutoFilter(buf.Bytes())
	b.must(err)
	return out
}

var (
	filterModeAttr = regexp.MustCompile(` filterMode="(true|1)"`)
	emptySheetPr   = regexp.MustCompile(`<sheetPr\s*(/>|></sheetPr>)`)
	autoFilterRef  = regexp.MustCompile(`<autoFilter ref="([^"]*)"`)
)

// normalizeAutoFilter 让自动筛选与 openpyxl 产物一致：ref 用相对引用（A1:B2），且不标记
// sheetPr filterMode（excelize 会写 $A$1:$B$2 并置 filterMode=true，表示「已应用筛选」）。
func normalizeAutoFilter(pkg []byte) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(pkg), int64(len(pkg)))
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	for _, zf := range zr.File {
		rc, err := zf.Open()
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		if strings.HasPrefix(zf.Name, "xl/worksheets/sheet") && strings.HasSuffix(zf.Name, ".xml") {
			s := string(data)
			s = filterModeAttr.ReplaceAllString(s, "")
			s = emptySheetPr.ReplaceAllString(s, "")
			s = autoFilterRef.ReplaceAllStringFunc(s, func(m string) string { return strings.ReplaceAll(m, "$", "") })
			data = []byte(s)
		}
		w, err := zw.CreateHeader(&zip.FileHeader{Name: zf.Name, Method: zip.Deflate, Modified: zf.Modified})
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(data); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// columnLetter 等价 openpyxl get_column_letter。
func columnLetter(n int) string {
	name, err := excelize.ColumnNumberToName(n)
	if err != nil {
		bad("invalid column index %d", n)
	}
	return name
}
