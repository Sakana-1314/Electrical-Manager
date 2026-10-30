// Package aisearch 对应原 services/ai_search_service.py（系统设置 + AI 搜索扩展）。
//
// 本文件是供其他模块先行编译的契约桩：负责 aisearch 的代理需用真实实现替换函数体，**保持签名不变**。
package aisearch

import "github.com/Sakana-1314/Electrical-Manager/server/internal/db"

// IsLiteSecondaryWarehouse 二级库是否处于精简模式。
func IsLiteSecondaryWarehouse(s *db.Session) (bool, error) { return false, nil }

// ExpandSearchValue 对应 expand_search_value(session, value, strict=strict)：
// 未配置 / 失败时（非 strict）原样返回 value。
func ExpandSearchValue(s *db.Session, value *string, strict bool) (*string, error) { return value, nil }
