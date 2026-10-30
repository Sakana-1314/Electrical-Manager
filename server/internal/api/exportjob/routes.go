// Package exportjob 是导出任务接口（对应 api/v1/excel_export_jobs.py）。
package exportjob

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/excelexport"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/exportjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由（无分组项目依赖：下载端点匿名）。
func Register(r *web.Router) {
	g := r.Group("/excel-export-jobs")
	g.GET("/{job_id}", getExportJob, auth.CurrentUser)
	g.GET("/files/{file_uuid}", downloadExportFile)
	registerTestHooks(r)
}

func getExportJob(c *web.Ctx) error {
	p := c.Params()
	id := importjob.PathJobID(p, c)
	if err := p.Err(); err != nil {
		return err
	}
	job, err := exportjob.GetExportJob(c.DB, id, auth.User(c))
	if err != nil {
		return err
	}
	return c.OK(job)
}

// downloadExportFile 匿名读取是刻意设计：前端 <a href> 原生下载无法携带 Authorization 头；
// 安全性依赖 file_uuid 为 UUIDv7（不可猜解）+ 文件只存在于 exports 目录（保留期后删除）。
func downloadExportFile(c *web.Ctx) error {
	p := c.Params()
	fileUUID := p.PathStr("file_uuid", "pattern=uuid7")
	if err := p.Err(); err != nil {
		return err
	}
	path, name, err := exportjob.GetExportFileByUUID(c.DB, fileUUID)
	if err != nil {
		return err
	}
	return c.File(path, name, excelexport.XLSXContentType, nil)
}
