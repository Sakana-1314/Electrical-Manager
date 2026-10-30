package importjob

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// UploadFile 读取 multipart 表单字段 file（对应 `file: UploadFile = File(...)`）：
// 缺失记 422 missing，传了普通字段记 value_error；错误追加进 p，返回 nil。
func UploadFile(c *web.Ctx, p *web.Params) *multipart.FileHeader {
	fh, err := c.FormFile("file")
	if err == nil {
		return fh
	}
	var vals []string
	if errors.Is(err, http.ErrMissingFile) && c.Request.MultipartForm != nil {
		vals = c.Request.MultipartForm.Value["file"]
	} else if c.Request.ParseForm() == nil {
		vals = c.Request.PostForm["file"]
	}
	if len(vals) > 0 {
		p.Add(web.ValueError([]any{"body", "file"}, "Expected UploadFile, received: <class 'str'>", vals[len(vals)-1]))
		return nil
	}
	p.Add(web.FieldError{Type: "missing", Loc: []any{"body", "file"}, Msg: "Field required", Input: nil})
	return nil
}

// Submit 是各导入接口共用的流程：扩展名校验 → 落盘（超限报 EXCEL_FILE_TOO_LARGE）→ 登记任务并启动后台执行；
// 任一步失败都删除已落盘的临时文件。
func Submit(s *db.Session, fh *multipart.FileHeader, importType string, maxBytes int64, processor Processor, createdBy *int64) (schema.ExcelImportJobRead, error) {
	if !importfile.HasSupportedSuffix(fh.Filename) {
		return schema.ExcelImportJobRead{}, importfile.UnsupportedFileError()
	}
	filePath, err := SaveUpload(fh, maxBytes)
	if err != nil {
		return schema.ExcelImportJobRead{}, err
	}
	original := fh.Filename
	if original == "" {
		original = "import.xlsx"
	}
	job, err := EnqueueImport(s, importType, original, filePath, processor, createdBy)
	if err != nil {
		RemoveFile(filePath)
		return schema.ExcelImportJobRead{}, err
	}
	return job, nil
}

// PathJobID 读取并校验路径参数 job_id（int，ge=1）。
func PathJobID(p *web.Params, c *web.Ctx) int64 {
	raw := c.Param("job_id")
	id, ok := web.ParseIntString(raw)
	if !ok {
		p.Add(web.FieldError{Type: "int_parsing", Loc: []any{"path", "job_id"}, Msg: "Input should be a valid integer, unable to parse string as an integer", Input: raw})
		return 0
	}
	if id < 1 {
		p.Add(web.FieldError{Type: "greater_than_equal", Loc: []any{"path", "job_id"}, Msg: "Input should be greater than or equal to 1", Input: raw, Ctx: map[string]any{"ge": 1}})
	}
	return id
}
