package schema

import (
	"fmt"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

// ZTime 对应 Pydantic 未加 UtcDateTime 序列化器的 aware datetime：UTC 时输出 `...Z`
// （微秒为 0 时省略小数部分），如 OrphanFileRead.created_at、OrphanFileReportRead.cutoff。
type ZTime struct{ time.Time }

func NewZTime(t time.Time) ZTime { return ZTime{t.UTC().Truncate(time.Microsecond)} }

func (t ZTime) MarshalJSON() ([]byte, error) {
	u := t.Time.UTC()
	s := u.Format("2006-01-02T15:04:05")
	if us := u.Nanosecond() / 1000; us != 0 {
		s += fmt.Sprintf(".%06d", us)
	}
	return []byte(`"` + s + `Z"`), nil
}

// ImageDigestCheckRequest 网页端提交的原始文件摘要（重编码前的原文件字节）与字节数。
// size_bytes 的上限（le=settings.max_image_bytes）随配置变化，由处理函数补充校验。
type ImageDigestCheckRequest struct {
	SHA256    string `json:"sha256" v:"required,pattern=^[0-9a-fA-F]{64}$"`
	SizeBytes int64  `json:"size_bytes" v:"required,gt=0"`
}

// ImageDigestMatchRead 摘要查重结果：命中时给出可复用的文件与一段中间片段的挑战材料。
type ImageDigestMatchRead struct {
	Matched     bool            `json:"matched"`
	File        *FileObjectRead `json:"file"`
	Offset      *int64          `json:"offset"`
	Length      *int64          `json:"length"`
	SliceSHA256 *string         `json:"slice_sha256"`
}

type OrphanFileRead struct {
	ID           string `json:"id"`
	OriginalName string `json:"original_name"`
	SizeBytes    int64  `json:"size_bytes"`
	CreatedAt    ZTime  `json:"created_at"`
	FileExists   bool   `json:"file_exists"`
}

type OrphanFileReportRead struct {
	Cutoff              ZTime            `json:"cutoff"`
	UnreferencedRecords []OrphanFileRead `json:"unreferenced_records"`
	UntrackedFileNames  []string         `json:"untracked_file_names"`
	MissingFileIDs      []string         `json:"missing_file_ids"`
}

type OrphanFileCleanupRead struct {
	Cutoff           ZTime    `json:"cutoff"`
	DeletedRecordIDs []string `json:"deleted_record_ids"`
	DeletedFileNames []string `json:"deleted_file_names"`
}

// AttachmentRead 附件管理列表行：图片对象 + 被引用次数 + 软删除状态。
type AttachmentRead struct {
	ID             string         `json:"id"`
	OriginalName   string         `json:"original_name"`
	MimeType       string         `json:"mime_type"`
	SizeBytes      int64          `json:"size_bytes"`
	Width          int64          `json:"width"`
	Height         int64          `json:"height"`
	CreatedAt      jtype.UTCTime  `json:"created_at"`
	ReferenceCount int64          `json:"reference_count"`
	DeletedAt      *jtype.UTCTime `json:"deleted_at"`
	FileExists     bool           `json:"file_exists"`
}

// AttachmentDeleteRead 软删除回执：真正物理删除要等保留期满后的第一个凌晨 2 点（purge_after）。
type AttachmentDeleteRead struct {
	ID         string        `json:"id"`
	DeletedAt  jtype.UTCTime `json:"deleted_at"`
	PurgeAfter jtype.UTCTime `json:"purge_after"`
}

// AttachmentBulkDeleteRead 批量软删除未引用附件的回执。
type AttachmentBulkDeleteRead struct {
	DeletedCount       int64         `json:"deleted_count"`
	SkippedRecentCount int64         `json:"skipped_recent_count"`
	PurgeAfter         jtype.UTCTime `json:"purge_after"`
}

// UnreferencedDeletionPreviewRead 「删除未引用附件」的预检清单。
type UnreferencedDeletionPreviewRead struct {
	Total          int64            `json:"total"`
	ProtectedCount int64            `json:"protected_count"`
	ProtectDays    int64            `json:"protect_days"`
	PurgeAfter     jtype.UTCTime    `json:"purge_after"`
	Items          []AttachmentRead `json:"items"`
}

// AttachmentCleanupRead 凌晨 2 点引用复查的清理结果（仅供后台任务 / 测试钩子使用）。
type AttachmentCleanupRead struct {
	Scanned         int64    `json:"scanned"`
	PurgedFileIDs   []string `json:"purged_file_ids"`
	PurgedFileNames []string `json:"purged_file_names"`
	RestoredFileIDs []string `json:"restored_file_ids"`
}
