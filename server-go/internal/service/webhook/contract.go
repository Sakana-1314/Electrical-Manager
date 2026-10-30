// Package webhook 对应原 services/webhook_service.py。
//
// 本文件是供其他模块先行编译的契约桩：负责 webhook 的代理需用真实实现替换函数体，**保持签名不变**。
package webhook

import "github.com/Sakana-1314/Electrical-Manager/server/internal/db"

// EnqueueEvent 对应 enqueue_event(session, event_type, data)：eventType 为事件值（如 "stock.outbound.created"）。
func EnqueueEvent(s *db.Session, eventType string, data map[string]any) error { return nil }
