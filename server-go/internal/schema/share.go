package schema

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// 匿名分享链接（share）请求 / 响应模型。

// validateShareColumns 对应 _validate_share_columns：nil 表示全部；否则至少 1 项、去重。
func validateShareColumns(loc []any, value *[]string) []web.FieldError {
	if value == nil {
		return nil
	}
	if len(*value) < 1 {
		return []web.FieldError{web.ValueError(fieldLoc(loc, "columns"), "columns must not be empty", *value)}
	}
	if !uniqueStrings(*value) {
		return []web.FieldError{web.ValueError(fieldLoc(loc, "columns"), "columns must be unique", *value)}
	}
	return nil
}

// ShareCreateRequest 对应 ShareCreateRequest。
type ShareCreateRequest struct {
	ShareType string    `json:"share_type" v:"required,oneof=purchase_plan|purchase_record"`
	ItemIDs   []int64   `json:"item_ids" v:"required,min=1,max=200"`
	ExpiresIn string    `json:"expires_in" v:"required,oneof=24h|3d|7d|30d|permanent"`
	Columns   *[]string `json:"columns"`
}

func (r *ShareCreateRequest) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	if !uniqueInts(r.ItemIDs) {
		errs = append(errs, web.ValueError(fieldLoc(loc, "item_ids"), "item_ids must be unique", r.ItemIDs))
	}
	return append(errs, validateShareColumns(loc, r.Columns)...)
}

// ShareUpdateRequest 对应 ShareUpdateRequest：缺省 / null 表示对应项不修改。
type ShareUpdateRequest struct {
	Columns   *[]string `json:"columns"`
	ExpiresIn *string   `json:"expires_in" v:"oneof=24h|3d|7d|30d|permanent"`
}

func (r *ShareUpdateRequest) Validate(loc []any) []web.FieldError {
	return validateShareColumns(loc, r.Columns)
}

type ShareRead struct {
	Token     string         `json:"token"`
	ShareType string         `json:"share_type"`
	ItemCount int64          `json:"item_count"`
	ExpiresAt *jtype.UTCTime `json:"expires_at"`
	CreatedAt jtype.UTCTime  `json:"created_at"`
	Columns   []string       `json:"columns"`
}

type ShareListRead struct {
	Token         string         `json:"token"`
	ShareType     string         `json:"share_type"`
	ItemCount     int64          `json:"item_count"`
	ExpiresAt     *jtype.UTCTime `json:"expires_at"`
	CreatedAt     jtype.UTCTime  `json:"created_at"`
	CreatedBy     *int64         `json:"created_by"`
	CreatedByName *string        `json:"created_by_name"`
	Columns       []string       `json:"columns"`
}

// SharePublicView 匿名读取端点返回体；items 为只含展示列（+ 行身份键 + 计量单位）的有序对象。
type SharePublicView struct {
	ShareType string         `json:"share_type"`
	ItemCount int64          `json:"item_count"`
	ExpiresAt *jtype.UTCTime `json:"expires_at"`
	CreatedAt jtype.UTCTime  `json:"created_at"`
	Columns   []string       `json:"columns"`
	Items     []any          `json:"items"`
}
