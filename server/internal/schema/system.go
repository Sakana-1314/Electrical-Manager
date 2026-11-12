package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// ---------------- 用户 / 认证 ----------------

// UserMergeRequest 把 source 账号并入路径里的 target 账号：目标保留姓名 / 部门，
// 来源账号的微信身份随迁、权限位按位或取并集，来源账号随后删除。
type UserMergeRequest struct {
	SourceUserID  int64 `json:"source_user_id" v:"required,gt=0"`
	SourceVersion int64 `json:"source_version" v:"required"`
	TargetVersion int64 `json:"target_version" v:"required"`
}

// UserRead 是管理端用户。permissions 是权限位展开后的权限键（按目录顺序），
// 管理端与小程序端共用同一套权限位；source 区分管理端 / 小程序来源。
type UserRead struct {
	ID             int64          `json:"id"`
	Username       string         `json:"username"`
	DisplayName    string         `json:"display_name"`
	DepartmentName string         `json:"department_name"`
	Source         string         `json:"source"`
	Permissions    []string       `json:"permissions"`
	WechatOpenid   *string        `json:"wechat_openid"`
	LastUsedAt     *jtype.UTCTime `json:"last_used_at"`
	Enabled        bool           `json:"enabled"`
	Version        int64          `json:"version"`
}

func NewUserRead(u *model.User) UserRead {
	var lastUsed *jtype.UTCTime
	if u.LastUsedAt != nil {
		lastUsed = ptr(jtype.NewUTC(*u.LastUsedAt))
	}
	return UserRead{ID: u.ID, Username: u.Username, DisplayName: u.DisplayName, DepartmentName: u.DepartmentName,
		Source: u.Source, Permissions: domain.Permission(u.Permissions).Normalize().Keys(), LastUsedAt: lastUsed,
		Enabled: u.Enabled, Version: u.Version}
}

func ptr[T any](v T) *T { return &v }

type UserApiTokenRead struct {
	UserRead
	APIToken *string `json:"api_token"`
}

type LoginRequest struct {
	Username string `json:"username" v:"required,min=1"`
	Password string `json:"password" v:"required,min=1,max=128"`
}

type LoginResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	TokenType    string   `json:"token_type"`
	User         UserRead `json:"user"`
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" v:"required,min=1,max=4096"`
}

type TokenPairResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
}

type UserCreate struct {
	Username       string   `json:"username" v:"required,min=3,max=64"`
	Password       string   `json:"password" v:"required,min=6,max=128"`
	DisplayName    string   `json:"display_name" v:"required,min=1,max=128"`
	DepartmentName string   `json:"department_name" v:"max=128"`
	Permissions    []string `json:"permissions"`
	Enabled        bool     `json:"enabled"`
}

type UserUpdate struct {
	Username       *string   `json:"username" v:"min=3,max=64"`
	DisplayName    *string   `json:"display_name" v:"min=1,max=128"`
	DepartmentName *string   `json:"department_name" v:"max=128"`
	Password       *string   `json:"password" v:"min=6,max=128"`
	Permissions    *[]string `json:"permissions"`
	Enabled        *bool     `json:"enabled"`
	Version        int64     `json:"version" v:"required"`
}

type UserApiTokenRegenerate struct {
	Version int64 `json:"version" v:"required"`
}

// PermissionRead 权限目录项：key 是接口里的权限键，bit 是位图里的数值（int 按位判断）。
type PermissionRead struct {
	Key    string `json:"key"`
	Module string `json:"module"`
	Action string `json:"action"`
	Label  string `json:"label"`
	Bit    int64  `json:"bit"`
}

// PermissionCatalogRead 全部权限位（顺序即用户管理界面的展示顺序）。
func PermissionCatalogRead() []PermissionRead {
	out := make([]PermissionRead, len(domain.PermissionCatalog))
	for i, def := range domain.PermissionCatalog {
		out[i] = PermissionRead{Key: def.Key, Module: def.Module, Action: def.Action, Label: def.Label, Bit: int64(def.Bit)}
	}
	return out
}

// ---------------- 项目 ----------------

type ProjectRead struct {
	ID        int64         `json:"id"`
	Name      string        `json:"name"`
	Enabled   bool          `json:"enabled"`
	IsDefault bool          `json:"is_default"`
	Remark    *string       `json:"remark"`
	CreatedAt jtype.UTCTime `json:"created_at"`
	UpdatedAt jtype.UTCTime `json:"updated_at"`
	Version   int64         `json:"version"`
}

func NewProjectRead(p *model.Project) ProjectRead {
	return ProjectRead{ID: p.ID, Name: p.Name, Enabled: p.Enabled, IsDefault: p.IsDefault, Remark: p.Remark,
		CreatedAt: jtype.NewUTC(p.CreatedAt), UpdatedAt: jtype.NewUTC(p.UpdatedAt), Version: p.Version}
}

type ProjectCreate struct {
	Name      string  `json:"name" v:"required,min=1,max=128"`
	Enabled   bool    `json:"enabled"`
	IsDefault bool    `json:"is_default"`
	Remark    *string `json:"remark" v:"max=500"`
}

type ProjectUpdate struct {
	Name      *string `json:"name" v:"min=1,max=128"`
	Enabled   *bool   `json:"enabled"`
	IsDefault *bool   `json:"is_default"`
	Remark    *string `json:"remark" v:"max=500"`
	Version   int64   `json:"version" v:"required"`
}

// ---------------- 备忘录 ----------------

const MemoContentMaxLength = 10000

type MemoRead struct {
	ID        int64         `json:"id"`
	Title     string        `json:"title"`
	Content   string        `json:"content"`
	CreatedAt jtype.UTCTime `json:"created_at"`
	UpdatedAt jtype.UTCTime `json:"updated_at"`
	Version   int64         `json:"version"`
}

func NewMemoRead(m *model.Memo) MemoRead {
	return MemoRead{ID: m.ID, Title: m.Title, Content: m.Content, CreatedAt: jtype.NewUTC(m.CreatedAt), UpdatedAt: jtype.NewUTC(m.UpdatedAt), Version: m.Version}
}

type MemoCreate struct {
	Title   string `json:"title" v:"max=64"`
	Content string `json:"content" v:"max=10000"`
}

type MemoUpdate struct {
	Title   *string `json:"title" v:"max=64"`
	Content *string `json:"content" v:"max=10000"`
	Version int64   `json:"version" v:"required"`
}

// ---------------- 版本 ----------------

type VersionInfoRead struct {
	AppName   string  `json:"app_name"`
	Version   string  `json:"version"`
	Commit    *string `json:"commit"`
	BuildTime *string `json:"build_time"`
}
