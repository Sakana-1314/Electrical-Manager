package db

// 对应原 Python 的 tests/test_db_timing.py：语句耗时只累计进本请求的 Timing（请求外的 SQL 不计入），
// 并发请求各自累计、互不串用。需要可连接的 PostgreSQL（默认本机 postgres 库，可用 GO_TEST_DATABASE_URL 覆盖），连不上时跳过。
// 响应头 X-DB-Time / X-DB-Queries 的格式与自洽性见 internal/middleware 的测试。

import (
	"context"
	"os"
	"sync"
	"testing"
)

func openTimingDB(t *testing.T) {
	t.Helper()
	dsn := os.Getenv("GO_TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres@127.0.0.1:5432/postgres?sslmode=disable&connect_timeout=2"
	}
	conn, err := Open(dsn)
	if err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	if err := conn.Ping(); err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	t.Cleanup(func() { _ = conn.Close() })
}

func TestTimingOnlyCollectsInsideRequestScope(t *testing.T) {
	openTimingDB(t)

	// 没有挂 Timing 的会话（请求外 / 后台任务）照常执行，不累计到任何地方。
	outside := NewSession(context.Background())
	var one int
	if err := outside.Get(&one, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	outside.Close()

	timing := &Timing{}
	s := NewSession(WithTiming(context.Background(), timing))
	if err := s.Get(&one, "SELECT 1"); err != nil {
		t.Fatal(err)
	}
	if err := s.Get(&one, "SELECT 2"); err != nil {
		t.Fatal(err)
	}
	s.Close()
	if timing.Count() != 2 {
		t.Fatalf("statement count = %d, want 2", timing.Count())
	}
	if timing.TotalMS() <= 0 {
		t.Fatalf("total ms = %v", timing.TotalMS())
	}
}

func TestConcurrentSessionsReportTheirOwnDatabaseWork(t *testing.T) {
	openTimingDB(t)
	timings := []*Timing{{}, {}, {}}
	var wg sync.WaitGroup
	for i, timing := range timings {
		wg.Add(1)
		go func(n int, timing *Timing) {
			defer wg.Done()
			s := NewSession(WithTiming(context.Background(), timing))
			defer s.Close()
			for j := 0; j <= n; j++ {
				var v int
				if err := s.Get(&v, "SELECT 1"); err != nil {
					t.Error(err)
				}
			}
		}(i, timing)
	}
	wg.Wait()
	for i, timing := range timings {
		if timing.Count() != int64(i+1) {
			t.Errorf("session %d counted %d statements, want %d", i, timing.Count(), i+1)
		}
	}
}
