package userscriptauth

import (
	"testing"
	"time"
)

func TestSessionConfirmAndTakeOnce(t *testing.T) {
	ResetForTest()
	id, expires := Create("http://43.154.152.157:8080")
	if _, ok := CanonicalID(id); !ok {
		t.Fatalf("session id is not a uuid: %s", id)
	}
	if !expires.After(time.Now()) {
		t.Fatalf("expires at %v", expires)
	}
	session, status := Poll(id)
	if status != StatusPending || session == nil {
		t.Fatalf("pending poll = %v %v", session, status)
	}
	if session.Origin != "http://43.154.152.157:8080" {
		t.Fatalf("origin = %q", session.Origin)
	}

	if err := Confirm(id, 7); err != nil {
		t.Fatal(err)
	}
	// 同一账号重复确认是幂等的（用户可能点了两次授权）。
	if err := Confirm(id, 7); err != nil {
		t.Fatal(err)
	}
	// 不同账号确认同一会话：拒绝，避免两个账号的登录态混进同一次交接。
	if err := Confirm(id, 8); err == nil {
		t.Fatal("different user should conflict")
	}

	taken, status := Take(id)
	if status != StatusConfirmed || taken == nil || taken.UserID == nil || *taken.UserID != 7 {
		t.Fatalf("take = %+v %v", taken, status)
	}
	// 登录凭据只能取一次：脚本重复轮询会拿到 expired，不会二次签发令牌。
	if _, status := Take(id); status != StatusExpired {
		t.Fatalf("second take = %v", status)
	}
}

func TestSessionPollDoesNotConsume(t *testing.T) {
	ResetForTest()
	id, _ := Create("")
	if err := Confirm(id, 3); err != nil {
		t.Fatal(err)
	}
	// Poll 是只读的：确认后多次查看状态都不该消费会话。
	for i := 0; i < 3; i++ {
		session, status := Poll(id)
		if status != StatusConfirmed || session == nil || session.UserID == nil || *session.UserID != 3 {
			t.Fatalf("poll #%d = %+v %v", i, session, status)
		}
	}
}

func TestSessionExpires(t *testing.T) {
	ResetForTest()
	now := time.Now()
	nowFunc = func() time.Time { return now }
	id, _ := Create("")
	now = now.Add(SessionTTL + time.Second)
	if session, status := Poll(id); status != StatusExpired || session != nil {
		t.Fatalf("expired poll = %v %v", session, status)
	}
	// 过期后既不能确认也不能取走。
	if err := Confirm(id, 1); err == nil {
		t.Fatal("confirm on expired session should fail")
	}
	if _, status := Take(id); status != StatusExpired {
		t.Fatalf("take on expired = %v", status)
	}
}

func TestUnknownSession(t *testing.T) {
	ResetForTest()
	if _, status := Poll("0198f3a7-2c00-7000-8000-0000000000ff"); status != StatusExpired {
		t.Fatalf("poll unknown = %v", status)
	}
	if err := Confirm("not-a-uuid", 1); err == nil {
		t.Fatal("confirm with malformed id should fail")
	}
	if _, status := Take("not-a-uuid"); status != StatusExpired {
		t.Fatalf("take malformed = %v", status)
	}
}

func TestNormalizeOrigin(t *testing.T) {
	cases := map[string]string{
		"http://43.154.152.157:8080":              "http://43.154.152.157:8080",
		"https://quick-hejia.qcloud.19890605.xyz": "https://quick-hejia.qcloud.19890605.xyz",
		"  https://example.com  ":                 "https://example.com",
		"https://example.com/":                    "https://example.com",
		// 带路径 / 查询 / 非 http(s) 一律丢弃：origin 只用于展示，不接受任何可执行串。
		"https://example.com/evil": "",
		"https://example.com?a=1":  "",
		"https://example.com#frag": "",
		"javascript:alert(1)":      "",
		"file:///etc/passwd":       "",
		"":                         "",
		"null":                     "",
	}
	for raw, want := range cases {
		if got := NormalizeOrigin(raw); got != want {
			t.Errorf("NormalizeOrigin(%q) = %q, want %q", raw, got, want)
		}
	}
}
