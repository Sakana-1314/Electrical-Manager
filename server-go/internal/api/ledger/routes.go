// Package ledger 是台账管理接口：台账总览（台账记录）与分层标签（对应 api/v1/ledger.py）。
//
// 权限：读取对所有登录用户开放；写操作需要 LedgerWriter（超级管理员 / 台账管理员）。
package ledger

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/ledger"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("", auth.RequireProject)

	g.GET("/ledger-tags", listTags, auth.CurrentUser)
	g.POST("/ledger-tags", createTag, auth.LedgerWriter)
	g.PATCH("/ledger-tags/{tag_id}", updateTag, auth.LedgerWriter)
	g.DELETE("/ledger-tags/{tag_id}", deleteTag, auth.LedgerWriter)

	g.GET("/ledger-items", listItems, auth.CurrentUser)
	g.GET("/ledger-items/{item_id}", getItem, auth.CurrentUser)
	g.POST("/ledger-items", createItem, auth.LedgerWriter)
	g.PATCH("/ledger-items/{item_id}", updateItem, auth.LedgerWriter)
	g.DELETE("/ledger-items/{item_id}", deleteItem, auth.LedgerWriter)
}

// ===== 标签 =====

func listTags(c *web.Ctx) error {
	p := c.Params()
	keyword := p.QueryStr("keyword", "max=128")
	scope := p.QueryStr("scope", "oneof=orphan|tree")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.ListTags(c.DB, keyword, scope)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func createTag(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewLedgerTagCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateTag(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func updateTag(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("tag_id")
	var data schema.LedgerTagUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.UpdateTag(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteTag(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("tag_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteTag(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ===== 台账记录 =====

func listItems(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	tagIDs := p.QueryStr("tag_ids", "max=500")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListItems(c.DB, keyword, tagIDs, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func getItem(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.GetItemRead(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func createItem(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewLedgerItemCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateItem(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func updateItem(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	var data schema.LedgerItemUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.UpdateItem(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteItem(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("item_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteItem(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}
