package schema

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ---------------- 小程序用户（管理端） ----------------

// MiniProgramIdentityRead 是小程序用户在某个小程序下的微信身份。
type MiniProgramIdentityRead struct {
	ID           int64         `json:"id"`
	AppID        string        `json:"app_id"`
	WechatOpenid string        `json:"wechat_openid"`
	CreatedAt    jtype.UTCTime `json:"created_at"`
}

// MiniProgramUserRead 是小程序用户。last_used_at 为最近一次登录小程序的时间（历史数据为 null）。
type MiniProgramUserRead struct {
	ID             int64                     `json:"id"`
	DisplayName    string                    `json:"display_name"`
	DepartmentName string                    `json:"department_name"`
	Enabled        bool                      `json:"enabled"`
	LastUsedAt     *jtype.UTCTime            `json:"last_used_at"`
	Identities     []MiniProgramIdentityRead `json:"identities"`
	CreatedAt      jtype.UTCTime             `json:"created_at"`
	UpdatedAt      jtype.UTCTime             `json:"updated_at"`
	Version        int64                     `json:"version"`
}

// MiniProgramUserUpdate 管理端编辑小程序用户。
type MiniProgramUserUpdate struct {
	DisplayName    *string `json:"display_name" v:"min=1,max=64"`
	DepartmentName *string `json:"department_name" v:"min=1,max=128"`
	Enabled        *bool   `json:"enabled"`
	Version        int64   `json:"version" v:"required"`
}

// MiniProgramUserMergeRequest 把 source 账号合并进路径里的 target 账号。
type MiniProgramUserMergeRequest struct {
	SourceUserID  int64 `json:"source_user_id" v:"required,gt=0"`
	SourceVersion int64 `json:"source_version" v:"required"`
	TargetVersion int64 `json:"target_version" v:"required"`
}

// ---------------- 登录 / 建档 ----------------

// MiniProgramLoginResponse 是微信登录 / 补充个人信息的响应。
type MiniProgramLoginResponse struct {
	AccessToken       *string              `json:"access_token"`
	RegistrationToken *string              `json:"registration_token"`
	TokenType         string               `json:"token_type"`
	User              *MiniProgramUserRead `json:"user"`
	RequiresProfile   bool                 `json:"requires_profile"`
}

// MiniProgramWechatLoginRequest 是微信登录请求（app_id 省略时用第一个已配置的小程序）。
type MiniProgramWechatLoginRequest struct {
	Code  string  `json:"code" v:"required,min=1,max=256"`
	AppID *string `json:"app_id" v:"min=1,max=64"`
}

// MiniProgramProfileUpdate 是首次绑定时补充的个人信息。
type MiniProgramProfileUpdate struct {
	DisplayName    string `json:"display_name" v:"required,min=1,max=64"`
	DepartmentName string `json:"department_name" v:"required,min=1,max=128"`
}

// ---------------- 二级库（扫码 / 库存 / 出库） ----------------

// MiniProgramMaterialRead 是扫码查到的物资详情。
type MiniProgramMaterialRead struct {
	UUID        string           `json:"uuid"`
	Name        string           `json:"name"`
	ModelSpec   string           `json:"model_spec"`
	UnitName    string           `json:"unit_name"`
	CurrentQty  jtype.Decimal    `json:"current_qty"`
	StockStatus string           `json:"stock_status"`
	MinimumQty  *jtype.Decimal   `json:"minimum_qty"`
	Remark      *string          `json:"remark"`
	Images      []FileObjectRead `json:"images"`
}

// MiniProgramInventoryItemRead 是小程序库存列表行。
type MiniProgramInventoryItemRead struct {
	UUID        string        `json:"uuid"`
	Name        string        `json:"name"`
	ModelSpec   string        `json:"model_spec"`
	UnitName    string        `json:"unit_name"`
	CurrentQty  jtype.Decimal `json:"current_qty"`
	StockStatus string        `json:"stock_status"`
}

// MiniProgramOutboundCreate 是扫码出库请求。material_uuid / occurred_at 先以原始 JSON 接收，
// 在 Validate 中按 Pydantic UUID / 带时区 datetime 口径解析（结果写入 MaterialUUID / OccurredAtTime）。
// 解码前请用 NewMiniProgramOutboundCreate 预填默认值。
type MiniProgramOutboundCreate struct {
	ClientRequestID string          `json:"client_request_id" v:"required,min=1,max=64"`
	MaterialUUIDRaw json.RawMessage `json:"material_uuid" v:"required"`
	OccurredAt      json.RawMessage `json:"occurred_at" v:"required"`
	Quantity        jtype.Decimal   `json:"quantity" v:"required,gt=0,digits=18,places=1"`
	BusinessReason  string          `json:"business_reason" v:"required,min=1,max=500"`
	ReceiverUnit    string          `json:"receiver_unit" v:"max=128"`
	SubitemNo       string          `json:"subitem_no" v:"required,min=1,max=64"`

	// MaterialUUID 是规范化后的小写带连字符 UUID（Validate 填充；服务端内部构造时直接赋值）。
	MaterialUUID string `json:"-"`
	// OccurredAtTime 是解析后的 UTC 时间（Validate 填充；服务端内部构造时直接赋值）。
	OccurredAtTime time.Time `json:"-"`
}

// NewMiniProgramOutboundCreate 预填默认值（receiver_unit 默认空串）。
func NewMiniProgramOutboundCreate() MiniProgramOutboundCreate {
	return MiniProgramOutboundCreate{ReceiverUnit: ""}
}

func (o *MiniProgramOutboundCreate) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	if u, e := parseJSONUUID(o.MaterialUUIDRaw, stockLoc(loc, "material_uuid")); e != nil {
		errs = append(errs, *e)
	} else {
		o.MaterialUUID = u
	}
	t, err := parseAwareDatetime(o.OccurredAt, stockLoc(loc, "occurred_at"))
	if err != nil {
		errs = append(errs, *err)
	} else {
		o.OccurredAtTime = t
	}
	return errs
}

// MiniProgramOutboundRead 是扫码出库结果（也用于按流水号恢复分享结果页）。
type MiniProgramOutboundRead struct {
	OperationID    int64         `json:"operation_id"`
	OperationNo    string        `json:"operation_no"`
	MaterialUUID   string        `json:"material_uuid"`
	MaterialName   string        `json:"material_name"`
	ModelSpec      string        `json:"model_spec"`
	UnitName       string        `json:"unit_name"`
	Quantity       jtype.Decimal `json:"quantity"`
	BeforeQty      jtype.Decimal `json:"before_qty"`
	AfterQty       jtype.Decimal `json:"after_qty"`
	OccurredAt     AwareTime     `json:"occurred_at"`
	BusinessReason string        `json:"business_reason"`
	ReceiverUnit   *string       `json:"receiver_unit"`
	ReceiverName   string        `json:"receiver_name"`
	SubitemNo      *string       `json:"subitem_no"`
	ExecutedBy     string        `json:"executed_by"`
}

// MiniProgramOutboundReason 是一条最近使用的出库用途（子项号 + 用途）。
type MiniProgramOutboundReason struct {
	SubitemNo *string `json:"subitem_no"`
	Reason    string  `json:"reason"`
}

// MiniProgramOutboundReasonOptions 是出库用途选项（个人最近 3 条 + 全员最近 3 条）。
type MiniProgramOutboundReasonOptions struct {
	PersonalReasons []MiniProgramOutboundReason `json:"personal_reasons"`
	SystemReasons   []MiniProgramOutboundReason `json:"system_reasons"`
}

// MiniProgramOperationRead 是小程序端出入库记录（按姓名匹配，行级展平）。
type MiniProgramOperationRead struct {
	OperationID    int64         `json:"operation_id"`
	OperationNo    string        `json:"operation_no"`
	OperationType  string        `json:"operation_type"`
	MaterialName   string        `json:"material_name"`
	ModelSpec      string        `json:"model_spec"`
	UnitName       string        `json:"unit_name"`
	Quantity       jtype.Decimal `json:"quantity"`
	BeforeQty      jtype.Decimal `json:"before_qty"`
	AfterQty       jtype.Decimal `json:"after_qty"`
	OccurredAt     AwareTime     `json:"occurred_at"`
	BusinessReason string        `json:"business_reason"`
	ReceiverUnit   *string       `json:"receiver_unit"`
	ReceiverName   *string       `json:"receiver_name"`
	SubitemNo      *string       `json:"subitem_no"`
	ExecutedBy     *string       `json:"executed_by"`
}

// ---------------- 申购计划 / 申购记录 ----------------

// MiniProgramPurchasePlanItemRead 是小程序申购计划列表行。
type MiniProgramPurchasePlanItemRead struct {
	ID                  int64         `json:"id"`
	PlanNo              string        `json:"plan_no"`
	PlanDate            jtype.Date    `json:"plan_date"`
	Name                string        `json:"name"`
	ModelSpec           string        `json:"model_spec"`
	UnitName            string        `json:"unit_name"`
	PlannedQty          jtype.Decimal `json:"planned_qty"`
	ActualDemandPerson  string        `json:"actual_demand_person"`
	PurchaseResponsible string        `json:"purchase_responsible"`
	Urgency             string        `json:"urgency"`
}

// MiniProgramPurchasePlanDetailRead 是申购计划详情（列表字段 + 详情字段 + 下一条 id）。
type MiniProgramPurchasePlanDetailRead struct {
	MiniProgramPurchasePlanItemRead
	MaterialCode     *string          `json:"material_code"`
	Category         *string          `json:"category"`
	DemandDepartment string           `json:"demand_department"`
	Usage            string           `json:"usage"`
	SubitemNo        *string          `json:"subitem_no"`
	Remark           *string          `json:"remark"`
	Images           []FileObjectRead `json:"images"`
	NextID           *int64           `json:"next_id"`
}

// MiniProgramPurchasePlanFilterOptions 是申购计划筛选下拉选项。
type MiniProgramPurchasePlanFilterOptions struct {
	ActualDemandPersons []string `json:"actual_demand_persons"`
	SubitemNos          []string `json:"subitem_nos"`
}

// MiniProgramPurchaseRecordItemRead 是小程序申购记录行（列表与详情共用）。
type MiniProgramPurchaseRecordItemRead struct {
	LineID              int64            `json:"line_id"`
	MaterialName        string           `json:"material_name"`
	ModelSpec           string           `json:"model_spec"`
	PurchaseOrderNo     *string          `json:"purchase_order_no"`
	TraceNo             *string          `json:"trace_no"`
	Status              string           `json:"status"`
	UnitName            string           `json:"unit_name"`
	PurchaseQty         jtype.Decimal    `json:"purchase_qty"`
	PlanDate            jtype.Date       `json:"plan_date"`
	SubitemNo           *string          `json:"subitem_no"`
	MaterialCode        *string          `json:"material_code"`
	Category            *string          `json:"category"`
	PlanNo              string           `json:"plan_no"`
	DemandDepartment    string           `json:"demand_department"`
	ActualDemandPerson  string           `json:"actual_demand_person"`
	PurchaseResponsible string           `json:"purchase_responsible"`
	Usage               string           `json:"usage"`
	Remark              *string          `json:"remark"`
	PurchaseDate        *jtype.Date      `json:"purchase_date"`
	Salesperson         *string          `json:"salesperson"`
	ContractNo          *string          `json:"contract_no"`
	VesselNo            *string          `json:"vessel_no"`
	ConsolidationDate   *jtype.Date      `json:"consolidation_date"`
	ConsolidationPort   *string          `json:"consolidation_port"`
	SailingDate         *jtype.Date      `json:"sailing_date"`
	ContractSignDate    *jtype.Date      `json:"contract_sign_date"`
	UnitPrice           *jtype.Decimal   `json:"unit_price"`
	Images              []FileObjectRead `json:"images"`
}

// MiniProgramPurchaseRecordFilterOptions 是申购记录筛选下拉选项。
type MiniProgramPurchaseRecordFilterOptions struct {
	Statuses   []string `json:"statuses"`
	SubitemNos []string `json:"subitem_nos"`
}

// ---------------- 编码库 / 华星库存 / 精简库存 / 台账 ----------------

// MiniProgramMaterialCodeRead 是小程序物料编码行（不含单价）。
type MiniProgramMaterialCodeRead struct {
	ID           int64   `json:"id"`
	MaterialCode string  `json:"material_code"`
	Name         *string `json:"name"`
	ModelSpec    *string `json:"model_spec"`
	UnitName     string  `json:"unit_name"`
}

// MiniProgramHuaXingInventoryRead 是小程序华星库存行。
type MiniProgramHuaXingInventoryRead struct {
	ID                 int64          `json:"id"`
	FirstInboundDate   *jtype.Date    `json:"first_inbound_date"`
	Warehouse          *string        `json:"warehouse"`
	MaterialCode       *string        `json:"material_code"`
	Name               *string        `json:"name"`
	ModelSpec          *string        `json:"model_spec"`
	Quantity           *jtype.Decimal `json:"quantity"`
	UnitName           *string        `json:"unit_name"`
	Purchaser          *string        `json:"purchaser"`
	PurchaseDepartment *string        `json:"purchase_department"`
	SubitemNoName      *string        `json:"subitem_no_name"`
}

// MiniProgramLiteInventoryItemRead 是小程序端精简二级库行（无出入库，仅查看）。
type MiniProgramLiteInventoryItemRead struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	ModelSpec *string        `json:"model_spec"`
	UnitName  *string        `json:"unit_name"`
	Quantity  *jtype.Decimal `json:"quantity"`
}

// MiniProgramLedgerItemRead 是小程序台账列表行。
type MiniProgramLedgerItemRead struct {
	ID        int64   `json:"id"`
	Name      string  `json:"name"`
	ModelSpec string  `json:"model_spec"`
	SubitemNo *string `json:"subitem_no"`
	Quantity  int64   `json:"quantity"`
	UnitName  string  `json:"unit_name"`
}

// MiniProgramLedgerItemDetailRead 是小程序台账详情（列表行 + 用途 / 备注 / 标签路径 / 图片）。
type MiniProgramLedgerItemDetailRead struct {
	MiniProgramLedgerItemRead
	Usage  string             `json:"usage"`
	Remark *string            `json:"remark"`
	Tags   []LedgerTagRefRead `json:"tags"`
	Images []FileObjectRead   `json:"images"`
}

// ---------------- UUID 解析（Pydantic UUID 口径） ----------------

// ParseUUIDText 按 pydantic-core（Rust uuid crate）口径解析 UUID 文本：接受 32 位、带连字符、`{...}` 与
// `urn:uuid:` 形式（十六进制大小写均可），返回规范化小写带连字符形式；失败时返回 Pydantic 的错误文案
// （"Input should be a valid UUID, ..."）。
func ParseUUIDText(raw string) (string, string) {
	if u, ok := parseUUIDStrict(raw); ok {
		return u, ""
	}
	return "", "Input should be a valid UUID, " + uuidErrorDetail(raw)
}

func isHexByte(ch byte) bool {
	return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')
}

func parseUUIDStrict(raw string) (string, bool) {
	var hex string
	switch {
	case len(raw) == 32:
		hex = raw
	case len(raw) == 36:
		hex = hyphenatedHex(raw)
	case len(raw) == 38 && raw[0] == '{' && raw[37] == '}':
		hex = hyphenatedHex(raw[1:37])
	case len(raw) == 45 && strings.HasPrefix(raw, "urn:uuid:"):
		hex = hyphenatedHex(raw[9:])
	}
	if len(hex) != 32 {
		return "", false
	}
	for i := 0; i < 32; i++ {
		if !isHexByte(hex[i]) {
			return "", false
		}
	}
	hex = strings.ToLower(hex)
	return hex[0:8] + "-" + hex[8:12] + "-" + hex[12:16] + "-" + hex[16:20] + "-" + hex[20:32], true
}

func hyphenatedHex(s string) string {
	if len(s) != 36 || s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
		return ""
	}
	return s[0:8] + s[9:13] + s[14:18] + s[19:23] + s[24:36]
}

// uuidErrorDetail 复刻 uuid crate 的解析失败原因（与 pydantic-core 2.50 实测文案一致）。
func uuidErrorDetail(raw string) string {
	if len(raw) > 45 {
		return fmt.Sprintf("invalid length: found %d", len(raw))
	}
	body, simple := raw, true
	switch {
	case len(raw) >= 2 && raw[0] == '{' && raw[len(raw)-1] == '}':
		body, simple = raw[1:len(raw)-1], false
	case strings.HasPrefix(raw, "urn:uuid:"):
		body, simple = raw[9:], false
	}
	hyphens := 0
	var bounds [4]int
	for i, ch := range body {
		switch {
		case ch == '-':
			if hyphens < 4 {
				bounds[hyphens] = i
			}
			hyphens++
		case ch >= 0x80 || !isHexByte(byte(ch)):
			return fmt.Sprintf("invalid character: found `%c` at %d", ch, i)
		}
	}
	if hyphens == 0 && simple {
		return fmt.Sprintf("invalid length: found %d", len(raw))
	}
	if hyphens != 4 {
		return fmt.Sprintf("invalid group count: expected 5, found %d", hyphens+1)
	}
	starts := [5]int{0, 9, 14, 19, 24}
	expected := [4]int{8, 4, 4, 4}
	for i := 0; i < 4; i++ {
		if bounds[i] != starts[i+1]-1 {
			return fmt.Sprintf("invalid group length in group %d: expected %d, found %d", i, expected[i], bounds[i]-starts[i])
		}
	}
	return fmt.Sprintf("invalid group length in group 4: expected 12, found %d", len(raw)-starts[4])
}

// PathUUID 解析 UUID 路径参数（失败记 uuid_parsing），返回规范化形式。
func PathUUID(p *web.Params, name, raw string) string {
	u, msg := ParseUUIDText(raw)
	if msg != "" {
		p.Add(uuidParsingError([]any{"path", name}, msg, raw))
	}
	return u
}

func uuidParsingError(loc []any, msg string, input any) web.FieldError {
	return web.FieldError{Type: "uuid_parsing", Loc: loc, Msg: msg, Input: input,
		Ctx: map[string]any{"error": strings.TrimPrefix(msg, "Input should be a valid UUID, ")}}
}

// parseJSONUUID 解析请求体里的 UUID 字段（JSON 字符串）；其它类型报 uuid_type。
func parseJSONUUID(raw json.RawMessage, loc []any) (string, *web.FieldError) {
	var in any
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	if err := dec.Decode(&in); err != nil {
		e := web.FieldError{Type: "uuid_type", Loc: loc, Msg: "UUID input should be a string, bytes or UUID object", Input: nil}
		return "", &e
	}
	s, ok := in.(string)
	if !ok {
		e := web.FieldError{Type: "uuid_type", Loc: loc, Msg: "UUID input should be a string, bytes or UUID object", Input: in}
		return "", &e
	}
	u, msg := ParseUUIDText(s)
	if msg != "" {
		e := uuidParsingError(loc, msg, s)
		return "", &e
	}
	return u, nil
}
