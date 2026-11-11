package importfile

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"testing"
)

// writeTestXLSX 写一个只含必要部件的最小 xlsx，用于验证读取器对畸形文件的兼容。
func writeTestXLSX(t *testing.T, sheetXML string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "test.xlsx")
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	add := func(name, body string) {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(w, body); err != nil {
			t.Fatal(err)
		}
	}
	add("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`)
	add("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`)
	add("xl/worksheets/sheet1.xml", sheetXML)
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return p
}

// TestReadXLSXIgnoresWrongDimension：仓储导出的文件把 <dimension> 错写成 A1，
// 读取器不能据此只读 1 行 1 列。
func TestReadXLSXIgnoresWrongDimension(t *testing.T) {
	path := writeTestXLSX(t, `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1"/><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>编码</t></is></c><c r="B1" t="inlineStr"><is><t>型号</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>C001</t></is></c><c r="B2" t="inlineStr"><is><t>10×20mm</t></is></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>C002</t></is></c><c r="B3" t="n"><v>12.5</v></c></row>
</sheetData></worksheet>`)
	rows, err := ReadTabularRows(path)
	if err != nil {
		t.Fatalf("ReadTabularRows: %v", err)
	}
	if len(rows) != 3 {
		t.Fatalf("len(rows) = %d, want 3", len(rows))
	}
	for i, want := range [][]string{{"编码", "型号"}, {"C001", "10×20mm"}} {
		if len(rows[i]) != 2 || rows[i][0] != want[0] || rows[i][1] != want[1] {
			t.Errorf("row %d = %v, want %v", i+1, rows[i], want)
		}
	}
	if got, ok := rows[2][1].(float64); !ok || got != 12.5 {
		t.Errorf("numeric cell = %#v, want 12.5", rows[2][1])
	}
}

// TestReadXLSXTextInNumericCell：导出工具把文本写进 t="n" 单元格时按文本兜底。
func TestReadXLSXTextInNumericCell(t *testing.T) {
	path := writeTestXLSX(t, `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:B2"/><sheetData>
<row r="1"><c r="A1" t="inlineStr"><is><t>物料编码</t></is></c><c r="B1" t="inlineStr"><is><t>原厂件号</t></is></c></row>
<row r="2"><c r="A2" t="inlineStr"><is><t>Y026-00119</t></is></c><c r="B2" t="n"><v>E5784-12601</v></c></row>
</sheetData></worksheet>`)
	rows, err := ReadTabularRows(path)
	if err != nil {
		t.Fatalf("ReadTabularRows: %v", err)
	}
	if len(rows) != 2 || len(rows[1]) != 2 {
		t.Fatalf("rows = %v", rows)
	}
	if got := rows[1][1]; got != "E5784-12601" {
		t.Errorf("cell = %#v, want the raw text", got)
	}
}
