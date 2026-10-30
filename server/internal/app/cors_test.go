package app

// 对应原 Python 的 tests/test_cors.py：在完整引擎上校验 Referer 优先的 CORS（预检、回退到 Origin、
// 结构化错误响应同样带 CORS 头与暴露的性能头、白名单拒绝未知来源）。不访问数据库。

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

func withCORSConfig(t *testing.T, origins []string) {
	t.Helper()
	prevOrigins, prevCred, prevAge := config.S.CORSOrigins, config.S.CORSAllowCredentials, config.S.CORSMaxAge
	// 与 config.Load 的默认值一致：允许携带凭证、预检缓存 86400 秒。
	config.S.CORSOrigins, config.S.CORSAllowCredentials, config.S.CORSMaxAge = origins, true, 86400
	t.Cleanup(func() {
		config.S.CORSOrigins, config.S.CORSAllowCredentials, config.S.CORSMaxAge = prevOrigins, prevCred, prevAge
	})
}

func serve(method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	New().ServeHTTP(rec, req)
	return rec
}

func varyValues(rec *httptest.ResponseRecorder) map[string]bool {
	out := map[string]bool{}
	for _, v := range rec.Header().Values("Vary") {
		for _, part := range strings.Split(v, ",") {
			out[strings.ToLower(strings.TrimSpace(part))] = true
		}
	}
	return out
}

func TestCORSPreflightPrefersReferer(t *testing.T) {
	withCORSConfig(t, nil)
	rec := serve(http.MethodOptions, "/api/v1/auth/login", map[string]string{
		"Referer":                        "https://frontend.example.com/login?from=home",
		"Origin":                         "https://origin-fallback.example.com",
		"Access-Control-Request-Method":  "POST",
		"Access-Control-Request-Headers": "authorization,content-type,x-request-id",
	})
	h := rec.Header()
	if rec.Code != 200 || h.Get("Access-Control-Allow-Origin") != "https://frontend.example.com" ||
		h.Get("Access-Control-Allow-Credentials") != "true" || h.Get("Access-Control-Max-Age") != "86400" ||
		h.Get("Access-Control-Allow-Headers") != "authorization,content-type,x-request-id" {
		t.Fatalf("preflight: %d %v", rec.Code, h)
	}
	if vary := varyValues(rec); !vary["origin"] || !vary["referer"] {
		t.Fatalf("Vary = %v", h.Values("Vary"))
	}
}

func TestCORSPreflightFallsBackToOrigin(t *testing.T) {
	withCORSConfig(t, nil)
	rec := serve(http.MethodOptions, "/api/v1/auth/login", map[string]string{
		"Origin":                        "https://frontend.example.com",
		"Access-Control-Request-Method": "POST",
	})
	if rec.Code != 200 || rec.Header().Get("Access-Control-Allow-Origin") != "https://frontend.example.com" {
		t.Fatalf("preflight: %d %v", rec.Code, rec.Header())
	}
}

// 未匹配路由（400 + ROUTE_NOT_FOUND）的结构化错误响应同样补齐 CORS 头，并暴露接口性能头。
func TestCORSHeadersAreAddedToRouteNotFoundResponse(t *testing.T) {
	withCORSConfig(t, nil)
	rec := serve(http.MethodPost, "/auth/login", map[string]string{
		"Referer": "https://frontend.example.com/login",
		"Origin":  "https://frontend.example.com",
	})
	if rec.Code != 400 || !strings.Contains(rec.Body.String(), `"code":"ROUTE_NOT_FOUND"`) {
		t.Fatalf("not found: %d %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "https://frontend.example.com" {
		t.Fatalf("missing allow-origin: %v", rec.Header())
	}
	exposed := strings.ToLower(rec.Header().Get("Access-Control-Expose-Headers"))
	for _, name := range []string{"content-disposition", "x-request-id", "x-response-time", "x-db-time", "x-db-queries", "x-compute-time"} {
		if !strings.Contains(exposed, name) {
			t.Errorf("Access-Control-Expose-Headers 缺少 %s：%s", name, exposed)
		}
	}
}

func TestCORSIgnoresMalformedRefererAndUsesOrigin(t *testing.T) {
	withCORSConfig(t, nil)
	rec := serve(http.MethodGet, "/api/v1/openapi.json", map[string]string{"Referer": "not-a-url", "Origin": "https://frontend.example.com"})
	if rec.Code != 200 || rec.Header().Get("Access-Control-Allow-Origin") != "https://frontend.example.com" {
		t.Fatalf("got %d %v", rec.Code, rec.Header())
	}
}

func TestResponseWithoutRefererOrOriginHasNoCORSHeaders(t *testing.T) {
	withCORSConfig(t, nil)
	rec := serve(http.MethodGet, "/api/v1/openapi.json", nil)
	if rec.Code != 200 || rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("got %d %v", rec.Code, rec.Header())
	}
}

func TestCORSWhitelistRejectsUnknownOrigin(t *testing.T) {
	withCORSConfig(t, []string{"https://frontend.example.com", ".example.com"})
	if got := serve(http.MethodGet, "/api/v1/openapi.json", map[string]string{"Origin": "https://evil-attacker.com", "Referer": "https://evil-attacker.com/x"}).Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unknown origin allowed: %q", got)
	}
	if got := serve(http.MethodGet, "/api/v1/openapi.json", map[string]string{"Origin": "https://app.example.com", "Referer": "https://app.example.com/x"}).Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("whitelisted origin: %q", got)
	}
	if got := serve(http.MethodGet, "/api/v1/openapi.json", map[string]string{"Referer": "https://sub.example.com/page"}).Header().Get("Access-Control-Allow-Origin"); got != "https://sub.example.com" {
		t.Fatalf("suffix match: %q", got)
	}
}
