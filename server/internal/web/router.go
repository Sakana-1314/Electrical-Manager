package web

import (
	"regexp"

	"github.com/gin-gonic/gin"
)

// Router 是带依赖链的路由分组：分组依赖先于路由依赖执行（对应 APIRouter(dependencies=...)）。
type Router struct {
	g    *gin.RouterGroup
	deps []Dep
}

func NewRouter(g *gin.RouterGroup) *Router { return &Router{g: g} }

// Group 新建子分组；deps 追加在父分组依赖之后。
func (r *Router) Group(prefix string, deps ...Dep) *Router {
	all := append(append([]Dep{}, r.deps...), deps...)
	return &Router{g: r.g.Group(ginPath(prefix)), deps: all}
}

var pathParam = regexp.MustCompile(`\{([a-zA-Z_][a-zA-Z0-9_]*)(:path)?\}`)

// ginPath 把 FastAPI 风格的 `{item_id}` / `{path:path}` 转成 Gin 的 `:item_id` / `*path`。
func ginPath(p string) string {
	return pathParam.ReplaceAllStringFunc(p, func(m string) string {
		sub := pathParam.FindStringSubmatch(m)
		if sub[2] != "" {
			return "*" + sub[1]
		}
		return ":" + sub[1]
	})
}

func (r *Router) handle(method, path string, fn HandlerFunc, deps []Dep) {
	all := append(append([]Dep{}, r.deps...), deps...)
	r.g.Handle(method, ginPath(path), H(fn, all...))
}

func (r *Router) GET(path string, fn HandlerFunc, deps ...Dep)    { r.handle("GET", path, fn, deps) }
func (r *Router) POST(path string, fn HandlerFunc, deps ...Dep)   { r.handle("POST", path, fn, deps) }
func (r *Router) PUT(path string, fn HandlerFunc, deps ...Dep)    { r.handle("PUT", path, fn, deps) }
func (r *Router) PATCH(path string, fn HandlerFunc, deps ...Dep)  { r.handle("PATCH", path, fn, deps) }
func (r *Router) DELETE(path string, fn HandlerFunc, deps ...Dep) { r.handle("DELETE", path, fn, deps) }

// Raw 暴露底层 gin 分组（挂载非标准处理器，如 MCP）。
func (r *Router) Raw() *gin.RouterGroup { return r.g }
