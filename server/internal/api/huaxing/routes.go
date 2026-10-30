// Package huaxing 是华星库存接口（对应 api/v1/huaxing_inventory.py）。
package huaxing

import (
	"net/http"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/huaxing"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由。
func Register(r *web.Router) {
	g := r.Group("/huaxing-inventory", auth.RequireProject)
	g.GET("", list, auth.CurrentUser)
	g.GET("/filter-options", filterOptions, auth.CurrentUser)
	g.GET("/last-import", lastImport, auth.CurrentUser)
	g.POST("/import", importInventory, auth.WarehouseWriter)
	g.GET("/import-jobs/{job_id}", getImportJob, auth.CurrentUser)
}

func list(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	params := huaxing.SearchParams{
		MaterialCode:       p.QueryStr("material_code", "max=64"),
		Name:               p.QueryStr("name", "max=255"),
		ModelSpec:          p.QueryStr("model_spec", "max=255"),
		PurchaseDepartment: p.QueryStr("purchase_department", "max=128"),
		Purchaser:          p.QueryStr("purchaser", "max=128"),
		DateFrom:           p.QueryDate("date_from"),
		DateTo:             p.QueryDate("date_to"),
		Page:               page,
		PageSize:           size,
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := huaxing.Search(c.DB, params)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func filterOptions(c *web.Ctx) error {
	departments, purchasers, err := huaxing.ListFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.HuaXingFilterOptions{PurchaseDepartments: departments, Purchasers: purchasers})
}

func lastImport(c *web.Ctx) error {
	out, err := importjob.LastImportRead(c.DB, huaxing.JobType)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func importInventory(c *web.Ctx) error {
	p := c.Params()
	fh := importjob.UploadFile(c, p)
	if err := p.Err(); err != nil {
		return err
	}
	user := auth.User(c)
	job, err := importjob.Submit(c.DB, fh, huaxing.JobType, huaxing.MaxImportBytes, huaxing.ProcessImportFile, &user.ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusAccepted, job)
}

func getImportJob(c *web.Ctx) error {
	p := c.Params()
	id := importjob.PathJobID(p, c)
	if err := p.Err(); err != nil {
		return err
	}
	job, err := importjob.GetImportJob(c.DB, huaxing.JobType, id)
	if err != nil {
		return err
	}
	return c.OK(job)
}
