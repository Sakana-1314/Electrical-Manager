package miniprogram

// 对应 server/tests/test_mini_program_service.py（原用例 monkeypatch httpx.AsyncClient，这里用本地 httptest 服务）。

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

func withWechatConfig(t *testing.T, appIDs, secrets string) {
	t.Helper()
	oldID, oldSecret := config.S.WechatMiniProgramAppID, config.S.WechatMiniProgramAppSecret
	config.S.WechatMiniProgramAppID, config.S.WechatMiniProgramAppSecret = appIDs, secrets
	t.Cleanup(func() {
		config.S.WechatMiniProgramAppID, config.S.WechatMiniProgramAppSecret = oldID, oldSecret
	})
}

func withStub(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	SetTestWechatAPIBase(srv.URL)
	t.Cleanup(func() {
		SetTestWechatAPIBase("")
		srv.Close()
	})
}

func appErr(t *testing.T, err error) *apperr.Error {
	t.Helper()
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		t.Fatalf("want *apperr.Error, got %v", err)
	}
	return ae
}

const defaultIDs, defaultSecrets = "wx-test-primary,wx-test-secondary", "test-primary-secret,test-secondary-secret"

func TestGenerateUnlimitedMaterialCodeUsesCompactUUIDScene(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	type captured struct {
		Path   string
		Params map[string]string
		JSON   map[string]any
	}
	var mu sync.Mutex
	var calls []captured
	withStub(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/cgi-bin/token":
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "token-" + r.URL.Query().Get("appid"), "expires_in": 7200})
		case "/wxa/getwxacodeunlimit":
			body, _ := io.ReadAll(r.Body)
			var payload map[string]any
			_ = json.Unmarshal(body, &payload)
			mu.Lock()
			calls = append(calls, captured{Path: r.URL.Path, Params: map[string]string{"access_token": r.URL.Query().Get("access_token")}, JSON: payload})
			mu.Unlock()
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write([]byte(r.URL.Query().Get("access_token") + "-" + payload["env_version"].(string)))
		default:
			http.NotFound(w, r)
		}
	})
	ctx := context.Background()
	uuid := "10000000-0000-4000-8000-000000000001"
	trial, err := GenerateUnlimitedMaterialCode(ctx, uuid, "trial", "wx-test-primary")
	if err != nil {
		t.Fatal(err)
	}
	repeated, _ := GenerateUnlimitedMaterialCode(ctx, uuid, "trial", "wx-test-primary")
	release, _ := GenerateUnlimitedMaterialCode(ctx, uuid, "release", "wx-test-primary")
	secondary, _ := GenerateUnlimitedMaterialCode(ctx, uuid, "trial", "wx-test-secondary")
	if string(trial) != "token-wx-test-primary-trial" || string(repeated) != string(trial) {
		t.Fatalf("trial = %q, repeated = %q", trial, repeated)
	}
	if string(release) != "token-wx-test-primary-release" || string(secondary) != "token-wx-test-secondary-trial" {
		t.Fatalf("release = %q, secondary = %q", release, secondary)
	}
	scene := map[string]any{"scene": "10000000000040008000000000000001", "page": "pages/outbound/outbound", "check_path": false, "width": float64(430)}
	expect := func(token, env string) captured {
		j := map[string]any{"env_version": env}
		for k, v := range scene {
			j[k] = v
		}
		return captured{Path: "/wxa/getwxacodeunlimit", Params: map[string]string{"access_token": token}, JSON: j}
	}
	want := []captured{
		expect("token-wx-test-primary", "trial"),
		expect("token-wx-test-primary", "release"),
		expect("token-wx-test-secondary", "trial"),
	}
	if !reflect.DeepEqual(calls, want) {
		t.Fatalf("calls = %#v\nwant %#v", calls, want)
	}
}

func TestMaterialCodeRequestBodyFieldOrder(t *testing.T) {
	raw, _ := json.Marshal(unlimitedCodeRequest{Scene: "s", Page: "pages/outbound/outbound", EnvVersion: "trial", Width: 430})
	want := `{"scene":"s","page":"pages/outbound/outbound","check_path":false,"env_version":"trial","width":430}`
	if string(raw) != want {
		t.Fatalf("got %s", raw)
	}
}

func TestMaterialCodeErrors(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	mode := "json"
	withStub(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/cgi-bin/token" {
			_, _ = w.Write([]byte(`{"access_token":"tk"}`))
			return
		}
		switch mode {
		case "json":
			_, _ = w.Write([]byte(`{"errcode":41030,"errmsg":"invalid page"}`))
		case "garbage":
			_, _ = w.Write([]byte(`not json`))
		case "500":
			w.WriteHeader(500)
		}
	})
	ctx := context.Background()
	_, err := GenerateUnlimitedMaterialCode(ctx, "10000000-0000-4000-8000-000000000002", "trial", "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_MINI_PROGRAM_CODE_FAILED" || ae.Status != 502 {
		t.Fatalf("got %v", ae)
	} else if b, _ := json.Marshal(ae.Details); string(b) != `{"wechat_errcode":41030}` {
		t.Fatalf("details %s", b)
	}
	mode = "garbage"
	_, err = GenerateUnlimitedMaterialCode(ctx, "10000000-0000-4000-8000-000000000002", "trial", "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_MINI_PROGRAM_CODE_INVALID_RESPONSE" || ae.Status != 502 {
		t.Fatalf("got %v", ae)
	}
	mode = "500"
	_, err = GenerateUnlimitedMaterialCode(ctx, "10000000-0000-4000-8000-000000000002", "trial", "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_MINI_PROGRAM_CODE_UNAVAILABLE" || ae.Status != 503 {
		t.Fatalf("got %v", ae)
	}
}

func TestAccessTokenCacheIsIsolatedByAppID(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	var mu sync.Mutex
	var requested []string
	withStub(t, func(w http.ResponseWriter, r *http.Request) {
		appID := r.URL.Query().Get("appid")
		mu.Lock()
		requested = append(requested, appID)
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "token-" + appID, "expires_in": 7200})
	})
	ctx := context.Background()
	primary, err := getWechatAccessToken(ctx, "wx-test-primary")
	if err != nil {
		t.Fatal(err)
	}
	secondary, _ := getWechatAccessToken(ctx, "wx-test-secondary")
	repeated, _ := getWechatAccessToken(ctx, "wx-test-primary")
	if primary != "token-wx-test-primary" || repeated != primary || secondary != "token-wx-test-secondary" {
		t.Fatalf("primary=%q secondary=%q repeated=%q", primary, secondary, repeated)
	}
	if !reflect.DeepEqual(requested, []string{"wx-test-primary", "wx-test-secondary"}) {
		t.Fatalf("requested = %v", requested)
	}
}

func TestAccessTokenErrors(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	body := `{"errcode":40013,"errmsg":"invalid appid"}`
	withStub(t, func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) })
	_, err := getWechatAccessToken(context.Background(), "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_ACCESS_TOKEN_FAILED" || ae.Status != 502 {
		t.Fatalf("got %v", ae)
	}
	body = `{"expires_in":7200}`
	_, err = getWechatAccessToken(context.Background(), "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_ACCESS_TOKEN_FAILED" {
		t.Fatalf("got %v", ae)
	} else if b, _ := json.Marshal(ae.Details); string(b) != `{"wechat_errcode":null}` {
		t.Fatalf("details %s", b)
	}
	body = `oops`
	_, err = getWechatAccessToken(context.Background(), "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_ACCESS_TOKEN_UNAVAILABLE" || ae.Status != 503 {
		t.Fatalf("got %v", ae)
	}
}

func TestExchangeWechatCodeSelectsCredentialsByAppID(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	var captured map[string]string
	withStub(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sns/jscode2session" {
			http.NotFound(w, r)
			return
		}
		q := r.URL.Query()
		captured = map[string]string{"appid": q.Get("appid"), "secret": q.Get("secret"), "js_code": q.Get("js_code"), "grant_type": q.Get("grant_type")}
		_, _ = w.Write([]byte(`{"openid":"secondary-openid"}`))
	})
	ctx := context.Background()
	appID, openid, err := ExchangeWechatCode(ctx, "temporary-code", "wx-test-secondary")
	if err != nil || appID != "wx-test-secondary" || openid != "secondary-openid" {
		t.Fatalf("got %q %q %v", appID, openid, err)
	}
	want := map[string]string{"appid": "wx-test-secondary", "secret": "test-secondary-secret", "js_code": "temporary-code", "grant_type": "authorization_code"}
	if !reflect.DeepEqual(captured, want) {
		t.Fatalf("params = %v", captured)
	}
	_, _, err = ExchangeWechatCode(ctx, "temporary-code", "wx-unknown")
	if ae := appErr(t, err); ae.Code != "WECHAT_NOT_CONFIGURED" || !strings.Contains(ae.Message, "当前微信小程序登录尚未配置") || ae.Status != 503 {
		t.Fatalf("got %v", ae)
	}

	config.S.WechatMiniProgramAppID = "wx-test-primary, wx-test-secondary, wx-test-third"
	config.S.WechatMiniProgramAppSecret = "test-primary-secret, test-secondary-secret, test-third-secret"
	third, _, err := ExchangeWechatCode(ctx, "third-code", "wx-test-third")
	if err != nil || third != "wx-test-third" || captured["secret"] != "test-third-secret" {
		t.Fatalf("third = %q secret = %q err = %v", third, captured["secret"], err)
	}

	config.S.WechatMiniProgramAppSecret = "test-primary-secret,test-secondary-secret"
	_, _, err = ExchangeWechatCode(ctx, "temporary-code", "wx-test-primary")
	if ae := appErr(t, err); ae.Code != "WECHAT_CONFIGURATION_INVALID" || !strings.Contains(ae.Message, "AppID 与 AppSecret 配置无效") {
		t.Fatalf("got %v", ae)
	}
}

func TestExchangeWechatCodeErrors(t *testing.T) {
	withWechatConfig(t, defaultIDs, defaultSecrets)
	body, status := `{"errcode":40029,"errmsg":"invalid code"}`, 200
	withStub(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	})
	ctx := context.Background()
	_, _, err := ExchangeWechatCode(ctx, "c", "")
	if ae := appErr(t, err); ae.Code != "WECHAT_AUTH_FAILED" || ae.Status != 401 {
		t.Fatalf("got %v", ae)
	} else if b, _ := json.Marshal(ae.Details); string(b) != `{"wechat_errcode":40029}` {
		t.Fatalf("details %s", b)
	}
	body = `{"errcode":0,"openid":""}`
	_, _, err = ExchangeWechatCode(ctx, "c", "")
	if ae := appErr(t, err); ae.Code != "WECHAT_AUTH_INVALID_RESPONSE" || ae.Status != 502 {
		t.Fatalf("got %v", ae)
	}
	body = `{"errcode":0,"openid":"ok"}`
	appID, openid, err := ExchangeWechatCode(ctx, "c", "")
	if err != nil || appID != "wx-test-primary" || openid != "ok" {
		t.Fatalf("got %q %q %v", appID, openid, err)
	}
	status = 502
	_, _, err = ExchangeWechatCode(ctx, "c", "")
	if ae := appErr(t, err); ae.Code != "WECHAT_AUTH_UNAVAILABLE" || ae.Status != 503 {
		t.Fatalf("got %v", ae)
	}
}

func TestPyHelpers(t *testing.T) {
	for _, c := range []struct {
		v    any
		want bool
	}{{nil, false}, {json.Number("0"), false}, {json.Number("0.0"), false}, {json.Number("40029"), true}, {"", false}, {"x", true}, {false, false}, {[]any{}, false}, {map[string]any{"a": 1}, true}} {
		if got := pyTruthy(c.v); got != c.want {
			t.Errorf("pyTruthy(%#v) = %v", c.v, got)
		}
	}
	if n, err := pyInt(json.Number("7200.9")); err != nil || n != 7200 {
		t.Errorf("pyInt float = %d %v", n, err)
	}
	if n, err := pyInt(" 600 "); err != nil || n != 600 {
		t.Errorf("pyInt str = %d %v", n, err)
	}
	if _, err := pyInt(nil); err == nil {
		t.Error("pyInt(nil) should fail")
	}
}
