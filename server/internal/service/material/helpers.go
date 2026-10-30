package material

import (
	"strings"

	"github.com/shopspring/decimal"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
)

// Image 是一条图片关联（按 sort_order 排序），带已加载的文件对象。
type Image struct {
	FileID    string
	SortOrder int64
	File      model.FileObject
}

// FileReads 组装图片读模型（file_read）。
func FileReads(images []Image) []schema.FileObjectRead {
	out := make([]schema.FileObjectRead, len(images))
	for i := range images {
		out[i] = schema.FileRead(&images[i].File)
	}
	return out
}

// ImageIDs 关联的文件 id（按 sort_order）。
func ImageIDs(images []Image) []string {
	out := make([]string, len(images))
	for i, img := range images {
		out[i] = img.FileID
	}
	return out
}

// scopeAnd 返回 " AND <alias>project_id = ?"（系统上下文返回空串）。
func scopeAnd(s *db.Session, alias string) (string, []any, error) {
	cond, args, err := s.ScopeFilter(alias)
	if err != nil {
		return "", nil, err
	}
	if cond == "1=1" {
		return "", nil, nil
	}
	return " AND " + cond, args, nil
}

// prefixCols 给 model.ColsXxx 的每一列加表别名前缀（兼容反引号 / 双引号两种引用风格，统一输出反引号）。
func prefixCols(cols, alias string) string {
	parts := strings.Split(cols, ",")
	for i, p := range parts {
		name := strings.Trim(strings.TrimSpace(p), "`\"")
		parts[i] = alias + "`" + name + "`"
	}
	return strings.Join(parts, ", ")
}

// Files 对应 material_service._files：按传入顺序返回文件；缺失时报 INVALID_IMAGE_ID。
func Files(s *db.Session, imageIDs []string) ([]model.FileObject, error) {
	if len(imageIDs) == 0 {
		return []model.FileObject{}, nil
	}
	var files []model.FileObject
	if err := s.SelectIn(&files, "SELECT "+model.ColsFileObject+" FROM file_object WHERE id IN (?)", imageIDs); err != nil {
		return nil, err
	}
	byID := make(map[string]model.FileObject, len(files))
	for _, f := range files {
		byID[f.ID] = f
	}
	missing := []string{}
	for _, id := range imageIDs {
		if _, ok := byID[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) > 0 {
		return nil, apperr.New("INVALID_IMAGE_ID", "图片不存在").WithDetails(apperr.D{"file_ids": missing})
	}
	out := make([]model.FileObject, len(imageIDs))
	for i, id := range imageIDs {
		out[i] = byID[id]
	}
	return out, nil
}

func imagesFromFiles(files []model.FileObject) []Image {
	out := make([]Image, len(files))
	for i, f := range files {
		out[i] = Image{FileID: f.ID, SortOrder: int64(i), File: f}
	}
	return out
}

type imageRow struct {
	OwnerID   int64 `db:"link_owner_id"`
	SortOrder int64 `db:"link_sort_order"`
	model.FileObject
}

// loadImages 一次 IN 查询加载多个主体的图片（selectin，按 sort_order）。
func loadImages(s *db.Session, table, ownerCol string, ownerIDs []int64) (map[int64][]Image, error) {
	out := map[int64][]Image{}
	if len(ownerIDs) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "i.")
	if err != nil {
		return nil, err
	}
	var rows []imageRow
	q := "SELECT i.`" + ownerCol + "` AS link_owner_id, i.sort_order AS link_sort_order, " + prefixCols(model.ColsFileObject, "f.") +
		" FROM `" + table + "` i JOIN file_object f ON f.id = i.file_id WHERE i.`" + ownerCol + "` IN (?)" + scope +
		" ORDER BY i.`" + ownerCol + "`, i.sort_order"
	if err := s.SelectIn(&rows, q, append([]any{ownerIDs}, sargs...)...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.OwnerID] = append(out[r.OwnerID], Image{FileID: r.FileObject.ID, SortOrder: r.SortOrder, File: r.FileObject})
	}
	return out, nil
}

// replaceImages 整表替换图片关联（delete-orphan + 新列表按顺序写 sort_order）。
func replaceImages(s *db.Session, table, ownerCol string, ownerID int64, files []model.FileObject) error {
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	if _, err := s.Exec("DELETE FROM `"+table+"` WHERE `"+ownerCol+"` = ? AND project_id = ?", ownerID, pid); err != nil {
		return err
	}
	return insertImages(s, table, ownerCol, ownerID, files)
}

func insertImages(s *db.Session, table, ownerCol string, ownerID int64, files []model.FileObject) error {
	if len(files) == 0 {
		return nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	values := make([]string, len(files))
	args := make([]any, 0, len(files)*4)
	for i, f := range files {
		values[i] = "(?, ?, ?, ?)"
		args = append(args, ownerID, f.ID, i, pid)
	}
	_, err = s.Exec("INSERT INTO `"+table+"` (`"+ownerCol+"`, file_id, sort_order, project_id) VALUES "+strings.Join(values, ", "), args...)
	return err
}

// pyDecStr 等价 Python str(Decimal)：保留原始小数位（"5.0" 仍是 "5.0"）。
func pyDecStr(d jtype.Decimal) string {
	if exp := d.Exponent(); exp < 0 {
		return d.StringFixed(-exp)
	}
	return d.Decimal.String()
}

var zero = jtype.Decimal{Decimal: decimal.Zero}

func emptyToNil(p *string) *string {
	if p == nil || *p == "" {
		return nil
	}
	return p
}
