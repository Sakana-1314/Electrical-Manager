package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ===== 台账管理（台账总览 / 标签管理） =====

const (
	// LedgerImageLimit 标签节点与台账记录各自最多 9 张图片。
	LedgerImageLimit = 9
	// LedgerTagLimit 一条台账记录最多挂 20 个标签。
	LedgerTagLimit = 20
)

// LedgerTagRead 台账标签节点：平铺返回（靠 parent_id 表达层级）。
type LedgerTagRead struct {
	ID         int64            `json:"id"`
	ParentID   *int64           `json:"parent_id"`
	Name       string           `json:"name"`
	Remark     *string          `json:"remark"`
	Level      int64            `json:"level"`
	ChildCount int64            `json:"child_count"`
	ItemCount  int64            `json:"item_count"`
	Images     []FileObjectRead `json:"images"`
	CreatedAt  jtype.UTCTime    `json:"created_at"`
	UpdatedAt  jtype.UTCTime    `json:"updated_at"`
	Version    int64            `json:"version"`
}

// LedgerTagCreate 解码前请用 NewLedgerTagCreate 预填默认值。
type LedgerTagCreate struct {
	ParentID *int64   `json:"parent_id"`
	Name     string   `json:"name" v:"required,min=1,max=128"`
	Remark   *string  `json:"remark" v:"max=500"`
	ImageIDs []string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

func NewLedgerTagCreate() LedgerTagCreate { return LedgerTagCreate{ImageIDs: []string{}} }

// LedgerTagUpdate 编辑标签：parent_id 走「字段是否出现」区分（传 null = 移为一级，不传 = 不改上级）。
type LedgerTagUpdate struct {
	ParentID web.Opt[int64] `json:"parent_id"`
	Name     *string        `json:"name" v:"min=1,max=128"`
	Remark   *string        `json:"remark" v:"max=500"`
	ImageIDs *[]string      `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version  int64          `json:"version" v:"required"`
}

// LedgerTagRefRead 台账记录上的标签引用：id + 名称 + 完整层级路径。
type LedgerTagRefRead struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

// LedgerItemRead 台账记录：标签以 id 列表返回，并附名称与完整路径。
type LedgerItemRead struct {
	ID        int64              `json:"id"`
	Name      string             `json:"name"`
	ModelSpec string             `json:"model_spec"`
	SubitemNo *string            `json:"subitem_no"`
	Quantity  int64              `json:"quantity"`
	UnitName  string             `json:"unit_name"`
	Usage     string             `json:"usage"`
	Remark    *string            `json:"remark"`
	TagIDs    []int64            `json:"tag_ids"`
	Tags      []LedgerTagRefRead `json:"tags"`
	Images    []FileObjectRead   `json:"images"`
	CreatedAt jtype.UTCTime      `json:"created_at"`
	UpdatedAt jtype.UTCTime      `json:"updated_at"`
	Version   int64              `json:"version"`
}

// LedgerItemCreate 解码前请用 NewLedgerItemCreate 预填默认值。
type LedgerItemCreate struct {
	Name      string   `json:"name" v:"required,min=1,max=128"`
	ModelSpec string   `json:"model_spec" v:"required,min=1,max=255"`
	SubitemNo *string  `json:"subitem_no" v:"max=64"`
	Quantity  int64    `json:"quantity" v:"ge=0"`
	UnitName  string   `json:"unit_name" v:"required,min=1,max=32"`
	Usage     string   `json:"usage" v:"required,min=1,max=500"`
	Remark    *string  `json:"remark" v:"max=1000"`
	TagIDs    []int64  `json:"tag_ids" v:"max=20"`
	ImageIDs  []string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

func NewLedgerItemCreate() LedgerItemCreate {
	return LedgerItemCreate{TagIDs: []int64{}, ImageIDs: []string{}}
}

// Validate：tag_ids 元素 ge=1 + 去重校验（解码器的列表元素规则不支持数值约束）。
func (d *LedgerItemCreate) Validate(loc []any) []web.FieldError {
	return validateLedgerTagIDs(loc, d.TagIDs)
}

type LedgerItemUpdate struct {
	Name      *string   `json:"name" v:"min=1,max=128"`
	ModelSpec *string   `json:"model_spec" v:"min=1,max=255"`
	SubitemNo *string   `json:"subitem_no" v:"max=64"`
	Quantity  *int64    `json:"quantity" v:"ge=0"`
	UnitName  *string   `json:"unit_name" v:"min=1,max=32"`
	Usage     *string   `json:"usage" v:"min=1,max=500"`
	Remark    *string   `json:"remark" v:"max=1000"`
	TagIDs    *[]int64  `json:"tag_ids" v:"max=20"`
	ImageIDs  *[]string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version   int64     `json:"version" v:"required"`
}

func (d *LedgerItemUpdate) Validate(loc []any) []web.FieldError {
	if d.TagIDs == nil {
		return nil
	}
	return validateLedgerTagIDs(loc, *d.TagIDs)
}

func validateLedgerTagIDs(loc []any, ids []int64) []web.FieldError {
	var errs []web.FieldError
	field := append(append([]any{}, loc...), "tag_ids")
	for i, id := range ids {
		if id < 1 {
			errs = append(errs, web.FieldError{
				Type: "greater_than_equal", Loc: append(append([]any{}, field...), i),
				Msg: "Input should be greater than or equal to 1", Input: id, Ctx: map[string]any{"ge": 1},
			})
		}
	}
	if len(errs) > 0 {
		return errs
	}
	seen := map[int64]bool{}
	for _, id := range ids {
		if seen[id] {
			return []web.FieldError{web.ValueError(field, "tag_ids contains duplicates", ids)}
		}
		seen[id] = true
	}
	return nil
}
