package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
)

// 对应原 test_health.py::test_health_reports_database_failure：数据库不可用时返回 503 + DATABASE_UNAVAILABLE。
func TestHealthReportsDatabaseFailure(t *testing.T) {
	if _, err := db.Open("postgres://nobody@127.0.0.1:1/none?sslmode=disable&connect_timeout=1"); err != nil {
		t.Fatal(err)
	}
	defer db.DB.Close()
	rec := httptest.NewRecorder()
	New().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))
	if rec.Code != 503 {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["code"] != "DATABASE_UNAVAILABLE" || body["message"] != "数据库连接不可用" || body["request_id"] == "" {
		t.Fatalf("body = %v", body)
	}
	if rec.Header().Get("X-Request-ID") == "" || rec.Header().Get("X-Response-Time") == "" {
		t.Fatal("missing timing headers")
	}
}

// 未匹配路径 → 400 ROUTE_NOT_FOUND；方法不允许 → 405。
func TestUnknownRouteAndMethod(t *testing.T) {
	engine := New()
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/not-exists", nil))
	if rec.Code != 400 || !json.Valid(rec.Body.Bytes()) {
		t.Fatalf("unknown route: %d %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body["code"] != "ROUTE_NOT_FOUND" {
		t.Fatalf("body = %v", body)
	}
	rec = httptest.NewRecorder()
	engine.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/api/v1/version", nil))
	if rec.Code != 405 {
		t.Fatalf("method not allowed: %d", rec.Code)
	}
}
