// Package userscriptauth 油猴脚本「网页弹窗授权」的一次性会话存储。
//
// 用途：脚本在外部平台运行，需要本系统的登录态。原实现只靠 `window.opener.postMessage`
// 回传，一旦发起窗口在用户点「授权」前被刷新、关闭或跨域跳转，opener 关系被浏览器切断，
// 登录态就再也送不回去（界面提示「发起窗口已关闭」）。
//
// 本包提供一条不依赖窗口关系的送达通道：
//   - 脚本创建会话（匿名），拿到 session id 并在弹窗地址里带上；
//   - 用户在网页点「授权」，网页用已登录身份确认会话（只写用户 id，不上传令牌）；
//   - 脚本轮询会话，confirmed 时由服务端签发登录令牌，会话随即删除。
//
// 会话只存在进程内存，5 分钟过期、一次性消费，不落数据库、不写审计；进程重启即失效。
package userscriptauth

import (
	"context"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
)

const (
	// SessionTTL 会话有效期：与弹窗登录的等待超时一致，够用户登录并点一次授权。
	SessionTTL = 5 * time.Minute
	// cleanupInterval 过期会话清理间隔。
	cleanupInterval = 30 * time.Second
)

// Status 授权会话状态。
type Status string

const (
	StatusPending   Status = "pending"
	StatusConfirmed Status = "confirmed"
	StatusExpired   Status = "expired"
)

// Session 是一次授权会话（对外只返回副本，内部字段不外泄）。
type Session struct {
	ID string
	// Origin 脚本侧平台的 origin，仅用于授权页展示「谁在请求授权」。
	Origin string
	Status Status
	// UserID 用户在网页确认后写入；脚本取走令牌后会话被删除。
	UserID    *int64
	ExpiresAt time.Time
}

type store struct {
	mu       sync.Mutex
	sessions map[string]*Session
}

var (
	defaultStore = &store{sessions: map[string]*Session{}}
	nowFunc      = time.Now
)

// CanonicalID 把带连字符或 32 位紧凑 UUID 统一成带连字符的小写形式。
func CanonicalID(raw string) (string, bool) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return "", false
	}
	return id.String(), true
}

func (s *store) create(origin string, ttl time.Duration) (string, time.Time) {
	id := security.UUID4()
	expires := nowFunc().Add(ttl)
	s.mu.Lock()
	defer s.mu.Unlock()
	// 顺手清理过期项，避免长时间运行只增不减。
	for key, session := range s.sessions {
		if !session.ExpiresAt.After(nowFunc()) {
			delete(s.sessions, key)
		}
	}
	s.sessions[id] = &Session{
		ID:        id,
		Origin:    origin,
		Status:    StatusPending,
		ExpiresAt: expires,
	}
	return id, expires
}

// Create 新建一个待授权的会话；origin 只做展示与格式校验，不参与鉴权。
func Create(origin string) (string, time.Time) {
	return defaultStore.create(origin, SessionTTL)
}

func (s *store) poll(id string) (*Session, Status) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, StatusExpired
	}
	if !session.ExpiresAt.After(nowFunc()) {
		delete(s.sessions, id)
		return nil, StatusExpired
	}
	return copySession(session), session.Status
}

// Poll 读取会话状态（不消费）。
func Poll(rawID string) (*Session, Status) {
	id, ok := CanonicalID(rawID)
	if !ok {
		return nil, StatusExpired
	}
	return defaultStore.poll(id)
}

func (s *store) confirm(id string, userID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok || !session.ExpiresAt.After(nowFunc()) {
		delete(s.sessions, id)
		return sessionExpired()
	}
	// 同一会话被不同账号确认：前一次授权作废，避免两个账号的登录态混进同一次交接。
	if session.Status == StatusConfirmed {
		if session.UserID != nil && *session.UserID == userID {
			return nil
		}
		return apperr.New("USER_SCRIPT_SESSION_CONFLICT", "该授权窗口已被其他账号确认，请重新打开授权窗口").WithStatus(409)
	}
	session.Status = StatusConfirmed
	session.UserID = &userID
	return nil
}

// Confirm 网页侧确认授权：把当前登录用户写进会话。
func Confirm(rawID string, userID int64) error {
	id, ok := CanonicalID(rawID)
	if !ok {
		return sessionExpired()
	}
	return defaultStore.confirm(id, userID)
}

func (s *store) take(id string) (*Session, Status) {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok {
		return nil, StatusExpired
	}
	if !session.ExpiresAt.After(nowFunc()) {
		delete(s.sessions, id)
		return nil, StatusExpired
	}
	if session.Status != StatusConfirmed {
		return copySession(session), session.Status
	}
	// 登录态只能取走一次：取走即删除，脚本重复轮询会拿到 expired。
	out := copySession(session)
	delete(s.sessions, id)
	return out, StatusConfirmed
}

// Take 脚本侧轮询并消费：pending 原样返回，confirmed 返回后会话被删除。
func Take(rawID string) (*Session, Status) {
	id, ok := CanonicalID(rawID)
	if !ok {
		return nil, StatusExpired
	}
	return defaultStore.take(id)
}

func copySession(session *Session) *Session {
	out := *session
	if session.UserID != nil {
		uid := *session.UserID
		out.UserID = &uid
	}
	return &out
}

func sessionExpired() error {
	return apperr.New("USER_SCRIPT_SESSION_EXPIRED", "授权会话已过期或已被使用，请回到脚本重新打开授权窗口").WithStatus(400)
}

// NormalizeOrigin 把 origin 规范成 `协议//域名[:端口]`；带路径 / 查询 / 非 http(s) 一律视为空。
// 空字符串表示脚本未声明来源（旧版脚本），只影响授权页的展示，不参与任何鉴权判断。
func NormalizeOrigin(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" || value == "null" {
		return ""
	}
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return ""
	}
	// 只接受纯 origin：带路径、查询或 hash 的值一律丢弃。
	if u.Path != "" && u.Path != "/" {
		return ""
	}
	if u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

func cleanup() {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	now := nowFunc()
	for key, session := range defaultStore.sessions {
		if !session.ExpiresAt.After(now) {
			delete(defaultStore.sessions, key)
		}
	}
}

// ResetForTest 清空内存会话与时钟（仅供单测使用）。
func ResetForTest() {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	defaultStore.sessions = map[string]*Session{}
	nowFunc = time.Now
}

func init() {
	lifecycle.Worker("userscript-auth-session-cleanup", nil, func(ctx context.Context) {
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
