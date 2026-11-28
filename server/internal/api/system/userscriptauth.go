package system

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/userscriptauth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// createUserScriptAuthSession 脚本侧创建授权会话（匿名）：返回 session id 与过期时间。
func createUserScriptAuthSession(c *web.Ctx) error {
	p := c.Params()
	var data schema.UserScriptAuthSessionCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	id, expires := userscriptauth.Create(userscriptauth.NormalizeOrigin(data.Origin))
	return c.Created(schema.UserScriptAuthSessionCreateRead{
		SessionID: id,
		ExpiresAt: jtype.NewUTC(expires),
	})
}

// confirmUserScriptAuthSession 网页侧确认授权（需登录）：把当前用户写进会话。
//
// 网页只上报会话 id，**不上传登录令牌**——令牌由脚本轮询时由服务端签发，
// 这样授权页既不需要窗口引用（opener 可能已被浏览器切断），也不会把令牌暴露在网页 JS 里。
func confirmUserScriptAuthSession(c *web.Ctx) error {
	p := c.Params()
	var data schema.UserScriptAuthSessionConfirm
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	if err := userscriptauth.Confirm(data.SessionID, auth.User(c).ID); err != nil {
		return err
	}
	return c.OK(schema.UserScriptAuthSessionConfirmRead{Status: string(userscriptauth.StatusConfirmed)})
}

// pollUserScriptAuthSession 脚本侧轮询：pending 只返回状态；confirmed 签发登录凭据并消费会话。
func pollUserScriptAuthSession(c *web.Ctx) error {
	p := c.Params()
	raw := p.PathStr("session_id", "min=32,max=36")
	if err := p.Err(); err != nil {
		return err
	}
	session, status := userscriptauth.Take(raw)
	switch status {
	case userscriptauth.StatusExpired:
		return c.OK(schema.UserScriptAuthSessionPollRead{Status: string(userscriptauth.StatusExpired)})
	case userscriptauth.StatusPending:
		return c.OK(schema.UserScriptAuthSessionPollRead{Status: string(userscriptauth.StatusPending)})
	}
	if session == nil || session.UserID == nil {
		return c.OK(schema.UserScriptAuthSessionPollRead{Status: string(userscriptauth.StatusExpired)})
	}
	u, err := auth.GetUser(c.DB, *session.UserID)
	if err != nil {
		return err
	}
	if u == nil {
		return c.OK(schema.UserScriptAuthSessionPollRead{Status: string(userscriptauth.StatusExpired)})
	}
	access := security.CreateAccessToken(u.ID)
	refresh := security.CreateRefreshToken(u.ID, u.Version)
	read := schema.NewUserRead(u)
	return c.OK(schema.UserScriptAuthSessionPollRead{
		Status:       string(userscriptauth.StatusConfirmed),
		AccessToken:  &access,
		RefreshToken: &refresh,
		TokenType:    "bearer",
		User:         &read,
	})
}
