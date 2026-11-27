package schema

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ===== 工作管理（一行一个任务） =====

const (
	// WorkTaskImageLimit 任务图片上限。
	WorkTaskImageLimit = 9
	// WorkTaskTagLimit 一条任务最多 20 个标签。
	WorkTaskTagLimit = 20
	// WorkTaskTagMaxLength 单个标签最多 24 字。
	WorkTaskTagMaxLength = 24
	// WorkTaskTagsMaxLength 标签整串（英文逗号分隔）的最大长度，与 work_task.tags 列宽一致。
	WorkTaskTagsMaxLength = 500
)

// SplitWorkTags 拆分标签串：英文 / 中文逗号都认，去空白、去空串、去重保序。
func SplitWorkTags(value string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, part := range strings.FieldsFunc(value, func(r rune) bool { return r == ',' || r == '，' }) {
		tag := strings.TrimSpace(part)
		if tag == "" || seen[tag] {
			continue
		}
		seen[tag] = true
		out = append(out, tag)
	}
	return out
}

// NormalizeWorkTags 规范化标签串：去重保序后用英文逗号连接；返回规范化结果与错误说明。
func NormalizeWorkTags(value string) (string, string) {
	tags := SplitWorkTags(value)
	if len(tags) > WorkTaskTagLimit {
		return "", fmt.Sprintf("tags exceeds %d items", WorkTaskTagLimit)
	}
	for _, tag := range tags {
		if utf8.RuneCountInString(tag) > WorkTaskTagMaxLength {
			return "", fmt.Sprintf("tag exceeds %d chars", WorkTaskTagMaxLength)
		}
	}
	return strings.Join(tags, ","), ""
}

// WorkTaskRead 任务：一行即一个任务（对应车间《任务详细计划》表的一行）。
type WorkTaskRead struct {
	ID        int64            `json:"id"`
	Name      string           `json:"name"`
	Steps     *string          `json:"steps"`
	StartDate *jtype.Date      `json:"start_date"`
	EndDate   *jtype.Date      `json:"end_date"`
	Owner     *string          `json:"owner"`
	Progress  int64            `json:"progress"`
	Remark    *string          `json:"remark"`
	Tags      string           `json:"tags"`
	Images    []FileObjectRead `json:"images"`
	CreatedAt jtype.UTCTime    `json:"created_at"`
	UpdatedAt jtype.UTCTime    `json:"updated_at"`
	Version   int64            `json:"version"`
}

// WorkTaskCreate 新增任务；Tags 在 Validate 里规范化。
type WorkTaskCreate struct {
	Name      string      `json:"name" v:"required,min=1,max=500"`
	Steps     *string     `json:"steps" v:"max=1000"`
	StartDate *jtype.Date `json:"start_date"`
	EndDate   *jtype.Date `json:"end_date"`
	Owner     *string     `json:"owner" v:"max=255"`
	Progress  int64       `json:"progress" v:"min=0,max=100"`
	Remark    *string     `json:"remark" v:"max=1000"`
	Tags      string      `json:"tags" v:"max=500"`
	ImageIDs  []string    `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

func NewWorkTaskCreate() WorkTaskCreate {
	return WorkTaskCreate{ImageIDs: []string{}}
}

func (d *WorkTaskCreate) Validate(loc []any) []web.FieldError {
	tags, msg := NormalizeWorkTags(d.Tags)
	if msg != "" {
		return []web.FieldError{web.ValueError(append(append([]any{}, loc...), "tags"), msg, d.Tags)}
	}
	d.Tags = tags
	return nil
}

// WorkTaskUpdate 编辑任务：只处理请求里出现过的字段（传 null 或空串清空文本）。
type WorkTaskUpdate struct {
	Name      *string             `json:"name" v:"min=1,max=500"`
	Steps     web.Opt[string]     `json:"steps" v:"max=1000"`
	StartDate web.Opt[jtype.Date] `json:"start_date"`
	EndDate   web.Opt[jtype.Date] `json:"end_date"`
	Owner     web.Opt[string]     `json:"owner" v:"max=255"`
	Progress  *int64              `json:"progress" v:"min=0,max=100"`
	Remark    web.Opt[string]     `json:"remark" v:"max=1000"`
	Tags      web.Opt[string]     `json:"tags" v:"max=500"`
	ImageIDs  *[]string           `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version   int64               `json:"version" v:"required"`
}

func (d *WorkTaskUpdate) Validate(loc []any) []web.FieldError {
	if !d.Tags.Set {
		return nil
	}
	raw := ""
	if v := d.Tags.Ptr(); v != nil {
		raw = *v
	}
	tags, msg := NormalizeWorkTags(raw)
	if msg != "" {
		return []web.FieldError{web.ValueError(append(append([]any{}, loc...), "tags"), msg, raw)}
	}
	d.Tags = web.Opt[string]{Set: true, V: tags}
	return nil
}
