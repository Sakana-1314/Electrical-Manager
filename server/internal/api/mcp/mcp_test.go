package mcp

import (
	"reflect"
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/openapi"
)

func TestCatalogExposesManagementAPIsOnly(t *testing.T) {
	entries, _, err := Catalog()
	if err != nil || len(entries) == 0 {
		t.Fatalf("catalog empty: %v", err)
	}
	var stock, purchase bool
	for _, e := range entries {
		if e.Path == "/api/v1/stock-materials" {
			stock = true
		}
		if e.Path == "/api/v1/purchase-materials" {
			purchase = true
		}
		if strings.HasPrefix(e.Path, "/api/v1/mini-program/") || e.Path == "/api/v1/auth/login" || e.Path == "/api/v1/auth/refresh" {
			t.Fatalf("excluded path leaked: %s", e.Path)
		}
	}
	if !stock || !purchase {
		t.Fatal("expected stock and purchase operations in catalog")
	}
}

func TestEveryExclusionMatchesLiveOperation(t *testing.T) {
	ops, _ := openapi.Operations()
	paths := map[string]bool{}
	for _, op := range ops {
		paths[op.Path] = true
	}
	for _, p := range ExcludedPaths {
		if !paths[p] {
			t.Errorf("排除的路径 %s 已不是存活路由", p)
		}
	}
	for _, prefix := range ExcludedPrefixes {
		found := false
		for p := range paths {
			if strings.HasPrefix(p, prefix) {
				found = true
			}
		}
		if !found {
			t.Errorf("排除的前缀 %s 已匹配不到任何路由", prefix)
		}
	}
}

func TestCatalogPlusExclusionsCoverEveryOperation(t *testing.T) {
	ops, _ := openapi.Operations()
	entries, _, _ := Catalog()
	catalog := map[string]bool{}
	for _, e := range entries {
		catalog[e.Method+" "+e.Path] = true
	}
	excluded := 0
	for _, op := range ops {
		key := strings.ToUpper(op.Method) + " " + op.Path
		if isExcluded(op.Path) {
			excluded++
			if catalog[key] {
				t.Errorf("excluded op in catalog: %s", key)
			}
			continue
		}
		if !catalog[key] {
			t.Errorf("operation missing from catalog: %s", key)
		}
	}
	if excluded == 0 {
		t.Fatal("排除清单不应为空")
	}
}

func TestEveryCatalogOperationIsCallable(t *testing.T) {
	entries, _, _ := Catalog()
	for _, e := range entries {
		for _, raw := range e.Parameters {
			in := raw.(map[string]any)["in"]
			if in != "path" && in != "query" && in != "header" {
				t.Errorf("%s: unsupported parameter location %v", e.OperationID, in)
			}
		}
		args := e.CallArguments
		for _, h := range args["headers"].([]any) {
			if ManagedHeaders[strings.ToLower(h.(map[string]any)["name"].(string))] {
				t.Errorf("%s: managed header exposed", e.OperationID)
			}
		}
		rb, _ := e.RequestBody.(map[string]any)
		content, _ := rb["content"].(map[string]any)
		for ct := range content {
			if ct != "application/json" && ct != "multipart/form-data" {
				t.Errorf("%s: unsupported content type %s", e.OperationID, ct)
			}
		}
		if _, ok := content["multipart/form-data"]; ok {
			if args["file"] != "file" || args["body"] != nil {
				t.Errorf("%s: multipart must use file field 'file'", e.OperationID)
			}
		} else if args["file"] != nil {
			t.Errorf("%s: unexpected file argument", e.OperationID)
		}
	}
}

func TestOperationDescribeReportsCallArguments(t *testing.T) {
	described, err := operationDescribe("delete_ledger_tag_api_v1_ledger_tags__tag_id__delete")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]any{
		"path_params": []string{"tag_id"},
		"query":       []string{},
		"headers":     []any{map[string]any{"name": "if-match", "note": "乐观锁版本号（String(version)）；不传则不校验版本"}},
		"body":        nil,
		"file":        nil,
	}
	if !reflect.DeepEqual(described["call_arguments"], want) {
		t.Fatalf("call_arguments = %#v", described["call_arguments"])
	}
}

func TestOperationsListKeyword(t *testing.T) {
	listed, err := operationsList("", "stock")
	if err != nil || listed["count"].(int) == 0 {
		t.Fatalf("no stock operations: %v", err)
	}
}

func TestBuildPath(t *testing.T) {
	p, err := BuildPath("/api/v1/x/{a}/y/{b}", map[string]any{"a": float64(3), "b": "a/b c"})
	if err != nil || p != "/api/v1/x/3/y/a%2Fb%20c" {
		t.Fatalf("got %q %v", p, err)
	}
	if _, err := BuildPath("/x/{a}", map[string]any{}); err == nil || !strings.Contains(err.Error(), "缺少路径参数: a") {
		t.Fatalf("missing param: %v", err)
	}
	if _, err := BuildPath("/x", map[string]any{"z": 1}); err == nil || !strings.Contains(err.Error(), "存在未定义的路径参数: z") {
		t.Fatalf("extra param: %v", err)
	}
}
