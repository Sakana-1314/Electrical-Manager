package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	maxAttempts         = 5
	pollInterval        = 2 * time.Second
	sendingLease        = 5 * time.Minute
	connectTimeout      = 3 * time.Second
	readWriteTimeout    = 8 * time.Second
	responseExcerptSize = 1000
)

var retryMinutes = []int{1, 5, 15, 60, 180}

// ---------------- HTTP 客户端（httpx.Timeout(8.0, connect=3.0)，不跟随重定向） ----------------

type deadlineConn struct {
	net.Conn
	timeout time.Duration
}

func (c *deadlineConn) Read(b []byte) (int, error) {
	_ = c.Conn.SetReadDeadline(time.Now().Add(c.timeout))
	return c.Conn.Read(b)
}

func (c *deadlineConn) Write(b []byte) (int, error) {
	_ = c.Conn.SetWriteDeadline(time.Now().Add(c.timeout))
	return c.Conn.Write(b)
}

var client = func() *http.Client {
	dialer := &net.Dialer{Timeout: connectTimeout, KeepAlive: 30 * time.Second}
	return &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				conn, err := dialer.DialContext(ctx, network, addr)
				if err != nil {
					return nil, err
				}
				return &deadlineConn{Conn: conn, timeout: readWriteTimeout}, nil
			},
			TLSHandshakeTimeout: connectTimeout,
			MaxIdleConnsPerHost: 4,
			IdleConnTimeout:     readWriteTimeout,
		},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}()

// sendError 是 _send 中 httpx.HTTPError / RuntimeError 一类的失败（测试推送时转为 WEBHOOK_TEST_FAILED）。
type sendError struct{ msg string }

func (e *sendError) Error() string { return e.msg }

func isSendError(err error) bool {
	var se *sendError
	return errors.As(err, &se)
}

// httpStatusMessage 复刻 httpx Response.raise_for_status() 的异常文案。
func httpStatusMessage(resp *http.Response, requestURL string) string {
	code := resp.StatusCode
	reason := strings.TrimSpace(strings.TrimPrefix(resp.Status, strconv.Itoa(code)))
	errorType := map[int]string{1: "Informational response", 3: "Redirect response", 4: "Client error", 5: "Server error"}[code/100]
	if errorType == "" {
		errorType = "Invalid status code"
	}
	msg := fmt.Sprintf("%s '%d %s' for url '%s'\n", errorType, code, reason, requestURL)
	switch code {
	case 301, 302, 303, 307, 308:
		if loc := resp.Header.Get("Location"); loc != "" {
			msg += fmt.Sprintf("Redirect location: '%s'\n", loc)
		}
	}
	return msg + fmt.Sprintf("For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/%d", code)
}

// pyEqualsZero 等价 Python `code != 0` 的否定（0、0.0、False 都等于 0）。
func pyEqualsZero(v any) bool {
	switch x := v.(type) {
	case json.Number:
		f, err := x.Float64()
		return err == nil && f == 0
	case bool:
		return !x
	}
	return false
}

func getDefault(m map[string]any, key string, def func() any) any {
	if v, ok := m[key]; ok {
		return v
	}
	return def()
}

// send 对应 _send：返回 (HTTP 状态码, 响应摘录)。
func send(platform, webhookURL, secret string, payload map[string]any) (int, string, error) {
	var target string
	var body map[string]any
	if platform == domain.WebhookFeishu {
		target, body = webhookURL, feishuBody(payload, secret)
	} else {
		target, body = dingtalkRequest(webhookURL, payload, secret)
	}
	raw, err := jtype.Marshal(body)
	if err != nil {
		return 0, "", err
	}
	actual, origHost, err := rewriteForTest(target)
	if err != nil {
		return 0, "", &sendError{msg: err.Error()}
	}
	req, err := http.NewRequest(http.MethodPost, actual, bytes.NewReader(raw))
	if err != nil {
		return 0, "", &sendError{msg: err.Error()}
	}
	if origHost != "" {
		req.Host = origHost
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", &sendError{msg: transportMessage(err)}
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, "", &sendError{msg: transportMessage(err)}
	}
	text := strings.ToValidUTF8(string(data), "�")
	excerpt := text
	if utf8.RuneCountInString(excerpt) > responseExcerptSize {
		excerpt = string([]rune(excerpt)[:responseExcerptSize])
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, "", &sendError{msg: httpStatusMessage(resp, target)}
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var result any
	if err := dec.Decode(&result); err != nil {
		return 0, "", &sendError{msg: "Webhook 返回了无效的 JSON"}
	}
	if _, err := dec.Token(); err != io.EOF {
		return 0, "", &sendError{msg: "Webhook 返回了无效的 JSON"}
	}
	obj, ok := result.(map[string]any)
	if !ok {
		// 原实现在非对象上调用 .get 抛 AttributeError（不属于 HTTPError / RuntimeError）。
		return 0, "", fmt.Errorf("'%s' object has no attribute 'get'", pyTypeName(result))
	}
	var code any
	if platform == domain.WebhookFeishu {
		code = getDefault(obj, "code", func() any { return getDefault(obj, "StatusCode", func() any { return json.Number("0") }) })
	} else {
		code = getDefault(obj, "errcode", func() any { return json.Number("0") })
	}
	if !pyEqualsZero(code) {
		message := getDefault(obj, "msg", func() any {
			return getDefault(obj, "StatusMessage", func() any { return getDefault(obj, "errmsg", func() any { return "未知错误" }) })
		})
		return 0, "", &sendError{msg: "Webhook 平台拒绝请求：" + pyStr(message)}
	}
	return resp.StatusCode, excerpt, nil
}

func pyTypeName(v any) string {
	switch v.(type) {
	case []any:
		return "list"
	case string:
		return "str"
	case bool:
		return "bool"
	case json.Number:
		return "int"
	case nil:
		return "NoneType"
	}
	return "object"
}

// transportMessage 网络层错误文案（无法与 httpx 逐字一致，去掉 Go 的 "Post \"url\": " 前缀）。
func transportMessage(err error) string {
	var ue *url.Error
	if errors.As(err, &ue) {
		return ue.Err.Error()
	}
	return err.Error()
}

// ---------------- 投递 ----------------

type claimedDelivery struct {
	deliveryID int64
	platform   string
	webhookURL string
	secret     string
	payload    map[string]any
	attempts   int64
}

// claimDelivery 对应 _claim_delivery：认领一条到期的待发记录（或租约过期的发送中记录）。
func claimDelivery(ctx context.Context) (*claimedDelivery, error) {
	now := common.UTCNow()
	staleAt := now.Add(-sendingLease)
	s := db.NewSession(ctx)
	defer s.Close()
	var d model.WebhookDelivery
	found, err := s.Find(&d,
		"SELECT "+model.ColsWebhookDelivery+" FROM webhook_delivery WHERE (status = ? AND next_retry_at <= ?) OR (status = ? AND updated_at <= ?) ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED",
		domain.DeliveryPending, now, domain.DeliverySending, staleAt)
	if err != nil || !found {
		return nil, err
	}
	var ch model.WebhookChannel
	if err := s.Get(&ch, "SELECT "+model.ColsWebhookChannel+" FROM webhook_channel WHERE id = ?", d.ChannelID); err != nil {
		return nil, err
	}
	attempts := d.Attempts + 1
	if _, err := s.Exec("UPDATE webhook_delivery SET status = ?, attempts = ?, updated_at = ? WHERE id = ?", domain.DeliverySending, attempts, now, d.ID); err != nil {
		return nil, err
	}
	webhookURL, err := decrypt(ch.WebhookURLEncrypted)
	if err != nil {
		return nil, err
	}
	secret, err := decrypt(ch.SecretEncrypted)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{}
	dec := json.NewDecoder(bytes.NewReader(d.Payload))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err == nil {
		if m, ok := v.(map[string]any); ok {
			payload = m
		}
	}
	claimed := &claimedDelivery{deliveryID: d.ID, platform: ch.Platform, webhookURL: webhookURL, secret: secret, payload: payload, attempts: attempts}
	if err := s.Commit(); err != nil {
		return nil, err
	}
	return claimed, nil
}

// finishDelivery 对应 _finish_delivery：成功记 SUCCEEDED；失败按退避表重排或记 FAILED。
func finishDelivery(ctx context.Context, c *claimedDelivery, status *int64, excerpt *string, sendErr error) error {
	s := db.NewSession(ctx)
	defer s.Close()
	var exists int
	found, err := s.Find(&exists, "SELECT 1 FROM webhook_delivery WHERE id = ?", c.deliveryID)
	if err != nil || !found {
		return err
	}
	now := common.UTCNow()
	if sendErr == nil {
		_, err = s.Exec("UPDATE webhook_delivery SET updated_at = ?, response_status = ?, response_excerpt = ?, status = ?, delivered_at = ?, last_error = NULL WHERE id = ?",
			now, status, excerpt, domain.DeliverySucceeded, now, c.deliveryID)
	} else {
		lastError := common.TruncateRunes(sendErr.Error(), 1000)
		if c.attempts >= maxAttempts {
			_, err = s.Exec("UPDATE webhook_delivery SET updated_at = ?, response_status = ?, response_excerpt = ?, last_error = ?, status = ? WHERE id = ?",
				now, status, excerpt, lastError, domain.DeliveryFailed, c.deliveryID)
		} else {
			next := now.Add(time.Duration(retryMinutes[c.attempts-1]) * time.Minute)
			_, err = s.Exec("UPDATE webhook_delivery SET updated_at = ?, response_status = ?, response_excerpt = ?, last_error = ?, status = ?, next_retry_at = ? WHERE id = ?",
				now, status, excerpt, lastError, domain.DeliveryPending, next, c.deliveryID)
		}
	}
	if err != nil {
		return err
	}
	return s.Commit()
}

// DeliverPendingOnce 对应 deliver_pending_once：投递一条，返回是否认领到了记录。
func DeliverPendingOnce(ctx context.Context) (bool, error) {
	claimed, err := claimDelivery(ctx)
	if err != nil || claimed == nil {
		return false, err
	}
	status, excerpt, sendErr := send(claimed.platform, claimed.webhookURL, claimed.secret, claimed.payload)
	if sendErr != nil {
		slog.Warn(fmt.Sprintf("webhook delivery failed delivery_id=%d platform=%s attempts=%d error_type=%s",
			claimed.deliveryID, claimed.platform, claimed.attempts, errorTypeName(sendErr)))
		return true, finishDelivery(ctx, claimed, nil, nil, sendErr)
	}
	st := int64(status)
	return true, finishDelivery(ctx, claimed, &st, &excerpt, nil)
}

func errorTypeName(err error) string {
	if isSendError(err) {
		return "HTTPError"
	}
	return fmt.Sprintf("%T", err)
}

// RunDeliveryWorker 对应 run_delivery_worker：有活就连续投递，空闲时每 2 秒轮询一次。
func RunDeliveryWorker(ctx context.Context) {
	for ctx.Err() == nil {
		delivered, err := DeliverPendingOnce(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			slog.Error(fmt.Sprintf("webhook delivery worker iteration failed error=%v", err))
			delivered = false
		}
		if delivered {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(pollInterval):
		}
	}
}

// CloseClient 对应 close_client：关闭空闲连接。
func CloseClient() { client.CloseIdleConnections() }

func init() {
	lifecycle.Worker("webhook-delivery-worker", nil, RunDeliveryWorker)
	lifecycle.OnShutdown(CloseClient)
}

// ---------------- 测试钩子（仅 APP_TEST_HOOKS=1 时由路由层调用） ----------------

var (
	testMu       sync.RWMutex
	testUpstream *url.URL
)

// SetTestUpstream 把机器人推送改投到本地桩服务 base（保留原路径与查询，Host 头保持原平台域名）；base 为空则取消。
func SetTestUpstream(base string) error {
	testMu.Lock()
	defer testMu.Unlock()
	if base == "" {
		testUpstream = nil
		return nil
	}
	u, err := url.Parse(base)
	if err != nil {
		return err
	}
	testUpstream = u
	return nil
}

func rewriteForTest(target string) (string, string, error) {
	testMu.RLock()
	base := testUpstream
	testMu.RUnlock()
	if base == nil {
		return target, "", nil
	}
	u, err := url.Parse(target)
	if err != nil {
		return "", "", err
	}
	host := u.Host
	u.Scheme = base.Scheme
	u.Host = base.Host
	return u.String(), host, nil
}

// TestHooksEnabled 是否启用测试钩子（APP_TEST_HOOKS=1）。
func TestHooksEnabled() bool { return os.Getenv("APP_TEST_HOOKS") == "1" }
