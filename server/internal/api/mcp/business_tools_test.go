package mcp

// 业务工具的约束校验：
//  1. 工具名唯一且符合 MCP 命名（小写字母 / 数字 / 下划线）；
//  2. 每个工具绑定的 operation_id 仍在契约目录里，路径 / 查询 / 请求体参数确实由该接口声明；
//  3. 缺省值与网页端一致（申购计划、工作总览、新建表单等）；
//  4. 必填参数缺失时在本地就报错，不会把无效请求转给业务接口。

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

var businessNameRe = regexp.MustCompile(`^[a-z][a-z0-9_]{2,63}$`)

func TestBusinessToolsAreValidAndBindLiveOperations(t *testing.T) {
	_, byID, err := Catalog()
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, tool := range businessTools() {
		if !businessNameRe.MatchString(tool.Name) {
			t.Errorf("%s: 工具名不符合 MCP 命名规范", tool.Name)
		}
		if seen[tool.Name] {
			t.Errorf("%s: 工具名重复", tool.Name)
		}
		seen[tool.Name] = true
		if tool.Title == "" || tool.Description == "" {
			t.Errorf("%s: 缺少 title 或 description", tool.Name)
		}
		entry, ok := byID[tool.OperationID]
		if !ok {
			t.Errorf("%s: operation_id %s 不在契约目录里", tool.Name, tool.OperationID)
			continue
		}
		declared := map[string]string{}
		for _, raw := range entry.Parameters {
			item, _ := raw.(map[string]any)
			declared[str(item["name"])] = str(item["in"])
		}
		bodyProps := requestBodyProperties(entry)
		for _, p := range tool.Params {
			switch p.In {
			case "path", "query":
				if declared[p.Name] != p.In {
					t.Errorf("%s: 参数 %s 不在接口 %s 的 %s 参数里", tool.Name, p.Name, tool.OperationID, p.In)
				}
			case "body":
				if bodyProps != nil && !bodyProps[p.Name] {
					t.Errorf("%s: 请求体字段 %s 不在接口 %s 的 schema 里", tool.Name, p.Name, tool.OperationID)
				}
			default:
				t.Errorf("%s: 参数 %s 的落位未知：%s", tool.Name, p.Name, p.In)
			}
		}
	}
}

// requestBodyProperties 返回 JSON 请求体的顶层字段名；无请求体时返回 nil。
func requestBodyProperties(entry *CatalogEntry) map[string]bool {
	rb, _ := entry.RequestBody.(map[string]any)
	content, _ := rb["content"].(map[string]any)
	jsonBody, ok := content["application/json"].(map[string]any)
	if !ok {
		return nil
	}
	schema, _ := jsonBody["schema"].(map[string]any)
	if ref, ok := schema["$ref"].(string); ok && strings.HasPrefix(ref, "#/components/schemas/") {
		if resolved, ok := entry.Schemas[strings.TrimPrefix(ref, "#/components/schemas/")].(map[string]any); ok {
			schema = resolved
		}
	}
	props, _ := schema["properties"].(map[string]any)
	out := make(map[string]bool, len(props))
	for name := range props {
		out[name] = true
	}
	return out
}

func mustBuild(t *testing.T, name string, args map[string]any) (map[string]any, map[string]any, map[string]any) {
	t.Helper()
	tool := businessToolByName(name)
	if tool == nil {
		t.Fatalf("未注册业务工具：%s", name)
	}
	path, query, body, err := tool.buildRequest(args)
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return path, query, body
}

func TestBusinessToolDefaultsFollowWeb(t *testing.T) {
	_, query, _ := mustBuild(t, "list_purchase_plans", nil)
	if got := query["status"]; !equalAny(got, []any{"正常"}) {
		t.Fatalf("申购计划默认状态应为 [正常]，实际 %#v", got)
	}
	if got, ok := query["moved"].(bool); !ok || got {
		t.Fatalf("申购计划默认应只看未转入（moved=false），实际 %#v", query["moved"])
	}
	if query["page"] != 1 || query["page_size"] != 20 {
		t.Fatalf("默认分页应为 1 / 20，实际 %#v / %#v", query["page"], query["page_size"])
	}

	_, query, _ = mustBuild(t, "list_work_overview", nil)
	if query["start_date"] != shanghaiMonthStart() || query["end_date"] != shanghaiMonthEnd() {
		t.Fatalf("工作总览默认区间应为本月，实际 %#v ~ %#v", query["start_date"], query["end_date"])
	}

	_, query, _ = mustBuild(t, "list_uncoded_materials", nil)
	if got, ok := query["coded"].(bool); !ok || got {
		t.Fatalf("未编码物资应固定 coded=false，实际 %#v", query["coded"])
	}
	if got := query["status"]; !equalAny(got, []any{"正常"}) {
		t.Fatalf("未编码物资默认状态应为 [正常]，实际 %#v", got)
	}

	_, _, body := mustBuild(t, "create_inventory_inbound", map[string]any{
		"lines": []any{map[string]any{"stock_material_id": 1, "quantity": "2"}},
	})
	if body["source_type"] != "MANUAL" {
		t.Fatalf("入库默认来源应为 MANUAL，实际 %#v", body["source_type"])
	}
	if body["occurred_at"] == "" || body["client_request_id"] == "" {
		t.Fatalf("入库应自动补齐 occurred_at 与 client_request_id，实际 %#v", body)
	}

	_, _, body = mustBuild(t, "create_purchase_plan", map[string]any{
		"name": "指示灯", "model_spec": "AD16-22DS", "unit_name": "个", "planned_qty": "10", "usage": "检修备件",
	})
	if body["plan_date"] != shanghaiToday() || body["status"] != "正常" || body["urgency"] != "正常" {
		t.Fatalf("新建申购计划默认值不一致：%#v", body)
	}

	_, _, body = mustBuild(t, "create_hazard", map[string]any{
		"description": "电缆桥架盖板缺失", "hazard_unit_id": 1, "hazard_type_id": 2,
	})
	if body["inspection_date"] != shanghaiToday() || body["level"] != "一般隐患" || body["status"] != "待整改" {
		t.Fatalf("登记隐患默认值不一致：%#v", body)
	}

	_, _, body = mustBuild(t, "move_purchase_plans_to_record", map[string]any{
		"material_ids": []any{1, 2},
	})
	if body["purchase_date"] != shanghaiToday() || body["status"] != "已申购" {
		t.Fatalf("转入申购记录默认值不一致：%#v", body)
	}
}

func TestBusinessToolRejectsMissingRequiredBody(t *testing.T) {
	tool := businessToolByName("create_inventory_inbound")
	if tool == nil {
		t.Fatal("未注册 create_inventory_inbound")
	}
	if _, _, _, err := tool.buildRequest(nil); err == nil || !strings.Contains(err.Error(), "lines") {
		t.Fatalf("缺少 lines 应报错，实际 %v", err)
	}
}

func TestBusinessToolUpdateHazardSendsPartialBody(t *testing.T) {
	path, _, body := mustBuild(t, "update_hazard", map[string]any{
		"hazard_id": 7, "version": 3, "status": "已整改", "rectify_person": "李建军",
	})
	if path["hazard_id"] != 7 {
		t.Fatalf("路径参数 hazard_id = %#v", path["hazard_id"])
	}
	if body["version"] != 3 || body["status"] != "已整改" || body["rectify_person"] != "李建军" {
		t.Fatalf("更新隐患 body = %#v", body)
	}
	if _, ok := body["description"]; ok {
		t.Fatalf("未传的字段不应出现在 body：%#v", body)
	}
}

func TestBusinessToolJoinComma(t *testing.T) {
	_, query, _ := mustBuild(t, "list_work_overview", map[string]any{
		"task_ids": []any{3, 1}, "participants": []any{"李建军", "孙浩宇"},
	})
	if query["task_ids"] != "3,1" || query["participants"] != "李建军,孙浩宇" {
		t.Fatalf("数组参数应拼成逗号分隔字符串，实际 %#v / %#v", query["task_ids"], query["participants"])
	}
	_, query, _ = mustBuild(t, "list_ledger_items", map[string]any{"tag_ids": []any{2, 4}})
	if query["tag_ids"] != "2,4" {
		t.Fatalf("标签应拼成逗号分隔字符串，实际 %#v", query["tag_ids"])
	}
}

func equalAny(got, want any) bool {
	switch g := got.(type) {
	case []any:
		w, ok := want.([]any)
		if !ok || len(g) != len(w) {
			return false
		}
		for i := range g {
			if g[i] != w[i] {
				return false
			}
		}
		return true
	}
	return got == want
}

// 业务工具把网页端默认值真正带到接口上，并且错误响应转成工具错误（isError=true）。
func TestBusinessToolForwardsDefaultsAndSurfacesErrors(t *testing.T) {
	var captured *http.Request
	var capturedBody []byte
	status := http.StatusOK
	response := `{"items":[],"total":0,"page":1,"page_size":20}`
	SetHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r
		capturedBody, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(response))
	}))
	defer SetHandler(nil)

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/api/v1/mcp/", nil)
	projectID := int64(2)
	ident := &identity{Token: "token-123", ProjectID: &projectID}

	if _, err := callBusinessTool(c, ident, businessToolByName("list_purchase_plans"), nil); err != nil {
		t.Fatal(err)
	}
	if captured.Method != http.MethodGet || captured.URL.Path != "/api/v1/purchase-materials" {
		t.Fatalf("forwarded %s %s", captured.Method, captured.URL.Path)
	}
	query := captured.URL.Query()
	if query.Get("status") != "正常" || query.Get("moved") != "false" {
		t.Fatalf("网页端默认筛选没有带上：%v", query)
	}
	if query.Get("page") != "1" || query.Get("page_size") != "20" {
		t.Fatalf("默认分页没有带上：%v", query)
	}

	if _, err := callBusinessTool(c, ident, businessToolByName("create_inventory_inbound"), map[string]any{
		"lines": []any{map[string]any{"stock_material_id": 1, "quantity": "2"}},
	}); err != nil {
		t.Fatal(err)
	}
	var body map[string]any
	if err := json.Unmarshal(capturedBody, &body); err != nil {
		t.Fatal(err)
	}
	if body["source_type"] != "MANUAL" || body["client_request_id"] == "" || body["occurred_at"] == "" {
		t.Fatalf("入库默认值没有带上：%#v", body)
	}
	if captured.Header.Get("X-API-Token") != "token-123" || captured.Header.Get("X-Project-Id") != "2" {
		t.Fatalf("托管头未设置：%v", captured.Header)
	}

	status = http.StatusUnprocessableEntity
	response = `{"code":"VALIDATION_ERROR","message":"物资不存在"}`
	_, err := callBusinessTool(c, ident, businessToolByName("list_purchase_plans"), nil)
	if err == nil || !strings.Contains(err.Error(), "VALIDATION_ERROR") || !strings.Contains(err.Error(), "物资不存在") {
		t.Fatalf("接口错误应转成工具错误，实际 %v", err)
	}
}
