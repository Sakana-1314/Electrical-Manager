package excelexport

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// 对应原 tests/test_excel_export_service.py（Python 单测改为 Go 等价测试）。

func sourceTemplateDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs(filepath.Join("..", "..", "..", "templates"))
	if err != nil {
		t.Fatal(err)
	}
	return dir
}

func withTemplateDir(t *testing.T, dir string) {
	t.Helper()
	old := config.S.TemplateDir
	config.S.TemplateDir = dir
	t.Cleanup(func() { config.S.TemplateDir = old })
}

func openBook(t *testing.T, content []byte) (*excelize.File, string) {
	t.Helper()
	// EXPORT_DUMP_DIR：把渲染结果落盘，便于用 openpyxl 交叉校验。
	if dir := os.Getenv("EXPORT_DUMP_DIR"); dir != "" {
		_ = os.WriteFile(filepath.Join(dir, t.Name()+".xlsx"), content, 0o644)
	}
	f, err := excelize.OpenReader(bytes.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { f.Close() })
	return f, f.GetSheetName(f.GetActiveSheetIndex())
}

func readCell(t *testing.T, f *excelize.File, sheet, cell string) string {
	t.Helper()
	v, err := f.GetCellValue(sheet, cell, excelize.Options{RawCellValue: true})
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func writePNG(t *testing.T, path string, w, h int) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for x := 0; x < w; x++ {
		for y := 0; y < h; y++ {
			img.Set(x, y, color.RGBA{0, 0, 255, 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

func countPictures(t *testing.T, f *excelize.File, sheet string, cells ...string) int {
	t.Helper()
	n := 0
	for _, c := range cells {
		pics, err := f.GetPictures(sheet, c)
		if err != nil {
			t.Fatal(err)
		}
		n += len(pics)
	}
	return n
}

func today() string { return time.Now().Format("20060102") }

func TestLoadSpecReadsConfiguredRuntimeTemplate(t *testing.T) {
	withTemplateDir(t, sourceTemplateDir(t))
	spec, err := loadSpec("purchase-application.json")
	if err != nil {
		t.Fatal(err)
	}
	if spec["template_name"] != "采购申请模板" {
		t.Fatalf("template_name = %v", spec["template_name"])
	}
}

func TestMissingTemplateRaisesReadableServiceError(t *testing.T) {
	withTemplateDir(t, t.TempDir())
	_, err := loadSpec("purchase-application.json")
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Status != 400 || ae.Code != "EXPORT_TEMPLATE_MISSING" || !strings.Contains(ae.Message, "purchase-application.json") {
		t.Fatalf("unexpected error %v", err)
	}
}

func TestInvalidTemplateRaisesReadableBusinessError(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "purchase-application.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	withTemplateDir(t, dir)
	_, _, err := RenderExcel("purchase-application.json", nil)
	var ae *apperr.Error
	if !errors.As(err, &ae) || ae.Status != 400 || ae.Code != "EXPORT_TEMPLATE_INVALID" {
		t.Fatalf("unexpected error %v", err)
	}
	// JSON 本身无法解析同样是 EXPORT_TEMPLATE_INVALID。
	if err := os.WriteFile(filepath.Join(dir, "purchase-application.json"), []byte("{"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, _, err = RenderExcel("purchase-application.json", nil)
	if !errors.As(err, &ae) || ae.Code != "EXPORT_TEMPLATE_INVALID" || !strings.Contains(ae.Message, "格式错误") {
		t.Fatalf("unexpected error %v", err)
	}
}

func TestPurchaseApprovalTemplateRendersEighteenColumns(t *testing.T) {
	withTemplateDir(t, sourceTemplateDir(t))
	content, filename, err := RenderExcel("purchase-approval.json", []map[string]any{{
		"serial": 1, "material_code": "DQ-001", "name": "接触器", "model_spec": "CJX2-2510",
		"planned_qty": 5, "unit_name": "个", "purchase_responsible": "张三", "department": "HXNI 检修维护部",
		"usage": "检修备用", "stock_qty": 12, "in_transit_qty": 3,
		"required_arrival_date": jtype.NewDate(2026, 11, 15), "urgency": "正常", "remark": "备注", "subitem_no": "GX-001",
	}})
	if err != nil {
		t.Fatal(err)
	}
	if want := "采购申请（审批）_" + today() + ".xlsx"; filename != want {
		t.Fatalf("filename = %s, want %s", filename, want)
	}
	f, sheet := openBook(t, content)
	headers := []string{"序号", "物料编码", "物料名称", "型号", "申请数量", "单位", "实际需求人", "使用部门", "用途",
		"库存量", "在途量", "单价", "总价", "到现场日期", "紧急程度", "备注", "子项号", "图片"}
	for i, h := range headers {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if got := readCell(t, f, sheet, cell); got != h {
			t.Errorf("%s = %q, want %q", cell, got, h)
		}
	}
	for cell, want := range map[string]string{"A2": "1", "B2": "DQ-001", "C2": "接触器", "H2": "HXNI 检修维护部", "J2": "12", "K2": "3", "L2": "", "M2": ""} {
		if got := readCell(t, f, sheet, cell); got != want {
			t.Errorf("%s = %q, want %q", cell, got, want)
		}
	}
	// 到现场日期写成日期序列值 + 日期格式（openpyxl 读回为 datetime）。
	if got := readCell(t, f, sheet, "N2"); got != "46341" {
		t.Errorf("N2 serial = %q", got)
	}
	if got, _ := f.GetCellValue(sheet, "N2"); got != "2026/11/15" {
		t.Errorf("N2 formatted = %q", got)
	}
	if !strings.Contains(sheetXML(t, content), `<autoFilter ref="A1:R2"`) {
		t.Error("auto filter ref should be A1:R2")
	}
}

func TestPurchaseApprovalTemplateEmbedsRowImages(t *testing.T) {
	withTemplateDir(t, sourceTemplateDir(t))
	dir := t.TempDir()
	img := filepath.Join(dir, "approval.png")
	writePNG(t, img, 40, 24)
	missing := filepath.Join(dir, "missing.png")
	content, _, err := RenderExcel("purchase-approval.json", []map[string]any{
		{"serial": 1, "name": "带图物资", "model_spec": "M1", "planned_qty": 1, "unit_name": "个",
			"purchase_responsible": "张三", "usage": "检修备用", "subitem_no": "GX-002", "images": ImagePaths{img}},
		{"serial": 2, "name": "缺图物资", "model_spec": "M2", "planned_qty": 1, "unit_name": "个",
			"purchase_responsible": "李四", "usage": "检修备用", "subitem_no": "GX-003", "images": ImagePaths{missing}},
	})
	if err != nil {
		t.Fatal(err)
	}
	f, sheet := openBook(t, content)
	if n := countPictures(t, f, sheet, "R2", "R3"); n != 1 {
		t.Fatalf("pictures = %d, want 1", n)
	}
	if got := readCell(t, f, sheet, "R1"); got != "图片" {
		t.Errorf("R1 = %q", got)
	}
	if h, _ := f.GetRowHeight(sheet, 2); h != 74 {
		t.Errorf("row 2 height = %v", h)
	}
	if h, _ := f.GetRowHeight(sheet, 3); h != 24 {
		t.Errorf("row 3 height = %v", h)
	}
	if w, _ := f.GetColWidth(sheet, "R"); w < 16 {
		t.Errorf("column R width = %v", w)
	}
	// 40×24 原图不放大：oneCellAnchor 显示尺寸 40×24 像素。
	if x := drawingXML(t, content); !strings.Contains(x, `<xdr:ext cx="381000" cy="228600"`) || !strings.Contains(x, "oneCellAnchor") {
		t.Errorf("unexpected drawing: %s", x)
	}
}

func TestMaterialCodeTemplateRendersMinimumRows(t *testing.T) {
	withTemplateDir(t, sourceTemplateDir(t))
	content, filename, err := RenderExcel("material-code-application.json", []map[string]any{
		{"serial": 1, "name": "=接触器", "model_spec": "CJX2", "unit_name": "个", "warranty_managed": "否"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if want := "物料编码申请表_" + today() + ".xlsx"; filename != want {
		t.Fatalf("filename = %s", filename)
	}
	f, sheet := openBook(t, content)
	if sheet != "非汽配件物料编码申请单（WMS）" {
		t.Errorf("sheet title = %q", sheet)
	}
	for cell, want := range map[string]string{"B2": "非汽配件物料编码申请单（WMS）", "B3": "申请人填写", "T3": "物料小组填写",
		"B4": "序号", "B6": "说明", "D7": "'=接触器", "B7": "1"} {
		if got := readCell(t, f, sheet, cell); got != want {
			t.Errorf("%s = %q, want %q", cell, got, want)
		}
	}
	if h, _ := f.GetRowHeight(sheet, 11); h != 24 {
		t.Errorf("minimum data rows should reach row 11 (height %v)", h)
	}
	names := f.GetDefinedName()
	found := false
	for _, n := range names {
		if n.Name == "_xlnm.Print_Area" && strings.HasSuffix(n.RefersTo, "!$B$2:$AA$11") {
			found = true
		}
	}
	if !found {
		t.Errorf("print area missing: %+v", names)
	}
}

func TestPurchaseApplicationTemplateDefaultsAndValidation(t *testing.T) {
	withTemplateDir(t, sourceTemplateDir(t))
	content, _, err := RenderExcel("purchase-application.json", []map[string]any{
		{"material_code": "Y001", "name": "按钮", "planned_qty": jtype.MustDecimal("5.0"), "urgency": "",
			"required_arrival_date": jtype.NewDate(2026, 1, 2)},
	})
	if err != nil {
		t.Fatal(err)
	}
	f, sheet := openBook(t, content)
	for cell, want := range map[string]string{"A2": "Y001", "C2": "5", "H2": "正常", "I2": "首次申购"} {
		if got := readCell(t, f, sheet, cell); got != want {
			t.Errorf("%s = %q, want %q", cell, got, want)
		}
	}
	dvs, err := f.GetDataValidations(sheet)
	if err != nil || len(dvs) != 2 || dvs[0].Sqref != "H2:H2" {
		t.Fatalf("data validations = %+v %v", dvs, err)
	}
	x := sheetXML(t, content)
	for _, want := range []string{`<autoFilter ref="A1:K2"`, `LEN($A2)=0`, `topLeftCell="A2"`} {
		if !strings.Contains(x, want) {
			t.Errorf("sheet xml missing %s", want)
		}
	}
}

func TestResultExcelUsesVisibleColumnsAndReadableLayout(t *testing.T) {
	content, filename, err := RenderResultExcel("申购计划导出", []Column{{"name", "名称"}, {"usage", "用途"}},
		[]map[string]any{{"name": "电机", "usage": "控制柜检修\n备用设备维护"}})
	if err != nil {
		t.Fatal(err)
	}
	if want := "申购计划导出_" + today() + ".xlsx"; filename != want {
		t.Fatalf("filename = %s", filename)
	}
	f, sheet := openBook(t, content)
	for cell, want := range map[string]string{"A1": "名称", "B1": "用途", "A2": "电机", "B2": "控制柜检修\n备用设备维护"} {
		if got := readCell(t, f, sheet, cell); got != want {
			t.Errorf("%s = %q, want %q", cell, got, want)
		}
	}
	panes, _ := f.GetPanes(sheet)
	if !panes.Freeze || panes.TopLeftCell != "A2" {
		t.Errorf("freeze panes = %+v", panes)
	}
	if x := sheetXML(t, content); !strings.Contains(x, `<autoFilter ref="A1:B2"`) {
		t.Error("auto filter ref should be A1:B2", x)
	}
	if h, _ := f.GetRowHeight(sheet, 1); h != 32 {
		t.Errorf("row 1 height = %v", h)
	}
	if h, _ := f.GetRowHeight(sheet, 2); h != 30 {
		t.Errorf("row 2 height = %v", h)
	}
	styleID, _ := f.GetCellStyle(sheet, "B2")
	style, _ := f.GetStyle(styleID)
	if style.Alignment == nil || !style.Alignment.WrapText {
		t.Error("B2 should wrap text")
	}
	for _, col := range []string{"A", "B"} {
		if w, _ := f.GetColWidth(sheet, col); w < 14 {
			t.Errorf("column %s width = %v", col, w)
		}
	}
	// 用途最长行「备用设备维护」宽 12 → 12 + 4 = 16。
	if w, _ := f.GetColWidth(sheet, "B"); w != 16 {
		t.Errorf("column B width = %v, want 16", w)
	}
}

func TestResultExcelEmbedsImagesAndSkipsMissingFiles(t *testing.T) {
	dir := t.TempDir()
	img := filepath.Join(dir, "sample.png")
	writePNG(t, img, 32, 20)
	content, _, err := RenderResultExcel("申购计划导出", []Column{{"name", "名称"}, {"images", "图片"}}, []map[string]any{
		{"name": "电机", "images": ImagePaths{img}},
		{"name": "水泵", "images": ImagePaths{filepath.Join(dir, "missing.png")}},
	})
	if err != nil {
		t.Fatal(err)
	}
	f, sheet := openBook(t, content)
	if n := countPictures(t, f, sheet, "B2", "B3"); n != 1 {
		t.Fatalf("pictures = %d", n)
	}
	if h, _ := f.GetRowHeight(sheet, 2); h != 74 {
		t.Errorf("row 2 height = %v", h)
	}
	if h, _ := f.GetRowHeight(sheet, 3); h != 30 {
		t.Errorf("row 3 height = %v", h)
	}
	if w, _ := f.GetColWidth(sheet, "B"); w < 20 {
		t.Errorf("column B width = %v", w)
	}
}

func TestResultExcelHandlesEmptyImageList(t *testing.T) {
	content, _, err := RenderResultExcel("申购计划导出", []Column{{"name", "名称"}, {"images", "图片"}},
		[]map[string]any{{"name": "电机", "images": ImagePaths{}}})
	if err != nil {
		t.Fatal(err)
	}
	f, sheet := openBook(t, content)
	if got := readCell(t, f, sheet, "B2"); got != "" {
		t.Errorf("B2 = %q", got)
	}
	if n := countPictures(t, f, sheet, "B2"); n != 0 {
		t.Errorf("pictures = %d", n)
	}
}

func TestResultCellValueAndWidth(t *testing.T) {
	if v := resultCellValue(jtype.MustDecimal("5.50")); v != 5.5 {
		t.Errorf("decimal → %v", v)
	}
	if v := resultCellValue("+86"); v != "'+86" {
		t.Errorf("formula guard → %v", v)
	}
	if v := resultCellValue("a\x01b"); v != "ab" {
		t.Errorf("illegal chars → %v", v)
	}
	if v := resultCellValue([]string{"a", "b"}); v != "a, b" {
		t.Errorf("list → %v", v)
	}
	if w := displayWidth("ab\n中文字"); w != 6 {
		t.Errorf("width = %d", w)
	}
}

func TestWriteExportFileIsAtomic(t *testing.T) {
	target := filepath.Join(t.TempDir(), "x.xlsx")
	if err := WriteExportFile(target, []byte("data")); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(target); string(b) != "data" {
		t.Fatal("content mismatch")
	}
	if _, err := os.Stat(target + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("tmp file should be renamed")
	}
}

func TestExcelResponseHeaders(t *testing.T) {
	h := ExcelResponseHeaders("申购 计划.xlsx")
	if got := h["Content-Disposition"]; got != "attachment; filename*=UTF-8''%E7%94%B3%E8%B4%AD%20%E8%AE%A1%E5%88%92.xlsx" {
		t.Errorf("Content-Disposition = %s", got)
	}
}

func zipPart(t *testing.T, content []byte, prefix string) string {
	t.Helper()
	f, err := excelize.OpenReader(bytes.NewReader(content))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	var out strings.Builder
	f.Pkg.Range(func(k, v any) bool {
		if strings.HasPrefix(k.(string), prefix) {
			out.Write(v.([]byte))
		}
		return true
	})
	return out.String()
}

func sheetXML(t *testing.T, content []byte) string {
	return zipPart(t, content, "xl/worksheets/sheet1.xml")
}

func drawingXML(t *testing.T, content []byte) string {
	return zipPart(t, content, "xl/drawings/drawing")
}
