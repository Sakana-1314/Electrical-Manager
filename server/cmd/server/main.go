// 电气车间备件管理系统后端（Go / Gin 实现）。
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/app"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/logx"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}
	s, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, "配置错误:", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(s.UploadDir, 0o755); err != nil {
		fmt.Fprintln(os.Stderr, "无法创建上传目录:", err)
		os.Exit(1)
	}
	if err := logx.Configure(s.LogDir, s.LogBackupCount); err != nil {
		fmt.Fprintln(os.Stderr, "无法初始化日志:", err)
		os.Exit(1)
	}
	// 缩略图缓存是可选的加速目录：创建失败只告警，预览退化为每次渲染。
	if err := os.MkdirAll(s.PreviewCacheDir, 0o755); err != nil {
		slog.Warn("无法创建缩略图缓存目录，预览将不使用缓存", "dir", s.PreviewCacheDir, "error", err)
	}
	dsn, err := s.PostgresDSN()
	if err != nil {
		slog.Error(err.Error())
		os.Exit(1)
	}
	if _, err := db.Open(dsn); err != nil {
		slog.Error("open database failed", "error", err)
		os.Exit(1)
	}
	slog.Info(fmt.Sprintf("service started environment=%s log_dir=%s", s.Environment, s.LogDir))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	lifecycle.RunStartup(ctx)
	wait := func() {}
	if os.Getenv("APP_DISABLE_WORKERS") == "" {
		// 测试环境可关闭常驻后台任务，避免与用例并发改写数据。
		wait = lifecycle.StartWorkers(ctx)
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", s.Host, s.Port),
		Handler:           app.New(),
		ReadHeaderTimeout: 30 * time.Second,
	}
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("http server failed", "error", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
	wait()
	_ = db.DB.Close()
}

// healthcheck 供容器健康检查使用：`server healthcheck`。
func healthcheck() int {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "8000"
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/health")
	if err != nil {
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return 1
	}
	return 0
}
