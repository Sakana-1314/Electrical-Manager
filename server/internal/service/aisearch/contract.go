// Package aisearch 对应原 services/ai_search_service.py 的搜索词扩展部分。
//
// 模型服务（端点 / API Key / 模型 / 启用）只从服务端环境变量读取，管理端不再保存配置；
// 未配置或调用失败时，非严格模式原样返回搜索词，严格模式返回 AI_NOT_CONFIGURED / 上游错误。
package aisearch

import (
	"errors"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
)

// ExpandSearchValue 对应 expand_search_value(session, value, strict=strict)：
// 未配置 / 失败时（非 strict）原样返回 value；成功返回 "原词|同义词|…"。
func ExpandSearchValue(s *db.Session, value *string, strict bool) (*string, error) {
	return ExpandSearchValueTimeout(s, value, strict, responseTimeout)
}

// ExpandSearchValueTimeout 同 ExpandSearchValue，可指定等待上游响应的超时（response_timeout_seconds）。
func ExpandSearchValueTimeout(s *db.Session, value *string, strict bool, timeout time.Duration) (*string, error) {
	terms := searchTerms(value)
	if len(terms) == 0 {
		return value, nil
	}
	setting := currentConfig()
	if !setting.Enabled || setting.APIKey == "" || setting.Endpoint == "" || setting.Model == "" {
		if strict {
			return nil, apperr.New("AI_NOT_CONFIGURED", "AI 搜索服务未启用或配置不完整").WithStatus(503)
		}
		return value, nil
	}
	expanded, err := requestExpansions(setting, terms, timeout, true)
	if err != nil {
		var ae *apperr.Error
		if errors.As(err, &ae) && !strict {
			logWarn("AI search expansion failed; using original terms", err)
			return value, nil
		}
		return nil, err
	}
	out := joinTerms(expanded)
	return &out, nil
}
