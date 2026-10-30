package miniprogram

import (
	"sort"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
)

// User 是带微信身份（selectin，按 app_id 排序）的小程序用户。
type User struct {
	model.MiniProgramUser
	Identities []model.MiniProgramIdentity
}

func accountDisabled() error {
	return apperr.New("ACCOUNT_DISABLED", "您的账号待审核，请联系管理员").WithStatus(403)
}

func registrationDisabled() error {
	return apperr.New("MINI_PROGRAM_REGISTRATION_DISABLED", "当前暂未开放新用户绑定，请联系管理员").WithStatus(403)
}

// UserRead 对应 MiniProgramUserRead.model_validate(user)。
func UserRead(u *User) schema.MiniProgramUserRead {
	identities := make([]schema.MiniProgramIdentityRead, len(u.Identities))
	for i, it := range u.Identities {
		identities[i] = schema.MiniProgramIdentityRead{ID: it.ID, AppID: it.AppID, WechatOpenid: it.WechatOpenid, CreatedAt: jtype.NewUTC(it.CreatedAt)}
	}
	return schema.MiniProgramUserRead{
		ID: u.ID, DisplayName: u.DisplayName, DepartmentName: u.DepartmentName, Enabled: u.Enabled,
		LastUsedAt: common.UTCPtr(u.LastUsedAt), Identities: identities,
		CreatedAt: jtype.NewUTC(u.CreatedAt), UpdatedAt: jtype.NewUTC(u.UpdatedAt), Version: u.Version,
	}
}

// loadIdentities 批量加载身份（一次 IN 查询，按 app_id 排序）。
func loadIdentities(s *db.Session, users []*User) error {
	if len(users) == 0 {
		return nil
	}
	ids := make([]int64, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	var rows []model.MiniProgramIdentity
	if err := s.SelectIn(&rows, "SELECT "+model.ColsMiniProgramIdentity+" FROM mini_program_identity WHERE mini_program_user_id IN (?) ORDER BY app_id, id", ids); err != nil {
		return err
	}
	by := map[int64][]model.MiniProgramIdentity{}
	for _, r := range rows {
		by[r.MiniProgramUserID] = append(by[r.MiniProgramUserID], r)
	}
	for _, u := range users {
		u.Identities = by[u.ID]
		if u.Identities == nil {
			u.Identities = []model.MiniProgramIdentity{}
		}
	}
	return nil
}

// getUser 对应 session.get(MiniProgramUser, id)（含身份）；不存在返回 nil。
func getUser(s *db.Session, id int64, forUpdate bool) (*User, error) {
	q := "SELECT " + model.ColsMiniProgramUser + " FROM mini_program_user WHERE id = ?"
	if forUpdate {
		q += " FOR UPDATE"
	}
	var m model.MiniProgramUser
	ok, err := s.Find(&m, q, id)
	if err != nil || !ok {
		return nil, err
	}
	u := &User{MiniProgramUser: m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
}

// GetUser 按 id 读取小程序用户（含身份），不存在返回 nil。
func GetUser(s *db.Session, id int64) (*User, error) { return getUser(s, id, false) }

// LoadUser 为已鉴权的小程序用户补齐身份（/me 等接口用）。
func LoadUser(s *db.Session, m *model.MiniProgramUser) (*User, error) {
	u := &User{MiniProgramUser: *m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
}

// ListUsers 对应 list_users：关键字匹配姓名 / 部门 / 任一身份的 AppID 或 openid（整串包含，不拆分），按 id 分页。
func ListUsers(s *db.Session, keyword *string, page, pageSize int64) ([]*User, int64, error) {
	where := ""
	var args []any
	if keyword != nil && *keyword != "" {
		pattern := "%" + common.LikeEscape(*keyword) + "%"
		where = " WHERE (u.display_name LIKE ? ESCAPE '/' OR u.department_name LIKE ? ESCAPE '/' OR EXISTS (" +
			"SELECT 1 FROM mini_program_identity i WHERE i.mini_program_user_id = u.id AND " +
			"(i.app_id LIKE ? ESCAPE '/' OR i.wechat_openid LIKE ? ESCAPE '/')))"
		args = []any{pattern, pattern, pattern, pattern}
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM mini_program_user u"+where, args...); err != nil {
		return nil, 0, err
	}
	var rows []model.MiniProgramUser
	if err := s.Select(&rows, "SELECT "+model.Prefixed("u", model.ColsMiniProgramUser)+" FROM mini_program_user u"+where+
		" ORDER BY u.id LIMIT ? OFFSET ?", append(args, pageSize, common.Offset(page, pageSize))...); err != nil {
		return nil, 0, err
	}
	users := make([]*User, len(rows))
	for i := range rows {
		users[i] = &User{MiniProgramUser: rows[i]}
	}
	if err := loadIdentities(s, users); err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// UpdateUser 对应 update_user：改姓名 / 部门 / 启用状态，version + 1。
func UpdateUser(s *db.Session, id int64, data schema.MiniProgramUserUpdate) (*User, error) {
	u, err := getUser(s, id, false)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperr.NotFound("小程序用户")
	}
	if err := apperr.ValidateVersion(&data.Version, u.Version); err != nil {
		return nil, err
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
	u.Version++
	u.UpdatedAt = common.UTCNow()
	if _, err := s.Exec("UPDATE mini_program_user SET display_name = ?, department_name = ?, enabled = ?, version = ?, updated_at = ? WHERE id = ?",
		u.DisplayName, u.DepartmentName, u.Enabled, u.Version, u.UpdatedAt, u.ID); err != nil {
		return nil, err
	}
	return u, nil
}

// DeleteUser 对应 delete_user：校验 If-Match 版本后删除（身份随之级联删除）。
func DeleteUser(s *db.Session, id int64, version *int64) error {
	var m model.MiniProgramUser
	ok, err := s.Find(&m, "SELECT "+model.ColsMiniProgramUser+" FROM mini_program_user WHERE id = ?", id)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.NotFound("小程序用户")
	}
	if err := apperr.ValidateVersion(version, m.Version); err != nil {
		return err
	}
	if _, err := s.Exec("DELETE FROM mini_program_identity WHERE mini_program_user_id = ?", id); err != nil {
		return err
	}
	_, err = s.Exec("DELETE FROM mini_program_user WHERE id = ?", id)
	return err
}

// MergeUsers 对应 merge_users：姓名与部门一致、且不含同一小程序的身份时，把 source 的身份并入 target 并删除 source。
func MergeUsers(s *db.Session, targetID int64, data schema.MiniProgramUserMergeRequest) (*User, error) {
	if targetID == data.SourceUserID {
		return nil, apperr.New("MINI_PROGRAM_USER_MERGE_SAME_ACCOUNT", "不能将小程序账号合并到自身").WithStatus(400)
	}
	var rows []model.MiniProgramUser
	if err := s.SelectIn(&rows, "SELECT "+model.ColsMiniProgramUser+" FROM mini_program_user WHERE id IN (?) FOR UPDATE",
		[]int64{targetID, data.SourceUserID}); err != nil {
		return nil, err
	}
	users := make([]*User, len(rows))
	byID := map[int64]*User{}
	for i := range rows {
		users[i] = &User{MiniProgramUser: rows[i]}
		byID[rows[i].ID] = users[i]
	}
	if err := loadIdentities(s, users); err != nil {
		return nil, err
	}
	target, source := byID[targetID], byID[data.SourceUserID]
	if target == nil || source == nil {
		return nil, apperr.NotFound("小程序用户")
	}
	if err := apperr.ValidateVersion(&data.TargetVersion, target.Version); err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.SourceVersion, source.Version); err != nil {
		return nil, err
	}
	if target.DisplayName != source.DisplayName || target.DepartmentName != source.DepartmentName {
		return nil, apperr.New("MINI_PROGRAM_USER_PROFILE_MISMATCH", "姓名和部门单位必须一致才能合并账号").WithStatus(409)
	}
	targetAppIDs := map[string]bool{}
	for _, it := range target.Identities {
		targetAppIDs[it.AppID] = true
	}
	duplicateSet := map[string]bool{}
	for _, it := range source.Identities {
		if targetAppIDs[it.AppID] {
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
	if len(source.Identities) > 0 {
		if _, err := s.Exec("UPDATE mini_program_identity SET mini_program_user_id = ?, updated_at = ? WHERE mini_program_user_id = ?",
			target.ID, now, source.ID); err != nil {
			return nil, err
		}
	}
	// 内存中的关系列表：保留账号原有身份在前，迁入的身份追加在后（与 ORM 列表 append 一致）。
	for _, it := range source.Identities {
		it.MiniProgramUserID = target.ID
		it.UpdatedAt = now
		target.Identities = append(target.Identities, it)
	}
	// 源账号随后被删除，把更近的一次使用时间留给保留的账号，避免活跃度信息丢失。
	if source.LastUsedAt != nil && (target.LastUsedAt == nil || source.LastUsedAt.After(*target.LastUsedAt)) {
		t := *source.LastUsedAt
		target.LastUsedAt = &t
	}
	target.Version++
	target.UpdatedAt = now
	if _, err := s.Exec("UPDATE mini_program_user SET last_used_at = ?, version = ?, updated_at = ? WHERE id = ?",
		target.LastUsedAt, target.Version, target.UpdatedAt, target.ID); err != nil {
		return nil, err
	}
	if _, err := s.Exec("DELETE FROM mini_program_user WHERE id = ?", source.ID); err != nil {
		return nil, err
	}
	return target, nil
}

// markLastUsed 对应 _mark_last_used：登录即刷新最近使用时间，刻意不自增 version。
func markLastUsed(s *db.Session, u *User) error {
	now := common.UTCNow()
	u.LastUsedAt = &now
	u.UpdatedAt = now
	_, err := s.Exec("UPDATE mini_program_user SET last_used_at = ?, updated_at = ? WHERE id = ?", now, now, u.ID)
	return err
}

// findUserByIdentity 按 (app_id, openid) 查找用户（含身份），不存在返回 nil。
func findUserByIdentity(s *db.Session, appID, openid string) (*User, error) {
	var m model.MiniProgramUser
	ok, err := s.Find(&m, "SELECT "+model.Prefixed("u", model.ColsMiniProgramUser)+" FROM mini_program_user u "+
		"JOIN mini_program_identity i ON i.mini_program_user_id = u.id WHERE i.app_id = ? AND i.wechat_openid = ? LIMIT 1",
		appID, openid)
	if err != nil || !ok {
		return nil, err
	}
	u := &User{MiniProgramUser: m}
	if err := loadIdentities(s, []*User{u}); err != nil {
		return nil, err
	}
	return u, nil
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

// RegisterUser 对应 register_user：按注册凭证里的 (app_id, openid) 建档；已存在时按一次登录处理且不覆盖姓名 / 部门。
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
	user := &User{MiniProgramUser: model.MiniProgramUser{
		DisplayName: displayName, DepartmentName: departmentName, Enabled: newUserEnabled,
		LastUsedAt: &now, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	conflict := func(err error) error {
		if db.IsIntegrity(err) {
			return apperr.New("WECHAT_USER_CREATE_CONFLICT", "微信用户创建冲突，请重新登录").WithStatus(409)
		}
		return err
	}
	id, err := s.Insert("INSERT INTO mini_program_user (display_name, department_name, enabled, last_used_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
		user.DisplayName, user.DepartmentName, user.Enabled, user.LastUsedAt, user.CreatedAt, user.UpdatedAt, user.Version)
	if err != nil {
		return nil, conflict(err)
	}
	user.ID = id
	identity := model.MiniProgramIdentity{MiniProgramUserID: id, AppID: appID, WechatOpenid: openid, CreatedAt: now, UpdatedAt: now, Version: 1}
	identityID, err := s.Insert("INSERT INTO mini_program_identity (mini_program_user_id, app_id, wechat_openid, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?)",
		identity.MiniProgramUserID, identity.AppID, identity.WechatOpenid, identity.CreatedAt, identity.UpdatedAt, identity.Version)
	if err != nil {
		return nil, conflict(err)
	}
	identity.ID = identityID
	user.Identities = []model.MiniProgramIdentity{identity}
	if err := webhook.EnqueueEvent(s, domain.EventMiniProgramUserBound, map[string]any{
		"display_name":    user.DisplayName,
		"department_name": user.DepartmentName,
		"app_id":          appID,
		"enabled":         user.Enabled,
		"bound_at":        user.CreatedAt.Format(time.DateOnly+"T15:04:05") + "Z",
	}); err != nil {
		return nil, err
	}
	return user, nil
}
