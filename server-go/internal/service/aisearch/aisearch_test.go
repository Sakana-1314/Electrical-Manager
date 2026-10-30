package aisearch

import (
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
)

func appErr(t *testing.T, err error) *apperr.Error {
	t.Helper()
	ae, ok := err.(*apperr.Error)
	if !ok {
		t.Fatalf("expected *apperr.Error, got %T %v", err, err)
	}
	return ae
}

func TestCompletionURL(t *testing.T) {
	cases := map[string]string{
		"https://x.test/v1":                   "https://x.test/v1/chat/completions",
		"https://x.test/v1/":                  "https://x.test/v1/chat/completions",
		"https://x.test/v1/chat/completions/": "https://x.test/v1/chat/completions",
	}
	for in, want := range cases {
		if got := completionURL(in); got != want {
			t.Errorf("completionURL(%q) = %q", in, got)
		}
	}
}

func TestCompletionPayload(t *testing.T) {
	p := completionPayload(" GLM-4.7-flash", []string{"电机"})
	if p.Thinking["type"] != "disabled" || p.ResponseFormat["type"] != "json_object" || p.Stream {
		t.Fatalf("glm payload: %+v", p)
	}
	if !strings.Contains(p.Messages[0].Content, "仅包含 1 个子数组") {
		t.Fatalf("system prompt: %s", p.Messages[0].Content)
	}
	if p.Messages[1].Content != `{"input_terms": ["电机"]}` {
		t.Fatalf("user content: %s", p.Messages[1].Content)
	}
	b, _ := json.Marshal(completionPayload("fast", []string{"a\"b", "c"}))
	if strings.Contains(string(b), "thinking") || strings.Contains(string(b), "response_format") {
		t.Fatalf("non-glm payload must not carry glm options: %s", b)
	}
	if got := userContent([]string{"a\"b", "\n"}); got != `{"input_terms": ["a\"b", "\n"]}` {
		t.Fatalf("userContent: %s", got)
	}
}

func TestExtractJSON(t *testing.T) {
	ok := []string{
		`{"expansions":[["a"]]}`,
		"```json\n{\"expansions\":[[\"a\"]]}\n```",
		"输出如下：\n{\"expansions\":[\"电机\",\"电动机\"]}",
		`xx {"bad" {"expansions":[]} tail`,
	}
	for _, s := range ok {
		if _, err := extractJSON(s); err != nil {
			t.Errorf("extractJSON(%q): %v", s, err)
		}
	}
	err := func() error { _, err := extractJSON("not json"); return err }()
	if ae := appErr(t, err); ae.Code != "AI_INVALID_RESPONSE" || ae.Status != 502 || !strings.Contains(ae.Message, "不是有效 JSON") {
		t.Fatalf("invalid: %v", ae)
	}
	err = func() error { _, err := extractJSON(`["a"]`); return err }()
	if ae := appErr(t, err); !strings.Contains(ae.Message, "顶层结构不是对象") {
		t.Fatalf("top-level: %v", ae)
	}
}

func TestExpansionGroups(t *testing.T) {
	decode := func(s string) map[string]any {
		var m map[string]any
		if err := json.Unmarshal([]byte(s), &m); err != nil {
			t.Fatal(err)
		}
		return m
	}
	cases := []struct {
		payload string
		terms   []string
		want    string
	}{
		{`{"expansions":[["电机","电动机"],"马达",5]}`, []string{"a", "b", "c"}, `[["电机","电动机"],["马达"],[]]`},
		{`{"expansions":{"a":["x"],"b":"y"}}`, []string{"a", "b", "c"}, `[["x"],["y"],[]]`},
		{`{"expansions":["电机","电动机"]}`, []string{"电机"}, `[["电机","电动机"]]`},
		{`{"expansions":[{"original":"a","synonyms":["x"]},{"original":"b","terms":["y"]}]}`, []string{"b", "a"}, `[["y"],["x"]]`},
		{`{"expansions":[]}`, []string{"a"}, `[[]]`},
	}
	for _, c := range cases {
		got, err := expansionGroups(decode(c.payload), c.terms, c.payload)
		if err != nil {
			t.Fatalf("%s: %v", c.payload, err)
		}
		b, _ := json.Marshal(got)
		if string(b) != c.want {
			t.Errorf("%s → %s, want %s", c.payload, b, c.want)
		}
	}
	_, err := expansionGroups(decode(`{"expansions":[["a"],["b"]]}`), []string{"a"}, "c")
	if ae := appErr(t, err); ae.Message != "AI 返回的扩展词分组数量不匹配：期望 1 组，实际 2" {
		t.Fatalf("count mismatch: %v", ae)
	}
	_, err = expansionGroups(decode(`{"other":1}`), []string{"a"}, "c")
	if ae := appErr(t, err); ae.Message != "AI 返回的扩展词分组数量不匹配：期望 1 组，实际 不是数组" || ae.Details.(apperr.D)["actual_count"] != nil {
		t.Fatalf("not list: %v %v", ae, ae.Details)
	}
}

func TestMergeExpansions(t *testing.T) {
	long := strings.Repeat("长", 65)
	got := mergeExpansions([]string{"电机", "马达"}, [][]string{
		{" 电动机 ", "", long, "a", "b", "c", "d"},
		{"电动机", "马达"},
	})
	want := []string{"电机", "电动机", "a", "b", "马达"}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("merge = %v, want %v", got, want)
	}
}

func TestUpstreamStatusError(t *testing.T) {
	cases := []struct {
		status   int
		body     string
		code     string
		httpCode int
		msgEnd   string
	}{
		{401, `{"error":{"message":"bad key"}}`, "AI_AUTH_FAILED", 400, "：bad key"},
		{403, `{}`, "AI_AUTH_FAILED", 400, "模型访问权限"},
		{404, `{"error":"nope"}`, "AI_ENDPOINT_NOT_FOUND", 400, "：nope"},
		{429, `{"detail":"slow"}`, "AI_RATE_LIMITED", 429, "：slow"},
		{418, `x`, "AI_REQUEST_REJECTED", 400, "接口兼容性"},
		{503, `{"message":"down"}`, "AI_UPSTREAM_FAILED", 502, "AI 上游服务返回 HTTP 503，请检查服务状态或稍后重试：down"},
		{302, ``, "AI_UPSTREAM_FAILED", 502, "HTTP 302，请检查服务状态或稍后重试"},
	}
	for _, c := range cases {
		e := upstreamStatusError(c.status, []byte(c.body))
		if e.Code != c.code || e.Status != c.httpCode || !strings.HasSuffix(e.Message, c.msgEnd) {
			t.Errorf("%d: %s %d %s", c.status, e.Code, e.Status, e.Message)
		}
	}
}

func TestCacheEvictsOldestInserted(t *testing.T) {
	clearCache()
	defer clearCache()
	now := time.Now()
	for i := 0; i < maxCacheEntries; i++ {
		cachePut(cacheKey(int64(i), []string{"t"}), now, []string{"x"})
	}
	cachePut(cacheKey(0, []string{"t"}), now, []string{"y"}) // 覆盖已有键：不淘汰、不改变位置
	if len(cache) != maxCacheEntries {
		t.Fatalf("size %d", len(cache))
	}
	cachePut(cacheKey(-1, []string{"t"}), now, []string{"z"})
	if _, ok := cache[cacheKey(0, []string{"t"})]; ok {
		t.Fatalf("oldest entry should be evicted")
	}
	if _, ok := cacheGet(cacheKey(1, []string{"t"}), now.Add(cacheTTL-time.Second)); !ok {
		t.Fatalf("entry within TTL should hit")
	}
	if _, ok := cacheGet(cacheKey(1, []string{"t"}), now.Add(cacheTTL)); ok {
		t.Fatalf("expired entry should miss")
	}
}

func TestConfigFromData(t *testing.T) {
	config.S.WechatMiniProgramAppID = "wx-a, wx-b,wx-a"
	defer func() { config.S.WechatMiniProgramAppID = "" }()
	c := configFromData(map[string]any{
		"endpoint": 5, "enabled": "yes", "inventory_mode": "bogus", "secondary_warehouse_mode": "lite",
		"mini_program_code_app_id": "wx-b",
		"web_features":             map[string]any{"work": false, "memos": "no", "unknown": false},
	}, 7, nil, false)
	if c.Endpoint != "" || c.Enabled || c.InventoryMode != "read_write" || c.SecondaryWarehouseMode != "lite" || c.MiniProgramCodeAppID != "wx-b" {
		t.Fatalf("config: %+v", c)
	}
	if c.WebFeatures.Work || !c.WebFeatures.Memos {
		t.Fatalf("web features: %+v", c.WebFeatures)
	}
	if got := configFromData(map[string]any{"mini_program_code_app_id": "wx-x"}, 1, nil, false).MiniProgramCodeAppID; got != "wx-a" {
		t.Fatalf("unknown app id falls back to first: %s", got)
	}
	allFalse := map[string]any{}
	for _, k := range schema.WebFeatureKeys {
		allFalse[k] = false
	}
	if wf := parseWebFeatures(allFalse); wf != schema.AllVisibleWebFeatures() {
		t.Fatalf("all hidden must normalize to all visible: %+v", wf)
	}
	if ids := configuredWechatAppIDs(); fmt.Sprint(ids) != "[wx-a wx-b]" {
		t.Fatalf("app ids: %v", ids)
	}
}

func TestWechatCredentials(t *testing.T) {
	config.S.WechatMiniProgramAppID, config.S.WechatMiniProgramAppSecret = "wx-a,wx-b", "s-a,s-b"
	defer func() { config.S.WechatMiniProgramAppID, config.S.WechatMiniProgramAppSecret = "", "" }()
	if id, secret, err := getWechatCredentials(""); id != "wx-a" || secret != "s-a" || err != nil {
		t.Fatalf("default: %s %s %v", id, secret, err)
	}
	if _, _, err := getWechatCredentials("wx-c"); appErr(t, err).Code != "WECHAT_NOT_CONFIGURED" {
		t.Fatalf("unknown: %v", err)
	}
	config.S.WechatMiniProgramAppSecret = "s-a"
	if _, _, err := getWechatCredentials(""); appErr(t, err).Code != "WECHAT_CONFIGURATION_INVALID" {
		t.Fatalf("mismatch: %v", err)
	}
}

func TestPyFormatting(t *testing.T) {
	if pyFloat(30*time.Second) != "30.0" || pyFloat(1500*time.Millisecond) != "1.5" {
		t.Fatalf("pyFloat")
	}
	if pyG(30*time.Second) != "30" || pyG(3*time.Second) != "3" {
		t.Fatalf("pyG")
	}
}

func testConfig(t *testing.T, endpoint, model string) *Config {
	t.Helper()
	config.S.JWTSecret = "test-secret-that-is-long-enough-123456"
	security.ResetFernetKey()
	c := defaultConfig()
	c.Endpoint, c.Model, c.Enabled, c.Version = endpoint, model, true, 1
	c.APIKeyEncrypted = security.EncryptSecret("secret-key")
	return c
}

func TestRequestExpansionsEndToEnd(t *testing.T) {
	var gotAuth, gotPath string
	var calls int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		gotAuth, gotPath = r.Header.Get("Authorization"), r.URL.Path
		_, _ = io.ReadAll(r.Body)
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"{\"expansions\":[[\"电机\",\"电动机\"]]}"}}]}`)
	}))
	defer srv.Close()
	clearCache()
	defer clearCache()
	c := testConfig(t, srv.URL+"/v1", "fast")
	got, err := requestExpansions(c, []string{"电机"}, time.Second, true)
	if err != nil || joinTerms(got) != "电机|电动机" {
		t.Fatalf("expand: %v %v", got, err)
	}
	if gotAuth != "Bearer secret-key" || gotPath != "/v1/chat/completions" {
		t.Fatalf("request: %s %s", gotAuth, gotPath)
	}
	if _, err := requestExpansions(c, []string{"电机"}, time.Second, true); err != nil || calls != 1 {
		t.Fatalf("second call should hit cache: calls=%d err=%v", calls, err)
	}
	if _, err := requestExpansions(c, []string{"电机"}, time.Second, false); err != nil || calls != 2 {
		t.Fatalf("use_cache=false bypasses cache: calls=%d", calls)
	}
}

func TestTransportErrors(t *testing.T) {
	slow := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(500 * time.Millisecond)
	}))
	defer slow.Close()
	clearCache()
	c := testConfig(t, slow.URL+"/v1", "slow-model")
	_, err := requestExpansions(c, []string{"电机"}, 100*time.Millisecond, false)
	ae := appErr(t, err)
	if ae.Code != "AI_RESPONSE_TIMEOUT" || ae.Status != 400 || !strings.Contains(ae.Message, "slow-model") || !strings.Contains(ae.Message, slow.URL+"/v1/chat/completions") {
		t.Fatalf("read timeout: %v", ae)
	}

	// 已关闭的端口：连接被拒绝。
	ln, _ := net.Listen("tcp", "127.0.0.1:0")
	addr := ln.Addr().String()
	_ = ln.Close()
	c = testConfig(t, "http://"+addr+"/v1", "m")
	_, err = requestExpansions(c, []string{"电机"}, time.Second, false)
	if ae := appErr(t, err); ae.Code != "AI_CONNECTION_FAILED" {
		t.Fatalf("refused: %v", ae)
	}

	// 3xx 不跟随重定向，按上游状态码处理。
	redirect := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "https://elsewhere.test/", http.StatusFound)
	}))
	defer redirect.Close()
	c = testConfig(t, redirect.URL, "m")
	_, err = requestExpansions(c, []string{"电机"}, time.Second, false)
	if ae := appErr(t, err); ae.Code != "AI_UPSTREAM_FAILED" || ae.Status != 502 {
		t.Fatalf("redirect: %v", ae)
	}
}
