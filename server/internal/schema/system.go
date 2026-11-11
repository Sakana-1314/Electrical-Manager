package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// ---------------- 用户 / 认证 ----------------

// UserRoleRead 是用户读取里内嵌的角色摘要。
type UserRoleRead struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	IsSystem bool   `json:"is_system"`
}

// RoleRead 是角色（RBAC）。permissions 为权限键数组（已排序），user_count 为挂载的用户数。
type RoleRead struct {
	ID          int64         `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Permissions []string      `json:"permissions"`
	IsSystem    bool          `json:"is_system"`
	UserCount   int64         `json:"user_count"`
	CreatedAt   jtype.UTCTime `json:"created_at"`
	UpdatedAt   jtype.UTCTime `json:"updated_at"`
	Version     int64         `json:"version"`
}

// RoleCreate 新建角色。
type RoleCreate struct {
	Name        string   `json:"name" v:"required,min=1,max=64"`
	Description string   `json:"description" v:"max=255"`
	Permissions []string `json:"permissions"`
}

// RoleUpdate 编辑角色（内置角色不可编辑）。
type RoleUpdate struct {
	Name        *string   `json:"name" v:"min=1,max=64"`
	Description *string   `json:"description" v:"max=255"`
	Permissions *[]string `json:"permissions"`
	Version     int64     `json:"version" v:"required"`
}

// UserRead 是管理端用户。roles 为挂载的角色（多角色，权限取并集）；permissions 为并集展开后的
// 权限键（登录 / me 路径填充，用户列表为空——前端编辑角色用 roles）；source 区分管理端 / 小程序来源。
type UserRead struct {
	ID             int64          `json:"id"`
	Username       string         `json:"username"`
	DisplayName    string         `json:"display_name"`
	DepartmentName string         `json:"department_name"`
	Source         string         `json:"source"`
	Roles          []UserRoleRead `json:"roles"`
	Permissions    []string       `json:"permissions"`
	Enabled        bool           `json:"enabled"`
	Version        int64          `json:"version"`
}

func NewUserRead(u *model.User) UserRead {
	return UserRead{ID: u.ID, Username: u.Username, DisplayName: u.DisplayName, DepartmentName: u.DepartmentName, Source: u.Source, Enabled: u.Enabled, Version: u.Version, Permissions: []string{}}
}

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
	Username       string  `json:"username" v:"required,min=3,max=64"`
	Password       string  `json:"password" v:"required,min=6,max=128"`
	DisplayName    string  `json:"display_name" v:"required,min=1,max=128"`
	DepartmentName string  `json:"department_name" v:"max=128"`
	RoleIDs        []int64 `json:"role_ids"`
	Enabled        bool    `json:"enabled"`
}

type UserUpdate struct {
	Username       *string  `json:"username" v:"min=3,max=64"`
	DisplayName    *string  `json:"display_name" v:"min=1,max=128"`
	DepartmentName *string  `json:"department_name" v:"max=128"`
	Password       *string  `json:"password" v:"min=6,max=128"`
	RoleIDs        *[]int64 `json:"role_ids"`
	Enabled        *bool    `json:"enabled"`
	Version        int64    `json:"version" v:"required"`
}

type UserApiTokenRegenerate struct {
	Version int64 `json:"version" v:"required"`
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
