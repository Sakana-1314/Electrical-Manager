// Package hazard 是隐患管理接口：隐患台账、隐患类型、责任单位（对应 api/v1/hazards.py）。
//
// 权限：读取对所有登录用户开放；写操作需要 HazardWriter（超级管理员 / 隐患管理员）。
package hazard

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/hazard"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("", auth.RequireProject)

	g.GET("/hazards", listHazards, auth.CurrentUser)
	g.GET("/hazards/filter-options", filterOptions, auth.CurrentUser)
	g.GET("/hazards/stats", stats, auth.CurrentUser)
	g.GET("/hazards/{hazard_id}", getHazard, auth.CurrentUser)
	g.POST("/hazards", createHazard, auth.HazardWriter)
	g.PATCH("/hazards/{hazard_id}", updateHazard, auth.HazardWriter)
	g.DELETE("/hazards/{hazard_id}", deleteHazard, auth.HazardWriter)

	g.GET("/hazard-units", listUnits, auth.CurrentUser)
	g.POST("/hazard-units", createUnit, auth.HazardWriter)
	g.PATCH("/hazard-units/{unit_id}", updateUnit, auth.HazardWriter)
	g.DELETE("/hazard-units/{unit_id}", deleteUnit, auth.HazardWriter)

	g.GET("/hazard-types", listTypes, auth.CurrentUser)
	g.POST("/hazard-types", createType, auth.HazardWriter)
	g.PATCH("/hazard-types/{type_id}", updateType, auth.HazardWriter)
	g.DELETE("/hazard-types/{type_id}", deleteType, auth.HazardWriter)
}

// ===== 隐患台账 =====

func listHazards(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.HazardFilter{
		Status:        p.QueryStr("status", schema.HazardStatusQuery),
		Level:         p.QueryStr("level", schema.HazardLevelQuery),
		HazardTypeID:  p.QueryIntPtr("hazard_type_id", "ge=1"),
		HazardUnitID:  p.QueryIntPtr("hazard_unit_id", "ge=1"),
		Area:          p.QueryStr("area", "max=128"),
		Keyword:       p.QueryStr("keyword", "max=255"),
		RectifyPerson: p.QueryStr("rectify_person", "max=64"),
		DateFrom:      p.QueryDate("date_from"),
		DateTo:        p.QueryDate("date_to"),
		Overdue:       p.QueryBool("overdue", false),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListHazards(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func filterOptions(c *web.Ctx) error {
	out, err := svc.HazardFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func stats(c *web.Ctx) error {
	out, err := svc.HazardStats(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func getHazard(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("hazard_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.GetHazardRead(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func createHazard(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewHazardCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateHazard(c.DB, data, nil, svc.DefaultInspector)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func updateHazard(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("hazard_id")
	var data schema.HazardUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.UpdateHazard(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteHazard(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("hazard_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteHazard(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ===== 责任单位 =====

func listUnits(c *web.Ctx) error {
	p := c.Params()
	keyword := p.QueryStr("keyword", "max=128")
	enabled := p.QueryBoolPtr("enabled")
	if err := p.Err(); err != nil {
		return err
	}
	units, err := svc.ListUnits(c.DB, keyword, enabled)
	if err != nil {
		return err
	}
	out := make([]schema.HazardUnitRead, len(units))
	for i := range units {
		out[i] = schema.NewHazardUnitRead(&units[i])
	}
	return c.OK(out)
}

func createUnit(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewHazardUnitCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := svc.CreateUnit(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(schema.NewHazardUnitRead(u))
}

func updateUnit(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("unit_id")
	var data schema.HazardUnitUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := svc.UpdateUnit(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(schema.NewHazardUnitRead(u))
}

func deleteUnit(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("unit_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteUnit(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ===== 隐患类型 =====

func listTypes(c *web.Ctx) error {
	types, err := svc.ListTypes(c.DB)
	if err != nil {
		return err
	}
	out := make([]schema.HazardTypeRead, len(types))
	for i := range types {
		out[i] = schema.NewHazardTypeRead(&types[i])
	}
	return c.OK(out)
}

func createType(c *web.Ctx) error {
	p := c.Params()
	var data schema.HazardTypeCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	t, err := svc.CreateType(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(schema.NewHazardTypeRead(t))
}

func updateType(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("type_id")
	var data schema.HazardTypeUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	t, err := svc.UpdateType(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(schema.NewHazardTypeRead(t))
}

func deleteType(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("type_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteType(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}
