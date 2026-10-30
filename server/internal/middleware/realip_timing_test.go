package middleware

// 补齐原 Python 的 tests/test_middleware.py 与 tests/test_db_timing.py 中 middleware_test.go 未覆盖的用例：
// 真实 IP 的 IPv6 / 回退规则，耗时响应头的格式与自洽性（总耗时 = 数据库 + 计算），以及数据库语句计数。

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
)

func TestRealIPUsesFirstForwardedAddressAndFallsBack(t *testing.T) {
	cases := []struct {
		headers    map[string]string
		remoteAddr string
		want       string
	}{
		{map[string]string{"X-Forwarded-For": " 2001:db8::1, 10.0.0.1"}, "10.0.0.2:80", "2001:db8::1"},
		{map[string]string{"X-Forwarded-For": "not-an-ip"}, "10.0.0.2:1234", "10.0.0.2"},
		{map[string]string{"EO-Connecting-IP": "invalid", "X-Real-IP": "198.51.100.9"}, "", "198.51.100.9"},
		{nil, "", "unknown"},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.RemoteAddr = tc.remoteAddr
		for k, v := range tc.headers {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		newEngine().ServeHTTP(rec, req)
		if rec.Body.String() != tc.want {
			t.Errorf("headers %v remote %q: client ip = %q, want %q", tc.headers, tc.remoteAddr, rec.Body.String(), tc.want)
		}
	}
}

var durationRe = regexp.MustCompile(`^\d+(\.\d+)?$`)

func durationMS(t *testing.T, value string) float64 {
	t.Helper()
	if !durationRe.MatchString(value) {
		t.Fatalf("not a duration: %q", value)
	}
	f, _ := strconv.ParseFloat(value, 64)
	return f
}

// 三个耗时头各自按 2 位小数格式化，最多引入 3 × 0.005 ms 的舍入偏差。
const headerRoundingToleranceMS = 0.02

func assertTimingHeaders(t *testing.T, h http.Header) (queries int) {
	t.Helper()
	total := durationMS(t, h.Get("X-Response-Time"))
	dbTime := durationMS(t, h.Get("X-DB-Time"))
	compute := durationMS(t, h.Get("X-Compute-Time"))
	if dbTime > total || compute < 0 {
		t.Fatalf("inconsistent timing: total=%v db=%v compute=%v", total, dbTime, compute)
	}
	if diff := total - dbTime - compute; diff > headerRoundingToleranceMS || diff < -headerRoundingToleranceMS {
		t.Fatalf("total(%v) != db(%v) + compute(%v)", total, dbTime, compute)
	}
	n, err := strconv.Atoi(h.Get("X-DB-Queries"))
	if err != nil {
		t.Fatalf("X-DB-Queries = %q", h.Get("X-DB-Queries"))
	}
	if h.Get("X-Request-ID") == "" {
		t.Fatal("missing X-Request-ID")
	}
	return n
}

func TestTimingHeadersAreSelfConsistent(t *testing.T) {
	rec := httptest.NewRecorder()
	newEngine().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/ping", nil))
	if n := assertTimingHeaders(t, rec.Header()); n != 0 {
		t.Fatalf("no SQL executed, X-DB-Queries = %d", n)
	}
}

// 需要可连接的 PostgreSQL（默认本机 postgres 库，可用 GO_TEST_DATABASE_URL 覆盖），连不上时跳过。
func TestResponseReportsRequestDatabaseQueries(t *testing.T) {
	dsn := os.Getenv("GO_TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable&connect_timeout=2"
	}
	conn, err := db.Open(dsn)
	if err != nil || conn.PingContext(context.Background()) != nil {
		t.Skip("database unavailable")
	}
	defer conn.Close()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RealIP(), RequestContext())
	r.GET("/query", func(c *gin.Context) {
		s := db.NewSession(c.Request.Context())
		defer s.Close()
		var v int
		for i := 0; i < 2; i++ {
			if err := s.Get(&v, "SELECT 1"); err != nil {
				c.String(500, err.Error())
				return
			}
		}
		c.String(200, "ok")
	})
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/query", nil))
	if rec.Code != 200 {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	if n := assertTimingHeaders(t, rec.Header()); n != 2 {
		t.Fatalf("X-DB-Queries = %d, want 2", n)
	}
}
