// Package domain 对应原 app/domain/enums.py。
//
// 注意存储口径：SQLAlchemy 的 SAEnum 在数据库里存的是枚举**名称**（如 `NORMAL`），接口输出的是**值**
// （如 `正常`）。名称与值不同的枚举（隐患状态/等级、申购计划状态、分享类型、Webhook 事件、工作任务状态）
// 读写数据库时必须用 ToDB / FromDB 转换；原生 SQL 里的过滤条件也要写名称。
package domain

// Enum 描述一个「名称 ↔ 值」枚举（按定义顺序）。
type Enum struct {
	Names  []string
	Values []string
}

func newEnum(pairs ...string) Enum {
	e := Enum{}
	for i := 0; i < len(pairs); i += 2 {
		e.Names = append(e.Names, pairs[i])
		e.Values = append(e.Values, pairs[i+1])
	}
	return e
}

// ToDB 值 → 数据库存储的名称（未知值原样返回）。
func (e Enum) ToDB(value string) string {
	for i, v := range e.Values {
		if v == value {
			return e.Names[i]
		}
	}
	return value
}

// FromDB 数据库名称 → 值（未知名称原样返回）。
func (e Enum) FromDB(name string) string {
	for i, n := range e.Names {
		if n == name {
			return e.Values[i]
		}
	}
	return name
}

// Valid 是否为合法的值。
func (e Enum) Valid(value string) bool {
	for _, v := range e.Values {
		if v == value {
			return true
		}
	}
	return false
}

// OneOf 生成校验标签用的 "a|b|c"。
func (e Enum) OneOf() string {
	out := ""
	for i, v := range e.Values {
		if i > 0 {
			out += "|"
		}
		out += v
	}
	return out
}

// ---- 角色 ----
const (
	RoleSuperAdmin     = "SUPER_ADMIN"
	RoleWarehouseAdmin = "WAREHOUSE_ADMIN"
	RolePurchaseAdmin  = "PURCHASE_ADMIN"
	RoleHazardAdmin    = "HAZARD_ADMIN"
	RoleReadOnly       = "READ_ONLY"
	RoleLedgerAdmin    = "LEDGER_ADMIN"
	RoleWorkAdmin      = "WORK_ADMIN"
)

var Role = newEnum(
	"SUPER_ADMIN", "SUPER_ADMIN", "WAREHOUSE_ADMIN", "WAREHOUSE_ADMIN", "PURCHASE_ADMIN", "PURCHASE_ADMIN",
	"HAZARD_ADMIN", "HAZARD_ADMIN", "READ_ONLY", "READ_ONLY", "LEDGER_ADMIN", "LEDGER_ADMIN", "WORK_ADMIN", "WORK_ADMIN",
)

// ---- 隐患 ----
const (
	HazardStatusPending = "待整改"
	HazardStatusBlocked = "整改受阻"
	HazardStatusDone    = "已整改"
	HazardLevelGeneral  = "一般隐患"
	HazardLevelMajor    = "重大隐患"
)

var HazardStatus = newEnum("PENDING", "待整改", "BLOCKED", "整改受阻", "DONE", "已整改")
var HazardLevel = newEnum("GENERAL", "一般隐患", "MAJOR", "重大隐患")

// ---- 出入库 ----
const (
	OperationInbound  = "INBOUND"
	OperationOutbound = "OUTBOUND"

	SourceManual         = "MANUAL"
	SourceMiniProgram    = "MINI_PROGRAM"
	SourceReversal       = "REVERSAL"
	SourceInitialization = "INITIALIZATION"
)

var OperationType = newEnum("INBOUND", "INBOUND", "OUTBOUND", "OUTBOUND")
var SourceType = newEnum("MANUAL", "MANUAL", "MINI_PROGRAM", "MINI_PROGRAM", "REVERSAL", "REVERSAL", "INITIALIZATION", "INITIALIZATION")

// ---- 小程序 ----
const (
	MiniProgramCodeEnvTrial   = "trial"
	MiniProgramCodeEnvRelease = "release"

	MiniProgramStockNormal     = "normal"
	MiniProgramStockOutOfStock = "out_of_stock"
	MiniProgramStockLow        = "low_stock"

	FeatureDisabled  = "disabled"
	FeatureQueryOnly = "query_only"
	FeatureReadWrite = "read_write"
)

var MiniProgramCodeEnv = newEnum("TRIAL", "trial", "RELEASE", "release")
var MiniProgramStockStatus = newEnum("NORMAL", "normal", "OUT_OF_STOCK", "out_of_stock", "LOW_STOCK", "low_stock")
var MiniProgramFeatureMode = newEnum("DISABLED", "disabled", "QUERY_ONLY", "query_only", "READ_WRITE", "read_write")

// ---- 二级库模式 ----
const (
	SecondaryWarehouseFull = "full"
	SecondaryWarehouseLite = "lite"
)

var SecondaryWarehouseMode = newEnum("FULL", "full", "LITE", "lite")

// ---- 申购计划状态 ----
const (
	PlanStatusNormal   = "正常"
	PlanStatusDeferred = "暂不申购"
	PlanStatusArchived = "已归档"
)

var PurchasePlanStatus = newEnum("NORMAL", "正常", "DEFERRED", "暂不申购", "ARCHIVED", "已归档")

// ---- Webhook ----
const (
	WebhookFeishu   = "FEISHU"
	WebhookDingTalk = "DINGTALK"

	EventStockOutboundCreated = "stock.outbound.created"
	EventStockInboundCreated  = "stock.inbound.created"
	EventMiniProgramUserBound = "mini_program.user.bound"
	DeliveryPending           = "PENDING"
	DeliverySending           = "SENDING"
	DeliverySucceeded         = "SUCCEEDED"
	DeliveryFailed            = "FAILED"
)

var WebhookPlatform = newEnum("FEISHU", "FEISHU", "DINGTALK", "DINGTALK")
var WebhookEventType = newEnum(
	"STOCK_OUTBOUND_CREATED", "stock.outbound.created",
	"STOCK_INBOUND_CREATED", "stock.inbound.created",
	"MINI_PROGRAM_USER_BOUND", "mini_program.user.bound",
)
var WebhookDeliveryStatus = newEnum("PENDING", "PENDING", "SENDING", "SENDING", "SUCCEEDED", "SUCCEEDED", "FAILED", "FAILED")

// ---- 导入 / 导出任务 ----
const (
	JobPending   = "PENDING"
	JobRunning   = "RUNNING"
	JobSucceeded = "SUCCEEDED"
	JobFailed    = "FAILED"
)

var ExcelImportJobStatus = newEnum("PENDING", "PENDING", "RUNNING", "RUNNING", "SUCCEEDED", "SUCCEEDED", "FAILED", "FAILED")
var ExcelExportJobStatus = ExcelImportJobStatus

// ---- 物料编码库导入表格类型 ----
const (
	MaterialCodeImportMaterial = "material"
	MaterialCodeImportPrice    = "price"
)

var MaterialCodeImportTable = newEnum("MATERIAL", "material", "PRICE", "price")

// ---- 分享 ----
const (
	SharePurchasePlan   = "purchase_plan"
	SharePurchaseRecord = "purchase_record"

	ShareExpiry24h       = "24h"
	ShareExpiry3d        = "3d"
	ShareExpiry7d        = "7d"
	ShareExpiry30d       = "30d"
	ShareExpiryPermanent = "permanent"
)

var ShareType = newEnum("PURCHASE_PLAN", "purchase_plan", "PURCHASE_RECORD", "purchase_record")
var ShareExpiryOption = newEnum("HOURS_24", "24h", "DAYS_3", "3d", "DAYS_7", "7d", "DAYS_30", "30d", "PERMANENT", "permanent")

// ---- 工作管理 ----
const (
	WorkTaskPending    = "未开始"
	WorkTaskInProgress = "进行中"
	WorkTaskDone       = "已完成"
	WorkTaskPaused     = "已暂停"

	HalfDayAM = "AM"
	HalfDayPM = "PM"
)

var WorkTaskStatus = newEnum("PENDING", "未开始", "IN_PROGRESS", "进行中", "DONE", "已完成", "PAUSED", "已暂停")
var WorkHalfDay = newEnum("AM", "AM", "PM", "PM")
