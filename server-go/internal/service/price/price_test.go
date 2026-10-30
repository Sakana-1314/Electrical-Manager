package price

import (
	"errors"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

func TestNormalizedAlias(t *testing.T) {
	for in, want := range map[string]string{
		" 货品编码 ":      "货品编码",
		"全成本单价—人民币":   PriceHeader,
		"全成本单价－人民币":   PriceHeader,
		"全成本单价（人民币）":  PriceHeader,
		"全成本单价 (人民币)": PriceHeader,
		"结算单价":        "结算单价",
	} {
		if got := normalizedAlias(in); got != want {
			t.Errorf("normalizedAlias(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsMissingCode(t *testing.T) {
	for _, v := range []string{"", " - ", "—", "N/A", "None", "没有货品编码", "暂无"} {
		if !isMissingCode(v) {
			t.Errorf("%q should be missing", v)
		}
	}
	if isMissingCode("Y001") {
		t.Error("Y001 is a code")
	}
}

func TestCellPrice(t *testing.T) {
	cases := []struct {
		in   any
		want string
	}{
		{12.5, "12.5"}, {"3.20", "3.2"}, {int64(10), "10"}, {" 1,234.50 ", "1234.5"}, {"￥8", "8"},
		{"0", "0"}, {2899.656, "2899.656"}, {1.0000005, "1"}, {1.0000015, "1.000002"},
	}
	for _, c := range cases {
		got, err := cellPrice(c.in, 2)
		if err != nil || got == nil || got.String() != c.want {
			t.Errorf("cellPrice(%v) = %v %v, want %s", c.in, got, err, c.want)
		}
	}
	for _, in := range []any{nil, "", "-", "—", "配件", true, "NaN", "inf"} {
		if got, err := cellPrice(in, 2); err != nil || got != nil {
			t.Errorf("cellPrice(%v) should skip, got %v %v", in, got, err)
		}
	}
	for _, in := range []any{-12.5, 1e12, "1000000000000"} {
		_, err := cellPrice(in, 3)
		var ae *apperr.Error
		if !errors.As(err, &ae) || ae.Code != "MATERIAL_PRICE_IMPORT_INVALID_PRICE" {
			t.Errorf("cellPrice(%v) should fail, got %v", in, err)
		}
	}
	_, err := cellPrice(-12.5, 3)
	if err.Error() != "MATERIAL_PRICE_IMPORT_INVALID_PRICE: 第 3 行“全成本单价-人民币”超出可存范围（需为 0 到 999999999999 之间的数值）：-12.5" {
		t.Errorf("message = %s", err)
	}
}
