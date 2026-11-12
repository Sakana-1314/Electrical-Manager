package qrlogin

import (
	"testing"
	"time"
)

func TestSessionConfirmAndTakeOnce(t *testing.T) {
	ResetForTest()
	id, expires := Create()
	if _, ok := CanonicalID(id); !ok {
		t.Fatalf("session id is not a uuid: %s", id)
	}
	if !expires.After(time.Now()) {
		t.Fatalf("expires at %v", expires)
	}
	if session, status := Poll(id); status != StatusPending || session == nil {
		t.Fatalf("pending poll = %v %v", session, status)
	}

	if err := Confirm(id, 7); err != nil {
		t.Fatal(err)
	}
	// 同一账号重复确认是幂等的。
	if err := Confirm(id, 7); err != nil {
		t.Fatal(err)
	}
	if err := Confirm(id, 8); err == nil {
		t.Fatal("different user should conflict")
	}

	session, status := Take(id)
	if status != StatusConfirmed || session == nil || session.UserID == nil || *session.UserID != 7 {
		t.Fatalf("take = %+v %v", session, status)
	}
	// 拿到登录结果后会话立即删除，第二次轮询只能得到过期。
	if _, status := Take(id); status != StatusExpired {
		t.Fatalf("second take = %v", status)
	}
}

func TestSessionExpires(t *testing.T) {
	ResetForTest()
	now := time.Now()
	nowFunc = func() time.Time { return now }
	id, _ := Create()
	now = now.Add(SessionTTL + time.Second)
	if session, status := Poll(id); status != StatusExpired || session != nil {
		t.Fatalf("expired poll = %v %v", session, status)
	}
	if err := Confirm(id, 1); err == nil {
		t.Fatal("expired session should not confirm")
	}
}

func TestCanonicalIDAcceptsCompactUUID(t *testing.T) {
	compact := "0198f3a72c0070008000000000000001"
	id, ok := CanonicalID(compact)
	if !ok {
		t.Fatal("compact uuid should parse")
	}
	if id != "0198f3a7-2c00-7000-8000-000000000001" {
		t.Fatalf("canonical = %s", id)
	}
	if Scene(id) != compact {
		t.Fatalf("scene = %s", Scene(id))
	}
}

func TestCodeCache(t *testing.T) {
	ResetForTest()
	id, _ := Create()
	if _, ok := Code(id); ok {
		t.Fatal("no code yet")
	}
	if !SetCode(id, []byte("png")) {
		t.Fatal("set code")
	}
	if code, ok := Code(id); !ok || string(code) != "png" {
		t.Fatalf("code = %q %v", code, ok)
	}
}
