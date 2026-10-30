// Package common 对应原 services/common.py：跨模块复用的工具函数。
package common

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode"

	"golang.org/x/text/cases"
	"golang.org/x/text/unicode/norm"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

// Shanghai 上海时区（业务时间展示 / 默认值基准，固定 UTC+8）。
var Shanghai = time.FixedZone("UTC+08:00", 8*3600)

const (
	DefaultPageSize         = 20
	MaxPageSize             = 200
	ExportRowLimit          = 10_000
	DefaultUrgency          = "正常"
	DefaultDemandDepartment = "HXNI 检修维护部"
)

// UTCNow 当前 UTC 时间（微秒精度，与 DATETIME(6) 一致）。
func UTCNow() time.Time { return time.Now().UTC().Truncate(time.Microsecond) }

// NextLocalHour 下一个「当地 hour 点整」；inclusive=true 时刚好落在整点取当下。
func NextLocalHour(now time.Time, hour int, inclusive bool) time.Time {
	target := time.Date(now.Year(), now.Month(), now.Day(), hour, 0, 0, 0, now.Location())
	passed := !now.Before(target)
	if inclusive {
		passed = now.After(target)
	}
	if passed {
		target = target.AddDate(0, 0, 1)
	}
	return target
}

// SecondsUntilLocalHour 距下一个「当地 hour 点整」的时长。
func SecondsUntilLocalHour(now time.Time, hour int) time.Duration {
	return NextLocalHour(now, hour, false).Sub(now)
}

// OperationSourceType 小程序来源以 mini_program_user_name_snapshot 非空为唯一判据。
func OperationSourceType(op *model.StockOperation) string {
	if op.MiniProgramUserNameSnapshot != nil {
		return domain.SourceMiniProgram
	}
	return op.SourceType
}

var (
	orSplitRe = regexp.MustCompile(`[|｜]`)
	folder    = cases.Fold()
)

// PyIsSpace 等价 Python str.isspace() 的单字符判定（含 \x1c-\x1f）。
func PyIsSpace(r rune) bool {
	return unicode.IsSpace(r) || (r >= 0x1c && r <= 0x1f)
}

// NormalizedText = re.sub(r"\s+", " ", NFKC(value).strip()).casefold()
func NormalizedText(value string) string {
	s := norm.NFKC.String(value)
	s = strings.TrimFunc(s, PyIsSpace)
	var b strings.Builder
	inSpace := false
	for _, r := range s {
		if PyIsSpace(r) {
			if !inSpace {
				b.WriteByte(' ')
			}
			inSpace = true
			continue
		}
		inSpace = false
		b.WriteRune(r)
	}
	return folder.String(b.String())
}

// SplitOrSearchTerms 按 | 或 ｜ 拆分关键词，去空白、去重并保持顺序。
func SplitOrSearchTerms(value *string) []string {
	if value == nil {
		return nil
	}
	seen := map[string]bool{}
	var out []string
	for _, part := range orSplitRe.Split(*value, -1) {
		term := strings.TrimSpace(part)
		if term == "" || seen[term] {
			continue
		}
		seen[term] = true
		out = append(out, term)
	}
	return out
}

// LikeEscape 复刻 SQLAlchemy contains(autoescape=True)：用 / 作转义符。
func LikeEscape(term string) string {
	r := strings.NewReplacer("/", "//", "%", "/%", "_", "/_")
	return r.Replace(term)
}

// ContainsAny 生成「任一列包含任一关键词」的条件（无关键词返回空串）。
// 等价于 or_(col.contains(term, autoescape=True) for term in terms for col in columns)。
func ContainsAny(columns []string, value *string) (string, []any) {
	terms := SplitOrSearchTerms(value)
	if len(terms) == 0 {
		return "", nil
	}
	var parts []string
	var args []any
	for _, term := range terms {
		pattern := "%" + LikeEscape(term) + "%"
		for _, col := range columns {
			parts = append(parts, col+" LIKE ? ESCAPE '/'")
			args = append(args, pattern)
		}
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}

// IdentityHash 物资身份哈希（名称 + 型号 + 单位，规范化后 SHA-256）。
func IdentityHash(name, modelSpec, unitName string) string {
	raw := NormalizedText(name) + "\x00" + NormalizedText(modelSpec) + "\x00" + NormalizedText(unitName)
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// ValidateQuantityPrecision 数量最多 1 位小数。
func ValidateQuantityPrecision(q jtype.Decimal) error {
	if q.Places() > 1 {
		return apperr.New("INVALID_QUANTITY_PRECISION", "数量最多保留 1 位小数").
			WithDetails(apperr.D{"quantity": PyDecimalStr(q), "decimal_places": 1})
	}
	return nil
}

// PyDecimalStr 近似 Python str(Decimal)：保留原始精度（不规范化）。
func PyDecimalStr(q jtype.Decimal) string {
	return q.Decimal.String()
}

// Offset 计算分页偏移。
func Offset(page, pageSize int64) int64 { return (page - 1) * pageSize }

// Where 是一个简单的 WHERE 条件累加器。
type Where struct {
	parts []string
	Args  []any
}

// Add 追加条件（空串忽略）。
func (w *Where) Add(cond string, args ...any) *Where {
	if cond == "" {
		return w
	}
	w.parts = append(w.parts, cond)
	w.Args = append(w.Args, args...)
	return w
}

// Scope 追加项目过滤（系统上下文不加）。alias 形如 "m." 或 ""。
func (w *Where) Scope(s *db.Session, alias string) error {
	cond, args, err := s.ScopeFilter(alias)
	if err != nil {
		return err
	}
	if cond != "1=1" {
		w.Add(cond, args...)
	}
	return nil
}

// ContainsAny 追加关键词包含条件。
func (w *Where) ContainsAny(columns []string, value *string) *Where {
	cond, args := ContainsAny(columns, value)
	return w.Add(cond, args...)
}

// SQL 返回 " WHERE a AND b"（无条件返回空串）。
func (w *Where) SQL() string {
	if len(w.parts) == 0 {
		return ""
	}
	return " WHERE " + strings.Join(w.parts, " AND ")
}

// Empty 是否没有条件。
func (w *Where) Empty() bool { return len(w.parts) == 0 }

// ---------------- 业务事件日志 ----------------

// EventOptions 是 LogEvent 的可选字段。
type EventOptions struct {
	OldStatus  *string
	NewStatus  *string
	Remark     *string
	BeforeData any
	AfterData  any
}

// LogEvent 写一条业务事件日志。
func LogEvent(s *db.Session, businessType string, businessID int64, action string, opt EventOptions) error {
	before, err := jtype.ToJSON(opt.BeforeData)
	if err != nil {
		return err
	}
	after, err := jtype.ToJSON(opt.AfterData)
	if err != nil {
		return err
	}
	_, err = s.Exec(
		"INSERT INTO business_event_log (business_type, business_id, action, old_status, new_status, occurred_at, remark, before_data, after_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		businessType, businessID, action, opt.OldStatus, opt.NewStatus, UTCNow(), opt.Remark, before, after,
	)
	return err
}

// LogImageChange 图片集合真的变化时记一条 IMAGES_CHANGED 事件。
func LogImageChange(s *db.Session, businessType string, businessID int64, beforeIDs, afterIDs []string, label string) error {
	before := append([]string{}, beforeIDs...)
	after := append([]string{}, afterIDs...)
	if equalStrings(before, after) {
		return nil
	}
	removed := []string{}
	for _, id := range before {
		if !containsStr(after, id) {
			removed = append(removed, id)
		}
	}
	added := []string{}
	for _, id := range after {
		if !containsStr(before, id) {
			added = append(added, id)
		}
	}
	prefix := ""
	if label != "" {
		prefix = label + "："
	}
	remark := TruncateRunes(fmt.Sprintf("%s附件 %d → %d（新增 %d、移除 %d）", prefix, len(before), len(after), len(added), len(removed)), 1000)
	return LogEvent(s, businessType, businessID, "IMAGES_CHANGED", EventOptions{
		Remark:     &remark,
		BeforeData: map[string]any{"image_ids": before},
		AfterData:  orderedImageChange{ImageIDs: after, Added: added, Removed: removed},
	})
}

type orderedImageChange struct {
	ImageIDs []string `json:"image_ids"`
	Added    []string `json:"added"`
	Removed  []string `json:"removed"`
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func containsStr(items []string, s string) bool {
	for _, item := range items {
		if item == s {
			return true
		}
	}
	return false
}

// TruncateRunes 按字符截断（Python 切片 s[:n]）。
func TruncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

// StrPtr / Int64Ptr 便捷指针。
func StrPtr(s string) *string { return &s }
func Int64Ptr(n int64) *int64 { return &n }
func BoolPtr(b bool) *bool    { return &b }

// UTC 把数据库读出的 naive UTC 时间包装为 UTCTime。
func UTC(t time.Time) jtype.UTCTime { return jtype.NewUTC(t) }

// UTCPtr 可空版本。
func UTCPtr(t *time.Time) *jtype.UTCTime {
	if t == nil {
		return nil
	}
	v := jtype.NewUTC(*t)
	return &v
}

// Placeholders 生成 n 个以逗号分隔的 ?。
func Placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?, ", n), ", ")
}

// AnyArgs 把切片转为 []any。
func AnyArgs[T any](items []T) []any {
	out := make([]any, len(items))
	for i, v := range items {
		out[i] = v
	}
	return out
}
