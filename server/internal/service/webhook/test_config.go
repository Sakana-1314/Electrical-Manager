package webhook

import (
	"fmt"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
)

// SetTestConfig 是 APP_TEST_HOOKS 测试钩子：运行时覆盖一个平台的环境变量配置。
func SetTestConfig(platform string, enabled bool, webhookURL, secret string, events []string) error {
	cfg := &config.WebhookConfig{Enabled: enabled, URL: webhookURL, Secret: secret, Events: append([]string{}, events...)}
	switch platform {
	case domain.WebhookFeishu:
		config.S.FeishuWebhook = *cfg
	case domain.WebhookDingTalk:
		config.S.DingTalkWebhook = *cfg
	default:
		return fmt.Errorf("未知的 Webhook 平台：%s", platform)
	}
	return nil
}
