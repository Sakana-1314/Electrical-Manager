// Package codelib 是物料编码库接口（对应 api/v1/material_code_library.py）。
package codelib

import (
	"net/http"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/codelib"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/price"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由。
func Register(r *web.Router) {
	g := r.Group("/material-code-library", auth.RequireProject)
	g.GET("", list, auth.CurrentUser)
	g.GET("/last-import", lastImport, auth.CurrentUser)
	g.GET("/exists", exists, auth.CurrentUser)
	g.POST("/import", importCodes, auth.PurchaseWriter)
	g.GET("/import-jobs/{job_id}", getImportJob, auth.CurrentUser)
}

// 下拉菜单的两个选项：物料表写物料编码库，价格表写物料价格；两者各自全量替换。
type tableConfig struct {
	jobType   string
	processor importjob.Processor
	maxBytes  int64
}

var tables = map[string]tableConfig{
	domain.MaterialCodeImportMaterial: {codelib.JobType, codelib.ProcessImportFile, codelib.MaxImportBytes},
	domain.MaterialCodeImportPrice:    {price.JobType, price.ProcessImportFile, price.MaxImportBytes},
}

func tableParam(p *web.Params) tableConfig {
	t := p.QueryStrDefault("table", domain.MaterialCodeImportMaterial, "oneof="+domain.MaterialCodeImportTable.OneOf())
	if cfg, ok := tables[t]; ok {
		return cfg
	}
	return tables[domain.MaterialCodeImportMaterial]
}

func list(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	params := codelib.SearchParams{
		Keyword:      p.QueryStr("keyword", "max=255"),
		Name:         p.QueryStr("name", "max=128"),
		ModelSpec:    p.QueryStr("model_spec", "max=255"),
		MaterialCode: p.QueryStr("material_code", "max=64"),
		Page:         page,
		PageSize:     size,
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := codelib.Search(c.DB, params)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func lastImport(c *web.Ctx) error {
	p := c.Params()
	cfg := tableParam(p)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := importjob.LastImportRead(c.DB, cfg.jobType)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// exists 软校验：编码是否已收录于物料编码库（不阻断业务，仅提示）。
func exists(c *web.Ctx) error {
	p := c.Params()
	code := p.QueryStrRequired("material_code", "min=1,max=64")
	if err := p.Err(); err != nil {
		return err
	}
	code = importfile.PyStrip(code)
	ok, err := codelib.MaterialCodeExists(c.DB, code)
	if err != nil {
		return err
	}
	return c.OK(schema.MaterialCodeExistsRead{MaterialCode: code, Exists: ok})
}

// importCodes 按 table 分流：物料表整表替换物料编码库，价格表整表替换物料价格。
func importCodes(c *web.Ctx) error {
	p := c.Params()
	cfg := tableParam(p)
	fh := importjob.UploadFile(c, p)
	if err := p.Err(); err != nil {
		return err
	}
	user := auth.User(c)
	job, err := importjob.Submit(c.DB, fh, cfg.jobType, cfg.maxBytes, cfg.processor, &user.ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusAccepted, job)
}

func getImportJob(c *web.Ctx) error {
	p := c.Params()
	id := importjob.PathJobID(p, c)
	cfg := tableParam(p)
	if err := p.Err(); err != nil {
		return err
	}
	job, err := importjob.GetImportJob(c.DB, cfg.jobType, id)
	if err != nil {
		return err
	}
	return c.OK(job)
}
