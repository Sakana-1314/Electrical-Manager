package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// FieldError 是一条 Pydantic 风格的校验错误。
type FieldError struct {
	Type  string         `json:"type"`
	Loc   []any          `json:"loc"`
	Msg   string         `json:"msg"`
	Input any            `json:"input"`
	Ctx   map[string]any `json:"ctx,omitempty"`
}

// ValidationError 汇总一次请求的全部参数错误（→ 422 VALIDATION_ERROR）。
type ValidationError struct{ Errors []FieldError }

func (v *ValidationError) Error() string {
	return fmt.Sprintf("validation error: %d errors", len(v.Errors))
}

// ValueError 构造模型 / 字段自定义校验错误（等价 Pydantic 的 ValueError）。
func ValueError(loc []any, msg string, input any) FieldError {
	return FieldError{Type: "value_error", Loc: loc, Msg: "Value error, " + msg, Input: input, Ctx: map[string]any{"error": msg}}
}

// Validatable 由请求结构体实现，用于字段约束之外的自定义校验（Pydantic model_validator / field_validator）。
// 仅在该结构体的字段全部通过基础校验后调用；loc 是该结构体自身的位置（如 ["body"]）。
type Validatable interface {
	Validate(loc []any) []FieldError
}

// Opt 是三态字段：未传（Set=false）/ 显式 null（Set=true, Null=true）/ 有值。
// 对应 Python 里用 model_fields_set / exclude_unset 区分「省略」与「传 null」的字段。
type Opt[T any] struct {
	Set  bool
	Null bool
	V    T
}

// Present 表示传了非 null 值。
func (o Opt[T]) Present() bool { return o.Set && !o.Null }

// Ptr 返回值指针（未传或 null 时为 nil）。
func (o Opt[T]) Ptr() *T {
	if !o.Present() {
		return nil
	}
	v := o.V
	return &v
}

func (o Opt[T]) MarshalJSON() ([]byte, error) {
	if !o.Present() {
		return []byte("null"), nil
	}
	return jtype.Marshal(o.V)
}

func (o Opt[T]) optMarker() {}

type optMarker interface{ optMarker() }

// ---------------- 约束标签解析 ----------------

type rules struct {
	required   bool
	min, max   *int
	gt, ge     *jtype.Decimal
	lt, le     *jtype.Decimal
	digits     *int
	places     *int
	pattern    *regexp.Regexp
	patternSrc string
	oneof      []string
	nostrip    bool
	blankNil   bool
	unique     bool
	uniqueMsg  string
	itemMin    *int
	itemMax    *int
	itemPat    *regexp.Regexp
	itemOneof  []string
}

var (
	ruleCache sync.Map // reflect.StructField key → *rules
	// 常用正则命名（v:"pattern=uuid7"）。
	namedPatterns = map[string]string{
		"uuid7":  `^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
		"uuid4":  `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
		"sha256": `^[0-9a-f]{64}$`,
	}
	regexCache sync.Map
)

// RegisterPattern 注册命名正则，供 v:"pattern=<name>" 使用。
func RegisterPattern(name, expr string) { namedPatterns[name] = expr }

func compile(expr string) *regexp.Regexp {
	if named, ok := namedPatterns[expr]; ok {
		expr = named
	}
	if r, ok := regexCache.Load(expr); ok {
		return r.(*regexp.Regexp)
	}
	r := regexp.MustCompile(expr)
	regexCache.Store(expr, r)
	return r
}

func intp(s string) *int {
	n, err := strconv.Atoi(s)
	if err != nil {
		panic("bad rule int: " + s)
	}
	return &n
}

func decp(s string) *jtype.Decimal {
	d := jtype.MustDecimal(s)
	return &d
}

// parseRules 解析 v 标签：逗号分隔；pattern= 必须放最后（正则里可能有逗号）。
func parseRules(tag string) *rules {
	r := &rules{}
	if tag == "" {
		return r
	}
	rest := tag
	for rest != "" {
		var part string
		if strings.HasPrefix(rest, "pattern=") || strings.HasPrefix(rest, "itempattern=") {
			part, rest = rest, ""
		} else if i := strings.IndexByte(rest, ','); i >= 0 {
			part, rest = rest[:i], rest[i+1:]
		} else {
			part, rest = rest, ""
		}
		k, v, _ := strings.Cut(part, "=")
		switch k {
		case "required":
			r.required = true
		case "min":
			r.min = intp(v)
		case "max":
			r.max = intp(v)
		case "gt":
			r.gt = decp(v)
		case "ge":
			r.ge = decp(v)
		case "lt":
			r.lt = decp(v)
		case "le":
			r.le = decp(v)
		case "digits":
			r.digits = intp(v)
		case "places":
			r.places = intp(v)
		case "pattern":
			r.pattern = compile(v)
			r.patternSrc = v
			if named, ok := namedPatterns[v]; ok {
				r.patternSrc = named
			}
		case "oneof":
			r.oneof = strings.Split(v, "|")
		case "nostrip":
			r.nostrip = true
		case "blanknil":
			r.blankNil = true
		case "unique":
			// unique 或 unique=<字段名>：重复时报 "<字段名> contains duplicates"
			r.unique = true
			r.uniqueMsg = "image_ids contains duplicates"
			if v != "" {
				r.uniqueMsg = v + " contains duplicates"
			}
		case "itemmin":
			r.itemMin = intp(v)
		case "itemmax":
			r.itemMax = intp(v)
		case "itempattern":
			r.itemPat = compile(v)
		case "itemoneof":
			r.itemOneof = strings.Split(v, "|")
		case "":
		default:
			panic("unknown validation rule: " + k)
		}
	}
	return r
}

type fieldInfo struct {
	index int
	name  string
	rules *rules
}

var structCache sync.Map // reflect.Type → []fieldInfo

func structFields(t reflect.Type) []fieldInfo {
	if v, ok := structCache.Load(t); ok {
		return v.([]fieldInfo)
	}
	var out []fieldInfo
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if !f.IsExported() {
			continue
		}
		tag := f.Tag.Get("json")
		name, _, _ := strings.Cut(tag, ",")
		if name == "-" {
			continue
		}
		if name == "" {
			name = f.Name
		}
		out = append(out, fieldInfo{index: i, name: name, rules: parseRules(f.Tag.Get("v"))})
	}
	structCache.Store(t, out)
	return out
}

// ---------------- 解码 ----------------

// DecodeJSONBody 按 Pydantic RequestModel 的语义把 JSON 请求体解码进 dst（*struct）：
// 字段缺失保持 dst 原值（调用方预先填好默认值）、未知字段报 extra_forbidden、
// 字符串统一去首尾空白（str_strip_whitespace）、按 v 标签校验约束。
func DecodeJSONBody(raw []byte, dst any, loc []any) []FieldError {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return []FieldError{{Type: "missing", Loc: loc, Msg: "Field required", Input: nil}}
	}
	var generic any
	dec := json.NewDecoder(bytes.NewReader(trimmed))
	dec.UseNumber()
	if err := dec.Decode(&generic); err != nil {
		return []FieldError{{Type: "json_invalid", Loc: append(append([]any{}, loc...), 0), Msg: "JSON decode error", Input: map[string]any{}, Ctx: map[string]any{"error": err.Error()}}}
	}
	d := &decoder{}
	d.value(reflect.ValueOf(dst).Elem(), generic, loc, &rules{required: true})
	return d.errs
}

type decoder struct{ errs []FieldError }

func (d *decoder) add(typ string, loc []any, msg string, input any, ctx map[string]any) {
	d.errs = append(d.errs, FieldError{Type: typ, Loc: append([]any{}, loc...), Msg: msg, Input: input, Ctx: ctx})
}

func joinLoc(loc []any, k any) []any {
	out := make([]any, 0, len(loc)+1)
	out = append(out, loc...)
	return append(out, k)
}

var (
	decimalType = reflect.TypeOf(jtype.Decimal{})
	dateType    = reflect.TypeOf(jtype.Date{})
	utcType     = reflect.TypeOf(jtype.UTCTime{})
	rawType     = reflect.TypeOf(json.RawMessage{})
	jsonColType = reflect.TypeOf(jtype.JSON{})
)

// value 解码一个值。v 必须可写。
func (d *decoder) value(v reflect.Value, in any, loc []any, r *rules) {
	t := v.Type()
	// 三态字段
	if v.CanAddr() {
		if _, ok := v.Addr().Interface().(optMarker); ok {
			v.FieldByName("Set").SetBool(true)
			if in == nil {
				v.FieldByName("Null").SetBool(true)
				return
			}
			d.value(v.FieldByName("V"), in, loc, r)
			return
		}
	}
	if t.Kind() == reflect.Pointer {
		if in == nil {
			v.Set(reflect.Zero(t))
			return
		}
		if s, ok := in.(string); ok && r.blankNil && strings.TrimSpace(s) == "" {
			v.Set(reflect.Zero(t))
			return
		}
		nv := reflect.New(t.Elem())
		before := len(d.errs)
		d.value(nv.Elem(), in, loc, r)
		if len(d.errs) == before {
			v.Set(nv)
		}
		return
	}
	if in == nil && t != rawType && t.Kind() != reflect.Interface {
		d.nullError(t, loc)
		return
	}
	switch {
	case t == decimalType:
		d.decimal(v, in, loc, r)
		return
	case t == dateType:
		s, ok := in.(string)
		if !ok {
			d.add("date_type", loc, "Input should be a valid date", in, nil)
			return
		}
		var dt jtype.Date
		b, _ := json.Marshal(strings.TrimSpace(s))
		if err := dt.UnmarshalJSON(b); err != nil {
			d.add("date_from_datetime_parsing", loc, "Input should be a valid date or datetime", s, nil)
			return
		}
		v.Set(reflect.ValueOf(dt))
		return
	case t == utcType:
		s, ok := in.(string)
		if !ok {
			if n, ok := in.(json.Number); ok {
				s = n.String()
			} else {
				d.add("datetime_type", loc, "Input should be a valid datetime", in, nil)
				return
			}
		}
		tm, _, err := jtype.ParseISODateTime(s)
		if err != nil {
			d.add("datetime_from_date_parsing", loc, "Input should be a valid datetime or date", s, nil)
			return
		}
		v.Set(reflect.ValueOf(jtype.NewUTC(tm)))
		return
	case t == rawType || t == jsonColType:
		b, _ := json.Marshal(in)
		v.SetBytes(b)
		return
	}
	switch t.Kind() {
	case reflect.Interface:
		v.Set(reflect.ValueOf(normalizeNumbers(in)))
	case reflect.String:
		s, ok := in.(string)
		if !ok {
			d.add("string_type", loc, "Input should be a valid string", in, nil)
			return
		}
		if !r.nostrip {
			s = strings.TrimSpace(s)
		}
		d.checkString(s, loc, r)
		v.SetString(s)
	case reflect.Bool:
		b, ok := parseBoolAny(in)
		if !ok {
			d.add("bool_parsing", loc, "Input should be a valid boolean, unable to interpret input", in, nil)
			return
		}
		v.SetBool(b)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		n, ok := parseIntAny(in)
		if !ok {
			d.add("int_parsing", loc, "Input should be a valid integer, unable to parse string as an integer", in, nil)
			return
		}
		d.checkNumber(jtype.DecFromInt(n), loc, r, n)
		v.SetInt(n)
	case reflect.Float64, reflect.Float32:
		f, ok := parseFloatAny(in)
		if !ok {
			d.add("float_parsing", loc, "Input should be a valid number, unable to parse string as a number", in, nil)
			return
		}
		dv, _ := jtype.ParseDecimal(strconv.FormatFloat(f, 'f', -1, 64))
		d.checkNumber(dv, loc, r, f)
		v.SetFloat(f)
	case reflect.Slice:
		arr, ok := in.([]any)
		if !ok {
			d.add("list_type", loc, "Input should be a valid list", in, nil)
			return
		}
		out := reflect.MakeSlice(t, len(arr), len(arr))
		itemRules := &rules{required: true, min: r.itemMin, max: r.itemMax, pattern: r.itemPat, oneof: r.itemOneof}
		before := len(d.errs)
		for i, item := range arr {
			d.value(out.Index(i), item, joinLoc(loc, i), itemRules)
		}
		if r.min != nil && len(arr) < *r.min {
			d.add("too_short", loc, fmt.Sprintf("List should have at least %d item%s after validation, not %d", *r.min, plural(*r.min), len(arr)), in, map[string]any{"field_type": "List", "min_length": *r.min, "actual_length": len(arr)})
		}
		if r.max != nil && len(arr) > *r.max {
			d.add("too_long", loc, fmt.Sprintf("List should have at most %d item%s after validation, not %d", *r.max, plural(*r.max), len(arr)), in, map[string]any{"field_type": "List", "max_length": *r.max, "actual_length": len(arr)})
		}
		v.Set(out)
		if len(d.errs) == before && r.unique {
			seen := map[string]bool{}
			for i := 0; i < out.Len(); i++ {
				key := fmt.Sprint(out.Index(i).Interface())
				if seen[key] {
					d.errs = append(d.errs, ValueError(loc, r.uniqueMsg, in))
					break
				}
				seen[key] = true
			}
		}
	case reflect.Map:
		obj, ok := in.(map[string]any)
		if !ok {
			d.add("dict_type", loc, "Input should be a valid dictionary", in, nil)
			return
		}
		m := reflect.MakeMapWithSize(t, len(obj))
		for k, item := range obj {
			ev := reflect.New(t.Elem()).Elem()
			d.value(ev, item, joinLoc(loc, k), &rules{required: true})
			m.SetMapIndex(reflect.ValueOf(k), ev)
		}
		v.Set(m)
	case reflect.Struct:
		obj, ok := in.(map[string]any)
		if !ok {
			d.add("model_attributes_type", loc, "Input should be a valid dictionary or object to extract fields from", in, nil)
			return
		}
		d.object(v, obj, loc)
	default:
		panic("unsupported field type: " + t.String())
	}
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func (d *decoder) object(v reflect.Value, obj map[string]any, loc []any) {
	fields := structFields(v.Type())
	known := make(map[string]bool, len(fields))
	before := len(d.errs)
	for _, f := range fields {
		known[f.name] = true
		in, present := obj[f.name]
		floc := joinLoc(loc, f.name)
		if !present {
			if f.rules.required {
				d.add("missing", floc, "Field required", obj, nil)
			}
			continue
		}
		d.value(v.Field(f.index), in, floc, f.rules)
	}
	// 未知字段（extra="forbid"），按字段名排序保证输出稳定。
	var extras []string
	for k := range obj {
		if !known[k] {
			extras = append(extras, k)
		}
	}
	sortStrings(extras)
	for _, k := range extras {
		d.add("extra_forbidden", joinLoc(loc, k), "Extra inputs are not permitted", obj[k], nil)
	}
	if len(d.errs) == before && v.CanAddr() {
		if val, ok := v.Addr().Interface().(Validatable); ok {
			d.errs = append(d.errs, val.Validate(loc)...)
		}
	}
}

func (d *decoder) nullError(t reflect.Type, loc []any) {
	switch {
	case t == decimalType:
		d.add("decimal_type", loc, "Decimal input should be an integer, float, string or Decimal object", nil, nil)
	case t == dateType:
		d.add("date_type", loc, "Input should be a valid date", nil, nil)
	case t == utcType:
		d.add("datetime_type", loc, "Input should be a valid datetime", nil, nil)
	}
	switch t.Kind() {
	case reflect.String:
		d.add("string_type", loc, "Input should be a valid string", nil, nil)
	case reflect.Bool:
		d.add("bool_type", loc, "Input should be a valid boolean", nil, nil)
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		d.add("int_type", loc, "Input should be a valid integer", nil, nil)
	case reflect.Float32, reflect.Float64:
		d.add("float_type", loc, "Input should be a valid number", nil, nil)
	case reflect.Slice:
		d.add("list_type", loc, "Input should be a valid list", nil, nil)
	case reflect.Map:
		d.add("dict_type", loc, "Input should be a valid dictionary", nil, nil)
	case reflect.Struct:
		if t != decimalType && t != dateType && t != utcType {
			d.add("model_attributes_type", loc, "Input should be a valid dictionary or object to extract fields from", nil, nil)
		}
	}
}

func (d *decoder) checkString(s string, loc []any, r *rules) {
	n := utf8.RuneCountInString(s)
	if r.min != nil && n < *r.min {
		d.add("string_too_short", loc, fmt.Sprintf("String should have at least %d character%s", *r.min, plural(*r.min)), s, map[string]any{"min_length": *r.min})
	}
	if r.max != nil && n > *r.max {
		d.add("string_too_long", loc, fmt.Sprintf("String should have at most %d character%s", *r.max, plural(*r.max)), s, map[string]any{"max_length": *r.max})
	}
	if r.pattern != nil && !r.pattern.MatchString(s) {
		d.add("string_pattern_mismatch", loc, fmt.Sprintf("String should match pattern '%s'", r.patternSrc), s, map[string]any{"pattern": r.patternSrc})
	}
	if len(r.oneof) > 0 && !contains(r.oneof, s) {
		d.add("enum", loc, "Input should be "+describeOneOf(r.oneof), s, map[string]any{"expected": describeOneOf(r.oneof)})
	}
}

func describeOneOf(items []string) string {
	quoted := make([]string, len(items))
	for i, s := range items {
		quoted[i] = "'" + s + "'"
	}
	if len(quoted) <= 1 {
		return strings.Join(quoted, "")
	}
	return strings.Join(quoted[:len(quoted)-1], ", ") + " or " + quoted[len(quoted)-1]
}

func (d *decoder) decimal(v reflect.Value, in any, loc []any, r *rules) {
	var dv jtype.Decimal
	var err error
	switch x := in.(type) {
	case json.Number:
		dv, err = jtype.ParseDecimal(x.String())
	case string:
		dv, err = jtype.ParseDecimal(strings.TrimSpace(x))
		if err != nil {
			d.add("decimal_parsing", loc, "Input should be a valid decimal", in, nil)
			return
		}
	default:
		d.add("decimal_type", loc, "Decimal input should be an integer, float, string or Decimal object", in, nil)
		return
	}
	if err != nil {
		d.add("decimal_parsing", loc, "Input should be a valid decimal", in, nil)
		return
	}
	d.checkNumber(dv, loc, r, in)
	if r.digits != nil && dv.Digits() > *r.digits {
		d.add("decimal_max_digits", loc, fmt.Sprintf("Decimal input should have no more than %d digit%s in total", *r.digits, plural(*r.digits)), in, map[string]any{"max_digits": *r.digits})
	}
	if r.places != nil && int(dv.Places()) > *r.places {
		d.add("decimal_max_places", loc, fmt.Sprintf("Decimal input should have no more than %d decimal place%s", *r.places, plural(*r.places)), in, map[string]any{"decimal_places": *r.places})
	}
	if r.digits != nil && r.places != nil && len(d.errs) == 0 {
		whole := dv.Digits() - int(dv.Places())
		if whole > *r.digits-*r.places {
			d.add("decimal_whole_digits", loc, fmt.Sprintf("Decimal input should have no more than %d digit%s before the decimal point", *r.digits-*r.places, plural(*r.digits-*r.places)), in, map[string]any{"whole_digits": *r.digits - *r.places})
		}
	}
	v.Set(reflect.ValueOf(dv))
}

func (d *decoder) checkNumber(n jtype.Decimal, loc []any, r *rules, input any) {
	if r.gt != nil && !n.GreaterThan(r.gt.Decimal) {
		d.add("greater_than", loc, "Input should be greater than "+r.gt.Normalized(), input, map[string]any{"gt": numCtx(r.gt)})
	}
	if r.ge != nil && n.LessThan(r.ge.Decimal) {
		d.add("greater_than_equal", loc, "Input should be greater than or equal to "+r.ge.Normalized(), input, map[string]any{"ge": numCtx(r.ge)})
	}
	if r.lt != nil && !n.LessThan(r.lt.Decimal) {
		d.add("less_than", loc, "Input should be less than "+r.lt.Normalized(), input, map[string]any{"lt": numCtx(r.lt)})
	}
	if r.le != nil && n.GreaterThan(r.le.Decimal) {
		d.add("less_than_equal", loc, "Input should be less than or equal to "+r.le.Normalized(), input, map[string]any{"le": numCtx(r.le)})
	}
	if len(r.oneof) > 0 && !contains(r.oneof, n.Normalized()) {
		d.add("literal_error", loc, "Input should be "+describeOneOf(r.oneof), input, nil)
	}
}

func numCtx(d *jtype.Decimal) any {
	if d.IsInteger() {
		return d.IntPart()
	}
	f, _ := d.Float64()
	return f
}

// ---------------- 宽松类型转换（Pydantic lax 模式） ----------------

func parseIntAny(in any) (int64, bool) {
	switch x := in.(type) {
	case json.Number:
		if n, err := x.Int64(); err == nil {
			return n, true
		}
		f, err := x.Float64()
		if err != nil || f != math.Trunc(f) || math.IsInf(f, 0) {
			return 0, false
		}
		return int64(f), true
	case string:
		return ParseIntString(x)
	case bool:
		if x {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

// ParseIntString 解析整数字符串（允许首尾空白与下划线分隔、允许 "1.0" 这种整数值小数）。
func ParseIntString(s string) (int64, bool) {
	s = strings.TrimSpace(s)
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return n, true
	}
	if strings.Contains(s, "_") {
		if n, err := strconv.ParseInt(strings.ReplaceAll(s, "_", ""), 10, 64); err == nil {
			return n, true
		}
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil && f == math.Trunc(f) && !strings.ContainsAny(s, "eEnN") {
		return int64(f), true
	}
	return 0, false
}

func parseFloatAny(in any) (float64, bool) {
	switch x := in.(type) {
	case json.Number:
		f, err := x.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(x), 64)
		return f, err == nil
	case bool:
		if x {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

func parseBoolAny(in any) (bool, bool) {
	switch x := in.(type) {
	case bool:
		return x, true
	case json.Number:
		switch x.String() {
		case "0", "0.0":
			return false, true
		case "1", "1.0":
			return true, true
		}
	case string:
		return ParseBoolString(x)
	}
	return false, false
}

// ParseBoolString 与 Pydantic 一致的布尔字符串解析。
func ParseBoolString(s string) (bool, bool) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "0", "off", "f", "false", "n", "no":
		return false, true
	case "1", "on", "t", "true", "y", "yes":
		return true, true
	}
	return false, false
}

func normalizeNumbers(in any) any {
	switch x := in.(type) {
	case json.Number:
		if n, err := x.Int64(); err == nil {
			return n
		}
		f, _ := x.Float64()
		return f
	case []any:
		for i := range x {
			x[i] = normalizeNumbers(x[i])
		}
		return x
	case map[string]any:
		for k := range x {
			x[k] = normalizeNumbers(x[k])
		}
		return x
	}
	return in
}

func contains(items []string, s string) bool {
	for _, item := range items {
		if item == s {
			return true
		}
	}
	return false
}

func sortStrings(items []string) {
	for i := 1; i < len(items); i++ {
		for j := i; j > 0 && items[j] < items[j-1]; j-- {
			items[j], items[j-1] = items[j-1], items[j]
		}
	}
}
