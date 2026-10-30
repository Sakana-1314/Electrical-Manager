// Package system 是认证、用户（基础数据）、项目、备忘录、版本信息接口。
package system

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/dictionary"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/memo"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/project"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	a := r.Group("/auth")
	a.POST("/login", login)
	a.POST("/refresh", refresh)
	a.GET("/me", me, auth.CurrentUser)

	r.GET("/users", listUsers, auth.SuperAdmin)
	r.POST("/users", addUser, auth.SuperAdmin)
	r.PATCH("/users/{item_id}", editUser, auth.SuperAdmin)
	r.POST("/users/{item_id}/api-token/regenerate", regenerateToken, auth.SuperAdmin)
	r.DELETE("/users/{item_id}", removeUser, auth.SuperAdmin)

	m := r.Group("/memos")
	m.GET("", listMemos, auth.CurrentUser)
	m.POST("", createMemo, auth.CurrentUser)
	m.PATCH("/{memo_id}", updateMemo, auth.CurrentUser)
	m.DELETE("/{memo_id}", deleteMemo, auth.CurrentUser)

	r.GET("/version", version)
}

// RegisterProjects 项目管理路由（注册顺序靠后，与原版 openapi 顺序一致）。
func RegisterProjects(r *web.Router) {
	r.GET("/projects", listProjects, auth.CurrentUser)
	r.POST("/projects", addProject, auth.SuperAdmin)
	r.PATCH("/projects/{item_id}", editProject, auth.SuperAdmin)
	r.DELETE("/projects/{item_id}", removeProject, auth.SuperAdmin)
}

// ---------------- 认证 ----------------

func login(c *web.Ctx) error {
	p := c.Params()
	var data schema.LoginRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	var u model.User
	ok, err := c.DB.Find(&u, "SELECT "+model.ColsUser+" FROM `user` WHERE username = ?", data.Username)
	if err != nil {
		return err
	}
	if !ok || !u.Enabled || !security.VerifyPassword(data.Password, u.PasswordHash) {
		return apperr.New("INVALID_CREDENTIALS", "用户名或密码错误").WithStatus(401)
	}
	return c.OK(schema.LoginResponse{
		AccessToken:  security.CreateAccessToken(u.ID),
		RefreshToken: security.CreateRefreshToken(u.ID, u.Version),
		TokenType:    "bearer",
		User:         schema.NewUserRead(&u),
	})
}

func refresh(c *web.Ctx) error {
	p := c.Params()
	var data schema.RefreshTokenRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	invalid := apperr.New("INVALID_REFRESH_TOKEN", "续期凭证无效或已过期").WithStatus(401)
	claims, err := security.DecodeAccessToken(data.RefreshToken)
	if err != nil {
		return invalid
	}
	if tt, _ := claims["token_type"].(string); tt != "management_refresh" {
		return invalid
	}
	userID, ok1 := security.ClaimInt(claims, "sub")
	tokenVersion, ok2 := security.ClaimInt(claims, "version")
	if !ok1 || !ok2 {
		return invalid
	}
	u, err := auth.GetUser(c.DB, userID)
	if err != nil {
		return err
	}
	if u == nil || !u.Enabled || u.Version != tokenVersion {
		return invalid
	}
	return c.OK(schema.TokenPairResponse{
		AccessToken:  security.CreateAccessToken(u.ID),
		RefreshToken: security.CreateRefreshToken(u.ID, u.Version),
		TokenType:    "bearer",
	})
}

func me(c *web.Ctx) error { return c.OK(schema.NewUserRead(auth.User(c))) }

// ---------------- 用户 ----------------

func listUsers(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := dictionary.ListUsers(c.DB, keyword, page, size)
	if err != nil {
		return err
	}
	out := make([]schema.UserApiTokenRead, len(items))
	for i := range items {
		out[i] = items[i].Read()
	}
	return c.OK(schema.NewPage(out, page, size, total))
}

func addUser(c *web.Ctx) error {
	p := c.Params()
	data := schema.UserCreate{Enabled: true}
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := dictionary.CreateUser(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(u.Read())
}

func editUser(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	var data schema.UserUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := dictionary.UpdateUser(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(u.Read())
}

func regenerateToken(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	var data schema.UserApiTokenRegenerate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	u, err := dictionary.RegenerateAPIToken(c.DB, id, data.Version)
	if err != nil {
		return err
	}
	return c.OK(u.Read())
}

func removeUser(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := dictionary.DeleteUser(c.DB, id, c.UserID); err != nil {
		return err
	}
	return c.NoContent()
}

// ---------------- 项目 ----------------

func listProjects(c *web.Ctx) error {
	items, err := project.List(c.DB)
	if err != nil {
		return err
	}
	out := make([]schema.ProjectRead, len(items))
	for i := range items {
		out[i] = schema.NewProjectRead(&items[i])
	}
	return c.OK(out)
}

func addProject(c *web.Ctx) error {
	p := c.Params()
	data := schema.ProjectCreate{Enabled: true}
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := project.Create(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(schema.NewProjectRead(item))
}

func editProject(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("item_id")
	var data schema.ProjectUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := project.Update(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(schema.NewProjectRead(item))
}

func removeProject(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("item_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := project.Delete(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ---------------- 备忘录 ----------------

func listMemos(c *web.Ctx) error {
	items, err := memo.List(c.DB, c.UserID)
	if err != nil {
		return err
	}
	out := make([]schema.MemoRead, len(items))
	for i := range items {
		out[i] = schema.NewMemoRead(&items[i])
	}
	return c.OK(out)
}

func createMemo(c *web.Ctx) error {
	p := c.Params()
	var data schema.MemoCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	m, err := memo.Create(c.DB, c.UserID, data)
	if err != nil {
		return err
	}
	return c.Created(schema.NewMemoRead(m))
}

func updateMemo(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("memo_id")
	var data schema.MemoUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	m, err := memo.Update(c.DB, id, c.UserID, data)
	if err != nil {
		return err
	}
	return c.OK(schema.NewMemoRead(m))
}

func deleteMemo(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("memo_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := memo.Delete(c.DB, id, c.UserID); err != nil {
		return err
	}
	return c.NoContent()
}

// ---------------- 版本 ----------------

func version(c *web.Ctx) error {
	return c.OK(schema.VersionInfoRead{AppName: config.S.AppName, Version: "1.0.0", Commit: config.S.GitSHA, BuildTime: config.S.BuildTime})
}
