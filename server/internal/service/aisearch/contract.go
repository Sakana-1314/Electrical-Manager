// Package aisearch 对应原 services/ai_search_service.py（系统设置 + AI 搜索扩展）。
//
// 高级设置（AI 模型、小程序开关、图片加速、后台主 tab 可见性等）以一行 JSON 存在 system_setting
// （setting_key = ai_search_config）；旧部署 system_setting 为空时回退读取最后一条配置事件。
package aisearch

import (
	"errors"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
)

// IsLiteSecondaryWarehouse 二级库是否处于精简模式（独立表 + 只读 + Excel 导入）。
func IsLiteSecondaryWarehouse(s *db.Session) (bool, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return false, err
	}
	return setting != nil && setting.SecondaryWarehouseMode == domain.SecondaryWarehouseLite, nil
}

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
	setting, err := GetSetting(s)
	if err != nil {
		return nil, err
	}
	if setting == nil || !setting.Enabled || setting.APIKeyEncrypted == "" {
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

// TestSearchValue 对应 test_search_value(data, value)：用未保存的配置直连测试（不走缓存）。
func TestSearchValue(data schema.AiSearchTestRequest, value string) (string, error) {
	terms := searchTerms(&value)
	setting := defaultConfig()
	setting.Endpoint = data.Endpoint
	setting.APIKeyEncrypted = security.EncryptSecret(data.APIKey)
	setting.Model = data.Model
	setting.Enabled = true
	setting.MiniProgramCodeAppID = ""
	expanded, err := requestExpansions(setting, terms, testResponseTimeout, false)
	if err != nil {
		return "", err
	}
	return joinTerms(expanded), nil
}
