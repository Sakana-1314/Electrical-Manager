// Package importjob 对应原 services/import_job_service.py：Excel 导入任务（物料编码库 / 物料价格 /
// 华星库存 / 精简二级库共用）。
//
// 接口层只负责上传落盘 + 登记任务并返回 202，真正的解析与全量替换放到后台 goroutine 里执行。
// 任务生命周期 PENDING → RUNNING → SUCCEEDED | FAILED 持久化在 excel_import_job 表，前端轮询状态端点。
// 启动时把残留 PENDING/RUNNING 任务标记失败（lifecycle order 10），并清理过期终态任务（order 11）。
//
// 处理器约定：各模块 service 提供 Processor，在传入的项目会话里完成数据表事务
// （DELETE 本项目数据 + 分批 INSERT + 自行 Commit）；本包对业务完全无感知。
package importjob

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
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
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
)

// Processor 是导入处理器：s 是任务所属项目的独立会话（处理器自行 Commit；未提交的部分由调用方回滚），
// filePath 是上传落盘的临时文件，返回值写入任务的 result 列。
type Processor func(ctx context.Context, s *db.Session, filePath string) (map[string]any, error)

const (
	ImportDirName = "imports"
	// DefaultRetentionDays 是终态任务行的保留天数。
	DefaultRetentionDays = 30
)

var (
	// typeLocks 按 import_type 串行化「检查进行中 + 登记」两步，保证 409 判断原子（单进程内）。
	typeLocks sync.Map // string → *sync.Mutex
	// running 跟踪运行中的后台任务（测试 / 优雅退出时可等待）。
	running sync.WaitGroup
)

func typeLock(importType string) *sync.Mutex {
	l, _ := typeLocks.LoadOrStore(importType, &sync.Mutex{})
	return l.(*sync.Mutex)
}

func init() {
	lifecycle.OnStartup(10, "mark stale excel import jobs", func(ctx context.Context) error {
		n, err := MarkStaleJobsFailed(ctx)
		if err != nil {
			return err
		}
		if n > 0 {
			slog.Info(fmt.Sprintf("marked %d stale excel import jobs as failed", n))
		}
		return nil
	})
	lifecycle.OnStartup(11, "purge finished excel import jobs", func(ctx context.Context) error {
		n, err := CleanupFinishedJobs(ctx, DefaultRetentionDays)
		if err != nil {
			return err
		}
		if n > 0 {
			slog.Info(fmt.Sprintf("purged %d finished excel import jobs", n))
		}
		return nil
	})
}

// Wait 等待当前全部后台导入任务结束。
func Wait() { running.Wait() }

// SaveUpload 把上传文件写到 <upload_dir>/imports/<uuid7><suffix>，超过 maxBytes 报 EXCEL_FILE_TOO_LARGE。
func SaveUpload(fh *multipart.FileHeader, maxBytes int64) (string, error) {
	filename := fh.Filename
	if filename == "" {
		filename = "upload.xlsx"
	}
	suffix := strings.ToLower(importfile.PySuffix(filename))
	if suffix == "" {
		suffix = ".xlsx"
	}
	dir := filepath.Join(config.S.UploadDir, ImportDirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	target := filepath.Join(dir, security.UUID7()+suffix)
	if err := streamToDisk(fh, target, maxBytes); err != nil {
		_ = os.Remove(target)
		return "", err
	}
	return target, nil
}

func streamToDisk(fh *multipart.FileHeader, target string, maxBytes int64) error {
	src, err := fh.Open()
	if err != nil {
		return err
	}
	defer src.Close()
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	n, err := io.Copy(out, io.LimitReader(src, maxBytes+1))
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}
	if n > maxBytes {
		return apperr.New("EXCEL_FILE_TOO_LARGE", "导入文件不能超过 50 MB")
	}
	return nil
}

// RemoveFile 删除临时文件（不存在时忽略），对应 Path.unlink(missing_ok=True)。
func RemoveFile(path string) {
	if path == "" {
		return
	}
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		slog.Warn("remove import file failed", "path", path, "error", err)
	}
}

// EnqueueImport 登记 PENDING 任务并启动后台执行；同项目同类任务进行中时报 409 IMPORT_IN_PROGRESS。
// s 只用于取当前请求的项目上下文；登记在独立会话里立即提交。
func EnqueueImport(s *db.Session, importType, originalFilename, filePath string, processor Processor, createdBy *int64) (schema.ExcelImportJobRead, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return schema.ExcelImportJobRead{}, err
	}
	lock := typeLock(importType)
	lock.Lock()
	job, err := func() (*model.ExcelImportJob, error) {
		defer lock.Unlock()
		ss := db.ProjectSession(context.Background(), pid)
		defer ss.Close()
		var active int64
		found, err := ss.Find(&active,
			"SELECT id FROM excel_import_job WHERE project_id = ? AND import_type = ? AND status IN ('PENDING', 'RUNNING') LIMIT 1",
			pid, importType)
		if err != nil {
			return nil, err
		}
		if found {
			return nil, apperr.New("IMPORT_IN_PROGRESS", "同类导入任务正在进行中，请稍后再试").WithStatus(409)
		}
		now := common.UTCNow()
		job := &model.ExcelImportJob{
			ImportType:       importType,
			Status:           domain.JobPending,
			OriginalFilename: common.TruncateRunes(originalFilename, 255),
			FilePath:         filePath,
			CreatedBy:        createdBy,
			CreatedAt:        now,
			UpdatedAt:        now,
			ProjectID:        pid,
		}
		id, err := ss.Insert(
			"INSERT INTO excel_import_job (project_id, import_type, status, original_filename, file_path, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			pid, job.ImportType, job.Status, job.OriginalFilename, job.FilePath, job.CreatedBy, now, now)
		if err != nil {
			return nil, err
		}
		job.ID = id
		if err := ss.Commit(); err != nil {
			return nil, err
		}
		return job, nil
	}()
	if err != nil {
		return schema.ExcelImportJobRead{}, err
	}
	running.Add(1)
	go func() {
		defer running.Done()
		RunJob(context.Background(), job.ID, processor)
	}()
	return schema.NewExcelImportJobRead(job), nil
}

// GetImportJob 按 id + 类型读取当前项目的导入任务。
func GetImportJob(s *db.Session, importType string, jobID int64) (schema.ExcelImportJobRead, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return schema.ExcelImportJobRead{}, err
	}
	var job model.ExcelImportJob
	ok, err := s.Find(&job, "SELECT "+model.ColsExcelImportJob+" FROM excel_import_job WHERE id = ? AND import_type = ? AND project_id = ?", jobID, importType, pid)
	if err != nil {
		return schema.ExcelImportJobRead{}, err
	}
	if !ok {
		return schema.ExcelImportJobRead{}, apperr.New("NOT_FOUND", "导入任务不存在")
	}
	return schema.NewExcelImportJobRead(&job), nil
}

// LatestImportFinishedAt 当前项目该导入类型最近一次成功导入的完成时间（从未成功返回 nil）。
func LatestImportFinishedAt(s *db.Session, importType string) (*time.Time, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var finished *time.Time
	ok, err := s.Find(&finished,
		"SELECT finished_at FROM excel_import_job WHERE project_id = ? AND import_type = ? AND status = 'SUCCEEDED' ORDER BY finished_at DESC LIMIT 1",
		pid, importType)
	if err != nil || !ok {
		return nil, err
	}
	return finished, nil
}

// LastImportRead 便捷构造「上次导入」读模型。
func LastImportRead(s *db.Session, importType string) (schema.LastImportRead, error) {
	t, err := LatestImportFinishedAt(s, importType)
	if err != nil {
		return schema.LastImportRead{}, err
	}
	return schema.LastImportRead{LastImportAt: common.UTCPtr(t)}, nil
}

// MarkStaleJobsFailed 启动时清理：重启前遗留的 PENDING/RUNNING 任务标记失败并删除临时文件（跨项目）。
func MarkStaleJobsFailed(ctx context.Context) (int, error) {
	s := db.SystemSession(ctx)
	defer s.Close()
	var paths []string
	if err := s.Select(&paths, "SELECT file_path FROM excel_import_job WHERE status IN ('PENDING', 'RUNNING')"); err != nil {
		return 0, err
	}
	if len(paths) > 0 {
		now := common.UTCNow()
		if _, err := s.Exec(
			"UPDATE excel_import_job SET status = 'FAILED', error_code = 'SERVER_RESTARTED', error_message = ?, finished_at = ?, updated_at = ? WHERE status IN ('PENDING', 'RUNNING')",
			"服务重启，导入任务已中断", now, now); err != nil {
			return 0, err
		}
		if err := s.Commit(); err != nil {
			return 0, err
		}
	}
	for _, p := range paths {
		RemoveFile(p)
	}
	return len(paths), nil
}

// CleanupFinishedJobs 删除 retentionDays 天前已终态（SUCCEEDED/FAILED）的任务行（跨项目）。
func CleanupFinishedJobs(ctx context.Context, retentionDays int) (int64, error) {
	s := db.SystemSession(ctx)
	defer s.Close()
	cutoff := common.UTCNow().Add(-time.Duration(retentionDays) * 24 * time.Hour)
	res, err := s.Exec("DELETE FROM excel_import_job WHERE status IN ('SUCCEEDED', 'FAILED') AND finished_at < ?", cutoff)
	if err != nil {
		return 0, err
	}
	if err := s.Commit(); err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return n, nil
}

// RunJob 后台执行：置 RUNNING → 运行处理器（任务所属项目上下文）→ 写结果/错误 → 删除临时文件。
func RunJob(ctx context.Context, jobID int64, processor Processor) {
	var job model.ExcelImportJob
	ok, err := func() (bool, error) {
		s := db.SystemSession(ctx)
		defer s.Close()
		ok, err := s.Find(&job, "SELECT "+model.ColsExcelImportJob+" FROM excel_import_job WHERE id = ?", jobID)
		if err != nil || !ok {
			return ok, err
		}
		now := common.UTCNow()
		if _, err := s.Exec("UPDATE excel_import_job SET status = 'RUNNING', started_at = ?, updated_at = ? WHERE id = ?", now, now, jobID); err != nil {
			return false, err
		}
		return true, s.Commit()
	}()
	if err != nil {
		slog.Error(fmt.Sprintf("import job crashed job_id=%d error=%v", jobID, err))
		return
	}
	if !ok {
		return
	}
	filePath := job.FilePath
	defer RemoveFile(filePath)

	result, errCode, errMsg := runProcessor(ctx, jobID, job.ProjectID, filePath, processor)

	s := db.ProjectSession(ctx, job.ProjectID)
	defer s.Close()
	status := domain.JobSucceeded
	if errCode != nil {
		status = domain.JobFailed
	}
	var resultJSON jtype.JSON
	if result != nil {
		if resultJSON, err = jtype.ToJSON(result); err != nil {
			slog.Error(fmt.Sprintf("import job result encode failed job_id=%d error=%v", jobID, err))
		}
	}
	now := common.UTCNow()
	if _, err := s.Exec(
		"UPDATE excel_import_job SET status = ?, result = ?, error_code = ?, error_message = ?, finished_at = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		status, resultJSON, errCode, errMsg, now, now, jobID, job.ProjectID); err != nil {
		slog.Error(fmt.Sprintf("import job finalize failed job_id=%d error=%v", jobID, err))
		return
	}
	if err := s.Commit(); err != nil {
		slog.Error(fmt.Sprintf("import job finalize failed job_id=%d error=%v", jobID, err))
	}
}

func runProcessor(ctx context.Context, jobID, projectID int64, filePath string, processor Processor) (result map[string]any, errCode, errMsg *string) {
	defer func() {
		if r := recover(); r != nil {
			slog.Error(fmt.Sprintf("import job crashed job_id=%d panic=%v", jobID, r))
			result = nil
			errCode = common.StrPtr("INTERNAL_IMPORT_ERROR")
			errMsg = common.StrPtr("导入任务发生未知错误")
		}
	}()
	s := db.ProjectSession(ctx, projectID)
	defer s.Close()
	res, err := processor(ctx, s, filePath)
	if err == nil {
		return res, nil, nil
	}
	var ae *apperr.Error
	if errors.As(err, &ae) {
		slog.Warn(fmt.Sprintf("import job failed job_id=%d code=%s", jobID, ae.Code))
		return nil, common.StrPtr(ae.Code), common.StrPtr(common.TruncateRunes(ae.Message, 1000))
	}
	slog.Error(fmt.Sprintf("import job crashed job_id=%d error=%v", jobID, err))
	return nil, common.StrPtr("INTERNAL_IMPORT_ERROR"), common.StrPtr("导入任务发生未知错误")
}
