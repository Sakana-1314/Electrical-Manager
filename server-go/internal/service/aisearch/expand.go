package aisearch

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	cacheTTL              = 30 * time.Minute
	maxExpansionsPerTerm  = 6
	responseTimeout       = 10 * time.Second
	testResponseTimeout   = 30 * time.Second
	connectTimeout        = 3 * time.Second
	maxCacheEntries       = 1000
	maxCandidateRuneCount = 64
)

// ---------------- 扩展结果缓存（进程内，TTL 30 分钟，最多 1000 条，满员淘汰最早插入） ----------------

type cacheEntry struct {
	at     time.Time // 单调时钟
	result []string
}

var (
	cacheMu    sync.Mutex
	cache      = map[string]cacheEntry{}
	cacheOrder []string // 插入顺序（与 Python dict 保序一致：覆盖已有键不改变位置）
)

func cacheKey(version int64, terms []string) string {
	return strconv.FormatInt(version, 10) + "\x00" + strings.Join(terms, "\x00")
}

func cacheGet(key string, now time.Time) ([]string, bool) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	e, ok := cache[key]
	if ok && now.Sub(e.at) < cacheTTL {
		return e.result, true
	}
	return nil, false
}

func cachePut(key string, now time.Time, result []string) {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if _, exists := cache[key]; !exists {
		if len(cache) >= maxCacheEntries && len(cacheOrder) > 0 {
			oldest := cacheOrder[0]
			cacheOrder = cacheOrder[1:]
			delete(cache, oldest)
		}
		cacheOrder = append(cacheOrder, key)
	}
	cache[key] = cacheEntry{at: now, result: result}
}

func clearCache() {
	cacheMu.Lock()
	defer cacheMu.Unlock()
	cache = map[string]cacheEntry{}
	cacheOrder = nil
}

// ---------------- 纯函数 ----------------

// searchTerms 对应 _search_terms：按 | / ｜ 拆分、去空白、去重保序。
func searchTerms(value *string) []string {
	if value == nil || *value == "" {
		return nil
	}
	return common.SplitOrSearchTerms(value)
}

func joinTerms(terms []string) string { return strings.Join(terms, "|") }

// completionURL 对应 _completion_url。
func completionURL(endpoint string) string {
	endpoint = strings.TrimRight(endpoint, "/")
	if strings.HasSuffix(endpoint, "/chat/completions") {
		return endpoint
	}
	return endpoint + "/chat/completions"
}

// pyJSONString 等价 json.dumps(s, ensure_ascii=False) 的字符串部分。
func pyJSONString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		default:
			if r < 0x20 {
				fmt.Fprintf(&b, `\u%04x`, r)
			} else {
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

// userContent 等价 json.dumps({"input_terms": terms}, ensure_ascii=False)。
func userContent(terms []string) string {
	quoted := make([]string, len(terms))
	for i, t := range terms {
		quoted[i] = pyJSONString(t)
	}
	return `{"input_terms": [` + strings.Join(quoted, ", ") + `]}`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type completionRequest struct {
	Model          string            `json:"model"`
	Messages       []chatMessage     `json:"messages"`
	Temperature    int               `json:"temperature"`
	MaxTokens      int               `json:"max_tokens"`
	Stream         bool              `json:"stream"`
	Thinking       map[string]string `json:"thinking,omitempty"`
	ResponseFormat map[string]string `json:"response_format,omitempty"`
}

// completionPayload 对应 _completion_payload。
func completionPayload(model string, terms []string) completionRequest {
	systemPrompt := "你是工业备件搜索词扩展器。必须只返回一个 JSON 对象，不得输出 Markdown、解释或其他文本。" +
		"JSON 结构固定为 {\"expansions\":[[\"原词\",\"同义词\"]]}。" +
		fmt.Sprintf("expansions 必须包含且仅包含 %d 个子数组，", len(terms)) +
		"第 i 个子数组必须对应 input_terms 的第 i 个词。" +
		"每个子数组必须保留原词，并最多补充 5 个含义高度一致的同义词、常用别名或规范名称。" +
		"不得补充上下位类别、品牌或型号。"
	p := completionRequest{
		Model: model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent(terms)},
		},
		Temperature: 0,
		MaxTokens:   180,
		Stream:      false,
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "glm-") {
		p.Thinking = map[string]string{"type": "disabled"}
		p.ResponseFormat = map[string]string{"type": "json_object"}
	}
	return p
}

func truncRunes(s string, n int) string { return common.TruncateRunes(s, n) }

var fencedRe = regexp.MustCompile(`(?s)\A` + "```" + `(?:json)?\s*(.*?)\s*` + "```" + `\z`)

func decodeJSON(s string) (any, error) {
	dec := json.NewDecoder(strings.NewReader(s))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, err
	}
	// json.loads 不允许尾随内容（空白除外）。
	if _, err := dec.Token(); err != io.EOF {
		return nil, errors.New("extra data")
	}
	return v, nil
}

// rawDecodeObject 等价 json.JSONDecoder().raw_decode(content[index:]) 并要求结果为对象。
func rawDecodeObject(s string) (map[string]any, bool) {
	dec := json.NewDecoder(strings.NewReader(s))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return nil, false
	}
	m, ok := v.(map[string]any)
	return m, ok
}

// extractJSON 对应 _extract_json：去掉 ``` 围栏；整体不是 JSON 时取第一个可解析的 {…} 对象。
func extractJSON(content string) (map[string]any, error) {
	content = strings.TrimFunc(content, common.PyIsSpace)
	if m := fencedRe.FindStringSubmatch(content); m != nil {
		content = m[1]
	}
	payload, err := decodeJSON(content)
	if err != nil {
		for i, ch := range content {
			if ch != '{' {
				continue
			}
			if obj, ok := rawDecodeObject(content[i:]); ok {
				return obj, nil
			}
		}
		return nil, apperr.New("AI_INVALID_RESPONSE", "AI 返回内容不是有效 JSON，请检查模型是否支持 JSON 输出模式").
			WithStatus(502).
			WithDetails(apperr.D{"content_preview": truncRunes(content, 300)})
	}
	if obj, ok := payload.(map[string]any); ok {
		return obj, nil
	}
	return nil, apperr.New("AI_INVALID_RESPONSE", "AI 返回的 JSON 顶层结构不是对象").
		WithStatus(502).
		WithDetails(apperr.D{"content_preview": truncRunes(content, 300)})
}

func allStrings(items []any) bool {
	for _, it := range items {
		if _, ok := it.(string); !ok {
			return false
		}
	}
	return true
}

func allObjects(items []any) bool {
	for _, it := range items {
		if _, ok := it.(map[string]any); !ok {
			return false
		}
	}
	return true
}

// firstPresent 等价 item.get(a, item.get(b, item.get(c, default)))。
func firstPresent(m map[string]any, keys []string, def any) any {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			return v
		}
	}
	return def
}

// expansionGroups 对应 _expansion_groups：兼容数组 / 以原词为键的对象 / 单词扁平数组 / 对象数组。
func expansionGroups(payload map[string]any, terms []string, content string) ([][]string, error) {
	raw, present := payload["expansions"]
	var groups any = raw
	if !present {
		groups = nil
	}
	switch g := raw.(type) {
	case map[string]any:
		list := make([]any, len(terms))
		for i, t := range terms {
			if v, ok := g[t]; ok {
				list[i] = v
			} else {
				list[i] = []any{}
			}
		}
		groups = list
	case []any:
		if len(terms) == 1 && allStrings(g) {
			groups = []any{g}
		} else if allObjects(g) {
			byOriginal := map[string]any{}
			for _, it := range g {
				item := it.(map[string]any)
				values := firstPresent(item, []string{"terms", "synonyms", "expansions"}, []any{})
				if original, ok := item["original"].(string); ok {
					byOriginal[original] = values
				}
			}
			list := make([]any, len(terms))
			for i, t := range terms {
				if v, ok := byOriginal[t]; ok {
					list[i] = v
				} else {
					list[i] = []any{}
				}
			}
			groups = list
		}
	}

	list, isList := groups.([]any)
	if !isList || len(list) != len(terms) {
		var actual any
		actualText := "不是数组"
		if isList {
			actual = len(list)
			actualText = strconv.Itoa(len(list))
		}
		return nil, apperr.New("AI_INVALID_RESPONSE", fmt.Sprintf("AI 返回的扩展词分组数量不匹配：期望 %d 组，实际 %s", len(terms), actualText)).
			WithStatus(502).
			WithDetails(apperr.D{"expected_count": len(terms), "actual_count": actual, "content_preview": truncRunes(content, 300)})
	}
	normalized := make([][]string, 0, len(list))
	for _, group := range list {
		switch g := group.(type) {
		case []any:
			items := []string{}
			for _, it := range g {
				if s, ok := it.(string); ok {
					items = append(items, s)
				}
			}
			normalized = append(normalized, items)
		case string:
			normalized = append(normalized, []string{g})
		default:
			normalized = append(normalized, []string{})
		}
	}
	return normalized, nil
}

// mergeExpansions 每个原词最多取 6 个候选（含原词），去空、去超长（>64 字符）、全局去重保序。
func mergeExpansions(terms []string, groups [][]string) []string {
	expanded := []string{}
	seen := map[string]bool{}
	for i, original := range terms {
		candidates := []string{original}
		for _, item := range groups[i] {
			candidates = append(candidates, strings.TrimFunc(item, common.PyIsSpace))
		}
		if len(candidates) > maxExpansionsPerTerm {
			candidates = candidates[:maxExpansionsPerTerm]
		}
		for _, c := range candidates {
			if c != "" && utf8.RuneCountInString(c) <= maxCandidateRuneCount && !seen[c] {
				expanded = append(expanded, c)
				seen[c] = true
			}
		}
	}
	return expanded
}

// ---------------- 上游错误映射 ----------------

// upstreamErrorReason 对应 _upstream_error_reason。
func upstreamErrorReason(body []byte) string {
	v, err := decodeJSON(string(body))
	if err != nil {
		return ""
	}
	payload, ok := v.(map[string]any)
	if !ok {
		return ""
	}
	switch e := payload["error"].(type) {
	case map[string]any:
		if msg, ok := e["message"].(string); ok {
			return truncRunes(msg, 300)
		}
	case string:
		return truncRunes(e, 300)
	}
	for _, key := range []string{"message", "detail"} {
		if s, ok := payload[key].(string); ok {
			return truncRunes(s, 300)
		}
	}
	return ""
}

// upstreamStatusError 对应 _raise_upstream_status_error。
func upstreamStatusError(status int, body []byte) *apperr.Error {
	reason := upstreamErrorReason(body)
	details := apperr.D{"upstream_status": status}
	if reason != "" {
		details["reason"] = reason
	}
	var code, message string
	var responseStatus int
	switch {
	case status == 401 || status == 403:
		code, message, responseStatus = "AI_AUTH_FAILED", "AI 服务鉴权失败，请检查 API Key 是否正确且具有模型访问权限", 400
	case status == 404:
		code, message, responseStatus = "AI_ENDPOINT_NOT_FOUND", "AI 接口或模型不存在，请检查端点路径和模型名称", 400
	case status == 429:
		code, message, responseStatus = "AI_RATE_LIMITED", "AI 服务请求过于频繁或额度不足，请检查账户额度后重试", 429
	case status >= 400 && status < 500:
		code, message, responseStatus = "AI_REQUEST_REJECTED", "AI 服务拒绝了请求，请检查端点格式、模型名称和接口兼容性", 400
	default:
		code, message, responseStatus = "AI_UPSTREAM_FAILED", fmt.Sprintf("AI 上游服务返回 HTTP %d，请检查服务状态或稍后重试", status), 502
	}
	if reason != "" {
		message = message + "：" + reason
	}
	return apperr.New(code, message).WithStatus(responseStatus).WithDetails(details)
}

// pyFloat 让 JSON 里的秒数与 Python float 输出一致（30.0 而不是 30）。
func pyFloat(d time.Duration) json.Number {
	s := strconv.FormatFloat(d.Seconds(), 'f', -1, 64)
	if !strings.ContainsAny(s, ".eE") {
		s += ".0"
	}
	return json.Number(s)
}

// pyG 等价 f"{seconds:g}"。
func pyG(d time.Duration) string { return strconv.FormatFloat(d.Seconds(), 'g', -1, 64) }

func transportError(kind errKind, err error, endpoint, model string, timeout time.Duration) *apperr.Error {
	switch kind {
	case errConnectTimeout:
		return apperr.New("AI_CONNECT_TIMEOUT", fmt.Sprintf("连接 AI 服务超时（%s 秒），请检查端点地址、服务器网络或代理设置", pyG(connectTimeout))).
			WithStatus(400).
			WithDetails(apperr.D{"timeout_seconds": pyFloat(connectTimeout), "endpoint": endpoint})
	case errReadTimeout:
		slog.Warn(fmt.Sprintf("AI response timeout phase=response_wait endpoint=%s model=%s timeout_seconds=%s", endpoint, model, pyFloat(timeout)))
		return apperr.New("AI_RESPONSE_TIMEOUT",
			"已连接 AI 服务并发送请求，但在等待上游响应数据阶段，"+
				fmt.Sprintf("模型「%s」于 %s 秒内未返回完整响应。", model, pyG(timeout))+
				fmt.Sprintf("端点：%s。", endpoint)+
				"这通常表示模型冷启动、推理阻塞或上游代理读取超时，请检查上游请求日志").
			WithStatus(400).
			WithDetails(apperr.D{
				"phase":           "response_wait",
				"timeout_seconds": pyFloat(timeout),
				"endpoint":        endpoint,
				"model":           model,
				"suggestion":      "检查上游模型运行日志、冷启动状态和反向代理读取超时",
			})
	case errOtherTimeout:
		return apperr.New("AI_REQUEST_TIMEOUT", fmt.Sprintf("AI 服务请求超时（%s 秒），请稍后重试", pyG(timeout))).
			WithStatus(400).
			WithDetails(apperr.D{"timeout_seconds": pyFloat(timeout), "endpoint": endpoint})
	case errConnect:
		return apperr.New("AI_CONNECTION_FAILED", "无法连接 AI 服务，请检查端点地址、DNS、TLS 证书或服务器出网配置").
			WithStatus(400).
			WithDetails(apperr.D{"reason": truncRunes(err.Error(), 300), "endpoint": endpoint})
	default:
		return apperr.New("AI_REQUEST_FAILED", "请求 AI 服务失败，请检查端点和服务器网络配置").
			WithStatus(400).
			WithDetails(apperr.D{"reason": truncRunes(err.Error(), 300), "endpoint": endpoint})
	}
}

// ---------------- 请求 ----------------

// requestExpansions 对应 _request_expansions。
func requestExpansions(setting *Config, terms []string, timeout time.Duration, useCache bool) ([]string, error) {
	key := cacheKey(setting.Version, terms)
	now := time.Now()
	if useCache {
		if cached, ok := cacheGet(key, now); ok {
			return cached, nil
		}
	}
	apiKey, err := decryptAPIKey(setting.APIKeyEncrypted)
	if err != nil {
		return nil, err
	}
	endpoint := completionURL(setting.Endpoint)
	body, err := json.Marshal(completionPayload(setting.Model, terms))
	if err != nil {
		return nil, err
	}
	status, respBody, kind, reqErr := doPost(endpoint, apiKey, body, timeout)
	if reqErr != nil {
		return nil, transportError(kind, reqErr, endpoint, setting.Model, timeout)
	}
	if status < 200 || status >= 300 {
		return nil, upstreamStatusError(status, respBody)
	}

	parsed, err := decodeJSON(string(respBody))
	if err != nil {
		return nil, apperr.New("AI_INVALID_RESPONSE", "AI 服务返回了无法解析的 JSON 响应").WithStatus(502)
	}
	contentAny, ok := choiceContent(parsed)
	if !ok {
		return nil, apperr.New("AI_INVALID_RESPONSE", "AI 服务返回结构缺少 choices[0].message.content，请检查接口兼容性").WithStatus(502)
	}
	content, ok := contentAny.(string)
	if !ok {
		return nil, apperr.New("AI_INVALID_RESPONSE", "AI 服务返回的 message.content 不是文本，请检查接口兼容性").WithStatus(502)
	}
	payload, err := extractJSON(content)
	if err != nil {
		return nil, err
	}
	groups, err := expansionGroups(payload, terms, content)
	if err != nil {
		return nil, err
	}
	result := mergeExpansions(terms, groups)
	if useCache {
		cachePut(key, now, result)
	}
	return result, nil
}

// choiceContent 取 body["choices"][0]["message"]["content"]（任一层缺失 / 类型不符视为缺失）。
func choiceContent(body any) (any, bool) {
	m, ok := body.(map[string]any)
	if !ok {
		return nil, false
	}
	choices, ok := m["choices"].([]any)
	if !ok || len(choices) == 0 {
		return nil, false
	}
	first, ok := choices[0].(map[string]any)
	if !ok {
		return nil, false
	}
	msg, ok := first["message"].(map[string]any)
	if !ok {
		return nil, false
	}
	content, ok := msg["content"]
	return content, ok
}

func doPost(endpoint, apiKey string, body []byte, timeout time.Duration) (int, []byte, errKind, error) {
	target, origHost, err := rewriteForTest(endpoint)
	if err != nil {
		return 0, nil, errRequest, err
	}
	req, err := http.NewRequest(http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return 0, nil, errRequest, err
	}
	if origHost != "" {
		req.Host = origHost
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := clientFor(effectiveTimeout(timeout)).Do(req)
	if err != nil {
		return 0, nil, classify(err), err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, nil, classify(err), err
	}
	return resp.StatusCode, data, 0, nil
}

func logWarn(msg string, err error) {
	slog.Warn(fmt.Sprintf("%s error=%v", msg, err))
}
