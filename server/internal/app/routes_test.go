package app

import (
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/openapi"
)

var ginParam = regexp.MustCompile(`[:*]([a-zA-Z_][a-zA-Z0-9_]*)`)

// 契约一致性：docs/openapi.yaml 里的每个操作都有对应路由，且没有契约外的业务路由。
func TestRoutesMatchOpenAPIContract(t *testing.T) {
	engine := New()
	registered := map[string]bool{}
	for _, r := range engine.Routes() {
		path := ginParam.ReplaceAllString(r.Path, "{$1}")
		if !strings.HasPrefix(path, "/api/v1/") || strings.HasPrefix(path, "/api/v1/mcp") || path == "/api/v1/openapi.json" || strings.HasPrefix(path, "/__test__") {
			continue
		}
		registered[r.Method+" "+path] = true
	}
	ops, err := openapi.Operations()
	if err != nil {
		t.Fatal(err)
	}
	declared := map[string]bool{}
	var missing []string
	for _, op := range ops {
		key := strings.ToUpper(op.Method) + " " + op.Path
		declared[key] = true
		if !registered[key] {
			missing = append(missing, key)
		}
	}
	var extra []string
	for key := range registered {
		if !declared[key] {
			extra = append(extra, key)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)
	if len(missing) > 0 {
		t.Errorf("契约中有 %d 个操作未实现：\n%s", len(missing), strings.Join(missing, "\n"))
	}
	if len(extra) > 0 {
		t.Errorf("存在契约外的路由（需同步 docs/openapi.yaml）：\n%s", strings.Join(extra, "\n"))
	}
}
