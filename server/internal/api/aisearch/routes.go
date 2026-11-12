// Package aisearch 是 AI 搜索接口（对应原 api/v1/ai_search.py）。
//
// 模型服务由服务端环境变量配置（APP_AI_SEARCH_*），管理端只读取可用状态与使用搜索词扩展。
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

	if os.Getenv("APP_TEST_HOOKS") == "1" {
		// 测试钩子：把 AI 上游改投到本地桩服务（路径相对 /api/v1 回到根：/__test__/ai-search/upstream）。
		r.Raw().POST("/../../__test__/ai-search/upstream", setTestUpstream)
		r.Raw().POST("/../../__test__/ai-search/settings", setTestSettings)
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
	return c.OK(schema.AiSearchStatusRead{Available: svc.IsAvailable()})
}

// setTestSettings 测试钩子：运行时覆盖 AI 环境变量（仅 APP_TEST_HOOKS=1 可调用）。
func setTestSettings(g *gin.Context) {
	var body struct {
		Enabled  bool   `json:"enabled"`
		Endpoint string `json:"endpoint"`
		APIKey   string `json:"api_key"`
		Model    string `json:"model"`
	}
	if err := json.NewDecoder(g.Request.Body).Decode(&body); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := svc.SetTestConfig(body.Enabled, body.Endpoint, body.APIKey, body.Model); err != nil {
		g.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	g.JSON(http.StatusOK, gin.H{"ok": true})
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
