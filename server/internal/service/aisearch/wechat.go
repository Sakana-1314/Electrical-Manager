package aisearch

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

// 对应原 core/wechat.py（本包私有实现；小程序模块另行实现自己的副本）。

func splitConfigured(raw string) []string {
	var out []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

// configuredWechatAppIDs 去重保序的已配置 AppID 列表。
func configuredWechatAppIDs() []string {
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

// getWechatCredentials 对应 get_wechat_credentials(app_id)：appID 为空取第一个。
func getWechatCredentials(appID string) (string, string, error) {
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
