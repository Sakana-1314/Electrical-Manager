// Package share 是链接分享接口（对应 api/v1/share.py）。
//
// 路由不挂项目依赖：匿名读取端点按分享行自身记录的项目读取数据；其余端点按 X-Project-Id 请求头
// 落定的项目上下文工作（缺头时项目域语句 fail-closed 报 PROJECT_REQUIRED）。
package share

import (
	"os"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/share"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由。
func Register(r *web.Router) {
	g := r.Group("/shares")
	g.GET("", listShares, auth.CurrentUser)
	g.POST("", createShare, auth.CurrentUser)
	g.GET("/{token}", getShare)
	g.PATCH("/{token}", updateShare, auth.CurrentUser)
	g.DELETE("/{token}", revokeShare, auth.CurrentUser)
	registerTestHooks(r)
}

// listShares 管理端「分享链接」列表：普通用户只看自己创建的，超管看全部。
func listShares(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListShares(c.DB, auth.User(c), page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

// createShare 创建匿名分享链接：把勾选的申购计划 / 申购记录分享为无鉴权页面。
func createShare(c *web.Ctx) error {
	p := c.Params()
	var data schema.ShareCreateRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	l, err := svc.CreateShare(c.DB, data.ShareType, data.ItemIDs, data.ExpiresIn, auth.User(c).ID, data.Columns)
	if err != nil {
		return err
	}
	return c.Created(svc.Read(l))
}

// getShare 匿名读取是刻意设计：分享页无需登录，安全性依赖 token 为 UUIDv7（不可猜解）。
func getShare(c *web.Ctx) error {
	p := c.Params()
	token := p.PathStr("token", "pattern=uuid7")
	if err := p.Err(); err != nil {
		return err
	}
	view, err := svc.GetPublicShare(c.DB, token)
	if err != nil {
		return err
	}
	return c.OK(view)
}

// updateShare 更新分享链接：展示列与到期时间；仅创建者本人或超级管理员可执行。
func updateShare(c *web.Ctx) error {
	p := c.Params()
	token := p.PathStr("token", "pattern=uuid7")
	var data schema.ShareUpdateRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	l, err := svc.UpdateShare(c.DB, token, auth.User(c), data.Columns, data.ExpiresIn)
	if err != nil {
		return err
	}
	return c.OK(svc.Read(l))
}

// revokeShare 撤回分享：仅创建者本人或超级管理员可执行，撤回后匿名读取立即失效。
func revokeShare(c *web.Ctx) error {
	p := c.Params()
	token := p.PathStr("token", "pattern=uuid7")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.RevokeShare(c.DB, token, auth.User(c)); err != nil {
		return err
	}
	return c.NoContent()
}

// 仅 APP_TEST_HOOKS=1 时注册：POST /__test__/share/cleanup-expired → {"count": n}
func registerTestHooks(r *web.Router) {
	if os.Getenv("APP_TEST_HOOKS") != "1" {
		return
	}
	g := r.Group("/__test__/share")
	g.POST("/cleanup-expired", func(c *web.Ctx) error {
		n, err := svc.CleanupExpired(c.Std())
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
}
