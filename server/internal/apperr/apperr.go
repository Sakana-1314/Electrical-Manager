// Package apperr 是业务错误体（对应原 app/core/errors.py 的 AppError）。
package apperr

import "fmt"

// 业务错误码 → 默认 HTTP 状态码。显式传入状态码时以显式值为准。
// 约定：本项目禁用 HTTP 404，「资源不存在」统一 400 + NOT_FOUND。
var defaultStatusByCode = map[string]int{
	"NOT_FOUND":                   400,
	"VERSION_CONFLICT":            409,
	"INVALID_STATUS_TRANSITION":   409,
	"DATA_CONFLICT":               409,
	"DUPLICATE_HAZARD_UNIT":       409,
	"DUPLICATE_HAZARD_TYPE":       409,
	"HAZARD_UNIT_IN_USE":          409,
	"HAZARD_TYPE_IN_USE":          409,
	"HAZARD_UNIT_PERSON_REQUIRED": 400,
	"DUPLICATE_LEDGER_TAG":        409,
	"LEDGER_TAG_HAS_CHILDREN":     409,
	"LEDGER_TAG_IN_USE":           409,
	"LEDGER_TAG_MAX_LEVEL":        400,
	"INVALID_TAG_ID":              400,
	"DUPLICATE_WORK_TASK":         409,
	"WORK_TASK_HAS_RECORDS":       409,
	"WORK_DATE_RANGE":             400,
	"WORK_RANGE_TOO_LONG":         400,
	"INVALID_WORK_TASK_ID":        400,
	"INVALID_TOKEN":               401,
	"UNAUTHORIZED":                401,
	"USER_DISABLED":               401,
	"ACCOUNT_DISABLED":            403,
	"FORBIDDEN":                   403,
	"VALIDATION_ERROR":            422,
	"PROJECT_REQUIRED":            400,
	"PROJECT_NOT_FOUND":           400,
	"PROJECT_DISABLED":            400,
	"PROJECT_MISMATCH":            409,
	"PROJECT_IS_DEFAULT":          409,
	"PROJECT_IN_USE":              409,
	"DUPLICATE_PROJECT_NAME":      409,
}

// Error 是对外返回的结构化业务错误。Details 序列化为 JSON 对象（nil 输出 {}）。
type Error struct {
	Code    string
	Message string
	Status  int
	Details any
}

func (e *Error) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

// New 按错误码推断状态码（未登记的码默认 400）。
func New(code, message string) *Error {
	status, ok := defaultStatusByCode[code]
	if !ok {
		status = 400
	}
	return &Error{Code: code, Message: message, Status: status}
}

// WithStatus 显式指定 HTTP 状态码（等价于 Python 的 status_code=...）。
func (e *Error) WithStatus(status int) *Error {
	e.Status = status
	return e
}

// WithDetails 附带 details（map / 有序结构体均可）。
func (e *Error) WithDetails(details any) *Error {
	e.Details = details
	return e
}

// D 是 details 的便捷写法。
type D = map[string]any

func NotFound(resource string) *Error {
	if resource == "" {
		resource = "资源"
	}
	return New("NOT_FOUND", resource+"不存在")
}

func VersionConflict(expected, actual int64) *Error {
	return New("VERSION_CONFLICT", "数据已被其他用户修改，请刷新后重试").
		WithStatus(409).
		WithDetails(D{"expected": expected, "actual": actual})
}

func InvalidTransition(current, action string) *Error {
	return New("INVALID_STATUS_TRANSITION", "当前状态不允许执行此操作").
		WithStatus(409).
		WithDetails(D{"current_status": current, "action": action})
}

func ProjectRequired() *Error {
	return New("PROJECT_REQUIRED", "请先在右上角选择项目（若页面已过期，请刷新后重试）").WithStatus(400)
}

// ValidateVersion 对应 services.common.validate_version：expected 为 nil 时不校验。
func ValidateVersion(expected *int64, actual int64) error {
	if expected != nil && *expected != actual {
		return VersionConflict(*expected, actual)
	}
	return nil
}
