package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// eventTitle 对应 _event_title。
func eventTitle(eventType string) string {
	switch eventType {
	case domain.EventStockOutboundCreated:
		return "出库通知"
	case domain.EventStockInboundCreated:
		return "入库通知"
	case domain.EventMiniProgramUserBound:
		return "新用户绑定通知"
	case "webhook.test":
		return "测试通知"
	}
	return "通知"
}

// pyStr 近似 Python str(value)（JSON 解码出的值）。
func pyStr(v any) string {
	switch x := v.(type) {
	case nil:
		return "None"
	case string:
		return x
	case bool:
		if x {
			return "True"
		}
		return "False"
	case json.Number:
		if _, err := x.Int64(); err == nil {
			return x.String()
		}
		if f, err := x.Float64(); err == nil {
			return pyFloatRepr(f)
		}
		return x.String()
	case float64:
		if x == math.Trunc(x) && math.Abs(x) < 1e16 {
			return strconv.FormatInt(int64(x), 10)
		}
		return pyFloatRepr(x)
	case int, int64, int32:
		return fmt.Sprint(x)
	case []any:
		parts := make([]string, len(x))
		for i, it := range x {
			parts[i] = pyRepr(it)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case map[string]any:
		parts := make([]string, 0, len(x))
		for k, it := range x {
			parts = append(parts, pyRepr(k)+": "+pyRepr(it))
		}
		return "{" + strings.Join(parts, ", ") + "}"
	}
	return fmt.Sprint(v)
}

func pyRepr(v any) string {
	if s, ok := v.(string); ok {
		return "'" + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), "'", `\'`) + "'"
	}
	return pyStr(v)
}

func pyFloatRepr(f float64) string {
	s := strconv.FormatFloat(f, 'g', -1, 64)
	if !strings.ContainsAny(s, ".eEn") {
		s += ".0"
	}
	return s
}

// truthy 等价 Python 的真值判断（JSON 值）。
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case string:
		return x != ""
	case bool:
		return x
	case json.Number:
		f, err := x.Float64()
		return err != nil || f != 0
	case float64:
		return x != 0
	case int:
		return x != 0
	case int64:
		return x != 0
	case []any:
		return len(x) > 0
	case map[string]any:
		return len(x) > 0
	}
	return true
}

// orDash 等价 str(value or "-")。
func orDash(v any) string {
	if truthy(v) {
		return pyStr(v)
	}
	return "-"
}

// getOr 等价 data.get(key, default) 再 f-string 格式化。
func getOr(m map[string]any, key string) string {
	if v, ok := m[key]; ok {
		return pyStr(v)
	}
	return "-"
}

func pyStrip(s string) string { return strings.TrimFunc(s, common.PyIsSpace) }

// orEmptyStripped 等价 str(value or "").strip()。
func orEmptyStripped(v any) string {
	if truthy(v) {
		return pyStrip(pyStr(v))
	}
	return ""
}

// quantityText 对应 _quantity_text：format(Decimal(str(v)), "f").rstrip("0").rstrip(".") or "0"；
// 无法解析时原样输出。注意与原实现逐字一致：没有小数点的整数也会被 rstrip("0")（如 "10" → "1"）。
func quantityText(v any) string {
	if v == nil {
		return "-"
	}
	if s, ok := v.(string); ok && s == "" {
		return "-"
	}
	text := pyStr(v)
	d, err := decimal.NewFromString(pyStrip(strings.ReplaceAll(text, "_", "")))
	if err != nil {
		return text
	}
	var fixed string
	if d.Exponent() < 0 {
		fixed = d.StringFixed(-d.Exponent())
	} else {
		fixed = d.String()
	}
	fixed = strings.TrimRight(strings.TrimRight(fixed, "0"), ".")
	if fixed == "" {
		return "0"
	}
	return fixed
}

func joinNonEmpty(parts ...string) string {
	var out []string
	for _, p := range parts {
		if p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " ")
}

// messageText 对应 _message_text：返回 (标题, 正文)。
func messageText(payload map[string]any) (string, string) {
	eventType := ""
	if v, ok := payload["event_type"]; ok {
		eventType = pyStr(v)
	}
	title := eventTitle(eventType)
	data, _ := payload["data"].(map[string]any)
	if data == nil {
		data = map[string]any{}
	}
	var details []string
	switch eventType {
	case "webhook.test":
		details = []string{"这是一条 Webhook 测试通知。"}
	case domain.EventStockOutboundCreated:
		materials, _ := data["materials"].([]any)
		if len(materials) == 1 {
			if material, ok := materials[0].(map[string]any); ok {
				name := orDash(material["name"])
				modelSpec := orEmptyStripped(material["model_spec"])
				materialText := joinNonEmpty(name, modelSpec)
				quantity := quantityText(material["quantity"])
				unitName := orEmptyStripped(material["unit_name"])
				details = []string{"物资：" + materialText, "数量：" + quantity + unitName}
			}
		}
		if details == nil {
			details = []string{fmt.Sprintf("物资：%d项物资", len(materials))}
		}
		purpose := joinNonEmpty(orEmptyStripped(data["subitem_no"]), orEmptyStripped(data["business_reason"]))
		if purpose == "" {
			purpose = "-"
		}
		details = append(details, "领用人："+orDash(data["receiver_name"]), "用途："+purpose)
	case domain.EventStockInboundCreated:
		materials, _ := data["materials"].([]any)
		details = []string{fmt.Sprintf("入库数量：%d 项", len(materials))}
	default:
		status := "待审核"
		if truthy(data["enabled"]) {
			status = "已启用"
		}
		details = []string{
			"姓名：" + getOr(data, "display_name"),
			"部门：" + getOr(data, "department_name"),
			"账号状态：" + status,
			"绑定时间：" + getOr(data, "bound_at"),
		}
	}
	projectName := orEmptyStripped(data["project_name"])
	if projectName != "" && eventType != "webhook.test" {
		// 多项目后同一条通知必须能看出属于哪个项目（渠道是全局的，各项目共用）。
		details = append([]string{"项目：" + projectName}, details...)
	}
	return title, strings.Join(details, "\n")
}

var nowFunc = time.Now

// feishuBody 对应 _feishu_body：有密钥时附带 timestamp + sign（以 "timestamp\nsecret" 为 HMAC 密钥签空串）。
func feishuBody(payload map[string]any, secret string) map[string]any {
	title, text := messageText(payload)
	body := map[string]any{
		"msg_type": "text",
		"content":  map[string]any{"text": title + "\n" + text},
	}
	if secret != "" {
		timestamp := strconv.FormatInt(nowFunc().Unix(), 10)
		mac := hmac.New(sha256.New, []byte(timestamp+"\n"+secret))
		body["timestamp"] = timestamp
		body["sign"] = base64.StdEncoding.EncodeToString(mac.Sum(nil))
	}
	return body
}

// quotePlus 等价 urllib.parse.quote_plus(s)。
func quotePlus(s string) string {
	return strings.ReplaceAll(web.PyQuote(s, " "), " ", "+")
}

// unquotePlus 等价 urllib.parse.unquote_plus(s)（非法转义原样保留）。
func unquotePlus(s string) string {
	s = strings.ReplaceAll(s, "+", " ")
	var out []byte
	for i := 0; i < len(s); i++ {
		if s[i] == '%' && i+2 < len(s) && isHex(s[i+1]) && isHex(s[i+2]) {
			v, _ := strconv.ParseUint(s[i+1:i+3], 16, 8)
			out = append(out, byte(v))
			i += 2
			continue
		}
		out = append(out, s[i])
	}
	return strings.ToValidUTF8(string(out), "�")
}

func isHex(c byte) bool {
	return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

// dingtalkRequest 对应 _dingtalk_request：有密钥时在 URL 查询串追加 timestamp + sign。
func dingtalkRequest(webhookURL string, payload map[string]any, secret string) (string, map[string]any) {
	title, text := messageText(payload)
	if secret != "" {
		timestamp := strconv.FormatInt(nowFunc().UnixMilli(), 10)
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write([]byte(timestamp + "\n" + secret))
		sign := base64.StdEncoding.EncodeToString(mac.Sum(nil))
		webhookURL = withQuery(webhookURL, [][2]string{{"timestamp", timestamp}, {"sign", sign}})
	}
	markdown := strings.ReplaceAll(text, "\n", "\n\n")
	return webhookURL, map[string]any{
		"msgtype": "markdown",
		"markdown": map[string]any{
			"title": title,
			"text":  "### " + title + "\n\n" + markdown,
		},
	}
}

// withQuery 等价 dict(parse_qsl(query, keep_blank_values=True)).update(extra) 后 urlencode 回写。
func withQuery(raw string, extra [][2]string) string {
	base, fragment, hasFragment := strings.Cut(raw, "#")
	prefix, query, _ := strings.Cut(base, "?")
	var keys []string
	values := map[string]string{}
	set := func(k, v string) {
		if _, ok := values[k]; !ok {
			keys = append(keys, k)
		}
		values[k] = v
	}
	if query != "" {
		for _, pair := range strings.Split(query, "&") {
			if pair == "" {
				continue
			}
			k, v, _ := strings.Cut(pair, "=")
			set(unquotePlus(k), unquotePlus(v))
		}
	}
	for _, kv := range extra {
		set(kv[0], kv[1])
	}
	parts := make([]string, len(keys))
	for i, k := range keys {
		parts[i] = quotePlus(k) + "=" + quotePlus(values[k])
	}
	out := prefix + "?" + strings.Join(parts, "&")
	if hasFragment {
		out += "#" + fragment
	}
	return out
}
