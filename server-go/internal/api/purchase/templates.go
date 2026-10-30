package purchase

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/plantemplate"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func listTemplates(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	name := p.QueryStr("name", "max=128")
	modelSpec := p.QueryStr("model_spec", "max=255")
	actualDemandPerson := p.QueryStr("actual_demand_person", "max=128")
	purchaseResponsible := p.QueryStr("purchase_responsible", "max=128")
	category := p.QueryStr("category", "max=64")
	sortBy := p.QueryStr("sort_by", "")
	sortOrder := p.QueryStrDefault("sort_order", "asc", "oneof=asc|desc")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := plantemplate.SearchTemplates(c.DB, plantemplate.Search{
		Keyword: keyword, Name: name, ModelSpec: modelSpec, ActualDemandPerson: actualDemandPerson,
		PurchaseResponsible: purchaseResponsible, Category: category, Page: page, PageSize: size,
		SortBy: sortBy, SortOrder: sortOrder,
	})
	if err != nil {
		return err
	}
	out := make([]schema.PurchasePlanTemplateRead, len(items))
	for i, it := range items {
		out[i] = plantemplate.TemplateRead(it)
	}
	return c.OK(schema.NewPage(out, page, size, total))
}

func templateFilterOptions(c *web.Ctx) error {
	persons, responsibles, categories, err := plantemplate.FilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.PurchasePlanTemplateFilterOptions{
		ActualDemandPersons: persons, PurchaseResponsibles: responsibles, Categories: categories,
	})
}

func createTemplate(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewPurchasePlanTemplateCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	t, err := plantemplate.CreateTemplate(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(plantemplate.TemplateRead(t))
}

func templateDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("template_id")
	if err := p.Err(); err != nil {
		return err
	}
	t, err := plantemplate.GetTemplate(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(plantemplate.TemplateRead(t))
}

func updateTemplate(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("template_id")
	data := schema.NewPurchasePlanTemplateUpdate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	t, err := plantemplate.GetTemplate(c.DB, id)
	if err != nil {
		return err
	}
	if t, err = plantemplate.UpdateTemplate(c.DB, t, data); err != nil {
		return err
	}
	return c.OK(plantemplate.TemplateRead(t))
}

func deleteTemplate(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("template_id")
	ifMatch := p.IfMatch()
	if err := p.Err(); err != nil {
		return err
	}
	t, err := plantemplate.GetTemplate(c.DB, id)
	if err != nil {
		return err
	}
	if err := plantemplate.DeleteTemplate(c.DB, t, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// generatePurchasePlan 把模板完整复制为一条今天的申购计划（plan_date = 生成当天），模板本身不删除。
func generatePurchasePlan(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("template_id")
	if err := p.Err(); err != nil {
		return err
	}
	t, err := plantemplate.GetTemplate(c.DB, id)
	if err != nil {
		return err
	}
	item, err := plantemplate.GeneratePurchasePlan(c.DB, t)
	if err != nil {
		return err
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.OK(out)
}
