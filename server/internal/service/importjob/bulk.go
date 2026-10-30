package importjob

import (
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// InsertBatchSize 与原 service 的 INSERT_BATCH_SIZE 一致。
const InsertBatchSize = 2000

// ReplaceProjectRows 在 s 的项目上下文里整表替换：DELETE 本项目全部行 → 分批多值 INSERT → Commit。
// cols 不含 project_id / created_at（自动补当前项目与当前 UTC 时间）。
func ReplaceProjectRows(s *db.Session, table string, cols []string, rows [][]any) error {
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	if _, err := s.Exec("DELETE FROM `"+table+"` WHERE project_id = ?", pid); err != nil {
		return err
	}
	allCols := append(append([]string{}, cols...), "project_id", "created_at")
	quoted := make([]string, len(allCols))
	for i, c := range allCols {
		quoted[i] = "`" + c + "`"
	}
	rowPlaceholder := "(" + common.Placeholders(len(allCols)) + ")"
	now := common.UTCNow()
	for off := 0; off < len(rows); off += InsertBatchSize {
		batch := rows[off:min(off+InsertBatchSize, len(rows))]
		var sb strings.Builder
		sb.WriteString("INSERT INTO `" + table + "` (" + strings.Join(quoted, ", ") + ") VALUES ")
		args := make([]any, 0, len(batch)*len(allCols))
		for i, r := range batch {
			if i > 0 {
				sb.WriteString(", ")
			}
			sb.WriteString(rowPlaceholder)
			args = append(args, r...)
			args = append(args, pid, now)
		}
		if _, err := s.Exec(sb.String(), args...); err != nil {
			return err
		}
	}
	return s.Commit()
}
