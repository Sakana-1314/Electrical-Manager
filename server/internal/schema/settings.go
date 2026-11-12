package schema

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ---------------- AI 搜索 / 高级设置 ----------------

type AiSearchSettingsRead struct {
	Endpoint                       string   `json:"endpoint"`
	APIKey                         string   `json:"api_key"`
	Model                          string   `json:"model"`
	Enabled                        bool     `json:"enabled"`
	MiniProgramCodeEnv             string   `json:"mini_program_code_env"`
	MiniProgramCodeAppID           string   `json:"mini_program_code_app_id"`
	MiniProgramAppIDs              []string `json:"mini_program_app_ids"`
	MiniProgramRegistrationEnabled bool     `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool     `json:"mini_program_new_user_enabled"`
	ImageAccelerationServerURL     string   `json:"image_acceleration_server_url"`
	SecondaryWarehouseMode         string   `json:"secondary_warehouse_mode"`
	// UpdatedAt 是未标注时区的 datetime：system_setting 行读出的是 aware（*jtype.UTCTime），
	// 旧部署回退读取事件日志时是 naive（*jtype.NaiveTime）；nil 输出 null。
	UpdatedAt any   `json:"updated_at"`
	Version   int64 `json:"version"`
}

// AiSearchSettingsUpdate 对应 AiSearchSettingsUpdate（调用方预填 NewAiSearchSettingsUpdate 的默认值）。
type AiSearchSettingsUpdate struct {
	Endpoint                       string `json:"endpoint" v:"max=500"`
	APIKey                         string `json:"api_key" v:"max=1000"`
	Model                          string `json:"model" v:"max=128"`
	Enabled                        bool   `json:"enabled"`
	MiniProgramCodeEnv             string `json:"mini_program_code_env" v:"oneof=trial|release"`
	MiniProgramCodeAppID           string `json:"mini_program_code_app_id" v:"max=64"`
	MiniProgramRegistrationEnabled bool   `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool   `json:"mini_program_new_user_enabled"`
	ImageAccelerationServerURL     string `json:"image_acceleration_server_url" v:"max=500"`
	SecondaryWarehouseMode         string `json:"secondary_warehouse_mode" v:"oneof=full|lite"`
	Version                        int64  `json:"version" v:"required,ge=0"`

	missingModelConfig bool
}

// EnabledConfigError 是 model_validator(require_enabled_model_config) 的提示文案。
const EnabledConfigError = "启用模型服务时必须填写端点、模型和 API Key"

// MissingModelConfig 字段校验全部通过、但启用时缺少端点 / 模型 / API Key（model_validator 失败）。
// 由处理函数用原始请求体作为 input 补报错误（Pydantic 的 model 级错误 input 是整个请求体）。
func (u *AiSearchSettingsUpdate) MissingModelConfig() bool { return u.missingModelConfig }

// NewAiSearchSettingsUpdate 返回填好 Pydantic 默认值的请求体。
func NewAiSearchSettingsUpdate() AiSearchSettingsUpdate {
	return AiSearchSettingsUpdate{
		Enabled:                        true,
		MiniProgramCodeEnv:             "release",
		MiniProgramRegistrationEnabled: true,
		MiniProgramNewUserEnabled:      true,
		SecondaryWarehouseMode:         "full",
	}
}

func hasHTTPScheme(s string) bool {
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://")
}

func joinLoc(loc []any, k ...any) []any {
	out := append([]any{}, loc...)
	return append(out, k...)
}

// Validate 复刻 field_validator(endpoint / image_acceleration_server_url) 与
// model_validator(require_enabled_model_config)。
func (u *AiSearchSettingsUpdate) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	if u.Endpoint != "" && !hasHTTPScheme(u.Endpoint) {
		errs = append(errs, web.ValueError(joinLoc(loc, "endpoint"), "端点必须使用 http:// 或 https://", u.Endpoint))
	}
	rawImageURL := u.ImageAccelerationServerURL
	u.ImageAccelerationServerURL = strings.TrimRight(u.ImageAccelerationServerURL, "/")
	if u.ImageAccelerationServerURL != "" && !hasHTTPScheme(u.ImageAccelerationServerURL) {
		errs = append(errs, web.ValueError(joinLoc(loc, "image_acceleration_server_url"), "图片加速服务器必须使用 http:// 或 https://", rawImageURL))
	}
	if len(errs) > 0 {
		return errs
	}
	u.missingModelConfig = u.Enabled && !(u.Endpoint != "" && u.APIKey != "" && u.Model != "")
	return nil
}

type AiSearchStatusRead struct {
	Available bool `json:"available"`
}

type ImageAccelerationSettingsRead struct {
	ImageAccelerationServerURL string `json:"image_acceleration_server_url"`
}

// MiniProgramFeaturesRead 公开运行模式：小程序与网页端共用的二级库完整 / 精简模式。
// 功能是否展示与可写不再由配置决定：管理端与小程序端都按 app_user.permissions 权限位判断。
type MiniProgramFeaturesRead struct {
	SecondaryWarehouseMode string `json:"secondary_warehouse_mode"`
}

type AiSearchExpandRequest struct {
	Value string `json:"value" v:"required,min=1,max=500"`
}

type AiSearchExpandRead struct {
	Original string `json:"original"`
	Expanded string `json:"expanded"`
}

type AiSearchTestRead struct {
	Original string `json:"original"`
	Expanded string `json:"expanded"`
}

type AiSearchTestRequest struct {
	Endpoint string `json:"endpoint" v:"required,max=500"`
	APIKey   string `json:"api_key" v:"required,max=1000"`
	Model    string `json:"model" v:"required,max=128"`
}

// Validate 复刻 validate_endpoint（去尾部 /、要求 http(s)）与 require_value（不能为空）。
func (t *AiSearchTestRequest) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	t.Endpoint = strings.TrimRight(t.Endpoint, "/")
	if !hasHTTPScheme(t.Endpoint) {
		errs = append(errs, web.ValueError(joinLoc(loc, "endpoint"), "端点必须使用 http:// 或 https://", t.Endpoint))
	}
	if t.APIKey == "" {
		errs = append(errs, web.ValueError(joinLoc(loc, "api_key"), "不能为空", t.APIKey))
	}
	if t.Model == "" {
		errs = append(errs, web.ValueError(joinLoc(loc, "model"), "不能为空", t.Model))
	}
	return errs
}

// ---------------- Webhook ----------------

type WebhookChannelRead struct {
	Platform          string         `json:"platform"`
	Enabled           bool           `json:"enabled"`
	SubscribedEvents  []string       `json:"subscribed_events"`
	WebhookURL        string         `json:"webhook_url"`
	Secret            string         `json:"secret"`
	WebhookConfigured bool           `json:"webhook_configured"`
	SecretConfigured  bool           `json:"secret_configured"`
	UpdatedAt         *jtype.UTCTime `json:"updated_at"`
	Version           int64          `json:"version"`
}

type WebhookChannelUpdate struct {
	Enabled          bool     `json:"enabled"`
	WebhookURL       string   `json:"webhook_url" v:"max=2000"`
	Secret           string   `json:"secret" v:"max=1000"`
	SubscribedEvents []string `json:"subscribed_events" v:"max=3,unique=subscribed_events,itemoneof=stock.outbound.created|stock.inbound.created|mini_program.user.bound"`
	Version          int64    `json:"version" v:"required,ge=0"`
}

type WebhookTestRead struct {
	Platform string `json:"platform"`
	Success  bool   `json:"success"`
	Message  string `json:"message"`
}

type WebhookTestRequest struct {
	WebhookURL string `json:"webhook_url" v:"required,max=2000"`
	Secret     string `json:"secret" v:"max=1000"`
}
