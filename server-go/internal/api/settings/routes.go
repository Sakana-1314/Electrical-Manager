// Package settings 是系统设置接口（对应原 api/v1/system_settings.py）。
package settings

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const platformOneOf = "oneof=FEISHU|DINGTALK"

func Register(r *web.Router) {
	g := r.Group("/system-settings")
	// 公开配置端点：同时服务管理端与小程序（两种鉴权体系不同），故保持匿名。
	g.GET("/image-acceleration", imageAccelerationSettings)
	g.GET("/mini-program-features", miniProgramFeatures)
	g.GET("/webhooks", webhookChannels, auth.SuperAdmin)
	g.PUT("/webhooks/{platform}", updateWebhookChannel, auth.SuperAdmin)
	g.POST("/webhooks/{platform}/test", testWebhookChannel, auth.SuperAdmin)

	if webhook.TestHooksEnabled() {
		// 测试钩子（路径相对 /api/v1 回到根）：/__test__/webhook/upstream、/__test__/webhook/deliver-once。
		r.Raw().POST("/../../__test__/webhook/upstream", setWebhookUpstream)
		r.Raw().POST("/../../__test__/webhook/deliver-once", deliverOnce)
	}
}

func imageAccelerationSettings(c *web.Ctx) error {
	serverURL, err := aisearch.GetImageAccelerationServerURL(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.ImageAccelerationSettingsRead{ImageAccelerationServerURL: serverURL})
}

func miniProgramFeatures(c *web.Ctx) error {
	features, err := aisearch.GetMiniProgramFeatures(c.DB)
	if err != nil {
		return err
	}
	return c.OK(features)
}

func webhookChannels(c *web.Ctx) error {
	items, err := webhook.ListChannels(c.DB)
	if err != nil {
		return err
	}
	return c.OK(items)
}

func updateWebhookChannel(c *web.Ctx) error {
	p := c.Params()
	platform := p.PathStr("platform", platformOneOf)
	data := schema.WebhookChannelUpdate{SubscribedEvents: []string{}}
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	ch, err := webhook.UpdateChannel(c.DB, platform, data)
	if err != nil {
		return err
	}
	read, err := webhook.ChannelRead(ch, platform)
	if err != nil {
		return err
	}
	return c.OK(read)
}

func testWebhookChannel(c *web.Ctx) error {
	p := c.Params()
	platform := p.PathStr("platform", platformOneOf)
	var data schema.WebhookTestRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	if err := webhook.TestChannel(platform, data); err != nil {
		return err
	}
	return c.OK(schema.WebhookTestRead{Platform: platform, Success: true, Message: "测试消息已发送"})
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
