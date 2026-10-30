package webhook

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// TestEnqueueEventDB 需要一个按 init.sql 建好的 PostgreSQL 库：
// EM_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/em_go_test go test ./internal/service/webhook/
// 全部写入在同一事务内完成并回滚，不污染库。
func TestEnqueueEventDB(t *testing.T) {
	url := os.Getenv("EM_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("EM_TEST_DATABASE_URL 未设置")
	}
	config.S.DatabaseURL = url
	dsn, err := config.S.PostgresDSN()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Open(dsn); err != nil {
		t.Fatal(err)
	}
	s := db.NewSession(context.Background())
	defer s.Close()
	mustExec := func(q string, args ...any) {
		if _, err := s.Exec(q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	mustExec("TRUNCATE TABLE webhook_delivery, webhook_channel, project RESTART IDENTITY CASCADE")
	mustExec("INSERT INTO project (id, name, enabled, is_default, created_at, updated_at, version) VALUES (1, '默认项目', TRUE, TRUE, NOW(), NOW(), 1), (2, '二期', TRUE, FALSE, NOW(), NOW(), 1)")
	mustExec(`INSERT INTO webhook_channel (platform, enabled, webhook_url_encrypted, secret_encrypted, subscribed_events, created_at, updated_at, version) VALUES
		('FEISHU', TRUE, '', '', '["stock.outbound.created","mini_program.user.bound"]', NOW(), NOW(), 1),
		('DINGTALK', FALSE, '', '', '["stock.outbound.created"]', NOW(), NOW(), 1)`)

	// 请求上下文里有项目：载荷带该项目；无项目上下文：退回默认项目。
	if err := EnqueueEvent(s.WithProject(2), "stock.outbound.created", map[string]any{"receiver_name": "张三"}); err != nil {
		t.Fatal(err)
	}
	if err := EnqueueEvent(s, "mini_program.user.bound", map[string]any{"display_name": "新用户"}); err != nil {
		t.Fatal(err)
	}
	if err := EnqueueEvent(s, "stock.inbound.created", map[string]any{}); err != nil {
		t.Fatal(err)
	}
	var rows []model.WebhookDelivery
	if err := s.Select(&rows, "SELECT "+model.ColsWebhookDelivery+" FROM webhook_delivery ORDER BY id"); err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 {
		t.Fatalf("deliveries = %d, want 2 (仅已启用且订阅的渠道)", len(rows))
	}
	if rows[0].EventType != "STOCK_OUTBOUND_CREATED" || rows[0].Status != "PENDING" || rows[0].Attempts != 0 {
		t.Fatalf("row0: %+v", rows[0])
	}
	var p0, p1 map[string]any
	_ = json.Unmarshal(rows[0].Payload, &p0)
	_ = json.Unmarshal(rows[1].Payload, &p1)
	d0, d1 := p0["data"].(map[string]any), p1["data"].(map[string]any)
	if d0["project_name"] != "二期" || d0["project_id"] != float64(2) || d0["receiver_name"] != "张三" || p0["event_type"] != "stock.outbound.created" {
		t.Fatalf("payload0: %v", p0)
	}
	if d1["project_name"] != "默认项目" || rows[1].EventType != "MINI_PROGRAM_USER_BOUND" {
		t.Fatalf("payload1: %v", p1)
	}
	if occurred, _ := p0["occurred_at"].(string); len(occurred) != 20 || occurred[19] != 'Z' {
		t.Fatalf("occurred_at: %v", p0["occurred_at"])
	}
}
