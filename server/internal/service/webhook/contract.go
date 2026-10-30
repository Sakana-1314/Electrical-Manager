// Package webhook 对应原 services/webhook_service.py：飞书 / 钉钉机器人推送。
//
// 业务事件在请求事务内写入 webhook_delivery（EnqueueEvent），由常驻投递任务异步认领并发送，
// 失败按 1/5/15/60/180 分钟退避重试，最多 5 次。
package webhook

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// EnqueueEvent 对应 enqueue_event(session, event_type, data)：eventType 为事件值（如 "stock.outbound.created"）。
// 为每个已启用且订阅了该事件的渠道写一条待投递记录；载荷 data 会补上事件所属项目（project_id / project_name）。
func EnqueueEvent(s *db.Session, eventType string, data map[string]any) error {
	var channels []model.WebhookChannel
	if err := s.Select(&channels, "SELECT "+model.ColsWebhookChannel+" FROM webhook_channel WHERE enabled IS TRUE"); err != nil {
		return err
	}
	merged := make(map[string]any, len(data)+2)
	for k, v := range data {
		merged[k] = v
	}
	extra, err := projectPayloadFields(s)
	if err != nil {
		return err
	}
	for k, v := range extra {
		merged[k] = v
	}
	eventID := security.UUID4()
	now := common.UTCNow()
	occurredAt := now.Format("2006-01-02T15:04:05") + "Z"
	for _, ch := range channels {
		if !containsString(subscribedEvents(ch.SubscribedEvents), eventType) {
			continue
		}
		payload, err := jtype.ToJSON(eventPayload{EventID: eventID, EventType: eventType, OccurredAt: occurredAt, Data: merged})
		if err != nil {
			return err
		}
		if _, err := s.Exec(
			"INSERT INTO webhook_delivery (event_id, event_type, channel_id, payload, status, attempts, next_retry_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			eventID, domain.WebhookEventType.ToDB(eventType), ch.ID, payload, domain.DeliveryPending, 0, now, now, now,
		); err != nil {
			return err
		}
	}
	return nil
}

type eventPayload struct {
	EventID    string         `json:"event_id"`
	EventType  string         `json:"event_type"`
	OccurredAt string         `json:"occurred_at"`
	Data       map[string]any `json:"data"`
}

// projectPayloadFields 事件载荷里的项目标识：请求上下文里的项目优先；无项目上下文的入口退回默认项目。
func projectPayloadFields(s *db.Session) (map[string]any, error) {
	if pid := s.ProjectIDOrZero(); pid > 0 {
		var name string
		ok, err := s.Find(&name, "SELECT name FROM project WHERE id = ?", pid)
		if err != nil {
			return nil, err
		}
		if ok && name != "" {
			return map[string]any{"project_id": pid, "project_name": name}, nil
		}
	}
	project, err := defaultProject(s)
	if err != nil || project == nil {
		return map[string]any{}, err
	}
	return map[string]any{"project_id": project.ID, "project_name": project.Name}, nil
}

// defaultProject 对应 project_service.default_project：is_default 且启用；否则第一个启用项目。
func defaultProject(s *db.Session) (*model.Project, error) {
	var p model.Project
	ok, err := s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE is_default IS TRUE AND enabled IS TRUE ORDER BY id LIMIT 1")
	if err != nil {
		return nil, err
	}
	if ok {
		return &p, nil
	}
	ok, err = s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE enabled IS TRUE ORDER BY id LIMIT 1")
	if err != nil || !ok {
		return nil, err
	}
	return &p, nil
}

func subscribedEvents(j jtype.JSON) []string {
	var raw []any
	if err := j.Unmarshal(&raw); err != nil {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, v := range raw {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

func containsString(items []string, s string) bool {
	for _, it := range items {
		if it == s {
			return true
		}
	}
	return false
}
