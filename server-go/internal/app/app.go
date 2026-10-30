// Package app 组装 Gin 引擎：中间件、错误映射、健康检查与全部业务路由。
package app

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/api"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/middleware"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// New 构建 HTTP 处理器。
func New() *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.HandleMethodNotAllowed = true
	r.RedirectTrailingSlash = true
	r.RedirectFixedPath = false
	r.ContextWithFallback = true
	r.MaxMultipartMemory = 32 << 20
	// 中间件由外到内：真实 IP → 请求上下文（request_id / 耗时头 / 访问日志）→ 项目头 → CORS。
	r.Use(middleware.RealIP(), middleware.RequestContext(), middleware.Recovery(), middleware.ProjectHeader(), middleware.CORS())

	// 约定：禁止对外产生 404；未匹配路径返回 400 + ROUTE_NOT_FOUND。
	r.NoRoute(func(c *gin.Context) {
		web.WriteErrorBody(c, 400, "ROUTE_NOT_FOUND", "接口路径不存在", nil)
	})
	r.NoMethod(func(c *gin.Context) {
		web.WriteErrorBody(c, 405, "HTTP_ERROR", "Method Not Allowed", nil)
	})

	r.GET("/health", health)
	api.Register(web.NewRouter(r.Group("/api/v1")))
	return r
}

func health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	var one int
	if err := db.DB.QueryRowContext(ctx, "SELECT 1").Scan(&one); err != nil {
		slog.Warn("database health check failed", "error", err)
		web.WriteErrorBody(c, 503, "DATABASE_UNAVAILABLE", "数据库连接不可用", nil)
		return
	}
	c.Header("Content-Type", "application/json")
	c.String(http.StatusOK, `{"status":"ok","database":"ok"}`)
}
