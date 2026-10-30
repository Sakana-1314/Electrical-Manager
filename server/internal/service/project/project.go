// Package project 对应原 services/project_service.py：项目管理与默认项目解析。
package project

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// List 全部项目（含停用）：默认项目排最前，其余按创建顺序。
func List(s *db.Session) ([]model.Project, error) {
	var items []model.Project
	err := s.Select(&items, "SELECT "+model.ColsProject+" FROM project ORDER BY is_default DESC, id")
	return items, err
}

// Get 按 id 读取，不存在报 PROJECT_NOT_FOUND。
func Get(s *db.Session, id int64) (*model.Project, error) {
	p, err := auth.GetProject(s, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperr.New("PROJECT_NOT_FOUND", "项目不存在").WithStatus(400)
	}
	return p, nil
}

var (
	DefaultProject        = auth.DefaultProject
	RequireDefaultProject = auth.RequireDefaultProject
)

// CountProjectRows 项目下的业务数据行数合计（删除前校验，跨项目统计）。
func CountProjectRows(s *db.Session, projectID int64) (int64, error) {
	var total int64
	for _, table := range model.ProjectScopedTables {
		var n int64
		if err := s.Get(&n, "SELECT COUNT(*) FROM `"+table+"` WHERE project_id = ?", projectID); err != nil {
			return 0, err
		}
		total += n
	}
	return total, nil
}

func clearOtherDefaults(s *db.Session, keepID int64) error {
	_, err := s.Exec("UPDATE project SET is_default = FALSE, version = version + 1, updated_at = ? WHERE is_default = TRUE AND id <> ?", common.UTCNow(), keepID)
	return err
}

func duplicateName() error {
	return apperr.New("DUPLICATE_PROJECT_NAME", "项目名称已存在").WithStatus(409)
}

func Create(s *db.Session, data schema.ProjectCreate) (*model.Project, error) {
	if data.IsDefault && !data.Enabled {
		return nil, apperr.New("PROJECT_IS_DEFAULT", "默认项目必须是启用状态").WithStatus(409)
	}
	now := common.UTCNow()
	p := &model.Project{Name: data.Name, Enabled: data.Enabled, IsDefault: data.IsDefault, Remark: data.Remark, CreatedAt: now, UpdatedAt: now, Version: 1}
	id, err := s.Insert("INSERT INTO project (name, enabled, is_default, remark, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
		p.Name, p.Enabled, p.IsDefault, p.Remark, p.CreatedAt, p.UpdatedAt, p.Version)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateName()
		}
		return nil, err
	}
	p.ID = id
	if p.IsDefault {
		if err := clearOtherDefaults(s, p.ID); err != nil {
			return nil, err
		}
	}
	return p, nil
}

func Update(s *db.Session, id int64, data schema.ProjectUpdate) (*model.Project, error) {
	p, err := auth.GetProject(s, id)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, apperr.NotFound("项目")
	}
	if err := apperr.ValidateVersion(&data.Version, p.Version); err != nil {
		return nil, err
	}
	enabled := p.Enabled
	if data.Enabled != nil {
		enabled = *data.Enabled
	}
	if p.IsDefault {
		if data.Enabled != nil && !*data.Enabled {
			return nil, apperr.New("PROJECT_IS_DEFAULT", "默认项目不能停用").WithStatus(409)
		}
		if data.IsDefault != nil && !*data.IsDefault {
			return nil, apperr.New("PROJECT_IS_DEFAULT", "不能取消默认项目，请改设其他项目为默认").WithStatus(409)
		}
	}
	if data.IsDefault != nil && *data.IsDefault && !enabled {
		return nil, apperr.New("PROJECT_IS_DEFAULT", "默认项目必须是启用状态").WithStatus(409)
	}
	if data.Name != nil {
		p.Name = *data.Name
	}
	if data.Enabled != nil {
		p.Enabled = *data.Enabled
	}
	if data.IsDefault != nil {
		p.IsDefault = *data.IsDefault
	}
	if data.Remark != nil {
		p.Remark = data.Remark
	}
	p.Version++
	p.UpdatedAt = common.UTCNow()
	_, err = s.Exec("UPDATE project SET name = ?, enabled = ?, is_default = ?, remark = ?, version = ?, updated_at = ? WHERE id = ?",
		p.Name, p.Enabled, p.IsDefault, p.Remark, p.Version, p.UpdatedAt, p.ID)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateName()
		}
		return nil, err
	}
	if p.IsDefault {
		if err := clearOtherDefaults(s, p.ID); err != nil {
			return nil, err
		}
	}
	return p, nil
}

func Delete(s *db.Session, id int64, ifMatch *int64) error {
	p, err := auth.GetProject(s, id)
	if err != nil {
		return err
	}
	if p == nil {
		return apperr.NotFound("项目")
	}
	if err := apperr.ValidateVersion(ifMatch, p.Version); err != nil {
		return err
	}
	if p.IsDefault {
		return apperr.New("PROJECT_IS_DEFAULT", "默认项目不能删除").WithStatus(409)
	}
	n, err := CountProjectRows(s, p.ID)
	if err != nil {
		return err
	}
	if n > 0 {
		return apperr.New("PROJECT_IN_USE", "该项目下已有业务数据，不能删除；如需停用请改为「停用」").WithStatus(409)
	}
	if _, err := s.Exec("DELETE FROM project WHERE id = ?", p.ID); err != nil {
		if db.IsIntegrity(err) {
			return apperr.New("PROJECT_IN_USE", "该项目下已有业务数据，不能删除").WithStatus(409)
		}
		return err
	}
	return nil
}
