package web

// 对应原 Python 的 tests/test_database_errors.py（数据库错误按 SQLSTATE 分类映射）与
// tests/test_middleware.py::test_write_transaction_is_committed_before_response_start（先提交再写响应）。

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

func writeErrorFor(t *testing.T, err error) (int, map[string]any, string) {
	t.Helper()
	var logs bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&logs, nil)))
	defer slog.SetDefault(prev)

	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodGet, "/test", nil)
	c.Set(RequestIDKey, "request-123")
	WriteError(c, err)
	var body map[string]any
	if e := json.Unmarshal(rec.Body.Bytes(), &body); e != nil {
		t.Fatalf("body is not JSON: %s", rec.Body.String())
	}
	if body["request_id"] != "request-123" {
		t.Fatalf("request_id = %v", body["request_id"])
	}
	return rec.Code, body, logs.String()
}

func pgError(code, message string) error {
	return fmt.Errorf("query failed: %w", &pgconn.PgError{Code: code, Message: message})
}

func TestDatabaseErrorClassification(t *testing.T) {
	cases := []struct {
		name   string
		err    error
		status int
		code   string
		log    string
	}{
		{"未定义列（42703）是查询错误而不是不可用", pgError("42703", `column "material_code" does not exist`), 500, "DATABASE_QUERY_ERROR", "database query error request_id=request-123"},
		{"语法错误（42601）是查询错误", pgError("42601", `syntax error at or near "FROM"`), 500, "DATABASE_QUERY_ERROR", "syntax error"},
		{"连接失败（08006）是不可用", pgError("08006", "connection to server at 127.0.0.1 failed"), 503, "DATABASE_UNAVAILABLE", "database unavailable request_id=request-123"},
		{"管理员关闭（57P01）是不可用", pgError("57P01", "terminating connection due to administrator command"), 503, "DATABASE_UNAVAILABLE", "database unavailable"},
		{"超时是不可用", fmt.Errorf("acquire conn: %w", context.DeadlineExceeded), 503, "DATABASE_UNAVAILABLE", "database unavailable"},
		{"连接被拒是不可用", errors.New("dial tcp 127.0.0.1:5432: connect: connection refused"), 503, "DATABASE_UNAVAILABLE", "database unavailable"},
		{"完整性约束（23505）是数据冲突", pgError("23505", "duplicate key value violates unique constraint"), 409, "DATA_CONFLICT", "database integrity error"},
		{"其它数据库错误是 DATABASE_ERROR", pgError("22P02", "invalid input syntax for type integer"), 500, "DATABASE_ERROR", "database error request_id=request-123"},
		{"非数据库错误是内部错误", errors.New("bad state"), 500, "INTERNAL_SERVER_ERROR", "unexpected server error"},
		{"业务错误按错误码", apperr.New("NOT_FOUND", "物资不存在"), 400, "NOT_FOUND", ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			status, body, logs := writeErrorFor(t, tc.err)
			if status != tc.status || body["code"] != tc.code {
				t.Fatalf("got %d %v, want %d %s", status, body["code"], tc.status, tc.code)
			}
			if tc.log != "" && !strings.Contains(logs, tc.log) {
				t.Fatalf("log %q missing %q", logs, tc.log)
			}
		})
	}
}

// eventWriter 记录响应头真正发出的时刻（WriteHeader），用于断言「提交早于响应」。
type eventWriter struct {
	http.ResponseWriter
	events *[]string
}

func (w *eventWriter) WriteHeader(code int) {
	*w.events = append(*w.events, "response.start")
	w.ResponseWriter.WriteHeader(code)
}

func (w *eventWriter) Write(b []byte) (int, error) {
	if len(*w.events) == 0 || (*w.events)[len(*w.events)-1] != "response.start" {
		*w.events = append(*w.events, "response.start")
	}
	return w.ResponseWriter.Write(b)
}

// 写接口的事务必须在响应头发给客户端之前提交，否则客户端拿到 2xx 立刻回读会读到提交前的旧值。
func TestTransactionIsCommittedBeforeResponseStart(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var events []string
	r := gin.New()
	r.POST("/write", H(func(c *Ctx) error {
		c.DB.AfterCommit(func() { events = append(events, "commit") })
		return c.Created(map[string]any{"id": 1})
	}))
	r.POST("/fail", H(func(c *Ctx) error {
		c.DB.AfterCommit(func() { events = append(events, "commit") })
		return apperr.New("NOT_FOUND", "x")
	}))

	rec := httptest.NewRecorder()
	r.ServeHTTP(&eventWriter{ResponseWriter: rec, events: &events}, httptest.NewRequest(http.MethodPost, "/write", nil))
	if rec.Code != 201 {
		t.Fatalf("status = %d", rec.Code)
	}
	if len(events) != 2 || events[0] != "commit" || events[1] != "response.start" {
		t.Fatalf("事务提交必须早于响应头：%v", events)
	}

	events = nil
	rec = httptest.NewRecorder()
	r.ServeHTTP(&eventWriter{ResponseWriter: rec, events: &events}, httptest.NewRequest(http.MethodPost, "/fail", nil))
	if rec.Code != 400 || len(events) != 1 || events[0] != "response.start" {
		t.Fatalf("出错时应回滚且不触发提交回调：%d %v", rec.Code, events)
	}
}
