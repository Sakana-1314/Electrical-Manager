package webopen

// 小程序「进入网页版」的一次性登录交接。
//
// ## 为什么需要它
//
// 小程序的半屏 web-view 不能直接写网页的 localStorage，网页也读不到小程序的 storage。
// 于是改成两段握手：小程序先换一张**一次性票据**（短 TTL、用完即删、绑定 user 与项目），
// 再用票据拼 web 地址；网页带着票据打开时用票据换回真正的登录令牌（access + refresh）
// 并立刻消费掉票据。票据只能换一次，泄露也只能被用一次，且有效期只有 2 分钟。
//
// ## 与扫码登录的区别
//
// `service/qrlogin` 是「网页发起、小程序确认」，这里反过来是「小程序发起、网页领取」；
// 两者都只存在进程内存，重启即失效，不落库、不写审计。

import (
	"context"
	"sync"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
)

// TicketTTL 票据有效期：小程序生成后立刻打开 web-view，2 分钟足够网络抖动。
const TicketTTL = 2 * time.Minute

// cleanupInterval 过期票据清理间隔。
const cleanupInterval = 30 * time.Second

// Ticket 是一张待领取的登录票据（只读副本，内部字段不外泄）。
type Ticket struct {
	Token     string
	UserID    int64
	ProjectID int64
	// Path 是网页端落地路由（站内相对路径），兑换后由前端跳转。
	Path      string
	ExpiresAt time.Time
}

type store struct {
	mu      sync.Mutex
	tickets map[string]Ticket
}

var (
	defaultStore = &store{tickets: map[string]Ticket{}}
	nowFunc      = time.Now
)

func init() {
	lifecycle.Worker("webopen-ticket-cleanup", nil, func(ctx context.Context) {
		ticker := time.NewTicker(cleanupInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				cleanup()
			}
		}
	})
}

// cleanup 删除过期票据，避免长时间运行只增不减。
func cleanup() {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	now := nowFunc()
	for key, ticket := range defaultStore.tickets {
		if !ticket.ExpiresAt.After(now) {
			delete(defaultStore.tickets, key)
		}
	}
}

// Create 为指定用户与项目签发一张一次性票据，返回票据与过期时间。
func Create(userID, projectID int64, path string) (string, time.Time) {
	token := security.UUID4()
	expires := nowFunc().Add(TicketTTL)
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	defaultStore.tickets[token] = Ticket{Token: token, UserID: userID, ProjectID: projectID, Path: path, ExpiresAt: expires}
	return token, expires
}

// Take 消费票据：有效则返回票据并立即删除（一次性）；过期 / 不存在返回 false。
func Take(token string) (Ticket, bool) {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	ticket, ok := defaultStore.tickets[token]
	if !ok {
		return Ticket{}, false
	}
	delete(defaultStore.tickets, token)
	if nowFunc().After(ticket.ExpiresAt) {
		return Ticket{}, false
	}
	return ticket, true
}

// Reset 清空全部票据（仅测试用）。
func Reset() {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	defaultStore.tickets = map[string]Ticket{}
}

// SetNow 替换时钟（仅测试用）。
func SetNow(fn func() time.Time) { nowFunc = fn }
