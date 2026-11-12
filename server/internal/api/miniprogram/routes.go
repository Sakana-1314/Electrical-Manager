// Package miniprogram 是小程序接口（对应原 api/v1/mini_program.py 的 management_router 与 mini_router）。
package miniprogram

import (
	"encoding/json"
	"os"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/hazard"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/huaxing"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/miniprogram"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/project"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由（顺序与原 management_router → mini_router 一致）。
func Register(r *web.Router) {
	g := r.Group("/mini-program")
	user := auth.MiniProgramUser
	// RBAC：只读能力按模块 read 权限位门禁，写操作（出库 / 隐患整改）按 write 权限位；
	// 权限位直接存 app_user.permissions（见 internal/domain 的 PermissionCatalog），管理端与小程序端共用。
	g.POST("/auth/wx-login", wechatLogin)
	g.GET("/me", me, user)
	g.GET("/projects", projects, user)
	g.POST("/profile", createProfile, auth.MiniProgramRegistration)
	g.GET("/materials/{material_uuid}", scanMaterial, user, readPerm(domain.PermWarehouseRead))
	g.GET("/inventory", inventoryList, user, readPerm(domain.PermWarehouseRead))
	g.GET("/lite-inventory", liteInventory, user, readPerm(domain.PermWarehouseRead))
	g.GET("/lite-inventory/last-import", lastImport("LITE_INVENTORY"), user, readPerm(domain.PermWarehouseRead))
	g.GET("/purchase-plans", purchasePlans, user, readPerm(domain.PermPurchaseRead))
	g.GET("/purchase-plans/filter-options", purchasePlanFilterOptions, user, readPerm(domain.PermPurchaseRead))
	g.GET("/purchase-records", purchaseRecords, user, readPerm(domain.PermPurchaseRead))
	g.GET("/purchase-records/filter-options", purchaseRecordFilterOptions, user, readPerm(domain.PermPurchaseRead))
	g.GET("/purchase-records/{line_id}", purchaseRecordDetail, user, readPerm(domain.PermPurchaseRead))
	g.GET("/material-codes", materialCodes, user, readPerm(domain.PermCodesRead))
	g.GET("/huaxing-inventory", huaxingInventory, user, readPerm(domain.PermHuaxingRead))
	g.GET("/huaxing-inventory/filter-options", huaxingFilterOptions, user, readPerm(domain.PermHuaxingRead))
	g.GET("/material-codes/last-import", lastImport("MATERIAL_CODE_LIBRARY"), user, readPerm(domain.PermCodesRead))
	g.GET("/huaxing-inventory/last-import", lastImport("HUAXING_INVENTORY"), user, readPerm(domain.PermHuaxingRead))
	// 详情路由放在 last-import 之后，避免 {id} 抢占静态子路径。
	g.GET("/material-codes/{id}", materialCodeDetail, user, readPerm(domain.PermCodesRead))
	g.GET("/huaxing-inventory/{id}", huaxingInventoryDetail, user, readPerm(domain.PermHuaxingRead))
	g.GET("/ledger-items", ledgerItems, user, readPerm(domain.PermLedgerRead))
	g.GET("/ledger-items/tag-options", ledgerTagOptions, user, readPerm(domain.PermLedgerRead))
	g.GET("/ledger-items/{item_id}", ledgerItemDetail, user, readPerm(domain.PermLedgerRead))
	g.GET("/purchase-plans/{material_id}", purchasePlanDetail, user, readPerm(domain.PermPurchaseRead))
	// 精简模式拦截先于权限依赖：lite 模式下对任何用户都返回 OUTBOUND_DISABLED（与出库服务层同码）。
	g.POST("/outbound", outbound, user, liteOutboundBlocked, readPerm(domain.PermWarehouseWrite))
	g.GET("/outbound-reasons", outboundReasons, user, liteOutboundBlocked, readPerm(domain.PermWarehouseWrite))
	g.GET("/operations", operations, user, readPerm(domain.PermWarehouseRead))
	g.GET("/outbound/{operation_no}", outboundByNo, user, readPerm(domain.PermWarehouseRead))
	// 隐患管理：静态子路径（filter-options / form-options / images）先于 /hazards/{hazard_id}。
	g.GET("/hazards", hazards, user, readPerm(domain.PermHazardRead))
	g.GET("/hazards/filter-options", hazardFilterOptions, user, readPerm(domain.PermHazardRead))
	g.GET("/hazards/form-options", hazardFormOptions, user, readPerm(domain.PermHazardRead))
	g.POST("/hazards/images", uploadHazardImage, user, readPerm(domain.PermHazardWrite))
	g.POST("/hazards", createHazard, user, readPerm(domain.PermHazardWrite))
	g.GET("/hazards/{hazard_id}", hazardDetail, user, readPerm(domain.PermHazardRead))
	g.PATCH("/hazards/{hazard_id}", updateHazard, user, readPerm(domain.PermHazardWrite))

	if os.Getenv("APP_TEST_HOOKS") == "1" {
		// 测试钩子：把微信接口改投到本地桩服务（{"base_url": ""} 恢复），同时清空 access_token / 小程序码缓存。
		r.POST("/__test__/mini-program/upstream", setWechatUpstream)
	}
}

// liteOutboundBlocked 精简模式下小程序出库整体禁用：先于权限依赖执行，保持服务层 OUTBOUND_DISABLED 语义。
func liteOutboundBlocked(c *web.Ctx) error {
	lite, err := aisearch.IsLiteSecondaryWarehouse(c.DB)
	if err != nil {
		return err
	}
	if lite {
		return apperr.New("OUTBOUND_DISABLED", "精简模式下不支持出入库").WithStatus(403)
	}
	return nil
}

// readPerm 可读别名：小程序路由的权限位依赖（与 auth.RequirePermission 同一实现，命名只为可读）。
func readPerm(perm domain.Permission) web.Dep {
	return auth.RequirePermission(perm)
}

// acceptLanguage 读取 Accept-Language 头（缺失为 nil）。
func acceptLanguage(c *web.Ctx) *string {
	vals := c.Request.Header.Values("Accept-Language")
	if len(vals) == 0 {
		return nil
	}
	v := vals[0]
	return &v
}

// ---------------- 小程序用户管理 ----------------

// ---------------- 登录 / 建档 ----------------

func wechatLogin(c *web.Ctx) error {
	p := c.Params()
	var data schema.MiniProgramWechatLoginRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, appID, openid, err := svc.LoginWithWechat(c.DB, data.Code, data.AppID)
	if err != nil {
		return err
	}
	if u == nil {
		token := security.CreateMiniProgramRegistrationToken(appID, openid)
		return c.OK(schema.MiniProgramLoginResponse{RegistrationToken: &token, TokenType: "bearer", RequiresProfile: true})
	}
	token := security.CreateMiniProgramAccessToken(u.ID)
	read := svc.UserRead(c.DB, u)
	return c.OK(schema.MiniProgramLoginResponse{AccessToken: &token, TokenType: "bearer", User: &read, RequiresProfile: false})
}

func me(c *web.Ctx) error {
	u, err := svc.LoadUser(c.DB, auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.OK(svc.UserRead(c.DB, u))
}

func projects(c *web.Ctx) error {
	items, err := project.List(c.DB)
	if err != nil {
		return err
	}
	out := make([]schema.ProjectRead, len(items))
	for i := range items {
		out[i] = schema.NewProjectRead(&items[i])
	}
	return c.OK(out)
}

func createProfile(c *web.Ctx) error {
	p := c.Params()
	var data schema.MiniProgramProfileUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	appID, openid := auth.Registration(c)
	u, err := svc.RegisterUser(c.DB, appID, openid, data.DisplayName, data.DepartmentName)
	if err != nil {
		return err
	}
	var token *string
	if u.Enabled {
		t := security.CreateMiniProgramAccessToken(u.ID)
		token = &t
	}
	read := svc.UserRead(c.DB, u)
	return c.OK(schema.MiniProgramLoginResponse{AccessToken: token, TokenType: "bearer", User: &read, RequiresProfile: false})
}

// ---------------- 二级库 ----------------

func scanMaterial(c *web.Ctx) error {
	p := c.Params()
	materialUUID := schema.PathUUID(p, "material_uuid", c.Param("material_uuid"))
	language := acceptLanguage(c)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := svc.GetMaterial(c.DB, materialUUID)
	if err != nil {
		return err
	}
	return c.OK(svc.MaterialRead(item, language))
}

func inventoryList(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramInventoryFilter{
		Keyword:     p.QueryStr("keyword", "max=255"),
		Name:        p.QueryStr("name", "max=255"),
		ModelSpec:   p.QueryStr("model_spec", "max=255"),
		MinQty:      p.QueryDecimal("min_qty", ""),
		MaxQty:      p.QueryDecimal("max_qty", ""),
		StockStatus: p.QueryStr("stock_status", "oneof="+domain.MiniProgramStockStatus.OneOf()),
	}
	language := acceptLanguage(c)
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListInventory(c.DB, f, page, size)
	if err != nil {
		return err
	}
	reads := make([]schema.MiniProgramInventoryItemRead, len(items))
	for i, it := range items {
		reads[i] = svc.InventoryItemRead(it, language)
	}
	return c.OK(schema.NewPage(reads, page, size, total))
}

func liteInventory(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListLiteInventory(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func lastImport(importType string) web.HandlerFunc {
	return func(c *web.Ctx) error {
		out, err := importjob.LastImportRead(c.DB, importType)
		if err != nil {
			return err
		}
		return c.OK(out)
	}
}

func outbound(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewMiniProgramOutboundCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateOutbound(c.DB, data, auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.Created(out)
}

func outboundReasons(c *web.Ctx) error {
	personal, system, err := svc.RecentOutboundReasons(c.DB, auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.OK(schema.MiniProgramOutboundReasonOptions{PersonalReasons: personal, SystemReasons: system})
}

func operations(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListOperationsByUser(c.DB, auth.MiniUser(c), page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func outboundByNo(c *web.Ctx) error {
	out, err := svc.GetOutboundByNo(c.DB, c.Param("operation_no"), auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.OK(out)
}

// ---------------- 申购计划 / 申购记录 ----------------

func purchasePlans(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramPlanFilter{
		Keyword:             p.QueryStr("keyword", "max=255"),
		Name:                p.QueryStr("name", "max=255"),
		ModelSpec:           p.QueryStr("model_spec", "max=255"),
		MaterialCode:        p.QueryStr("material_code", "max=64"),
		ActualDemandPerson:  p.QueryStr("actual_demand_person", "max=128"),
		PurchaseResponsible: p.QueryStr("purchase_responsible", "max=128"),
		DemandDepartment:    p.QueryStr("demand_department", "max=128"),
		SubitemNo:           p.QueryStr("subitem_no", "max=64"),
		Urgency:             p.QueryStr("urgency", "max=64"),
		Category:            p.QueryStr("category", "max=64"),
		PlanDateFrom:        p.QueryDate("plan_date_from"),
		PlanDateTo:          p.QueryDate("plan_date_to"),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListPurchasePlans(c.DB, f, page, size)
	if err != nil {
		return err
	}
	reads := make([]schema.MiniProgramPurchasePlanItemRead, len(items))
	for i := range items {
		reads[i] = svc.PurchasePlanItemRead(&items[i])
	}
	return c.OK(schema.NewPage(reads, page, size, total))
}

func purchasePlanFilterOptions(c *web.Ctx) error {
	out, err := svc.ListPurchasePlanFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.MiniProgramPurchasePlanFilterOptions{
		ActualDemandPersons:  out.ActualDemandPersons,
		PurchaseResponsibles: out.PurchaseResponsibles,
		DemandDepartments:    out.DemandDepartments,
		SubitemNos:           out.SubitemNos,
		Urgencies:            out.Urgencies,
		Categories:           out.Categories,
	})
}

func purchasePlanDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.PurchasePlanDetail(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func purchaseRecords(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramRecordFilter{
		Keyword:             p.QueryStr("keyword", "max=255"),
		Name:                p.QueryStr("name", "max=255"),
		ModelSpec:           p.QueryStr("model_spec", "max=255"),
		MaterialCode:        p.QueryStr("material_code", "max=64"),
		TraceNo:             p.QueryStr("trace_no", "max=64"),
		PurchaseOrderNo:     p.QueryStr("purchase_order_no", "max=128"),
		Usage:               p.QueryStr("usage", "max=500"),
		Status:              p.QueryStr("status", "max=128"),
		SubitemNo:           p.QueryStr("subitem_no", "max=64"),
		Category:            p.QueryStr("category", "max=64"),
		Salesperson:         p.QueryStr("salesperson", "max=64"),
		ActualDemandPerson:  p.QueryStr("actual_demand_person", "max=128"),
		PurchaseResponsible: p.QueryStr("purchase_responsible", "max=128"),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListPurchaseRecords(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func purchaseRecordFilterOptions(c *web.Ctx) error {
	out, err := svc.ListPurchaseRecordFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.MiniProgramPurchaseRecordFilterOptions{
		Statuses: out.Statuses, SubitemNos: out.SubitemNos, Categories: out.Categories,
		Salespersons: out.Salespersons, ActualDemandPersons: out.ActualDemandPersons,
		PurchaseResponsibles: out.PurchaseResponsibles,
	})
}

func purchaseRecordDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("line_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.PurchaseRecordDetail(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// ---------------- 编码库 / 华星库存 / 台账 ----------------

func materialCodes(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramCodeFilter{
		Keyword:      p.QueryStr("keyword", "max=255"),
		Name:         p.QueryStr("name", "max=255"),
		ModelSpec:    p.QueryStr("model_spec", "max=255"),
		MaterialCode: p.QueryStr("material_code", "max=64"),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListMaterialCodes(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func huaxingInventory(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramHuaXingFilter{
		Keyword:            p.QueryStr("keyword", "max=255"),
		Name:               p.QueryStr("name", "max=255"),
		ModelSpec:          p.QueryStr("model_spec", "max=255"),
		MaterialCode:       p.QueryStr("material_code", "max=64"),
		PurchaseDepartment: p.QueryStr("purchase_department", "max=128"),
		Purchaser:          p.QueryStr("purchaser", "max=128"),
		FirstInboundFrom:   p.QueryDate("date_from"),
		FirstInboundTo:     p.QueryDate("date_to"),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListHuaXingInventory(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

// materialCodeDetail 小程序物料编码详情。
func materialCodeDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.MaterialCodeDetail(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// huaxingInventoryDetail 小程序华星库存详情。
func huaxingInventoryDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.HuaXingInventoryDetail(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// huaxingFilterOptions 小程序华星库存筛选：与网页端共用同一份申购部门 / 申购人选项。
func huaxingFilterOptions(c *web.Ctx) error {
	departments, purchasers, err := huaxing.ListFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.HuaXingFilterOptions{PurchaseDepartments: departments, Purchasers: purchasers})
}

func ledgerItems(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := svc.MiniProgramLedgerFilter{
		Keyword: p.QueryStr("keyword", "max=255"),
		TagIDs:  p.QueryStr("tag_ids", "max=500"),
	}
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListLedgerItems(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

// ledgerTagOptions 小程序台账的标签筛选候选值（平铺 + 层级路径）。
func ledgerTagOptions(c *web.Ctx) error {
	items, err := svc.LedgerTagOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(items)
}

// hazardFilterOptions 小程序隐患的筛选项：整改员工 + 责任单位 + 隐患类型（类型 / 单位供筛选下拉用）。
func hazardFilterOptions(c *web.Ctx) error {
	out, err := hazard.MiniProgramHazardFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func ledgerItemDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.LedgerItemDetail(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// ---------------- 隐患管理 ----------------

func hazards(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	f := hazard.HazardFilter{
		Keyword:                    p.QueryStr("keyword", "max=255"),
		Status:                     p.QueryStr("status", schema.HazardStatusQuery),
		Level:                      p.QueryStr("level", schema.HazardLevelQuery),
		RectifyPerson:              p.QueryStr("rectify_person", "max=64"),
		Area:                       p.QueryStr("area", "max=128"),
		HazardTypeID:               p.QueryIntPtr("hazard_type_id", "ge=1"),
		HazardUnitID:               p.QueryIntPtr("hazard_unit_id", "ge=1"),
		DateFrom:                   p.QueryDate("date_from"),
		DateTo:                     p.QueryDate("date_to"),
		Overdue:                    p.QueryBool("overdue", false),
		KeywordAreaDescriptionOnly: true,
	}
	if err := p.Err(); err != nil {
		return err
	}
	// 关键字只匹配「检查区域 + 隐患描述」，其余字段各自精确 / 模糊匹配（与网页端同名筛选口径）。
	items, total, err := hazard.ListHazards(c.DB, f, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func hazardFormOptions(c *web.Ctx) error {
	out, err := hazard.HazardFormOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// uploadHazardImage 小程序上传整改前 / 后图片：与网页端共用同一套图片存储与去重规则。
func uploadHazardImage(c *web.Ctx) error {
	p := c.Params()
	fh := file.FormFile(c, p)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := file.SaveUpload(c.DB, fh)
	if err != nil {
		return err
	}
	return c.Created(item)
}

func createHazard(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewMiniProgramHazardCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := hazard.MiniProgramCreateHazard(c.DB, data, auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.Created(out)
}

func hazardDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("hazard_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := hazard.GetHazardRead(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func updateHazard(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("hazard_id")
	var data schema.MiniProgramHazardUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := hazard.MiniProgramUpdateHazard(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// ---------------- 测试钩子（仅 APP_TEST_HOOKS=1） ----------------

func setWechatUpstream(c *web.Ctx) error {
	var body struct {
		BaseURL string `json:"base_url"`
	}
	if raw, err := c.RawBody(); err == nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, &body); err != nil {
			return err
		}
	}
	svc.SetTestWechatAPIBase(body.BaseURL)
	return c.OK(map[string]any{"ok": true})
}
