// Package secondary 是二级库（精简模式）接口（对应 api/v1/secondary_warehouse.py）。
package secondary

import (
	"net/http"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/lite"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由。
func Register(r *web.Router) {
	g := r.Group("/secondary-warehouse", auth.RequireProject)
	g.GET("", list, auth.CurrentUser)
	g.GET("/last-import", lastImport, auth.CurrentUser)
	g.POST("/import", importInventory, auth.WarehouseWriter)
	g.GET("/import-jobs/{job_id}", getImportJob, auth.CurrentUser)
}

func list(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	params := lite.SearchParams{
		Name:      p.QueryStr("name", "max=128"),
		ModelSpec: p.QueryStr("model_spec", "max=255"),
		Page:      page,
		PageSize:  size,
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := lite.Search(c.DB, params)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func lastImport(c *web.Ctx) error {
	out, err := importjob.LastImportRead(c.DB, lite.JobType)
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
	job, err := importjob.Submit(c.DB, fh, lite.JobType, lite.MaxImportBytes, lite.ProcessImportFile, &user.ID)
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
	job, err := importjob.GetImportJob(c.DB, lite.JobType, id)
	if err != nil {
		return err
	}
	return c.OK(job)
}
