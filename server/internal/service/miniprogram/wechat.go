// Package miniprogram 对应原 services/mini_program_service.py：微信登录（code2session）、
// 小程序用户建档 / 合并 / 审核、小程序码生成（getwxacodeunlimit），以及小程序端的出库与各类只读查询。
package miniprogram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

// ---------------- 微信凭证（对应 core/wechat.py） ----------------

func splitConfigured(raw string) []string {
	var out []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

// ConfiguredWechatAppIDs 对应 configured_wechat_app_ids：去重保序的已配置 AppID 列表。
func ConfiguredWechatAppIDs() []string {
	seen := map[string]bool{}
	out := []string{}
	for _, id := range splitConfigured(config.S.WechatMiniProgramAppID) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// GetWechatCredentials 对应 get_wechat_credentials(app_id)：appID 为空取第一个已配置的小程序。
func GetWechatCredentials(appID string) (string, string, error) {
	appIDs := splitConfigured(config.S.WechatMiniProgramAppID)
	secrets := splitConfigured(config.S.WechatMiniProgramAppSecret)
	unique := map[string]bool{}
	for _, id := range appIDs {
		unique[id] = true
	}
	if len(appIDs) == 0 || len(appIDs) != len(secrets) || len(appIDs) != len(unique) {
		return "", "", apperr.New("WECHAT_CONFIGURATION_INVALID", "微信小程序 AppID 与 AppSecret 配置无效").
			WithStatus(503).
			WithDetails(apperr.D{"app_id_count": len(appIDs), "app_secret_count": len(secrets)})
	}
	effective := appID
	if effective == "" {
		effective = appIDs[0]
	}
	for i, id := range appIDs {
		if id == effective {
			return effective, secrets[i], nil
		}
	}
	var detail any
	if effective != "" {
		detail = effective
	}
	return "", "", apperr.New("WECHAT_NOT_CONFIGURED", "当前微信小程序登录尚未配置").
		WithStatus(503).
		WithDetails(apperr.D{"app_id": detail})
}

// ---------------- 微信接口根地址与进程内缓存 ----------------

var (
	apiBaseMu       sync.RWMutex
	apiBaseOverride string

	// _wechat_access_tokens：app_id → (token, 过期时刻)；读写受 tokenCacheMu 保护，
	// 换取过程由 tokenLock（对应 _wechat_access_token_lock）串行化。
	tokenCacheMu sync.RWMutex
	accessTokens = map[string]cachedToken{}
	tokenLock    sync.Mutex

	// _material_code_cache：(material_uuid, env, app_id) → PNG；codeLock 对应 _material_code_lock。
	codeCacheMu   sync.RWMutex
	materialCodes = map[codeKey][]byte{}
	codeLock      sync.Mutex

	// 与 Python httpx.AsyncClient(timeout=5/10) 一致。
	authClient = &http.Client{Timeout: 5 * time.Second}
	codeClient = &http.Client{Timeout: 10 * time.Second}
)

type cachedToken struct {
	token   string
	expires time.Time // 带单调时钟读数，等价 time.monotonic()
}

type codeKey struct{ uuid, env, appID string }

func wechatAPIBase() string {
	apiBaseMu.RLock()
	override := apiBaseOverride
	apiBaseMu.RUnlock()
	if override != "" {
		return override
	}
	return config.S.WechatAPIBase
}

// SetTestWechatAPIBase 仅供 APP_TEST_HOOKS 测试钩子使用：把微信接口改投到本地桩服务（空串恢复配置值），
// 并清空 access_token 与小程序码缓存，避免用例之间互相影响。
func SetTestWechatAPIBase(base string) {
	apiBaseMu.Lock()
	apiBaseOverride = strings.TrimRight(base, "/")
	apiBaseMu.Unlock()
	ResetCaches()
}

// ResetCaches 清空进程内的 access_token 与小程序码缓存（测试用）。
func ResetCaches() {
	tokenCacheMu.Lock()
	accessTokens = map[string]cachedToken{}
	tokenCacheMu.Unlock()
	codeCacheMu.Lock()
	materialCodes = map[codeKey][]byte{}
	codeCacheMu.Unlock()
}

// ---------------- 微信接口调用 ----------------

// getJSON 发 GET 请求并解析 JSON；ok=false 表示网络错误 / 非 2xx / 非法 JSON（httpx.HTTPError 或 ValueError）。
func getJSON(ctx context.Context, client *http.Client, path string, params url.Values) (any, bool) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, wechatAPIBase()+path+"?"+params.Encode(), nil)
	if err != nil {
		return nil, false
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false
	}
	payload, err := decodeJSON(body)
	if err != nil {
		return nil, false
	}
	return payload, true
}

func decodeJSON(body []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	var payload any
	if err := dec.Decode(&payload); err != nil {
		return nil, err
	}
	if dec.More() {
		return nil, fmt.Errorf("extra data")
	}
	return payload, nil
}

// asObject 对应 payload.get(...)：非 dict 时 Python 抛 AttributeError（500），这里同样返回普通错误。
func asObject(payload any) (map[string]any, error) {
	obj, ok := payload.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("微信接口返回的 JSON 不是对象: %T", payload)
	}
	return obj, nil
}

// pyTruthy 复刻 Python 的真值判断（JSON 值）。
func pyTruthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case json.Number:
		f, err := x.Float64()
		return err != nil || f != 0
	case float64:
		return x != 0
	case string:
		return x != ""
	case []any:
		return len(x) > 0
	case map[string]any:
		return len(x) > 0
	}
	return true
}

// ExchangeWechatCode 对应 exchange_wechat_code(code, app_id)：用 wx.login 的临时 code 换 openid，
// 返回实际使用的 AppID 与 openid。appID 为空时用第一个已配置的小程序。
func ExchangeWechatCode(ctx context.Context, code, appID string) (string, string, error) {
	effectiveAppID, appSecret, err := GetWechatCredentials(appID)
	if err != nil {
		return "", "", err
	}
	params := url.Values{}
	params.Set("appid", effectiveAppID)
	params.Set("secret", appSecret)
	params.Set("js_code", code)
	params.Set("grant_type", "authorization_code")
	raw, ok := getJSON(ctx, authClient, "/sns/jscode2session", params)
	if !ok {
		return "", "", apperr.New("WECHAT_AUTH_UNAVAILABLE", "微信登录服务暂时不可用，请稍后重试").WithStatus(503)
	}
	payload, err := asObject(raw)
	if err != nil {
		return "", "", err
	}
	if pyTruthy(payload["errcode"]) {
		return "", "", apperr.New("WECHAT_AUTH_FAILED", "微信登录凭证无效，请重试").
			WithStatus(401).
			WithDetails(apperr.D{"wechat_errcode": payload["errcode"]})
	}
	openid, _ := payload["openid"].(string)
	if openid == "" {
		return "", "", apperr.New("WECHAT_AUTH_INVALID_RESPONSE", "微信登录服务返回异常").WithStatus(502)
	}
	return effectiveAppID, openid, nil
}

func cachedAccessToken(appID string) (string, bool) {
	tokenCacheMu.RLock()
	defer tokenCacheMu.RUnlock()
	cached, ok := accessTokens[appID]
	if ok && time.Now().Before(cached.expires) {
		return cached.token, true
	}
	return "", false
}

// pyInt 复刻 int(value)（JSON 值）：数字截断、数字字符串解析、布尔 0/1；其它类型报错（Python 抛异常 → 500）。
func pyInt(v any) (int64, error) {
	switch x := v.(type) {
	case json.Number:
		if n, err := x.Int64(); err == nil {
			return n, nil
		}
		f, err := x.Float64()
		if err != nil {
			return 0, err
		}
		return int64(f), nil
	case float64:
		return int64(x), nil
	case bool:
		if x {
			return 1, nil
		}
		return 0, nil
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(strings.ReplaceAll(x, "_", "")), 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid literal for int(): %q", x)
		}
		return n, nil
	}
	return 0, fmt.Errorf("int() argument must be a string or a number, not %T", v)
}

// getWechatAccessToken 对应 _get_wechat_access_token(app_id)：按 AppID 缓存，提前 5 分钟（至少 60 秒）过期。
func getWechatAccessToken(ctx context.Context, appID string) (string, error) {
	appID, appSecret, err := GetWechatCredentials(appID)
	if err != nil {
		return "", err
	}
	if token, ok := cachedAccessToken(appID); ok {
		return token, nil
	}
	tokenLock.Lock()
	defer tokenLock.Unlock()
	if token, ok := cachedAccessToken(appID); ok {
		return token, nil
	}
	params := url.Values{}
	params.Set("grant_type", "client_credential")
	params.Set("appid", appID)
	params.Set("secret", appSecret)
	raw, ok := getJSON(ctx, authClient, "/cgi-bin/token", params)
	if !ok {
		return "", apperr.New("WECHAT_ACCESS_TOKEN_UNAVAILABLE", "微信接口调用暂时不可用，请稍后重试").WithStatus(503)
	}
	payload, err := asObject(raw)
	if err != nil {
		return "", err
	}
	token, _ := payload["access_token"].(string)
	if pyTruthy(payload["errcode"]) || token == "" {
		return "", apperr.New("WECHAT_ACCESS_TOKEN_FAILED", "微信接口凭证获取失败").
			WithStatus(502).
			WithDetails(apperr.D{"wechat_errcode": payload["errcode"]})
	}
	var expiresIn int64 = 7200
	if v, present := payload["expires_in"]; present {
		if expiresIn, err = pyInt(v); err != nil {
			return "", err
		}
	}
	ttl := expiresIn - 300
	if ttl < 60 {
		ttl = 60
	}
	tokenCacheMu.Lock()
	accessTokens[appID] = cachedToken{token: token, expires: time.Now().Add(time.Duration(ttl) * time.Second)}
	tokenCacheMu.Unlock()
	return token, nil
}

// unlimitedCodeRequest 是 getwxacodeunlimit 的请求体（字段顺序与 Python dict 一致）。
type unlimitedCodeRequest struct {
	Scene      string `json:"scene"`
	Page       string `json:"page"`
	CheckPath  bool   `json:"check_path"`
	EnvVersion string `json:"env_version"`
	Width      int    `json:"width"`
}

func cachedMaterialCode(key codeKey) ([]byte, bool) {
	codeCacheMu.RLock()
	defer codeCacheMu.RUnlock()
	code, ok := materialCodes[key]
	return code, ok
}

// GenerateUnlimitedMaterialCode 对应 generate_unlimited_material_code(material_uuid, env, app_id)：
// 生成扫码出库页的不限量小程序码（scene 为去掉连字符的 UUID），按 (UUID, 环境, AppID) 进程内缓存。
// materialUUID 为规范化的带连字符 UUID；env 为 trial / release。
func GenerateUnlimitedMaterialCode(ctx context.Context, materialUUID, env, appID string) ([]byte, error) {
	key := codeKey{uuid: materialUUID, env: env, appID: appID}
	if code, ok := cachedMaterialCode(key); ok {
		return code, nil
	}
	codeLock.Lock()
	defer codeLock.Unlock()
	if code, ok := cachedMaterialCode(key); ok {
		return code, nil
	}
	accessToken, err := getWechatAccessToken(ctx, appID)
	if err != nil {
		return nil, err
	}
	unavailable := apperr.New("WECHAT_MINI_PROGRAM_CODE_UNAVAILABLE", "小程序码生成服务暂时不可用，请稍后重试").WithStatus(503)
	payload, err := json.Marshal(unlimitedCodeRequest{
		Scene:      strings.ReplaceAll(strings.ToLower(materialUUID), "-", ""),
		Page:       "pages/outbound/outbound",
		CheckPath:  false,
		EnvVersion: env,
		Width:      430,
	})
	if err != nil {
		return nil, err
	}
	params := url.Values{}
	params.Set("access_token", accessToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wechatAPIBase()+"/wxa/getwxacodeunlimit?"+params.Encode(), bytes.NewReader(payload))
	if err != nil {
		return nil, unavailable
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := codeClient.Do(req)
	if err != nil {
		return nil, unavailable
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, unavailable
	}
	if strings.HasPrefix(resp.Header.Get("Content-Type"), "image/") {
		codeCacheMu.Lock()
		materialCodes[key] = body
		codeCacheMu.Unlock()
		return body, nil
	}
	raw, err := decodeJSON(body)
	if err != nil {
		return nil, apperr.New("WECHAT_MINI_PROGRAM_CODE_INVALID_RESPONSE", "小程序码生成服务返回异常").WithStatus(502)
	}
	obj, err := asObject(raw)
	if err != nil {
		return nil, err
	}
	return nil, apperr.New("WECHAT_MINI_PROGRAM_CODE_FAILED", "小程序码生成失败").
		WithStatus(502).
		WithDetails(apperr.D{"wechat_errcode": obj["errcode"]})
}
