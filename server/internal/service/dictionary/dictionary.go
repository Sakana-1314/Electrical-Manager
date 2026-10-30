// Package dictionary 对应原 services/dictionary_service.py：管理端用户维护与接口令牌回显。
package dictionary

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
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

func ListUsers(s *db.Session, keyword *string, page, pageSize int64) ([]UserWithToken, int64, error) {
	w := common.Where{}
	if keyword != nil && *keyword != "" {
		like := "%" + *keyword + "%"
		w.Add("(username LIKE ? OR display_name LIKE ?)", like, like)
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
	return out, total, nil
}

func CreateUser(s *db.Session, data schema.UserCreate) (*UserWithToken, error) {
	now := common.UTCNow()
	u := &UserWithToken{User: model.User{
		Username: data.Username, PasswordHash: security.HashPassword(data.Password), DisplayName: data.DisplayName,
		Role: data.Role, Enabled: data.Enabled, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	issueAPIToken(u)
	id, err := s.Insert("INSERT INTO `user` (username, password_hash, api_token_hash, api_token_enc, display_name, role, enabled, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		u.Username, u.PasswordHash, u.APITokenHash, u.APITokenEnc, u.DisplayName, u.Role, u.Enabled, u.CreatedAt, u.UpdatedAt, u.Version)
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
	return &UserWithToken{User: *u}, nil
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
	if data.Role != nil {
		u.Role = *data.Role
	}
	if data.Enabled != nil {
		u.Enabled = *data.Enabled
	}
	if data.Password != nil && *data.Password != "" {
		u.PasswordHash = security.HashPassword(*data.Password)
	}
	u.Version++
	u.UpdatedAt = common.UTCNow()
	_, err = s.Exec("UPDATE `user` SET username = ?, display_name = ?, role = ?, enabled = ?, password_hash = ?, version = ?, updated_at = ? WHERE id = ?",
		u.Username, u.DisplayName, u.Role, u.Enabled, u.PasswordHash, u.Version, u.UpdatedAt, u.ID)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateUsername()
		}
		return nil, err
	}
	echoAPIToken(u)
	return u, nil
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
	_, err = s.Exec("UPDATE `user` SET api_token_hash = ?, api_token_enc = ?, version = ?, updated_at = ? WHERE id = ?",
		u.APITokenHash, u.APITokenEnc, u.Version, u.UpdatedAt, u.ID)
	return u, err
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
