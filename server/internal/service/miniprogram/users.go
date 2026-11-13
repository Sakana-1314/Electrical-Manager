package miniprogram

import (
	"crypto/md5"
	"encoding/hex"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/appsettings"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/webhook"
)

// User 是统一用户在小程序端的读取结构（openid 直存 app_user）；权限位图在 model.User.Permissions。
type User struct {
	model.User
}

func accountDisabled() error {
	return apperr.New("ACCOUNT_DISABLED", "您的账号待审核，请联系管理员").WithStatus(403)
}

func registrationDisabled() error {
	return apperr.New("MINI_PROGRAM_REGISTRATION_DISABLED", "当前暂未开放新用户绑定，请联系管理员").WithStatus(403)
}

// UserRead 对应 MiniProgramUserRead.model_validate(user)：permissions（权限位展开的键）供小程序端门禁。
func UserRead(s *db.Session, u *User) schema.MiniProgramUserRead {
	return schema.MiniProgramUserRead{
		ID: u.ID, DisplayName: u.DisplayName, DepartmentName: u.DepartmentName, Enabled: u.Enabled,
		WechatOpenid: u.WechatOpenid, Permissions: domain.Permission(u.Permissions).Normalize().Keys(),
		LastUsedAt: common.UTCPtr(u.LastUsedAt),
		CreatedAt:  jtype.NewUTC(u.CreatedAt), UpdatedAt: jtype.NewUTC(u.UpdatedAt), Version: u.Version,
	}
}

// getUser 对应 session.get(User, id)；不存在返回 nil。
func getUser(s *db.Session, id int64, forUpdate bool) (*User, error) {
	q := "SELECT " + model.ColsUser + " FROM app_user WHERE id = ?"
	if forUpdate {
		q += " FOR UPDATE"
	}
	var m model.User
	ok, err := s.Find(&m, q, id)
	if err != nil || !ok {
		return nil, err
	}
	return &User{User: m}, nil
}

// GetUser 按 id 读取小程序用户，不存在返回 nil。
func GetUser(s *db.Session, id int64) (*User, error) { return getUser(s, id, false) }

// LoadUser 为已鉴权的小程序用户构造读取结构（/me 等接口用）。
func LoadUser(s *db.Session, m *model.User) (*User, error) {
	return &User{User: *m}, nil
}

// findUserByOpenid 按微信 openid 查用户（单小程序，openid 直接落在 app_user 表），不存在返回 nil。
func findUserByOpenid(s *db.Session, openid string) (*User, error) {
	var m model.User
	ok, err := s.Find(&m, "SELECT "+model.ColsUser+" FROM app_user WHERE wechat_openid = ? LIMIT 1", openid)
	if err != nil || !ok {
		return nil, err
	}
	return &User{User: m}, nil
}

// miniProgramUsername 由 openid 派生唯一用户名（openid 本身可含特殊字符，这里哈希定长化）。
func miniProgramUsername(openid string) string {
	sum := md5.Sum([]byte(openid))
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
	user, err := findUserByOpenid(s, openid)
	if err != nil {
		return nil, "", "", err
	}
	if user != nil && !user.Enabled {
		return nil, "", "", accountDisabled()
	}
	if user == nil {
		enabled, err := appsettings.IsMiniProgramRegistrationEnabled(s)
		if err != nil {
			return nil, "", "", err
		}
		if !enabled {
			return nil, "", "", registrationDisabled()
		}
	}
	if user != nil {
		// 待审核 / 已停用账号在上面的分支被拒，不会走到这里。
		if err := auth.MarkLastUsed(s, &user.User); err != nil {
			return nil, "", "", err
		}
	}
	return user, effectiveAppID, openid, nil
}

// RegisterUser 对应 register_user：按注册凭证里的 openid 建统一用户档案，
// 默认权限位 = 高级设置里的默认用户权限，新用户一律直接启用（能做什么由权限位决定）。
// 已存在时按一次登录处理且不覆盖姓名 / 部门。
func RegisterUser(s *db.Session, appID, openid, displayName, departmentName string) (*User, error) {
	existing, err := findUserByOpenid(s, openid)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		if !existing.Enabled {
			return nil, accountDisabled()
		}
		// 重复建档（registration_token 重放）同样按一次登录记录，但不覆盖姓名 / 部门。
		if err := auth.MarkLastUsed(s, &existing.User); err != nil {
			return nil, err
		}
		return existing, nil
	}
	registrationEnabled, err := appsettings.IsMiniProgramRegistrationEnabled(s)
	if err != nil {
		return nil, err
	}
	if !registrationEnabled {
		return nil, registrationDisabled()
	}
	defaultPermissions, err := appsettings.GetDefaultPermissions(s)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	user := &User{User: model.User{
		Username: miniProgramUsername(openid), PasswordHash: "", APITokenHash: "", APITokenEnc: "",
		DisplayName: displayName, DepartmentName: departmentName,
		WechatOpenid: &openid, Permissions: int64(defaultPermissions),
		Enabled: true, LastUsedAt: &now, CreatedAt: now, UpdatedAt: now, Version: 1,
	}}
	conflict := func(err error) error {
		if db.IsIntegrity(err) {
			return apperr.New("WECHAT_USER_CREATE_CONFLICT", "微信用户创建冲突，请重新登录").WithStatus(409)
		}
		return err
	}
	id, err := s.Insert("INSERT INTO app_user (username, password_hash, api_token_hash, api_token_enc, display_name, department_name, wechat_openid, permissions, enabled, last_used_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		user.Username, user.PasswordHash, user.APITokenHash, user.APITokenEnc, user.DisplayName, user.DepartmentName,
		user.WechatOpenid, user.Permissions, user.Enabled, user.LastUsedAt, user.CreatedAt, user.UpdatedAt, user.Version)
	if err != nil {
		return nil, conflict(err)
	}
	user.ID = id
	if err := webhook.EnqueueEvent(s, domain.EventMiniProgramUserBound, map[string]any{
		"display_name":    user.DisplayName,
		"department_name": user.DepartmentName,
		"app_id":          appID,
		"enabled":         user.Enabled,
		"permissions":     domain.Permission(user.Permissions).Keys(),
		"bound_at":        user.CreatedAt.Format(time.DateOnly+"T15:04:05") + "Z",
	}); err != nil {
		return nil, err
	}
	return user, nil
}
