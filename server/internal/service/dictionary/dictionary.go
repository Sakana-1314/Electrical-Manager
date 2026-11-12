// Package dictionary 对应原 services/dictionary_service.py：管理端用户维护与接口令牌回显。
// 用户角色为多角色（user_role），实际权限取并集；角色维护见 service/role。
package dictionary

import (
	"sort"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/role"
)

// UserWithToken 是带明文令牌回显、角色列表与微信身份的用户。
type UserWithToken struct {
	model.User
	APIToken   *string
	Roles      []schema.UserRoleRead
	Identities []schema.MiniProgramIdentityRead
}

func (u *UserWithToken) Read() schema.UserApiTokenRead {
	read := schema.UserApiTokenRead{UserRead: schema.NewUserRead(&u.User), APIToken: u.APIToken}
	read.Roles = u.Roles
	read.Identities = u.Identities
	return read
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

// loadRolesMap 批量加载用户角色（key 为用户 id）。
func loadRolesMap(s *db.Session, users []UserWithToken) (map[int64][]schema.UserRoleRead, error) {
	ids := make([]int64, len(users))
	for i := range users {
		ids[i] = users[i].ID
	}
	out := map[int64][]schema.UserRoleRead{}
	if err := role.WithRoles(s, ids, out); err != nil {
		return nil, err
	}
	return out, nil
}

// loadIdentitiesMap 批量加载微信身份（key 为用户 id；管理端来源用户为空数组）。
func loadIdentitiesMap(s *db.Session, ids []int64) (map[int64][]schema.MiniProgramIdentityRead, error) {
	out := map[int64][]schema.MiniProgramIdentityRead{}
	if len(ids) == 0 {
		return out, nil
	}
	var rows []model.MiniProgramIdentity
	if err := s.SelectIn(&rows, "SELECT "+model.ColsMiniProgramIdentity+" FROM mini_program_identity WHERE user_id IN (?) ORDER BY app_id, id", ids); err != nil {
		return nil, err
	}
	by := map[int64][]schema.MiniProgramIdentityRead{}
	for _, r := range rows {
		by[r.UserID] = append(by[r.UserID], schema.MiniProgramIdentityRead{
			ID: r.ID, AppID: r.AppID, WechatOpenid: r.WechatOpenid, CreatedAt: jtype.NewUTC(r.CreatedAt),
		})
	}
	for _, id := range ids {
		if by[id] == nil {
			by[id] = []schema.MiniProgramIdentityRead{}
		}
	}
	return by, nil
}

// ListUsers 对应 list_users：关键字匹配用户名 / 姓名 / 部门（含小程序来源用户），按 id 分页。
func ListUsers(s *db.Session, keyword *string, page, pageSize int64) ([]UserWithToken, int64, error) {
	w := common.Where{}
	if keyword != nil && *keyword != "" {
		like := "%" + common.LikeEscape(*keyword) + "%"
		w.Add("(username LIKE ? ESCAPE '/' OR display_name LIKE ? ESCAPE '/' OR department_name LIKE ? ESCAPE '/')", like, like, like)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM `user`"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var users []model.User
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&users, "SELECT "+model.ColsUser+" FROM `user`"+w.SQL()+" ORDER BY id LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	out := make([]UserWithToken, len(users))
	for i := range users {
		out[i] = UserWithToken{User: users[i]}
		echoAPIToken(&out[i])
	}
	ids := make([]int64, len(out))
	for i := range out {
		ids[i] = out[i].ID
	}
	roles, err := loadRolesMap(s, out)
	if err != nil {
		return nil, 0, err
	}
	identities, err := loadIdentitiesMap(s, ids)
	if err != nil {
		return nil, 0, err
	}
	for i := range out {
		out[i].Roles = roles[out[i].ID]
		out[i].Identities = identities[out[i].ID]
	}
	return out, total, nil
}

func CreateUser(s *db.Session, data schema.UserCreate) (*UserWithToken, error) {
	roleIDs, err := role.ValidateRoleIDs(s, data.RoleIDs)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	u := &UserWithToken{User: model.User{
		Username: data.Username, PasswordHash: security.HashPassword(data.Password), DisplayName: data.DisplayName,
		DepartmentName: data.DepartmentName, Source: domain.UserSourceManage, Enabled: data.Enabled,
		CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	issueAPIToken(u)
	id, err := s.Insert("INSERT INTO `user` (username, password_hash, api_token_hash, api_token_enc, display_name, department_name, source, enabled, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		u.Username, u.PasswordHash, u.APITokenHash, u.APITokenEnc, u.DisplayName, u.DepartmentName, u.Source, u.Enabled, u.CreatedAt, u.UpdatedAt, u.Version)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateUsername()
		}
		return nil, err
	}
	u.ID = id
	if err := role.ReplaceUserRoles(s, u.ID, roleIDs); err != nil {
		return nil, err
	}
	roles := map[int64][]schema.UserRoleRead{}
	if err := role.WithRoles(s, []int64{u.ID}, roles); err != nil {
		return nil, err
	}
	u.Roles = roles[u.ID]
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
	roles := map[int64][]schema.UserRoleRead{}
	if err := role.WithRoles(s, []int64{u.ID}, roles); err != nil {
		return nil, err
	}
	out.Roles = roles[u.ID]
	identities, err := loadIdentitiesMap(s, []int64{u.ID})
	if err != nil {
		return nil, err
	}
	out.Identities = identities[u.ID]
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
	u.Version++
	u.UpdatedAt = common.UTCNow()
	_, err = s.Exec("UPDATE `user` SET username = ?, display_name = ?, department_name = ?, enabled = ?, password_hash = ?, version = ?, updated_at = ? WHERE id = ?",
		u.Username, u.DisplayName, u.DepartmentName, u.Enabled, u.PasswordHash, u.Version, u.UpdatedAt, u.ID)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateUsername()
		}
		return nil, err
	}
	if data.RoleIDs != nil {
		roleIDs, err := role.ValidateRoleIDs(s, *data.RoleIDs)
		if err != nil {
			return nil, err
		}
		if err := role.ReplaceUserRoles(s, u.ID, roleIDs); err != nil {
			return nil, err
		}
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
	if _, err := s.Exec("UPDATE `user` SET api_token_hash = ?, api_token_enc = ?, version = ?, updated_at = ? WHERE id = ?",
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
	_, err = s.Exec("DELETE FROM `user` WHERE id = ?", u.ID)
	return err
}

// MergeUsers 把 source 账号并入 target 账号：目标保留姓名 / 部门（页面里选定哪个是目标），
// 来源账号的微信身份随迁，角色取两账号并集（同一角色只挂一次），来源账号随后删除。
// 微信身份的 (user_id, app_id) 唯一：两边在同一个小程序都有身份时无法直接合并。
func MergeUsers(s *db.Session, targetID int64, data schema.UserMergeRequest) (*UserWithToken, error) {
	if targetID == data.SourceUserID {
		return nil, apperr.New("CANNOT_MERGE_SELF", "不能将账号合并到自身").WithStatus(400)
	}
	var rows []model.User
	if err := s.SelectIn(&rows, "SELECT "+model.ColsUser+" FROM `user` WHERE id IN (?) FOR UPDATE",
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

	// 微信身份：(user_id, app_id) 唯一——两边在同一个小程序都有身份时拒绝合并
	var idents []model.MiniProgramIdentity
	if err := s.SelectIn(&idents, "SELECT "+model.ColsMiniProgramIdentity+" FROM mini_program_identity WHERE user_id IN (?)",
		[]int64{target.ID, source.ID}); err != nil {
		return nil, err
	}
	targetApps := map[string]bool{}
	for _, it := range idents {
		if it.UserID == target.ID {
			targetApps[it.AppID] = true
		}
	}
	duplicateSet := map[string]bool{}
	for _, it := range idents {
		if it.UserID == source.ID && targetApps[it.AppID] {
			duplicateSet[it.AppID] = true
		}
	}
	if len(duplicateSet) > 0 {
		duplicates := make([]string, 0, len(duplicateSet))
		for id := range duplicateSet {
			duplicates = append(duplicates, id)
		}
		sort.Strings(duplicates)
		return nil, apperr.New("MINI_PROGRAM_IDENTITY_CONFLICT", "两个账号包含相同小程序的身份，无法直接合并").
			WithStatus(409).
			WithDetails(apperr.D{"app_ids": duplicates})
	}

	now := common.UTCNow()
	// 角色取并集（含被合并账号的角色）
	if err := role.MergeRoles(s, target.ID, source.ID); err != nil {
		return nil, err
	}
	// 微信身份随迁
	if _, err := s.Exec("UPDATE mini_program_identity SET user_id = ?, updated_at = ? WHERE user_id = ?",
		target.ID, now, source.ID); err != nil {
		return nil, err
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
	if _, err := s.Exec("UPDATE `user` SET last_used_at = ?, version = ?, updated_at = ? WHERE id = ?",
		target.LastUsedAt, target.Version, target.UpdatedAt, target.ID); err != nil {
		return nil, err
	}
	// 删除来源账号（user_role 级联删除；业务数据引用以 409 提示）
	if _, err := s.Exec("DELETE FROM `user` WHERE id = ?", source.ID); err != nil {
		if db.IsIntegrity(err) {
			return nil, apperr.New("USER_HAS_REFERENCES", "该账号存在业务数据引用（导出任务 / 分享链接 / 备忘录等），无法合并").WithStatus(409)
		}
		return nil, err
	}
	return getUser(s, target.ID)
}
