// Package aisearch 是 AI 搜索接口（对应原 api/v1/ai_search.py）。
package aisearch

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("/ai-search")
	g.POST("/expand", expand, auth.CurrentUser)
	g.GET("/status", status, auth.CurrentUser)
	g.GET("/settings", getSettings, auth.SuperAdmin)
	g.PUT("/settings", updateSettings, auth.SuperAdmin)
	g.POST("/settings/test", testSettings, auth.SuperAdmin)

	if os.Getenv("APP_TEST_HOOKS") == "1" {
		// 测试钩子：把 AI 上游改投到本地桩服务（路径相对 /api/v1 回到根：/__test__/ai-search/upstream）。
		r.Raw().POST("/../../__test__/ai-search/upstream", setTestUpstream)
	}
}

func expand(c *web.Ctx) error {
	p := c.Params()
	var data schema.AiSearchExpandRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	expanded, err := svc.ExpandSearchValue(c.DB, &data.Value, true)
	if err != nil {
		return err
	}
	out := data.Value
	if expanded != nil && *expanded != "" {
		out = *expanded
	}
	return c.OK(schema.AiSearchExpandRead{Original: data.Value, Expanded: out})
}

func status(c *web.Ctx) error {
	ok, err := svc.IsAvailable(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.AiSearchStatusRead{Available: ok})
}

func getSettings(c *web.Ctx) error {
	setting, err := svc.GetSetting(c.DB)
	if err != nil {
		return err
	}
	read, err := svc.SettingRead(setting)
	if err != nil {
		return err
	}
	return c.OK(read)
}

func updateSettings(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewAiSearchSettingsUpdate()
	p.Body(&data)
	if p.Err() == nil && data.MissingModelConfig() {
		var input any
		if raw, err := c.RawBody(); err == nil {
			_ = json.Unmarshal(raw, &input)
		}
		p.Add(web.ValueError([]any{"body"}, schema.EnabledConfigError, input))
	}
	if err := p.Err(); err != nil {
		return err
	}
	setting, err := svc.UpdateSetting(c.DB, data)
	if err != nil {
		return err
	}
	read, err := svc.SettingRead(setting)
	if err != nil {
		return err
	}
	return c.OK(read)
}

func testSettings(c *web.Ctx) error {
	p := c.Params()
	var data schema.AiSearchTestRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	const original = "电机"
	expanded, err := svc.TestSearchValue(data, original)
	if err != nil {
		return err
	}
	if expanded == "" {
		expanded = original
	}
	return c.OK(schema.AiSearchTestRead{Original: original, Expanded: expanded})
}

// setTestUpstream 请求体：{"base_url": "http://127.0.0.1:port" | "", "response_timeout_seconds": 0.3}
func setTestUpstream(g *gin.Context) {
	var body struct {
		BaseURL                string  `json:"base_url"`
		ResponseTimeoutSeconds float64 `json:"response_timeout_seconds"`
	}
	if err := json.NewDecoder(g.Request.Body).Decode(&body); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	timeout := time.Duration(body.ResponseTimeoutSeconds * float64(time.Second))
	if err := svc.SetTestUpstream(body.BaseURL, timeout); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g.JSON(http.StatusOK, gin.H{"ok": true})
}
