package web

import (
	"strconv"
	"strings"
	"sync"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// Params 收集路径 / 查询 / 请求头 / 请求体参数的校验错误，最后由 Err() 一次性返回 422。
//
// 用法（依赖执行完之后）：
//
//	p := c.Params()
//	id := p.PathInt("item_id")
//	page := p.QueryInt("page", 1, "ge=1")
//	keyword := p.QueryStr("keyword", "max=128")   // *string，未传为 nil
//	body := MemoCreate{Title: ""}                  // 预填默认值
//	p.Body(&body)
//	if err := p.Err(); err != nil { return err }
type Params struct {
	c    *Ctx
	errs []FieldError
}

func (c *Ctx) Params() *Params { return &Params{c: c} }

// Err 有任何参数错误时返回 *ValidationError。
func (p *Params) Err() error {
	if len(p.errs) == 0 {
		return nil
	}
	return &ValidationError{Errors: p.errs}
}

// Add 追加自定义错误。
func (p *Params) Add(e ...FieldError) { p.errs = append(p.errs, e...) }

func (p *Params) fail(typ string, loc []any, msg string, input any) {
	p.errs = append(p.errs, FieldError{Type: typ, Loc: loc, Msg: msg, Input: input})
}

func (p *Params) checkStr(loc []any, s string, tag string) {
	if tag == "" {
		return
	}
	d := &decoder{}
	d.checkString(s, loc, parseRulesCached(tag))
	p.errs = append(p.errs, d.errs...)
}

func (p *Params) checkNum(loc []any, n jtype.Decimal, input any, tag string) {
	if tag == "" {
		return
	}
	d := &decoder{}
	d.checkNumber(n, loc, parseRulesCached(tag), input)
	p.errs = append(p.errs, d.errs...)
}

var tagCache sync.Map // tag → *rules

func parseRulesCached(tag string) *rules {
	if r, ok := tagCache.Load(tag); ok {
		return r.(*rules)
	}
	r := parseRules(tag)
	tagCache.Store(tag, r)
	return r
}

// ---------------- 路径参数 ----------------

// PathInt 解析整数路径参数（失败记 int_parsing）。
func (p *Params) PathInt(name string) int64 {
	raw := p.c.Param(name)
	n, ok := ParseIntString(raw)
	if !ok {
		p.fail("int_parsing", []any{"path", name}, "Input should be a valid integer, unable to parse string as an integer", raw)
	}
	return n
}

// PathStr 读取字符串路径参数并按 tag 校验。
func (p *Params) PathStr(name, tag string) string {
	raw := p.c.Param(name)
	p.checkStr([]any{"path", name}, raw, tag)
	return raw
}

// ---------------- 查询参数 ----------------

func (p *Params) rawQuery(name string) (string, bool) {
	vals, ok := p.c.Request.URL.Query()[name]
	if !ok || len(vals) == 0 {
		return "", false
	}
	// FastAPI 对标量参数取最后一个值。
	return vals[len(vals)-1], true
}

// QueryStr 可选字符串查询参数：未传返回 nil；按 tag 校验（max=128 等）。
func (p *Params) QueryStr(name, tag string) *string {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil
	}
	p.checkStr([]any{"query", name}, raw, tag)
	return &raw
}

// QueryStrDefault 带默认值的字符串查询参数。
func (p *Params) QueryStrDefault(name, def, tag string) string {
	raw, ok := p.rawQuery(name)
	if !ok {
		return def
	}
	p.checkStr([]any{"query", name}, raw, tag)
	return raw
}

// QueryStrRequired 必填字符串查询参数。
func (p *Params) QueryStrRequired(name, tag string) string {
	raw, ok := p.rawQuery(name)
	if !ok {
		p.fail("missing", []any{"query", name}, "Field required", nil)
		return ""
	}
	p.checkStr([]any{"query", name}, raw, tag)
	return raw
}

// QueryInt 带默认值的整数查询参数（tag 例："ge=1,le=200"）。
func (p *Params) QueryInt(name string, def int64, tag string) int64 {
	raw, ok := p.rawQuery(name)
	if !ok {
		return def
	}
	n, ok := ParseIntString(raw)
	if !ok {
		p.fail("int_parsing", []any{"query", name}, "Input should be a valid integer, unable to parse string as an integer", raw)
		return def
	}
	p.checkNum([]any{"query", name}, jtype.DecFromInt(n), raw, tag)
	return n
}

// QueryIntPtr 可选整数查询参数。
func (p *Params) QueryIntPtr(name, tag string) *int64 {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil
	}
	n, ok := ParseIntString(raw)
	if !ok {
		p.fail("int_parsing", []any{"query", name}, "Input should be a valid integer, unable to parse string as an integer", raw)
		return nil
	}
	p.checkNum([]any{"query", name}, jtype.DecFromInt(n), raw, tag)
	return &n
}

// QueryIntRequired 必填整数查询参数。
func (p *Params) QueryIntRequired(name, tag string) int64 {
	if _, ok := p.rawQuery(name); !ok {
		p.fail("missing", []any{"query", name}, "Field required", nil)
		return 0
	}
	v := p.QueryIntPtr(name, tag)
	if v == nil {
		return 0
	}
	return *v
}

// QueryBool 带默认值的布尔查询参数。
func (p *Params) QueryBool(name string, def bool) bool {
	v := p.QueryBoolPtr(name)
	if v == nil {
		return def
	}
	return *v
}

// QueryBoolPtr 可选布尔查询参数。
func (p *Params) QueryBoolPtr(name string) *bool {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil
	}
	b, ok := ParseBoolString(raw)
	if !ok {
		p.fail("bool_parsing", []any{"query", name}, "Input should be a valid boolean, unable to interpret input", raw)
		return nil
	}
	return &b
}

// QueryDate 可选日期查询参数（YYYY-MM-DD）。
func (p *Params) QueryDate(name string) *jtype.Date {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil
	}
	var d jtype.Date
	if err := d.UnmarshalJSON([]byte(strconv.Quote(raw))); err != nil {
		p.fail("date_from_datetime_parsing", []any{"query", name}, "Input should be a valid date or datetime", raw)
		return nil
	}
	return &d
}

// QueryDateRequired 必填日期查询参数。
func (p *Params) QueryDateRequired(name string) jtype.Date {
	if _, ok := p.rawQuery(name); !ok {
		p.fail("missing", []any{"query", name}, "Field required", nil)
		return jtype.Date{}
	}
	if d := p.QueryDate(name); d != nil {
		return *d
	}
	return jtype.Date{}
}

// QueryDateTime 可选时间查询参数（ISO 8601）；返回 UTC 时间与是否带时区。
func (p *Params) QueryDateTime(name string) (*jtype.UTCTime, bool) {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil, false
	}
	t, aware, err := jtype.ParseISODateTime(raw)
	if err != nil {
		p.fail("datetime_from_date_parsing", []any{"query", name}, "Input should be a valid datetime or date", raw)
		return nil, false
	}
	u := jtype.NewUTC(t)
	return &u, aware
}

// QueryStrList 重复出现的字符串查询参数（?a=1&a=2）；未传返回 nil。
func (p *Params) QueryStrList(name, itemTag string) []string {
	vals, ok := p.c.Request.URL.Query()[name]
	if !ok {
		return nil
	}
	for i, v := range vals {
		p.checkStr([]any{"query", name, i}, v, itemTag)
	}
	return vals
}

// QueryIntList 重复出现的整数查询参数；未传返回 nil。
func (p *Params) QueryIntList(name string) []int64 {
	vals, ok := p.c.Request.URL.Query()[name]
	if !ok {
		return nil
	}
	out := make([]int64, 0, len(vals))
	for i, v := range vals {
		n, ok := ParseIntString(v)
		if !ok {
			p.fail("int_parsing", []any{"query", name, i}, "Input should be a valid integer, unable to parse string as an integer", v)
			continue
		}
		out = append(out, n)
	}
	return out
}

// QueryDecimal 可选十进制查询参数。
func (p *Params) QueryDecimal(name, tag string) *jtype.Decimal {
	raw, ok := p.rawQuery(name)
	if !ok {
		return nil
	}
	d, err := jtype.ParseDecimal(raw)
	if err != nil {
		p.fail("decimal_parsing", []any{"query", name}, "Input should be a valid decimal", raw)
		return nil
	}
	p.checkNum([]any{"query", name}, d, raw, tag)
	return &d
}

// ---------------- 分页 ----------------

// Page 读取 page / page_size（默认 1 / 20，page_size ≤ 200），对应 api/deps.py 的 PageNo / PageSize。
func (p *Params) Page() (page, pageSize int64) {
	return p.QueryInt("page", 1, "ge=1"), p.QueryInt("page_size", 20, "ge=1,le=200")
}

// PageWithDefault 自定义默认 page_size。
func (p *Params) PageWithDefault(defSize int64) (page, pageSize int64) {
	return p.QueryInt("page", 1, "ge=1"), p.QueryInt("page_size", defSize, "ge=1,le=200")
}

// ---------------- 请求头 ----------------

// IfMatch 读取乐观锁版本号（If-Match 头）；缺失或不可解析返回 nil。
func (p *Params) IfMatch() *int64 {
	raw := strings.TrimSpace(p.c.GetHeader("If-Match"))
	if raw == "" {
		return nil
	}
	n, err := strconv.ParseInt(strings.Trim(raw, `"`), 10, 64)
	if err != nil {
		return nil
	}
	return &n
}

// ---------------- 请求体 ----------------

// Body 解码 JSON 请求体到 dst（预填默认值的结构体指针）。
func (p *Params) Body(dst any) {
	raw, err := p.c.RawBody()
	if err != nil {
		p.fail("json_invalid", []any{"body"}, "JSON decode error", nil)
		return
	}
	p.errs = append(p.errs, DecodeJSONBody(raw, dst, []any{"body"})...)
}
