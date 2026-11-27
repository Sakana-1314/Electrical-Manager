package mcp

import (
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/openapi"
)

// describe 取 describe_api_operation 的返回，找不到时直接失败。
func describe(t *testing.T, operationID string) map[string]any {
	t.Helper()
	described, err := operationDescribe(operationID)
	if err != nil {
		t.Fatalf("describe %s: %v", operationID, err)
	}
	return described
}

func parameterTitle(t *testing.T, operationID, name string) string {
	t.Helper()
	described := describe(t, operationID)
	parameters, _ := described["parameters"].([]any)
	for _, raw := range parameters {
		item, _ := raw.(map[string]any)
		if str(item["name"]) != name {
			continue
		}
		schema, _ := item["schema"].(map[string]any)
		return str(schema["title"])
	}
	t.Fatalf("%s 缺少参数 %s", operationID, name)
	return ""
}

func propertyTitle(t *testing.T, operationID, schemaName, field string) string {
	t.Helper()
	described := describe(t, operationID)
	schemas, _ := described["schemas"].(map[string]any)
	schema, _ := schemas[schemaName].(map[string]any)
	properties, _ := schema["properties"].(map[string]any)
	property, _ := properties[field].(map[string]any)
	if property == nil {
		t.Fatalf("%s 的 %s 缺少属性 %s", operationID, schemaName, field)
	}
	return str(property["title"])
}

// 申购计划 / 申购记录的两个人员字段在界面上是「提报员工 / 实际需求人」，
// 契约里的英文标题（Actual Demand Person / Purchase Responsible）语义正好错位。
func TestDescribeUsesUIWordingForPurchaseFields(t *testing.T) {
	const listPlans = "list_materials_api_v1_purchase_materials_get"
	cases := map[string]string{
		"actual_demand_person": "提报员工",
		"purchase_responsible": "实际需求人",
		"model_spec":           "型号规格",
	}
	for field, want := range cases {
		if got := parameterTitle(t, listPlans, field); got != want {
			t.Errorf("%s 参数 %s 标题 = %q，期望 %q", listPlans, field, got, want)
		}
	}

	const createPlan = "create_material_api_v1_purchase_materials_post"
	for field, want := range map[string]string{
		"actual_demand_person": "提报员工",
		"purchase_responsible": "实际需求人",
		"planned_qty":          "计划数量",
		"unit_name":            "计量单位",
		"stock_material_id":    "关联二级库物资",
		"image_ids":            "图片",
	} {
		if got := propertyTitle(t, createPlan, "PurchaseMaterialCreate", field); got != want {
			t.Errorf("PurchaseMaterialCreate.%s 标题 = %q，期望 %q", field, got, want)
		}
	}
}

// 同名字段按模块取界面文案：name / model_spec / 物资 ID 在二级库、华星、台账、申购计划之间不同。
func TestDescribeResolvesSameFieldByModule(t *testing.T) {
	cases := []struct {
		operationID, name, want string
	}{
		{"update_material_api_v1_stock_materials__material_id__patch", "material_id", "物资 ID"},
		{"update_material_api_v1_purchase_materials__material_id__patch", "material_id", "申购计划 ID"},
		{"edit_user_api_v1_users__item_id__patch", "item_id", "用户 ID"},
		{"update_ledger_item_api_v1_ledger_items__item_id__patch", "item_id", "台账 ID"},
		{"edit_project_api_v1_projects__item_id__patch", "item_id", "项目 ID"},
		{"list_huaxing_inventory_api_v1_huaxing_inventory_get", "name", "货品名称"},
		{"list_huaxing_inventory_api_v1_huaxing_inventory_get", "model_spec", "型号"},
		{"list_material_codes_api_v1_material_code_library_get", "name", "名称"},
	}
	for _, c := range cases {
		if got := parameterTitle(t, c.operationID, c.name); got != c.want {
			t.Errorf("%s 参数 %s 标题 = %q，期望 %q", c.operationID, c.name, got, c.want)
		}
	}

	schemaCases := []struct {
		operationID, schema, field, want string
	}{
		{"update_material_api_v1_stock_materials__material_id__patch", "StockMaterialUpdate", "name", "物资名称"},
		{"list_huaxing_inventory_api_v1_huaxing_inventory_get", "HuaXingInventoryRead", "material_code", "货品编码"},
		{"update_ledger_item_api_v1_ledger_items__item_id__patch", "LedgerItemUpdate", "model_spec", "型号"},
		{"update_ledger_item_api_v1_ledger_items__item_id__patch", "LedgerItemUpdate", "unit_name", "单位"},
		{"create_work_task_api_v1_work_tasks_post", "WorkTaskCreate", "name", "工作任务"},
		{"create_work_task_api_v1_work_tasks_post", "WorkTaskCreate", "steps", "事项或步骤"},
		{"create_work_task_api_v1_work_tasks_post", "WorkTaskCreate", "owner", "责任人"},
		{"create_work_task_api_v1_work_tasks_post", "WorkTaskCreate", "progress", "完成度"},
		{"create_hazard_api_v1_hazards_post", "HazardCreate", "description", "隐患描述"},
		{"create_hazard_api_v1_hazards_post", "HazardCreate", "status", "整改状态"},
		{"create_hazard_api_v1_hazards_post", "HazardCreate", "level", "隐患等级"},
	}
	for _, c := range schemaCases {
		if got := propertyTitle(t, c.operationID, c.schema, c.field); got != c.want {
			t.Errorf("%s.%s 标题 = %q，期望 %q", c.schema, c.field, got, c.want)
		}
	}
}

// 字段中文名只改 MCP 的展示副本，内嵌契约本身（Swagger / openapi.json）必须保持原样。
func TestCatalogDoesNotMutateEmbeddedContract(t *testing.T) {
	schemas := openapi.Schemas()
	schema, _ := schemas["PurchaseMaterialCreate"].(map[string]any)
	properties, _ := schema["properties"].(map[string]any)
	field, _ := properties["actual_demand_person"].(map[string]any)
	before := str(field["title"])

	if _, _, err := Catalog(); err != nil {
		t.Fatalf("catalog: %v", err)
	}

	if after := str(field["title"]); after != before {
		t.Fatalf("Catalog 修改了内嵌契约：actual_demand_person 标题 %q -> %q", before, after)
	}
	if before != "Actual Demand Person" {
		t.Fatalf("契约原标题 = %q，期望保持 Actual Demand Person", before)
	}
}

// 所有 MCP 可见的路径 / 查询参数都必须有界面中文名（新增参数时在 field_labels.go 补一行）。
func TestEveryParameterHasChineseLabel(t *testing.T) {
	entries, _, err := Catalog()
	if err != nil {
		t.Fatalf("catalog: %v", err)
	}
	for _, entry := range entries {
		for _, raw := range entry.Parameters {
			item, _ := raw.(map[string]any)
			if item["in"] == "header" {
				continue
			}
			name := str(item["name"])
			label, ok := paramLabel(entry.Tags, name)
			if !ok || strings.TrimSpace(label) == "" {
				t.Errorf("%s 参数 %s 缺少界面中文名", entry.OperationID, name)
			}
		}
	}
}

// 写操作的请求体字段也必须用界面中文名（字段键名保持接口原样）。
func TestEveryRequestBodyFieldHasChineseLabel(t *testing.T) {
	entries, _, err := Catalog()
	if err != nil {
		t.Fatalf("catalog: %v", err)
	}
	for _, entry := range entries {
		refs := map[string]bool{}
		collectSchemaRefs(entry.RequestBody, refs)
		for schemaName := range refs {
			schema, _ := entry.Schemas[schemaName].(map[string]any)
			properties, _ := schema["properties"].(map[string]any)
			for field := range properties {
				label, ok := schemaFieldLabel(schemaName, field)
				if !ok || !containsHan(label) {
					t.Errorf("%s 请求体 %s.%s 缺少界面中文名（当前 %q）", entry.OperationID, schemaName, field, label)
				}
			}
		}
	}
}

func collectSchemaRefs(value any, out map[string]bool) {
	switch x := value.(type) {
	case map[string]any:
		if ref, ok := x["$ref"].(string); ok {
			const prefix = "#/components/schemas/"
			if strings.HasPrefix(ref, prefix) {
				out[strings.TrimPrefix(ref, prefix)] = true
			}
		}
		for _, child := range x {
			collectSchemaRefs(child, out)
		}
	case []any:
		for _, child := range x {
			collectSchemaRefs(child, out)
		}
	}
}

func containsHan(s string) bool {
	for _, r := range s {
		if r >= '\u4e00' && r <= '\u9fff' {
			return true
		}
	}
	return false
}
