package system

// 小程序「进入网页版」：一次性登录票据的签发与兑换（兼容链路）。
//
// 新链路：小程序把本地 `mini_program` JWT 直接带到网页 `/web-open?token=…`；
// 管理端鉴权接受同一套签名的令牌，网页调 `/auth/me` 补齐用户即可，无需换票。
// 这里保留票据接口，供未升级的小程序或未配置 APP_WEB_BASE_URL 的部署回退：
// 小程序用登录令牌换一张票据（2 分钟、一次性），网页带票据兑换 access + refresh 令牌。
// 票据只存在进程内存（service/webopen），网页侧兑换后立刻失效。

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webopen"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// webOpenBaseURL 网页端地址：优先 APP_WEB_BASE_URL，其次 APP_CORS_ORIGINS 的第一条，最后用请求 Host。
func webOpenBaseURL(c *web.Ctx) string {
	if v := strings.TrimSpace(config.S.WebBaseURL); v != "" {
		return strings.TrimRight(v, "/")
	}
	for _, origin := range config.S.CORSOrigins {
		if origin = strings.TrimSpace(origin); origin != "" && origin != "*" {
			return strings.TrimRight(origin, "/")
		}
	}
	scheme := "http"
	if c.Request.TLS != nil || strings.EqualFold(c.Request.Header.Get("X-Forwarded-Proto"), "https") {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host
}

// invalidWebOpenTicket 票据无效 / 过期 / 已被使用。
func invalidWebOpenTicket() error {
	return apperr.New("INVALID_WEB_OPEN_TICKET", "网页登录票据无效或已过期，请回到小程序重试").WithStatus(401)
}

// webOpenPath 只接受站内相对路径（`/warehouse/stock`），其它一律回落到工作台。
func webOpenPath(raw string) string {
	path := strings.TrimSpace(raw)
	if path == "" || !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.HasPrefix(path, "/web-open") {
		return "/"
	}
	return path
}

// createWebOpenTicket 小程序换票据：登录用户，项目取请求上下文（缺头用默认项目）。
func createWebOpenTicket(c *web.Ctx) error {
	p := c.Params()
	var data schema.WebOpenTicketCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u := auth.User(c)
	pid, err := c.DB.ProjectID()
	if err != nil {
		return err
	}
	path := webOpenPath(data.Path)
	ticket, expires := webopen.Create(u.ID, pid, path)
	url := webOpenBaseURL(c) + "/web-open?ticket=" + ticket + "&path=" + path
	return c.Created(schema.WebOpenTicketRead{
		Ticket:    ticket,
		ExpiresAt: jtype.NewUTC(expires),
		URL:       url,
	})
}

// redeemWebOpenTicket 网页兑换票据（匿名）：一次性消费，返回登录令牌与落地路由。
func redeemWebOpenTicket(c *web.Ctx) error {
	p := c.Params()
	var data schema.WebOpenTicketRedeemRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	ticket, ok := webopen.Take(data.Ticket)
	if !ok {
		return invalidWebOpenTicket()
	}
	u, err := auth.GetUser(c.DB, ticket.UserID)
	if err != nil {
		return err
	}
	if u == nil {
		return invalidWebOpenTicket()
	}
	if err := auth.MarkLastUsed(c.DB, u); err != nil {
		return err
	}
	return c.OK(schema.WebOpenTicketRedeemRead{
		AccessToken:  security.CreateAccessToken(u.ID),
		RefreshToken: security.CreateRefreshToken(u.ID, u.Version),
		TokenType:    "bearer",
		User:         schema.NewUserRead(u),
		ProjectID:    ticket.ProjectID,
		Path:         webOpenPath(ticket.Path),
	})
}
