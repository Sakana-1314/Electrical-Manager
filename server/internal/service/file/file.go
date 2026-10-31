// Package file 对应原 services/file_service.py：图片上传（校验、重编码为 PNG、按 sha256 去重）、
// 源文件摘要查重与挑战校验、读取与预览图、软删除 / 恢复、引用计数、附件列表、孤儿文件检查与清理、
// 保留期满后的物理清除（由 attachment 包的凌晨 2 点任务调用）。
//
// file_object 是全局附件池（不按项目隔离）；引用计数统计全部图片关联表，必须在系统上下文
// （s.System() / db.SystemSession / auth.SystemScope）中调用才会覆盖全部项目——在项目上下文中调用时
// 与 Python 的隔离层一致，只统计当前项目的引用。
package file

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"mime/multipart"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// AcceptedTypes 是允许上传的 Content-Type（按上传声明判断，内容格式由解码器识别）。
var AcceptedTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true}

const (
	// PreviewMimeType 预览图格式。
	PreviewMimeType = "image/webp"
	// AttachmentPurgeHour 附件删除的物理清除时刻（北京时间凌晨 2 点），与 attachment 包的后台任务一致。
	AttachmentPurgeHour = 2
	// AttachmentRetentionDays 软删除后的保留期：完整 7 个自然日，给「删错了」留出可撤销的窗口。
	AttachmentRetentionDays = 7
	// AttachmentUnreferencedMinAgeDays 「删除未引用附件」的新人保护期：上传后这么多天内的零引用附件不进回收队列。
	AttachmentUnreferencedMinAgeDays = 7
)

// ManagedFileName 是上传目录中受管理的文件名（UUIDv7 + .png）。
var ManagedFileName = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$`)

// ReferenceTables 是所有可能引用 file_object 的图片关联表。新增引用表时必须同步这里，
// 否则附件管理会低估「被引用次数」并误删在用图片。
var ReferenceTables = []string{
	"stock_material_image",
	"purchase_material_image",
	"purchase_plan_template_image",
	"purchase_request_line_image",
	"hazard_before_image",
	"hazard_after_image",
	"ledger_image",
	"ledger_tag_image",
	"work_task_image",
}

// FilePath 对应 file_path(file_id)：上传目录下的 `<file_id>.png`。
func FilePath(fileID string) string {
	return filepath.Join(config.S.UploadDir, fileID+".png")
}

// isFile 等价 Path.is_file()（跟随符号链接，只认普通文件）。
func isFile(path string) bool {
	st, err := os.Stat(path)
	return err == nil && st.Mode().IsRegular()
}

// FileExists 判断该图片的磁盘文件是否存在（file_path(file_id).is_file()）。
func FileExists(fileID string) bool { return isFile(FilePath(fileID)) }

// ---------------- 引用计数 SQL ----------------

// refSubquery 生成某张关联表指向 alias.id 的计数 / 存在性子查询条件（非系统上下文时附带项目过滤，
// 与 Python 隔离层对子查询注入的 project_id 条件一致）。
func refWhere(s *db.Session, table, alias string) (string, []any, error) {
	cond, args, err := s.ScopeFilter(table + ".")
	if err != nil {
		return "", nil, err
	}
	where := table + ".file_id = " + alias + ".id"
	if cond != "1=1" {
		where += " AND " + cond
	}
	return where, args, nil
}

// referenceCountExpr 被引用次数表达式：全部图片关联表中指向 alias.id 的记录数之和。
func referenceCountExpr(s *db.Session, alias string) (string, []any, error) {
	parts := make([]string, 0, len(ReferenceTables))
	var args []any
	for _, table := range ReferenceTables {
		where, a, err := refWhere(s, table, alias)
		if err != nil {
			return "", nil, err
		}
		parts = append(parts, "(SELECT COUNT(*) FROM "+table+" WHERE "+where+")")
		args = append(args, a...)
	}
	return "(" + strings.Join(parts, " + ") + ")", args, nil
}

// unreferencedExpr 等价 _unreferenced()：全部关联表都 NOT EXISTS。
func unreferencedExpr(s *db.Session, alias string) (string, []any, error) {
	parts := make([]string, 0, len(ReferenceTables))
	var args []any
	for _, table := range ReferenceTables {
		where, a, err := refWhere(s, table, alias)
		if err != nil {
			return "", nil, err
		}
		parts = append(parts, "NOT EXISTS (SELECT 1 FROM "+table+" WHERE "+where+")")
		args = append(args, a...)
	}
	return "(" + strings.Join(parts, " AND ") + ")", args, nil
}

const fileCols = "f.id, f.original_name, f.mime_type, f.size_bytes, f.width, f.height, f.sha256, f.source_sha256, f.source_probes, f.deleted_at, f.created_at, f.updated_at, f.version"

// ---------------- 时间规则 ----------------

// UnreferencedProtectedCutoff 新人保护期的分界：created_at 早于它的零引用附件才允许提交删除。
func UnreferencedProtectedCutoff(now time.Time) time.Time {
	return now.AddDate(0, 0, -AttachmentUnreferencedMinAgeDays)
}

// AttachmentPurgeAfter 软删除后的物理清除时刻：保留期满后的第一个凌晨 2 点（北京时间），返回 UTC。
// deletedAt 为数据库读出的 naive UTC 或任意带时区时间。
func AttachmentPurgeAfter(deletedAt time.Time) time.Time {
	deadline := deletedAt.In(common.Shanghai).AddDate(0, 0, AttachmentRetentionDays)
	return common.NextLocalHour(deadline, AttachmentPurgeHour, true).UTC()
}

// ---------------- 读写 file_object ----------------

// Get 按主键读取图片记录（含软删除的）；不存在返回 nil。
func Get(s *db.Session, fileID string) (*model.FileObject, error) {
	var item model.FileObject
	ok, err := s.Find(&item, "SELECT "+model.ColsFileObject+" FROM file_object WHERE id = ?", fileID)
	if err != nil || !ok {
		return nil, err
	}
	return &item, nil
}

// ---------------- 上传 ----------------

type digestLockEntry struct {
	mu    sync.Mutex
	users int
}

var (
	digestLocks      = map[string]*digestLockEntry{}
	digestLocksGuard sync.Mutex
)

func lockDigest(digest string) func() {
	digestLocksGuard.Lock()
	entry, ok := digestLocks[digest]
	if !ok {
		entry = &digestLockEntry{}
		digestLocks[digest] = entry
	}
	entry.users++
	digestLocksGuard.Unlock()
	entry.mu.Lock()
	return func() {
		entry.mu.Unlock()
		digestLocksGuard.Lock()
		entry.users--
		if entry.users == 0 {
			delete(digestLocks, digest)
		}
		digestLocksGuard.Unlock()
	}
}

// pyPathName 等价 Python `Path(name).name`（PosixPath：忽略空段与 "." 段，取最后一段）。
func pyPathName(name string) string {
	last := ""
	for _, part := range strings.Split(name, "/") {
		if part == "" || part == "." {
			continue
		}
		last = part
	}
	return last
}

// UploadFilename 读取 multipart 分段原始的 filename（Go 的 FileHeader.Filename 已做过 Base 处理）。
func UploadFilename(fh *multipart.FileHeader) string {
	if cd := fh.Header.Get("Content-Disposition"); cd != "" {
		if _, params, err := mime.ParseMediaType(cd); err == nil {
			if name, ok := params["filename"]; ok {
				return name
			}
		}
	}
	return fh.Filename
}

// FormFile 读取 multipart 表单里的 `file` 字段（FastAPI `file: UploadFile`）：
// 缺失时记 missing，传成普通字段时记 value_error（与 FastAPI 的 422 明细一致）。
func FormFile(c *web.Ctx, p *web.Params) *multipart.FileHeader {
	fh, err := c.FormFile("file")
	if err == nil {
		return fh
	}
	// multipart 的普通字段与 urlencoded 表单字段都会进 PostForm（FastAPI 两种表单都解析）。
	if c.Request.PostForm == nil {
		_ = c.Request.ParseForm()
	}
	if vals := c.Request.PostForm["file"]; len(vals) > 0 {
		p.Add(web.FieldError{
			Type:  "value_error",
			Loc:   []any{"body", "file"},
			Msg:   "Value error, Expected UploadFile, received: <class 'str'>",
			Input: vals[len(vals)-1],
			Ctx:   map[string]any{"error": map[string]any{}},
		})
		return nil
	}
	p.Add(web.FieldError{Type: "missing", Loc: []any{"body", "file"}, Msg: "Field required", Input: nil})
	return nil
}

// SaveUpload 是 SaveImage 的 multipart 便捷入口（上传接口 / 小程序上传接口共用）。
func SaveUpload(s *db.Session, fh *multipart.FileHeader) (schema.FileObjectRead, error) {
	contentType := fh.Header.Get("Content-Type")
	if !AcceptedTypes[contentType] {
		return schema.FileObjectRead{}, invalidImageType()
	}
	f, err := fh.Open()
	if err != nil {
		return schema.FileObjectRead{}, err
	}
	defer f.Close()
	return SaveImage(s, UploadFilename(fh), contentType, f)
}

func invalidImageType() error {
	return apperr.New("INVALID_IMAGE_TYPE", "仅支持 JPEG、PNG 或 WebP 图片")
}

// ReencodePNG 解码图片并重编码为 PNG，返回 PNG 字节与宽高（Pillow convert + save(PNG, optimize=True)）。
func ReencodePNG(raw []byte) ([]byte, int, int, error) {
	img, err := decodeImage(raw)
	if err != nil {
		return nil, 0, 0, err
	}
	data, err := encodePNG(img)
	if err != nil {
		return nil, 0, 0, err
	}
	return data, img.w, img.h, nil
}

// SaveImage 对应 save_image：校验类型与大小、重编码为 PNG、按 sha256 去重（缺失文件就地修复），
// 新图写盘并在独立事务中提交（提交失败回收磁盘文件）。会提交 s 上的事务。
func SaveImage(s *db.Session, filename, contentType string, r io.Reader) (schema.FileObjectRead, error) {
	if !AcceptedTypes[contentType] {
		return schema.FileObjectRead{}, invalidImageType()
	}
	maxBytes := config.S.MaxImageBytes
	raw, err := io.ReadAll(io.LimitReader(r, maxBytes+1))
	if err != nil {
		return schema.FileObjectRead{}, err
	}
	if int64(len(raw)) > maxBytes {
		return schema.FileObjectRead{}, apperr.New("IMAGE_TOO_LARGE", "单张图片不能超过 10 MB").WithStatus(413)
	}
	data, width, height, err := ReencodePNG(raw)
	if err != nil {
		return schema.FileObjectRead{}, apperr.New("INVALID_IMAGE", "图片无法解码")
	}
	digest := sha256Hex(data)
	// 原始字节指纹在进摘要锁之前算好：只对超过阈值的文件记录，用于前端免重复上传。
	fingerprint := ComputeSourceFingerprint(raw)

	unlock := lockDigest(digest)
	defer unlock()
	// 结束鉴权依赖开启的只读事务，让下面的查重读到其他请求已提交的同摘要记录。
	if err := s.Commit(); err != nil {
		return schema.FileObjectRead{}, err
	}

	var existing []model.FileObject
	if err := s.Select(&existing, "SELECT "+model.ColsFileObject+" FROM file_object WHERE sha256 = ? AND deleted_at IS NULL ORDER BY created_at, id", digest); err != nil {
		return schema.FileObjectRead{}, err
	}
	var missing *model.FileObject
	for i := range existing {
		item := &existing[i]
		path := FilePath(item.ID)
		if !isFile(path) {
			if missing == nil {
				missing = item
			}
			continue
		}
		if item.SizeBytes != int64(len(data)) {
			continue
		}
		stored, err := os.ReadFile(path)
		if err != nil {
			return schema.FileObjectRead{}, err
		}
		if bytes.Equal(stored, data) {
			return schema.FileRead(item), nil
		}
	}

	if err := os.MkdirAll(config.S.UploadDir, 0o777); err != nil {
		return schema.FileObjectRead{}, err
	}
	if missing != nil {
		target := FilePath(missing.ID)
		if err := os.WriteFile(target, data, 0o666); err != nil {
			return schema.FileObjectRead{}, err
		}
		changed := missing.MimeType != "image/png" || missing.SizeBytes != int64(len(data)) ||
			missing.Width != int64(width) || missing.Height != int64(height)
		missing.MimeType = "image/png"
		missing.SizeBytes = int64(len(data))
		missing.Width = int64(width)
		missing.Height = int64(height)
		if changed {
			missing.UpdatedAt = common.UTCNow()
			if _, err := s.Exec("UPDATE file_object SET mime_type = ?, size_bytes = ?, width = ?, height = ?, updated_at = ? WHERE id = ?",
				missing.MimeType, missing.SizeBytes, missing.Width, missing.Height, missing.UpdatedAt, missing.ID); err != nil {
				s.Rollback()
				_ = os.Remove(target)
				return schema.FileObjectRead{}, err
			}
		}
		if err := s.Commit(); err != nil {
			s.Rollback()
			_ = os.Remove(target)
			return schema.FileObjectRead{}, err
		}
		return schema.FileRead(missing), nil
	}

	id, err := uuid.NewV7()
	if err != nil {
		return schema.FileObjectRead{}, err
	}
	fileID := id.String()
	target := FilePath(fileID)
	if err := os.WriteFile(target, data, 0o666); err != nil {
		return schema.FileObjectRead{}, err
	}
	name := pyPathName(filename)
	if filename == "" {
		name = "image"
	}
	now := common.UTCNow()
	item := model.FileObject{
		ID:           fileID,
		OriginalName: common.TruncateRunes(name, 255),
		MimeType:     "image/png",
		SizeBytes:    int64(len(data)),
		Width:        int64(width),
		Height:       int64(height),
		SHA256:       digest,
		CreatedAt:    now,
		UpdatedAt:    now,
		Version:      1,
	}
	var probes any
	if fingerprint != nil {
		item.SourceSHA256 = &fingerprint.SHA256
		j, err := jtype.ToJSON(fingerprint.Probes)
		if err != nil {
			_ = os.Remove(target)
			return schema.FileObjectRead{}, err
		}
		item.SourceProbes = j
		probes = j
	}
	_, err = s.Exec("INSERT INTO file_object (id, original_name, mime_type, size_bytes, width, height, sha256, source_sha256, source_probes, deleted_at, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
		item.ID, item.OriginalName, item.MimeType, item.SizeBytes, item.Width, item.Height, item.SHA256, item.SourceSHA256, probes, item.CreatedAt, item.UpdatedAt, item.Version)
	if err == nil {
		// 上传是独立事务：只有数据库记录真正提交后才向客户端返回成功。
		err = s.Commit()
	}
	if err != nil {
		s.Rollback()
		_ = os.Remove(target)
		return schema.FileObjectRead{}, err
	}
	return schema.FileRead(&item), nil
}

// ---------------- 摘要查重 ----------------

// SourceMatch 是摘要命中的可复用附件与随机挑出的挑战窗口。
type SourceMatch struct {
	File   *model.FileObject
	Window ProbeWindow
}

// FindSourceMatch 对应 find_source_match：摘要一致且未软删除、记过挑战材料、原始字节数一致、
// 磁盘 PNG 还在才算命中；命中时随机挑一个候选与一个窗口。未命中返回 nil。
func FindSourceMatch(s *db.Session, sha256 string, sizeBytes int64) (*SourceMatch, error) {
	var candidates []model.FileObject
	if err := s.Select(&candidates, "SELECT "+model.ColsFileObject+" FROM file_object WHERE source_sha256 = ? AND source_probes IS NOT NULL AND deleted_at IS NULL ORDER BY created_at, id LIMIT ?",
		strings.ToLower(sha256), MatchCandidateLimit); err != nil {
		return nil, err
	}
	type usableItem struct {
		item    *model.FileObject
		windows []ProbeWindow
	}
	var usable []usableItem
	for i := range candidates {
		item := &candidates[i]
		var probes struct {
			Size    *float64      `json:"size"`
			Windows []ProbeWindow `json:"windows"`
		}
		if err := item.SourceProbes.Unmarshal(&probes); err != nil {
			continue
		}
		if probes.Size == nil || *probes.Size != float64(sizeBytes) || len(probes.Windows) == 0 || !FileExists(item.ID) {
			continue
		}
		usable = append(usable, usableItem{item, probes.Windows})
	}
	if len(usable) == 0 {
		return nil, nil
	}
	chosen := usable[choice(len(usable))]
	return &SourceMatch{File: chosen.item, Window: chosen.windows[choice(len(chosen.windows))]}, nil
}

// ---------------- 读取与预览 ----------------

// GetImage 对应 get_image：读取图片（含待删除但仍在保留期内的），返回记录与磁盘路径。
func GetImage(s *db.Session, fileID string) (*model.FileObject, string, error) {
	item, err := Get(s, fileID)
	if err != nil {
		return nil, "", err
	}
	if item == nil {
		return nil, "", apperr.NotFound("图片")
	}
	path := FilePath(fileID)
	if !isFile(path) {
		return nil, "", apperr.New("FILE_MISSING", "图片文件不存在")
	}
	return item, path, nil
}

// RenderPreview 对应 render_preview：按 Pillow thumbnail((size, size), LANCZOS) 缩放后编码为 WebP（quality=82, method=6）。
func RenderPreview(path string, size int) ([]byte, error) {
	out, err := renderPreview(path, size)
	if err != nil {
		return nil, apperr.New("INVALID_IMAGE", "图片无法生成预览")
	}
	return out, nil
}

func renderPreview(path string, size int) ([]byte, error) {
	// 附件 PNG 优先流式缩放（内存与原图尺寸无关）；不适用时退回整图解码。
	if img, ok, err := streamThumbnail(path, size); ok {
		if err != nil {
			return nil, err
		}
		return encodeWebP(img)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	img, err := decodeImage(raw)
	if err != nil {
		return nil, err
	}
	return encodeWebP(thumbnail(img.raster, size))
}

// ---------------- 引用计数与附件列表 ----------------

// CountReferences 对应 count_references：该图片当前的被引用次数（全部图片关联表之和）。
func CountReferences(s *db.Session, fileID string) (int64, error) {
	expr, args, err := referenceCountExpr(s, "f")
	if err != nil {
		return 0, err
	}
	var n sql.NullInt64
	err = s.Get(&n, "SELECT "+expr+" FROM file_object f WHERE f.id = ?", append(args, fileID)...)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return n.Int64, nil
}

// AttachmentRead 对应 attachment_read。
func AttachmentRead(item *model.FileObject, referenceCount int64, fileExists bool) schema.AttachmentRead {
	return schema.AttachmentRead{
		ID:             item.ID,
		OriginalName:   item.OriginalName,
		MimeType:       item.MimeType,
		SizeBytes:      item.SizeBytes,
		Width:          item.Width,
		Height:         item.Height,
		CreatedAt:      common.UTC(item.CreatedAt),
		ReferenceCount: referenceCount,
		DeletedAt:      common.UTCPtr(item.DeletedAt),
		FileExists:     fileExists,
	}
}

type diskFile struct {
	path    string
	modTime time.Time
}

// managedDiskFiles 等价 _managed_disk_files：上传目录中文件名符合 UUIDv7.png 的普通文件。
func managedDiskFiles() (map[string]diskFile, error) {
	dir := config.S.UploadDir
	if err := os.MkdirAll(dir, 0o777); err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	out := make(map[string]diskFile, len(entries))
	for _, e := range entries {
		name := e.Name()
		if !ManagedFileName.MatchString(name) {
			continue
		}
		path := filepath.Join(dir, name)
		st, err := os.Stat(path)
		if err != nil || !st.Mode().IsRegular() {
			continue
		}
		out[name] = diskFile{path: path, modTime: st.ModTime()}
	}
	return out, nil
}

type fileWithCount struct {
	model.FileObject
	ReferenceCount int64 `db:"reference_count"`
}

// ListAttachments 对应 list_attachments：每张图片一行，带被引用次数与软删除状态。
// referenced 为 nil 不筛选；status 取 active / deleted / all。
func ListAttachments(s *db.Session, keyword *string, referenced *bool, status string, page, pageSize int64) ([]schema.AttachmentRead, int64, error) {
	refExpr, refArgs, err := referenceCountExpr(s, "f")
	if err != nil {
		return nil, 0, err
	}
	w := common.Where{}
	if keyword != nil && *keyword != "" {
		w.Add("f.original_name LIKE ? ESCAPE '/'", "%"+common.LikeEscape(*keyword)+"%")
	}
	switch status {
	case "active":
		w.Add("f.deleted_at IS NULL")
	case "deleted":
		w.Add("f.deleted_at IS NOT NULL")
	}
	if referenced != nil {
		if *referenced {
			w.Add(refExpr+" > 0", refArgs...)
		} else {
			w.Add(refExpr+" = 0", refArgs...)
		}
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM file_object f"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []fileWithCount
	args := append(append([]any{}, refArgs...), w.Args...)
	args = append(args, pageSize, common.Offset(page, pageSize))
	if err := s.Select(&rows, "SELECT "+fileCols+", "+refExpr+" AS reference_count FROM file_object f"+w.SQL()+" ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	disk, err := managedDiskFiles()
	if err != nil {
		return nil, 0, err
	}
	items := make([]schema.AttachmentRead, 0, len(rows))
	for i := range rows {
		_, exists := disk[rows[i].ID+".png"]
		items = append(items, AttachmentRead(&rows[i].FileObject, rows[i].ReferenceCount, exists))
	}
	return items, total, nil
}

// UnreferencedDeletionPreview 「删除未引用附件」预检结果。
type UnreferencedDeletionPreview struct {
	Total          int64
	ProtectedCount int64
	ProtectDays    int64
	PurgeAfter     time.Time
	Items          []schema.AttachmentRead
}

// unreferencedConditions 「在用且当前零引用」的附件筛选条件。
func unreferencedConditions(s *db.Session) (*common.Where, error) {
	refExpr, refArgs, err := referenceCountExpr(s, "f")
	if err != nil {
		return nil, err
	}
	w := &common.Where{}
	w.Add("f.deleted_at IS NULL")
	w.Add(refExpr+" = 0", refArgs...)
	return w, nil
}

func countProtected(s *db.Session, cutoff time.Time) (int64, error) {
	w, err := unreferencedConditions(s)
	if err != nil {
		return 0, err
	}
	w.Add("f.created_at >= ?", cutoff)
	var n int64
	err = s.Get(&n, "SELECT COUNT(*) FROM file_object f"+w.SQL(), w.Args...)
	return n, err
}

// PreviewUnreferencedDeletion 对应 preview_unreferenced_deletion。
func PreviewUnreferencedDeletion(s *db.Session, limit int64) (*UnreferencedDeletionPreview, error) {
	deletedAt := common.UTCNow()
	cutoff := UnreferencedProtectedCutoff(deletedAt)
	markable, err := unreferencedConditions(s)
	if err != nil {
		return nil, err
	}
	markable.Add("f.created_at < ?", cutoff)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM file_object f"+markable.SQL(), markable.Args...); err != nil {
		return nil, err
	}
	protected, err := countProtected(s, cutoff)
	if err != nil {
		return nil, err
	}
	var rows []model.FileObject
	if err := s.Select(&rows, "SELECT "+fileCols+" FROM file_object f"+markable.SQL()+" ORDER BY f.created_at, f.id LIMIT ?", append(markable.Args, limit)...); err != nil {
		return nil, err
	}
	disk, err := managedDiskFiles()
	if err != nil {
		return nil, err
	}
	items := make([]schema.AttachmentRead, 0, len(rows))
	for i := range rows {
		_, exists := disk[rows[i].ID+".png"]
		items = append(items, AttachmentRead(&rows[i], 0, exists))
	}
	return &UnreferencedDeletionPreview{
		Total:          total,
		ProtectedCount: protected,
		ProtectDays:    AttachmentUnreferencedMinAgeDays,
		PurgeAfter:     AttachmentPurgeAfter(deletedAt),
		Items:          items,
	}, nil
}

// ---------------- 软删除 / 恢复 ----------------

// SoftDeleteImage 对应 soft_delete_image：仅当被引用次数为 0 时允许，落 deleted_at 但不删文件。会提交事务。
func SoftDeleteImage(s *db.Session, fileID string) (schema.AttachmentDeleteRead, error) {
	item, err := Get(s, fileID)
	if err != nil {
		return schema.AttachmentDeleteRead{}, err
	}
	if item == nil {
		return schema.AttachmentDeleteRead{}, apperr.NotFound("图片")
	}
	if item.DeletedAt != nil {
		return schema.AttachmentDeleteRead{}, apperr.New("FILE_ALREADY_DELETED",
			fmt.Sprintf("图片已提交删除，保留 %d 天后由凌晨清理任务清除", AttachmentRetentionDays)).WithStatus(409)
	}
	refs, err := CountReferences(s, fileID)
	if err != nil {
		return schema.AttachmentDeleteRead{}, err
	}
	if refs > 0 {
		return schema.AttachmentDeleteRead{}, apperr.New("FILE_IN_USE", "图片已被业务引用，不能删除").WithStatus(409)
	}
	deletedAt := common.UTCNow()
	if _, err := s.Exec("UPDATE file_object SET deleted_at = ?, updated_at = ? WHERE id = ?", deletedAt, deletedAt, fileID); err != nil {
		return schema.AttachmentDeleteRead{}, err
	}
	if err := s.Commit(); err != nil {
		return schema.AttachmentDeleteRead{}, err
	}
	return schema.AttachmentDeleteRead{
		ID:         fileID,
		DeletedAt:  common.UTC(deletedAt),
		PurgeAfter: common.UTC(AttachmentPurgeAfter(deletedAt)),
	}, nil
}

// SoftDeleteUnreferenced 对应 soft_delete_unreferenced：把「在用、零引用、且已过新人保护期」的附件标记为待删除。
// 引用条件直接写在 UPDATE 的 WHERE 里（不先查后改）。会提交事务。
func SoftDeleteUnreferenced(s *db.Session) (schema.AttachmentBulkDeleteRead, error) {
	deletedAt := common.UTCNow()
	cutoff := UnreferencedProtectedCutoff(deletedAt)
	protected, err := countProtected(s, cutoff)
	if err != nil {
		return schema.AttachmentBulkDeleteRead{}, err
	}
	refExpr, refArgs, err := referenceCountExpr(s, "file_object")
	if err != nil {
		return schema.AttachmentBulkDeleteRead{}, err
	}
	args := append([]any{deletedAt, deletedAt}, refArgs...)
	args = append(args, cutoff)
	res, err := s.Exec("UPDATE file_object SET deleted_at = ?, updated_at = ? WHERE file_object.deleted_at IS NULL AND "+refExpr+" = 0 AND file_object.created_at < ?", args...)
	if err != nil {
		return schema.AttachmentBulkDeleteRead{}, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return schema.AttachmentBulkDeleteRead{}, err
	}
	if err := s.Commit(); err != nil {
		return schema.AttachmentBulkDeleteRead{}, err
	}
	return schema.AttachmentBulkDeleteRead{
		DeletedCount:       affected,
		SkippedRecentCount: protected,
		PurgeAfter:         common.UTC(AttachmentPurgeAfter(deletedAt)),
	}, nil
}

// RestoreImage 对应 restore_image：把待清理的图片恢复为在用。会提交事务。
func RestoreImage(s *db.Session, fileID string) error {
	item, err := Get(s, fileID)
	if err != nil {
		return err
	}
	if item == nil {
		return apperr.NotFound("图片")
	}
	if item.DeletedAt == nil {
		return nil
	}
	if _, err := s.Exec("UPDATE file_object SET deleted_at = NULL, updated_at = ? WHERE id = ?", common.UTCNow(), fileID); err != nil {
		return err
	}
	return s.Commit()
}

// ---------------- 保留期满后的物理清除 ----------------

// PurgeDeletedAttachments 对应 purge_deleted_attachments：扫描一批待删除附件，确认无引用且保留期满才物理删除
// 数据库行与磁盘文件；复查发现又被引用的撤销删除。s 应为系统上下文的独立会话。会提交事务。
func PurgeDeletedAttachments(s *db.Session, batchSize int) (schema.AttachmentCleanupRead, error) {
	now := time.Now().UTC()
	var candidates []model.FileObject
	if err := s.Select(&candidates, "SELECT "+model.ColsFileObject+" FROM file_object WHERE deleted_at IS NOT NULL ORDER BY deleted_at, id LIMIT ? FOR UPDATE SKIP LOCKED", batchSize); err != nil {
		return schema.AttachmentCleanupRead{}, err
	}
	purged := []string{}
	restored := []string{}
	for i := range candidates {
		item := &candidates[i]
		refs, err := CountReferences(s, item.ID)
		if err != nil {
			return schema.AttachmentCleanupRead{}, err
		}
		if refs > 0 {
			if _, err := s.Exec("UPDATE file_object SET deleted_at = NULL, updated_at = ? WHERE id = ?", common.UTCNow(), item.ID); err != nil {
				return schema.AttachmentCleanupRead{}, err
			}
			restored = append(restored, item.ID)
			continue
		}
		if item.DeletedAt == nil || AttachmentPurgeAfter(*item.DeletedAt).After(now) {
			// 还在保留期内：留给后面的定时任务，不在本轮清除
			continue
		}
		purged = append(purged, item.ID)
		if _, err := s.Exec("DELETE FROM file_object WHERE id = ?", item.ID); err != nil {
			return schema.AttachmentCleanupRead{}, err
		}
	}
	if err := s.Commit(); err != nil {
		return schema.AttachmentCleanupRead{}, err
	}
	deletedNames := []string{}
	for _, id := range purged {
		path := FilePath(id)
		if isFile(path) {
			if err := os.Remove(path); err != nil {
				return schema.AttachmentCleanupRead{}, err
			}
			deletedNames = append(deletedNames, filepath.Base(path))
		}
	}
	if len(purged) > 0 || len(restored) > 0 {
		slog.Info(fmt.Sprintf("attachment cleanup scanned=%d purged=%d restored=%d", len(candidates), len(purged), len(restored)))
	}
	return schema.AttachmentCleanupRead{
		Scanned:         int64(len(candidates)),
		PurgedFileIDs:   purged,
		PurgedFileNames: deletedNames,
		RestoredFileIDs: restored,
	}, nil
}

// ---------------- 孤儿文件 ----------------

// InspectOrphans 对应 inspect_orphans：早于 cutoff 的零引用记录、无记录的磁盘文件、记录在但文件缺失。
func InspectOrphans(s *db.Session, olderThanHours int64) (schema.OrphanFileReportRead, error) {
	cutoff := common.UTCNow().Add(-time.Duration(olderThanHours) * time.Hour)
	unrefExpr, unrefArgs, err := unreferencedExpr(s, "f")
	if err != nil {
		return schema.OrphanFileReportRead{}, err
	}
	var unreferenced []model.FileObject
	args := append([]any{cutoff}, unrefArgs...)
	if err := s.Select(&unreferenced, "SELECT "+fileCols+" FROM file_object f WHERE f.created_at <= ? AND f.deleted_at IS NULL AND "+unrefExpr+" ORDER BY f.created_at, f.id", args...); err != nil {
		return schema.OrphanFileReportRead{}, err
	}
	var records []struct {
		ID        string    `db:"id"`
		CreatedAt time.Time `db:"created_at"`
	}
	if err := s.Select(&records, "SELECT id, created_at FROM file_object WHERE deleted_at IS NULL"); err != nil {
		return schema.OrphanFileReportRead{}, err
	}
	disk, err := managedDiskFiles()
	if err != nil {
		return schema.OrphanFileReportRead{}, err
	}
	recordIDs := make(map[string]bool, len(records))
	for _, r := range records {
		recordIDs[r.ID] = true
	}
	untracked := []string{}
	for name, f := range disk {
		if !recordIDs[strings.TrimSuffix(name, ".png")] && !f.modTime.After(cutoff) {
			untracked = append(untracked, name)
		}
	}
	sort.Strings(untracked)
	missing := []string{}
	for _, r := range records {
		if _, ok := disk[r.ID+".png"]; !r.CreatedAt.After(cutoff) && !ok {
			missing = append(missing, r.ID)
		}
	}
	sort.Strings(missing)
	items := make([]schema.OrphanFileRead, 0, len(unreferenced))
	for i := range unreferenced {
		item := &unreferenced[i]
		_, exists := disk[item.ID+".png"]
		items = append(items, schema.OrphanFileRead{
			ID:           item.ID,
			OriginalName: item.OriginalName,
			SizeBytes:    item.SizeBytes,
			CreatedAt:    schema.NewZTime(item.CreatedAt),
			FileExists:   exists,
		})
	}
	return schema.OrphanFileReportRead{
		Cutoff:              schema.NewZTime(cutoff),
		UnreferencedRecords: items,
		UntrackedFileNames:  untracked,
		MissingFileIDs:      missing,
	}, nil
}

// CleanupOrphans 对应 cleanup_orphans：删除零引用记录及其文件、以及无记录的磁盘文件。会提交事务。
func CleanupOrphans(s *db.Session, olderThanHours int64) (schema.OrphanFileCleanupRead, error) {
	report, err := InspectOrphans(s, olderThanHours)
	if err != nil {
		return schema.OrphanFileCleanupRead{}, err
	}
	deletedIDs := []string{}
	if len(report.UnreferencedRecords) > 0 {
		ids := make([]string, len(report.UnreferencedRecords))
		for i, item := range report.UnreferencedRecords {
			ids[i] = item.ID
		}
		unrefExpr, unrefArgs, err := unreferencedExpr(s, "f")
		if err != nil {
			return schema.OrphanFileCleanupRead{}, err
		}
		var records []model.FileObject
		args := append([]any{ids}, unrefArgs...)
		if err := s.SelectIn(&records, "SELECT "+fileCols+" FROM file_object f WHERE f.id IN (?) AND f.deleted_at IS NULL AND "+unrefExpr, args...); err != nil {
			return schema.OrphanFileCleanupRead{}, err
		}
		for _, r := range records {
			deletedIDs = append(deletedIDs, r.ID)
			if _, err := s.Exec("DELETE FROM file_object WHERE id = ?", r.ID); err != nil {
				return schema.OrphanFileCleanupRead{}, err
			}
		}
		if err := s.Commit(); err != nil {
			return schema.OrphanFileCleanupRead{}, err
		}
	}
	seen := map[string]bool{}
	var candidates []string
	for _, id := range deletedIDs {
		candidates = append(candidates, id+".png")
	}
	candidates = append(candidates, report.UntrackedFileNames...)
	var unique []string
	for _, name := range candidates {
		if !seen[name] {
			seen[name] = true
			unique = append(unique, name)
		}
	}
	sort.Strings(unique)
	deletedNames := []string{}
	for _, name := range unique {
		path := filepath.Join(config.S.UploadDir, name)
		if isFile(path) {
			if err := os.Remove(path); err != nil {
				return schema.OrphanFileCleanupRead{}, err
			}
			deletedNames = append(deletedNames, name)
		}
	}
	return schema.OrphanFileCleanupRead{
		Cutoff:           report.Cutoff,
		DeletedRecordIDs: deletedIDs,
		DeletedFileNames: deletedNames,
	}, nil
}
