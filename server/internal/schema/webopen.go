package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// WebOpenTicketCreate 小程序换取「进入网页版」的一次性票据（项目由请求头 X-Project-Id 决定）。
type WebOpenTicketCreate struct {
	// Path 是网页端的落地路由（如 `/warehouse/stock`），可省略；只接受站内相对路径。
	Path string `json:"path" v:"max=255"`
}

// WebOpenTicketRead 一次性票据：小程序用它拼 web-view 地址。
type WebOpenTicketRead struct {
	Ticket    string        `json:"ticket"`
	ExpiresAt jtype.UTCTime `json:"expires_at"`
	// URL 已拼好的完整网页地址（含票据），小程序直接 openEmbeddedMiniProgram / web-view 打开。
	URL string `json:"url"`
}

// WebOpenTicketRedeemRequest 网页用票据换登录令牌（一次性，消费后失效）。
type WebOpenTicketRedeemRequest struct {
	Ticket string `json:"ticket" v:"required,min=32,max=36"`
}

// WebOpenTicketRedeemRead 票据兑换结果：与密码登录同一套登录凭据 + 落地路由与项目。
type WebOpenTicketRedeemRead struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	TokenType    string   `json:"token_type"`
	User         UserRead `json:"user"`
	ProjectID    int64    `json:"project_id"`
	Path         string   `json:"path"`
}
