// Package qrlogin 网页端「小程序扫码登录」的临时会话存储。
//
// 会话只存在进程内存：session id 为 UUID，网页创建后展示小程序码；
// 小程序确认时写入用户 id，网页轮询取走一次性登录结果后立即删除。
// 进程重启或过期后会话自然失效，不落数据库、不写审计。
package qrlogin

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
)

const (
	// SessionTTL 二维码有效期：足够用户扫码、打开小程序并确认。
	SessionTTL = 5 * time.Minute
	// cleanupInterval 过期会话清理间隔。
	cleanupInterval = 30 * time.Second
)

// Status 扫码登录会话状态。
type Status string

const (
	StatusPending   Status = "pending"
	StatusConfirmed Status = "confirmed"
	StatusExpired   Status = "expired"
)

// Session 是一次扫码登录会话（只读副本返回给调用方，内部字段不外泄）。
type Session struct {
	ID        string
	Status    Status
	UserID    *int64
	ExpiresAt time.Time
	Code      []byte
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

// Scene 小程序码 scene：去掉连字符的 32 位小写 UUID。
func Scene(id string) string {
	u, err := uuid.Parse(id)
	if err != nil {
		return ""
	}
	return strings.ReplaceAll(u.String(), "-", "")
}

func (s *store) create(ttl time.Duration) (string, time.Time) {
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
	s.sessions[id] = &Session{ID: id, Status: StatusPending, ExpiresAt: expires}
	return id, expires
}

// Create 新建一个待扫码会话。
func Create() (string, time.Time) { return defaultStore.create(SessionTTL) }

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

// Poll 读取会话状态（不消费）。confirmed 时返回用户 id 供轮询方生成令牌。
func Poll(rawID string) (*Session, Status) {
	id, ok := CanonicalID(rawID)
	if !ok {
		return nil, StatusExpired
	}
	return defaultStore.poll(id)
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
	out := copySession(session)
	delete(s.sessions, id)
	return out, StatusConfirmed
}

// Take 轮询并消费：pending 原样返回；confirmed 返回后会话被删除（登录结果只能用一次）。
func Take(rawID string) (*Session, Status) {
	id, ok := CanonicalID(rawID)
	if !ok {
		return nil, StatusExpired
	}
	return defaultStore.take(id)
}

func (s *store) confirm(id string, userID int64) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok || !session.ExpiresAt.After(nowFunc()) {
		delete(s.sessions, id)
		return sessionExpired()
	}
	if session.Status == StatusConfirmed {
		if session.UserID != nil && *session.UserID == userID {
			return nil
		}
		return sessionConflict()
	}
	session.Status = StatusConfirmed
	session.UserID = &userID
	return nil
}

// Confirm 小程序用户确认登录；同一会话被不同账号确认时返回冲突。
func Confirm(rawID string, userID int64) error {
	id, ok := CanonicalID(rawID)
	if !ok {
		return sessionExpired()
	}
	return defaultStore.confirm(id, userID)
}

func (s *store) setCode(id string, code []byte) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	session, ok := s.sessions[id]
	if !ok || !session.ExpiresAt.After(nowFunc()) {
		delete(s.sessions, id)
		return false
	}
	session.Code = append([]byte{}, code...)
	return true
}

// SetCode 缓存小程序码 PNG（同一会话重复请求不再调微信接口）。
func SetCode(rawID string, code []byte) bool {
	id, ok := CanonicalID(rawID)
	if !ok {
		return false
	}
	return defaultStore.setCode(id, code)
}

// Code 读取已缓存的小程序码。
func Code(rawID string) ([]byte, bool) {
	id, ok := CanonicalID(rawID)
	if !ok {
		return nil, false
	}
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	session, ok := defaultStore.sessions[id]
	if !ok || !session.ExpiresAt.After(nowFunc()) {
		return nil, false
	}
	return append([]byte{}, session.Code...), len(session.Code) > 0
}

func copySession(session *Session) *Session {
	out := *session
	if session.UserID != nil {
		uid := *session.UserID
		out.UserID = &uid
	}
	out.Code = append([]byte{}, session.Code...)
	return &out
}

func sessionExpired() error {
	return apperr.New("QR_SESSION_EXPIRED", "登录二维码已过期，请刷新后重新扫码").WithStatus(400)
}

func sessionConflict() error {
	return apperr.New("QR_SESSION_CONFLICT", "该二维码已被其他账号确认，请刷新后重试").WithStatus(409)
}

// ResetForTest 清空内存会话与时钟（仅供单测使用）。
func ResetForTest() {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	defaultStore.sessions = map[string]*Session{}
	nowFunc = time.Now
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

func init() {
	lifecycle.Worker("qr-login-session-cleanup", nil, func(ctx context.Context) {
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
