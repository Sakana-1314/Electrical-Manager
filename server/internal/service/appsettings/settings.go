// Package appsettings 管理端「高级设置」里仅剩的开关与运行模式：
// 小程序注册开关、小程序新用户默认状态、二级库完整 / 精简模式。
//
// 模型搜索、Webhook 与图片加速不在数据库配置：模型与 Webhook 走服务端环境变量
// （见 internal/config），图片加速能力已移除（图片直接走当前后端线路）。
package appsettings

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	settingKey = "runtime_settings"
	// legacyKey 是旧版本把「AI 配置 + 小程序开关 + 图片加速 + 可见性」混存一行时的键。
	// 新代码优先读 runtime_settings；旧库迁移前也能读到这里保留的三个字段。
	legacyKey = "ai_search_config"
)

// Config 是管理端高级设置（不含模型 / Webhook / 图片加速）。
type Config struct {
	MiniProgramRegistrationEnabled bool
	MiniProgramNewUserEnabled      bool
	SecondaryWarehouseMode         string
	// DefaultPermissions 新建用户 / 小程序新注册用户的默认权限位。
	DefaultPermissions domain.Permission
	UpdatedAt          *jtype.UTCTime
	Version            int64
}

type payload struct {
	MiniProgramRegistrationEnabled bool   `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool   `json:"mini_program_new_user_enabled"`
	SecondaryWarehouseMode         string `json:"secondary_warehouse_mode"`
	DefaultPermissions             int64  `json:"default_permissions"`
}

func (c *Config) payload() payload {
	return payload{
		MiniProgramRegistrationEnabled: c.MiniProgramRegistrationEnabled,
		MiniProgramNewUserEnabled:      c.MiniProgramNewUserEnabled,
		SecondaryWarehouseMode:         c.SecondaryWarehouseMode,
		DefaultPermissions:             int64(c.DefaultPermissions),
	}
}

func defaults() *Config {
	return &Config{
		MiniProgramRegistrationEnabled: true,
		MiniProgramNewUserEnabled:      true,
		SecondaryWarehouseMode:         domain.SecondaryWarehouseFull,
		DefaultPermissions:             domain.DefaultRegistrationPermissions,
	}
}

func enumOr(v any, def string) string {
	if s, ok := v.(string); ok && domain.SecondaryWarehouseMode.Valid(s) {
		return s
	}
	return def
}

func boolOr(v any, def bool) bool {
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}

// permissionOr 解析 JSON 数字形式的权限位图；缺失 / 非法时用默认值。
func permissionOr(v any, def domain.Permission) domain.Permission {
	switch x := v.(type) {
	case float64:
		return domain.Permission(int64(x)).Normalize()
	case int64:
		return domain.Permission(x).Normalize()
	}
	return def
}

func jsonObject(j jtype.JSON) map[string]any {
	var v any
	if err := j.Unmarshal(&v); err != nil {
		return map[string]any{}
	}
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return map[string]any{}
}

func fromData(data map[string]any, version int64, updatedAt *jtype.UTCTime) *Config {
	c := defaults()
	c.MiniProgramRegistrationEnabled = boolOr(data["mini_program_registration_enabled"], true)
	c.MiniProgramNewUserEnabled = boolOr(data["mini_program_new_user_enabled"], true)
	c.SecondaryWarehouseMode = enumOr(data["secondary_warehouse_mode"], domain.SecondaryWarehouseFull)
	c.DefaultPermissions = permissionOr(data["default_permissions"], domain.DefaultRegistrationPermissions)
	c.Version = version
	c.UpdatedAt = updatedAt
	return c
}

// Get 读取高级设置；runtime_settings 不存在时回退旧 ai_search_config，再不存在用默认值。
func Get(s *db.Session) (*Config, error) {
	var row model.SystemSetting
	found, err := s.Find(&row, "SELECT "+model.ColsSystemSetting+" FROM system_setting WHERE setting_key = ?", settingKey)
	if err != nil {
		return nil, err
	}
	if found {
		updated := jtype.NewUTC(row.UpdatedAt)
		return fromData(jsonObject(row.SettingValue), row.Version, &updated), nil
	}
	found, err = s.Find(&row, "SELECT "+model.ColsSystemSetting+" FROM system_setting WHERE setting_key = ?", legacyKey)
	if err != nil {
		return nil, err
	}
	if found {
		updated := jtype.NewUTC(row.UpdatedAt)
		return fromData(jsonObject(row.SettingValue), row.Version, &updated), nil
	}
	return defaults(), nil
}

// Read 转成接口结构。
func Read(c *Config) schema.AdvancedSettingsRead {
	return schema.AdvancedSettingsRead{
		MiniProgramRegistrationEnabled: c.MiniProgramRegistrationEnabled,
		MiniProgramNewUserEnabled:      c.MiniProgramNewUserEnabled,
		SecondaryWarehouseMode:         c.SecondaryWarehouseMode,
		DefaultPermissions:             c.DefaultPermissions.Keys(),
		UpdatedAt:                      c.UpdatedAt,
		Version:                        c.Version,
	}
}

// Update 保存高级设置（乐观锁 + upsert runtime_settings）。
func Update(s *db.Session, data schema.AdvancedSettingsUpdate) (*Config, error) {
	current, err := Get(s)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.Version, current.Version); err != nil {
		return nil, err
	}
	defaultPermissions := current.DefaultPermissions
	if data.DefaultPermissions != nil {
		bits, unknown := domain.PermissionBits(*data.DefaultPermissions)
		if len(unknown) > 0 {
			return nil, apperr.New("INVALID_PERMISSIONS", "包含未知的权限键").WithStatus(422).
				WithDetails(apperr.D{"permissions": unknown})
		}
		defaultPermissions = bits
	}
	now := common.UTCNow()
	updated := jtype.NewUTC(now)
	next := &Config{
		MiniProgramRegistrationEnabled: data.MiniProgramRegistrationEnabled,
		MiniProgramNewUserEnabled:      data.MiniProgramNewUserEnabled,
		SecondaryWarehouseMode:         data.SecondaryWarehouseMode,
		DefaultPermissions:             defaultPermissions,
		UpdatedAt:                      &updated,
		Version:                        current.Version + 1,
	}
	value, err := jtype.ToJSON(next.payload())
	if err != nil {
		return nil, err
	}
	var exists int
	found, err := s.Find(&exists, "SELECT 1 FROM system_setting WHERE setting_key = ?", settingKey)
	if err != nil {
		return nil, err
	}
	if found {
		_, err = s.Exec("UPDATE system_setting SET setting_value = ?, version = ?, updated_at = ? WHERE setting_key = ?",
			value, next.Version, now, settingKey)
	} else {
		_, err = s.Exec("INSERT INTO system_setting (setting_key, setting_value, version, updated_at) VALUES (?, ?, ?, ?)",
			settingKey, value, next.Version, now)
	}
	if err != nil {
		return nil, err
	}
	return next, nil
}

// GetDefaultPermissions 新建用户 / 小程序新注册用户的默认权限位。
func GetDefaultPermissions(s *db.Session) (domain.Permission, error) {
	setting, err := Get(s)
	if err != nil {
		return 0, err
	}
	return setting.DefaultPermissions, nil
}

// IsLiteSecondaryWarehouse 二级库是否处于精简模式（独立表 + 只读 + Excel 导入）。
func IsLiteSecondaryWarehouse(s *db.Session) (bool, error) {
	setting, err := Get(s)
	if err != nil {
		return false, err
	}
	return setting.SecondaryWarehouseMode == domain.SecondaryWarehouseLite, nil
}

// IsMiniProgramRegistrationEnabled 小程序新用户绑定开关。
func IsMiniProgramRegistrationEnabled(s *db.Session) (bool, error) {
	setting, err := Get(s)
	if err != nil {
		return false, err
	}
	return setting.MiniProgramRegistrationEnabled, nil
}

// IsMiniProgramNewUserEnabled 小程序新用户默认状态（false = 待审核）。
func IsMiniProgramNewUserEnabled(s *db.Session) (bool, error) {
	setting, err := Get(s)
	if err != nil {
		return false, err
	}
	return setting.MiniProgramNewUserEnabled, nil
}

// GetMiniProgramFeatures 公开运行模式（小程序启动时拉取）。
func GetMiniProgramFeatures(s *db.Session) (schema.MiniProgramFeaturesRead, error) {
	setting, err := Get(s)
	if err != nil {
		return schema.MiniProgramFeaturesRead{}, err
	}
	return schema.MiniProgramFeaturesRead{SecondaryWarehouseMode: setting.SecondaryWarehouseMode}, nil
}

// GetMiniProgramCodeEnv 小程序码环境由服务端环境变量决定。
func GetMiniProgramCodeEnv() string { return config.S.WechatMiniProgramCodeEnv }

// ---------------- 微信小程序凭据（小程序码 / 登录共用） ----------------

func splitConfigured(raw string) []string {
	var out []string
	for _, item := range strings.Split(raw, ",") {
		if item = strings.TrimSpace(item); item != "" {
			out = append(out, item)
		}
	}
	return out
}

// configuredWechatAppIDs 去重保序的已配置 AppID 列表。
func configuredWechatAppIDs() []string {
	seen := map[string]bool{}
	out := []string{}
	for _, id := range splitConfigured(config.S.WechatMiniProgramAppID) {
		if !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// GetWechatCredentials 对应 get_wechat_credentials(app_id)：appID 为空取第一个。
func GetWechatCredentials(appID string) (string, string, error) {
	appIDs := splitConfigured(config.S.WechatMiniProgramAppID)
	secrets := splitConfigured(config.S.WechatMiniProgramAppSecret)
	unique := map[string]bool{}
	for _, id := range appIDs {
		unique[id] = true
	}
	if len(appIDs) == 0 || len(appIDs) != len(secrets) || len(appIDs) != len(unique) {
		return "", "", apperr.New("WECHAT_CONFIGURATION_INVALID", "微信小程序 AppID 与 AppSecret 配置无效").
			WithStatus(503).
			WithDetails(apperr.D{"app_id_count": len(appIDs), "app_secret_count": len(secrets)})
	}
	effective := appID
	if effective == "" {
		effective = appIDs[0]
	}
	for i, id := range appIDs {
		if id == effective {
			return effective, secrets[i], nil
		}
	}
	var detail any
	if effective != "" {
		detail = effective
	}
	return "", "", apperr.New("WECHAT_NOT_CONFIGURED", "当前微信小程序登录尚未配置").
		WithStatus(503).
		WithDetails(apperr.D{"app_id": detail})
}

// GetMiniProgramCodeAppID 小程序码使用第一个已配置的 AppID（不再由管理端选择）。
func GetMiniProgramCodeAppID() (string, error) {
	appID, _, err := GetWechatCredentials("")
	return appID, err
}
