package purchase

import (
	"encoding/json"
	"os"
	"sync/atomic"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/plancleanup"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// fakeRecordExportTotal 非 0 时，下一次申购记录导出查询直接返回空结果与该总数（一次性）。
var fakeRecordExportTotal atomic.Int64

// 仅 APP_TEST_HOOKS=1 时注册的测试钩子：契约测试里原本直接调用 / monkeypatch Python 内部的用例改为调用这些路由。
//
//	POST /__test__/purchase/plan-cleanup-once                         → {"count": n}
//	POST /__test__/purchase/fake-record-export-total {"total": n}     → {"ok": true}（下一次记录导出查询总数为 n）
//	POST /__test__/purchase/template-dir {"template_dir": "..."}      → {"previous": "..."}
func registerTestHooks(r *web.Router) {
	if os.Getenv("APP_TEST_HOOKS") != "1" {
		return
	}
	g := r.Group("/__test__/purchase")
	g.POST("/plan-cleanup-once", func(c *web.Ctx) error {
		n, err := plancleanup.CleanupMovedPlansOnce(c.Std())
		if err != nil {
			return err
		}
		return c.OK(map[string]any{"count": n})
	})
	g.POST("/fake-record-export-total", func(c *web.Ctx) error {
		var body struct {
			Total int64 `json:"total"`
		}
		if err := hookBody(c, &body); err != nil {
			return err
		}
		fakeRecordExportTotal.Store(body.Total)
		return c.OK(map[string]any{"ok": true})
	})
	g.POST("/template-dir", func(c *web.Ctx) error {
		var body struct {
			TemplateDir string `json:"template_dir"`
		}
		if err := hookBody(c, &body); err != nil {
			return err
		}
		previous := config.S.TemplateDir
		config.S.TemplateDir = body.TemplateDir
		return c.OK(map[string]any{"previous": previous})
	})
}

func hookBody(c *web.Ctx, dst any) error {
	raw, err := c.RawBody()
	if err != nil || len(raw) == 0 {
		return err
	}
	return json.Unmarshal(raw, dst)
}
