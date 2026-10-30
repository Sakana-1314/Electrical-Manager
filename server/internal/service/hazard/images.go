package hazard

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
)

// files 按传入顺序取图片对象；任一 id 不存在即报 INVALID_IMAGE_ID（对应 _files）。
func files(s *db.Session, imageIDs []string) ([]model.FileObject, error) {
	if len(imageIDs) == 0 {
		return nil, nil
	}
	var rows []model.FileObject
	if err := s.SelectIn(&rows, "SELECT "+model.ColsFileObject+" FROM file_object WHERE id IN (?)", imageIDs); err != nil {
		return nil, err
	}
	byID := make(map[string]model.FileObject, len(rows))
	for _, f := range rows {
		byID[f.ID] = f
	}
	missing := []string{}
	out := make([]model.FileObject, 0, len(imageIDs))
	for _, id := range imageIDs {
		f, ok := byID[id]
		if !ok {
			missing = append(missing, id)
			continue
		}
		out = append(out, f)
	}
	if len(missing) > 0 {
		return nil, apperr.New("INVALID_IMAGE_ID", "图片不存在").WithDetails(apperr.D{"file_ids": missing})
	}
	return out, nil
}

type imageRow struct {
	OwnerID      int64  `db:"owner_id"`
	ID           string `db:"id"`
	OriginalName string `db:"original_name"`
	MimeType     string `db:"mime_type"`
	SizeBytes    int64  `db:"size_bytes"`
	Width        int64  `db:"width"`
	Height       int64  `db:"height"`
}

// loadImages 批量加载一批记录的图片（selectin 关系，按 sort_order）。
func loadImages(s *db.Session, table, fk string, ownerIDs []int64) (map[int64][]schema.FileObjectRead, error) {
	out := map[int64][]schema.FileObjectRead{}
	if len(ownerIDs) == 0 {
		return out, nil
	}
	cond, args, err := s.ScopeFilter("l.")
	if err != nil {
		return nil, err
	}
	var rows []imageRow
	q := "SELECT l." + fk + " AS owner_id, f.id, f.original_name, f.mime_type, f.size_bytes, f.width, f.height FROM " +
		table + " l JOIN file_object f ON f.id = l.file_id WHERE " + cond + " AND l." + fk + " IN (?) ORDER BY l." + fk + ", l.sort_order"
	if err := s.SelectIn(&rows, q, append(args, ownerIDs)...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.OwnerID] = append(out[r.OwnerID], schema.FileObjectRead{ID: r.ID, OriginalName: r.OriginalName, MimeType: r.MimeType, SizeBytes: r.SizeBytes, Width: r.Width, Height: r.Height})
	}
	return out, nil
}

// replaceImages 整表替换一侧图片：按传入顺序重建关联行（sort_order = 下标）。
func replaceImages(s *db.Session, table, fk string, ownerID int64, items []model.FileObject) error {
	cond, args, err := s.ScopeFilter("")
	if err != nil {
		return err
	}
	if _, err := s.Exec("DELETE FROM "+table+" WHERE "+cond+" AND "+fk+" = ?", append(args, ownerID)...); err != nil {
		return err
	}
	return insertImages(s, table, fk, ownerID, items)
}

func insertImages(s *db.Session, table, fk string, ownerID int64, items []model.FileObject) error {
	if len(items) == 0 {
		return nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	args := make([]any, 0, len(items)*4)
	for i, f := range items {
		args = append(args, ownerID, f.ID, i, pid)
	}
	values := ""
	for i := range items {
		if i > 0 {
			values += ", "
		}
		values += "(?, ?, ?, ?)"
	}
	_, err = s.Exec("INSERT INTO "+table+" ("+fk+", file_id, sort_order, project_id) VALUES "+values, args...)
	return err
}

func fileReads(items []model.FileObject) []schema.FileObjectRead {
	out := make([]schema.FileObjectRead, len(items))
	for i := range items {
		out[i] = schema.FileRead(&items[i])
	}
	return out
}
