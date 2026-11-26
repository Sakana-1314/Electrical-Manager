package mcp

import "fmt"

// 字段中文名：MCP 工具目录的字段标题必须与网页端 / 小程序端界面文案一致。
//
// 契约（docs/openapi.yaml）里的 title 是 FastAPI 时代从英文属性名派生的（如
// Actual Demand Person / Purchase Responsible），与界面文案并不一致，甚至语义相反：
//   - actual_demand_person 在界面上叫「提报员工」
//   - purchase_responsible 在界面上叫「实际需求人」
// 这里只改 describe_api_operation 的展示层（字段键名、契约与接口返回都不变），
// 让 Agent 用界面上的叫法与用户沟通，避免把两个人员字段弄反。
//
// 同一个字段在不同模块含义不同（如 name、status、item_id、material_id），
// 因此参数按接口标签（tags）+ 字段名消歧，schema 属性按 schema 名 + 字段名覆盖。

// defaultParamLabels 是接口参数（路径 / 查询）的默认中文名。
// 所有 MCP 可见参数都必须在这里有标签（field_labels_test.go 校验，新增参数时补一行）。
var defaultParamLabels = map[string]string{
	// 分页与搜索
	"page":         "页码",
	"page_size":    "每页条数",
	"keyword":      "关键词",
	"search_field": "搜索字段",
	"search_value": "搜索值",
	"sort_by":      "排序字段",
	"sort_order":   "排序方向",
	"limit":        "数量上限",
	"cursor":       "分页游标",
	"fields":       "同步字段",
	// 申购计划 / 记录
	"actual_demand_person":       "提报员工",
	"empty_actual_demand_person": "提报员工为空",
	"purchase_responsible":       "实际需求人",
	"subitem_no":                 "子项号",
	"empty_subitem_no":           "子项号为空",
	"category":                   "类别",
	"status":                     "状态",
	"empty_status":               "状态为空",
	"coded":                      "已编码",
	"moved":                      "已转入记录",
	"purchase_order_no":          "申购单号",
	"trace_no":                   "追溯号",
	"usage":                      "用途",
	"salesperson":                "业务员",
	"min_purchase_order_no":      "申购单号下限",
	"max_purchase_order_no":      "申购单号上限",
	// 物资 / 库存 / 流水
	"material_id":    "物资 ID",
	"material_uuid":  "物资标识",
	"material_code":  "物料编码",
	"material_name":  "物资名称",
	"model_spec":     "型号规格",
	"name":           "名称",
	"operation_id":   "流水 ID",
	"operation_no":   "流水号",
	"operation_type": "类型",
	"source_type":    "来源类型",
	"start_at":       "开始时间",
	"end_at":         "结束时间",
	"min_qty":        "库存下限",
	"max_qty":        "库存上限",
	"low_stock":      "仅低库存",
	"table":          "数据表",
	// 华星总库存
	"purchase_department": "申购部门",
	"purchaser":           "申购人",
	"date_from":           "开始日期",
	"date_to":             "结束日期",
	// 隐患
	"level":          "隐患等级",
	"area":           "检查区域",
	"rectify_person": "整改员工",
	"overdue":        "仅逾期",
	"hazard_id":      "隐患 ID",
	"hazard_type_id": "隐患类型",
	"hazard_unit_id": "责任单位",
	"unit_id":        "责任单位 ID",
	"type_id":        "隐患类型 ID",
	"enabled":        "启用",
	// 台账
	"scope":   "标签范围",
	"tag_id":  "标签 ID",
	"tag_ids": "标签",
	// 工作管理
	"task_id":      "任务 ID",
	"task_ids":     "任务",
	"record_id":    "工作记录 ID",
	"participants": "参与人员",
	"start_date":   "开始日期",
	"end_date":     "结束日期",
	// 分享 / 附件 / 导出 / 导入
	"token":            "分享令牌",
	"file_id":          "附件 ID",
	"file_uuid":        "文件 UUID",
	"job_id":           "任务 ID",
	"older_than_hours": "早于（小时）",
	"referenced":       "引用情况",
	"size":             "尺寸",
	// 其它
	"appid":       "小程序 AppID",
	"env":         "小程序环境",
	"item_id":     "条目 ID",
	"line_id":     "申购记录行 ID",
	"memo_id":     "备忘录 ID",
	"template_id": "模板 ID",
}

// paramLabelsByTag 覆盖同名字段在不同模块的界面叫法（键为契约里的接口标签）。
var paramLabelsByTag = map[string]map[string]string{
	"二级库物资": {
		"name": "物资名称",
	},
	"华星库存": {
		"name":          "货品名称",
		"model_spec":    "型号",
		"material_code": "货品编码",
		"date_from":     "首次入库日期（开始）",
		"date_to":       "首次入库日期（结束）",
		"job_id":        "导入任务 ID",
	},
	"物料编码库": {
		"name":       "名称",
		"model_spec": "型号",
		"job_id":     "导入任务 ID",
	},
	"二级库": {
		"name":   "物资名称",
		"job_id": "导入任务 ID",
	},
	"申购记录": {
		"name": "物资名称",
	},
	"申购计划": {
		"material_id": "申购计划 ID",
	},
	"库存": {
		"material_id": "物资 ID",
	},
	"基础数据": {
		"item_id": "用户 ID",
	},
	"台账管理": {
		"item_id": "台账 ID",
	},
	"项目管理": {
		"item_id": "项目 ID",
	},
	"导出任务": {
		"job_id": "导出任务 ID",
	},
	"隐患管理": {
		"status":    "整改状态",
		"date_from": "检查日期（开始）",
		"date_to":   "检查日期（结束）",
	},
}

// defaultFieldLabels 是 schema 属性的默认中文名（界面上最常见的叫法）。
var defaultFieldLabels = map[string]string{
	// 通用
	"id":                         "ID",
	"items":                      "数据列表",
	"total":                      "总条数",
	"page":                       "页码",
	"page_size":                  "每页条数",
	"sort_by":                    "排序字段",
	"sort_order":                 "排序方向",
	"exists":                     "是否存在",
	"version":                    "版本号",
	"created_at":                 "创建时间",
	"updated_at":                 "更新时间",
	"remark":                     "备注",
	"enabled":                    "启用",
	"images":                     "图片",
	"image_ids":                  "图片",
	"name":                       "名称",
	"model_spec":                 "型号规格",
	"unit_name":                  "计量单位",
	"quantity":                   "数量",
	"status":                     "状态",
	"category":                   "类别",
	"urgency":                    "紧急程度",
	"demand_department":          "需求部门",
	"demand_date":                "需求日期",
	"plan_date":                  "需求日期",
	"material_code":              "物料编码",
	"material_name":              "物资名称",
	"subitem_no":                 "子项号",
	"empty_subitem_no":           "子项号为空",
	"empty_status":               "状态为空",
	"empty_actual_demand_person": "提报员工为空",
	"usage":                      "用途",
	"stock_material_id":          "关联二级库物资",
	"stock_material_name":        "二级库物资",
	"moved_to_record":            "已转入申购记录",
	"actual_demand_person":       "提报员工",
	"purchase_responsible":       "实际需求人",
	"planned_qty":                "计划数量",
	"materials":                  "计划列表",
	"material_ids":               "计划 ID 列表",
	"purchase_qty":               "申购数量",
	"records":                    "申购记录列表",
	"unit_price":                 "单价",
	"purchase_order_no":          "申购单号",
	"trace_no":                   "追溯号",
	"contract_no":                "合同号",
	"vessel_no":                  "船号",
	"consolidation_date":         "集港日期",
	"consolidation_port":         "集港港口",
	"sailing_date":               "发船日期",
	"contract_sign_date":         "合同签订日期",
	"purchase_date":              "申购日期",
	"salesperson":                "业务员",
	"plan_no":                    "计划 ID",
	"plan_remark":                "计划备注",
	"record_remark":              "记录备注",
	"line_id":                    "申购记录行 ID",
	"purchase_material_id":       "申购计划 ID",
	"purchase_request_id":        "申购记录 ID",
	"trace_nos":                  "追溯号",
	// 物资 / 库存 / 流水
	"uuid":                   "物资标识",
	"alias":                  "别名",
	"name_id":                "物资名称（印尼语）",
	"current_qty":            "当前库存",
	"minimum_qty":            "最低库存",
	"is_low_stock":           "低库存",
	"suggested_purchase_qty": "建议申购数量",
	"replenishment_policy":   "补库策略",
	"has_operation_records":  "有出入库记录",
	"operation_no":           "流水号",
	"operation_type":         "类型",
	"occurred_at":            "发生时间",
	"source_type":            "来源类型",
	"business_reason":        "用途",
	"receiver_unit":          "领用单位",
	"receiver_name":          "领用人",
	"lines":                  "物资明细",
	"client_request_id":      "客户端请求 ID",
	"mini_program_user_name": "小程序操作人",
	"reversal_of_id":         "冲销的原流水 ID",
	"is_reversed":            "已冲销",
	"before_qty":             "操作前数量",
	"after_qty":              "操作后数量",
	"remaining_qty":          "剩余数量",
	"reason":                 "原因",
	// 物料编码库 / 华星总库存 / 二级库 Lite
	"first_inbound_date":  "首次入库日期",
	"warehouse":           "仓库",
	"purchaser":           "申购人",
	"purchase_department": "申购部门",
	"subitem_no_name":     "子项号名称",
	"last_import_at":      "上次导入时间",
	// 隐患
	"inspection_area":  "检查区域",
	"inspection_date":  "检查日期",
	"inspector":        "检查人员",
	"description":      "描述",
	"suggestion":       "建议整改方案",
	"hazard_unit_id":   "责任单位",
	"hazard_unit_name": "责任单位",
	"person":           "责任人",
	"due_date":         "要求完成时间",
	"recheck_person":   "复查人员",
	"rectify_person":   "整改员工",
	"hazard_type_id":   "隐患类型",
	"major":            "大类",
	"minor":            "小类",
	"level":            "等级",
	"before_images":    "整改前图片",
	"before_image_ids": "整改前图片",
	"after_images":     "整改后图片",
	"after_image_ids":  "整改后图片",
	"pending":          "待整改",
	"blocked":          "整改受阻",
	"done":             "已整改",
	"overdue":          "逾期未整改",
	// 台账
	"tag_ids":     "标签",
	"tags":        "标签",
	"parent_id":   "上级标签",
	"child_count": "子标签数",
	"item_count":  "条数",
	"path":        "标签路径",
	// 工作管理
	"task_id":         "任务",
	"task_name":       "任务名称",
	"task_status":     "任务状态",
	"start_date":      "开始日期",
	"end_date":        "结束日期",
	"start_half":      "开始时段",
	"end_half":        "结束时段",
	"participants":    "参与人员",
	"record_count":    "记录数",
	"plan_start_date": "计划开始",
	"plan_end_date":   "计划结束",
	"date":            "日期",
	"slot":            "时段",
	"task":            "任务",
	"record_id":       "工作记录 ID",
	// 用户 / 项目 / 分享 / 附件 / 设置
	"username":                          "用户名",
	"password":                          "密码",
	"display_name":                      "显示名称",
	"department_name":                   "部门",
	"wechat_openid":                     "微信绑定",
	"permissions":                       "权限",
	"last_used_at":                      "最近登录",
	"current_password":                  "当前密码",
	"new_password":                      "新密码",
	"api_token":                         "接口令牌",
	"default_permissions":               "默认用户权限",
	"mini_program_registration_enabled": "小程序注册",
	"is_default":                        "默认项目",
	"title":                             "标题",
	"content":                           "内容",
	"token":                             "令牌",
	"share_type":                        "类型",
	"item_ids":                          "记录 ID",
	"columns":                           "展示列",
	"expires_in":                        "失效时间",
	"expires_at":                        "失效时间",
	"created_by":                        "创建人 ID",
	"created_by_name":                   "创建人",
	"original_name":                     "文件名",
	"mime_type":                         "文件类型",
	"size_bytes":                        "大小",
	"width":                             "宽度",
	"height":                            "高度",
	"reference_count":                   "被引用次数",
	"deleted_at":                        "删除时间",
	"file_exists":                       "文件存在",
	"file":                              "文件",
	"export_type":                       "导出类型",
	"import_type":                       "导入类型",
	"original_filename":                 "原始文件名",
	"download_filename":                 "下载文件名",
	"file_uuid":                         "文件 UUID",
	"params":                            "参数",
	"result":                            "结果",
	"error_code":                        "错误码",
	"error_message":                     "错误信息",
	"started_at":                        "开始时间",
	"finished_at":                       "完成时间",
	// 工作台
	"stock_material_count":            "库存物资",
	"lite_inventory_count":            "Lite 库存",
	"low_stock_count":                 "低库存",
	"uncoded_purchase_material_count": "未编码物资",
	"purchase_record_count":           "申购记录",
	"pending_purchase_plan_count":     "待请购计划",
	"purchase_in_progress_count":      "在途申购",
	"today_inbound_count":             "今日入库",
	"today_outbound_count":            "今日出库",
	// 权限 / 版本 / AI 搜索
	"key":        "权限键",
	"module":     "模块",
	"action":     "操作",
	"label":      "名称",
	"bit":        "权限位",
	"available":  "可用",
	"value":      "查询词",
	"original":   "原始词",
	"expanded":   "扩展词",
	"app_name":   "应用名称",
	"commit":     "提交",
	"build_time": "构建时间",
	// 同步 / 附件清理 / 图片查重
	"applied":              "已应用",
	"not_found":            "未找到",
	"affected_headers":     "受影响表头",
	"affected_lines":       "受影响行数",
	"cursor_id":            "游标 ID",
	"next_cursor":          "下一页游标",
	"has_more":             "还有更多",
	"target_count":         "目标记录数",
	"cutoff":               "截止时间",
	"protect_days":         "保留天数",
	"protected_count":      "保护数量",
	"deleted_count":        "删除数量",
	"skipped_recent_count": "近期跳过数量",
	"deleted_file_names":   "删除文件名",
	"deleted_record_ids":   "删除记录 ID",
	"purge_after":          "清理时间",
	"missing_file_ids":     "缺失文件 ID",
	"unreferenced_records": "未引用记录",
	"untracked_file_names": "未登记文件名",
	"sha256":               "文件摘要（SHA-256）",
	"matched":              "是否匹配",
	"length":               "长度",
	"offset":               "偏移",
	"slice_sha256":         "分片摘要（SHA-256）",
	"request_id":           "请求 ID",
	"details":              "详情",
	"code":                 "错误码",
	"message":              "错误信息",
	// 选项列表
	"actual_demand_persons": "提报员工选项",
	"purchase_responsibles": "实际需求人选项",
	"subitem_nos":           "子项号选项",
	"categories":            "类别选项",
	"salespersons":          "业务员选项",
	"statuses":              "状态选项",
	"purchase_departments":  "申购部门选项",
	"purchasers":            "申购人选项",
	"rectify_persons":       "整改员工选项",
	"units":                 "责任单位选项",
	"types":                 "隐患类型选项",
}

// schemaFieldLabels 按 schema 名覆盖默认名：同一字段在不同模块的界面文案不同时使用。
var schemaFieldLabels = map[string]map[string]string{
	"OperationLineWrite": {
		"stock_material_id": "物资",
	},
	"StockOperationLineRead": {
		"stock_material_id": "物资 ID",
	},
	"WorkOverviewRowRead": {
		"task_id": "任务 ID",
	},
	"PurchaseRecordResultExportRequest": {
		"name": "物资名称",
	},
	"StockMaterialRead": {
		"name":    "物资名称",
		"name_id": "物资名称（印尼语）",
	},
	"StockMaterialCreate": {
		"name":    "物资名称",
		"name_id": "物资名称（印尼语）",
	},
	"StockMaterialUpdate": {
		"name":    "物资名称",
		"name_id": "物资名称（印尼语）",
	},
	"InventoryBalanceRead": {
		"name":              "物资名称",
		"stock_material_id": "物资 ID",
	},
	"ReplenishmentPolicyRead": {
		"enabled": "低库存预警",
	},
	"ReplenishmentPolicyWrite": {
		"enabled": "低库存预警",
	},
	"ReplenishmentDraftRead": {
		"next":        "下一条",
		"resource_id": "资源 ID",
	},
	"HuaXingInventoryRead": {
		"material_code":       "货品编码",
		"name":                "货品名称",
		"model_spec":          "型号",
		"unit_name":           "单位",
		"purchaser":           "申购人",
		"purchase_department": "申购部门",
		"subitem_no_name":     "子项号名称",
	},
	"MaterialCodeLibraryRead": {
		"model_spec": "型号",
		"unit_price": "全成本单价（元）",
	},
	"LiteInventoryRead": {
		"name":      "物资名称",
		"unit_name": "单位",
	},
	"LedgerItemRead": {
		"model_spec": "型号",
		"unit_name":  "单位",
	},
	"LedgerItemCreate": {
		"model_spec": "型号",
		"unit_name":  "单位",
	},
	"LedgerItemUpdate": {
		"model_spec": "型号",
		"unit_name":  "单位",
	},
	"LedgerTagRead": {
		"name":       "标签名称",
		"level":      "层级",
		"item_count": "使用数量",
	},
	"LedgerTagCreate": {
		"name": "标签名称",
	},
	"LedgerTagUpdate": {
		"name": "标签名称",
	},
	"HazardRead": {
		"description":    "隐患描述",
		"status":         "整改状态",
		"level":          "隐患等级",
		"hazard_unit_id": "责任单位",
		"hazard_type_id": "隐患类型",
	},
	"HazardCreate": {
		"description":    "隐患描述",
		"status":         "整改状态",
		"level":          "隐患等级",
		"hazard_unit_id": "责任单位",
		"hazard_type_id": "隐患类型",
	},
	"HazardUpdate": {
		"description":    "隐患描述",
		"status":         "整改状态",
		"level":          "隐患等级",
		"hazard_unit_id": "责任单位",
		"hazard_type_id": "隐患类型",
	},
	"HazardUnitRead": {
		"name": "单位名称",
	},
	"HazardUnitCreate": {
		"name": "单位名称",
	},
	"HazardUnitUpdate": {
		"name": "单位名称",
	},
	"WorkTaskRead": {
		"name":            "任务名称",
		"description":     "工作内容",
		"images":          "图片附件",
		"plan_start_date": "计划开始",
		"plan_end_date":   "计划结束",
	},
	"WorkTaskCreate": {
		"name":            "任务名称",
		"description":     "工作内容",
		"image_ids":       "图片附件",
		"plan_start_date": "计划开始",
		"plan_end_date":   "计划结束",
	},
	"WorkTaskUpdate": {
		"name":            "任务名称",
		"description":     "工作内容",
		"image_ids":       "图片附件",
		"plan_start_date": "计划开始",
		"plan_end_date":   "计划结束",
	},
	"WorkRecordCreate": {
		"task_id": "任务",
	},
	"WorkRecordUpdate": {
		"task_id": "任务",
	},
	"WorkTaskTimelineRead": {
		"records": "工作记录列表",
	},
	"WorkWorkerTimelineRead": {
		"name":    "参与人员",
		"records": "工作记录列表",
	},
	"UserRead": {
		"created_at":      "首次登录",
		"last_used_at":    "最近登录",
		"wechat_openid":   "微信绑定",
		"department_name": "部门",
	},
	"UserCreate": {
		"department_name": "部门单位",
	},
	"UserUpdate": {
		"department_name": "部门单位",
	},
	"UserApiTokenRead": {
		"department_name": "部门单位",
		"last_used_at":    "最近使用时间",
		"wechat_openid":   "微信绑定",
	},
	"UserMergeRequest": {
		"source_user_id": "来源账号 ID",
		"source_version": "来源账号版本号",
		"target_version": "目标账号版本号",
	},
	"ShareRead": {
		"token":      "分享令牌",
		"item_count": "条数",
	},
	"ShareListRead": {
		"token":      "分享令牌",
		"item_count": "条数",
	},
	"SharePublicView": {
		"token":      "分享令牌",
		"item_count": "条数",
	},
	"AttachmentRead": {
		"original_name":   "文件名",
		"created_at":      "上传时间",
		"size_bytes":      "大小",
		"reference_count": "被引用次数",
		"deleted_at":      "删除时间",
		"file_exists":     "文件存在",
	},
	"ImageDigestCheckRequest": {
		"size_bytes": "文件大小",
	},
	"VersionInfoRead": {
		"version": "版本",
	},
	"PurchaseRecordSyncTargetsRead": {
		"items": "同步目标",
	},
	"PurchaseRecordSyncOrderTargetsRead": {
		"items": "同步目标",
	},
	"PurchaseRecordSyncOrderApply": {
		"items": "同步目标",
	},
	"PurchaseRecordSyncOrderTargetRead": {
		"trace_nos": "追溯号",
	},
	"Page_PurchaseRecordSyncTargetsRead_": {
		"items": "同步目标",
	},
}

// paramLabel 返回参数的中文名：先按接口标签覆盖，再取默认名。
func paramLabel(tags []any, name string) (string, bool) {
	for _, tag := range tags {
		if labels, ok := paramLabelsByTag[fmt.Sprint(tag)]; ok {
			if label, ok := labels[name]; ok {
				return label, true
			}
		}
	}
	label, ok := defaultParamLabels[name]
	return label, ok
}

// schemaFieldLabel 返回 schema 属性的中文名：先按 schema 名覆盖，再取默认名。
func schemaFieldLabel(schema, field string) (string, bool) {
	if labels, ok := schemaFieldLabels[schema]; ok {
		if label, ok := labels[field]; ok {
			return label, true
		}
	}
	label, ok := defaultFieldLabels[field]
	return label, ok
}

// applyFieldLabels 把中文名写进参数 schema 与各 schema 属性的 title（只改展示，不改字段键名）。
// 传入的 entry 数据必须已深拷贝，避免修改内嵌契约（/api/v1/openapi.json 与 Swagger 仍用原文）。
func applyFieldLabels(entry *CatalogEntry) {
	for _, raw := range entry.Parameters {
		item, _ := raw.(map[string]any)
		name, _ := item["name"].(string)
		label, ok := paramLabel(entry.Tags, name)
		if !ok {
			continue
		}
		if schema, ok := item["schema"].(map[string]any); ok {
			schema["title"] = label
		}
	}
	for schemaName, raw := range entry.Schemas {
		schema, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		properties, _ := schema["properties"].(map[string]any)
		for field, rawProperty := range properties {
			property, ok := rawProperty.(map[string]any)
			if !ok {
				continue
			}
			if label, ok := schemaFieldLabel(schemaName, field); ok {
				property["title"] = label
			}
		}
	}
}

// cloneJSONValue 深拷贝契约里解出的 JSON 值（map[string]any / []any / 标量）。
// 契约数据是进程内共享的只读文档，MCP 要改 title 必须先拷贝。
func cloneJSONValue(value any) any {
	switch x := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(x))
		for key, child := range x {
			out[key] = cloneJSONValue(child)
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, child := range x {
			out[i] = cloneJSONValue(child)
		}
		return out
	default:
		return value
	}
}
