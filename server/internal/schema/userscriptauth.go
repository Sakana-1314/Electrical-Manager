package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// ---------------- 油猴脚本网页弹窗授权 ----------------
//
// 三个端点构成一次交接：脚本创建会话 → 网页确认 → 脚本取走登录凭据。
// 会话只在服务端内存存在、5 分钟过期、登录凭据只能取一次。

// UserScriptAuthSessionCreate 脚本创建授权会话；origin 是脚本所在平台的 origin（只做展示）。
type UserScriptAuthSessionCreate struct {
	Origin string `json:"origin" v:"max=255"`
}

// UserScriptAuthSessionCreateRead 新建授权会话的响应。
type UserScriptAuthSessionCreateRead struct {
	SessionID string        `json:"session_id"`
	ExpiresAt jtype.UTCTime `json:"expires_at"`
}

// UserScriptAuthSessionConfirm 网页确认授权（需登录）：只登记「是哪个用户」，不上传令牌。
type UserScriptAuthSessionConfirm struct {
	SessionID string `json:"session_id" v:"required,min=32,max=36"`
}

// UserScriptAuthSessionConfirmRead 网页确认结果。
type UserScriptAuthSessionConfirmRead struct {
	Status string `json:"status"`
}

// UserScriptAuthSessionPollRead 脚本轮询结果：pending / confirmed / expired；
// 只有 confirmed 带登录凭据，取到后会话立即失效。
type UserScriptAuthSessionPollRead struct {
	Status       string    `json:"status"`
	AccessToken  *string   `json:"access_token"`
	RefreshToken *string   `json:"refresh_token"`
	TokenType    string    `json:"token_type"`
	User         *UserRead `json:"user"`
}
