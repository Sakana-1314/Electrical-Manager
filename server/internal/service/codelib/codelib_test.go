package codelib

import (
	"errors"
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

func TestNormalizeHeader(t *testing.T) {
	for in, want := range map[string]string{
		"编码":     CodeHeader,
		" 物料编码 ": CodeHeader,
		"物料名称":   NameHeader,
		"型号":     ModelHeader,
		"型号\t":   ModelHeader,
		"规格型号":   ModelHeader,
		"单位":     UnitHeader,
		"计量单位":   UnitHeader,
		"记账单位名称": UnitHeader,
		"旧物料编码":  "旧物料编码",
		"设备厂商":   "设备厂商",
	} {
		if got := normalizeHeader(in); got != want {
			t.Errorf("normalizeHeader(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestParseRowsOldTemplate(t *testing.T) {
	rows := [][]any{
		{"备注", "编码", "名称", "型号", "记账单位名称"},
		{"", "C011-00001", "吨袋", "Φ115×120cm", "个"},
		{"", "", "", "", ""},
		{"", "N004-00006", "", "", "kg"},
	}
	parsed, err := ParseRows(rows)
	if err != nil {
		t.Fatalf("ParseRows: %v", err)
	}
	if len(parsed) != 2 {
		t.Fatalf("len = %d, want 2", len(parsed))
	}
	first := parsed[0]
	if first.MaterialCode != "C011-00001" || first.Name == nil || *first.Name != "吨袋" ||
		first.ModelSpec == nil || *first.ModelSpec != "Φ115×120cm" || first.UnitName != "个" {
		t.Errorf("first row = %+v", first)
	}
	if parsed[1].Name != nil || parsed[1].ModelSpec != nil || parsed[1].UnitName != "kg" {
		t.Errorf("second row = %+v", parsed[1])
	}
}

// TestParseRowsWarehouseExport 覆盖仓储管理导出的物料编码表：表头叫法与旧模板不同，
// 「型号」列头还带尾部 Tab，其余多余列全部忽略。
func TestParseRowsWarehouseExport(t *testing.T) {
	rows := [][]any{
		{"序号", "物料编码", "物料名称", "旧物料编码", "物料大类", "物料小类", "型号\t", "单位", "启用状态", "资产类型", "是否一次性申购", "参考美元单价", "原厂件号", "适配设备型号", "设备厂商"},
		{"1", "C011-00001", "吨袋(停)", "L110501-00001", "包装储运物资", "生产用包装", "Φ115×120cm", "个", "停用", "非资产", "否", "11.428571428571429", "", "", ""},
		{"2", "N004-00012", "葡萄糖酸钠(停)", "L110301-00015", "生产原料及产品", "小宗辅料", "98.5%\\25kg/袋", "kg", "停用", "非资产", "否", "", "", "", ""},
	}
	parsed, err := ParseRows(rows)
	if err != nil {
		t.Fatalf("ParseRows: %v", err)
	}
	if len(parsed) != 2 {
		t.Fatalf("len = %d, want 2", len(parsed))
	}
	if parsed[0].MaterialCode != "C011-00001" || parsed[0].Name == nil || *parsed[0].Name != "吨袋(停)" ||
		parsed[0].ModelSpec == nil || *parsed[0].ModelSpec != "Φ115×120cm" || parsed[0].UnitName != "个" {
		t.Errorf("first row = %+v", parsed[0])
	}
	if parsed[1].MaterialCode != "N004-00012" || parsed[1].UnitName != "kg" {
		t.Errorf("second row = %+v", parsed[1])
	}
}

func TestParseRowsTruncatesLongModelSpec(t *testing.T) {
	long := strings.Repeat("型", 300)
	rows := [][]any{
		{"物料编码", "物料名称", "型号\t", "单位"},
		{"A001", "长型号", long, "个"},
		{"A002", "短型号", "10×20mm", "个"},
	}
	parsed, err := ParseRows(rows)
	if err != nil {
		t.Fatalf("ParseRows: %v", err)
	}
	if !parsed[0].ModelSpecTruncated || parsed[0].ModelSpec == nil {
		t.Fatalf("first row should be truncated: %+v", parsed[0])
	}
	if n := utf8.RuneCountInString(*parsed[0].ModelSpec); n != maxModelSpec {
		t.Errorf("model spec length = %d, want %d", n, maxModelSpec)
	}
	if parsed[1].ModelSpecTruncated {
		t.Errorf("second row should not be truncated: %+v", parsed[1])
	}
}

func TestParseRowsErrors(t *testing.T) {
	cases := []struct {
		name string
		rows [][]any
		code string
	}{
		{
			name: "缺少表头",
			rows: [][]any{{"物料编码", "物料名称", "型号"}},
			code: "MATERIAL_CODE_IMPORT_HEADERS_MISSING",
		},
		{
			name: "缺少编码",
			rows: [][]any{
				{"物料编码", "物料名称", "型号\t", "单位"},
				{"", "吨袋", "Φ115×120cm", "个"},
			},
			code: "MATERIAL_CODE_IMPORT_CODE_REQUIRED",
		},
		{
			name: "缺少单位",
			rows: [][]any{
				{"物料编码", "物料名称", "型号\t", "单位"},
				{"C011-00001", "吨袋", "Φ115×120cm", ""},
			},
			code: "MATERIAL_CODE_IMPORT_UNIT_REQUIRED",
		},
		{
			name: "编码重复",
			rows: [][]any{
				{"物料编码", "物料名称", "型号\t", "单位"},
				{"C011-00001", "吨袋", "Φ115×120cm", "个"},
				{"C011-00001", "吨袋", "Φ115×120cm", "个"},
			},
			code: "MATERIAL_CODE_IMPORT_DUPLICATE",
		},
		{
			name: "没有数据",
			rows: [][]any{{"物料编码", "物料名称", "型号\t", "单位"}},
			code: "MATERIAL_CODE_IMPORT_EMPTY",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := ParseRows(c.rows)
			var ae *apperr.Error
			if !errors.As(err, &ae) || ae.Code != c.code {
				t.Fatalf("err = %v, want %s", err, c.code)
			}
		})
	}
}
