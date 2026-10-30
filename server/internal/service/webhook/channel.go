package webhook

import (
	"fmt"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// Platforms 按枚举定义顺序列出平台。
var Platforms = []string{domain.WebhookFeishu, domain.WebhookDingTalk}

func encrypt(value string) string { return security.EncryptSecret(value) }

func decrypt(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	plain := security.DecryptSecret(value)
	if plain == nil {
		return "", apperr.New("WEBHOOK_CREDENTIAL_DECRYPT_FAILED", "Webhook 配置无法解密，请由超级管理员重新保存").WithStatus(503)
	}
	return *plain, nil
}

// urlParts 是 urllib.parse.urlparse 关心的几段（原样子串，不做解码）。
type urlParts struct {
	scheme, netloc, path, query, fragment string
}

// splitURL 近似 urllib.parse.urlsplit：scheme 小写；netloc 只在 "//" 之后出现。
func splitURL(raw string) urlParts {
	var p urlParts
	rest := raw
	if i := strings.IndexByte(rest, ':'); i > 0 && validScheme(rest[:i]) {
		p.scheme = strings.ToLower(rest[:i])
		rest = rest[i+1:]
	}
	if strings.HasPrefix(rest, "//") {
		rest = rest[2:]
		end := strings.IndexAny(rest, "/?#")
		if end < 0 {
			end = len(rest)
		}
		p.netloc, rest = rest[:end], rest[end:]
	}
	if i := strings.IndexByte(rest, '#'); i >= 0 {
		p.fragment = rest[i+1:]
		rest = rest[:i]
	}
	if i := strings.IndexByte(rest, '?'); i >= 0 {
		p.query = rest[i+1:]
		rest = rest[:i]
	}
	p.path = rest
	return p
}

func validScheme(s string) bool {
	for i, r := range s {
		isAlpha := (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')
		if i == 0 && !isAlpha {
			return false
		}
		if !isAlpha && !(r >= '0' && r <= '9') && r != '+' && r != '-' && r != '.' {
			return false
		}
	}
	return true
}

// hostname 等价 urlparse(...).hostname：去掉用户信息与端口，小写。
func (p urlParts) hostname() string {
	netloc := p.netloc
	if i := strings.LastIndexByte(netloc, '@'); i >= 0 {
		netloc = netloc[i+1:]
	}
	if strings.HasPrefix(netloc, "[") {
		if end := strings.IndexByte(netloc, ']'); end >= 0 {
			return strings.ToLower(netloc[1:end])
		}
	}
	if i := strings.IndexByte(netloc, ':'); i >= 0 {
		netloc = netloc[:i]
	}
	return strings.ToLower(netloc)
}

var allowedHosts = map[string][]string{
	domain.WebhookFeishu:   {"open.feishu.cn", "open.larksuite.com"},
	domain.WebhookDingTalk: {"oapi.dingtalk.com"},
}

var expectedPath = map[string]string{
	domain.WebhookFeishu:   "/open-apis/bot/v2/hook/",
	domain.WebhookDingTalk: "/robot/send",
}

// validateWebhookURL 对应 _validate_webhook_url：空串直接返回；否则要求 https + 平台域名 + 机器人路径。
func validateWebhookURL(platform, value string) (string, error) {
	u := strings.TrimSpace(value)
	if u == "" {
		return "", nil
	}
	parts := splitURL(u)
	if parts.scheme != "https" || !containsString(allowedHosts[platform], parts.hostname()) || !strings.Contains(parts.path, expectedPath[platform]) {
		name := "钉钉"
		if platform == domain.WebhookFeishu {
			name = "飞书"
		}
		return "", apperr.New("INVALID_WEBHOOK_URL", fmt.Sprintf("请输入有效的%s机器人 Webhook 地址", name)).WithStatus(422)
	}
	return u, nil
}

// ChannelRead 对应 channel_read：未保存的平台返回空配置（version=0）。
func ChannelRead(ch *model.WebhookChannel, platform string) (schema.WebhookChannelRead, error) {
	if ch == nil {
		return schema.WebhookChannelRead{Platform: platform, SubscribedEvents: []string{}}, nil
	}
	events := subscribedEvents(ch.SubscribedEvents)
	for _, e := range events {
		if !domain.WebhookEventType.Valid(e) {
			return schema.WebhookChannelRead{}, fmt.Errorf("%q is not a valid WebhookEventType", e)
		}
	}
	webhookURL, err := decrypt(ch.WebhookURLEncrypted)
	if err != nil {
		return schema.WebhookChannelRead{}, err
	}
	secret, err := decrypt(ch.SecretEncrypted)
	if err != nil {
		return schema.WebhookChannelRead{}, err
	}
	return schema.WebhookChannelRead{
		Platform:          ch.Platform,
		Enabled:           ch.Enabled,
		SubscribedEvents:  events,
		WebhookURL:        webhookURL,
		Secret:            secret,
		WebhookConfigured: ch.WebhookURLEncrypted != "",
		SecretConfigured:  ch.SecretEncrypted != "",
		UpdatedAt:         common.UTCPtr(&ch.UpdatedAt),
		Version:           ch.Version,
	}, nil
}

// ListChannels 对应 list_channels：按平台枚举顺序返回（未保存的给空配置）。
func ListChannels(s *db.Session) ([]schema.WebhookChannelRead, error) {
	var stored []model.WebhookChannel
	if err := s.Select(&stored, "SELECT "+model.ColsWebhookChannel+" FROM webhook_channel"); err != nil {
		return nil, err
	}
	byPlatform := map[string]*model.WebhookChannel{}
	for i := range stored {
		byPlatform[stored[i].Platform] = &stored[i]
	}
	out := make([]schema.WebhookChannelRead, 0, len(Platforms))
	for _, p := range Platforms {
		read, err := ChannelRead(byPlatform[p], p)
		if err != nil {
			return nil, err
		}
		out = append(out, read)
	}
	return out, nil
}

// UpdateChannel 对应 update_channel：乐观锁（未保存视为 version 0）+ 地址校验 + 加密保存。
func UpdateChannel(s *db.Session, platform string, data schema.WebhookChannelUpdate) (*model.WebhookChannel, error) {
	var ch model.WebhookChannel
	found, err := s.Find(&ch, "SELECT "+model.ColsWebhookChannel+" FROM webhook_channel WHERE platform = ? FOR UPDATE", platform)
	if err != nil {
		return nil, err
	}
	var actual int64
	if found {
		actual = ch.Version
	}
	if data.Version != actual {
		return nil, apperr.VersionConflict(data.Version, actual)
	}
	webhookURL, err := validateWebhookURL(platform, data.WebhookURL)
	if err != nil {
		return nil, err
	}
	if data.Enabled && webhookURL == "" {
		return nil, apperr.New("WEBHOOK_URL_REQUIRED", "启用推送前请填写 Webhook 地址").WithStatus(422)
	}
	if data.Enabled && len(data.SubscribedEvents) == 0 {
		return nil, apperr.New("WEBHOOK_EVENTS_REQUIRED", "启用推送前请至少选择一个事件").WithStatus(422)
	}

	events := append([]string{}, data.SubscribedEvents...)
	eventsJSON, err := jtype.ToJSON(events)
	if err != nil {
		return nil, err
	}
	urlEnc := ""
	if webhookURL != "" {
		urlEnc = encrypt(webhookURL)
	}
	secretEnc := ""
	if data.Secret != "" {
		secretEnc = encrypt(data.Secret)
	}
	now := common.UTCNow()
	version := actual + 1
	if !found {
		id, err := s.Insert(
			"INSERT INTO webhook_channel (platform, enabled, webhook_url_encrypted, secret_encrypted, subscribed_events, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			platform, data.Enabled, urlEnc, secretEnc, eventsJSON, now, now, version,
		)
		if err != nil {
			return nil, err
		}
		ch = model.WebhookChannel{ID: id, Platform: platform, CreatedAt: now}
	} else if _, err := s.Exec(
		"UPDATE webhook_channel SET enabled = ?, subscribed_events = ?, webhook_url_encrypted = ?, secret_encrypted = ?, version = ?, updated_at = ? WHERE id = ?",
		data.Enabled, eventsJSON, urlEnc, secretEnc, version, now, ch.ID,
	); err != nil {
		return nil, err
	}
	ch.Enabled = data.Enabled
	ch.SubscribedEvents = eventsJSON
	ch.WebhookURLEncrypted = urlEnc
	ch.SecretEncrypted = secretEnc
	ch.Version = version
	ch.UpdatedAt = now
	return &ch, nil
}

// TestChannel 对应 test_channel：用未保存的地址 / 密钥直接发一条测试通知。
func TestChannel(platform string, data schema.WebhookTestRequest) error {
	webhookURL, err := validateWebhookURL(platform, data.WebhookURL)
	if err != nil {
		return err
	}
	if webhookURL == "" {
		return apperr.New("WEBHOOK_URL_REQUIRED", "请填写 Webhook 地址").WithStatus(422)
	}
	if _, _, err := send(platform, webhookURL, data.Secret, testPayload()); err != nil {
		if isSendError(err) {
			return apperr.New("WEBHOOK_TEST_FAILED", "测试推送失败："+err.Error()).WithStatus(502)
		}
		return err
	}
	return nil
}

func testPayload() map[string]any {
	return map[string]any{
		"event_id":    security.UUID4(),
		"event_type":  "webhook.test",
		"occurred_at": common.UTCNow().Format("2006-01-02T15:04:05") + "Z",
		"data":        map[string]any{},
	}
}
