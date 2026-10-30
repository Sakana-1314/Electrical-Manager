package stock

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
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
	materialUUID := pathUUID(p, c.Param("material_uuid"))
	env := p.QueryStrRequired("env", "oneof="+domain.MiniProgramCodeEnv.OneOf())
	appID := p.QueryStrRequired("appid", "min=1,max=64")
	if err := p.Err(); err != nil {
		return err
	}
	item, err := material.GetStockByUUID(c.DB, materialUUID)
	if err != nil {
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

// ---------------- 路径 UUID ----------------

// pathUUID 解析 UUID 路径参数（接受带连字符 / 32 位 / 花括号 / urn:uuid: 形式），返回规范化小写形式。
func pathUUID(p *web.Params, raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "urn:uuid:")
	if strings.HasPrefix(s, "{") && strings.HasSuffix(s, "}") {
		s = s[1 : len(s)-1]
	}
	hex := s
	if len(s) == 36 {
		if s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
			hex = ""
		} else {
			hex = strings.ReplaceAll(s, "-", "")
		}
	}
	valid := len(hex) == 32
	for i := 0; valid && i < len(hex); i++ {
		ch := hex[i]
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f')) {
			valid = false
		}
	}
	if !valid {
		msg := fmt.Sprintf("Input should be a valid UUID, invalid length: expected length 32 for simple format, found %d", len([]rune(raw)))
		if len(hex) == 32 || len(raw) == 36 {
			msg = "Input should be a valid UUID, invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-]"
		}
		p.Add(web.FieldError{Type: "uuid_parsing", Loc: []any{"path", "material_uuid"}, Msg: msg, Input: raw, Ctx: map[string]any{"error": strings.TrimPrefix(msg, "Input should be a valid UUID, ")}})
		return ""
	}
	return hex[0:8] + "-" + hex[8:12] + "-" + hex[12:16] + "-" + hex[16:20] + "-" + hex[20:32]
}
