package miniprogram

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/qrlogin"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// confirmQrLogin 小程序端确认网页扫码登录：把当前小程序用户绑定到会话，网页轮询即可取走登录态。
func confirmQrLogin(c *web.Ctx) error {
	p := c.Params()
	var data schema.QrLoginConfirmRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	if err := qrlogin.Confirm(data.SessionID, c.UserID); err != nil {
		return err
	}
	// 扫码登录同样是一次登录：刷新最近登录时间（与密码登录 / 小程序登录同一实现）。
	if u := auth.User(c); u != nil {
		if err := auth.MarkLastUsed(c.DB, u); err != nil {
			return err
		}
	}
	return c.OK(schema.QrLoginConfirmRead{Status: string(qrlogin.StatusConfirmed)})
}
