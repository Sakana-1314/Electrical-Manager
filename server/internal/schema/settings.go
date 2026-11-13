package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// ---------------- 高级设置（管理端仅保留开关与默认权限） ----------------

// AdvancedSettingsRead 管理端高级设置：小程序注册开关 + 默认用户权限。
// 模型服务、Webhook、图片加速都不再由管理端配置（分别走服务端环境变量或已移除）；
// 标准二级库与精简二级库不再有运行模式，可见性由各权限位决定。
type AdvancedSettingsRead struct {
	MiniProgramRegistrationEnabled bool           `json:"mini_program_registration_enabled"`
	DefaultPermissions             []string       `json:"default_permissions"`
	UpdatedAt                      *jtype.UTCTime `json:"updated_at"`
	Version                        int64          `json:"version"`
}

// AdvancedSettingsUpdate 保存高级设置（全量提交，version 为乐观锁）。
type AdvancedSettingsUpdate struct {
	MiniProgramRegistrationEnabled bool      `json:"mini_program_registration_enabled"`
	DefaultPermissions             *[]string `json:"default_permissions"`
	Version                        int64     `json:"version" v:"required,ge=0"`
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
