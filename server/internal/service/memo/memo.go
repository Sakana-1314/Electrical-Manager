// Package memo 对应原 services/memo_service.py：个人备忘录，按创建人隔离。
package memo

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const DefaultTitle = "未命名备忘录"

func normalizeTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return DefaultTitle
	}
	return title
}

// List 当前用户的全部备忘录，最近更新的排前面。
func List(s *db.Session, userID int64) ([]model.Memo, error) {
	var items []model.Memo
	err := s.Select(&items, "SELECT "+model.ColsMemo+" FROM memo WHERE created_by = ? ORDER BY updated_at DESC, id DESC", userID)
	return items, err
}

// GetOwn 读取当前用户的一条备忘录；不存在或不属于该用户统一视为不存在。
func GetOwn(s *db.Session, memoID, userID int64) (*model.Memo, error) {
	var m model.Memo
	ok, err := s.Find(&m, "SELECT "+model.ColsMemo+" FROM memo WHERE id = ?", memoID)
	if err != nil {
		return nil, err
	}
	if !ok || m.CreatedBy != userID {
		return nil, apperr.NotFound("备忘录")
	}
	return &m, nil
}

func Create(s *db.Session, userID int64, data schema.MemoCreate) (*model.Memo, error) {
	now := common.UTCNow()
	m := model.Memo{Title: normalizeTitle(data.Title), Content: data.Content, CreatedBy: userID, CreatedAt: now, UpdatedAt: now, Version: 1}
	id, err := s.Insert("INSERT INTO memo (title, content, created_by, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?)",
		m.Title, m.Content, m.CreatedBy, m.CreatedAt, m.UpdatedAt, m.Version)
	if err != nil {
		return nil, err
	}
	m.ID = id
	return &m, nil
}

func Update(s *db.Session, memoID, userID int64, data schema.MemoUpdate) (*model.Memo, error) {
	m, err := GetOwn(s, memoID, userID)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.Version, m.Version); err != nil {
		return nil, err
	}
	if data.Title != nil {
		m.Title = normalizeTitle(*data.Title)
	}
	if data.Content != nil {
		m.Content = *data.Content
	}
	m.Version++
	m.UpdatedAt = common.UTCNow()
	_, err = s.Exec("UPDATE memo SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?", m.Title, m.Content, m.Version, m.UpdatedAt, m.ID)
	return m, err
}

func Delete(s *db.Session, memoID, userID int64) error {
	m, err := GetOwn(s, memoID, userID)
	if err != nil {
		return err
	}
	_, err = s.Exec("DELETE FROM memo WHERE id = ?", m.ID)
	return err
}
