// Package files 对应原 api/v1/files.py：图片上传、摘要查重、读取 / 预览、附件管理与孤儿清理。
//
// 附件一律在跨项目（system）上下文里处理：file_object 是全局附件池（按 sha256 全局去重），
// 引用计数与清理统计必须覆盖全部项目，否则会把别的项目仍在引用的文件判成可清理。
package files

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/attachment"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// CacheControl 图片与预览图的缓存头。
const CacheControl = "public, max-age=86400, s-maxage=2592000"

// fileWriter 各业务模块的写角色都能上传图片：图片是上传后拿 file_id 随整表提交的通用能力。
var fileWriter = auth.Roles(
	domain.RoleSuperAdmin,
	domain.RoleWarehouseAdmin,
	domain.RolePurchaseAdmin,
	domain.RoleHazardAdmin,
	domain.RoleLedgerAdmin,
	domain.RoleWorkAdmin,
)

func Register(r *web.Router) {
	g := r.Group("/files/images", auth.SystemScope)
	g.POST("", upload, fileWriter)
	g.POST("/dedup-check", checkImageDigest, fileWriter)
	g.GET("/orphans", orphanReport, auth.SuperAdmin)
	g.DELETE("/orphans", removeOrphans, auth.SuperAdmin)
	g.GET("/attachments", listAttachments, auth.SuperAdmin)
	g.GET("/attachments/delete-unreferenced/preview", previewUnreferencedAttachments, auth.SuperAdmin)
	g.POST("/attachments/delete-unreferenced", deleteUnreferencedAttachments, auth.SuperAdmin)
	g.POST("/attachments/{file_id}/restore", restoreAttachment, auth.SuperAdmin)
	g.GET("/{file_id}", readImage)
	g.DELETE("/{file_id}", remove, fileWriter)

	if os.Getenv("APP_TEST_HOOKS") == "1" {
		registerTestHooks(r)
	}
}

const fileIDTag = "pattern=uuid7"

func upload(c *web.Ctx) error {
	p := c.Params()
	fh := file.FormFile(c, p)
	if err := p.Err(); err != nil {
		return err
	}
	item, err := file.SaveUpload(c.DB, fh)
	if err != nil {
		return err
	}
	return c.Created(item)
}

// checkImageDigest 前端在上传前提交原始文件摘要（>1MB 的图片），命中时返回可复用文件与随机中间片段摘要。
func checkImageDigest(c *web.Ctx) error {
	p := c.Params()
	var payload schema.ImageDigestCheckRequest
	p.Body(&payload)
	if err := withSizeLimit(p.Err(), payload.SizeBytes); err != nil {
		return err
	}
	match, err := file.FindSourceMatch(c.DB, payload.SHA256, payload.SizeBytes)
	if err != nil {
		return err
	}
	if match == nil {
		return c.OK(schema.ImageDigestMatchRead{Matched: false})
	}
	read := schema.FileRead(match.File)
	offset, length := int64(match.Window.Offset), int64(match.Window.Length)
	slice := match.Window.SHA256
	return c.OK(schema.ImageDigestMatchRead{Matched: true, File: &read, Offset: &offset, Length: &length, SliceSHA256: &slice})
}

// withSizeLimit 补充 size_bytes 的 le=settings.max_image_bytes 校验（上限随配置变化，无法写进结构体标签）；
// 错误按 Pydantic 的顺序排在字段错误之后、extra_forbidden 之前。
func withSizeLimit(err error, sizeBytes int64) error {
	maxBytes := config.S.MaxImageBytes
	if sizeBytes <= maxBytes {
		return err
	}
	limitErr := web.FieldError{
		Type:  "less_than_equal",
		Loc:   []any{"body", "size_bytes"},
		Msg:   fmt.Sprintf("Input should be less than or equal to %d", maxBytes),
		Input: sizeBytes,
		Ctx:   map[string]any{"le": maxBytes},
	}
	var errs []web.FieldError
	if ve, ok := err.(*web.ValidationError); ok {
		errs = ve.Errors
	} else if err != nil {
		return err
	}
	out := make([]web.FieldError, 0, len(errs)+1)
	inserted := false
	for _, e := range errs {
		if !inserted && e.Type == "extra_forbidden" {
			out = append(out, limitErr)
			inserted = true
		}
		out = append(out, e)
	}
	if !inserted {
		out = append(out, limitErr)
	}
	return &web.ValidationError{Errors: out}
}

func orphanReport(c *web.Ctx) error {
	p := c.Params()
	hours := p.QueryInt("older_than_hours", 24, "ge=0,le=87600")
	if err := p.Err(); err != nil {
		return err
	}
	report, err := file.InspectOrphans(c.DB, hours)
	if err != nil {
		return err
	}
	return c.OK(report)
}

func removeOrphans(c *web.Ctx) error {
	p := c.Params()
	hours := p.QueryInt("older_than_hours", 24, "ge=0,le=87600")
	if err := p.Err(); err != nil {
		return err
	}
	result, err := file.CleanupOrphans(c.DB, hours)
	if err != nil {
		return err
	}
	return c.OK(result)
}

// listAttachments 系统管理「附件管理」列表：每张图片一行，列出被引用次数与删除状态。
func listAttachments(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	referenced := p.QueryBoolPtr("referenced")
	status := p.QueryStrDefault("status", "active", "pattern=^(active|deleted|all)$")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := file.ListAttachments(c.DB, keyword, referenced, status, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func previewUnreferencedAttachments(c *web.Ctx) error {
	p := c.Params()
	limit := p.QueryInt("limit", 100, "ge=1,le=500")
	if err := p.Err(); err != nil {
		return err
	}
	preview, err := file.PreviewUnreferencedDeletion(c.DB, limit)
	if err != nil {
		return err
	}
	return c.OK(schema.UnreferencedDeletionPreviewRead{
		Total:          preview.Total,
		ProtectedCount: preview.ProtectedCount,
		ProtectDays:    preview.ProtectDays,
		PurgeAfter:     common.UTC(preview.PurgeAfter),
		Items:          preview.Items,
	})
}

// deleteUnreferencedAttachments 把当前所有未被引用、且已过新人保护期的附件批量标记为待删除（只做软删除）。
func deleteUnreferencedAttachments(c *web.Ctx) error {
	result, err := file.SoftDeleteUnreferenced(c.DB)
	if err != nil {
		return err
	}
	return c.OK(result)
}

func restoreAttachment(c *web.Ctx) error {
	p := c.Params()
	fileID := p.PathStr("file_id", fileIDTag)
	if err := p.Err(); err != nil {
		return err
	}
	if err := file.RestoreImage(c.DB, fileID); err != nil {
		return err
	}
	item, err := file.Get(c.DB, fileID)
	if err != nil {
		return err
	}
	if item == nil {
		return apperr.NotFound("图片")
	}
	refs, err := file.CountReferences(c.DB, fileID)
	if err != nil {
		return err
	}
	return c.OK(file.AttachmentRead(item, refs, file.FileExists(fileID)))
}

// readImage 图片匿名读取是刻意设计：前端 <img>/小程序 image 直接加载，无法携带 Authorization 头。
// 安全性依赖 file_id 为 UUIDv7（不可猜解）+ 仅返回系统上传的图片。待删除（保留期内）的图片同样可读。
func readImage(c *web.Ctx) error {
	p := c.Params()
	fileID := p.PathStr("file_id", fileIDTag)
	size := p.QueryIntPtr("size", "ge=16,le=2048")
	if err := p.Err(); err != nil {
		return err
	}
	item, path, err := file.GetImage(c.DB, fileID)
	if err != nil {
		return err
	}
	headers := map[string]string{"Cache-Control": CacheControl}
	if size != nil {
		data, err := file.RenderPreviewCached(fileID, path, int(*size))
		if err != nil {
			return err
		}
		return c.Bytes(200, file.PreviewMimeType, data, headers)
	}
	// FileResponse(path, media_type, filename=f"{id}.png", content_disposition_type="inline")
	headers["Content-Disposition"] = web.ContentDisposition("inline", item.ID+".png")
	if st, err := os.Stat(path); err == nil {
		headers["ETag"] = starletteETag(st)
	}
	return c.File(path, "", item.MimeType, headers)
}

// starletteETag 复刻 Starlette FileResponse 的 etag：md5(str(st_mtime) + "-" + str(st_size))。
func starletteETag(st os.FileInfo) string {
	mt := st.ModTime()
	mtime := float64(mt.Unix()) + float64(mt.Nanosecond())*1e-9
	s := strconv.FormatFloat(mtime, 'f', -1, 64)
	if !strings.Contains(s, ".") {
		s += ".0"
	}
	return `"` + md5Hex(s+"-"+strconv.FormatInt(st.Size(), 10)) + `"`
}

func md5Hex(s string) string {
	sum := md5.Sum([]byte(s))
	return hex.EncodeToString(sum[:])
}

// remove 软删除：被引用次数为 0 才允许；真正清除要等保留期满后第一个凌晨 2 点的引用复查。
func remove(c *web.Ctx) error {
	p := c.Params()
	fileID := p.PathStr("file_id", fileIDTag)
	if err := p.Err(); err != nil {
		return err
	}
	result, err := file.SoftDeleteImage(c.DB, fileID)
	if err != nil {
		return err
	}
	return c.OK(result)
}

// ---------------- 测试钩子（仅 APP_TEST_HOOKS=1） ----------------

func registerTestHooks(r *web.Router) {
	// 手动触发一次凌晨清理（对应用例直接调用 attachment_cleanup_service.cleanup_deleted_attachments_once）。
	r.POST("/__test__/attachment-cleanup", func(c *web.Ctx) error {
		result, err := attachment.CleanupDeletedAttachmentsOnce(c.Std())
		if err != nil {
			return err
		}
		return c.OK(result)
	})
	// 调整查重阈值 / 随机挑选策略（对应用例 monkeypatch DEDUP_MIN_BYTES、secrets.choice）；空体恢复默认。
	r.POST("/__test__/file-service", func(c *web.Ctx) error {
		var body struct {
			DedupMinBytes int  `json:"dedup_min_bytes"`
			ChooseLast    bool `json:"choose_last"`
		}
		if raw, err := c.RawBody(); err == nil && len(raw) > 0 {
			if err := json.Unmarshal(raw, &body); err != nil {
				return err
			}
		}
		file.SetTestTuning(body.DedupMinBytes, body.ChooseLast)
		return c.OK(map[string]any{"dedup_min_bytes": file.DedupMinBytes(), "choose_last": body.ChooseLast})
	})
}
