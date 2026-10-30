// Package middleware 对应原 core/middleware.py：真实 IP、请求上下文（request_id、耗时头、访问日志）、
// Referer 优先的 CORS、X-Project-Id 解析。
package middleware

import (
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const clientIPKey = "client_ip"

// RealIP 采用可信边缘代理提供的客户端 IP：EO-Connecting-IP → X-Real-IP → X-Forwarded-For 首段。
func RealIP() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := ""
		candidates := []string{
			c.GetHeader("EO-Connecting-IP"),
			c.GetHeader("X-Real-IP"),
			strings.SplitN(c.GetHeader("X-Forwarded-For"), ",", 2)[0],
		}
		for _, v := range candidates {
			v = strings.TrimSpace(v)
			if v == "" {
				continue
			}
			if parsed := net.ParseIP(v); parsed != nil {
				ip = parsed.String()
				break
			}
		}
		if ip == "" {
			if host, _, err := net.SplitHostPort(c.Request.RemoteAddr); err == nil {
				ip = host
			} else {
				ip = "unknown"
			}
		}
		c.Set(clientIPKey, ip)
		c.Next()
	}
}

// timingWriter 在写出响应头之前补上耗时响应头（总耗时 / 数据库耗时 / 计算耗时 / SQL 条数）。
type timingWriter struct {
	gin.ResponseWriter
	started   time.Time
	timing    *db.Timing
	requestID string
	done      bool
	elapsedMS float64
	dbMS      float64
}

func (w *timingWriter) stamp() {
	if w.done {
		return
	}
	w.done = true
	w.elapsedMS = float64(time.Since(w.started).Nanoseconds()) / 1e6
	w.dbMS = min(w.timing.TotalMS(), w.elapsedMS)
	h := w.ResponseWriter.Header()
	h.Set("X-Request-ID", w.requestID)
	h.Set("X-Response-Time", fmt.Sprintf("%.2f", w.elapsedMS))
	h.Set("X-DB-Time", fmt.Sprintf("%.2f", w.dbMS))
	h.Set("X-Compute-Time", fmt.Sprintf("%.2f", w.elapsedMS-w.dbMS))
	h.Set("X-DB-Queries", strconv.FormatInt(w.timing.Count(), 10))
}

func (w *timingWriter) WriteHeader(code int) {
	w.stamp()
	w.ResponseWriter.WriteHeader(code)
}

func (w *timingWriter) Write(b []byte) (int, error) {
	w.stamp()
	return w.ResponseWriter.Write(b)
}

func (w *timingWriter) WriteString(s string) (int, error) {
	w.stamp()
	return w.ResponseWriter.WriteString(s)
}

func (w *timingWriter) WriteHeaderNow() {
	w.stamp()
	w.ResponseWriter.WriteHeaderNow()
}

// RequestContext 注入 request_id、接口性能响应头并记录访问日志。
func RequestContext() gin.HandlerFunc {
	return func(c *gin.Context) {
		var requestID string
		if vals := c.Request.Header.Values("X-Request-ID"); len(vals) > 0 {
			requestID = vals[0]
		} else {
			requestID = uuid.NewString()
		}
		if runes := []rune(requestID); len(runes) > 128 {
			requestID = string(runes[:128])
		}
		c.Set(web.RequestIDKey, requestID)
		timing := &db.Timing{}
		c.Request = c.Request.WithContext(db.WithTiming(c.Request.Context(), timing))
		tw := &timingWriter{ResponseWriter: c.Writer, started: time.Now(), timing: timing, requestID: requestID}
		c.Writer = tw
		c.Next()
		tw.stamp()
		username := "anonymous"
		if v, ok := c.Get(web.UsernameKey); ok {
			username = fmt.Sprint(v)
		}
		path := c.Request.URL.Path
		if path == "/health" {
			// 健康检查只写文件日志也无意义，与原版一致：控制台过滤，这里直接跳过。
			return
		}
		slog.Info(fmt.Sprintf(
			"HTTP %s %s -> %d | %.2f ms | db=%.2f ms/%d query | compute=%.2f ms | client_ip=%s | user=%s | request_id=%s",
			c.Request.Method, path, c.Writer.Status(), tw.elapsedMS, tw.dbMS, timing.Count(),
			tw.elapsedMS-tw.dbMS, c.GetString(clientIPKey), username, requestID,
		))
	}
}

// ProjectHeader 把可解析的正整数 X-Project-Id 落到请求上下文（只设定，不查库校验）。
func ProjectHeader() gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := strings.TrimSpace(c.GetHeader("X-Project-Id"))
		if raw != "" {
			if id, err := strconv.ParseInt(raw, 10, 64); err == nil && id > 0 {
				c.Set(web.HeaderProjectKey, id)
			}
		}
		c.Next()
	}
}

// ---------------- CORS ----------------

const (
	allowMethods  = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
	exposeHeaders = "Content-Disposition, X-Request-ID, X-Response-Time, X-DB-Time, X-DB-Queries, X-Compute-Time"
)

func originFromURL(value string) string {
	u := strings.TrimSpace(value)
	if u == "" {
		return ""
	}
	if u == "null" {
		return u
	}
	parsed, err := url.Parse(u)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return strings.ToLower(parsed.Scheme) + "://" + strings.ToLower(parsed.Host)
}

func isAllowedOrigin(origin string, allowed []string) bool {
	host := ""
	if parsed, err := url.Parse(origin); err == nil {
		host = strings.ToLower(parsed.Host)
	}
	for _, a := range allowed {
		if a == origin {
			return true
		}
	}
	for _, a := range allowed {
		la := strings.ToLower(a)
		if la == "*" || la == host || (strings.HasPrefix(la, ".") && strings.HasSuffix(host, la)) {
			return true
		}
	}
	return false
}

func corsOrigin(c *gin.Context, allowed []string) string {
	origin := originFromURL(c.GetHeader("Referer"))
	if origin == "" {
		origin = originFromURL(c.GetHeader("Origin"))
	}
	if origin == "" {
		return ""
	}
	if len(allowed) == 0 || isAllowedOrigin(origin, allowed) {
		return origin
	}
	return ""
}

func addVary(h interface {
	Get(string) string
	Set(string, string)
}, value string) {
	existing := h.Get("Vary")
	if existing == "" {
		h.Set("Vary", value)
		return
	}
	for _, part := range strings.Split(existing, ",") {
		if strings.EqualFold(strings.TrimSpace(part), value) {
			return
		}
	}
	h.Set("Vary", existing+", "+value)
}

// CORS Referer 优先、Origin 兜底；只有白名单内（或未配置白名单）的来源才回显。
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		s := config.S
		origin := corsOrigin(c, s.CORSOrigins)
		if origin == "" {
			c.Next()
			return
		}
		if c.Request.Method == "OPTIONS" && c.GetHeader("Access-Control-Request-Method") != "" {
			h := c.Writer.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Methods", allowMethods)
			h.Set("Access-Control-Max-Age", strconv.Itoa(s.CORSMaxAge))
			h.Set("Access-Control-Expose-Headers", exposeHeaders)
			h.Set("Vary", "Origin, Referer")
			if s.CORSAllowCredentials {
				h.Set("Access-Control-Allow-Credentials", "true")
			}
			if req := c.GetHeader("Access-Control-Request-Headers"); req != "" {
				h.Set("Access-Control-Allow-Headers", req)
			}
			if c.GetHeader("Access-Control-Request-Private-Network") == "true" {
				h.Set("Access-Control-Allow-Private-Network", "true")
			}
			h.Set("Content-Type", "text/plain; charset=utf-8")
			c.String(200, "OK")
			c.Abort()
			return
		}
		h := c.Writer.Header()
		h.Set("Access-Control-Allow-Origin", origin)
		if s.CORSAllowCredentials {
			h.Set("Access-Control-Allow-Credentials", "true")
		}
		h.Set("Access-Control-Expose-Headers", exposeHeaders)
		addVary(h, "Origin")
		addVary(h, "Referer")
		c.Next()
	}
}

// Recovery 兜底未捕获的 panic（处理函数内的 panic 已由 web.H 转为 500）。
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				slog.Error(fmt.Sprintf("unexpected server error request_id=%s panic=%v", web.RequestID(c), r))
				if !c.Writer.Written() {
					web.WriteErrorBody(c, 500, "INTERNAL_SERVER_ERROR", "服务内部异常，请联系管理员", nil)
				}
				c.Abort()
			}
		}()
		c.Next()
	}
}
