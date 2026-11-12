package aisearch

import (
	"fmt"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

// Config 是 AI 搜索（OpenAI 兼容端点）的运行配置，全部来自服务端环境变量。
// 管理端不再保存 / 回显 API Key，也不再有配置接口。
type Config struct {
	Endpoint string
	APIKey   string
	Model    string
	Enabled  bool
}

func currentConfig() *Config {
	return &Config{
		Endpoint: config.S.AISearchEndpoint,
		APIKey:   config.S.AISearchAPIKey,
		Model:    config.S.AISearchModel,
		Enabled:  config.S.AISearchEnabled,
	}
}

// IsAvailable AI 搜索是否已启用且配置完整。
func IsAvailable() bool {
	c := currentConfig()
	return c.Enabled && c.Endpoint != "" && c.APIKey != "" && c.Model != ""
}

// SetTestConfig 是 APP_TEST_HOOKS 测试钩子：运行时覆盖 AI 配置并清空扩展缓存。
func SetTestConfig(enabled bool, endpoint, apiKey, model string) error {
	endpoint = strings.TrimRight(strings.TrimSpace(endpoint), "/")
	if endpoint != "" && !strings.HasPrefix(endpoint, "http://") && !strings.HasPrefix(endpoint, "https://") {
		return fmt.Errorf("endpoint 必须使用 http:// 或 https://")
	}
	config.S.AISearchEnabled = enabled
	config.S.AISearchEndpoint = endpoint
	config.S.AISearchAPIKey = strings.TrimSpace(apiKey)
	config.S.AISearchModel = strings.TrimSpace(model)
	clearCache()
	return nil
}
