package mcp

// 业务工具层：把高频业务流程包装成一跳可调用的具名工具。
//
// 设计约定：
//   - 工具名用「动作 + 业务对象」（list_* / create_* / batch_update_*），中文 title 与网页端菜单一致；
//   - 参数只暴露网页端实际会用的筛选项，缺省值与网页端一致（申购计划默认「正常 + 未转入」、
//     工作任务按开始时间倒序、新建默认今天等），详见各工具 description；
//   - 底层仍经 callInternal 走原接口，权限位、校验、事务、乐观锁逻辑不变；
//   - 业务工具覆盖不到的能力走 find_api_operations → describe_api_operation → call_api_operation。

import (
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// shanghai 固定东八区：网页端「今天 / 本月」等默认值都按上海时区计算。
var shanghai = time.FixedZone("CST", 8*3600)

func shanghaiNow() time.Time { return time.Now().In(shanghai) }

func shanghaiToday() string { return shanghaiNow().Format("2006-01-02") }

func defaultToday() any { return shanghaiToday() }
func defaultNow() any   { return shanghaiNow().Format(time.RFC3339) }
func defaultUUID() any  { return uuid.NewString() }

type businessParam struct {
	Name        string
	Title       string
	Desc        string
	In          string // path / query / body
	Required    bool
	Hidden      bool // 不出现在 inputSchema（由服务端自动补齐）
	Schema      map[string]any
	Default     any
	HasDefault  bool
	DefaultFunc func() any
	JoinComma   bool // 数组参数按接口要求拼成逗号分隔字符串
}

type businessTool struct {
	Name        string
	Title       string
	Description string
	OperationID string
	ReadOnly    bool
	Destructive bool
	Params      []businessParam
}

// ---------------- JSON schema 片段 ----------------

func sString() map[string]any { return map[string]any{"type": "string"} }

func sInt() map[string]any { return map[string]any{"type": "integer"} }

func sDate() map[string]any { return map[string]any{"type": "string", "format": "date"} }

func sDateTime() map[string]any { return map[string]any{"type": "string", "format": "date-time"} }

func sDecimal() map[string]any {
	return map[string]any{"anyOf": []any{
		map[string]any{"type": "number"},
		map[string]any{"type": "string", "description": "十进制字符串（避免浮点误差）"},
	}}
}

func sEnum(values ...string) map[string]any {
	items := make([]any, len(values))
	for i, v := range values {
		items[i] = v
	}
	return map[string]any{"type": "string", "enum": items}
}

func sArray(item map[string]any) map[string]any {
	return map[string]any{"type": "array", "items": item}
}

func sVersionItems(idKey, idTitle string) map[string]any {
	return map[string]any{
		"type": "array", "minItems": 1, "maxItems": 200,
		"description": "每一项带接口返回的 id 与 version（乐观锁）",
		"items": map[string]any{
			"type": "object", "additionalProperties": false,
			"required": []any{idKey, "version"},
			"properties": map[string]any{
				idKey:     map[string]any{"type": "integer", "title": idTitle},
				"version": map[string]any{"type": "integer", "title": "版本号", "description": "列表 / 详情返回的 version"},
			},
		},
	}
}

// ---------------- 参数构造 ----------------

func pStr(name, title, in, desc string) businessParam {
	return businessParam{Name: name, Title: title, In: in, Desc: desc, Schema: sString()}
}

func pStrReq(name, title, in, desc string) businessParam {
	p := pStr(name, title, in, desc)
	p.Required = true
	return p
}

func pInt(name, title, in, desc string) businessParam {
	return businessParam{Name: name, Title: title, In: in, Desc: desc, Schema: sInt()}
}

func pDate(name, title, in, desc string) businessParam {
	return businessParam{Name: name, Title: title, In: in, Desc: desc, Schema: sDate()}
}

func pPaging() []businessParam {
	return []businessParam{
		{
			Name: "page", Title: "页码", In: "query", Desc: "默认 1",
			Schema: map[string]any{"type": "integer", "minimum": 1}, Default: 1, HasDefault: true,
		},
		{
			Name: "page_size", Title: "每页条数", In: "query", Desc: "默认 20，最多 200（与网页端一致）",
			Schema: map[string]any{"type": "integer", "minimum": 1, "maximum": 200}, Default: 20, HasDefault: true,
		},
	}
}

// ---------------- 工具构造 ----------------

func businessQuery(name, title, operationID, description string, params ...businessParam) *businessTool {
	return &businessTool{
		Name: name, Title: title, OperationID: operationID,
		Description: description, ReadOnly: true, Params: params,
	}
}

// businessList 是带分页的列表查询（网页端默认每页 20 条）。
func businessList(name, title, operationID, description string, params ...businessParam) *businessTool {
	return businessQuery(name, title, operationID, description, append(params, pPaging()...)...)
}

func businessCreate(name, title, operationID, description string, params ...businessParam) *businessTool {
	return &businessTool{Name: name, Title: title, OperationID: operationID, Description: description, Params: params}
}

func businessBatch(name, title, operationID, description string, params ...businessParam) *businessTool {
	return &businessTool{
		Name: name, Title: title, OperationID: operationID,
		Description: description, Destructive: true, Params: params,
	}
}

func operationLinesParam(kind string) businessParam {
	return businessParam{
		Name: "lines", Title: kind + "明细", In: "body", Required: true,
		Desc: "至少一行；stock_material_id 来自 list_stock_materials 返回的库存物资 id",
		Schema: map[string]any{
			"type": "array", "minItems": 1,
			"items": map[string]any{
				"type": "object", "additionalProperties": false,
				"required": []any{"stock_material_id", "quantity"},
				"properties": map[string]any{
					"stock_material_id": map[string]any{"type": "integer", "title": "物资 id"},
					"quantity":          sDecimal(),
				},
			},
		},
	}
}

// businessTools 是注册给 Agent 的业务工具（顺序即 tools/list 展示顺序，按业务模块分组）。
func businessTools() []*businessTool {
	planStatuses := []any{"正常", "暂不申购", "已归档"}
	return []*businessTool{
		// ---- 工作台 ----
		businessQuery(
			"get_dashboard_summary", "查看工作台概览", "summary_api_v1_dashboard_summary_get",
			"返回工作台概览统计（库存预警、待办、隐患、申购等卡片数据），与网页端首页一致。",
		),

		// ---- 二级库 ----
		businessList(
			"list_inventory_balances", "查询库存余额", "balances_api_v1_inventory_balances_get",
			"按关键字与库存数量区间查询物资库存余额，与网页端「库存查询」页一致；默认每页 20 条。"+
				"只看低库存请改用 list_low_stock_materials。",
			pStr("keyword", "关键字", "query", "物资名称、型号规格或别名"),
			businessParam{Name: "min_qty", Title: "最小库存", In: "query", Schema: sDecimal()},
			businessParam{Name: "max_qty", Title: "最大库存", In: "query", Schema: sDecimal()},
			businessParam{Name: "low_stock", Title: "只看低库存", In: "query", Desc: "缺省 false，与网页端「库存查询」的低库存开关一致", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
		),
		businessList(
			"list_low_stock_materials", "查询低库存物资", "low_stock_api_v1_inventory_low_stock_get",
			"列出低于补库策略阈值的物资（含建议补库数量），与网页端「库存查询 → 低库存」筛选一致；默认每页 20 条。",
			pStr("keyword", "关键字", "query", "物资名称、型号规格或别名"),
		),
		businessList(
			"list_inventory_operations", "查询出入库流水", "operations_api_v1_inventory_operations_get",
			"查询入库/出库操作记录（按发生时间倒序），与网页端「操作记录」页一致；默认每页 20 条。",
			pStr("operation_no", "操作单号", "query", "支持模糊匹配"),
			businessParam{Name: "operation_type", Title: "操作类型", In: "query", Desc: "INBOUND 入库 / OUTBOUND 出库", Schema: sEnum("INBOUND", "OUTBOUND")},
			pStr("material_name", "物资名称", "query", "支持模糊匹配"),
			businessParam{Name: "source_type", Title: "来源", In: "query", Desc: "MANUAL 手工 / MINI_PROGRAM 小程序 / REVERSAL 冲销 / INITIALIZATION 初始化", Schema: sEnum("MANUAL", "MINI_PROGRAM", "REVERSAL", "INITIALIZATION")},
			pStr("start_at", "开始时间", "query", "ISO 时间，如 2026-11-01T00:00:00+08:00"),
			pStr("end_at", "结束时间", "query", "ISO 时间，如 2026-11-30T23:59:59+08:00"),
		),
		businessList(
			"list_stock_materials", "查询物资档案", "list_materials_api_v1_stock_materials_get",
			"按关键字查询二级库物资档案（物资 id 用于入库/出库与补库），与网页端「物资档案」页一致；默认每页 20 条。",
			pStr("keyword", "关键字", "query", "物资名称、型号规格或别名"),
		),
		businessCreate(
			"create_inventory_inbound", "新增入库", "inbound_api_v1_inventory_inbounds_post",
			"登记一笔入库（可多行）。occurred_at 缺省当前时间，source_type 固定 MANUAL，client_request_id 自动生成；"+
				"与网页端入库表单一致（初始化入库请用 call_api_operation）。",
			operationLinesParam("入库"),
			businessParam{Name: "occurred_at", Title: "发生时间", In: "body", Desc: "缺省当前时间（+08:00）", Schema: sDateTime(), DefaultFunc: defaultNow},
			businessParam{Name: "source_type", In: "body", Hidden: true, Default: "MANUAL", HasDefault: true},
			pStr("business_reason", "业务原因", "body", "如「1#回转窑控制柜检修备件领用」"),
			pStr("receiver_unit", "领用单位", "body", ""),
			pStr("receiver_name", "领用人", "body", ""),
			pStr("subitem_no", "子项号", "body", ""),
			businessParam{Name: "client_request_id", In: "body", Hidden: true, DefaultFunc: defaultUUID},
		),
		businessCreate(
			"create_inventory_outbound", "新增出库", "outbound_api_v1_inventory_outbounds_post",
			"登记一笔出库（可多行）。occurred_at 缺省当前时间，source_type 固定 MANUAL，client_request_id 自动生成；"+
				"与网页端出库表单一致。",
			operationLinesParam("出库"),
			businessParam{Name: "occurred_at", Title: "发生时间", In: "body", Desc: "缺省当前时间（+08:00）", Schema: sDateTime(), DefaultFunc: defaultNow},
			businessParam{Name: "source_type", In: "body", Hidden: true, Default: "MANUAL", HasDefault: true},
			pStr("business_reason", "业务原因", "body", "如「1#回转窑控制柜检修备件领用」"),
			pStr("receiver_unit", "领用单位", "body", ""),
			pStr("receiver_name", "领用人", "body", ""),
			pStr("subitem_no", "子项号", "body", ""),
			businessParam{Name: "client_request_id", In: "body", Hidden: true, DefaultFunc: defaultUUID},
		),

		// ---- 申购管理 ----
		businessList(
			"list_purchase_plans", "查询申购计划", "list_materials_api_v1_purchase_materials_get",
			"查询申购计划。默认只返回「正常」且尚未转入申购记录的计划（status=[\"正常\"]、moved=false），"+
				"与网页端「申购计划」页一致；查历史请显式传 status=[\"暂不申购\",\"已归档\"]、moved=true。"+
				"默认每页 20 条。",
			pStr("keyword", "关键字", "query", "跨单号、物资名称、型号规格等模糊匹配"),
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
			pStr("actual_demand_person", "提报员工", "query", ""),
			pStr("subitem_no", "子项号", "query", "精确匹配"),
			pStr("category", "物资类别", "query", "工具 / 消耗物资 / 备品备件"),
			businessParam{
				Name: "status", Title: "状态", In: "query", Desc: "缺省 [\"正常\"]；可传多个",
				Schema:  map[string]any{"type": "array", "items": map[string]any{"type": "string", "enum": planStatuses}},
				Default: []any{"正常"}, HasDefault: true,
			},
			businessParam{
				Name: "moved", Title: "已转入申购记录", In: "query", Desc: "缺省 false（只看未转入，与网页端一致）",
				Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true,
			},
			businessParam{Name: "coded", Title: "是否已有物料编码", In: "query", Schema: map[string]any{"type": "boolean"}},
			pStr("purchase_responsible", "实际需求人", "query", ""),
			businessParam{Name: "search_field", Title: "按字段搜索的字段", In: "query", Desc: "与 search_value 成对使用，缺省不启用", Schema: sEnum("plan_no", "plan_date", "material_code", "category", "name", "model_spec", "unit_name", "planned_qty", "usage", "subitem_no", "remark")},
			pStr("search_value", "按字段搜索的值", "query", "可用 | 分隔多个关键词"),
			businessParam{Name: "empty_actual_demand_person", Title: "只看未填提报员工", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "empty_subitem_no", Title: "只看未填子项号", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "sort_by", Title: "排序字段", In: "query", Schema: sEnum("plan_no", "plan_date", "material_code", "category", "urgency", "demand_department", "name", "model_spec", "planned_qty", "unit_name", "actual_demand_person", "purchase_responsible", "subitem_no", "usage", "images")},
			businessParam{Name: "sort_order", Title: "排序方向", In: "query", Desc: "缺省 asc", Schema: sEnum("asc", "desc"), Default: "asc", HasDefault: true},
		),
		businessList(
			"list_purchase_records", "查询申购记录", "purchase_records_api_v1_purchase_records_get",
			"查询已转入的申购记录（采购进度、单据号、状态等），与网页端「申购记录」页一致；默认不限制状态，每页 20 条。",
			pStr("keyword", "关键字", "query", "跨单号、物资、单据号等模糊匹配"),
			pStr("status", "申购状态", "query", "如 已申购 / 已到货 / 已入库"),
			pStr("purchase_order_no", "采购单号", "query", ""),
			pStr("trace_no", "追溯号", "query", ""),
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
			pStr("salesperson", "业务员", "query", ""),
			pStr("category", "物资类别", "query", ""),
			pStr("usage", "用途", "query", ""),
			pStr("actual_demand_person", "提报员工", "query", ""),
			pStr("purchase_responsible", "实际需求人", "query", ""),
			pStr("subitem_no", "子项号", "query", ""),
			businessParam{Name: "empty_status", Title: "只看未填状态", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "empty_subitem_no", Title: "只看未填子项号", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "search_field", Title: "按字段搜索的字段", In: "query", Desc: "与 search_value 成对使用，缺省不启用", Schema: sEnum("plan_no", "plan_date", "purchase_order_no", "trace_no", "contract_no", "vessel_no", "consolidation_date", "consolidation_port", "sailing_date", "contract_sign_date", "unit_price", "category", "material_code", "material_name", "model_spec", "unit_name", "purchase_qty", "salesperson", "status", "purchase_date", "usage", "subitem_no", "plan_remark", "record_remark")},
			pStr("search_value", "按字段搜索的值", "query", "可用 | 分隔多个关键词"),
			businessParam{Name: "sort_by", Title: "排序字段", In: "query", Schema: sEnum("purchase_qty", "plan_date", "purchase_order_no", "trace_no", "contract_no", "vessel_no", "consolidation_date", "consolidation_port", "sailing_date", "contract_sign_date", "unit_price", "category", "demand_department", "material_name", "model_spec", "material_code", "actual_demand_person", "usage", "purchase_responsible", "salesperson", "status", "purchase_date", "images", "subitem_no")},
			businessParam{Name: "sort_order", Title: "排序方向", In: "query", Desc: "缺省 asc", Schema: sEnum("asc", "desc"), Default: "asc", HasDefault: true},
		),
		businessList(
			"list_purchase_templates", "查询周期性计划模板", "list_templates_api_v1_purchase_plan_templates_get",
			"查询周期性申购计划模板，与网页端「周期性计划」页一致；默认每页 20 条。",
			pStr("keyword", "关键字", "query", "物资名称、型号规格等模糊匹配"),
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
			pStr("actual_demand_person", "提报员工", "query", ""),
			pStr("purchase_responsible", "实际需求人", "query", ""),
			pStr("category", "物资类别", "query", ""),
			businessParam{Name: "sort_by", Title: "排序字段", In: "query", Desc: "接口不限制取值，按字段名传", Schema: sString()},
			businessParam{Name: "sort_order", Title: "排序方向", In: "query", Desc: "缺省 asc", Schema: sEnum("asc", "desc"), Default: "asc", HasDefault: true},
		),
		businessList(
			"list_uncoded_materials", "查询未编码物资", "list_materials_api_v1_purchase_materials_get",
			"列出还没有物料编码的申购计划，与网页端「未编码物资」页一致（固定 coded=false、"+
				"默认 status=[\"正常\"]，不限制是否已转入申购记录）；默认每页 20 条。",
			pStr("keyword", "关键字", "query", "跨单号、物资名称、型号规格等模糊匹配"),
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
			businessParam{
				Name: "status", Title: "状态", In: "query", Desc: "缺省 [\"正常\"]；可传多个",
				Schema:  map[string]any{"type": "array", "items": map[string]any{"type": "string", "enum": planStatuses}},
				Default: []any{"正常"}, HasDefault: true,
			},
			businessParam{Name: "coded", In: "query", Hidden: true, Default: false, HasDefault: true},
			pStr("actual_demand_person", "提报员工", "query", ""),
			pStr("purchase_responsible", "实际需求人", "query", ""),
			pStr("subitem_no", "子项号", "query", ""),
			pStr("category", "物资类别", "query", "工具 / 消耗物资 / 备品备件"),
			businessParam{Name: "moved", Title: "已转入申购记录", In: "query", Desc: "缺省不限制（未编码物资页不按是否转入过滤）", Schema: map[string]any{"type": "boolean"}},
			businessParam{Name: "search_field", Title: "按字段搜索的字段", In: "query", Desc: "与 search_value 成对使用，缺省不启用", Schema: sEnum("plan_no", "plan_date", "material_code", "category", "name", "model_spec", "unit_name", "planned_qty", "usage", "subitem_no", "remark")},
			pStr("search_value", "按字段搜索的值", "query", "可用 | 分隔多个关键词"),
			businessParam{Name: "empty_actual_demand_person", Title: "只看未填提报员工", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "empty_subitem_no", Title: "只看未填子项号", In: "query", Desc: "缺省 false", Schema: map[string]any{"type": "boolean"}, Default: false, HasDefault: true},
			businessParam{Name: "sort_by", Title: "排序字段", In: "query", Schema: sEnum("plan_no", "plan_date", "material_code", "category", "name", "model_spec", "unit_name", "planned_qty", "usage", "subitem_no", "remark", "actual_demand_person", "purchase_responsible")},
			businessParam{Name: "sort_order", Title: "排序方向", In: "query", Desc: "缺省 asc", Schema: sEnum("asc", "desc"), Default: "asc", HasDefault: true},
		),
		businessCreate(
			"create_purchase_plan", "新增申购计划", "create_material_api_v1_purchase_materials_post",
			"新增一条申购计划。plan_date 缺省今天，status 缺省「正常」，urgency 缺省「正常」，"+
				"demand_department 缺省「HXNI 检修维护部」，与网页端新建表单一致。",
			pStrReq("name", "物资名称", "body", ""),
			pStrReq("model_spec", "型号规格", "body", ""),
			pStrReq("unit_name", "计量单位", "body", ""),
			businessParam{Name: "planned_qty", Title: "计划数量", In: "body", Required: true, Schema: sDecimal()},
			pStrReq("usage", "用途", "body", ""),
			businessParam{Name: "plan_date", Title: "需求日期", In: "body", Desc: "缺省今天（+08:00）", Schema: sDate(), DefaultFunc: defaultToday},
			pStr("material_code", "物料编码", "body", ""),
			pStr("category", "物资类别", "body", "工具 / 消耗物资 / 备品备件"),
			businessParam{Name: "urgency", Title: "紧急程度", In: "body", Desc: "缺省「正常」", Schema: sEnum("正常", "紧急", "非常紧急"), Default: "正常", HasDefault: true},
			pStr("demand_department", "需求部门", "body", "缺省「HXNI 检修维护部」"),
			pStr("actual_demand_person", "提报员工", "body", ""),
			pStr("purchase_responsible", "实际需求人", "body", ""),
			pStr("subitem_no", "子项号", "body", ""),
			pStr("remark", "备注", "body", ""),
			pInt("stock_material_id", "关联二级库物资 id", "body", "可填 list_stock_materials 返回的 id"),
			businessParam{Name: "image_ids", Title: "图片附件 id", In: "body", Schema: sArray(sString())},
			businessParam{
				Name: "status", Title: "状态", In: "body", Desc: "缺省「正常」",
				Schema: sEnum("正常", "暂不申购", "已归档"), Default: "正常", HasDefault: true,
			},
		),
		businessBatch(
			"move_purchase_plans_to_record", "转入申购记录", "batch_move_to_record_api_v1_purchase_materials_batch_move_to_record_post",
			"把一批申购计划转入申购记录（网页端「转入申购记录」）。purchase_date 缺省今天，status 缺省「已申购」；"+
				"material_ids 取 list_purchase_plans 返回的 id（只允许未转入的计划）。",
			businessParam{
				Name: "material_ids", Title: "申购计划 id", In: "body", Required: true,
				Schema: map[string]any{"type": "array", "minItems": 1, "maxItems": 200, "items": map[string]any{"type": "integer"}},
			},
			businessParam{Name: "purchase_date", Title: "采购日期", In: "body", Desc: "缺省今天（+08:00）", Schema: sDate(), DefaultFunc: defaultToday},
			pStr("purchase_order_no", "采购单号", "body", ""),
			pStr("trace_no", "追溯号", "body", ""),
			pStr("contract_no", "合同号", "body", ""),
			pStr("vessel_no", "船号", "body", ""),
			pDate("consolidation_date", "集港日期", "body", ""),
			pStr("consolidation_port", "集港港口", "body", ""),
			pDate("sailing_date", "开船日期", "body", ""),
			pDate("contract_sign_date", "合同签订日期", "body", ""),
			pStr("salesperson", "业务员", "body", ""),
			businessParam{Name: "status", Title: "申购状态", In: "body", Desc: "缺省「已申购」", Schema: sString(), Default: "已申购", HasDefault: true},
			pStr("record_remark", "记录备注", "body", ""),
		),
		businessBatch(
			"batch_update_purchase_plans", "批量编辑申购计划", "batch_update_materials_api_v1_purchase_materials_batch_patch",
			"批量修改申购计划的状态、紧急程度、责任人等字段（网页端「批量编辑」）；"+
				"materials 里每项必须带列表返回的 id 与 version。",
			businessParam{Name: "materials", Title: "待修改计划", In: "body", Required: true, Schema: sVersionItems("id", "申购计划 id")},
			businessParam{Name: "status", Title: "状态", In: "body", Schema: sEnum("正常", "暂不申购", "已归档")},
			businessParam{Name: "urgency", Title: "紧急程度", In: "body", Schema: sEnum("正常", "紧急", "非常紧急")},
			pStr("category", "物资类别", "body", ""),
			pStr("demand_department", "需求部门", "body", ""),
			pStr("actual_demand_person", "提报员工", "body", ""),
			pStr("purchase_responsible", "实际需求人", "body", ""),
			pStr("subitem_no", "子项号", "body", ""),
			pStr("usage", "用途", "body", ""),
			pDate("plan_date", "需求日期", "body", ""),
		),
		businessBatch(
			"batch_update_purchase_records", "批量编辑申购记录", "batch_edit_purchase_records_api_v1_purchase_records_batch_patch",
			"批量修改申购记录的单据号、采购日期、状态、业务员等字段（网页端「批量编辑」）；只传需要修改的字段即可，"+
				"records 里每项必须带列表返回的 line_id 与 version。",
			businessParam{Name: "records", Title: "待修改记录", In: "body", Required: true, Schema: sVersionItems("line_id", "申购记录行 id")},
			pStr("status", "申购状态", "body", "如 已申购 / 已到货 / 已入库"),
			pDate("purchase_date", "采购日期", "body", ""),
			pStr("purchase_order_no", "采购单号", "body", ""),
			pStr("trace_no", "追溯号", "body", ""),
			pStr("contract_no", "合同号", "body", ""),
			pStr("salesperson", "业务员", "body", ""),
			pStr("actual_demand_person", "提报员工", "body", ""),
			pStr("purchase_responsible", "实际需求人", "body", ""),
			pStr("record_remark", "记录备注", "body", ""),
		),

		// ---- 物料编码库 ----
		businessList(
			"list_material_codes", "查询物料编码库", "list_material_codes_api_v1_material_code_library_get",
			"按物料编码、名称、型号规格查询物料编码库，与网页端「物料编码库」页一致；默认每页 20 条。",
			pStr("keyword", "关键字", "query", "跨编码、名称、型号规格模糊匹配"),
			pStr("material_code", "物料编码", "query", ""),
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
		),

		// ---- 华星总库存 / 二级库 Lite ----
		businessList(
			"list_huaxing_inventory", "查询华星总库存", "list_huaxing_inventory_api_v1_huaxing_inventory_get",
			"查询华星（平台）总库存，与网页端「华星总库存」页一致；默认每页 20 条。",
			pStr("material_code", "物料编码", "query", ""),
			pStr("name", "货品名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
			pStr("purchase_department", "采购部门", "query", ""),
			pStr("purchaser", "采购员", "query", ""),
			pDate("date_from", "入库开始日期", "query", ""),
			pDate("date_to", "入库结束日期", "query", ""),
		),
		businessList(
			"list_lite_inventory", "查询二级库 Lite", "list_lite_inventory_api_v1_secondary_warehouse_get",
			"查询二级库 Lite（Excel 导入的只读库存），与网页端「二级库」页一致；默认每页 20 条。",
			pStr("name", "物资名称", "query", ""),
			pStr("model_spec", "型号规格", "query", ""),
		),

		// ---- 隐患 / 台账 ----
		businessList(
			"list_hazards", "查询隐患台账", "list_hazards_api_v1_hazards_get",
			"查询隐患台账（按登记时间倒序），与网页端「隐患管理」页一致；默认不限制状态，每页 20 条。",
			pStr("keyword", "关键字", "query", "跨描述、区域、责任人等模糊匹配"),
			businessParam{Name: "status", Title: "整改状态", In: "query", Schema: sEnum("待整改", "整改受阻", "已整改")},
			businessParam{Name: "level", Title: "隐患等级", In: "query", Schema: sEnum("一般隐患", "重大隐患")},
			pStr("area", "检查区域", "query", ""),
			pStr("rectify_person", "整改责任人", "query", ""),
			pInt("hazard_type_id", "隐患类型 id", "query", ""),
			pInt("hazard_unit_id", "责任单位 id", "query", ""),
			businessParam{Name: "overdue", Title: "只看逾期", In: "query", Default: false, HasDefault: true, Schema: map[string]any{"type": "boolean"}},
			pDate("date_from", "检查开始日期", "query", ""),
			pDate("date_to", "检查结束日期", "query", ""),
		),
		businessCreate(
			"create_hazard", "登记隐患", "create_hazard_api_v1_hazards_post",
			"登记一条隐患。inspection_date 缺省今天，level 缺省「一般隐患」，status 缺省「待整改」，与网页端登记表单一致。",
			pStrReq("description", "隐患描述", "body", ""),
			businessParam{Name: "hazard_unit_id", Title: "责任单位 id", In: "body", Required: true, Schema: sInt()},
			businessParam{Name: "hazard_type_id", Title: "隐患类型 id", In: "body", Required: true, Schema: sInt()},
			pStr("inspection_area", "检查区域", "body", ""),
			businessParam{Name: "inspection_date", Title: "检查日期", In: "body", Desc: "缺省今天（+08:00）", Schema: sDate(), DefaultFunc: defaultToday},
			pStr("inspector", "检查人", "body", ""),
			businessParam{Name: "level", Title: "隐患等级", In: "body", Desc: "缺省「一般隐患」", Schema: sEnum("一般隐患", "重大隐患"), Default: "一般隐患", HasDefault: true},
			businessParam{Name: "status", Title: "整改状态", In: "body", Desc: "缺省「待整改」", Schema: sEnum("待整改", "整改受阻", "已整改"), Default: "待整改", HasDefault: true},
			pDate("due_date", "整改期限", "body", ""),
			pStr("rectify_person", "整改责任人", "body", ""),
			pStr("recheck_person", "复查人", "body", ""),
			pStr("suggestion", "整改建议", "body", ""),
			pStr("remark", "备注", "body", ""),
			businessParam{Name: "before_image_ids", Title: "整改前图片 id", In: "body", Schema: sArray(sString())},
			businessParam{Name: "after_image_ids", Title: "整改后图片 id", In: "body", Schema: sArray(sString())},
		),
		businessBatch(
			"update_hazard", "更新隐患", "update_hazard_api_v1_hazards__hazard_id__patch",
			"更新隐患（只传要改的字段）：整改完成通常传 status=已整改、rectify_person 与 after_image_ids；"+
				"hazard_id 与 version 必填，version 来自列表 / 详情返回（乐观锁）。",
			businessParam{Name: "hazard_id", Title: "隐患 id", In: "path", Required: true, Schema: sInt()},
			businessParam{Name: "version", Title: "版本号", In: "body", Required: true, Desc: "列表 / 详情返回的 version（乐观锁）", Schema: sInt()},
			businessParam{Name: "status", Title: "整改状态", In: "body", Schema: sEnum("待整改", "整改受阻", "已整改")},
			businessParam{Name: "level", Title: "隐患等级", In: "body", Schema: sEnum("一般隐患", "重大隐患")},
			pStr("description", "隐患描述", "body", ""),
			pStr("rectify_person", "整改责任人", "body", ""),
			pStr("recheck_person", "复查人", "body", ""),
			pDate("due_date", "整改期限", "body", ""),
			pStr("suggestion", "整改建议", "body", ""),
			pStr("remark", "备注", "body", ""),
			businessParam{Name: "before_image_ids", Title: "整改前图片 id", In: "body", Schema: sArray(sString())},
			businessParam{Name: "after_image_ids", Title: "整改后图片 id", In: "body", Schema: sArray(sString())},
		),
		businessList(
			"list_ledger_items", "查询台账", "list_ledger_items_api_v1_ledger_items_get",
			"查询台账条目（按创建时间倒序），与网页端「台账总览」一致；tag_ids 可传多个标签 id，默认每页 20 条。",
			pStr("keyword", "关键字", "query", "跨台账字段模糊匹配"),
			businessParam{
				Name: "tag_ids", Title: "标签 id", In: "query", JoinComma: true,
				Schema: sArray(map[string]any{"type": "integer"}),
			},
		),

		// ---- 工作管理 ----
		businessList(
			"list_work_tasks", "查询工作任务", "list_work_tasks_api_v1_work_tasks_get",
			"查询工作任务（一行一个任务，按开始时间倒序），与网页端「工作管理」一致；"+
				"tags 传多个标签时命中任意一个即可，status 可传「未完成」或「已完成」。",
			pStr("keyword", "关键字", "query", "工作任务 / 事项或步骤 / 责任人 / 备注 / 标签"),
			businessParam{Name: "tags", Title: "标签", In: "query", JoinComma: true, Schema: sArray(sString())},
			businessParam{Name: "status", Title: "完成状态", In: "query", Schema: sEnum("未完成", "已完成")},
		),
		businessCreate(
			"create_work_task", "新增工作任务", "create_work_task_api_v1_work_tasks_post",
			"新增一条工作任务；完成度 progress 是 0~100 的整数（100 = 已完成），tags 用英文逗号分隔，图片先上传再传 image_ids。",
			pStrReq("name", "工作任务", "body", ""),
			pStr("steps", "事项或步骤", "body", ""),
			pDate("start_date", "开始时间", "body", ""),
			pDate("end_date", "完成时间", "body", ""),
			pStr("owner", "责任人", "body", "可多人，文本"),
			businessParam{Name: "progress", Title: "完成度", In: "body", Desc: "0~100 的整数，100 = 已完成", Schema: sInt(), Default: 0, HasDefault: true},
			pStr("remark", "备注", "body", ""),
			pStr("tags", "标签", "body", "英文逗号分隔，如「安全,检修」"),
			businessParam{Name: "image_ids", Title: "图片 id", In: "body", Schema: sArray(sString())},
		),
		businessBatch(
			"update_work_task", "更新工作任务", "update_work_task_api_v1_work_tasks__task_id__patch",
			"更新工作任务（只传要改的字段，例如只改 progress=100 表示完成）；task_id 与 version 必填，version 来自列表 / 详情返回（乐观锁）。",
			businessParam{Name: "task_id", Title: "任务 id", In: "path", Required: true, Schema: sInt()},
			businessParam{Name: "version", Title: "版本号", In: "body", Required: true, Desc: "列表 / 详情返回的 version（乐观锁）", Schema: sInt()},
			pStr("name", "工作任务", "body", ""),
			pStr("steps", "事项或步骤", "body", ""),
			pDate("start_date", "开始时间", "body", ""),
			pDate("end_date", "完成时间", "body", ""),
			pStr("owner", "责任人", "body", "可多人，文本"),
			businessParam{Name: "progress", Title: "完成度", In: "body", Desc: "0~100 的整数，100 = 已完成", Schema: sInt()},
			pStr("remark", "备注", "body", ""),
			pStr("tags", "标签", "body", "英文逗号分隔，如「安全,检修」"),
			businessParam{Name: "image_ids", Title: "图片 id", In: "body", Schema: sArray(sString())},
		),

		// ---- 备忘录 ----
		businessQuery(
			"list_memos", "查看备忘录", "list_memos_api_v1_memos_get",
			"返回全部备忘录（与网页端「备忘录」一致，不分页）。",
		),
		businessCreate(
			"create_memo", "新增备忘录", "create_memo_api_v1_memos_post",
			"新增一条备忘录；标题与内容都为空时也可保存（与网页端一致）。",
			pStr("title", "标题", "body", ""),
			pStr("content", "内容", "body", ""),
		),
	}
}

var (
	businessIndexOnce sync.Once
	businessIndex     map[string]*businessTool
)

func businessToolByName(name string) *businessTool {
	businessIndexOnce.Do(func() {
		businessIndex = map[string]*businessTool{}
		for _, t := range businessTools() {
			businessIndex[t.Name] = t
		}
	})
	return businessIndex[name]
}

// ---------------- 定义与执行 ----------------

func (t *businessTool) annotations() map[string]any {
	if t.ReadOnly {
		return readOnly()
	}
	return map[string]any{
		"readOnlyHint": false, "destructiveHint": t.Destructive,
		"idempotentHint": false, "openWorldHint": false,
	}
}

func (t *businessTool) definition() map[string]any {
	props := map[string]any{}
	required := []any{}
	for _, p := range t.Params {
		if p.Hidden {
			continue
		}
		schema := map[string]any{}
		for k, v := range p.Schema {
			schema[k] = v
		}
		if p.Title != "" {
			schema["title"] = p.Title
		}
		if p.Desc != "" {
			schema["description"] = p.Desc
		}
		if p.HasDefault {
			schema["default"] = p.Default
		}
		props[p.Name] = schema
		if p.Required {
			required = append(required, p.Name)
		}
	}
	input := map[string]any{"type": "object", "properties": props, "additionalProperties": false}
	if len(required) > 0 {
		input["required"] = required
	}
	return map[string]any{
		"name": t.Name, "title": t.Title, "description": t.Description,
		"inputSchema": input, "outputSchema": objectOutput(t.Name + "Output"),
		"annotations": t.annotations(),
	}
}

// buildRequest 把工具入参按落位拆成路径参数 / 查询参数 / 请求体（缺省值在这里补齐）。
func (t *businessTool) buildRequest(args map[string]any) (map[string]any, map[string]any, map[string]any, error) {
	pathParams, query, body := map[string]any{}, map[string]any{}, map[string]any{}
	for _, p := range t.Params {
		raw, ok := args[p.Name]
		if !ok || raw == nil {
			if p.DefaultFunc != nil {
				raw, ok = p.DefaultFunc(), true
			} else if p.HasDefault {
				raw, ok = p.Default, true
			}
		}
		if !ok {
			if p.Required {
				return nil, nil, nil, errf("%s: Field required", p.Name)
			}
			continue
		}
		if p.JoinComma {
			if items, isList := raw.([]any); isList {
				parts := make([]string, 0, len(items))
				for _, item := range items {
					parts = append(parts, pyStr(item))
				}
				raw = strings.Join(parts, ",")
			}
		} else if p.Schema["type"] == "array" {
			// 容错：模型把数组参数写成单个字符串时按单元素数组处理。
			if _, isList := raw.([]any); !isList {
				raw = []any{raw}
			}
		}
		switch p.In {
		case "path":
			pathParams[p.Name] = raw
		case "query":
			query[p.Name] = raw
		case "body":
			body[p.Name] = raw
		default:
			return nil, nil, nil, errf("内部错误：%s 的参数 %s 落位未知（%s）", t.Name, p.Name, p.In)
		}
	}
	return pathParams, query, body, nil
}

func callBusinessTool(c *gin.Context, ident *identity, tool *businessTool, args map[string]any) (map[string]any, error) {
	_, byID, err := Catalog()
	if err != nil {
		return nil, err
	}
	entry, ok := byID[tool.OperationID]
	if !ok {
		return nil, errf("业务工具 %s 绑定的接口不存在：%s", tool.Name, tool.OperationID)
	}
	pathParams, query, body, err := tool.buildRequest(args)
	if err != nil {
		return nil, err
	}
	path, err := BuildPath(entry.Path, pathParams)
	if err != nil {
		return nil, err
	}
	var bodyArg any
	for _, p := range tool.Params {
		if p.In == "body" {
			bodyArg = body // 写接口即使全用缺省值也要发 {}，不能发空 body
			break
		}
	}
	result, err := callInternal(c, ident, entry.Method, path, query, nil, bodyArg, nil)
	if err != nil {
		return nil, err
	}
	if status, _ := result["status_code"].(int); status >= 400 {
		return nil, errf("%s", failureMessage(result))
	}
	return result, nil
}

// failureMessage 从业务接口的错误响应里提取 code / message，转成工具错误文案。
func failureMessage(result map[string]any) string {
	if data, ok := result["data"].(map[string]any); ok {
		code, _ := data["code"].(string)
		message, _ := data["message"].(string)
		if code != "" && message != "" {
			return code + ": " + message
		}
		if message != "" {
			return message
		}
	}
	return "接口返回 HTTP " + pyStr(result["status_code"])
}
