package schema

import (
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ===== 工作管理（工作总览 / 任务视图 / 人员视图） =====

const (
	// WorkTaskImageLimit 任务图片上限。
	WorkTaskImageLimit = 9
	// WorkParticipantLimit 一条工作记录最多 20 名参与人。
	WorkParticipantLimit = 20
	// WorkParticipantNameMaxLength 每人姓名最多 24 字。
	WorkParticipantNameMaxLength = 24
	// WorkRangeMaxDays 三个视图的查询区间上限（含端点）。
	WorkRangeMaxDays = 92
)

// isParticipantSeparator 对应 PARTICIPANT_SEPARATORS = re.compile(r"[、,，;；/|｜\s]+")（\s 为 Unicode 空白）。
func isParticipantSeparator(r rune) bool {
	switch r {
	case '、', ',', '，', ';', '；', '/', '|', '｜':
		return true
	}
	return isPySpace(r)
}

func isPySpace(r rune) bool {
	switch {
	case r == ' ' || (r >= '\t' && r <= '\r') || (r >= 0x1c && r <= 0x1f) || r == 0x85 || r == 0xa0:
		return true
	case r == 0x1680 || (r >= 0x2000 && r <= 0x200a) || r == 0x2028 || r == 0x2029 || r == 0x202f || r == 0x205f || r == 0x3000:
		return true
	}
	return false
}

// SplitParticipants 按 PARTICIPANT_SEPARATORS 拆分（不含空串）。
func SplitParticipants(value string) []string {
	return strings.FieldsFunc(value, isParticipantSeparator)
}

// PyStrip 等价 Python str.strip()。
func PyStrip(s string) string { return strings.TrimFunc(s, isPySpace) }

// normalizeParticipants 拆分 → 去空 → 去重保序 → 校验人数与姓名长度。
func normalizeParticipants(value []string) ([]string, string) {
	names := []string{}
	seen := map[string]bool{}
	for _, item := range value {
		for _, part := range SplitParticipants(item) {
			name := PyStrip(part)
			if name != "" && !seen[name] {
				seen[name] = true
				names = append(names, name)
			}
		}
	}
	if len(names) == 0 {
		return nil, "participants is empty"
	}
	if len(names) > WorkParticipantLimit {
		return nil, fmt.Sprintf("participants exceeds %d names", WorkParticipantLimit)
	}
	for _, n := range names {
		if utf8.RuneCountInString(n) > WorkParticipantNameMaxLength {
			return nil, fmt.Sprintf("participant name exceeds %d chars", WorkParticipantNameMaxLength)
		}
	}
	return names, ""
}

// WorkTaskRead 任务：record_count 是它下面工作记录的条数。
type WorkTaskRead struct {
	ID            int64            `json:"id"`
	Name          string           `json:"name"`
	Description   *string          `json:"description"`
	Status        string           `json:"status"`
	PlanStartDate *jtype.Date      `json:"plan_start_date"`
	PlanEndDate   *jtype.Date      `json:"plan_end_date"`
	Remark        *string          `json:"remark"`
	Images        []FileObjectRead `json:"images"`
	RecordCount   int64            `json:"record_count"`
	CreatedAt     jtype.UTCTime    `json:"created_at"`
	UpdatedAt     jtype.UTCTime    `json:"updated_at"`
	Version       int64            `json:"version"`
}

// WorkTaskCreate 解码前请用 NewWorkTaskCreate 预填默认值。
type WorkTaskCreate struct {
	Name          string      `json:"name" v:"required,min=1,max=128"`
	Description   *string     `json:"description" v:"max=1000"`
	Status        string      `json:"status" v:"oneof=未开始|进行中|已完成|已暂停"`
	PlanStartDate *jtype.Date `json:"plan_start_date"`
	PlanEndDate   *jtype.Date `json:"plan_end_date"`
	Remark        *string     `json:"remark" v:"max=500"`
	ImageIDs      []string    `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

func NewWorkTaskCreate() WorkTaskCreate {
	return WorkTaskCreate{Status: domain.WorkTaskPending, ImageIDs: []string{}}
}

// WorkTaskUpdate 编辑任务：计划日期与描述 / 备注按「字段是否出现」区分（传 null 或空串清空，不传不改）。
type WorkTaskUpdate struct {
	Name          *string             `json:"name" v:"min=1,max=128"`
	Description   web.Opt[string]     `json:"description" v:"max=1000"`
	Status        *string             `json:"status" v:"oneof=未开始|进行中|已完成|已暂停"`
	PlanStartDate web.Opt[jtype.Date] `json:"plan_start_date"`
	PlanEndDate   web.Opt[jtype.Date] `json:"plan_end_date"`
	Remark        web.Opt[string]     `json:"remark" v:"max=500"`
	ImageIDs      *[]string           `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version       int64               `json:"version" v:"required"`
}

// WorkRecordRead 工作记录：participants 是规范化后的姓名列表。
type WorkRecordRead struct {
	ID           int64         `json:"id"`
	TaskID       int64         `json:"task_id"`
	TaskName     string        `json:"task_name"`
	TaskStatus   string        `json:"task_status"`
	StartDate    jtype.Date    `json:"start_date"`
	StartHalf    string        `json:"start_half"`
	EndDate      jtype.Date    `json:"end_date"`
	EndHalf      string        `json:"end_half"`
	Participants []string      `json:"participants"`
	Remark       *string       `json:"remark"`
	CreatedAt    jtype.UTCTime `json:"created_at"`
	UpdatedAt    jtype.UTCTime `json:"updated_at"`
	Version      int64         `json:"version"`
}

type WorkRecordCreate struct {
	TaskID       int64      `json:"task_id" v:"required"`
	StartDate    jtype.Date `json:"start_date" v:"required"`
	StartHalf    string     `json:"start_half" v:"required,oneof=AM|PM"`
	EndDate      jtype.Date `json:"end_date" v:"required"`
	EndHalf      string     `json:"end_half" v:"required,oneof=AM|PM"`
	Participants []string   `json:"participants" v:"required,min=1,itemmin=1"`
	Remark       *string    `json:"remark" v:"max=500"`
}

// Validate：参与人员拆分规范化（field_validator _normalize）。
func (d *WorkRecordCreate) Validate(loc []any) []web.FieldError {
	names, msg := normalizeParticipants(d.Participants)
	if msg != "" {
		return []web.FieldError{web.ValueError(append(append([]any{}, loc...), "participants"), msg, d.Participants)}
	}
	d.Participants = names
	return nil
}

// WorkRecordUpdate 编辑记录：起止日期与上下午档必须成对出现。
type WorkRecordUpdate struct {
	TaskID       *int64              `json:"task_id"`
	StartDate    web.Opt[jtype.Date] `json:"start_date"`
	StartHalf    web.Opt[string]     `json:"start_half" v:"oneof=AM|PM"`
	EndDate      web.Opt[jtype.Date] `json:"end_date"`
	EndHalf      web.Opt[string]     `json:"end_half" v:"oneof=AM|PM"`
	Participants *[]string           `json:"participants" v:"min=1,itemmin=1"`
	Remark       web.Opt[string]     `json:"remark" v:"max=500"`
	Version      int64               `json:"version" v:"required"`
}

func (d *WorkRecordUpdate) Validate(loc []any) []web.FieldError {
	if d.Participants != nil {
		names, msg := normalizeParticipants(*d.Participants)
		if msg != "" {
			return []web.FieldError{web.ValueError(append(append([]any{}, loc...), "participants"), msg, *d.Participants)}
		}
		d.Participants = &names
	}
	pairs := []struct {
		dateField, halfField string
		dateSet, halfSet     bool
	}{
		{"start_date", "start_half", d.StartDate.Set, d.StartHalf.Set},
		{"end_date", "end_half", d.EndDate.Set, d.EndHalf.Set},
	}
	for _, p := range pairs {
		if p.dateSet != p.halfSet {
			msg := fmt.Sprintf("%s and %s must be updated together", p.dateField, p.halfField)
			return []web.FieldError{web.ValueError(loc, msg, d.inputMap())}
		}
	}
	return nil
}

// inputMap 近似还原 model_validator 的 input（已出现的字段）。
func (d *WorkRecordUpdate) inputMap() map[string]any {
	m := map[string]any{"version": d.Version}
	if d.TaskID != nil {
		m["task_id"] = *d.TaskID
	}
	if d.StartDate.Set {
		m["start_date"] = d.StartDate.Ptr()
	}
	if d.StartHalf.Set {
		m["start_half"] = d.StartHalf.Ptr()
	}
	if d.EndDate.Set {
		m["end_date"] = d.EndDate.Ptr()
	}
	if d.EndHalf.Set {
		m["end_half"] = d.EndHalf.Ptr()
	}
	if d.Participants != nil {
		m["participants"] = *d.Participants
	}
	if d.Remark.Set {
		m["remark"] = d.Remark.Ptr()
	}
	return m
}

// WorkTaskTimelineRead 任务视图的一行：任务本身 + 查询区间内它的工作记录。
type WorkTaskTimelineRead struct {
	Task    WorkTaskRead     `json:"task"`
	Records []WorkRecordRead `json:"records"`
}

// WorkWorkerTimelineRead 人员视图的一行：参与人姓名 + 区间内他参与的记录。
type WorkWorkerTimelineRead struct {
	Name        string           `json:"name"`
	RecordCount int64            `json:"record_count"`
	Records     []WorkRecordRead `json:"records"`
}

// WorkOverviewRowRead 工作总览的一行：某一天某个任务的一段工作。
type WorkOverviewRowRead struct {
	Date         jtype.Date `json:"date"`
	RecordID     int64      `json:"record_id"`
	TaskID       int64      `json:"task_id"`
	TaskName     string     `json:"task_name"`
	TaskStatus   string     `json:"task_status"`
	Slot         string     `json:"slot"`
	Participants []string   `json:"participants"`
	Remark       *string    `json:"remark"`
}
