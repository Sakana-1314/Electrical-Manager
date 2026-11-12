// Package dictionary 对应原 services/dictionary_service.py：管理端用户维护与接口令牌回显。
// 用户权限直接存 app_user.permissions 位图（见 domain.PermissionCatalog），不再有角色表。
package dictionary

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// UserWithToken 是带明文令牌回显的用户。
type UserWithToken struct {
	model.User
	APIToken *string
}

func (u *UserWithToken) Read() schema.UserApiTokenRead {
	return schema.UserApiTokenRead{UserRead: schema.NewUserRead(&u.User), APIToken: u.APIToken}
}

// issueAPIToken 生成新令牌：库中存哈希 + Fernet 密文，明文回显。
func issueAPIToken(u *UserWithToken) {
	token := security.UUID4()
	u.APITokenHash = security.SHA256Hex(token)
	u.APITokenEnc = security.EncryptSecret(token)
	u.APIToken = &token
}

// echoAPIToken 读取路径解密回显（旧数据 / 解密失败为 nil）。
func echoAPIToken(u *UserWithToken) { u.APIToken = security.DecryptSecret(u.APITokenEnc) }

func duplicateUsername() error {
	return apperr.New("DUPLICATE_USERNAME", "用户名已存在").WithStatus(409)
}

// permissionBits 权限键数组 → 位图；未知键返回 422 INVALID_PERMISSIONS。
// 写权限自动带上同模块读权限（由 domain.PermissionBits 归一化）。
func permissionBits(keys []string) (domain.Permission, error) {
	bits, unknown := domain.PermissionBits(keys)
	if len(unknown) > 0 {
		return 0, apperr.New("INVALID_PERMISSIONS", "包含未知的权限键").WithStatus(422).
			WithDetails(apperr.D{"permissions": unknown})
	}
	return bits, nil
}

// ListUsers 对应 list_users：关键字匹配用户名 / 姓名 / 部门（含小程序来源用户），按 id 分页。
func ListUsers(s *db.Session, keyword *string, page, pageSize int64) ([]UserWithToken, int64, error) {
	w := common.Where{}
	if keyword != nil && *keyword != "" {
		like := "%" + common.LikeEscape(*keyword) + "%"
		w.Add("(username LIKE ? ESCAPE '/' OR display_name LIKE ? ESCAPE '/' OR department_name LIKE ? ESCAPE '/')", like, like, like)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM app_user"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var users []model.User
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&users, "SELECT "+model.ColsUser+" FROM app_user"+w.SQL()+" ORDER BY id LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	out := make([]UserWithToken, len(users))
	for i := range users {
		out[i] = UserWithToken{User: users[i]}
		echoAPIToken(&out[i])
	}
	return out, total, nil
}

func CreateUser(s *db.Session, data schema.UserCreate) (*UserWithToken, error) {
	bits, err := permissionBits(data.Permissions)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	u := &UserWithToken{User: model.User{
		Username: data.Username, PasswordHash: security.HashPassword(data.Password), DisplayName: data.DisplayName,
		DepartmentName: data.DepartmentName, Source: domain.UserSourceManage, Permissions: int64(bits),
		Enabled: data.Enabled, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	issueAPIToken(u)
	id, err := s.Insert("INSERT INTO app_user (username, password_hash, api_token_hash, api_token_enc, display_name, department_name, source, permissions, enabled, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		u.Username, u.PasswordHash, u.APITokenHash, u.APITokenEnc, u.DisplayName, u.DepartmentName, u.Source,
		u.Permissions, u.Enabled, u.CreatedAt, u.UpdatedAt, u.Version)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateUsername()
		}
		return nil, err
	}
	u.ID = id
	return u, nil
}

func getUser(s *db.Session, id int64) (*UserWithToken, error) {
	u, err := auth.GetUser(s, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperr.NotFound("用户")
	}
	out := &UserWithToken{User: *u}
	// 令牌回显约定：每次读取都解密回显明文令牌（加密入库、哈希认证查找）。
	echoAPIToken(out)
	return out, nil
}

func UpdateUser(s *db.Session, id int64, data schema.UserUpdate) (*UserWithToken, error) {
	u, err := getUser(s, id)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.Version, u.Version); err != nil {
		return nil, err
	}
	if data.Username != nil {
		u.Username = *data.Username
	}
	if data.DisplayName != nil {
		u.DisplayName = *data.DisplayName
	}
	if data.DepartmentName != nil {
		u.DepartmentName = *data.DepartmentName
	}
	if data.Enabled != nil {
		u.Enabled = *data.Enabled
	}
	if data.Password != nil && *data.Password != "" {
		u.PasswordHash = security.HashPassword(*data.Password)
	}
	if data.Permissions != nil {
		bits, err := permissionBits(*data.Permissions)
		if err != nil {
			return nil, err
		}
		u.Permissions = int64(bits)
	}
	u.Version++
	u.UpdatedAt = common.UTCNow()
	_, err = s.Exec("UPDATE app_user SET username = ?, display_name = ?, department_name = ?, enabled = ?, password_hash = ?, permissions = ?, version = ?, updated_at = ? WHERE id = ?",
		u.Username, u.DisplayName, u.DepartmentName, u.Enabled, u.PasswordHash, u.Permissions, u.Version, u.UpdatedAt, u.ID)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateUsername()
		}
		return nil, err
	}
	return getUser(s, id)
}

func RegenerateAPIToken(s *db.Session, id, version int64) (*UserWithToken, error) {
	u, err := getUser(s, id)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&version, u.Version); err != nil {
		return nil, err
	}
	issueAPIToken(u)
	u.Version++
	u.UpdatedAt = common.UTCNow()
	if _, err := s.Exec("UPDATE app_user SET api_token_hash = ?, api_token_enc = ?, version = ?, updated_at = ? WHERE id = ?",
		u.APITokenHash, u.APITokenEnc, u.Version, u.UpdatedAt, u.ID); err != nil {
		return nil, err
	}
	return getUser(s, id)
}

func DeleteUser(s *db.Session, id, currentUserID int64) error {
	u, err := getUser(s, id)
	if err != nil {
		return err
	}
	if u.ID == currentUserID {
		return apperr.New("CANNOT_DELETE_CURRENT_USER", "不能删除当前登录用户").WithStatus(409)
	}
	_, err = s.Exec("DELETE FROM app_user WHERE id = ?", u.ID)
	return err
}

// MergeUsers 把 source 账号并入 target 账号：目标保留姓名 / 部门（页面里选定哪个是目标），
// 来源账号的微信身份随迁，权限位按位或取并集，来源账号随后删除。
// 微信身份的 openid 唯一：两边都已绑定微信时保留目标的（来源微信号随后解绑）。
func MergeUsers(s *db.Session, targetID int64, data schema.UserMergeRequest) (*UserWithToken, error) {
	if targetID == data.SourceUserID {
		return nil, apperr.New("CANNOT_MERGE_SELF", "不能将账号合并到自身").WithStatus(400)
	}
	var rows []model.User
	if err := s.SelectIn(&rows, "SELECT "+model.ColsUser+" FROM app_user WHERE id IN (?) FOR UPDATE",
		[]int64{targetID, data.SourceUserID}); err != nil {
		return nil, err
	}
	byID := map[int64]model.User{}
	for _, r := range rows {
		byID[r.ID] = r
	}
	t, okT := byID[targetID]
	so, okS := byID[data.SourceUserID]
	if !okT || !okS {
		return nil, apperr.NotFound("用户")
	}
	target, source := t, so
	if err := apperr.ValidateVersion(&data.TargetVersion, target.Version); err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.SourceVersion, source.Version); err != nil {
		return nil, err
	}

	now := common.UTCNow()
	// 权限位取并集（写权限自动带读权限在保存时已归一，这里再归一次防御历史数据）。
	target.Permissions = int64(domain.Permission(target.Permissions | source.Permissions).Normalize())
	// 微信 openid：目标未绑定微信时继承来源；两边都已绑定则保留目标的（来源微信号随之解绑，
	// 下次登录会重新注册为新用户）——合并是「保留目标资料」语义，不做 openid 冲突拦截。
	if target.WechatOpenid == nil && source.WechatOpenid != nil {
		openid := *source.WechatOpenid
		target.WechatOpenid = &openid
	}
	// 最近使用时间保留较近的一次，避免活跃度信息丢失
	latest := target.LastUsedAt
	if source.LastUsedAt != nil && (latest == nil || source.LastUsedAt.After(*latest)) {
		t := *source.LastUsedAt
		latest = &t
	}
	target.LastUsedAt = latest
	target.Version++
	target.UpdatedAt = now
	if _, err := s.Exec("UPDATE app_user SET last_used_at = ?, wechat_openid = ?, permissions = ?, version = ?, updated_at = ? WHERE id = ?",
		target.LastUsedAt, target.WechatOpenid, target.Permissions, target.Version, target.UpdatedAt, target.ID); err != nil {
		return nil, err
	}
	// 删除来源账号（业务数据引用以 409 提示）
	if _, err := s.Exec("DELETE FROM app_user WHERE id = ?", source.ID); err != nil {
		if db.IsIntegrity(err) {
			return nil, apperr.New("USER_HAS_REFERENCES", "该账号存在业务数据引用（导出任务 / 分享链接 / 备忘录等），无法合并").WithStatus(409)
		}
		return nil, err
	}
	return getUser(s, target.ID)
}
