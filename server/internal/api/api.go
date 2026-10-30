// Package api 注册全部 /api/v1 路由（顺序与原 app/api/v1/__init__.py 一致）。
package api

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/codelib"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/exportjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/files"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/hazard"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/huaxing"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/ledger"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/mcp"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/miniprogram"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/purchase"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/secondary"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/settings"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/share"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/stock"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/system"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/work"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	system.Register(r)      // auth / users / memos / version
	aisearch.Register(r)    // ai_search
	settings.Register(r)    // system_settings
	stock.Register(r)       // stock_materials + inventory
	codelib.Register(r)     // material_code_library
	huaxing.Register(r)     // huaxing_inventory
	secondary.Register(r)   // secondary_warehouse
	miniprogram.Register(r) // mini_program management + mini
	purchase.Register(r)    // purchase_materials / plan_templates / record_sync / requests
	share.Register(r)       // share
	exportjob.Register(r)   // excel_export_jobs
	files.Register(r)       // files
	hazard.Register(r)      // hazards
	ledger.Register(r)      // ledger
	system.RegisterProjects(r)
	work.Register(r) // work
	mcp.Register(r)  // /api/v1/mcp
}
