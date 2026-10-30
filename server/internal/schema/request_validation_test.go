package schema

// 对应原 Python 的 tests/test_schemas.py：请求体校验（图片去重、空串归一为 null、默认状态、
// 同一单据物资不重复、发生时间必须带时区、未知状态拒绝）。

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const imageID = "01900000-0000-7000-8000-000000000001"

func purchaseMaterialPayload() map[string]any {
	return map[string]any{
		"material_code": "", "category": "", "name": "接触器", "model_spec": "CJX2-1810", "unit_name": "个",
		"planned_qty": "2", "usage": "设备检修", "image_ids": []any{imageID},
	}
}

func purchaseRecordPayload() map[string]any {
	return map[string]any{
		"plan_date": "2026-07-22", "material_code": "", "material_name": "接触器", "model_spec": "CJX2-1810",
		"unit_name": "个", "actual_demand_person": "张三", "purchase_responsible": "李四", "purchase_qty": "2",
		"usage": "设备检修", "image_ids": []any{imageID}, "status": "已申购", "version": 1,
	}
}

func operationUpdatePayload() map[string]any {
	return map[string]any{
		"version": 1, "operation_type": "INBOUND", "occurred_at": "2026-07-22T09:00:00+08:00", "source_type": "MANUAL",
		"lines": []any{map[string]any{"stock_material_id": 1, "quantity": "2"}},
	}
}

func with(base map[string]any, key string, value any) map[string]any {
	out := map[string]any{}
	for k, v := range base {
		out[k] = v
	}
	out[key] = value
	return out
}

func decode(t *testing.T, payload map[string]any, dst any) []web.FieldError {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	return web.DecodeJSONBody(raw, dst, []any{"body"})
}

func requireError(t *testing.T, errs []web.FieldError, message string) {
	t.Helper()
	for _, e := range errs {
		if strings.Contains(e.Msg, message) {
			return
		}
	}
	t.Fatalf("expected error containing %q, got %+v", message, errs)
}

func TestRequestModelsAcceptValidValues(t *testing.T) {
	stock := NewStockMaterialCreate()
	if errs := decode(t, map[string]any{"name": "接触器", "model_spec": "CJX2-1810", "unit_name": "个", "image_ids": []any{imageID}}, &stock); errs != nil {
		t.Fatalf("stock: %+v", errs)
	}
	material := NewPurchaseMaterialCreate()
	if errs := decode(t, purchaseMaterialPayload(), &material); errs != nil {
		t.Fatalf("purchase material: %+v", errs)
	}
	record := NewPurchaseRecordUpdate()
	if errs := decode(t, purchaseRecordPayload(), &record); errs != nil {
		t.Fatalf("purchase record: %+v", errs)
	}
	var operation OperationUpdate
	if errs := decode(t, operationUpdatePayload(), &operation); errs != nil {
		t.Fatalf("operation: %+v", errs)
	}

	if len(stock.ImageIDs) != 1 || len(material.ImageIDs) != 1 || record.ImageIDs == nil || len(*record.ImageIDs) != 1 {
		t.Fatal("image_ids not decoded")
	}
	if material.MaterialCode != nil || material.Category != nil || record.MaterialCode != nil {
		t.Fatal("空串应归一为 null")
	}
	if material.Status != "正常" {
		t.Fatalf("default status = %q", material.Status)
	}
	if operation.Lines[0].StockMaterialID != 1 || operation.OccurredAtTime.IsZero() {
		t.Fatalf("operation = %+v", operation)
	}
}

func TestRequestModelsRejectDuplicateImages(t *testing.T) {
	dup := []any{imageID, imageID}
	stock := NewStockMaterialCreate()
	requireError(t, decode(t, map[string]any{"name": "接触器", "model_spec": "CJX2-1810", "unit_name": "个", "image_ids": dup}, &stock), "image_ids contains duplicates")
	material := NewPurchaseMaterialCreate()
	requireError(t, decode(t, with(purchaseMaterialPayload(), "image_ids", dup), &material), "image_ids contains duplicates")
	record := NewPurchaseRecordUpdate()
	requireError(t, decode(t, with(purchaseRecordPayload(), "image_ids", dup), &record), "image_ids contains duplicates")
}

func TestOperationUpdateRejectsDuplicateMaterials(t *testing.T) {
	var operation OperationUpdate
	lines := []any{map[string]any{"stock_material_id": 1, "quantity": "2"}, map[string]any{"stock_material_id": 1, "quantity": "3"}}
	requireError(t, decode(t, with(operationUpdatePayload(), "lines", lines), &operation), "one operation may only contain a material once")
}

func TestOperationUpdateRequiresTimezone(t *testing.T) {
	var operation OperationUpdate
	requireError(t, decode(t, with(operationUpdatePayload(), "occurred_at", "2026-07-22T09:00:00"), &operation), "occurred_at must include a timezone")
}

func TestPurchaseMaterialRejectsUnknownStatus(t *testing.T) {
	material := NewPurchaseMaterialCreate()
	if errs := decode(t, with(purchaseMaterialPayload(), "status", "已取消"), &material); len(errs) == 0 {
		t.Fatal("unknown status should be rejected")
	}
}
