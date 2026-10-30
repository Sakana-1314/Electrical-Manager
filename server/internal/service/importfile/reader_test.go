package importfile

import (
	"encoding/json"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

func pyTypeName(v any) string {
	switch v.(type) {
	case nil:
		return "NoneType"
	case string:
		return "str"
	case int64, *big.Int:
		return "int"
	case float64:
		return "float"
	case bool:
		return "bool"
	case time.Time:
		return "datetime"
	case TimeOfDay:
		return "time"
	case time.Duration:
		return "timedelta"
	}
	return "?"
}

// TestReaderMatchesPython 对照 Python import_file_reader 的读取结果（夹具由 openpyxl / xlwt / csv 生成）。
// 设置 IMPORT_FIXTURE_DIR 指向含 expected.json 的目录时运行。
func TestReaderMatchesPython(t *testing.T) {
	dir := os.Getenv("IMPORT_FIXTURE_DIR")
	if dir == "" {
		t.Skip("IMPORT_FIXTURE_DIR not set")
	}
	raw, err := os.ReadFile(filepath.Join(dir, "expected.json"))
	if err != nil {
		t.Fatal(err)
	}
	var expected map[string]json.RawMessage
	if err := json.Unmarshal(raw, &expected); err != nil {
		t.Fatal(err)
	}
	for name, exp := range expected {
		rows, err := ReadTabularRows(filepath.Join(dir, name))
		if strings.HasPrefix(strings.TrimSpace(string(exp)), "{") {
			var e struct {
				Error   string  `json:"error"`
				Code    *string `json:"code"`
				Message *string `json:"message"`
			}
			_ = json.Unmarshal(exp, &e)
			var ae *apperr.Error
			if e.Code == nil {
				if err == nil || errors.As(err, &ae) {
					t.Errorf("%s: expected plain error %s, got %v", name, e.Error, err)
				}
				continue
			}
			if !errors.As(err, &ae) || ae.Code != *e.Code || (e.Message != nil && ae.Message != *e.Message) {
				t.Errorf("%s: expected %s %v, got %v", name, *e.Code, e.Message, err)
			}
			continue
		}
		if err != nil {
			t.Errorf("%s: unexpected error %v", name, err)
			continue
		}
		var want [][][2]string
		if err := json.Unmarshal(exp, &want); err != nil {
			t.Fatal(err)
		}
		got := make([][][2]string, len(rows))
		for i, r := range rows {
			got[i] = make([][2]string, len(r))
			for j, v := range r {
				got[i][j] = [2]string{pyTypeName(v), PyStr(v)}
			}
		}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%s mismatch:\n got  %v\n want %v", name, got, want)
		}
	}
}

func TestPyFloatRepr(t *testing.T) {
	cases := map[float64]string{
		54506.04: "54506.04", 25: "25.0", 1e16: "1e+16", 1234567890123456: "1234567890123456.0",
		0.0001: "0.0001", 0.00001: "1e-05", -12.5: "-12.5", 1.5e300: "1.5e+300",
	}
	a, b := 0.1, 0.2
	cases[a+b] = "0.30000000000000004"
	for f, want := range cases {
		if got := PyFloatRepr(f); got != want {
			t.Errorf("PyFloatRepr(%v) = %s, want %s", f, got, want)
		}
	}
}

func TestParsePyDecimal(t *testing.T) {
	ok := map[string]string{"3.20": "3.2", " 12 ": "12", "1_000": "1000", ".5": "0.5", "5.": "5", "1e3": "1000", "-0": "0", "１２": "12"}
	for in, want := range ok {
		d, kind, valid := ParsePyDecimal(in)
		if !valid || kind != DecimalFinite || d.String() != want {
			t.Errorf("ParsePyDecimal(%q) = %v %v %v", in, d, kind, valid)
		}
	}
	for _, in := range []string{"", "-", "—", "配件", "1,000", "1e", "1__0", "_1", "abc"} {
		if _, _, valid := ParsePyDecimal(in); valid {
			t.Errorf("ParsePyDecimal(%q) should be invalid", in)
		}
	}
	for in, kind := range map[string]DecimalKind{"inf": DecimalInfinite, "-Infinity": DecimalInfinite, "NaN": DecimalNaN, "snan12": DecimalNaN} {
		if _, k, valid := ParsePyDecimal(in); !valid || k != kind {
			t.Errorf("ParsePyDecimal(%q) kind = %v", in, k)
		}
	}
}

func TestParsePyCSV(t *testing.T) {
	got := parsePyCSV("a,\"b\nc\",\"d\"\"e\"\n\nx\r\ny,z")
	want := [][]string{{"a", "b\nc", "d\"e"}, {}, {"x"}, {"y", "z"}}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("got %q", got)
	}
}
