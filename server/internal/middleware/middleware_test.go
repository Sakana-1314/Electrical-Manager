package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

func newEngine() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RealIP(), RequestContext(), CORS())
	r.GET("/ping", func(c *gin.Context) { c.String(200, c.GetString(clientIPKey)) })
	return r
}

// 对应原 test_health.py::test_request_log_uses_real_ip_from_proxy：访问日志采用代理传来的真实 IP。
func TestRequestLogUsesRealIPFromProxy(t *testing.T) {
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	defer slog.SetDefault(prev)

	cases := []struct {
		headers map[string]string
		want    string
	}{
		{map[string]string{"EO-Connecting-IP": "203.0.113.9", "X-Real-IP": "198.51.100.1"}, "203.0.113.9"},
		{map[string]string{"EO-Connecting-IP": "bad", "X-Real-IP": "198.51.100.1"}, "198.51.100.1"},
		{map[string]string{"X-Forwarded-For": " 192.0.2.7 , 10.0.0.1"}, "192.0.2.7"},
	}
	for _, tc := range cases {
		buf.Reset()
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		for k, v := range tc.headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		newEngine().ServeHTTP(rec, req)
		if rec.Body.String() != tc.want {
			t.Fatalf("client ip = %q, want %q", rec.Body.String(), tc.want)
		}
		if !strings.Contains(buf.String(), "client_ip="+tc.want) {
			t.Fatalf("log missing client ip %s: %s", tc.want, buf.String())
		}
	}
}

func TestRequestIDAndTimingHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("X-Request-ID", strings.Repeat("a", 200))
	rec := httptest.NewRecorder()
	newEngine().ServeHTTP(rec, req)
	if got := rec.Header().Get("X-Request-ID"); len(got) != 128 {
		t.Fatalf("request id length = %d", len(got))
	}
	for _, h := range []string{"X-Response-Time", "X-DB-Time", "X-Compute-Time", "X-DB-Queries"} {
		if rec.Header().Get(h) == "" {
			t.Fatalf("missing %s", h)
		}
	}
}

// 对应原 test_cors.py：Referer 优先、白名单（精确 / 子域后缀）与预检响应。
func TestCORSWhitelistAndPreflight(t *testing.T) {
	config.S.CORSOrigins = []string{"https://app.example.com", ".example.org"}
	config.S.CORSAllowCredentials = true
	config.S.CORSMaxAge = 600
	defer func() { config.S.CORSOrigins = nil }()

	do := func(method string, headers map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, "/ping", nil)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		newEngine().ServeHTTP(rec, req)
		return rec
	}
	if got := do("GET", map[string]string{"Referer": "https://APP.example.com/page?x=1", "Origin": "https://evil.com"}).Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("referer first: %q", got)
	}
	if got := do("GET", map[string]string{"Origin": "https://a.b.example.org"}).Header().Get("Access-Control-Allow-Origin"); got != "https://a.b.example.org" {
		t.Fatalf("suffix match: %q", got)
	}
	if got := do("GET", map[string]string{"Origin": "https://evil-attacker.com"}).Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unknown origin allowed: %q", got)
	}
	pre := do("OPTIONS", map[string]string{"Origin": "https://app.example.com", "Access-Control-Request-Method": "PATCH", "Access-Control-Request-Headers": "x-project-id"})
	if pre.Code != 200 || pre.Body.String() != "OK" || pre.Header().Get("Access-Control-Allow-Headers") != "x-project-id" ||
		pre.Header().Get("Access-Control-Max-Age") != "600" || pre.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("preflight: %d %v", pre.Code, pre.Header())
	}
}
