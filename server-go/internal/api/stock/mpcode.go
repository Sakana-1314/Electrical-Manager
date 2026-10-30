package stock

import (
	"fmt"
	"net/url"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// generateUnlimitedMaterialCode 对应 mini_program_service.generate_unlimited_material_code(material_uuid, env, app_id)。
//
// TODO(mini-program)：小程序模块移植后改为调用其导出函数（返回 PNG 字节）。在此之前统一报 503。
var generateUnlimitedMaterialCode = func(s *db.Session, materialUUID, env, appID string) ([]byte, error) {
	return nil, apperr.New("MINI_PROGRAM_CODE_UNAVAILABLE", "小程序码生成尚未接入").WithStatus(503)
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
	cfg, err := miniProgramCodeSetting(c.DB)
	if err != nil {
		return err
	}
	env := domain.MiniProgramCodeEnvRelease
	var selected string
	if cfg != nil {
		env = normalizeCodeEnv(cfg["mini_program_code_env"])
		selected = normalizeCodeAppID(cfg["mini_program_code_app_id"])
	} else {
		selected = normalizeCodeAppID(nil)
	}
	appID, err := wechatAppID(selected)
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

// ---------------- 小程序码配置（ai_search_service.get_mini_program_code_env / _app_id） ----------------
//
// TODO(aisearch)：aisearch 包提供 GetMiniProgramCodeEnv / GetMiniProgramCodeAppID 后改为直接调用。

const (
	settingKey          = "ai_search_config"
	settingBusinessType = "SYSTEM_SETTING"
	settingBusinessID   = 1
	settingAction       = "AI_SEARCH_CONFIG_UPDATED"
)

// miniProgramCodeSetting 读取高级设置 JSON（system_setting 为空时回退最后一条配置事件）；都没有返回 nil。
func miniProgramCodeSetting(s *db.Session) (map[string]any, error) {
	var row model.SystemSetting
	ok, err := s.Find(&row, "SELECT "+model.ColsSystemSetting+" FROM system_setting WHERE setting_key = ?", settingKey)
	if err != nil {
		return nil, err
	}
	var raw jtype.JSON
	if ok {
		raw = row.SettingValue
	} else {
		var after jtype.JSON
		found, err := s.Find(&after, "SELECT after_data FROM business_event_log WHERE business_type = ? AND business_id = ? AND action = ? ORDER BY id DESC LIMIT 1",
			settingBusinessType, settingBusinessID, settingAction)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, nil
		}
		raw = after
	}
	data := map[string]any{}
	var v any
	if err := raw.Unmarshal(&v); err == nil {
		if m, ok := v.(map[string]any); ok {
			data = m
		}
	}
	return data, nil
}

func normalizeCodeEnv(v any) string {
	if s, ok := v.(string); ok && domain.MiniProgramCodeEnv.Valid(s) {
		return s
	}
	return domain.MiniProgramCodeEnvRelease
}

func splitConfig(raw string) []string {
	out := []string{}
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

func configuredAppIDs() []string {
	seen := map[string]bool{}
	out := []string{}
	for _, id := range splitConfig(config.S.WechatMiniProgramAppID) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

func normalizeCodeAppID(v any) string {
	ids := configuredAppIDs()
	if s, ok := v.(string); ok {
		for _, id := range ids {
			if id == s {
				return s
			}
		}
	}
	if len(ids) > 0 {
		return ids[0]
	}
	return ""
}

// wechatAppID 对应 get_wechat_credentials(app_id)[0]。
func wechatAppID(appID string) (string, error) {
	ids := splitConfig(config.S.WechatMiniProgramAppID)
	secrets := splitConfig(config.S.WechatMiniProgramAppSecret)
	uniq := map[string]bool{}
	for _, id := range ids {
		uniq[id] = true
	}
	if len(ids) == 0 || len(ids) != len(secrets) || len(ids) != len(uniq) {
		return "", apperr.New("WECHAT_CONFIGURATION_INVALID", "微信小程序 AppID 与 AppSecret 配置无效").WithStatus(503).
			WithDetails(apperr.D{"app_id_count": len(ids), "app_secret_count": len(secrets)})
	}
	effective := appID
	if effective == "" {
		effective = ids[0]
	}
	if !uniq[effective] {
		var detail any
		if effective != "" {
			detail = effective
		}
		return "", apperr.New("WECHAT_NOT_CONFIGURED", "当前微信小程序登录尚未配置").WithStatus(503).WithDetails(apperr.D{"app_id": detail})
	}
	return effective, nil
}
