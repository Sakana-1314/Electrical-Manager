// Package role 对应角色（RBAC）维护：角色 CRUD、用户 ↔ 角色关联、权限并集汇总。
// 角色为全局资源（不随项目隔离）；权限键目录见 internal/domain 的 PermissionCatalog。
package role

import (
	"encoding/json"
	"sort"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// decodePermissions 解出角色的权限键数组（空数组 / 非法 JSON 都按空处理，写入路径已校验）。
func decodePermissions(raw jtype.JSON) []string {
	var keys []string
	_ = json.Unmarshal(raw, &keys)
	return keys
}

// permissionsJSON 权限键数组序列化为 JSONB 存储值（序列化失败不会发生，兜底空数组）。
func permissionsJSON(keys []string) jtype.JSON {
	raw, err := json.Marshal(keys)
	if err != nil {
		return jtype.JSON("[]")
	}
	return jtype.JSON(raw)
}

// UserPermissionKeys 汇总用户全部角色的权限并集：展开通配（`*` / `模块:*`）、去重、按目录顺序输出。
func UserPermissionKeys(s *db.Session, userID int64) ([]string, error) {
	var roles []model.Role
	if err := s.Select(&roles, "SELECT "+model.Prefixed("r", model.ColsRole)+
		" FROM role r JOIN user_role ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.id", userID); err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(roles)*4)
	for _, r := range roles {
		keys = append(keys, decodePermissions(r.Permissions)...)
	}
	return domain.ExpandPermissions(keys), nil
}

// UserHas 用户是否拥有某权限（service 层判定用；权限并集，通配已展开）。
func UserHas(s *db.Session, userID int64, perm string) bool {
	keys, err := UserPermissionKeys(s, userID)
	if err != nil {
		return false
	}
	for _, key := range keys {
		if key == perm {
			return true
		}
	}
	return false
}

// UserIsSuperAdmin 用户是否持有内置「超级管理员」角色（`*` 通配）。
func UserIsSuperAdmin(s *db.Session, userID int64) bool {
	return UserHas(s, userID, domain.PermSettingsWrite)
}

// WithRoles 批量加载用户的角色（按 role.id 排序），并写入 map（缺失的得到空切片）。
func WithRoles(s *db.Session, userIDs []int64, out map[int64][]schema.UserRoleRead) error {
	for _, id := range userIDs {
		out[id] = []schema.UserRoleRead{}
	}
	if len(userIDs) == 0 {
		return nil
	}
	var rows []model.Role
	if err := s.SelectIn(&rows, "SELECT DISTINCT "+model.Prefixed("r", model.ColsRole)+
		" FROM role r JOIN user_role ur ON ur.role_id = r.id WHERE ur.user_id IN (?) ORDER BY r.id", userIDs); err != nil {
		return err
	}
	byUser := map[int64][]schema.UserRoleRead{}
	var links []model.UserRole
	if err := s.SelectIn(&links, "SELECT "+model.ColsUserRole+" FROM user_role WHERE user_id IN (?)", userIDs); err != nil {
		return err
	}
	roleByID := map[int64]model.Role{}
	for _, r := range rows {
		roleByID[r.ID] = r
	}
	for _, link := range links {
		if r, ok := roleByID[link.RoleID]; ok {
			byUser[link.UserID] = append(byUser[link.UserID], UserRoleRead(r))
		}
	}
	for id, list := range byUser {
		out[id] = list
	}
	return nil
}

// UserRoleRead 角色摘要（用户读取里内嵌）。
func UserRoleRead(r model.Role) schema.UserRoleRead {
	return schema.UserRoleRead{ID: r.ID, Name: r.Name, IsSystem: r.IsSystem}
}

// validatePermissions 角色保存时的权限键校验：必须都在目录内，且不允许通配键（通配只属于内置超级管理员）。
func validatePermissions(keys []string) error {
	seen := map[string]bool{}
	for _, key := range keys {
		if seen[key] {
			return apperr.New("INVALID_PERMISSIONS", "权限键重复："+key).WithStatus(422)
		}
		seen[key] = true
		if !domain.IsKnownPermission(key) {
			return apperr.New("INVALID_PERMISSIONS", "未知权限键："+key).WithStatus(422)
		}
	}
	return nil
}

// readCounts 统计每个角色的用户数（删除保护与列表展示用）。
func readCounts(s *db.Session) (map[int64]int64, error) {
	var rows []struct {
		RoleID int64 `db:"role_id"`
		Count  int64 `db:"count"`
	}
	if err := s.Select(&rows, "SELECT role_id, COUNT(*) AS count FROM user_role GROUP BY role_id"); err != nil {
		return nil, err
	}
	counts := map[int64]int64{}
	for _, r := range rows {
		counts[r.RoleID] = r.Count
	}
	return counts, nil
}

// List 全量角色（按 id 排序），带用户数。
func List(s *db.Session) ([]schema.RoleRead, error) {
	var roles []model.Role
	if err := s.Select(&roles, "SELECT "+model.ColsRole+" FROM role ORDER BY id"); err != nil {
		return nil, err
	}
	counts, err := readCounts(s)
	if err != nil {
		return nil, err
	}
	out := make([]schema.RoleRead, len(roles))
	for i, r := range roles {
		count := counts[r.ID]
		out[i] = NewRoleRead(r, count)
	}
	return out, nil
}

// NewRoleRead 角色读取结构（permissions 展开为排序后的权限键数组）。
func NewRoleRead(r model.Role, userCount int64) schema.RoleRead {
	keys := decodePermissions(r.Permissions)
	sort.Strings(keys)
	return schema.RoleRead{
		ID: r.ID, Name: r.Name, Description: r.Description, Permissions: keys,
		IsSystem: r.IsSystem, UserCount: userCount,
		CreatedAt: jtype.NewUTC(r.CreatedAt), UpdatedAt: jtype.NewUTC(r.UpdatedAt), Version: r.Version,
	}
}

// Create 新建角色：名称唯一，权限键必须在目录内。
func Create(s *db.Session, data schema.RoleCreate) (*model.Role, error) {
	if err := validatePermissions(data.Permissions); err != nil {
		return nil, err
	}
	now := common.UTCNow()
	r := &model.Role{
		Name: data.Name, Description: data.Description,
		Permissions: permissionsJSON(data.Permissions), IsSystem: false,
		CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO role (name, description, permissions, is_system, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
		r.Name, r.Description, r.Permissions, r.IsSystem, r.CreatedAt, r.UpdatedAt, r.Version)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, apperr.New("ROLE_NAME_CONFLICT", "角色名称已存在").WithStatus(409)
		}
		return nil, err
	}
	r.ID = id
	return r, nil
}

// getRole 按 id 读取角色，不存在返回 nil。
func getRole(s *db.Session, id int64) (*model.Role, error) {
	var r model.Role
	ok, err := s.Find(&r, "SELECT "+model.ColsRole+" FROM role WHERE id = ?", id)
	if err != nil || !ok {
		return nil, err
	}
	return &r, nil
}

// Update 编辑角色：内置角色不可改；权限键必须在目录内。
func Update(s *db.Session, id int64, data schema.RoleUpdate) (*model.Role, error) {
	r, err := getRole(s, id)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, apperr.NotFound("角色")
	}
	if r.IsSystem {
		return nil, apperr.New("ROLE_SYSTEM_LOCKED", "内置角色不可编辑").WithStatus(409)
	}
	if err := apperr.ValidateVersion(&data.Version, r.Version); err != nil {
		return nil, err
	}
	if data.Name != nil {
		r.Name = *data.Name
	}
	if data.Description != nil {
		r.Description = *data.Description
	}
	if data.Permissions != nil {
		if err := validatePermissions(*data.Permissions); err != nil {
			return nil, err
		}
		r.Permissions = permissionsJSON(*data.Permissions)
	}
	r.Version++
	r.UpdatedAt = common.UTCNow()
	if _, err := s.Exec("UPDATE role SET name = ?, description = ?, permissions = ?, version = ?, updated_at = ? WHERE id = ?",
		r.Name, r.Description, r.Permissions, r.Version, r.UpdatedAt, r.ID); err != nil {
		if db.IsIntegrity(err) {
			return nil, apperr.New("ROLE_NAME_CONFLICT", "角色名称已存在").WithStatus(409)
		}
		return nil, err
	}
	return r, nil
}

// Delete 删除角色：内置角色不可删；仍有用户挂载时拒绝。
func Delete(s *db.Session, id int64, version *int64) error {
	r, err := getRole(s, id)
	if err != nil {
		return err
	}
	if r == nil {
		return apperr.NotFound("角色")
	}
	if r.IsSystem {
		return apperr.New("ROLE_SYSTEM_LOCKED", "内置角色不可删除").WithStatus(409)
	}
	if err := apperr.ValidateVersion(version, r.Version); err != nil {
		return err
	}
	counts, err := readCounts(s)
	if err != nil {
		return err
	}
	if counts[id] > 0 {
		return apperr.New("ROLE_IN_USE", "仍有用户挂载此角色，请先解除关联").WithStatus(409)
	}
	_, err = s.Exec("DELETE FROM role WHERE id = ?", id)
	return err
}

// ValidateRoleIDs 校验角色 id 列表都存在且去重（用户保存时用），返回去重后的 id。
func ValidateRoleIDs(s *db.Session, roleIDs []int64) ([]int64, error) {
	seen := map[int64]bool{}
	unique := make([]int64, 0, len(roleIDs))
	for _, id := range roleIDs {
		if id <= 0 {
			return nil, apperr.New("INVALID_ROLES", "角色 id 非法").WithStatus(422)
		}
		if seen[id] {
			continue
		}
		seen[id] = true
		unique = append(unique, id)
	}
	if len(unique) == 0 {
		return unique, nil
	}
	var count int64
	if err := s.Get(&count, "SELECT COUNT(*) FROM role WHERE id IN (?)", unique); err != nil {
		return nil, err
	}
	if int(count) != len(unique) {
		return nil, apperr.New("INVALID_ROLES", "存在无效的角色").WithStatus(422)
	}
	return unique, nil
}

// ReplaceUserRoles 重写用户的角色关联（全量替换）。
func ReplaceUserRoles(s *db.Session, userID int64, roleIDs []int64) error {
	if _, err := s.Exec("DELETE FROM user_role WHERE user_id = ?", userID); err != nil {
		return err
	}
	now := common.UTCNow()
	for _, roleID := range roleIDs {
		if _, err := s.Insert("INSERT INTO user_role (user_id, role_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, 1)",
			userID, roleID, now, now); err != nil {
			return err
		}
	}
	return nil
}

// ReadOnlyRoleID 内置「只读用户」角色 id（小程序新用户默认角色）；缺失返回错误（种子被删视为环境异常）。
func ReadOnlyRoleID(s *db.Session) (int64, error) {
	var r model.Role
	ok, err := s.Find(&r, "SELECT "+model.ColsRole+" FROM role WHERE name = ? AND is_system = TRUE", domain.SystemRoleReadOnly)
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, apperr.New("ROLE_NOT_FOUND", "内置「只读用户」角色缺失，请检查角色数据").WithStatus(500)
	}
	return r.ID, nil
}

// UserRoleNames 用户挂载的角色名（MCP whoami 等展示用；加载失败按空处理）。
func UserRoleNames(s *db.Session, userID int64) []string {
	var roles []model.Role
	if err := s.Select(&roles, "SELECT "+model.Prefixed("r", model.ColsRole)+
		" FROM role r JOIN user_role ur ON ur.role_id = r.id WHERE ur.user_id = ? ORDER BY r.id", userID); err != nil {
		return []string{}
	}
	names := make([]string, len(roles))
	for i, r := range roles {
		names[i] = r.Name
	}
	return names
}
