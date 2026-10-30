// Package exportjob 对应原 services/excel_export_job_service.py：异步 Excel 导出任务（申购记录 /
// 申购计划 / 申购审批表共用）。
//
// 接口层只负责登记任务并返回 202，真正的查库 + 渲染放到后台 goroutine 执行。任务生命周期
// PENDING → RUNNING → SUCCEEDED | FAILED 持久化在 excel_export_job 表，前端轮询状态端点，
// 终态后经匿名下载端点 GET /excel-export-jobs/files/{file_uuid} 取文件。
//
// 临时文件约定：处理器把渲染结果原子写入目标路径（excelexport.WriteExportFile）；失败即删；
// 成功保留至保留期（3 天）由清理任务删除；重启残留由 MarkStaleExportsFailed 置 FAILED 并删文件。
//
// 处理器约定：返回的 map 必须含非空 "download_filename"，可含 rows / image_count 等元信息。
package exportjob

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// Processor 是导出处理器：s 是任务所属项目的独立会话（只读查询即可，调用方负责关闭），
// target 是待写入的目标文件路径（用 excelexport.WriteExportFile 原子写入）。
type Processor func(ctx context.Context, s *db.Session, target string) (map[string]any, error)

const (
	ExportDirName = "exports"
	// RetentionDays 是成功文件的保留期：超过后由清理任务删除行与文件。
	RetentionDays = 3
)

var running sync.WaitGroup

func init() {
	lifecycle.OnStartup(20, "mark stale excel export jobs", func(ctx context.Context) error {
		n, err := MarkStaleExportsFailed(ctx)
		if err != nil {
			return err
		}
		if n > 0 {
			slog.Info(fmt.Sprintf("marked %d stale excel export jobs as failed", n))
		}
		return nil
	})
	lifecycle.OnStartup(21, "purge expired excel export jobs", func(ctx context.Context) error {
		n, err := CleanupFinishedExports(ctx, RetentionDays)
		if err != nil {
			return err
		}
		if n > 0 {
			slog.Info(fmt.Sprintf("purged %d expired excel export jobs", n))
		}
		return nil
	})
	lifecycle.Worker("excel-export-cleanup-worker", nil, RunCleanupWorker)
}

// Wait 等待当前全部后台导出任务结束。
func Wait() { running.Wait() }

// ExportsDir 返回（并创建）exports 目录。
func ExportsDir() (string, error) {
	dir := filepath.Join(config.S.UploadDir, ExportDirName)
	return dir, os.MkdirAll(dir, 0o755)
}

// NewExportTarget 生成导出文件目标路径（exports 目录下，uuid7 命名，后缀 .xlsx）。
func NewExportTarget() (string, error) {
	dir, err := ExportsDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, security.UUID7()+".xlsx"), nil
}

func removeFile(path string) {
	if path == "" {
		return
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		slog.Warn("remove export file failed", "path", path, "error", err)
	}
}

// EnqueueExport 登记 PENDING 任务并启动后台执行（导出只读，允许并发，不做 409 限制）。
// s 只用于取当前请求的项目上下文；params 是请求参数快照（序列化为 JSON，nil 存 NULL）。
func EnqueueExport(s *db.Session, exportType string, params any, processor Processor, createdBy *int64) (schema.ExcelExportJobRead, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	paramsJSON, err := jtype.ToJSON(params)
	if err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	ss := db.ProjectSession(context.Background(), pid)
	defer ss.Close()
	now := common.UTCNow()
	id, err := ss.Insert(
		"INSERT INTO excel_export_job (project_id, export_type, status, params, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		pid, exportType, domain.JobPending, paramsJSON, createdBy, now, now)
	if err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	if err := ss.Commit(); err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	// 读回（params 以数据库 JSON 列的规范形式返回，与 refresh 一致）。
	var job model.ExcelExportJob
	if err := ss.Get(&job, "SELECT "+model.ColsExcelExportJob+" FROM excel_export_job WHERE id = ? AND project_id = ?", id, pid); err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	_ = ss.Commit()
	running.Add(1)
	go func() {
		defer running.Done()
		RunJob(context.Background(), id, processor)
	}()
	return schema.NewExcelExportJobRead(&job), nil
}

// visibleTo 任务可见性：创建者本人或超级管理员（无创建者的任务所有人可见）。
func visibleTo(job *model.ExcelExportJob, user *model.User) bool {
	return job.CreatedBy == nil || *job.CreatedBy == user.ID || user.Role == domain.RoleSuperAdmin
}

// GetExportJob 读取当前项目的导出任务（属主校验，不可见按不存在处理）。
func GetExportJob(s *db.Session, jobID int64, user *model.User) (schema.ExcelExportJobRead, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	var job model.ExcelExportJob
	ok, err := s.Find(&job, "SELECT "+model.ColsExcelExportJob+" FROM excel_export_job WHERE id = ? AND project_id = ?", jobID, pid)
	if err != nil {
		return schema.ExcelExportJobRead{}, err
	}
	if !ok || !visibleTo(&job, user) {
		return schema.ExcelExportJobRead{}, apperr.New("NOT_FOUND", "导出任务不存在")
	}
	return schema.NewExcelExportJobRead(&job), nil
}

// GetExportFileByUUID 按文件 uuid 返回（文件路径, 下载文件名），供匿名下载端点使用。
// 以文件是否存在为准；任务行（跨项目查找）只用于提供友好下载名，缺失时回退 export_<uuid>.xlsx。
func GetExportFileByUUID(s *db.Session, fileUUID string) (string, string, error) {
	dir, err := ExportsDir()
	if err != nil {
		return "", "", err
	}
	path := filepath.Join(dir, fileUUID+".xlsx")
	var job model.ExcelExportJob
	found, err := s.System().Find(&job, "SELECT "+model.ColsExcelExportJob+" FROM excel_export_job WHERE file_path = ? LIMIT 1", path)
	if err != nil {
		return "", "", err
	}
	if st, err := os.Stat(path); err != nil || !st.Mode().IsRegular() {
		var status any
		if found {
			status = job.Status
		}
		slog.Warn(fmt.Sprintf("export file missing on download file_uuid=%s job_exists=%s job_status=%v",
			fileUUID, pyBool(found), pyNone(status)))
		return "", "", apperr.New("EXPORT_FILE_EXPIRED", "导出文件已过期或不存在，请重新导出")
	}
	name := "export_" + fileUUID + ".xlsx"
	if found && job.DownloadFilename != nil && *job.DownloadFilename != "" {
		name = *job.DownloadFilename
	}
	return path, name, nil
}

func pyBool(b bool) string {
	if b {
		return "True"
	}
	return "False"
}

func pyNone(v any) any {
	if v == nil {
		return "None"
	}
	return v
}

// MarkStaleExportsFailed 启动时清理：遗留 PENDING/RUNNING 任务标记失败并删除临时文件（跨项目）。
func MarkStaleExportsFailed(ctx context.Context) (int, error) {
	s := db.SystemSession(ctx)
	defer s.Close()
	var raw []*string
	if err := s.Select(&raw, "SELECT file_path FROM excel_export_job WHERE status IN ('PENDING', 'RUNNING')"); err != nil {
		return 0, err
	}
	var paths []string
	for _, p := range raw {
		if p != nil {
			paths = append(paths, *p)
		}
	}
	if len(paths) > 0 {
		now := common.UTCNow()
		if _, err := s.Exec(
			"UPDATE excel_export_job SET status = 'FAILED', error_code = 'SERVER_RESTARTED', error_message = ?, finished_at = ?, updated_at = ? WHERE status IN ('PENDING', 'RUNNING')",
			"服务重启，导出任务已中断", now, now); err != nil {
			return 0, err
		}
		if err := s.Commit(); err != nil {
			return 0, err
		}
	}
	for _, p := range paths {
		removeFile(p)
	}
	return len(paths), nil
}

// CleanupFinishedExports 删除 retentionDays 天前已终态的任务行及其文件，并清除 24 小时前的 .tmp 孤儿文件。
func CleanupFinishedExports(ctx context.Context, retentionDays int) (int, error) {
	cutoff := common.UTCNow().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	s := db.SystemSession(ctx)
	defer s.Close()
	var expired []struct {
		ID       int64   `db:"id"`
		FilePath *string `db:"file_path"`
	}
	if err := s.Select(&expired, "SELECT id, file_path FROM excel_export_job WHERE status IN ('SUCCEEDED', 'FAILED') AND finished_at < ?", cutoff); err != nil {
		return 0, err
	}
	if len(expired) > 0 {
		ids := make([]int64, len(expired))
		for i, e := range expired {
			ids[i] = e.ID
		}
		if _, err := s.ExecIn("DELETE FROM excel_export_job WHERE id IN (?)", ids); err != nil {
			return 0, err
		}
		if err := s.Commit(); err != nil {
			return 0, err
		}
	}
	for _, e := range expired {
		if e.FilePath != nil && *e.FilePath != "" {
			removeFile(*e.FilePath)
		}
	}
	sweepOrphanTmp()
	return len(expired), nil
}

func sweepOrphanTmp() int {
	dir := filepath.Join(config.S.UploadDir, ExportDirName)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	removed := 0
	cutoff := time.Now().Add(-24 * time.Hour)
	for _, e := range entries {
		if !strings.HasSuffix(e.Name(), ".tmp") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			if os.Remove(filepath.Join(dir, e.Name())) == nil {
				removed++
			}
		}
	}
	return removed
}

// RunCleanupWorker 每日保留期清理循环。
func RunCleanupWorker(ctx context.Context) {
	for {
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error(fmt.Sprintf("excel export cleanup worker crashed: %v", r))
				}
			}()
			purged, err := CleanupFinishedExports(ctx, RetentionDays)
			if err != nil {
				slog.Error(fmt.Sprintf("excel export cleanup worker crashed: %v", err))
				return
			}
			if purged > 0 {
				slog.Info(fmt.Sprintf("purged %d expired excel export jobs", purged))
			}
		}()
		select {
		case <-ctx.Done():
			return
		case <-time.After(24 * time.Hour):
		}
	}
}

// RunJob 后台执行：置 RUNNING（分配目标路径）→ 运行处理器（任务所属项目上下文）→ 写结果/错误 → 失败时删除目标文件。
func RunJob(ctx context.Context, jobID int64, processor Processor) {
	var job model.ExcelExportJob
	var filePath string
	ok, err := func() (bool, error) {
		s := db.SystemSession(ctx)
		defer s.Close()
		ok, err := s.Find(&job, "SELECT "+model.ColsExcelExportJob+" FROM excel_export_job WHERE id = ?", jobID)
		if err != nil || !ok {
			return ok, err
		}
		if job.FilePath != nil && *job.FilePath != "" {
			filePath = *job.FilePath
		} else if filePath, err = NewExportTarget(); err != nil {
			return false, err
		}
		now := common.UTCNow()
		if _, err := s.Exec("UPDATE excel_export_job SET status = 'RUNNING', started_at = ?, file_path = ?, updated_at = ? WHERE id = ?",
			now, filePath, now, jobID); err != nil {
			return false, err
		}
		return true, s.Commit()
	}()
	if err != nil {
		slog.Error(fmt.Sprintf("export job crashed job_id=%d error=%v", jobID, err))
		return
	}
	if !ok {
		return
	}

	result, downloadFilename, errCode, errMsg := runProcessor(ctx, jobID, job.ProjectID, filePath, processor)

	func() {
		s := db.ProjectSession(ctx, job.ProjectID)
		defer s.Close()
		status := domain.JobSucceeded
		if errCode != nil {
			status = domain.JobFailed
		}
		resultJSON, err := jtype.ToJSON(result)
		if err != nil {
			slog.Error(fmt.Sprintf("export job result encode failed job_id=%d error=%v", jobID, err))
		}
		now := common.UTCNow()
		if _, err := s.Exec(
			"UPDATE excel_export_job SET status = ?, download_filename = ?, result = ?, error_code = ?, error_message = ?, finished_at = ?, updated_at = ? WHERE id = ? AND project_id = ?",
			status, downloadFilename, resultJSON, errCode, errMsg, now, now, jobID, job.ProjectID); err != nil {
			slog.Error(fmt.Sprintf("export job finalize failed job_id=%d error=%v", jobID, err))
			return
		}
		if err := s.Commit(); err != nil {
			slog.Error(fmt.Sprintf("export job finalize failed job_id=%d error=%v", jobID, err))
		}
	}()
	if errCode != nil {
		// 失败即删：不留残缺 / 完成态文件；成功则保留至保留期由清理任务收敛。
		removeFile(filePath)
	}
}

func runProcessor(ctx context.Context, jobID, projectID int64, target string, processor Processor) (result map[string]any, downloadFilename, errCode, errMsg *string) {
	internal := func() {
		downloadFilename = nil
		errCode = common.StrPtr("INTERNAL_EXPORT_ERROR")
		errMsg = common.StrPtr("导出任务发生未知错误")
	}
	defer func() {
		if r := recover(); r != nil {
			slog.Error(fmt.Sprintf("export job crashed job_id=%d panic=%v", jobID, r))
			internal()
		}
	}()
	s := db.ProjectSession(ctx, projectID)
	defer s.Close()
	res, err := processor(ctx, s, target)
	if err == nil {
		result = res
		name, _ := res["download_filename"]
		text := ""
		if name != nil {
			text = fmt.Sprint(name)
		}
		if res == nil || text == "" {
			err = apperr.New("INTERNAL_EXPORT_ERROR", "导出任务未返回有效结果")
		} else {
			downloadFilename = common.StrPtr(common.TruncateRunes(text, 255))
			return
		}
	}
	var ae *apperr.Error
	if errors.As(err, &ae) {
		slog.Warn(fmt.Sprintf("export job failed job_id=%d code=%s", jobID, ae.Code))
		errCode = common.StrPtr(ae.Code)
		errMsg = common.StrPtr(common.TruncateRunes(ae.Message, 1000))
		downloadFilename = nil
		return
	}
	slog.Error(fmt.Sprintf("export job crashed job_id=%d error=%v", jobID, err))
	internal()
	return
}
