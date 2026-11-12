package miniprogram

import (
	"crypto/md5"
	"encoding/hex"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/role"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
)

// User 是带微信身份与角色的小程序用户（统一 user 表里 source = MINI_PROGRAM 的账号）。
type User struct {
	model.User
	Identities []model.MiniProgramIdentity
	Roles      []schema.UserRoleRead
}

func accountDisabled() error {
	return apperr.New("ACCOUNT_DISABLED", "您的账号待审核，请联系管理员").WithStatus(403)
}

func registrationDisabled() error {
	return apperr.New("MINI_PROGRAM_REGISTRATION_DISABLED", "当前暂未开放新用户绑定，请联系管理员").WithStatus(403)
}

// UserRead 对应 MiniProgramUserRead.model_validate(user)：roles / permissions 供小程序端按权限门禁。
func UserRead(s *db.Session, u *User) schema.MiniProgramUserRead {
	identities := make([]schema.MiniProgramIdentityRead, len(u.Identities))
	for i, it := range u.Identities {
		identities[i] = schema.MiniProgramIdentityRead{ID: it.ID, AppID: it.AppID, WechatOpenid: it.WechatOpenid, CreatedAt: jtype.NewUTC(it.CreatedAt)}
	}
	permissions, err := role.UserPermissionKeys(s, u.ID)
	// 权限汇总失败按空权限处理（fail-closed）；正常路径不会走到这里。
	if err != nil {
		permissions = []string{}
	}
	return schema.MiniProgramUserRead{
		ID: u.ID, DisplayName: u.DisplayName, DepartmentName: u.DepartmentName, Enabled: u.Enabled,
		Source: u.Source, Roles: u.Roles, Permissions: permissions,
		LastUsedAt: common.UTCPtr(u.LastUsedAt), Identities: identities,
		CreatedAt: jtype.NewUTC(u.CreatedAt), UpdatedAt: jtype.NewUTC(u.UpdatedAt), Version: u.Version,
	}
}

// loadIdentities 批量加载微信身份（一次 IN 查询，按 app_id 排序）。
func loadIdentities(s *db.Session, users []*User) error {
	if len(users) == 0 {
		return nil
	}
	ids := make([]int64, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	var rows []model.MiniProgramIdentity
	if err := s.SelectIn(&rows, "SELECT "+model.ColsMiniProgramIdentity+" FROM mini_program_identity WHERE user_id IN (?) ORDER BY app_id, id", ids); err != nil {
		return err
	}
	by := map[int64][]model.MiniProgramIdentity{}
	for _, r := range rows {
		by[r.UserID] = append(by[r.UserID], r)
	}
	for _, u := range users {
		u.Identities = by[u.ID]
		if u.Identities == nil {
			u.Identities = []model.MiniProgramIdentity{}
		}
	}
	return nil
}

// loadRoles 批量加载用户角色。
func loadRoles(s *db.Session, users []*User) error {
	ids := make([]int64, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	roles := map[int64][]schema.UserRoleRead{}
	if err := role.WithRoles(s, ids, roles); err != nil {
		return err
	}
	for _, u := range users {
		u.Roles = roles[u.ID]
	}
	return nil
}

// getUser 对应 session.get(User, id)（含身份与角色）；不存在返回 nil。
func getUser(s *db.Session, id int64, forUpdate bool) (*User, error) {
	q := "SELECT " + model.ColsUser + " FROM `user` WHERE id = ? AND source = ?"
	if forUpdate {
		q += " FOR UPDATE"
	}
	var m model.User
	ok, err := s.Find(&m, q, id, domain.UserSourceMiniProgram)
	if err != nil || !ok {
		return nil, err
	}
	u := &User{User: m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	if err := loadRoles(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
}

// GetUser 按 id 读取小程序用户（含身份与角色），不存在返回 nil。
func GetUser(s *db.Session, id int64) (*User, error) { return getUser(s, id, false) }

// LoadUser 为已鉴权的小程序用户补齐身份与角色（/me 等接口用）。
func LoadUser(s *db.Session, m *model.User) (*User, error) {
	u := &User{User: *m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	if err := loadRoles(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
}

// markLastUsed 对应 _mark_last_used：登录即刷新最近使用时间，刻意不自增 version。
func markLastUsed(s *db.Session, u *User) error {
	now := common.UTCNow()
	u.LastUsedAt = &now
	u.UpdatedAt = now
	_, err := s.Exec("UPDATE `user` SET last_used_at = ?, updated_at = ? WHERE id = ?", now, now, u.ID)
	return err
}

// findUserByIdentity 按 (app_id, openid) 查找用户（含身份与角色），不存在返回 nil。
func findUserByIdentity(s *db.Session, appID, openid string) (*User, error) {
	var m model.User
	ok, err := s.Find(&m, "SELECT "+model.Prefixed("u", model.ColsUser)+" FROM `user` u "+
		"JOIN mini_program_identity i ON i.user_id = u.id WHERE i.app_id = ? AND i.wechat_openid = ? LIMIT 1",
		appID, openid)
	if err != nil || !ok {
		return nil, err
	}
	u := &User{User: m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	if err := loadRoles(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
}

// miniProgramUsername 由 (app_id, openid) 派生唯一用户名（openid 本身可含特殊字符，这里哈希定长化）。
func miniProgramUsername(appID, openid string) string {
	sum := md5.Sum([]byte(appID + ":" + openid))
	return "wx_" + hex.EncodeToString(sum[:8])
}

// LoginWithWechat 对应 login_with_wechat：换取 openid 后查找已绑定用户。
// 返回 (用户或 nil, 实际 AppID, openid)；用户为 nil 表示需要补充个人信息。
func LoginWithWechat(s *db.Session, code string, appID *string) (*User, string, string, error) {
	requested := ""
	if appID != nil {
		requested = *appID
	}
	effectiveAppID, openid, err := ExchangeWechatCode(s.Ctx(), code, requested)
	if err != nil {
		return nil, "", "", err
	}
	user, err := findUserByIdentity(s, effectiveAppID, openid)
	if err != nil {
		return nil, "", "", err
	}
	if user != nil && !user.Enabled {
		return nil, "", "", accountDisabled()
	}
	if user == nil {
		enabled, err := aisearch.IsMiniProgramRegistrationEnabled(s)
		if err != nil {
			return nil, "", "", err
		}
		if !enabled {
			return nil, "", "", registrationDisabled()
		}
	}
	if user != nil {
		// 待审核 / 已停用账号在上面的分支被拒，不会走到这里。
		if err := markLastUsed(s, user); err != nil {
			return nil, "", "", err
		}
	}
	return user, effectiveAppID, openid, nil
}

// RegisterUser 对应 register_user：按注册凭证里的 (app_id, openid) 建统一用户档案并挂各功能只读角色。
// 新用户是否默认启用由系统设置决定（默认启用 = 只读权限；默认禁用 = 待管理员审核启用）。
// 已存在时按一次登录处理且不覆盖姓名 / 部门。
func RegisterUser(s *db.Session, appID, openid, displayName, departmentName string) (*User, error) {
	existing, err := findUserByIdentity(s, appID, openid)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if !existing.Enabled {
			return nil, accountDisabled()
		}
		// 重复建档（registration_token 重放）同样按一次登录记录，但不覆盖姓名 / 部门。
		if err := markLastUsed(s, existing); err != nil {
			return nil, err
		}
		return existing, nil
	}
	registrationEnabled, err := aisearch.IsMiniProgramRegistrationEnabled(s)
	if err != nil {
		return nil, err
	}
	if !registrationEnabled {
		return nil, registrationDisabled()
	}
	newUserEnabled, err := aisearch.IsMiniProgramNewUserEnabled(s)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	user := &User{User: model.User{
		Username: miniProgramUsername(appID, openid), PasswordHash: "", APITokenHash: "", APITokenEnc: "",
		DisplayName: displayName, DepartmentName: departmentName, Source: domain.UserSourceMiniProgram,
		Enabled: newUserEnabled, LastUsedAt: &now, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	conflict := func(err error) error {
		if db.IsIntegrity(err) {
			return apperr.New("WECHAT_USER_CREATE_CONFLICT", "微信用户创建冲突，请重新登录").WithStatus(409)
		}
		return err
	}
	id, err := s.Insert("INSERT INTO `user` (username, password_hash, api_token_hash, api_token_enc, display_name, department_name, source, enabled, last_used_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		user.Username, user.PasswordHash, user.APITokenHash, user.APITokenEnc, user.DisplayName, user.DepartmentName,
		user.Source, user.Enabled, user.LastUsedAt, user.CreatedAt, user.UpdatedAt, user.Version)
	if err != nil {
		return nil, conflict(err)
	}
	user.ID = id
	// 默认启用的用户挂全部「只读」角色（各功能只读，权限并集）；禁用的用户等管理员启用后再分配角色。
	if user.Enabled {
		defaultRoleIDs, err := role.DefaultRegistrationRoleIDs(s)
		if err != nil {
			return nil, err
		}
		if err := role.ReplaceUserRoles(s, user.ID, defaultRoleIDs); err != nil {
			return nil, err
		}
	}
	identity := model.MiniProgramIdentity{UserID: id, AppID: appID, WechatOpenid: openid, CreatedAt: now, UpdatedAt: now, Version: 1}
	identityID, err := s.Insert("INSERT INTO mini_program_identity (user_id, app_id, wechat_openid, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?)",
		identity.UserID, identity.AppID, identity.WechatOpenid, identity.CreatedAt, identity.UpdatedAt, identity.Version)
	if err != nil {
		return nil, conflict(err)
	}
	identity.ID = identityID
	user.Identities = []model.MiniProgramIdentity{identity}
	if err := loadRoles(s, []*User{user}); err != nil {
		return nil, err
	}
	if err := webhook.EnqueueEvent(s, domain.EventMiniProgramUserBound, map[string]any{
		"display_name":    user.DisplayName,
		"department_name": user.DepartmentName,
		"app_id":          appID,
		"enabled":         user.Enabled,
		"roles":           roleNames(user.Roles),
		"bound_at":        user.CreatedAt.Format(time.DateOnly+"T15:04:05") + "Z",
	}); err != nil {
		return nil, err
	}
	return user, nil
}

// roleNames 角色名列表（webhook 载荷用）。
func roleNames(roles []schema.UserRoleRead) []string {
	names := make([]string, len(roles))
	for i, r := range roles {
		names[i] = r.Name
	}
	return names
}
