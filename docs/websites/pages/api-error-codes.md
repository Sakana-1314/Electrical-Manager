# 错误码总表

> 后端当前会返回的全部业务错误码，按分类列出；「HTTP」列是该 code 实际返回的状态码。

## 认证与权限

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 | `api/v1/auth.py` |
| `INVALID_REFRESH_TOKEN` | 401 | 续期凭证无效或已过期 | `api/v1/auth.py` |
| `INVALID_TOKEN` | 401 | 接口令牌无效 | `core/permissions.py` |
| `UNAUTHORIZED` | 401 | 请先登录 | `core/permissions.py` |
| `USER_DISABLED` | 401 | 用户不存在或已停用 | `core/permissions.py` |
| `ACCOUNT_DISABLED` | 403 | 账号待审核或已停用，请联系管理员 | `core/permissions.py`、`mini_program_service` |
| `FORBIDDEN` | 403 | 没有执行此操作的权限 | `core/permissions.py`、`share_link_service` |
| `WECHAT_AUTH_FAILED` | 401 | 微信登录凭证无效，请重试 | `mini_program_service` |
| `MINI_PROGRAM_REGISTRATION_DISABLED` | 403 | 当前暂未开放新用户绑定 | `mini_program_service` |
| `SECONDARY_WAREHOUSE_LITE_MODE` | 403 | 精简模式下二级库仅支持导入与查询 | `api/deps.py` |
| `OUTBOUND_DISABLED` | 403 | 精简模式下不支持出入库 | `mini_program_service` |
| `ARCHIVED_PURCHASE_PLAN_FORBIDDEN` | 403 | 仅超级管理员可查询已归档申购计划 | `api/v1/purchase_materials.py` |

## 并发与状态流转

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `VERSION_CONFLICT` | 409 | 数据已被其他用户修改，请刷新后重试（details 带 `expected`/`actual`） | `core/errors.py` |
| `INVALID_STATUS_TRANSITION` | 409 | 当前状态不允许执行此操作（details 带 `current_status`/`action`） | `core/errors.py` |
| `DATA_CONFLICT` | 409 | 数据约束冲突 | `core/exception_handlers.py` |
| `CLIENT_REQUEST_ID_CONFLICT` | 409 | 请求标识已被其他业务使用 | `mini_program_service` |
| `DUPLICATE_MATERIAL` | 409 | 相同名称、型号规格和单位的物资已存在 | `material_service` |
| `DUPLICATE_USERNAME` | 409 | 用户名已存在 | `dictionary_service` |
| `PLAN_NO_CONFLICT` | 409 | 计划号生成冲突，请稍后重试 | `material_service` |
| `PLAN_ALREADY_MOVED` | 409 | 部分申购计划已转入申购记录 | `purchase_request_service` |
| `PLAN_DAILY_LIMIT_EXCEEDED` | 409 | 同一计划日期最多创建 999 条申购计划 | `material_service` |
| `PURCHASE_PLAN_IN_USE` | 409 | 已转入申购记录的计划不能删除 | `material_service` |
| `STOCK_MATERIAL_IN_USE` | 409 | 该物资已有出入库操作记录，仅支持编辑，不能删除 | `material_service` |
| `MATERIAL_CODE_REQUIRED` | 409 | 未编码物资不能转入申购记录 | `purchase_request_service` |
| `NOT_LOW_STOCK` | 409 | 该物资当前不在低库存范围 | `replenishment_service` |
| `BALANCE_MISSING` | 409 | 库存余额记录不存在 | `inventory_service` |
| `INSUFFICIENT_QUANTITY` | 409 | 冲销数量超过剩余可冲数量 | `inventory_service` |
| `INVALID_REVERSAL_LINE` | 400 | 冲销行不在原流水内 | `inventory_service` |
| `REVERSAL_NOT_ALLOWED` | 409 | 冲销记录不能再被冲销 | `inventory_service` |
| `CANNOT_DELETE_CURRENT_USER` | 409 | 不能删除当前登录用户 | `dictionary_service` |
| `IMPORT_IN_PROGRESS` | 409 | 同类导入任务正在进行中 | `import_job_service` |
| `FILE_IN_USE` | 409 | 图片已被业务引用，不能删除 | `file_service` |
| `MINI_PROGRAM_IDENTITY_CONFLICT` | 409 | 两个账号包含相同小程序身份，无法直接合并 | `mini_program_service` |
| `MINI_PROGRAM_USER_PROFILE_MISMATCH` | 409 | 姓名和部门单位必须一致才能合并账号 | `mini_program_service` |
| `WECHAT_USER_CREATE_CONFLICT` | 409 | 微信用户创建冲突，请重新登录 | `mini_program_service` |

## 请求与业务校验

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `VALIDATION_ERROR` | 422 | 请求字段或筛选参数不合法 | `core/exception_handlers.py`、各 API |
| `NOT_FOUND` | 400 | 资源不存在（不区分物资/用户/流水，message 里带具体对象） | 全局 |
| `BUSINESS_REASON_REQUIRED` | 400 | 出库必须填写用途 | `inventory_service` |
| `RECEIVER_REQUIRED` | 400 | 出库必须填写领用人 | `inventory_service` |
| `INVALID_RECEIVER` | 400 | 只有出库业务可以填写领用人 | `inventory_service` |
| `INVALID_RECEIVER_UNIT` | 400 | 只有出库业务可以填写领用单位 | `inventory_service` |
| `INVALID_SOURCE_TYPE` | 400 | 初始化业务只能是入库 | `inventory_service` |
| `INVALID_QUANTITY_PRECISION` | 400 | 数量小数位超出限制 | `services/common.py` |
| `EXPORT_RESULT_LIMIT_EXCEEDED` | 400 | 查询结果超过导出行数上限，请缩小筛选范围 | `api/v1/purchase_*` |
| `PURCHASE_APPLICATION_EXPORT_FIELDS_REQUIRED` | 409 | 导出采购申请表前需补全字段（message 列出缺失项） | `material_service` |
| `PURCHASE_APPROVAL_EXPORT_FIELDS_REQUIRED` | 409 | 导出申购审批表前需补全字段 | `material_service` |
| `INVALID_WEBHOOK_URL` | 422 | 请输入有效的机器人 Webhook 地址 | `webhook_service` |
| `WEBHOOK_URL_REQUIRED` | 422 | 启用推送前请填写 Webhook 地址 | `webhook_service` |
| `WEBHOOK_EVENTS_REQUIRED` | 422 | 启用推送前请至少选择一个事件 | `webhook_service` |
| `MINI_PROGRAM_USER_MERGE_SAME_ACCOUNT` | 400 | 不能将小程序账号合并到自身 | `mini_program_service` |
| `MINI_PROGRAM_APP_NOT_CONFIGURED` | 400 | 所选微信小程序 AppID 未配置 | `ai_search_service` |

## 图片与文件

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `INVALID_IMAGE` | 400 | 图片无法解码 | `file_service` |
| `INVALID_IMAGE_ID` | 400 | 图片不存在 | `material_service` |
| `FILE_MISSING` | 400 | 图片文件不存在（记录在库但磁盘缺失） | `file_service` |
| `INVALID_IMAGE_TYPE` | 400 | 仅支持 JPEG、PNG 或 WebP 图片 | `file_service` |
| `IMAGE_TOO_LARGE` | 413 | 单张图片超过 10 MB | `file_service` |
| `FILE_ALREADY_DELETED` | 409 | 图片已提交删除，等待凌晨 2 点清理 | `file_service` |

## 表格导入

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `UNSUPPORTED_EXCEL_FILE` | 400 | 仅支持 `.xls`、`.xlsx` 或 `.csv` | `api/v1/huaxing_inventory.py` 等 |
| `INVALID_EXCEL_FILE` | 400 | 无法读取 Excel 文件 | `import_file_reader` |
| `INVALID_CSV_FILE` | 400 | 无法解析 CSV 编码（需 UTF-8 或 GBK） | `import_file_reader` |
| `XLS_SUPPORT_UNAVAILABLE` | 400 | 环境未安装 `.xls` 解析依赖 | `import_file_reader` |
| `EXCEL_FILE_TOO_LARGE` | 400 | 导入文件超过大小上限 | `import_job_service` |
| `HUAXING_IMPORT_EMPTY` / `LITE_IMPORT_EMPTY` / `MATERIAL_CODE_IMPORT_EMPTY` | 400 | 表格中没有可导入的数据 | 各自 service |
| `HUAXING_IMPORT_HEADERS_MISSING` / `LITE_IMPORT_HEADERS_MISSING` / `MATERIAL_CODE_IMPORT_HEADERS_MISSING` | 400 | 缺少必需列（message 列出列名） | 各自 service |
| `HUAXING_IMPORT_CODE_REQUIRED` / `LITE_IMPORT_NAME_REQUIRED` / `MATERIAL_CODE_IMPORT_CODE_REQUIRED` | 400 | 某行缺少必需字段 | 各自 service |
| `HUAXING_IMPORT_INVALID_QUANTITY` / `LITE_IMPORT_INVALID_QUANTITY` | 400 | 某行数量不是有效数值 | 各自 service |
| `HUAXING_IMPORT_VALUE_TOO_LONG` / `LITE_IMPORT_VALUE_TOO_LONG` / `MATERIAL_CODE_IMPORT_VALUE_TOO_LONG` | 400 | 某行单元格超长 | 各自 service |
| `MATERIAL_CODE_IMPORT_UNIT_REQUIRED` | 400 | 某行缺少记账单位名称 | `material_code_library_service` |
| `MATERIAL_CODE_IMPORT_DUPLICATE` | 400 | 表格内编码重复 | `material_code_library_service` |

## 导出任务

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `EXPORT_FILE_EXPIRED` | 400 | 导出文件已过期或不存在，请重新导出 | `excel_export_job_service` |
| `INTERNAL_EXPORT_ERROR` | 400 | 导出任务未返回有效结果 | `excel_export_job_service` |
| `EXPORT_TEMPLATE_MISSING` | 400 | 导出模板缺失（检查 `server/app/templates/`） | `excel_export_service` |
| `EXPORT_TEMPLATE_INVALID` | 400 | 导出模板编码错误 | `excel_export_service` |

## 分享链接

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `SHARE_NOT_FOUND` | 400 | 分享链接不存在或已失效 | `share_link_service` |
| `SHARE_EXPIRED` | 400 | 分享链接已失效，请联系分享人重新分享 | `share_link_service` |

## AI 搜索（上游）

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `AI_NOT_CONFIGURED` | 503 | AI 搜索服务未启用或配置不完整 | `ai_search_service` |
| `AI_API_KEY_DECRYPT_FAILED` | 503 | API Key 无法解密，请重新保存配置 | `ai_search_service` |
| `AI_CONNECTION_FAILED` | 400 | 无法连接 AI 服务（地址/DNS/TLS/出网） | `ai_search_service` |
| `AI_CONNECT_TIMEOUT` | 400 | 连接 AI 服务超时 | `ai_search_service` |
| `AI_REQUEST_FAILED` | 400 | 请求 AI 服务失败 | `ai_search_service` |
| `AI_REQUEST_TIMEOUT` / `AI_RESPONSE_TIMEOUT` | 400 | 请求或等待上游响应超时 | `ai_search_service` |
| `AI_RATE_LIMITED` | 429 | 上游限流 | `ai_search_service` |
| `AI_INVALID_RESPONSE` | 502 | 上游返回不是有效 JSON | `ai_search_service` |
| `AI_UPSTREAM_FAILED` | 502 | 上游返回错误状态 | `ai_search_service` |
| `AI_ENDPOINT_NOT_FOUND` | 400 | 上游接口 404（地址填错） | `ai_search_service` |
| `AI_AUTH_FAILED` | 400 | 上游鉴权失败（Key 无效） | `ai_search_service` |
| `AI_REQUEST_REJECTED` | 400 | 上游拒绝请求（模型名/参数不对） | `ai_search_service` |

## 微信小程序（上游）

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `WECHAT_NOT_CONFIGURED` | 503 | 微信小程序登录尚未配置 | `core/wechat.py` |
| `WECHAT_CONFIGURATION_INVALID` | 503 | AppID 与 AppSecret 配置无效 | `core/wechat.py` |
| `WECHAT_AUTH_UNAVAILABLE` | 503 | 微信登录服务暂时不可用 | `mini_program_service` |
| `WECHAT_AUTH_INVALID_RESPONSE` | 502 | 微信登录服务返回异常 | `mini_program_service` |
| `WECHAT_ACCESS_TOKEN_FAILED` | 502 | 微信接口凭证获取失败 | `mini_program_service` |
| `WECHAT_ACCESS_TOKEN_UNAVAILABLE` | 503 | 微信接口调用暂时不可用 | `mini_program_service` |
| `WECHAT_MINI_PROGRAM_CODE_FAILED` | 502 | 小程序码生成失败 | `mini_program_service` |
| `WECHAT_MINI_PROGRAM_CODE_INVALID_RESPONSE` | 502 | 小程序码生成服务返回异常 | `mini_program_service` |
| `WECHAT_MINI_PROGRAM_CODE_UNAVAILABLE` | 503 | 小程序码生成服务暂时不可用 | `mini_program_service` |

## Webhook 投递（上游）

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `WEBHOOK_CREDENTIAL_DECRYPT_FAILED` | 503 | Webhook 配置无法解密，请重新保存 | `webhook_service` |
| `WEBHOOK_TEST_FAILED` | 502 | 测试推送失败 | `webhook_service` |

## 系统与框架

| code | HTTP | 含义 | 主要来源 |
| --- | --- | --- | --- |
| `ROUTE_NOT_FOUND` | 400 | 接口路径不存在（框架 404 重映射） | `core/exception_handlers.py` |
| `INTERNAL_SERVER_ERROR` | 500 | 服务内部异常 | `core/exception_handlers.py` |
| `DATABASE_ERROR` | 500 | 数据库操作失败 | `core/exception_handlers.py` |
| `DATABASE_QUERY_ERROR` | 500 | 数据库查询执行失败 | `core/exception_handlers.py` |
| `DATABASE_UNAVAILABLE` | 503 | 数据库暂时不可用 | `core/exception_handlers.py`、`main.py` |

## 不在上表的码

- `HTTP_ERROR`：其余 Starlette HTTP 异常（如 405 Method Not Allowed）**按原始状态码透传**，message 为框架 `detail`，没有固定 HTTP 状态码。
- SERVER_RESTARTED：异步任务（Excel 导入/导出）记录的 `error_code` 字段内部标记（服务重启导致任务中断），不是 HTTP 错误响应的 `code`。

## 新增错误码时的要求

1. 在 `server/app/core/errors.py` 的 `_DEFAULT_STATUS_BY_CODE` 里登记默认状态码（除非所有调用点都显式传 `status_code`）。
2. 在本页对应分类下补一行：code、HTTP 状态码、含义、来源文件。
3. 运行 `cd server && pytest tests/test_error_code_docs.py`。
