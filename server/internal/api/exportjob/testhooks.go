package exportjob

import (
	"context"
	"errors"
	"os"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/excelexport"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/exportjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// 仅 APP_TEST_HOOKS=1 时注册的测试钩子：契约测试里原本直接调用 Python 后台函数的用例
// （启动清理、手动执行一次任务、enqueue）改为调用这些路由，验证 Go 实现。
//
//	POST /__test__/import-jobs/mark-stale            → {"count": n}
//	POST /__test__/import-jobs/cleanup               {"retention_days": 30} → {"count": n}
//	POST /__test__/import-jobs/run                   {"job_id": 1, "processor": "ok|app_error|crash", "result": {...}}
//	POST /__test__/export-jobs/mark-stale            → {"count": n}
//	POST /__test__/export-jobs/cleanup               {"retention_days": 30} → {"count": n}
//	POST /__test__/export-jobs/run                   {"job_id": 1, "processor": "ok|app_error|invalid|crash", "result": {...}}
//	POST /__test__/export-jobs/enqueue (X-Project-Id) {"export_type": "UNIT", "params": {...}, "result": {...}}
func registerTestHooks(r *web.Router) {
	if os.Getenv("APP_TEST_HOOKS") != "1" {
		return
	}
	g := r.Group("/__test__")
	g.POST("/import-jobs/mark-stale", func(c *web.Ctx) error {
		n, err := importjob.MarkStaleJobsFailed(c.Std())
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
	g.POST("/import-jobs/cleanup", func(c *web.Ctx) error {
		var body struct {
			RetentionDays int `json:"retention_days"`
		}
		body.RetentionDays = importjob.DefaultRetentionDays
		if err := hookBody(c, &body); err != nil {
			return err
		}
		n, err := importjob.CleanupFinishedJobs(c.Std(), body.RetentionDays)
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
	g.POST("/import-jobs/run", func(c *web.Ctx) error {
		var body hookRun
		if err := hookBody(c, &body); err != nil {
			return err
		}
		importjob.RunJob(context.Background(), body.JobID, func(ctx context.Context, s *db.Session, filePath string) (map[string]any, error) {
			switch body.Processor {
			case "app_error":
				return nil, apperr.New("TEST_APP_ERROR", "模拟解析失败")
			case "crash":
				return nil, errors.New("boom")
			}
			return body.Result, nil
		})
		return c.OK(map[string]any{"ok": true})
	})
	g.POST("/export-jobs/mark-stale", func(c *web.Ctx) error {
		n, err := exportjob.MarkStaleExportsFailed(c.Std())
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
	g.POST("/export-jobs/cleanup", func(c *web.Ctx) error {
		var body struct {
			RetentionDays int `json:"retention_days"`
		}
		body.RetentionDays = exportjob.RetentionDays
		if err := hookBody(c, &body); err != nil {
			return err
		}
		n, err := exportjob.CleanupFinishedExports(c.Std(), body.RetentionDays)
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
	g.POST("/export-jobs/run", func(c *web.Ctx) error {
		var body hookRun
		if err := hookBody(c, &body); err != nil {
			return err
		}
		exportjob.RunJob(context.Background(), body.JobID, exportHookProcessor(body))
		return c.OK(map[string]any{"ok": true})
	})
	g.POST("/export-jobs/enqueue", func(c *web.Ctx) error {
		var body struct {
			ExportType string         `json:"export_type"`
			Params     map[string]any `json:"params"`
			Result     map[string]any `json:"result"`
		}
		if err := hookBody(c, &body); err != nil {
			return err
		}
		job, err := exportjob.EnqueueExport(c.DB, body.ExportType, body.Params,
			exportHookProcessor(hookRun{Processor: "ok", Result: body.Result, Content: "xlsx"}), nil)
		if err != nil {
			return err
		}
		return c.OK(job)
	})
}

type hookRun struct {
	JobID     int64          `json:"job_id"`
	Processor string         `json:"processor"`
	Result    map[string]any `json:"result"`
	Content   string         `json:"content"`
}

// exportHookProcessor：先写入目标文件（模拟渲染产物），再按 processor 返回结果或错误。
func exportHookProcessor(body hookRun) exportjob.Processor {
	return func(ctx context.Context, s *db.Session, target string) (map[string]any, error) {
		content := body.Content
		if content == "" {
			content = "xlsx-bytes"
		}
		if err := excelexport.WriteExportFile(target, []byte(content)); err != nil {
			return nil, err
		}
		switch body.Processor {
		case "app_error":
			return nil, apperr.New("EXPORT_RESULT_LIMIT_EXCEEDED", "查询结果超过上限")
		case "crash":
			return nil, errors.New("boom")
		}
		return body.Result, nil
	}
}

func hookBody(c *web.Ctx, dst any) error {
	raw, err := c.RawBody()
	if err != nil || len(raw) == 0 {
		return err
	}
	return jsonUnmarshal(raw, dst)
}
