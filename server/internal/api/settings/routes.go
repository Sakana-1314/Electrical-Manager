// Package settings 是系统设置接口（对应原 api/v1/system_settings.py）。
//
// 管理端只保留「高级设置」里的开关（小程序注册 / 新用户默认状态 / 二级库精简模式）；
// 模型服务与 Webhook 走服务端环境变量，图片加速能力已移除。
package settings

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/appsettings"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("/system-settings")
	// 公开配置端点：同时服务管理端与小程序（两种鉴权体系不同），故保持匿名。
	g.GET("/mini-program-features", miniProgramFeatures)
	g.GET("/advanced-settings", getAdvancedSettings, auth.SystemAdmin)
	g.PUT("/advanced-settings", updateAdvancedSettings, auth.SystemAdmin)

	if webhook.TestHooksEnabled() {
		// 测试钩子（路径相对 /api/v1 回到根）：/__test__/webhook/upstream、/__test__/webhook/deliver-once、
		// /__test__/webhook/settings（运行时覆盖 Webhook 环境变量）。
		r.Raw().POST("/../../__test__/webhook/upstream", setWebhookUpstream)
		r.Raw().POST("/../../__test__/webhook/deliver-once", deliverOnce)
		r.Raw().POST("/../../__test__/webhook/settings", setWebhookSettings)
	}
}

func miniProgramFeatures(c *web.Ctx) error {
	features, err := appsettings.GetMiniProgramFeatures(c.DB)
	if err != nil {
		return err
	}
	return c.OK(features)
}

func getAdvancedSettings(c *web.Ctx) error {
	setting, err := appsettings.Get(c.DB)
	if err != nil {
		return err
	}
	return c.OK(appsettings.Read(setting))
}

func updateAdvancedSettings(c *web.Ctx) error {
	p := c.Params()
	var data schema.AdvancedSettingsUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	setting, err := appsettings.Update(c.DB, data)
	if err != nil {
		return err
	}
	return c.OK(appsettings.Read(setting))
}

// setWebhookUpstream 请求体：{"base_url": "http://127.0.0.1:port" | ""}
func setWebhookUpstream(g *gin.Context) {
	var body struct {
		BaseURL string `json:"base_url"`
	}
	if err := json.NewDecoder(g.Request.Body).Decode(&body); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := webhook.SetTestUpstream(body.BaseURL); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g.JSON(http.StatusOK, gin.H{"ok": true})
}

// deliverOnce 手动触发一次投递（等价 Python 测试里直接 await deliver_pending_once()）。
func deliverOnce(g *gin.Context) {
	delivered, err := webhook.DeliverPendingOnce(g.Request.Context())
	if err != nil {
		g.JSON(http.StatusInternalServerError, gin.H{"delivered": false, "error": err.Error()})
		return
	}
	g.JSON(http.StatusOK, gin.H{"delivered": delivered})
}

// setWebhookSettings 测试钩子：运行时覆盖一个平台的 Webhook 环境变量（仅 APP_TEST_HOOKS=1 可调用）。
func setWebhookSettings(g *gin.Context) {
	var body struct {
		Platform         string   `json:"platform"`
		Enabled          bool     `json:"enabled"`
		WebhookURL       string   `json:"webhook_url"`
		Secret           string   `json:"secret"`
		SubscribedEvents []string `json:"subscribed_events"`
	}
	if err := json.NewDecoder(g.Request.Body).Decode(&body); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := webhook.SetTestConfig(body.Platform, body.Enabled, body.WebhookURL, body.Secret, body.SubscribedEvents); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g.JSON(http.StatusOK, gin.H{"ok": true})
}
