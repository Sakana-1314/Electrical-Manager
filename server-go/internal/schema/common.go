// Package schema 是接口的请求 / 响应结构体（对应原 app/schemas），按模块分文件。
//
// 约定：
//   - 请求结构体字段用 `json` 标签命名、`v` 标签声明约束（见 web/validate.go），
//     解码前由调用方预填默认值；需要区分「省略 / null」的字段用 web.Opt[T]。
//   - 响应结构体字段顺序与原 Pydantic 模型一致；Decimal 用 jtype.Decimal，
//     UtcDateTime 用 jtype.UTCTime，未标注时区的 datetime 用 jtype.NaiveTime，date 用 jtype.Date。
package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/model"

// Page 是分页响应。
type Page[T any] struct {
	Items    []T   `json:"items"`
	Page     int64 `json:"page"`
	PageSize int64 `json:"page_size"`
	Total    int64 `json:"total"`
}

func NewPage[T any](items []T, page, pageSize, total int64) Page[T] {
	if items == nil {
		items = []T{}
	}
	return Page[T]{Items: items, Page: page, PageSize: pageSize, Total: total}
}

// FileObjectRead 是图片附件的读模型。
type FileObjectRead struct {
	ID           string `json:"id"`
	OriginalName string `json:"original_name"`
	MimeType     string `json:"mime_type"`
	SizeBytes    int64  `json:"size_bytes"`
	Width        int64  `json:"width"`
	Height       int64  `json:"height"`
}

// FileRead 对应 services.common.file_read。
func FileRead(f *model.FileObject) FileObjectRead {
	return FileObjectRead{ID: f.ID, OriginalName: f.OriginalName, MimeType: f.MimeType, SizeBytes: f.SizeBytes, Width: f.Width, Height: f.Height}
}

// ApiError 是统一错误响应体（文档用）。
type ApiError struct {
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	Details   map[string]any `json:"details"`
	RequestID string         `json:"request_id"`
}
