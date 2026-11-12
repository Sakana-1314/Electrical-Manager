package system

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/appsettings"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/miniprogram"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/qrlogin"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// createQrSession 创建扫码登录会话（匿名）：返回 session id 与过期时间，二维码图片另行拉取。
func createQrSession(c *web.Ctx) error {
	id, expires := qrlogin.Create()
	return c.Created(schema.QrLoginSessionRead{SessionID: id, ExpiresAt: jtype.NewUTC(expires)})
}

// pollQrSession 网页轮询：pending 只返回状态；confirmed 返回一次性登录凭据并消费会话。
func pollQrSession(c *web.Ctx) error {
	p := c.Params()
	raw := p.PathStr("session_id", "min=32,max=36")
	if err := p.Err(); err != nil {
		return err
	}
	session, status := qrlogin.Take(raw)
	switch status {
	case qrlogin.StatusExpired:
		return c.OK(schema.QrLoginPollRead{Status: string(qrlogin.StatusExpired)})
	case qrlogin.StatusPending:
		return c.OK(schema.QrLoginPollRead{Status: string(qrlogin.StatusPending)})
	}
	if session == nil || session.UserID == nil {
		return c.OK(schema.QrLoginPollRead{Status: string(qrlogin.StatusExpired)})
	}
	u, err := auth.GetUser(c.DB, *session.UserID)
	if err != nil {
		return err
	}
	if u == nil || !u.Enabled {
		return c.OK(schema.QrLoginPollRead{Status: string(qrlogin.StatusExpired)})
	}
	access := security.CreateAccessToken(u.ID)
	refresh := security.CreateRefreshToken(u.ID, u.Version)
	read := schema.NewUserRead(u)
	return c.OK(schema.QrLoginPollRead{
		Status:       string(qrlogin.StatusConfirmed),
		AccessToken:  &access,
		RefreshToken: &refresh,
		TokenType:    "bearer",
		User:         &read,
	})
}

// qrSessionCode 返回扫码登录用的小程序码 PNG（匿名，同一会话缓存生成结果）。
func qrSessionCode(c *web.Ctx) error {
	p := c.Params()
	raw := p.PathStr("session_id", "min=32,max=36")
	if err := p.Err(); err != nil {
		return err
	}
	session, status := qrlogin.Poll(raw)
	if status == qrlogin.StatusExpired || session == nil {
		return apperr.New("QR_SESSION_EXPIRED", "登录二维码已过期，请刷新后重新扫码").WithStatus(400)
	}
	if code, ok := qrlogin.Code(session.ID); ok {
		return qrCodeResponse(c, code)
	}
	env := appsettings.GetMiniProgramCodeEnv()
	appID, err := appsettings.GetMiniProgramCodeAppID()
	if err != nil {
		return err
	}
	code, err := miniprogram.GenerateLoginCode(c.DB.Ctx(), session.ID, env, appID)
	if err != nil {
		return err
	}
	qrlogin.SetCode(session.ID, code)
	return qrCodeResponse(c, code)
}

func qrCodeResponse(c *web.Ctx, code []byte) error {
	return c.Bytes(200, "image/png", code, map[string]string{
		"Cache-Control":       "no-store",
		"Content-Disposition": `inline; filename="qr-login.png"`,
	})
}
