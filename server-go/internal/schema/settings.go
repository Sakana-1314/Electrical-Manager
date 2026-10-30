package schema

import (
	"encoding/json"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ---------------- 后台主 tab 可见性 ----------------

// WebFeatureVisibility 管理端侧栏主 tab 的可见性开关（缺省即显示）。
type WebFeatureVisibility struct {
	Dashboard        bool `json:"dashboard"`
	Memos            bool `json:"memos"`
	Warehouse        bool `json:"warehouse"`
	HuaxingInventory bool `json:"huaxing_inventory"`
	Procurement      bool `json:"procurement"`
	Hazards          bool `json:"hazards"`
	Ledger           bool `json:"ledger"`
	Work             bool `json:"work"`
}

// AllVisibleWebFeatures 全部显示（WebFeatureVisibility() 的默认值）。
func AllVisibleWebFeatures() WebFeatureVisibility {
	return WebFeatureVisibility{true, true, true, true, true, true, true, true}
}

// WebFeatureKeys 已声明的键（与字段顺序一致）。
var WebFeatureKeys = []string{"dashboard", "memos", "warehouse", "huaxing_inventory", "procurement", "hazards", "ledger", "work"}

// Field 返回键对应字段的指针（未知键返回 nil）。
func (w *WebFeatureVisibility) Field(key string) *bool {
	switch key {
	case "dashboard":
		return &w.Dashboard
	case "memos":
		return &w.Memos
	case "warehouse":
		return &w.Warehouse
	case "huaxing_inventory":
		return &w.HuaxingInventory
	case "procurement":
		return &w.Procurement
	case "hazards":
		return &w.Hazards
	case "ledger":
		return &w.Ledger
	case "work":
		return &w.Work
	}
	return nil
}

// Any 是否至少有一个为 true。
func (w WebFeatureVisibility) Any() bool {
	return w.Dashboard || w.Memos || w.Warehouse || w.HuaxingInventory || w.Procurement || w.Hazards || w.Ledger || w.Work
}

// ---------------- AI 搜索 / 高级设置 ----------------

type AiSearchSettingsRead struct {
	Endpoint                       string               `json:"endpoint"`
	APIKey                         string               `json:"api_key"`
	Model                          string               `json:"model"`
	Enabled                        bool                 `json:"enabled"`
	MiniProgramCodeEnv             string               `json:"mini_program_code_env"`
	MiniProgramCodeAppID           string               `json:"mini_program_code_app_id"`
	MiniProgramAppIDs              []string             `json:"mini_program_app_ids"`
	MiniProgramRegistrationEnabled bool                 `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool                 `json:"mini_program_new_user_enabled"`
	ImageAccelerationServerURL     string               `json:"image_acceleration_server_url"`
	InventoryMode                  string               `json:"inventory_mode"`
	HuaxingInventoryMode           string               `json:"huaxing_inventory_mode"`
	PurchasePlansMode              string               `json:"purchase_plans_mode"`
	PurchaseRecordsMode            string               `json:"purchase_records_mode"`
	MaterialCodesMode              string               `json:"material_codes_mode"`
	HazardsMode                    string               `json:"hazards_mode"`
	LedgerMode                     string               `json:"ledger_mode"`
	SecondaryWarehouseMode         string               `json:"secondary_warehouse_mode"`
	WebFeatures                    WebFeatureVisibility `json:"web_features"`
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
	InventoryMode                  string `json:"inventory_mode" v:"oneof=disabled|query_only|read_write"`
	HuaxingInventoryMode           string `json:"huaxing_inventory_mode" v:"oneof=disabled|query_only|read_write"`
	PurchasePlansMode              string `json:"purchase_plans_mode" v:"oneof=disabled|query_only|read_write"`
	PurchaseRecordsMode            string `json:"purchase_records_mode" v:"oneof=disabled|query_only|read_write"`
	MaterialCodesMode              string `json:"material_codes_mode" v:"oneof=disabled|query_only|read_write"`
	HazardsMode                    string `json:"hazards_mode" v:"oneof=disabled|query_only|read_write"`
	LedgerMode                     string `json:"ledger_mode" v:"oneof=disabled|query_only|read_write"`
	SecondaryWarehouseMode         string `json:"secondary_warehouse_mode" v:"oneof=full|lite"`
	// WebFeaturesRaw 原始 JSON（WebFeatureVisibility 是宽松 BaseModel：未知键忽略），在 Validate 中解析。
	WebFeaturesRaw json.RawMessage `json:"web_features"`
	Version        int64           `json:"version" v:"required,ge=0"`

	// WebFeatures 解析结果：nil 表示省略或 null（保持现状）。
	WebFeatures *WebFeatureVisibility `json:"-"`

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
		InventoryMode:                  "read_write",
		HuaxingInventoryMode:           "query_only",
		PurchasePlansMode:              "query_only",
		PurchaseRecordsMode:            "query_only",
		MaterialCodesMode:              "query_only",
		HazardsMode:                    "read_write",
		LedgerMode:                     "query_only",
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
// model_validator(require_enabled_model_config)，并解析 web_features。
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
	wf, wfErrs := parseWebFeatures(u.WebFeaturesRaw, joinLoc(loc, "web_features"))
	errs = append(errs, wfErrs...)
	if len(errs) > 0 {
		return errs
	}
	u.WebFeatures = wf
	u.missingModelConfig = u.Enabled && !(u.Endpoint != "" && u.APIKey != "" && u.Model != "")
	return nil
}

// parseWebFeatures 按 WebFeatureVisibility(BaseModel) 的宽松语义解析：null → nil；
// 未知键忽略；已知键按 Pydantic lax 布尔规则解析。
func parseWebFeatures(raw json.RawMessage, loc []any) (*WebFeatureVisibility, []web.FieldError) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		return nil, nil
	}
	var generic any
	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.UseNumber()
	_ = dec.Decode(&generic) // 请求体整体已是合法 JSON
	obj, ok := generic.(map[string]any)
	if !ok {
		return nil, []web.FieldError{{Type: "model_attributes_type", Loc: loc, Msg: "Input should be a valid dictionary or object to extract fields from", Input: normalizeInput(generic)}}
	}
	out := AllVisibleWebFeatures()
	var errs []web.FieldError
	for _, key := range WebFeatureKeys {
		in, present := obj[key]
		if !present {
			continue
		}
		b, typ := laxBool(in)
		if typ != "" {
			msg := "Input should be a valid boolean"
			if typ == "bool_parsing" {
				msg = "Input should be a valid boolean, unable to interpret input"
			}
			errs = append(errs, web.FieldError{Type: typ, Loc: joinLoc(loc, key), Msg: msg, Input: normalizeInput(in)})
			continue
		}
		*out.Field(key) = b
	}
	if len(errs) > 0 {
		return nil, errs
	}
	return &out, nil
}

// normalizeInput 把 json.Number 还原成数字输出。
func normalizeInput(v any) any {
	if n, ok := v.(json.Number); ok {
		if i, err := n.Int64(); err == nil {
			return i
		}
		if f, err := n.Float64(); err == nil {
			return f
		}
	}
	return v
}

func laxBool(in any) (bool, string) {
	switch x := in.(type) {
	case bool:
		return x, ""
	case json.Number:
		switch x.String() {
		case "0", "0.0":
			return false, ""
		case "1", "1.0":
			return true, ""
		}
		return false, "bool_parsing"
	case string:
		if b, ok := web.ParseBoolString(x); ok {
			return b, ""
		}
		return false, "bool_parsing"
	}
	return false, "bool_type"
}

type AiSearchStatusRead struct {
	Available bool `json:"available"`
}

type ImageAccelerationSettingsRead struct {
	ImageAccelerationServerURL string `json:"image_acceleration_server_url"`
}

// MiniProgramFeaturesRead 公开功能开关：小程序端档位 + 后台主 tab 可见性。
type MiniProgramFeaturesRead struct {
	InventoryMode          string               `json:"inventory_mode"`
	HuaxingInventoryMode   string               `json:"huaxing_inventory_mode"`
	PurchasePlansMode      string               `json:"purchase_plans_mode"`
	PurchaseRecordsMode    string               `json:"purchase_records_mode"`
	MaterialCodesMode      string               `json:"material_codes_mode"`
	HazardsMode            string               `json:"hazards_mode"`
	LedgerMode             string               `json:"ledger_mode"`
	SecondaryWarehouseMode string               `json:"secondary_warehouse_mode"`
	WebFeatures            WebFeatureVisibility `json:"web_features"`
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
