package importfile

import (
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/shopspring/decimal"
)

// TimeOfDay 对应 datetime.time。
type TimeOfDay struct {
	Hour, Minute, Second, Microsecond int
}

func (t TimeOfDay) String() string {
	s := fmt.Sprintf("%02d:%02d:%02d", t.Hour, t.Minute, t.Second)
	if t.Microsecond != 0 {
		s += fmt.Sprintf(".%06d", t.Microsecond)
	}
	return s
}

// PyIsSpace 等价 Python str.isspace() 的单字符判定。
func PyIsSpace(r rune) bool {
	return unicode.IsSpace(r) || (r >= 0x1c && r <= 0x1f)
}

// PyStrip 等价 Python str.strip()。
func PyStrip(s string) string { return strings.TrimFunc(s, PyIsSpace) }

// PyFloatRepr 等价 Python repr(float) / str(float)。
func PyFloatRepr(f float64) string {
	switch {
	case math.IsInf(f, 1):
		return "inf"
	case math.IsInf(f, -1):
		return "-inf"
	case math.IsNaN(f):
		return "nan"
	case f == 0:
		if math.Signbit(f) {
			return "-0.0"
		}
		return "0.0"
	}
	s := strconv.FormatFloat(f, 'e', -1, 64)
	sign := ""
	if s[0] == '-' {
		sign, s = "-", s[1:]
	}
	mant, expStr, _ := strings.Cut(s, "e")
	exp, _ := strconv.Atoi(expStr)
	digits := strings.Replace(mant, ".", "", 1)
	if exp < -4 || exp >= 16 {
		m := digits[:1]
		if len(digits) > 1 {
			m += "." + digits[1:]
		}
		es := "+"
		if exp < 0 {
			es, exp = "-", -exp
		}
		return fmt.Sprintf("%s%se%s%02d", sign, m, es, exp)
	}
	if exp >= 0 {
		if len(digits) <= exp+1 {
			return sign + digits + strings.Repeat("0", exp+1-len(digits)) + ".0"
		}
		return sign + digits[:exp+1] + "." + digits[exp+1:]
	}
	return sign + "0." + strings.Repeat("0", -exp-1) + digits
}

// floatIntText 等价 str(int(f))（f 为整数值的有限浮点数）。
func floatIntText(f float64) string {
	if math.Abs(f) < 1<<62 {
		return strconv.FormatInt(int64(f), 10)
	}
	b, _ := new(big.Float).SetFloat64(f).Int(nil)
	return b.String()
}

func pyDateTime(t time.Time) string {
	s := t.Format("2006-01-02 15:04:05")
	if us := t.Nanosecond() / 1000; us != 0 {
		s += fmt.Sprintf(".%06d", us)
	}
	return s
}

// pyTimedelta 等价 str(datetime.timedelta)。
func pyTimedelta(d time.Duration) string {
	us := d.Microseconds()
	days := us / (86400 * 1e6)
	rem := us % (86400 * 1e6)
	if rem < 0 {
		rem += 86400 * 1e6
		days--
	}
	secs := rem / 1e6
	micro := rem % 1e6
	s := fmt.Sprintf("%d:%02d:%02d", secs/3600, secs%3600/60, secs%60)
	if micro != 0 {
		s += fmt.Sprintf(".%06d", micro)
	}
	if days != 0 {
		plural := "s"
		if days == 1 || days == -1 {
			plural = ""
		}
		s = fmt.Sprintf("%d day%s, %s", days, plural, s)
	}
	return s
}

// PyStr 等价 Python str(value)（value 为读取器产出的单元格值）。
func PyStr(v any) string {
	switch x := v.(type) {
	case nil:
		return "None"
	case string:
		return x
	case int64:
		return strconv.FormatInt(x, 10)
	case int:
		return strconv.Itoa(x)
	case *big.Int:
		return x.String()
	case float64:
		return PyFloatRepr(x)
	case bool:
		if x {
			return "True"
		}
		return "False"
	case time.Time:
		return pyDateTime(x)
	case TimeOfDay:
		return x.String()
	case time.Duration:
		return pyTimedelta(x)
	}
	return fmt.Sprint(v)
}

// CellText 对应各 service 的 _cell_text：None → ""；整数值浮点数 → str(int(value))；其余 str(value).strip()。
func CellText(v any) string {
	if v == nil {
		return ""
	}
	if f, ok := v.(float64); ok && !math.IsInf(f, 0) && !math.IsNaN(f) && f == math.Trunc(f) {
		return floatIntText(f)
	}
	return PyStrip(PyStr(v))
}

// DecimalKind 是 Python Decimal 解析结果的类别。
type DecimalKind int

const (
	DecimalFinite DecimalKind = iota
	DecimalInfinite
	DecimalNaN
)

// ParsePyDecimal 等价 Python Decimal(text)：返回值、类别与是否合法（不合法对应 InvalidOperation）。
// 支持首尾空白、符号、小数点、指数、数字间下划线、全角数字以及 Infinity / NaN。
func ParsePyDecimal(text string) (decimal.Decimal, DecimalKind, bool) {
	s := PyStrip(text)
	if s == "" {
		return decimal.Decimal{}, 0, false
	}
	// 全角数字等 Unicode 十进制数字归一为 ASCII。
	var b strings.Builder
	for _, r := range s {
		if r >= '０' && r <= '９' {
			b.WriteRune('0' + (r - '０'))
		} else {
			b.WriteRune(r)
		}
	}
	s = b.String()
	body := s
	neg := false
	if body[0] == '+' || body[0] == '-' {
		neg = body[0] == '-'
		body = body[1:]
	}
	lower := strings.ToLower(body)
	switch {
	case lower == "inf" || lower == "infinity":
		return decimal.Decimal{}, DecimalInfinite, true
	case strings.HasPrefix(lower, "nan") || strings.HasPrefix(lower, "snan"):
		rest := strings.TrimPrefix(strings.TrimPrefix(lower, "s"), "nan")
		if allDigits(rest, true) {
			return decimal.Decimal{}, DecimalNaN, true
		}
		return decimal.Decimal{}, 0, false
	}
	// 数字间下划线（PEP 515）。
	if strings.Contains(body, "_") {
		for i := 0; i < len(body); i++ {
			if body[i] == '_' && (i == 0 || i == len(body)-1 || !isDigit(body[i-1]) || !isDigit(body[i+1])) {
				return decimal.Decimal{}, 0, false
			}
		}
		body = strings.ReplaceAll(body, "_", "")
	}
	mant, exp := body, ""
	if i := strings.IndexAny(body, "eE"); i >= 0 {
		mant, exp = body[:i], body[i+1:]
		e := exp
		if e != "" && (e[0] == '+' || e[0] == '-') {
			e = e[1:]
		}
		if !allDigits(e, false) {
			return decimal.Decimal{}, 0, false
		}
	}
	intPart, frac, hasDot := strings.Cut(mant, ".")
	if !allDigits(intPart, true) || !allDigits(frac, true) || (intPart == "" && frac == "") {
		return decimal.Decimal{}, 0, false
	}
	_ = hasDot
	if intPart == "" {
		intPart = "0"
	}
	norm := intPart
	if frac != "" {
		norm += "." + frac
	}
	if exp != "" {
		norm += "e" + exp
	}
	if neg {
		norm = "-" + norm
	}
	d, err := decimal.NewFromString(norm)
	if err != nil {
		return decimal.Decimal{}, 0, false
	}
	return d, DecimalFinite, true
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func allDigits(s string, allowEmpty bool) bool {
	if s == "" {
		return allowEmpty
	}
	for i := 0; i < len(s); i++ {
		if !isDigit(s[i]) {
			return false
		}
	}
	return true
}
