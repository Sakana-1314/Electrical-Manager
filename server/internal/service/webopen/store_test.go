package webopen

import (
	"testing"
	"time"
)

// 票据是一次性的：兑换后立即失效，重复兑换必须失败。
func TestTicketIsSingleUse(t *testing.T) {
	Reset()
	token, expires := Create(7, 3, "/warehouse/stock")
	if token == "" || !expires.After(time.Now()) {
		t.Fatalf("票据非法：%q %v", token, expires)
	}
	ticket, ok := Take(token)
	if !ok || ticket.UserID != 7 || ticket.ProjectID != 3 || ticket.Path != "/warehouse/stock" {
		t.Fatalf("首次兑换应返回票据内容，实际 %#v %v", ticket, ok)
	}
	if _, ok := Take(token); ok {
		t.Fatal("票据兑换后必须失效")
	}
}

// 过期票据不可兑换。
func TestExpiredTicketIsRejected(t *testing.T) {
	Reset()
	base := time.Now()
	SetNow(func() time.Time { return base })
	defer SetNow(time.Now)
	token, _ := Create(1, 1, "/")
	SetNow(func() time.Time { return base.Add(TicketTTL + time.Second) })
	if _, ok := Take(token); ok {
		t.Fatal("过期票据不应可兑换")
	}
}
