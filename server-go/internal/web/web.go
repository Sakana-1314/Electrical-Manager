// Package web 是 Gin 之上的薄封装，复刻原 FastAPI 的请求处理语义：
//
//   - 依赖（Dep）按声明顺序先执行（项目 → 鉴权 → 角色 → 其他），依赖报错立即返回；
//   - 之后路径 / 查询 / 请求头 / 请求体参数统一校验，所有错误合并为一次 422 VALIDATION_ERROR；
//   - 处理函数返回后先提交请求事务，再写出响应（返回 2xx 时写库已可见）；出错则回滚。
package web

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// Ctx 是一次请求的处理上下文。
type Ctx struct {
	*gin.Context
	DB *db.Session

	// 鉴权依赖填充（未登录接口为 nil / 0）。
	User   any // *model.User 或 *model.MiniProgramUser，由 auth 包写入
	UserID int64

	// 已解析的项目（require_current_project / 小程序项目解析写入）。
	ProjectID int64

	pending *pendingResponse
	errs    []FieldError
	// 请求体缓存（多次读取）
	bodyRead bool
	body     []byte
	bodyErr  error
}

type pendingResponse struct {
	status   int
	write    func(w gin.ResponseWriter) error
	headers  map[string]string
	filePath string
	fileName string
	fileType string
}

// Dep 是一个依赖：按声明顺序执行，返回错误则终止请求。
type Dep func(c *Ctx) error

// HandlerFunc 是业务处理函数。
type HandlerFunc func(c *Ctx) error

// Std 返回请求的标准 context（携带 DB 耗时统计等）。
func (c *Ctx) Std() context.Context { return c.Request.Context() }

// ---------------- 响应 ----------------

// JSON 登记 JSON 响应（提交事务后再写出）。
func (c *Ctx) JSON(status int, v any) error {
	body, err := jtype.Marshal(v)
	if err != nil {
		return err
	}
	c.pending = &pendingResponse{status: status, write: func(w gin.ResponseWriter) error {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Length", strconv.Itoa(len(body)))
		w.WriteHeader(status)
		_, err := w.Write(body)
		return err
	}}
	return nil
}

// OK 是 JSON(200, v) 的简写。
func (c *Ctx) OK(v any) error { return c.JSON(http.StatusOK, v) }

// Created 是 JSON(201, v) 的简写。
func (c *Ctx) Created(v any) error { return c.JSON(http.StatusCreated, v) }

// NoContent 登记 204 空响应。
func (c *Ctx) NoContent() error {
	c.pending = &pendingResponse{status: http.StatusNoContent, write: func(w gin.ResponseWriter) error {
		w.WriteHeader(http.StatusNoContent)
		return nil
	}}
	return nil
}

// Bytes 登记二进制响应。
func (c *Ctx) Bytes(status int, contentType string, data []byte, headers map[string]string) error {
	c.pending = &pendingResponse{status: status, write: func(w gin.ResponseWriter) error {
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Length", strconv.Itoa(len(data)))
		w.WriteHeader(status)
		_, err := w.Write(data)
		return err
	}}
	return nil
}

// Redirect 登记重定向（默认 307，与 Starlette RedirectResponse 一致）。
func (c *Ctx) Redirect(status int, location string, headers map[string]string) error {
	if status == 0 {
		status = http.StatusTemporaryRedirect
	}
	c.pending = &pendingResponse{status: status, write: func(w gin.ResponseWriter) error {
		for k, v := range headers {
			w.Header().Set(k, v)
		}
		w.Header().Set("Location", location)
		w.Header().Set("Content-Length", "0")
		w.WriteHeader(status)
		return nil
	}}
	return nil
}

// File 登记文件下载响应（等价 Starlette FileResponse：附件名按 RFC 5987 编码）。
func (c *Ctx) File(path, filename, mediaType string, headers map[string]string) error {
	c.pending = &pendingResponse{status: http.StatusOK, filePath: path, fileName: filename, fileType: mediaType, headers: headers}
	return nil
}

// ContentDisposition 复刻 Starlette 的 Content-Disposition 生成规则。
func ContentDisposition(dispositionType, filename string) string {
	quoted := PyQuote(filename, "/")
	if quoted != filename {
		return fmt.Sprintf("%s; filename*=utf-8''%s", dispositionType, quoted)
	}
	return fmt.Sprintf(`%s; filename="%s"`, dispositionType, filename)
}

// PyQuote 等价 Python urllib.parse.quote(s, safe)。
func PyQuote(s, safe string) string {
	const always = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_.-~"
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if strings.IndexByte(always, ch) >= 0 || strings.IndexByte(safe, ch) >= 0 {
			b.WriteByte(ch)
		} else {
			fmt.Fprintf(&b, "%%%02X", ch)
		}
	}
	return b.String()
}

func writeFile(c *gin.Context, p *pendingResponse) error {
	f, err := os.Open(p.filePath)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}
	h := c.Writer.Header()
	for k, v := range p.headers {
		h.Set(k, v)
	}
	mediaType := p.fileType
	if mediaType == "" {
		mediaType = "application/octet-stream"
	}
	if strings.HasPrefix(mediaType, "text/") && !strings.Contains(mediaType, "charset") {
		mediaType += "; charset=utf-8"
	}
	h.Set("Content-Type", mediaType)
	if p.fileName != "" {
		h.Set("Content-Disposition", ContentDisposition("attachment", p.fileName))
	}
	h.Set("Last-Modified", st.ModTime().UTC().Format(http.TimeFormat))
	h.Set("Accept-Ranges", "bytes")
	http.ServeContent(c.Writer, c.Request, filepath.Base(p.filePath), st.ModTime(), f)
	return nil
}

// ---------------- 执行 ----------------

// H 把处理函数与依赖包装成 gin.HandlerFunc。
func H(fn HandlerFunc, deps ...Dep) gin.HandlerFunc {
	return func(g *gin.Context) {
		c := &Ctx{Context: g, DB: db.NewSession(g.Request.Context())}
		if pid, ok := g.Get(HeaderProjectKey); ok {
			if id, ok := pid.(int64); ok && id > 0 {
				c.DB.SetProject(id)
			}
		}
		defer c.DB.Close()
		err := run(c, fn, deps)
		if err != nil {
			c.DB.Rollback()
			WriteError(g, err)
			return
		}
		if c.pending == nil {
			_ = c.NoContent()
		}
		if err := c.DB.Commit(); err != nil {
			WriteError(g, err)
			return
		}
		p := c.pending
		if p.filePath != "" {
			if err := writeFile(g, p); err != nil {
				WriteError(g, err)
			}
			return
		}
		_ = p.write(g.Writer)
	}
}

func run(c *Ctx, fn HandlerFunc, deps []Dep) (err error) {
	defer func() {
		if r := recover(); r != nil {
			if e, ok := r.(error); ok && isAbortErr(e) {
				err = e
				return
			}
			err = &panicError{value: r}
		}
	}()
	for _, d := range deps {
		if err := d(c); err != nil {
			return err
		}
	}
	return fn(c)
}

type panicError struct{ value any }

func (p *panicError) Error() string { return fmt.Sprintf("panic: %v", p.value) }

func isAbortErr(error) bool { return false }

// ---------------- 错误响应 ----------------

const (
	RequestIDKey     = "request_id"
	UsernameKey      = "username"
	HeaderProjectKey = "header_project_id"
)

// ErrorBody 是统一错误响应体。
type ErrorBody struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Details   any    `json:"details"`
	RequestID string `json:"request_id"`
}

// RequestID 返回本次请求的 request_id。
func RequestID(g *gin.Context) string {
	if v, ok := g.Get(RequestIDKey); ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return "unknown"
}

// WriteErrorBody 输出统一错误体。
func WriteErrorBody(g *gin.Context, status int, code, message string, details any) {
	if details == nil {
		details = map[string]any{}
	}
	if m, ok := details.(map[string]any); ok && m == nil {
		details = map[string]any{}
	}
	body, _ := jtype.Marshal(ErrorBody{Code: code, Message: message, Details: details, RequestID: RequestID(g)})
	g.Writer.Header().Set("Content-Type", "application/json")
	g.Writer.Header().Set("Content-Length", strconv.Itoa(len(body)))
	g.Writer.WriteHeader(status)
	_, _ = g.Writer.Write(body)
	g.Abort()
}

// WriteError 把任意错误映射为统一错误体（对应原 exception_handlers.py）。
func WriteError(g *gin.Context, err error) {
	var ae *apperr.Error
	var ve *ValidationError
	rid := RequestID(g)
	switch {
	case errors.As(err, &ae):
		WriteErrorBody(g, ae.Status, ae.Code, ae.Message, ae.Details)
	case errors.As(err, &ve):
		WriteErrorBody(g, 422, "VALIDATION_ERROR", "请求参数校验失败", map[string]any{"errors": ve.Errors})
	case db.IsIntegrity(err):
		slog.Warn(fmt.Sprintf("database integrity error request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 409, "DATA_CONFLICT", "数据约束冲突", nil)
	case db.IsQueryError(err):
		slog.Error(fmt.Sprintf("database query error request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 500, "DATABASE_QUERY_ERROR", "数据库查询执行失败，请联系管理员", nil)
	case db.IsConnectionError(err):
		slog.Error(fmt.Sprintf("database unavailable request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 503, "DATABASE_UNAVAILABLE", "数据库暂时不可用，请稍后重试", nil)
	case db.IsDBError(err):
		slog.Error(fmt.Sprintf("database error request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 500, "DATABASE_ERROR", "数据库操作失败，请联系管理员", nil)
	case isUnavailable(err):
		slog.Error(fmt.Sprintf("database unavailable request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 503, "DATABASE_UNAVAILABLE", "数据库暂时不可用，请稍后重试", nil)
	default:
		slog.Error(fmt.Sprintf("unexpected server error request_id=%s error=%v", rid, err))
		WriteErrorBody(g, 500, "INTERNAL_SERVER_ERROR", "服务内部异常，请联系管理员", nil)
	}
}

func isUnavailable(err error) bool {
	if errors.Is(err, sql.ErrConnDone) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	msg := err.Error()
	for _, s := range []string{"connection refused", "invalid connection", "bad connection", "broken pipe", "i/o timeout", "no such host", "driver: bad connection"} {
		if strings.Contains(msg, s) {
			return true
		}
	}
	return false
}

// ---------------- 请求体 ----------------

// RawBody 读取（并缓存）请求体。
func (c *Ctx) RawBody() ([]byte, error) {
	if !c.bodyRead {
		c.bodyRead = true
		if c.Request.Body != nil {
			c.body, c.bodyErr = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewReader(c.body))
		}
	}
	return c.body, c.bodyErr
}

// ---------------- 便捷 ----------------

// SetUsername 记录访问日志中的用户名。
func (c *Ctx) SetUsername(name string) { c.Set(UsernameKey, name) }

// Now 便于测试替换。
var Now = func() time.Time { return time.Now().UTC() }

// QueryValues 返回原始查询参数。
func (c *Ctx) QueryValues() url.Values { return c.Request.URL.Query() }
