// Package stock 是二级库物资（api/v1/stock_materials.py）与库存 / 工作台（api/v1/inventory.py）接口。
package stock

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/deps"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/replenishment"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册 stock_materials 与 inventory 路由（顺序与原版一致）。
func Register(r *web.Router) {
	m := r.Group("/stock-materials", auth.RequireProject)
	m.GET("", listMaterials, auth.CurrentUser)
	m.POST("", createMaterial, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	m.GET("/{material_id}", materialDetail, auth.CurrentUser)
	m.GET("/mini-program-codes/{material_uuid}", materialMiniProgramCode, auth.CurrentUser)
	m.GET("/{material_id}/mini-program-code", materialMiniProgramCodeRedirect, auth.CurrentUser)
	m.PATCH("/{material_id}", updateMaterial, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	m.DELETE("/{material_id}", deleteMaterial, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	m.PUT("/{material_id}/replenishment-policy", savePolicy, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)

	registerInventory(r.Group("", auth.RequireProject))
}

func stockRead(c *web.Ctx, materialID int64) (schema.StockMaterialRead, error) {
	item, err := material.GetStock(c.DB, materialID)
	if err != nil {
		return schema.StockMaterialRead{}, err
	}
	used, err := material.StockIDsWithOperations(c.DB, []int64{materialID})
	if err != nil {
		return schema.StockMaterialRead{}, err
	}
	return material.StockRead(item, used[materialID]), nil
}

func listMaterials(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := material.SearchStock(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	ids := make([]int64, len(items))
	for i, it := range items {
		ids[i] = it.ID
	}
	used, err := material.StockIDsWithOperations(c.DB, ids)
	if err != nil {
		return err
	}
	out := make([]schema.StockMaterialRead, len(items))
	for i, it := range items {
		out[i] = material.StockRead(it, used[it.ID])
	}
	return c.OK(schema.NewPage(out, page, size, total))
}

func createMaterial(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewStockMaterialCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.CreateStock(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(material.StockRead(item, false))
}

func materialDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := stockRead(c, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func updateMaterial(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	var data schema.StockMaterialUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStock(c.DB, id)
	if err != nil {
		return err
	}
	if _, err := material.UpdateStock(c.DB, item, data); err != nil {
		return err
	}
	out, err := stockRead(c, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteMaterial(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	ifMatch := p.IfMatch()
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStock(c.DB, id)
	if err != nil {
		return err
	}
	if err := material.DeleteStock(c.DB, item, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

func savePolicy(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	data := schema.NewReplenishmentPolicyWrite()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStock(c.DB, id)
	if err != nil {
		return err
	}
	if _, err := replenishment.SetPolicy(c.DB, item, data); err != nil {
		return err
	}
	out, err := stockRead(c, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}
