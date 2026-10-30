package mcp

// 补齐原 Python tests/unit/test_mcp_server.py 中 mcp_test.go 未覆盖的用例：
// operation_describe 引用的 schema 都随结果返回、MCP 挂载点不在业务契约里、operation_call 转发已声明的请求头。

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/openapi"
)

func collectRefs(v any, out map[string]bool) {
	switch x := v.(type) {
	case map[string]any:
		for k, child := range x {
			if s, ok := child.(string); ok && k == "$ref" {
				out[strings.TrimPrefix(s, "#/components/schemas/")] = true
			}
			collectRefs(child, out)
		}
	case []any:
		for _, child := range x {
			collectRefs(child, out)
		}
	}
}

func TestOperationDescribeReturnsEveryReferencedSchema(t *testing.T) {
	listed, err := operationsList("", "stock")
	if err != nil || listed["count"].(int) == 0 {
		t.Fatalf("no stock operations: %v", err)
	}
	id := listed["operations"].([]any)[0].(map[string]any)["operation_id"].(string)
	described, err := operationDescribe(id)
	if err != nil {
		t.Fatal(err)
	}
	if described["operation_id"] != id {
		t.Fatalf("operation_id = %v", described["operation_id"])
	}
	switch described["method"] {
	case "GET", "POST", "PUT", "PATCH", "DELETE":
	default:
		t.Fatalf("method = %v", described["method"])
	}
	schemas := described["schemas"].(map[string]any)
	refs := map[string]bool{}
	collectRefs(map[string]any{"parameters": described["parameters"], "request_body": described["request_body"], "responses": described["responses"], "schemas": schemas}, refs)
	for name := range refs {
		if _, ok := schemas[name]; !ok {
			t.Errorf("%s 引用的 schema %s 没有随结果返回", id, name)
		}
	}
}

func TestMCPMountIsNotPartOfBusinessOpenAPI(t *testing.T) {
	ops, err := openapi.Operations()
	if err != nil {
		t.Fatal(err)
	}
	for _, op := range ops {
		if strings.HasPrefix(op.Path, "/api/v1/mcp") {
			t.Fatalf("MCP 挂载点不应出现在业务契约里：%s", op.Path)
		}
	}
}

// operation_call 把 If-Match 之类的已声明请求头（大小写不敏感，转发时用契约声明的名字）转发给业务接口；
// 托管头（X-API-Token / X-Project-Id）由 MCP 层设置，调用方不能覆盖。
func TestOperationCallForwardsDeclaredHeaders(t *testing.T) {
	var captured *http.Request
	SetHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r
		w.WriteHeader(http.StatusNoContent)
	}))
	defer SetHandler(nil)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/mcp/", nil)
	projectID := int64(2)
	ident := &identity{Token: "token-123", ProjectID: &projectID}
	const opID = "delete_ledger_tag_api_v1_ledger_tags__tag_id__delete"

	result, err := operationCall(c, ident, map[string]any{
		"operation_id": opID,
		"path_params":  map[string]any{"tag_id": "a/b"},
		"headers":      map[string]any{"If-Match": `"3"`},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result["status_code"] != http.StatusNoContent || result["data"] != nil {
		t.Fatalf("result = %v", result)
	}
	if captured.Method != http.MethodDelete || captured.URL.EscapedPath() != "/api/v1/ledger-tags/a%2Fb" {
		t.Fatalf("forwarded %s %s", captured.Method, captured.URL.EscapedPath())
	}
	if got := captured.Header.Get("If-Match"); got != `"3"` {
		t.Fatalf("If-Match = %q", got)
	}
	if captured.Header.Get("X-API-Token") != "token-123" || captured.Header.Get("X-Project-Id") != "2" {
		t.Fatalf("managed headers = %v", captured.Header)
	}

	// 不带 headers 时不报错，也不转发 If-Match。
	if _, err := operationCall(c, ident, map[string]any{"operation_id": opID, "path_params": map[string]any{"tag_id": float64(1)}}); err != nil {
		t.Fatal(err)
	}
	if captured.Header.Get("If-Match") != "" {
		t.Fatalf("unexpected If-Match: %v", captured.Header)
	}

	for _, tc := range []struct {
		headers map[string]any
		message string
	}{
		{map[string]any{"X-API-Token": "spoofed"}, "由 MCP 统一设置"},
		{map[string]any{"X-Project-Id": "2"}, "由 MCP 统一设置"},
		{map[string]any{"X-Trace": "1"}, "不接受请求头"},
		{map[string]any{"If-Match": float64(3)}, "必须是字符串"},
	} {
		_, err := operationCall(c, ident, map[string]any{"operation_id": opID, "path_params": map[string]any{"tag_id": float64(1)}, "headers": tc.headers})
		if err == nil || !strings.Contains(err.Error(), tc.message) {
			t.Errorf("headers %v: err = %v, want %q", tc.headers, err, tc.message)
		}
	}
}
