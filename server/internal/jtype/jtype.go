// Package jtype 提供与原 Pydantic 序列化逐字节一致的 JSON / 数据库值类型：
//
//   - Decimal：输出为规范化字符串（去掉尾随零，整数不带小数点），如 "10"、"0.5"；
//     对应 ReadModel 的 json_encoders={Decimal: format(value.normalize(), "f")}。
//   - UTCTime：输出带 +00:00 的 ISO 字符串（微秒为 0 时省略），对应 schemas.UtcDateTime。
//   - NaiveTime：输出不带时区的 ISO 字符串（对应未标注 UtcDateTime 的 datetime 字段）。
//   - Date：输出 YYYY-MM-DD。
//   - JSON：数据库 JSON 列的原样透传。
package jtype

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"
)

// ---------------- Decimal ----------------

type Decimal struct {
	decimal.Decimal
}

func D(v decimal.Decimal) Decimal { return Decimal{v} }

func DecFromInt(v int64) Decimal { return Decimal{decimal.NewFromInt(v)} }

// ParseDecimal 解析十进制字符串（与 Python Decimal(str) 一致，支持科学计数法）。
func ParseDecimal(s string) (Decimal, error) {
	d, err := decimal.NewFromString(strings.TrimSpace(s))
	if err != nil {
		return Decimal{}, err
	}
	return Decimal{d}, nil
}

func MustDecimal(s string) Decimal {
	d, err := ParseDecimal(s)
	if err != nil {
		panic(err)
	}
	return d
}

// Normalized 等价于 Python format(value.normalize(), "f")。
func (d Decimal) Normalized() string {
	s := d.Decimal.String()
	if s == "-0" {
		return "-0"
	}
	return s
}

func (d Decimal) MarshalJSON() ([]byte, error) {
	return []byte(`"` + d.Normalized() + `"`), nil
}

// UnmarshalJSON 宽松解析：接受 JSON 数字或数字字符串（与 Pydantic lax 模式一致）。
func (d *Decimal) UnmarshalJSON(b []byte) error {
	b = bytes.TrimSpace(b)
	if len(b) > 0 && b[0] == '"' {
		var s string
		if err := json.Unmarshal(b, &s); err != nil {
			return err
		}
		v, err := ParseDecimal(s)
		if err != nil {
			return fmt.Errorf("decimal_parsing")
		}
		*d = v
		return nil
	}
	v, err := ParseDecimal(string(b))
	if err != nil {
		return fmt.Errorf("decimal_type")
	}
	*d = v
	return nil
}

// Scan 从数据库 DECIMAL 读取。
func (d *Decimal) Scan(value any) error { return d.Decimal.Scan(value) }

// Value 写入数据库（字符串形式，避免精度丢失）。
func (d Decimal) Value() (driver.Value, error) { return d.Decimal.String(), nil }

// Places 返回规范化后的小数位数（Python: -normalize().as_tuple().exponent，整数为 0）。
func (d Decimal) Places() int32 {
	s := d.Normalized()
	if i := strings.IndexByte(s, '.'); i >= 0 {
		return int32(len(s) - i - 1)
	}
	return 0
}

// Digits 返回规范化后的有效数字位数（Pydantic max_digits 口径）。
func (d Decimal) Digits() int {
	s := strings.TrimPrefix(d.Normalized(), "-")
	intPart, frac, _ := strings.Cut(s, ".")
	intPart = strings.TrimLeft(intPart, "0")
	if intPart == "" {
		// 0.xxx：前导零不计入整数位，小数位全部计入。
		return max(len(frac), 1)
	}
	return len(intPart) + len(frac)
}

// ---------------- 时间 ----------------

// pyISO 复刻 Python datetime.isoformat()：微秒为 0 时省略小数部分。
func pyISO(t time.Time) string {
	if t.Nanosecond()/1000 == 0 {
		return t.Format("2006-01-02T15:04:05")
	}
	return t.Format("2006-01-02T15:04:05") + fmt.Sprintf(".%06d", t.Nanosecond()/1000)
}

// UTCTime 统一以 UTC 输出（+00:00）。数据库中存 naive UTC。
type UTCTime struct{ time.Time }

func NewUTC(t time.Time) UTCTime { return UTCTime{t.UTC().Truncate(time.Microsecond)} }

func NowUTC() UTCTime { return NewUTC(time.Now()) }

func (t UTCTime) String() string { return pyISO(t.Time.UTC()) + "+00:00" }

func (t UTCTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + t.String() + `"`), nil
}

func (t *UTCTime) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("datetime_type")
	}
	v, aware, err := ParseISODateTime(s)
	if err != nil {
		return err
	}
	_ = aware
	t.Time = v.UTC()
	return nil
}

func (t *UTCTime) Scan(value any) error {
	v, err := scanTime(value)
	if err != nil {
		return err
	}
	t.Time = v
	return nil
}

func (t UTCTime) Value() (driver.Value, error) { return t.Time.UTC(), nil }

// NaiveTime 输出不带时区（对应 Pydantic 对 naive datetime 的默认序列化）。
type NaiveTime struct{ time.Time }

func (t NaiveTime) MarshalJSON() ([]byte, error) {
	return []byte(`"` + pyISO(t.Time) + `"`), nil
}

func (t *NaiveTime) Scan(value any) error {
	v, err := scanTime(value)
	if err != nil {
		return err
	}
	t.Time = v
	return nil
}

func (t NaiveTime) Value() (driver.Value, error) { return t.Time, nil }

func scanTime(value any) (time.Time, error) {
	switch v := value.(type) {
	case time.Time:
		return v.UTC(), nil
	case []byte:
		return parseDBTime(string(v))
	case string:
		return parseDBTime(v)
	case nil:
		return time.Time{}, nil
	}
	return time.Time{}, fmt.Errorf("cannot scan %T into time", value)
}

func parseDBTime(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02 15:04:05.999999", "2006-01-02 15:04:05", "2006-01-02T15:04:05.999999"} {
		if t, err := time.ParseInLocation(layout, s, time.UTC); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid datetime %q", s)
}

// ParseISODateTime 解析 ISO 8601 时间（Pydantic datetime 口径）：返回时间与是否带时区。
// naive 输入按 UTC 解释（调用方需要时自行要求带时区）。
func ParseISODateTime(s string) (time.Time, bool, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false, fmt.Errorf("datetime_parsing")
	}
	// 纯数字视为 Unix 时间戳（Pydantic 支持）。
	if n, err := strconv.ParseFloat(s, 64); err == nil && !strings.ContainsAny(s, "-:T") {
		sec := int64(n)
		return time.Unix(sec, int64((n-float64(sec))*1e9)).UTC(), true, nil
	}
	norm := strings.Replace(s, " ", "T", 1)
	if strings.HasSuffix(norm, "z") {
		norm = norm[:len(norm)-1] + "Z"
	}
	awareLayouts := []string{"2006-01-02T15:04:05.999999999Z07:00", "2006-01-02T15:04Z07:00", "2006-01-02T15:04:05.999999999Z0700", "2006-01-02T15:04:05.999999999Z07"}
	for _, layout := range awareLayouts {
		if t, err := time.Parse(layout, norm); err == nil {
			return t, true, nil
		}
	}
	naiveLayouts := []string{"2006-01-02T15:04:05.999999999", "2006-01-02T15:04", "2006-01-02"}
	for _, layout := range naiveLayouts {
		if t, err := time.ParseInLocation(layout, norm, time.UTC); err == nil {
			return t, false, nil
		}
	}
	return time.Time{}, false, fmt.Errorf("datetime_from_date_parsing")
}

// ---------------- Date ----------------

type Date struct{ time.Time }

func NewDate(y int, m time.Month, d int) Date { return Date{time.Date(y, m, d, 0, 0, 0, 0, time.UTC)} }

func DateOf(t time.Time) Date { return NewDate(t.Year(), t.Month(), t.Day()) }

func ParseDate(s string) (Date, error) {
	t, err := time.ParseInLocation("2006-01-02", strings.TrimSpace(s), time.UTC)
	if err != nil {
		return Date{}, err
	}
	return Date{t}, nil
}

func (d Date) String() string { return d.Time.Format("2006-01-02") }

func (d Date) MarshalJSON() ([]byte, error) { return []byte(`"` + d.String() + `"`), nil }

func (d *Date) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err != nil {
		return fmt.Errorf("date_type")
	}
	v, err := ParseDate(s)
	if err != nil {
		// Pydantic 也接受 "YYYY-MM-DDT00:00:00" 这类零时刻的 datetime 字符串。
		t, _, err2 := ParseISODateTime(s)
		if err2 != nil || t.Hour() != 0 || t.Minute() != 0 || t.Second() != 0 || t.Nanosecond() != 0 {
			return fmt.Errorf("date_from_datetime_parsing")
		}
		v = DateOf(t)
	}
	*d = v
	return nil
}

func (d *Date) Scan(value any) error {
	switch v := value.(type) {
	case time.Time:
		d.Time = time.Date(v.Year(), v.Month(), v.Day(), 0, 0, 0, 0, time.UTC)
		return nil
	case []byte:
		p, err := ParseDate(string(v)[:10])
		*d = p
		return err
	case string:
		p, err := ParseDate(v[:10])
		*d = p
		return err
	case nil:
		d.Time = time.Time{}
		return nil
	}
	return fmt.Errorf("cannot scan %T into date", value)
}

func (d Date) Value() (driver.Value, error) { return d.String(), nil }

// ---------------- JSON 列 ----------------

// JSON 透传数据库 JSON 列；空值序列化为 null。
type JSON json.RawMessage

func (j JSON) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("null"), nil
	}
	return j, nil
}

func (j *JSON) UnmarshalJSON(b []byte) error {
	*j = append((*j)[:0], b...)
	return nil
}

func (j *JSON) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*j = nil
	case []byte:
		*j = append(JSON(nil), v...)
	case string:
		*j = JSON(v)
	default:
		return fmt.Errorf("cannot scan %T into JSON", value)
	}
	return nil
}

func (j JSON) Value() (driver.Value, error) {
	if len(j) == 0 || string(j) == "null" {
		return nil, nil
	}
	return string(j), nil
}

// ToJSON 把任意值编码为 JSON 列值（nil → NULL）。
func ToJSON(v any) (JSON, error) {
	if v == nil {
		return nil, nil
	}
	b, err := Marshal(v)
	if err != nil {
		return nil, err
	}
	return JSON(b), nil
}

// Unmarshal 把 JSON 列解码到 dst；空值不报错。
func (j JSON) Unmarshal(dst any) error {
	if len(j) == 0 {
		return nil
	}
	return json.Unmarshal(j, dst)
}

// Marshal 与 FastAPI 一致：不转义 HTML 字符、紧凑输出。
func Marshal(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}
