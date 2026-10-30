package logx

// 对应原 Python 的 tests/test_logging.py：按天轮转并归档到 YYYY-MM 目录、按 backupCount 保留归档、
// 健康检查只在控制台过滤、控制台默认彩色且 NO_COLOR 可关闭。

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDailyRotationArchivesIntoMonthDirectory(t *testing.T) {
	dir := t.TempDir()
	w, err := newRotatingWriter(filepath.Join(dir, "api.log"), 0)
	if err != nil {
		t.Fatal(err)
	}
	defer w.f.Close()
	if _, err := w.Write([]byte("old day\n")); err != nil {
		t.Fatal(err)
	}
	w.day = "2026-04-30" // 模拟跨过午夜：下一次写入触发轮转
	if _, err := w.Write([]byte("new day\n")); err != nil {
		t.Fatal(err)
	}
	archived, err := os.ReadFile(filepath.Join(dir, "2026-04", "api.2026-04-30.log"))
	if err != nil {
		t.Fatalf("archive missing: %v", err)
	}
	if string(archived) != "old day\n" {
		t.Fatalf("archive content = %q", archived)
	}
	current, _ := os.ReadFile(filepath.Join(dir, "api.log"))
	if string(current) != "new day\n" {
		t.Fatalf("current log = %q", current)
	}
	if w.day != time.Now().Format("2006-01-02") {
		t.Fatalf("day = %s", w.day)
	}
}

func TestMonthlyArchivesHonorBackupCount(t *testing.T) {
	dir := t.TempDir()
	w, err := newRotatingWriter(filepath.Join(dir, "api.log"), 2)
	if err != nil {
		t.Fatal(err)
	}
	defer w.f.Close()
	names := []string{"2026-04/api.2026-04-30.log", "2026-05/api.2026-05-01.log", "2026-05/api.2026-05-02.log"}
	for _, name := range names {
		path := filepath.Join(dir, name)
		_ = os.MkdirAll(filepath.Dir(path), 0o755)
		if err := os.WriteFile(path, nil, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	// 不相关的文件不参与清理
	_ = os.WriteFile(filepath.Join(dir, "2026-04", "other.2026-04-01.log"), nil, 0o644)

	w.prune("api", ".log")

	if _, err := os.Stat(filepath.Join(dir, names[0])); !os.IsNotExist(err) {
		t.Fatalf("oldest archive should be deleted: %v", err)
	}
	for _, name := range append(names[1:], "2026-04/other.2026-04-01.log") {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			t.Fatalf("%s should be kept: %v", name, err)
		}
	}
}

func TestHealthCheckFilterOnlySuppressesConsoleHealthRequests(t *testing.T) {
	var console, file bytes.Buffer
	h := &handler{console: &console, file: &file, name: defaultLogger, minLevel: slog.LevelInfo}
	logger := slog.New(h)
	logger.Info("HTTP GET /health")
	logger.Info("HTTP GET /api/v1/users")

	if strings.Contains(console.String(), "/health") || !strings.Contains(console.String(), "/api/v1/users") {
		t.Fatalf("console = %q", console.String())
	}
	if !strings.Contains(file.String(), "/health") || !strings.Contains(file.String(), "/api/v1/users") {
		t.Fatalf("file = %q", file.String())
	}
	if !strings.Contains(file.String(), "| INFO     | spare_parts.api | HTTP GET /api/v1/users") {
		t.Fatalf("line format = %q", file.String())
	}
}

func configuredHandler(t *testing.T) *handler {
	t.Helper()
	prev := slog.Default()
	t.Cleanup(func() { slog.SetDefault(prev) })
	if err := Configure(t.TempDir(), 3); err != nil {
		t.Fatal(err)
	}
	h, ok := slog.Default().Handler().(*handler)
	if !ok {
		t.Fatalf("unexpected handler %T", slog.Default().Handler())
	}
	return h
}

func TestConsoleColorsAreEnabledByDefault(t *testing.T) {
	if v, ok := os.LookupEnv("NO_COLOR"); ok {
		t.Cleanup(func() { os.Setenv("NO_COLOR", v) })
		os.Unsetenv("NO_COLOR")
	}
	h := configuredHandler(t)
	if !h.color {
		t.Fatal("console colors should be enabled by default")
	}
	var console bytes.Buffer
	h.console = &console
	_ = h.Handle(context.Background(), slog.NewRecord(time.Now(), slog.LevelInfo, "hello", 0))
	if !strings.Contains(console.String(), "\033[32m") {
		t.Fatalf("console = %q", console.String())
	}
}

func TestConsoleColorsCanBeDisabled(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	h := configuredHandler(t)
	if h.color {
		t.Fatal("NO_COLOR should disable console colors")
	}
	var console bytes.Buffer
	h.console = &console
	_ = h.Handle(context.Background(), slog.NewRecord(time.Now(), slog.LevelInfo, "hello", 0))
	if strings.Contains(console.String(), "\033[") {
		t.Fatalf("console = %q", console.String())
	}
}
