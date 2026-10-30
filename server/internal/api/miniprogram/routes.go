// Package miniprogram 是小程序接口（对应原 api/v1/mini_program.py 的 management_router 与 mini_router）。
package miniprogram

import (
	"encoding/json"
	"os"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/hazard"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/miniprogram"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/project"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// Register 注册本模块路由（顺序与原 management_router → mini_router 一致）。
func Register(r *web.Router) {
	m := r.Group("/mini-program-users")
	m.GET("", listUsers, auth.SuperAdmin)
	m.PATCH("/{user_id}", updateUser, auth.SuperAdmin)
	m.DELETE("/{user_id}", deleteUser, auth.SuperAdmin)
	m.POST("/{target_user_id}/merge", mergeUsers, auth.SuperAdmin)

	g := r.Group("/mini-program")
	user := auth.MiniProgramUser
	g.POST("/auth/wx-login", wechatLogin)
	g.GET("/me", me, user)
	g.GET("/projects", projects, user)
	g.POST("/profile", createProfile, auth.MiniProgramRegistration)
	g.GET("/materials/{material_uuid}", scanMaterial, user)
	g.GET("/inventory", inventoryList, user)
	g.GET("/lite-inventory", liteInventory, user)
	g.GET("/lite-inventory/last-import", lastImport("LITE_INVENTORY"), user)
	g.GET("/purchase-plans", purchasePlans, user)
	g.GET("/purchase-plans/filter-options", purchasePlanFilterOptions, user)
	g.GET("/purchase-records", purchaseRecords, user)
	g.GET("/purchase-records/filter-options", purchaseRecordFilterOptions, user)
	g.GET("/purchase-records/{line_id}", purchaseRecordDetail, user)
	g.GET("/material-codes", materialCodes, user)
	g.GET("/huaxing-inventory", huaxingInventory, user)
	g.GET("/material-codes/last-import", lastImport("MATERIAL_CODE_LIBRARY"), user)
	g.GET("/huaxing-inventory/last-import", lastImport("HUAXING_INVENTORY"), user)
	g.GET("/ledger-items", ledgerItems, user)
	g.GET("/ledger-items/{item_id}", ledgerItemDetail, user)
	g.GET("/purchase-plans/{material_id}", purchasePlanDetail, user)
	g.POST("/outbound", outbound, user)
	g.GET("/outbound-reasons", outboundReasons, user)
	g.GET("/operations", operations, user)
	g.GET("/outbound/{operation_no}", outboundByNo, user)
	// 隐患管理：静态子路径（filter-options / form-options / images）先于 /hazards/{hazard_id}。
	g.GET("/hazards", hazards, user)
	g.GET("/hazards/filter-options", hazardFilterOptions, user)
	g.GET("/hazards/form-options", hazardFormOptions, user)
	g.POST("/hazards/images", uploadHazardImage, user)
	g.POST("/hazards", createHazard, user)
	g.GET("/hazards/{hazard_id}", hazardDetail, user)
	g.PATCH("/hazards/{hazard_id}", updateHazard, user)

	if os.Getenv("APP_TEST_HOOKS") == "1" {
		// 测试钩子：把微信接口改投到本地桩服务（{"base_url": ""} 恢复），同时清空 access_token / 小程序码缓存。
		r.POST("/__test__/mini-program/upstream", setWechatUpstream)
	}
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

func listUsers(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=128")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListUsers(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	reads := make([]schema.MiniProgramUserRead, len(items))
	for i, it := range items {
		reads[i] = svc.UserRead(it)
	}
	return c.OK(schema.NewPage(reads, page, size, total))
}

func updateUser(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("user_id")
	var data schema.MiniProgramUserUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := svc.UpdateUser(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(svc.UserRead(u))
}

func deleteUser(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("user_id")
	ifMatch := p.IfMatch()
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteUser(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

func mergeUsers(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("target_user_id")
	var data schema.MiniProgramUserMergeRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := svc.MergeUsers(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(svc.UserRead(u))
}

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
	read := svc.UserRead(u)
	return c.OK(schema.MiniProgramLoginResponse{AccessToken: &token, TokenType: "bearer", User: &read, RequiresProfile: false})
}

func me(c *web.Ctx) error {
	u, err := svc.LoadUser(c.DB, auth.MiniUser(c))
	if err != nil {
		return err
	}
	return c.OK(svc.UserRead(u))
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
	read := svc.UserRead(u)
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
	keyword := p.QueryStr("keyword", "max=255")
	stockStatus := p.QueryStr("stock_status", "oneof="+domain.MiniProgramStockStatus.OneOf())
	language := acceptLanguage(c)
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListInventory(c.DB, keyword, stockStatus, page, size)
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
	keyword := p.QueryStr("keyword", "max=255")
	actualDemandPerson := p.QueryStr("actual_demand_person", "max=128")
	subitemNo := p.QueryStr("subitem_no", "max=64")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListPurchasePlans(c.DB, keyword, page, size, actualDemandPerson, subitemNo)
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
	persons, subitemNos, err := svc.ListPurchasePlanFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.MiniProgramPurchasePlanFilterOptions{ActualDemandPersons: persons, SubitemNos: subitemNos})
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
	keyword := p.QueryStr("keyword", "max=255")
	status := p.QueryStr("status", "max=128")
	subitemNo := p.QueryStr("subitem_no", "max=64")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListPurchaseRecords(c.DB, keyword, status, subitemNo, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func purchaseRecordFilterOptions(c *web.Ctx) error {
	statuses, subitemNos, err := svc.ListPurchaseRecordFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.MiniProgramPurchaseRecordFilterOptions{Statuses: statuses, SubitemNos: subitemNos})
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
	keyword := p.QueryStr("keyword", "max=255")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListMaterialCodes(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func huaxingInventory(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListHuaXingInventory(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func ledgerItems(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListLedgerItems(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
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
	keyword := p.QueryStr("keyword", "max=255")
	status := p.QueryStr("status", schema.HazardStatusQuery)
	rectifyPerson := p.QueryStr("rectify_person", "max=64")
	if err := p.Err(); err != nil {
		return err
	}
	// 关键字只匹配「检查区域 + 隐患描述」，可按整改状态与整改员工筛选。
	items, total, err := hazard.ListHazards(c.DB, hazard.HazardFilter{
		Status: status, Keyword: keyword, RectifyPerson: rectifyPerson, KeywordAreaDescriptionOnly: true,
	}, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func hazardFilterOptions(c *web.Ctx) error {
	out, err := hazard.HazardFilterOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
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
