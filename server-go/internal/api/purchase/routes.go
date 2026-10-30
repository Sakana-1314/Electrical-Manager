// Package purchase 是申购相关接口：申购计划（api/v1/purchase_materials.py）、周期性计划
// （api/v1/purchase_plan_templates.py）、申购记录同步（api/v1/purchase_record_sync.py）与申购记录
// （api/v1/purchase_requests.py）。
package purchase

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// linkWriter 关联二级库物资：超级管理员 / 仓库管理员 / 申购管理员。
var linkWriter = auth.Roles(domain.RoleSuperAdmin, domain.RoleWarehouseAdmin, domain.RolePurchaseAdmin)

// Register 注册申购模块全部路由（顺序与原 api/v1/__init__.py 一致）。
func Register(r *web.Router) {
	m := r.Group("/purchase-materials", auth.RequireProject)
	m.GET("", listMaterials, auth.CurrentUser)
	m.GET("/filter-options", materialFilterOptions, auth.CurrentUser)
	m.POST("", createMaterial, auth.PurchaseWriter)
	m.POST("/export-results", exportMaterialResults, auth.CurrentUser)
	m.GET("/export-uncoded", exportUncodedMaterials, auth.CurrentUser)
	m.POST("/export-purchase-application", exportPurchaseApplication, auth.CurrentUser)
	m.POST("/export-purchase-approval", exportPurchaseApproval, auth.CurrentUser)
	m.POST("/batch-move-to-record", batchMoveToRecord, auth.PurchaseWriter)
	m.PATCH("/batch", batchUpdateMaterials, auth.PurchaseWriter)
	m.GET("/{material_id}", materialDetail, auth.CurrentUser)
	m.PATCH("/{material_id}", updateMaterial, auth.PurchaseWriter)
	m.DELETE("/{material_id}", deleteMaterial, auth.PurchaseWriter)
	m.POST("/{material_id}/link-stock-material", linkStockMaterial, linkWriter)
	m.POST("/{material_id}/move-to-record", moveToRecord, auth.PurchaseWriter)

	t := r.Group("/purchase-plan-templates", auth.RequireProject)
	t.GET("", listTemplates, auth.CurrentUser)
	t.GET("/filter-options", templateFilterOptions, auth.CurrentUser)
	t.POST("", createTemplate, auth.PurchaseWriter)
	t.GET("/{template_id}", templateDetail, auth.CurrentUser)
	t.PATCH("/{template_id}", updateTemplate, auth.PurchaseWriter)
	t.DELETE("/{template_id}", deleteTemplate, auth.PurchaseWriter)
	t.POST("/{template_id}/generate", generatePurchasePlan, auth.PurchaseWriter)

	s := r.Group("", auth.RequireProject)
	s.GET("/purchase-record-sync/targets", syncTargets, auth.PurchaseWriter)
	s.POST("/purchase-record-sync/trace/{trace_no}", syncTrace, auth.PurchaseWriter)
	s.GET("/purchase-record-sync/order-targets", syncOrderTargets, auth.PurchaseWriter)
	s.POST("/purchase-record-sync/orders/{purchase_order_no}/apply", syncOrderApply, auth.PurchaseWriter)

	q := r.Group("", auth.RequireProject)
	q.GET("/purchase-records", listPurchaseRecords, auth.CurrentUser)
	q.GET("/purchase-records/filter-options", purchaseRecordFilterOptions, auth.CurrentUser)
	q.POST("/purchase-records/export-results", exportPurchaseRecordResults, auth.CurrentUser)
	q.PATCH("/purchase-records/batch", batchEditPurchaseRecords, auth.PurchaseWriter)
	q.GET("/purchase-records/{line_id}", purchaseRecordDetail, auth.CurrentUser)
	q.POST("/purchase-records/{line_id}/restore-to-plan", restorePurchaseRecordToPlan, auth.PurchaseWriter)
	q.PATCH("/purchase-records/{line_id}", editPurchaseRecord, auth.PurchaseWriter)

	registerTestHooks(r)
}
