package schema

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ---------------- 时间：未标注 UtcDateTime、但传入 aware 值的 datetime 字段 ----------------

// AwareTime 对应 Pydantic 普通 `datetime` 字段承载 aware UTC 值（service 里用 utc_aware 包过）
// 时的序列化：`2026-01-02T03:04:05.123456Z`（以 Z 结尾，微秒为 0 时省略）。
// 与 jtype.UTCTime（UtcDateTime，输出 +00:00）不同，物资 / 流水 / 申购计划的读模型都是这种口径。
type AwareTime struct{ time.Time }

// NewAwareTime 把数据库读出的 naive UTC 时间包装为 AwareTime。
func NewAwareTime(t time.Time) AwareTime { return AwareTime{t.UTC().Truncate(time.Microsecond)} }

func (t AwareTime) String() string {
	u := t.Time.UTC()
	base := u.Format("2006-01-02T15:04:05")
	if us := u.Nanosecond() / 1000; us != 0 {
		base += fmt.Sprintf(".%06d", us)
	}
	return base + "Z"
}

func (t AwareTime) MarshalJSON() ([]byte, error) { return []byte(`"` + t.String() + `"`), nil }

// ---------------- 补库策略 / 二级库物资 ----------------

type ReplenishmentPolicyRead struct {
	MinimumQty jtype.Decimal `json:"minimum_qty"`
	Enabled    bool          `json:"enabled"`
	Version    int64         `json:"version"`
}

type ReplenishmentPolicyWrite struct {
	MinimumQty jtype.Decimal `json:"minimum_qty" v:"required,ge=0,digits=18,places=1"`
	Enabled    bool          `json:"enabled"`
	Version    *int64        `json:"version"`
}

// NewReplenishmentPolicyWrite 预填默认值（enabled=True）。
func NewReplenishmentPolicyWrite() ReplenishmentPolicyWrite {
	return ReplenishmentPolicyWrite{Enabled: true}
}

type StockMaterialCreate struct {
	Name      string   `json:"name" v:"required,min=1,max=128"`
	NameID    *string  `json:"name_id" v:"max=128"`
	Alias     *string  `json:"alias" v:"max=128"`
	ModelSpec string   `json:"model_spec" v:"required,min=1,max=255"`
	UnitName  string   `json:"unit_name" v:"required,min=1,max=32"`
	Remark    *string  `json:"remark" v:"max=1000"`
	ImageIDs  []string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

// NewStockMaterialCreate 预填默认值（image_ids=[]）。
func NewStockMaterialCreate() StockMaterialCreate { return StockMaterialCreate{ImageIDs: []string{}} }

// StockMaterialUpdate：`image_ids` 省略（nil）＝不改动图片，显式传 `[]` 才清空。
type StockMaterialUpdate struct {
	Name      string    `json:"name" v:"required,min=1,max=128"`
	NameID    *string   `json:"name_id" v:"max=128"`
	Alias     *string   `json:"alias" v:"max=128"`
	ModelSpec string    `json:"model_spec" v:"required,min=1,max=255"`
	UnitName  string    `json:"unit_name" v:"required,min=1,max=32"`
	Remark    *string   `json:"remark" v:"max=1000"`
	ImageIDs  *[]string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version   int64     `json:"version" v:"required"`
}

type StockMaterialRead struct {
	ID                  int64                    `json:"id"`
	UUID                string                   `json:"uuid"`
	Name                string                   `json:"name"`
	NameID              *string                  `json:"name_id"`
	Alias               *string                  `json:"alias"`
	ModelSpec           string                   `json:"model_spec"`
	UnitName            string                   `json:"unit_name"`
	Remark              *string                  `json:"remark"`
	CurrentQty          jtype.Decimal            `json:"current_qty"`
	Images              []FileObjectRead         `json:"images"`
	ReplenishmentPolicy *ReplenishmentPolicyRead `json:"replenishment_policy"`
	HasOperationRecords bool                     `json:"has_operation_records"`
	CreatedAt           AwareTime                `json:"created_at"`
	UpdatedAt           AwareTime                `json:"updated_at"`
	Version             int64                    `json:"version"`
}

type InventoryBalanceRead struct {
	StockMaterialID      int64          `json:"stock_material_id"`
	Name                 string         `json:"name"`
	Alias                *string        `json:"alias"`
	ModelSpec            string         `json:"model_spec"`
	UnitName             string         `json:"unit_name"`
	CurrentQty           jtype.Decimal  `json:"current_qty"`
	MinimumQty           *jtype.Decimal `json:"minimum_qty"`
	IsLowStock           bool           `json:"is_low_stock"`
	SuggestedPurchaseQty jtype.Decimal  `json:"suggested_purchase_qty"`
	UpdatedAt            AwareTime      `json:"updated_at"`
}

// ---------------- 出入库 ----------------

type OperationLineWrite struct {
	StockMaterialID int64         `json:"stock_material_id" v:"required"`
	Quantity        jtype.Decimal `json:"quantity" v:"required,gt=0,digits=18,places=1"`
}

// OperationCreate 的 occurred_at 必须带时区：先以原始 JSON 接收，在 Validate 中解析并写入 OccurredAtTime。
type OperationCreate struct {
	ClientRequestID string               `json:"client_request_id" v:"required,min=1,max=64"`
	OccurredAt      json.RawMessage      `json:"occurred_at" v:"required"`
	SourceType      string               `json:"source_type" v:"required,oneof=MANUAL|MINI_PROGRAM|REVERSAL|INITIALIZATION"`
	BusinessReason  string               `json:"business_reason" v:"max=500"`
	ReceiverUnit    *string              `json:"receiver_unit" v:"min=1,max=128"`
	ReceiverName    *string              `json:"receiver_name" v:"min=1,max=64"`
	SubitemNo       *string              `json:"subitem_no" v:"min=1,max=64"`
	Lines           []OperationLineWrite `json:"lines" v:"required,min=1"`

	// OccurredAtTime 是解析后的 UTC 时间（Validate 填充；服务端内部构造时直接赋值）。
	OccurredAtTime time.Time `json:"-"`
}

func (o *OperationCreate) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	t, err := parseAwareDatetime(o.OccurredAt, stockLoc(loc, "occurred_at"))
	if err != nil {
		errs = append(errs, *err)
	} else {
		o.OccurredAtTime = t
	}
	if e := uniqueOperationLines(o.Lines, stockLoc(loc, "lines")); e != nil {
		errs = append(errs, *e)
	}
	return errs
}

type OperationUpdate struct {
	Version        int64                `json:"version" v:"required"`
	OperationType  string               `json:"operation_type" v:"required,oneof=INBOUND|OUTBOUND"`
	OccurredAt     json.RawMessage      `json:"occurred_at" v:"required"`
	SourceType     string               `json:"source_type" v:"required,oneof=MANUAL|MINI_PROGRAM|REVERSAL|INITIALIZATION"`
	BusinessReason string               `json:"business_reason" v:"max=500"`
	ReceiverUnit   *string              `json:"receiver_unit" v:"min=1,max=128"`
	ReceiverName   *string              `json:"receiver_name" v:"min=1,max=64"`
	SubitemNo      *string              `json:"subitem_no" v:"min=1,max=64"`
	Lines          []OperationLineWrite `json:"lines" v:"required,min=1"`
	OccurredAtTime time.Time            `json:"-"`
}

func (o *OperationUpdate) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	t, err := parseAwareDatetime(o.OccurredAt, stockLoc(loc, "occurred_at"))
	if err != nil {
		errs = append(errs, *err)
	} else {
		o.OccurredAtTime = t
	}
	if e := uniqueOperationLines(o.Lines, stockLoc(loc, "lines")); e != nil {
		errs = append(errs, *e)
	}
	return errs
}

type ReverseOperationRequest struct {
	ClientRequestID string               `json:"client_request_id" v:"required,min=1,max=64"`
	Reason          string               `json:"reason" v:"required,min=1,max=500"`
	Lines           []OperationLineWrite `json:"lines" v:"required,min=1"`
}

func (r *ReverseOperationRequest) Validate(loc []any) []web.FieldError {
	if e := uniqueOperationLines(r.Lines, stockLoc(loc, "lines")); e != nil {
		return []web.FieldError{*e}
	}
	return nil
}

type StockOperationLineRead struct {
	ID              int64         `json:"id"`
	StockMaterialID int64         `json:"stock_material_id"`
	MaterialName    string        `json:"material_name"`
	ModelSpec       string        `json:"model_spec"`
	UnitName        string        `json:"unit_name"`
	Quantity        jtype.Decimal `json:"quantity"`
	RemainingQty    jtype.Decimal `json:"remaining_qty"`
	BeforeQty       jtype.Decimal `json:"before_qty"`
	AfterQty        jtype.Decimal `json:"after_qty"`
}

type StockOperationRead struct {
	ID                  int64                    `json:"id"`
	OperationNo         string                   `json:"operation_no"`
	OperationType       string                   `json:"operation_type"`
	OccurredAt          AwareTime                `json:"occurred_at"`
	BusinessReason      string                   `json:"business_reason"`
	ReceiverUnit        *string                  `json:"receiver_unit"`
	ReceiverName        *string                  `json:"receiver_name"`
	SubitemNo           *string                  `json:"subitem_no"`
	SourceType          string                   `json:"source_type"`
	ReversalOfID        *int64                   `json:"reversal_of_id"`
	IsReversed          bool                     `json:"is_reversed"`
	ClientRequestID     string                   `json:"client_request_id"`
	MiniProgramUserName *string                  `json:"mini_program_user_name"`
	Lines               []StockOperationLineRead `json:"lines"`
	CreatedAt           AwareTime                `json:"created_at"`
	Version             int64                    `json:"version"`
}

// ---------------- 补库 / 工作台 ----------------

type ReplenishmentDraftCreate struct {
	PlannedQty          jtype.Decimal `json:"planned_qty" v:"required,gt=0,digits=18,places=1"`
	DemandDate          *jtype.Date   `json:"demand_date"`
	ActualDemandPerson  string        `json:"actual_demand_person" v:"required,min=1,max=128"`
	PurchaseResponsible string        `json:"purchase_responsible" v:"required,min=1,max=128"`
}

type ReplenishmentDefaultsRead struct {
	PurchaseResponsible string     `json:"purchase_responsible"`
	DemandDate          jtype.Date `json:"demand_date"`
}

type ReplenishmentDraftRead struct {
	Next       string `json:"next"`
	ResourceID int64  `json:"resource_id"`
}

type DashboardSummaryRead struct {
	StockMaterialCount           int64 `json:"stock_material_count"`
	LowStockCount                int64 `json:"low_stock_count"`
	UncodedPurchaseMaterialCount int64 `json:"uncoded_purchase_material_count"`
	PurchaseRecordCount          int64 `json:"purchase_record_count"`
	// 状态为「正常」且尚未转入申购记录的申购计划（等待请购的队列）。
	PendingPurchasePlanCount int64 `json:"pending_purchase_plan_count"`
	// 尚未「已入库」的申购记录行（在途：已申购 / 已采购 / 部分入库）。
	PurchaseInProgressCount int64 `json:"purchase_in_progress_count"`
	// 今天（上海时区自然日）发生的入库 / 出库单据数，不含反向冲销单据。
	TodayInboundCount  int64 `json:"today_inbound_count"`
	TodayOutboundCount int64 `json:"today_outbound_count"`
}

// ---------------- 校验辅助 ----------------

func stockLoc(loc []any, k any) []any {
	out := make([]any, 0, len(loc)+1)
	out = append(out, loc...)
	return append(out, k)
}

func uniqueOperationLines(lines []OperationLineWrite, loc []any) *web.FieldError {
	seen := map[int64]bool{}
	for _, line := range lines {
		if seen[line.StockMaterialID] {
			e := web.ValueError(loc, "one operation may only contain a material once", lines)
			return &e
		}
		seen[line.StockMaterialID] = true
	}
	return nil
}

// parseAwareDatetime 复刻 Pydantic datetime 解析 + `_require_aware_datetime`：返回 UTC 时间。
func parseAwareDatetime(raw json.RawMessage, loc []any) (time.Time, *web.FieldError) {
	var in any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&in); err != nil || in == nil {
		return time.Time{}, &web.FieldError{Type: "datetime_type", Loc: loc, Msg: "Input should be a valid datetime", Input: nil}
	}
	switch x := in.(type) {
	case string:
		t, aware, err := jtype.ParseISODateTime(x)
		if err != nil {
			return time.Time{}, &web.FieldError{Type: "datetime_from_date_parsing", Loc: loc, Msg: "Input should be a valid datetime or date", Input: x}
		}
		if !aware {
			e := web.ValueError(loc, "occurred_at must include a timezone", x)
			return time.Time{}, &e
		}
		return t.UTC(), nil
	case json.Number:
		f, err := x.Float64()
		if err != nil || math.IsInf(f, 0) || math.IsNaN(f) {
			return time.Time{}, &web.FieldError{Type: "datetime_parsing", Loc: loc, Msg: "Input should be a valid datetime", Input: x}
		}
		// Pydantic：数值时间戳视为 UTC（绝对值超过 2e10 时按毫秒解释）。
		if math.Abs(f) > 2e10 {
			f /= 1000
		}
		sec := math.Floor(f)
		return time.Unix(int64(sec), int64((f-sec)*1e9)).UTC().Truncate(time.Microsecond), nil
	default:
		return time.Time{}, &web.FieldError{Type: "datetime_type", Loc: loc, Msg: "Input should be a valid datetime", Input: in}
	}
}
