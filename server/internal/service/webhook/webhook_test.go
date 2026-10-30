package webhook

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
)

// 对应 tests/integration/test_webhooks.py::test_notification_message_format。
func TestMessageText(t *testing.T) {
	title, text := messageText(map[string]any{
		"event_type": "stock.outbound.created",
		"data": map[string]any{
			"operation_no":    "OUT-SHOULD-NOT-APPEAR",
			"receiver_name":   "张三",
			"subitem_no":      "01-02",
			"business_reason": "设备检修",
			"materials": []any{map[string]any{
				"name": "接触器", "model_spec": "CJX2", "quantity": "2.0000", "unit_name": "个",
			}},
		},
	})
	if title != "出库通知" || text != "物资：接触器 CJX2\n数量：2个\n领用人：张三\n用途：01-02 设备检修" {
		t.Fatalf("single outbound: %q %q", title, text)
	}

	title, text = messageText(map[string]any{
		"event_type": "stock.outbound.created",
		"data": map[string]any{
			"receiver_name": "张三", "subitem_no": "01-02", "business_reason": "设备检修",
			"materials": []any{
				map[string]any{"name": "接触器", "model_spec": "CJX2"},
				map[string]any{"name": "断路器", "model_spec": "DZ47"},
				map[string]any{"name": "继电器", "model_spec": "RXM"},
			},
		},
	})
	if title != "出库通知" || text != "物资：3项物资\n领用人：张三\n用途：01-02 设备检修" {
		t.Fatalf("multiple outbound: %q %q", title, text)
	}

	title, text = messageText(map[string]any{
		"event_type": "stock.inbound.created",
		"data":       map[string]any{"materials": []any{map[string]any{"name": "接触器"}, map[string]any{"name": "断路器"}}},
	})
	if title != "入库通知" || text != "入库数量：2 项" {
		t.Fatalf("inbound: %q %q", title, text)
	}

	title, text = messageText(map[string]any{
		"event_type": "mini_program.user.bound",
		"data":       map[string]any{"display_name": nil, "enabled": json.Number("1"), "project_name": " P "},
	})
	if title != "新用户绑定通知" || text != "项目：P\n姓名：None\n部门：-\n账号状态：已启用\n绑定时间：-" {
		t.Fatalf("user bound: %q %q", title, text)
	}

	title, text = messageText(map[string]any{"event_type": "webhook.test", "data": map[string]any{"project_name": "P"}})
	if title != "测试通知" || text != "这是一条 Webhook 测试通知。" {
		t.Fatalf("test: %q %q", title, text)
	}
	if title, _ := messageText(map[string]any{"event_type": "other"}); title != "通知" {
		t.Fatalf("unknown title %q", title)
	}
}

func TestQuantityText(t *testing.T) {
	// 期望值由原 Python _quantity_text 计算（含整数被 rstrip("0") 的原有行为）。
	cases := map[any]string{
		"2.0000": "2", "10": "1", "2.50": "2.5", "abc": "abc", json.Number("3"): "3", "1E+2": "1",
		"": "-", nil: "-", "0.0": "0",
	}
	for in, want := range cases {
		if got := quantityText(in); got != want {
			t.Errorf("quantityText(%v) = %q, want %q", in, got, want)
		}
	}
}

func TestValidateWebhookURL(t *testing.T) {
	ok := map[string]string{
		"https://open.feishu.cn/open-apis/bot/v2/hook/x":     "FEISHU",
		"https://open.larksuite.com/open-apis/bot/v2/hook/x": "FEISHU",
		" HTTPS://Open.Feishu.CN:443/open-apis/bot/v2/hook/": "FEISHU",
		"https://oapi.dingtalk.com/robot/send?access_token=": "DINGTALK",
	}
	for u, p := range ok {
		if _, err := validateWebhookURL(p, u); err != nil {
			t.Errorf("%s should be valid: %v", u, err)
		}
	}
	bad := map[string]string{
		"https://example.com/hook/token":                     "FEISHU",
		"http://open.feishu.cn/open-apis/bot/v2/hook/x":      "FEISHU",
		"https://oapi.dingtalk.com/other":                    "DINGTALK",
		"https://open.feishu.cn/x?/open-apis/bot/v2/hook/":   "FEISHU",
		"https://oapi.dingtalk.com.evil.test/robot/send":     "DINGTALK",
		"https://user@evil.test/open-apis/bot/v2/hook/token": "FEISHU",
	}
	for u, p := range bad {
		_, err := validateWebhookURL(p, u)
		ae, isApp := err.(*apperr.Error)
		if !isApp || ae.Code != "INVALID_WEBHOOK_URL" || ae.Status != 422 {
			t.Errorf("%s should be invalid, got %v", u, err)
		}
	}
	if _, err := validateWebhookURL("DINGTALK", "https://example.com"); err == nil || !strings.Contains(err.Error(), "钉钉") {
		t.Errorf("dingtalk message: %v", err)
	}
	if u, err := validateWebhookURL("FEISHU", "   "); u != "" || err != nil {
		t.Errorf("blank should pass through")
	}
}

func TestSignatures(t *testing.T) {
	nowFunc = func() time.Time { return time.Unix(1700000000, 123_000_000) }
	defer func() { nowFunc = time.Now }()
	payload := map[string]any{"event_type": "webhook.test", "data": map[string]any{}}

	body := feishuBody(payload, "sec")
	if body["timestamp"] != "1700000000" || body["sign"] != "ttGYnPblC3CcNExnS7y5igm57JhpqZJtHpJ+TURiUeg=" {
		t.Fatalf("feishu sign: %v", body)
	}
	if _, ok := feishuBody(payload, "")["sign"]; ok {
		t.Fatalf("no secret → no sign")
	}

	target, md := dingtalkRequest("https://oapi.dingtalk.com/robot/send?access_token=a+b&x=%2F&x=2&y", payload, "sec")
	want := "https://oapi.dingtalk.com/robot/send?access_token=a+b&x=2&y=&timestamp=1700000000123&sign=X4GzXrREC0BuuR0foEQVzeRBqW4ve0PLqw2ufqpOJvA%3D"
	if target != want {
		t.Fatalf("dingtalk url:\n got %s\nwant %s", target, want)
	}
	if md["markdown"].(map[string]any)["text"] != "### 测试通知\n\n这是一条 Webhook 测试通知。" {
		t.Fatalf("dingtalk markdown: %v", md)
	}
}

func TestSendThroughTestUpstream(t *testing.T) {
	var gotHost, gotPath string
	var gotBody map[string]any
	status := http.StatusOK
	respBody := `{"code":0,"msg":"success"}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHost, gotPath = r.Host, r.URL.RequestURI()
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		w.WriteHeader(status)
		_, _ = io.WriteString(w, respBody)
	}))
	defer srv.Close()
	if err := SetTestUpstream(srv.URL); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = SetTestUpstream("") }()

	code, excerpt, err := send("FEISHU", "https://open.feishu.cn/open-apis/bot/v2/hook/tok", "", testPayload())
	if err != nil || code != 200 || excerpt != respBody {
		t.Fatalf("send: %d %q %v", code, excerpt, err)
	}
	if gotHost != "open.feishu.cn" || gotPath != "/open-apis/bot/v2/hook/tok" {
		t.Fatalf("rewrite: host=%s path=%s", gotHost, gotPath)
	}
	if gotBody["content"].(map[string]any)["text"] != "测试通知\n这是一条 Webhook 测试通知。" {
		t.Fatalf("body: %v", gotBody)
	}

	respBody = `{"code":19021,"msg":"sign match fail"}`
	if _, _, err := send("FEISHU", "https://open.feishu.cn/open-apis/bot/v2/hook/tok", "", testPayload()); err == nil || err.Error() != "Webhook 平台拒绝请求：sign match fail" {
		t.Fatalf("reject: %v", err)
	}
	respBody = `{"errcode":false}`
	if _, _, err := send("DINGTALK", "https://oapi.dingtalk.com/robot/send", "", testPayload()); err != nil {
		t.Fatalf("errcode False equals 0 in Python: %v", err)
	}
	respBody = `not json`
	if _, _, err := send("DINGTALK", "https://oapi.dingtalk.com/robot/send", "", testPayload()); err == nil || err.Error() != "Webhook 返回了无效的 JSON" {
		t.Fatalf("invalid json: %v", err)
	}
	status, respBody = http.StatusBadRequest, `{}`
	_, _, err = send("DINGTALK", "https://oapi.dingtalk.com/robot/send?access_token=x", "", testPayload())
	want := "Client error '400 Bad Request' for url 'https://oapi.dingtalk.com/robot/send?access_token=x'\nFor more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400"
	if err == nil || err.Error() != want {
		t.Fatalf("status error:\n got %v\nwant %s", err, want)
	}

	err = TestChannel("DINGTALK", schema.WebhookTestRequest{WebhookURL: "https://oapi.dingtalk.com/robot/send?access_token=x"})
	ae, ok := err.(*apperr.Error)
	if !ok || ae.Code != "WEBHOOK_TEST_FAILED" || ae.Status != 502 || ae.Message != "测试推送失败："+want {
		t.Fatalf("test channel: %v", err)
	}
}

func TestPyEqualsZero(t *testing.T) {
	for _, v := range []any{json.Number("0"), json.Number("0.0"), false} {
		if !pyEqualsZero(v) {
			t.Errorf("%v should equal 0", v)
		}
	}
	for _, v := range []any{json.Number("1"), "0", nil, true, map[string]any{}} {
		if pyEqualsZero(v) {
			t.Errorf("%v should not equal 0", v)
		}
	}
}
