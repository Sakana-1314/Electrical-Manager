// Package auth 对应原 core/permissions.py：管理端 / 小程序鉴权、权限校验（RBAC）、项目上下文依赖。
package auth

import (
	"strconv"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const (
	keyMiniUser    = "auth.mini_user"
	keyRegAppID    = "auth.reg_app_id"
	keyRegOpenID   = "auth.reg_openid"
	keyProjectDone = "auth.project_resolved"
	keyPermissions = "auth.permissions"
)

// bearerToken 复刻 FastAPI HTTPBearer(auto_error=False)：返回 Bearer 凭证，不是 Bearer 时为 ""。
func bearerToken(c *web.Ctx) string {
	authz := c.GetHeader("Authorization")
	if authz == "" {
		return ""
	}
	scheme, param, _ := strings.Cut(authz, " ")
	if scheme == "" || param == "" {
		return ""
	}
	if strings.ToLower(scheme) != "bearer" {
		return ""
	}
	return param
}

// MarkLastUsed 登录成功后刷新最近使用时间：网页密码登录与小程序登录共用。
// 刻意不自增 version（登录不改变用户资料，乐观锁只保护管理端编辑）。
func MarkLastUsed(s *db.Session, u *model.User) error {
	now := time.Now().UTC()
	if _, err := s.Exec("UPDATE app_user SET last_used_at = ?, updated_at = ? WHERE id = ?", now, now, u.ID); err != nil {
		return err
	}
	u.LastUsedAt = &now
	u.UpdatedAt = now
	return nil
}

// GetUser 按主键读取管理端用户（不存在返回 nil）。
func GetUser(s *db.Session, id int64) (*model.User, error) {
	var u model.User
	ok, err := s.Find(&u, "SELECT "+model.ColsUser+" FROM app_user WHERE id = ?", id)
	if err != nil || !ok {
		return nil, err
	}
	return &u, nil
}

// FindUserByAPIToken 按令牌哈希查找用户；旧数据只有哈希时顺手加密回写密文（懒迁移）。
func FindUserByAPIToken(s *db.Session, token string) (*model.User, error) {
	if len([]rune(token)) != 36 {
		return nil, nil
	}
	var u model.User
	ok, err := s.Find(&u, "SELECT "+model.ColsUser+" FROM app_user WHERE api_token_hash = ?", security.SHA256Hex(token))
	if err != nil || !ok {
		return nil, err
	}
	if u.APITokenEnc == "" {
		u.APITokenEnc = security.EncryptSecret(token)
		if _, err := s.Exec("UPDATE app_user SET api_token_enc = ? WHERE id = ?", u.APITokenEnc, u.ID); err != nil {
			return nil, err
		}
	}
	return &u, nil
}

func authenticateAPIToken(c *web.Ctx, token string) (*model.User, error) {
	u, err := FindUserByAPIToken(c.DB, token)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperr.New("INVALID_TOKEN", "接口令牌无效").WithStatus(401)
	}
	if !u.Enabled {
		return nil, apperr.New("USER_DISABLED", "用户不存在或已停用").WithStatus(401)
	}
	return u, nil
}

// AuthenticateManagementUser 支持 X-API-Token、Bearer 接口令牌（≤36 字符）与 Bearer JWT。
func AuthenticateManagementUser(c *web.Ctx) (*model.User, error) {
	apiToken := c.GetHeader("X-API-Token")
	if apiToken != "" {
		return authenticateAPIToken(c, apiToken)
	}
	raw := bearerToken(c)
	if raw == "" {
		return nil, apperr.New("UNAUTHORIZED", "请先登录").WithStatus(401)
	}
	if len([]rune(raw)) <= 36 {
		u, err := authenticateAPIToken(c, raw)
		if err == nil {
			return u, nil
		}
		if ae, ok := err.(*apperr.Error); !ok || ae.Code == "USER_DISABLED" {
			return nil, err
		}
	}
	invalid := apperr.New("INVALID_TOKEN", "登录凭证或接口令牌无效").WithStatus(401)
	claims, err := security.DecodeAccessToken(raw)
	if err != nil {
		return nil, invalid
	}
	if tt, ok := claims["token_type"]; ok && tt != nil {
		s, isStr := tt.(string)
		if !isStr || (s != "management" && s != "management_access") {
			return nil, invalid
		}
	}
	userID, ok := security.ClaimInt(claims, "sub")
	if !ok {
		return nil, invalid
	}
	u, err := GetUser(c.DB, userID)
	if err != nil {
		return nil, err
	}
	if u == nil || !u.Enabled {
		return nil, apperr.New("USER_DISABLED", "用户不存在或已停用").WithStatus(401)
	}
	return u, nil
}

// CurrentUser 依赖：管理端登录用户（同一请求内只解析一次）。
func CurrentUser(c *web.Ctx) error {
	if _, ok := c.User.(*model.User); ok {
		return nil
	}
	u, err := AuthenticateManagementUser(c)
	if err != nil {
		return err
	}
	c.User = u
	c.UserID = u.ID
	c.SetUsername(u.Username)
	return nil
}

// User 返回已鉴权的管理端用户（需先执行 CurrentUser 依赖）。
func User(c *web.Ctx) *model.User {
	u, _ := c.User.(*model.User)
	return u
}

// ---------------- 权限位 ----------------

// permissionsOf 当前登录用户的权限位图（整个请求内只算一次）。
// 权限直接存在 app_user.permissions（BIGINT 位图），按位判断；未登录 / 解析失败按无权限处理（fail-closed）。
func permissionsOf(c *web.Ctx) domain.Permission {
	if v, ok := c.Get(keyPermissions); ok {
		return v.(domain.Permission)
	}
	var bits domain.Permission
	if u := User(c); u != nil {
		bits = domain.Permission(u.Permissions).Normalize()
	}
	c.Set(keyPermissions, bits)
	return bits
}

// HasPermission 当前登录用户是否拥有某权限位（需先执行 CurrentUser 依赖）。
func HasPermission(c *web.Ctx, perm domain.Permission) bool {
	return permissionsOf(c).Has(perm)
}

// HasPermissionIn 当前登录用户是否拥有列表中的任一权限位。
func HasPermissionIn(c *web.Ctx, perms ...domain.Permission) bool {
	bits := permissionsOf(c)
	for _, perm := range perms {
		if bits.Has(perm) {
			return true
		}
	}
	return false
}

// RequirePermission 依赖：登录用户且权限位图包含 perm，否则 403 PERMISSION_DENIED。
func RequirePermission(perm domain.Permission) web.Dep {
	return func(c *web.Ctx) error {
		if err := CurrentUser(c); err != nil {
			return err
		}
		if !HasPermission(c, perm) {
			return apperr.New("PERMISSION_DENIED", "没有执行此操作的权限").WithStatus(403)
		}
		return nil
	}
}

// RequireAnyPermission 依赖：登录用户且权限位图命中任一 perm（跨模块写操作用）。
func RequireAnyPermission(perms ...domain.Permission) web.Dep {
	return func(c *web.Ctx) error {
		if err := CurrentUser(c); err != nil {
			return err
		}
		if !HasPermissionIn(c, perms...) {
			return apperr.New("PERMISSION_DENIED", "没有执行此操作的权限").WithStatus(403)
		}
		return nil
	}
}

var (
	// SystemAdmin 系统管理：用户 / 项目 / 高级设置 / 附件池 / 分享链接。
	// 「超级管理员」不再是角色，系统管理与各功能读写位全开即等价于旧超级管理员。
	SystemAdmin     = RequirePermission(domain.PermSystemAdmin)
	WarehouseReader = RequirePermission(domain.PermWarehouseRead)
	WarehouseWriter = RequirePermission(domain.PermWarehouseWrite)
	PurchaseReader  = RequirePermission(domain.PermPurchaseRead)
	PurchaseWriter  = RequirePermission(domain.PermPurchaseWrite)
	HuaxingReader   = RequirePermission(domain.PermHuaxingRead)
	HazardReader    = RequirePermission(domain.PermHazardRead)
	HazardWriter    = RequirePermission(domain.PermHazardWrite)
	LedgerReader    = RequirePermission(domain.PermLedgerRead)
	LedgerWriter    = RequirePermission(domain.PermLedgerWrite)
	WorkReader      = RequirePermission(domain.PermWorkRead)
	WorkWriter      = RequirePermission(domain.PermWorkWrite)
	// LinkAnyWriter 跨模块写操作（如申购物资关联二级库物资）：命中任一模块写权限即可。
	LinkAnyWriter = RequireAnyPermission(domain.PermPurchaseWrite, domain.PermWarehouseWrite)
	// FileWriter 各业务模块的写权限都能上传图片：图片是上传后拿 file_id 随整表提交的通用能力。
	FileWriter = RequireAnyPermission(
		domain.PermWarehouseWrite, domain.PermPurchaseWrite, domain.PermHazardWrite,
		domain.PermLedgerWrite, domain.PermWorkWrite,
	)
)

// ---------------- 项目 ----------------

// GetProject 按主键读取项目。
func GetProject(s *db.Session, id int64) (*model.Project, error) {
	var p model.Project
	ok, err := s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE id = ?", id)
	if err != nil || !ok {
		return nil, err
	}
	return &p, nil
}

func checkProject(s *db.Session, id int64) (*model.Project, error) {
	p, err := GetProject(s, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperr.New("PROJECT_NOT_FOUND", "项目不存在").WithStatus(400)
	}
	if !p.Enabled {
		return nil, apperr.New("PROJECT_DISABLED", "项目已停用，请切换到其他项目").WithStatus(400)
	}
	return p, nil
}

// RequireProject 依赖（业务接口）：校验 X-Project-Id 并设为本请求的项目上下文。
// 缺头 → 400 PROJECT_REQUIRED；头值不是整数 → 422；项目不存在 / 停用 → PROJECT_NOT_FOUND / PROJECT_DISABLED。
func RequireProject(c *web.Ctx) error {
	if _, done := c.Get(keyProjectDone); done {
		return nil
	}
	vals := c.Request.Header.Values("X-Project-Id")
	if len(vals) == 0 {
		return apperr.ProjectRequired()
	}
	raw := vals[0]
	id, ok := web.ParseIntString(raw)
	if !ok {
		return &web.ValidationError{Errors: []web.FieldError{{
			Type: "int_parsing", Loc: []any{"header", "X-Project-Id"},
			Msg: "Input should be a valid integer, unable to parse string as an integer", Input: raw,
		}}}
	}
	p, err := checkProject(c.DB, id)
	if err != nil {
		return err
	}
	c.DB.SetProject(p.ID)
	c.ProjectID = p.ID
	c.Set(keyProjectDone, true)
	return nil
}

// SystemScope 依赖：整个请求处于跨项目（系统）上下文（附件管理 / 清理等全局附件池接口）。
func SystemScope(c *web.Ctx) error {
	c.DB.SetSystem()
	return nil
}

// DefaultProject 默认项目：is_default 且启用；没有时退回第一个启用项目。
func DefaultProject(s *db.Session) (*model.Project, error) {
	var p model.Project
	ok, err := s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE is_default = TRUE AND enabled = TRUE ORDER BY id LIMIT 1")
	if err != nil {
		return nil, err
	}
	if ok {
		return &p, nil
	}
	ok, err = s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE enabled = TRUE ORDER BY id LIMIT 1")
	if err != nil || !ok {
		return nil, err
	}
	return &p, nil
}

// RequireDefaultProject 一个启用项目都没有时报 PROJECT_NOT_FOUND。
func RequireDefaultProject(s *db.Session) (*model.Project, error) {
	p, err := DefaultProject(s)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperr.New("PROJECT_NOT_FOUND", "系统里还没有可用项目，请在「系统管理 → 项目管理」中创建").WithStatus(400)
	}
	return p, nil
}

// projectFromHeader 读取并校验 X-Project-Id；缺头 / 不可解析 / 非正数返回 nil（交给调用方兜底）。
func projectFromHeader(c *web.Ctx) (*model.Project, error) {
	raw := strings.TrimSpace(c.GetHeader("X-Project-Id"))
	if raw == "" {
		return nil, nil
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, nil
	}
	return checkProject(c.DB, id)
}

// ResolveMiniProgramProject 小程序项目上下文：带头按头校验，缺头落到默认项目。
func ResolveMiniProgramProject(c *web.Ctx) (*model.Project, error) {
	p, err := projectFromHeader(c)
	if err != nil {
		return nil, err
	}
	if p == nil {
		if p, err = RequireDefaultProject(c.DB); err != nil {
			return nil, err
		}
	}
	c.DB.SetProject(p.ID)
	c.ProjectID = p.ID
	return p, nil
}

// ---------------- 小程序 ----------------

// MiniProgramUser 依赖：小程序登录用户（统一 app_user 表，不区分来源），
// 并落定项目上下文（缺头用默认项目）。JWT 里 token_type = mini_program、sub = user.id。
func MiniProgramUser(c *web.Ctx) error {
	if _, ok := c.User.(*model.User); ok {
		return nil
	}
	raw := bearerToken(c)
	if raw == "" {
		return apperr.New("UNAUTHORIZED", "请先登录").WithStatus(401)
	}
	invalid := apperr.New("INVALID_TOKEN", "登录凭证无效或已过期").WithStatus(401)
	claims, err := security.DecodeAccessToken(raw)
	if err != nil {
		return invalid
	}
	if tt, _ := claims["token_type"].(string); tt != "mini_program" {
		return invalid
	}
	userID, ok := security.ClaimInt(claims, "sub")
	if !ok {
		return invalid
	}
	u, err := GetUser(c.DB, userID)
	if err != nil {
		return err
	}
	if u == nil {
		return invalid
	}
	if !u.Enabled {
		return apperr.New("ACCOUNT_DISABLED", "您的账号待审核，请联系管理员").WithStatus(403)
	}
	if _, err := ResolveMiniProgramProject(c); err != nil {
		return err
	}
	c.User = u
	c.UserID = u.ID
	c.SetUsername(u.Username)
	return nil
}

// MiniUser 返回已鉴权的小程序用户（统一 user 表记录）。
func MiniUser(c *web.Ctx) *model.User {
	u, _ := c.User.(*model.User)
	return u
}

// MiniUserHasPermission 小程序用户是否拥有某权限位（需先执行 MiniProgramUser 依赖）。
func MiniUserHasPermission(c *web.Ctx, perm domain.Permission) bool {
	return permissionsOf(c).Has(perm)
}

// MiniProgramRegistration 依赖：注册凭证（微信登录后、完善资料前），写入 app_id / openid。
func MiniProgramRegistration(c *web.Ctx) error {
	raw := bearerToken(c)
	if raw == "" {
		return apperr.New("UNAUTHORIZED", "请先完成微信登录").WithStatus(401)
	}
	invalid := apperr.New("INVALID_TOKEN", "注册凭证无效或已过期").WithStatus(401)
	claims, err := security.DecodeAccessToken(raw)
	if err != nil {
		return invalid
	}
	if tt, _ := claims["token_type"].(string); tt != "mini_program_registration" {
		return invalid
	}
	openid, ok1 := security.ClaimString(claims, "sub")
	appID, ok2 := security.ClaimString(claims, "app_id")
	if !ok1 || !ok2 || openid == "" || appID == "" {
		return invalid
	}
	c.Set(keyRegAppID, appID)
	c.Set(keyRegOpenID, openid)
	return nil
}

// Registration 返回注册凭证中的 (app_id, openid)。
func Registration(c *web.Ctx) (string, string) {
	return c.GetString(keyRegAppID), c.GetString(keyRegOpenID)
}
