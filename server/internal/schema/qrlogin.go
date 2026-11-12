package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// ---------------- 网页端小程序扫码登录 ----------------

// QrLoginSessionRead 新建扫码会话的响应（会话只在服务端内存中短暂存在）。
type QrLoginSessionRead struct {
	SessionID string        `json:"session_id"`
	ExpiresAt jtype.UTCTime `json:"expires_at"`
}

// QrLoginPollRead 网页轮询结果：pending / confirmed / expired；仅 confirmed 带登录凭据。
type QrLoginPollRead struct {
	Status       string    `json:"status"`
	AccessToken  *string   `json:"access_token"`
	RefreshToken *string   `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	User         *UserRead `json:"user"`
}

// QrLoginConfirmRequest 小程序确认扫码登录（session_id 兼容带连字符与 32 位紧凑 UUID）。
type QrLoginConfirmRequest struct {
	SessionID string `json:"session_id" v:"required,min=32,max=36"`
}

// QrLoginConfirmRead 小程序确认结果。
type QrLoginConfirmRead struct {
	Status string `json:"status"`
}
