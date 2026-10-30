package aisearch

import (
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	settingBusinessType = "SYSTEM_SETTING"
	settingBusinessID   = 1
	settingAction       = "AI_SEARCH_CONFIG_UPDATED"
	settingKey          = "ai_search_config"
)

// Config 对应 AiSearchConfig：解析后的高级设置。
type Config struct {
	Endpoint                       string
	APIKeyEncrypted                string
	Model                          string
	Enabled                        bool
	MiniProgramCodeEnv             string
	MiniProgramCodeAppID           string
	MiniProgramRegistrationEnabled bool
	MiniProgramNewUserEnabled      bool
	ImageAccelerationServerURL     string
	InventoryMode                  string
	HuaxingInventoryMode           string
	PurchasePlansMode              string
	PurchaseRecordsMode            string
	MaterialCodesMode              string
	HazardsMode                    string
	LedgerMode                     string
	SecondaryWarehouseMode         string
	WebFeatures                    schema.WebFeatureVisibility
	// UpdatedAt：system_setting 行为 aware（输出带 +00:00），旧事件日志回退为 naive（UpdatedNaive=true）。
	UpdatedAt    *time.Time
	UpdatedNaive bool
	Version      int64
}

// configPayload 是写入 system_setting / 事件日志的 JSON（键顺序照抄 _payload）。
type configPayload struct {
	Endpoint                       string                      `json:"endpoint"`
	APIKeyEncrypted                string                      `json:"api_key_encrypted"`
	Model                          string                      `json:"model"`
	Enabled                        bool                        `json:"enabled"`
	MiniProgramCodeEnv             string                      `json:"mini_program_code_env"`
	MiniProgramCodeAppID           string                      `json:"mini_program_code_app_id"`
	MiniProgramRegistrationEnabled bool                        `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool                        `json:"mini_program_new_user_enabled"`
	ImageAccelerationServerURL     string                      `json:"image_acceleration_server_url"`
	InventoryMode                  string                      `json:"inventory_mode"`
	HuaxingInventoryMode           string                      `json:"huaxing_inventory_mode"`
	PurchasePlansMode              string                      `json:"purchase_plans_mode"`
	PurchaseRecordsMode            string                      `json:"purchase_records_mode"`
	MaterialCodesMode              string                      `json:"material_codes_mode"`
	HazardsMode                    string                      `json:"hazards_mode"`
	LedgerMode                     string                      `json:"ledger_mode"`
	SecondaryWarehouseMode         string                      `json:"secondary_warehouse_mode"`
	WebFeatures                    schema.WebFeatureVisibility `json:"web_features"`
}

func (c *Config) payload() configPayload {
	return configPayload{
		Endpoint: c.Endpoint, APIKeyEncrypted: c.APIKeyEncrypted, Model: c.Model, Enabled: c.Enabled,
		MiniProgramCodeEnv: c.MiniProgramCodeEnv, MiniProgramCodeAppID: c.MiniProgramCodeAppID,
		MiniProgramRegistrationEnabled: c.MiniProgramRegistrationEnabled, MiniProgramNewUserEnabled: c.MiniProgramNewUserEnabled,
		ImageAccelerationServerURL: c.ImageAccelerationServerURL,
		InventoryMode:              c.InventoryMode, HuaxingInventoryMode: c.HuaxingInventoryMode,
		PurchasePlansMode: c.PurchasePlansMode, PurchaseRecordsMode: c.PurchaseRecordsMode,
		MaterialCodesMode: c.MaterialCodesMode, HazardsMode: c.HazardsMode, LedgerMode: c.LedgerMode,
		SecondaryWarehouseMode: c.SecondaryWarehouseMode, WebFeatures: c.WebFeatures,
	}
}

// defaultConfig 是未配置时各字段的默认值（setting_read(None) 的口径）。
func defaultConfig() *Config {
	return &Config{
		MiniProgramCodeEnv:             domain.MiniProgramCodeEnvRelease,
		MiniProgramRegistrationEnabled: true,
		MiniProgramNewUserEnabled:      true,
		InventoryMode:                  domain.FeatureReadWrite,
		HuaxingInventoryMode:           domain.FeatureQueryOnly,
		PurchasePlansMode:              domain.FeatureQueryOnly,
		PurchaseRecordsMode:            domain.FeatureQueryOnly,
		MaterialCodesMode:              domain.FeatureQueryOnly,
		HazardsMode:                    domain.FeatureReadWrite,
		LedgerMode:                     domain.FeatureQueryOnly,
		SecondaryWarehouseMode:         domain.SecondaryWarehouseFull,
		WebFeatures:                    schema.AllVisibleWebFeatures(),
	}
}

func decryptAPIKey(ciphertext string) (string, error) {
	plain := security.DecryptSecret(ciphertext)
	if plain == nil {
		return "", apperr.New("AI_API_KEY_DECRYPT_FAILED", "AI API Key 无法解密，请由超级管理员重新保存配置").WithStatus(503)
	}
	return *plain, nil
}

func strOr(v any, def string) string {
	if s, ok := v.(string); ok {
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

func enumOr(v any, e domain.Enum, def string) string {
	if s, ok := v.(string); ok && e.Valid(s) {
		return s
	}
	return def
}

// parseWebFeatures 对应 _web_features：只认已声明的键、非布尔按显示、全 False 归一到全显示。
func parseWebFeatures(v any) schema.WebFeatureVisibility {
	flags := schema.AllVisibleWebFeatures()
	if m, ok := v.(map[string]any); ok {
		for key, raw := range m {
			if b, ok := raw.(bool); ok {
				if f := flags.Field(key); f != nil {
					*f = b
				}
			}
		}
	}
	if !flags.Any() {
		return schema.AllVisibleWebFeatures()
	}
	return flags
}

// miniProgramCodeAppID 对应 _mini_program_code_app_id：未配置的值回落到第一个已配置 AppID。
func miniProgramCodeAppID(v any) string {
	appIDs := configuredWechatAppIDs()
	if s, ok := v.(string); ok {
		for _, id := range appIDs {
			if id == s {
				return s
			}
		}
	}
	if len(appIDs) > 0 {
		return appIDs[0]
	}
	return ""
}

func configFromData(data map[string]any, version int64, updatedAt *time.Time, naive bool) *Config {
	return &Config{
		Endpoint:                       strOr(data["endpoint"], ""),
		APIKeyEncrypted:                strOr(data["api_key_encrypted"], ""),
		Model:                          strOr(data["model"], ""),
		Enabled:                        boolOr(data["enabled"], false),
		MiniProgramCodeEnv:             enumOr(data["mini_program_code_env"], domain.MiniProgramCodeEnv, domain.MiniProgramCodeEnvRelease),
		MiniProgramCodeAppID:           miniProgramCodeAppID(data["mini_program_code_app_id"]),
		MiniProgramRegistrationEnabled: boolOr(data["mini_program_registration_enabled"], true),
		MiniProgramNewUserEnabled:      boolOr(data["mini_program_new_user_enabled"], true),
		ImageAccelerationServerURL:     strOr(data["image_acceleration_server_url"], ""),
		InventoryMode:                  enumOr(data["inventory_mode"], domain.MiniProgramFeatureMode, domain.FeatureReadWrite),
		HuaxingInventoryMode:           enumOr(data["huaxing_inventory_mode"], domain.MiniProgramFeatureMode, domain.FeatureQueryOnly),
		PurchasePlansMode:              enumOr(data["purchase_plans_mode"], domain.MiniProgramFeatureMode, domain.FeatureQueryOnly),
		PurchaseRecordsMode:            enumOr(data["purchase_records_mode"], domain.MiniProgramFeatureMode, domain.FeatureQueryOnly),
		MaterialCodesMode:              enumOr(data["material_codes_mode"], domain.MiniProgramFeatureMode, domain.FeatureQueryOnly),
		HazardsMode:                    enumOr(data["hazards_mode"], domain.MiniProgramFeatureMode, domain.FeatureReadWrite),
		LedgerMode:                     enumOr(data["ledger_mode"], domain.MiniProgramFeatureMode, domain.FeatureQueryOnly),
		SecondaryWarehouseMode:         enumOr(data["secondary_warehouse_mode"], domain.SecondaryWarehouseMode, domain.SecondaryWarehouseFull),
		WebFeatures:                    parseWebFeatures(data["web_features"]),
		UpdatedAt:                      updatedAt,
		UpdatedNaive:                   naive,
		Version:                        version,
	}
}

// jsonObject 把 JSON 列解码为对象；不是对象时返回空 map（isinstance(..., dict) 判定）。
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

// GetSetting 对应 get_setting：未配置时返回 nil。
func GetSetting(s *db.Session) (*Config, error) {
	var row model.SystemSetting
	ok, err := s.Find(&row, "SELECT "+model.ColsSystemSetting+" FROM system_setting WHERE setting_key = ?", settingKey)
	if err != nil {
		return nil, err
	}
	if !ok {
		// 兼容旧部署：system_setting 尚为空时回退读取最后一条配置事件。
		var event model.BusinessEventLog
		found, err := s.Find(&event, "SELECT "+model.ColsBusinessEventLog+" FROM business_event_log WHERE business_type = ? AND business_id = ? AND action = ? ORDER BY id DESC LIMIT 1",
			settingBusinessType, settingBusinessID, settingAction)
		if err != nil {
			return nil, err
		}
		if !found {
			return nil, nil
		}
		occurred := event.OccurredAt
		return configFromData(jsonObject(event.AfterData), event.ID, &occurred, true), nil
	}
	updated := row.UpdatedAt
	return configFromData(jsonObject(row.SettingValue), row.Version, &updated, false), nil
}

func updatedAtValue(c *Config) any {
	if c.UpdatedAt == nil {
		return nil
	}
	if c.UpdatedNaive {
		return &jtype.NaiveTime{Time: *c.UpdatedAt}
	}
	t := jtype.NewUTC(*c.UpdatedAt)
	return &t
}

// SettingRead 对应 setting_read：解密回显 API Key。
func SettingRead(setting *Config) (schema.AiSearchSettingsRead, error) {
	if setting == nil {
		d := defaultConfig()
		d.MiniProgramCodeAppID = miniProgramCodeAppID(nil)
		return readFrom(d, ""), nil
	}
	apiKey := ""
	if setting.APIKeyEncrypted != "" {
		var err error
		if apiKey, err = decryptAPIKey(setting.APIKeyEncrypted); err != nil {
			return schema.AiSearchSettingsRead{}, err
		}
	}
	return readFrom(setting, apiKey), nil
}

func readFrom(c *Config, apiKey string) schema.AiSearchSettingsRead {
	return schema.AiSearchSettingsRead{
		Endpoint:                       c.Endpoint,
		APIKey:                         apiKey,
		Model:                          c.Model,
		Enabled:                        c.Enabled,
		MiniProgramCodeEnv:             c.MiniProgramCodeEnv,
		MiniProgramCodeAppID:           miniProgramCodeAppID(c.MiniProgramCodeAppID),
		MiniProgramAppIDs:              configuredWechatAppIDs(),
		MiniProgramRegistrationEnabled: c.MiniProgramRegistrationEnabled,
		MiniProgramNewUserEnabled:      c.MiniProgramNewUserEnabled,
		ImageAccelerationServerURL:     c.ImageAccelerationServerURL,
		InventoryMode:                  c.InventoryMode,
		HuaxingInventoryMode:           c.HuaxingInventoryMode,
		PurchasePlansMode:              c.PurchasePlansMode,
		PurchaseRecordsMode:            c.PurchaseRecordsMode,
		MaterialCodesMode:              c.MaterialCodesMode,
		HazardsMode:                    c.HazardsMode,
		LedgerMode:                     c.LedgerMode,
		SecondaryWarehouseMode:         c.SecondaryWarehouseMode,
		WebFeatures:                    c.WebFeatures,
		UpdatedAt:                      updatedAtValue(c),
		Version:                        c.Version,
	}
}

func statusText(enabled bool) *string {
	if enabled {
		return common.StrPtr("启用")
	}
	return common.StrPtr("停用")
}

// UpdateSetting 对应 update_setting：乐观锁校验 → 记事件 → upsert system_setting → 清空扩展缓存。
func UpdateSetting(s *db.Session, data schema.AiSearchSettingsUpdate) (*Config, error) {
	current, err := GetSetting(s)
	if err != nil {
		return nil, err
	}
	var actual int64
	if current != nil {
		actual = current.Version
	}
	if data.Version != actual {
		return nil, apperr.VersionConflict(data.Version, actual)
	}
	apiKeyEncrypted := ""
	if data.APIKey != "" {
		apiKeyEncrypted = security.EncryptSecret(data.APIKey)
	}
	codeAppID := miniProgramCodeAppID(strings.TrimSpace(data.MiniProgramCodeAppID))
	if data.MiniProgramCodeAppID != "" && codeAppID != data.MiniProgramCodeAppID {
		return nil, apperr.New("MINI_PROGRAM_APP_NOT_CONFIGURED", "所选微信小程序 AppID 未配置").
			WithStatus(400).
			WithDetails(apperr.D{"app_id": data.MiniProgramCodeAppID})
	}

	newVersion := actual + 1
	now := common.UTCNow()
	// 缺省（None）表示保持现状：只改其它字段的调用方不会把后台可见性重置成全显示。
	var webFeatures schema.WebFeatureVisibility
	switch {
	case data.WebFeatures != nil:
		webFeatures = normalizeWebFeatures(*data.WebFeatures)
	case current != nil:
		webFeatures = normalizeWebFeatures(current.WebFeatures)
	default:
		webFeatures = schema.AllVisibleWebFeatures()
	}
	next := &Config{
		Endpoint:                       strings.TrimRight(data.Endpoint, "/"),
		APIKeyEncrypted:                apiKeyEncrypted,
		Model:                          data.Model,
		Enabled:                        data.Enabled,
		MiniProgramCodeEnv:             data.MiniProgramCodeEnv,
		MiniProgramCodeAppID:           codeAppID,
		MiniProgramRegistrationEnabled: data.MiniProgramRegistrationEnabled,
		MiniProgramNewUserEnabled:      data.MiniProgramNewUserEnabled,
		ImageAccelerationServerURL:     data.ImageAccelerationServerURL,
		InventoryMode:                  data.InventoryMode,
		HuaxingInventoryMode:           data.HuaxingInventoryMode,
		PurchasePlansMode:              data.PurchasePlansMode,
		PurchaseRecordsMode:            data.PurchaseRecordsMode,
		MaterialCodesMode:              data.MaterialCodesMode,
		HazardsMode:                    data.HazardsMode,
		LedgerMode:                     data.LedgerMode,
		SecondaryWarehouseMode:         data.SecondaryWarehouseMode,
		WebFeatures:                    webFeatures,
		UpdatedAt:                      &now,
		Version:                        newVersion,
	}
	afterData := next.payload()
	var beforeData any
	if current != nil {
		beforeData = current.payload()
	}
	if err := common.LogEvent(s, settingBusinessType, settingBusinessID, settingAction, common.EventOptions{
		OldStatus:  statusText(current != nil && current.Enabled),
		NewStatus:  statusText(data.Enabled),
		Remark:     common.StrPtr("超级管理员更新高级设置"),
		BeforeData: beforeData,
		AfterData:  afterData,
	}); err != nil {
		return nil, err
	}
	value, err := jtype.ToJSON(afterData)
	if err != nil {
		return nil, err
	}
	var exists int
	found, err := s.Find(&exists, "SELECT 1 FROM system_setting WHERE setting_key = ?", settingKey)
	if err != nil {
		return nil, err
	}
	if found {
		_, err = s.Exec("UPDATE system_setting SET setting_value = ?, version = ?, updated_at = ? WHERE setting_key = ?", value, newVersion, now, settingKey)
	} else {
		_, err = s.Exec("INSERT INTO system_setting (setting_key, setting_value, version, updated_at) VALUES (?, ?, ?, ?)", settingKey, value, newVersion, now)
	}
	if err != nil {
		return nil, err
	}
	clearCache()
	return next, nil
}

// normalizeWebFeatures 对应 _web_features(model_dump())：全 False 归一到全显示。
func normalizeWebFeatures(w schema.WebFeatureVisibility) schema.WebFeatureVisibility {
	if !w.Any() {
		return schema.AllVisibleWebFeatures()
	}
	return w
}

// GetMiniProgramCodeEnv 对应 get_mini_program_code_env。
func GetMiniProgramCodeEnv(s *db.Session) (string, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return "", err
	}
	if setting == nil {
		return domain.MiniProgramCodeEnvRelease, nil
	}
	return setting.MiniProgramCodeEnv, nil
}

// GetMiniProgramCodeAppID 对应 get_mini_program_code_app_id：所选 AppID（校验微信凭证配置）。
func GetMiniProgramCodeAppID(s *db.Session) (string, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return "", err
	}
	var selected string
	if setting != nil {
		selected = miniProgramCodeAppID(setting.MiniProgramCodeAppID)
	} else {
		selected = miniProgramCodeAppID(nil)
	}
	appID, _, err := getWechatCredentials(selected)
	return appID, err
}

// IsMiniProgramRegistrationEnabled 对应 is_mini_program_registration_enabled。
func IsMiniProgramRegistrationEnabled(s *db.Session) (bool, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return false, err
	}
	return setting == nil || setting.MiniProgramRegistrationEnabled, nil
}

// IsMiniProgramNewUserEnabled 对应 is_mini_program_new_user_enabled。
func IsMiniProgramNewUserEnabled(s *db.Session) (bool, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return false, err
	}
	return setting == nil || setting.MiniProgramNewUserEnabled, nil
}

// GetImageAccelerationServerURL 对应 get_image_acceleration_server_url。
func GetImageAccelerationServerURL(s *db.Session) (string, error) {
	setting, err := GetSetting(s)
	if err != nil || setting == nil {
		return "", err
	}
	return setting.ImageAccelerationServerURL, nil
}

// GetMiniProgramFeatures 对应 get_mini_program_features。
func GetMiniProgramFeatures(s *db.Session) (schema.MiniProgramFeaturesRead, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return schema.MiniProgramFeaturesRead{}, err
	}
	if setting == nil {
		setting = defaultConfig()
	}
	return schema.MiniProgramFeaturesRead{
		InventoryMode:          setting.InventoryMode,
		HuaxingInventoryMode:   setting.HuaxingInventoryMode,
		PurchasePlansMode:      setting.PurchasePlansMode,
		PurchaseRecordsMode:    setting.PurchaseRecordsMode,
		MaterialCodesMode:      setting.MaterialCodesMode,
		HazardsMode:            setting.HazardsMode,
		LedgerMode:             setting.LedgerMode,
		SecondaryWarehouseMode: setting.SecondaryWarehouseMode,
		WebFeatures:            setting.WebFeatures,
	}, nil
}

// IsAvailable 对应 is_available：已启用且配置了 API Key。
func IsAvailable(s *db.Session) (bool, error) {
	setting, err := GetSetting(s)
	if err != nil {
		return false, err
	}
	return setting != nil && setting.Enabled && setting.APIKeyEncrypted != "", nil
}
