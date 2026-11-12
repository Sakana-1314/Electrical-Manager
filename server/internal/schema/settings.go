package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// ---------------- 高级设置（管理端仅保留开关） ----------------

// AdvancedSettingsRead 管理端高级设置：小程序注册开关、新用户默认状态、二级库运行模式。
// 模型服务、Webhook、图片加速都不再由管理端配置（分别走服务端环境变量或已移除）。
type AdvancedSettingsRead struct {
	MiniProgramRegistrationEnabled bool           `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool           `json:"mini_program_new_user_enabled"`
	SecondaryWarehouseMode         string         `json:"secondary_warehouse_mode"`
	UpdatedAt                      *jtype.UTCTime `json:"updated_at"`
	Version                        int64          `json:"version"`
}

// AdvancedSettingsUpdate 保存高级设置（全量提交，version 为乐观锁）。
type AdvancedSettingsUpdate struct {
	MiniProgramRegistrationEnabled bool   `json:"mini_program_registration_enabled"`
	MiniProgramNewUserEnabled      bool   `json:"mini_program_new_user_enabled"`
	SecondaryWarehouseMode         string `json:"secondary_warehouse_mode" v:"oneof=full|lite"`
	Version                        int64  `json:"version" v:"required,ge=0"`
}

// ---------------- AI 搜索（只读状态与扩展） ----------------

type AiSearchStatusRead struct {
	Available bool `json:"available"`
}

type AiSearchExpandRequest struct {
	Value string `json:"value" v:"required,min=1,max=500"`
}

type AiSearchExpandRead struct {
	Original string `json:"original"`
	Expanded string `json:"expanded"`
}

// ---------------- 小程序公开运行模式 ----------------

// MiniProgramFeaturesRead 公开运行模式：小程序与网页端共用的二级库完整 / 精简模式。
// 功能是否展示与可写由 app_user.permissions 权限位决定。
type MiniProgramFeaturesRead struct {
	SecondaryWarehouseMode string `json:"secondary_warehouse_mode"`
}
