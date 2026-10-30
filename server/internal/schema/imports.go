package schema

import (
	"path/filepath"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// ExcelImportJobRead 是 Excel 导入任务读模型。
type ExcelImportJobRead struct {
	ID               int64          `json:"id"`
	ImportType       string         `json:"import_type"`
	Status           string         `json:"status"`
	OriginalFilename string         `json:"original_filename"`
	Result           jtype.JSON     `json:"result"`
	ErrorCode        *string        `json:"error_code"`
	ErrorMessage     *string        `json:"error_message"`
	CreatedAt        jtype.UTCTime  `json:"created_at"`
	StartedAt        *jtype.UTCTime `json:"started_at"`
	FinishedAt       *jtype.UTCTime `json:"finished_at"`
}

// importsUTCPtr 把可空的 naive UTC 时间包装为 *UTCTime。
func importsUTCPtr(t *time.Time) *jtype.UTCTime {
	if t == nil {
		return nil
	}
	v := jtype.NewUTC(*t)
	return &v
}

// NewExcelImportJobRead 由表行构造读模型。
func NewExcelImportJobRead(j *model.ExcelImportJob) ExcelImportJobRead {
	return ExcelImportJobRead{
		ID:               j.ID,
		ImportType:       j.ImportType,
		Status:           j.Status,
		OriginalFilename: j.OriginalFilename,
		Result:           j.Result,
		ErrorCode:        j.ErrorCode,
		ErrorMessage:     j.ErrorMessage,
		CreatedAt:        jtype.NewUTC(j.CreatedAt),
		StartedAt:        importsUTCPtr(j.StartedAt),
		FinishedAt:       importsUTCPtr(j.FinishedAt),
	}
}

// ExcelExportJobRead 是 Excel 导出任务读模型。
type ExcelExportJobRead struct {
	ID               int64   `json:"id"`
	ExportType       string  `json:"export_type"`
	Status           string  `json:"status"`
	DownloadFilename *string `json:"download_filename"`
	// 导出文件 uuid（exports 目录下文件名去掉 .xlsx），用于匿名下载链接。
	FileUUID     *string        `json:"file_uuid"`
	Params       jtype.JSON     `json:"params"`
	Result       jtype.JSON     `json:"result"`
	ErrorCode    *string        `json:"error_code"`
	ErrorMessage *string        `json:"error_message"`
	CreatedAt    jtype.UTCTime  `json:"created_at"`
	StartedAt    *jtype.UTCTime `json:"started_at"`
	FinishedAt   *jtype.UTCTime `json:"finished_at"`
}

// ExportFileUUID 对应 ExcelExportJob.file_uuid：file_path 文件名去掉 .xlsx；无文件 / 非 .xlsx 为 nil。
func ExportFileUUID(filePath *string) *string {
	if filePath == nil || *filePath == "" {
		return nil
	}
	name := filepath.Base(*filePath)
	if !strings.HasSuffix(name, ".xlsx") {
		return nil
	}
	u := strings.TrimSuffix(name, ".xlsx")
	return &u
}

// NewExcelExportJobRead 由表行构造读模型。
func NewExcelExportJobRead(j *model.ExcelExportJob) ExcelExportJobRead {
	return ExcelExportJobRead{
		ID:               j.ID,
		ExportType:       j.ExportType,
		Status:           j.Status,
		DownloadFilename: j.DownloadFilename,
		FileUUID:         ExportFileUUID(j.FilePath),
		Params:           j.Params,
		Result:           j.Result,
		ErrorCode:        j.ErrorCode,
		ErrorMessage:     j.ErrorMessage,
		CreatedAt:        jtype.NewUTC(j.CreatedAt),
		StartedAt:        importsUTCPtr(j.StartedAt),
		FinishedAt:       importsUTCPtr(j.FinishedAt),
	}
}

// LastImportRead 是「上次导入时间」读模型（管理端与小程序共用）。
type LastImportRead struct {
	LastImportAt *jtype.UTCTime `json:"last_import_at"`
}
