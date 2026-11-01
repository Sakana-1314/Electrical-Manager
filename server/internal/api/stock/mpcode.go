package stock

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/miniprogram"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// generateUnlimitedMaterialCode 对应 mini_program_service.generate_unlimited_material_code(material_uuid, env, app_id)。
var generateUnlimitedMaterialCode = func(s *db.Session, materialUUID, env, appID string) ([]byte, error) {
	return miniprogram.GenerateUnlimitedMaterialCode(s.Ctx(), materialUUID, env, appID)
}

// materialMiniProgramCode GET /stock-materials/mini-program-codes/{material_uuid}?env=&appid=
func materialMiniProgramCode(c *web.Ctx) error {
	p := c.Params()
	materialUUID := schema.PathUUID(p, "material_uuid", c.Param("material_uuid"))
	env := p.QueryStrRequired("env", "oneof="+domain.MiniProgramCodeEnv.OneOf())
	appID := p.QueryStrRequired("appid", "min=1,max=64")
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStockByUUID(c.DB, materialUUID)
	if err != nil {
		return err
	}
	// 生成小程序码要调微信接口（最长约 15s），期间不再访问数据库：先提交释放连接，
	// 批量打印物资码时排队的请求不会各自占着一个「事务中空闲」的连接。
	if err := c.DB.Commit(); err != nil {
		return err
	}
	code, err := generateUnlimitedMaterialCode(c.DB, materialUUID, env, appID)
	if err != nil {
		return err
	}
	return c.Bytes(200, "image/png", code, map[string]string{
		"Cache-Control":       "public, max-age=31536000, s-maxage=31536000, immutable",
		"Content-Disposition": fmt.Sprintf(`inline; filename="material-%s-%s-mini-program-code.png"`, item.UUID, env),
	})
}

// materialMiniProgramCodeRedirect GET /stock-materials/{material_id}/mini-program-code → 307 到带 env / appid 的码地址。
func materialMiniProgramCodeRedirect(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStock(c.DB, id)
	if err != nil {
		return err
	}
	env, err := aisearch.GetMiniProgramCodeEnv(c.DB)
	if err != nil {
		return err
	}
	appID, err := aisearch.GetMiniProgramCodeAppID(c.DB)
	if err != nil {
		return err
	}
	path := c.Request.URL.Path
	prefix := path
	if i := strings.LastIndex(path, "/stock-materials/"); i >= 0 {
		prefix = path[:i]
	}
	target := prefix + "/stock-materials/mini-program-codes/" + item.UUID
	query := "env=" + url.QueryEscape(env) + "&appid=" + url.QueryEscape(appID)
	return c.Redirect(307, target+"?"+query, map[string]string{"Cache-Control": "no-store"})
}
