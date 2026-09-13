# 测试与质量
后端 `server/tests/` 的 pytest 套件（单元 / 集成 / 契约校验三类）、前端 `web/src/**/*.spec.ts` 的 Vitest 套件、`.github/workflows/` 下的 8 条 CI 流水线，以及本地提交前需要执行的验证命令。

| 层次 | 位置 | 运行环境 | 作用 |
| --- | --- | --- | --- |
| 后端单元测试 | `server/tests/unit/`、`server/tests/test_*.py` | 无网络、无 MySQL | 纯函数 / 服务逻辑 / schema / 标识符 / 日志 |
| 后端集成测试 | `server/tests/integration/` | 内存 SQLite（`sqlite+aiosqlite:///:memory:`）+ `httpx.ASGITransport` | 真实路由、鉴权、权限、并发、状态流转 |
| Schema 与文档契约 | `server/tests/test_init_sql.py`、`server/tests/test_error_code_docs.py` | 直接读文件 | 保证 `docs/references/database/init.sql`、错误码文档与代码不漂移 |
| 前端单测 | `web/src/**/*.spec.ts`（31 个文件） | Vitest + jsdom | 组件、composable、工具函数、store、类型权限矩阵 |
接口契约另有独立门禁：CI 会重新导出 `docs/openapi.yaml` 与 `web/src/api/generated.raw.ts` 并校验无 diff，详见 [CI 工作流](#ci-工作流)。
## 后端测试套件
`server/tests/` 共 38 个 `test_*.py` 文件：根目录 14 个、`unit/` 3 个、`integration/` 21 个；根目录另有 `conftest.py` 与 `__init__.py`（`unit/`、`integration/` 目录下无 `__init__.py`）。

<Tabs :tabs="[
  { id: 't0', title: '夹具与 init.sql 校验' },
  { id: 't1', title: '测试用例清单' },
  { id: 't2', title: '前端测试与 CI' },
  { id: 't3', title: '本地验证与回归' }
]">

<TabsContent id="t0">

### `server/tests/conftest.py`
该文件只有 1 个 pytest 夹具与 3 个模块级辅助函数：

| 名称 | 类型 | 作用与关键实现 |
| --- | --- | --- |
| `client` | `@pytest_asyncio.fixture`（`AsyncIterator[AsyncClient]`） | 每用例创建并销毁表结构；`httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test")` |
| `auth_headers` | 辅助函数 | POST `/api/v1/auth/login`（密码 `123456`），返回 `{"Authorization": "Bearer <access_token>"}` |
| `await_export_job` | 辅助函数 | 轮询 `GET /api/v1/excel-export-jobs/{job_id}` 直到 `SUCCEEDED`／`FAILED`（默认 2 秒超时，间隔 0.05 秒） |
| `create_stock` | 辅助函数 | POST `/api/v1/stock-materials` 建二级库物资并返回其 `id`（默认名称「交流接触器」） |
关键实现细节：

| 项 | 实现 |
| --- | --- |
| 环境变量注入 | 在导入 app 之前注入：`APP_DATABASE_URL` 取 `TEST_DATABASE_URL`（默认 `sqlite+aiosqlite:///:memory:`）；`APP_JWT_SECRET` 为固定测试串；`APP_WECHAT_MINI_PROGRAM_APP_ID` / `..._APP_SECRET` 为逗号分隔的双小程序凭据 |
| 隔离方式 | **无事务回滚式隔离**：每用例 `Base.metadata.create_all` → 插入四个账号 → 跑用例 → `Base.metadata.drop_all`（`engine.begin()` + `run_sync`） |
| 种子账号 | `admin`（SUPER_ADMIN）、`warehouse`（WAREHOUSE_ADMIN）、`purchase`（PURCHASE_ADMIN）、`readonly`（READ_ONLY），密码均 `123456`，`enabled=True` |
| 路径重定向 | `settings.template_dir` 指向 `server/app/templates`，`settings.upload_dir` 指向 pytest 的 `tmp_path / "uploads"`，避免污染仓库 |
| 事件循环 | 由 `server/pyproject.toml` 的 `asyncio_mode = "auto"`、`asyncio_default_test_loop_scope = "session"`、`asyncio_default_fixture_loop_scope = "session"` 固定为单会话事件循环 |
### 重点：`server/tests/test_init_sql.py`
该文件是「ORM 与数据库初始化脚本一致」的唯一守门人，共 4 个测试函数、115 行，无外部辅助模块，解析逻辑全部内联。

| 项 | 实现 |
| --- | --- |
| 模型来源 | `import app.models`（导入副作用注册全部模型）+ `from app.core.database import Base`，比对 `Base.metadata.sorted_tables`，**不使用 `__table_args__`** |
| 目标文件 | `INIT_SQL = Path(__file__).parents[2] / "docs" / "references" / "database" / "init.sql"` |
| SQL 解析 | 模块级正则 `CREATE_TABLE = re.compile(r"CREATE TABLE IF NOT EXISTS \`([^\`]+)\` \((.*?)\) ENGINE=", re.DOTALL)`，`_table_blocks()` 返回 `{表名: 建表块文本}`；列定义由 `_column_definition(block, column)` 用逐列正则 `^  \`列名\` (.*?)(?=,\n  (?:\`\|CONSTRAINT\|INDEX)\|\Z)` 截取（正则 + 简易 DDL 文本解析，不是完整 SQL 解析器） |
| ORM 侧 DDL | `str(CreateTable(table).compile(dialect=mysql.dialect()))`（`sqlalchemy.schema.CreateTable` + `sqlalchemy.dialects.mysql`），用于提取 ORM 的约束名 |
逐表逐列比对项（`test_init_sql_matches_current_model_schema`）：

| 比对项 | SQL 侧取法 | ORM 侧取法 |
| --- | --- | --- |
| 表名集合 | `_table_blocks()` 的键 | `Base.metadata.sorted_tables` 的 `table.name` |
| 列名集合 | 正则 `^  \`([^\`]+)\``（`re.MULTILINE`） | `table.columns.keys()` |
| 约束名集合 | 正则 `CONSTRAINT \`([^\`]+)\`` | 编译后 DDL 中 `CONSTRAINT \`?([^\`\s]+)\`?` |
| 索引名集合 | 正则 `^  INDEX \`([^\`]+)\`` | `{index.name for index in table.indexes}` |
| NULL 约束 | `_column_definition(...)` 中是否含 `NOT NULL` | `not column.nullable` |
| ENUM 取值 | 列定义中 `ENUM\((.*?)\)` 内的 `'([^']+)'` 列表 | `list(column.type.enums)`（`isinstance(column.type, Enum)` 时，顺序敏感） |
| 外键 | 正则 `FOREIGN KEY \(\`列\`\) REFERENCES \`表\` \(\`列\`\)(?: ON DELETE ([A-Z]+(?: [A-Z]+)?))?` | `(fk.parent.name, fk.column.table.name, fk.column.name, (fk.ondelete or "").upper() or None)` 四元组集合 |
**未直接比对**：列类型映射（VARCHAR/INT 等逐字比对）与列默认值未做断言，默认值与类型只在「约束名集合 / 列名 / NULL」层面被间接约束。
| 断言 | 失败信息 |
| --- | --- |
| 缺少列定义（`_column_definition`） | `init.sql 中缺少列定义：{column}` |
| 列不一致 | `{table_name} 的列与 ORM 不一致` |
| 约束不一致 | `{table_name} 的约束与 ORM 不一致` |
| 索引不一致 | `{table_name} 的索引与 ORM 不一致` |
| 外键不一致 | `{table_name} 的外键与 ORM 不一致` |
| NULL 约束不一致 | `{table_name}.{column.name} 的 NULL 约束与 ORM 不一致` |
| ENUM 取值不一致 | `{table_name}.{column.name} 的 ENUM 值与 ORM 不一致` |
该文件没有显式白名单或列名规范化映射，「例外」以独立断言表达：

| 断言 | 内容 |
| --- | --- |
| 种子账号 | 只允许 `('admin', '$argon2id$` 形式与 `@{username}_api_token` 同时出现，要求脚本含 `RANDOM_BYTES` |
| 旧表不得复活 | `"measurement_unit" not in sql` |
| 文件标识符 | `file_object.id`、`stock_material_image.file_id`、`purchase_material_image.file_id` 三处必须以 `VARCHAR(36) NOT NULL` 开头 |

| 函数名（`server/tests/test_init_sql.py`） | 断言目标 |
| --- | --- |
| `test_init_sql_matches_current_model_schema` | 表名集合 + 每表列名/约束名/索引名/NULL/ENUM/外键与 ORM 完全一致 |
| `test_init_sql_seeds_required_accounts` | 四个初始账号以 argon2id 口令与 `@<用户名>_api_token` 写入，含 `RANDOM_BYTES`，且不再含 `measurement_unit` |
| `test_file_identifiers_are_uuid_strings` | 文件相关三列在 `init.sql` 中为 `VARCHAR(36) NOT NULL` |
| `test_excel_templates_are_json_specs_not_binary_workbooks` | `server/app/templates/` 目录精确等于 `material-code-application.json`、`purchase-application.json`、`purchase-approval.json` 三个文件（不得存在二进制 xlsx 模板） |

</TabsContent>

<TabsContent id="t1">

### 单元与契约测试清单（`unit/` 3 个 + 根目录 14 个）
| 文件 | 覆盖主题与用例（函数名 / 验证要点） |
| --- | --- |
| `server/tests/unit/test_fernet.py`（单元） | Fernet 加解密往返与从 JWT 密钥派生回退：`test_fernet_roundtrip_within_session`（密文不等于明文且可解回原值）、`test_fernet_falls_back_to_jwt_derived_key` |
| `server/tests/unit/test_material_service.py`（单元） | 计划编号冲突时重试生成：`test_create_purchase_material_retries_plan_no_on_collision` |
| `server/tests/unit/test_mcp_server.py`（单元） | MCP 工具目录只暴露管理类接口、路径参数精确匹配、不进入业务 OpenAPI：`test_operation_catalog_exposes_management_apis_only`、`test_operation_list_and_describe_use_openapi_contract`、`test_build_path_requires_exact_parameters`、`test_mcp_mount_is_not_part_of_business_openapi` |
| `server/tests/test_cors.py`（根·集成） | CORS 预检与响应头：Referer 优先、Origin 回退、白名单拒绝、404 也带头——`test_cors_preflight_prefers_referer`、`test_cors_preflight_falls_back_to_origin`、`test_cors_headers_are_added_to_not_found_response`、`test_cors_ignores_malformed_referer_and_uses_origin`、`test_response_without_referer_or_origin_has_no_cors_headers`、`test_cors_whitelist_rejects_unknown_origin` |
| `server/tests/test_database_errors.py`（根·单元） | SQLAlchemy 异常到 `AppError` 的映射（超时/连接/未知列/编程错误）：`test_programming_error_is_not_reported_as_database_unavailable`、`test_database_timeout_is_reported_as_unavailable`、`test_mysql_unknown_column_operational_error_is_reported_as_query_error`、`test_mysql_connection_operational_error_is_reported_as_unavailable`、`test_other_sqlalchemy_errors_are_internal_database_errors` |
| `server/tests/test_db_timing.py`（根·集成） | `X-DB-Time` / `X-DB-Queries` 的采集范围与并发隔离：`test_response_reports_server_side_duration_breakdown`、`test_business_request_reports_database_queries`、`test_concurrent_requests_report_their_own_database_work`、`test_database_timing_only_collects_inside_request_scope` |
| `server/tests/test_error_code_docs.py`（根·契约） | `docs/websites/pages/api-error-codes.md` 与代码中 `AppError("CODE")` 双向一致：`test_every_runtime_code_is_documented`、`test_documented_status_codes_match_code` |
| `server/tests/test_excel_export_service.py`（根·单元） | 模板目录、JSON 模板加载与采购申请/结果导出渲染：`test_default_template_directory_is_inside_backend_code`、`test_load_spec_reads_configured_runtime_template`、`test_missing_template_raises_readable_service_error`、`test_invalid_template_raises_readable_business_error`、`test_purchase_approval_template_renders_fifteen_columns`（15 列）、`test_result_excel_uses_visible_columns_and_readable_layout`、`test_result_excel_embeds_images_and_skips_missing_files`、`test_result_excel_handles_empty_image_list` |
| `server/tests/test_file_service.py`（根·单元） | 写库失败时删除已落盘文件：`test_upload_removes_disk_file_when_database_commit_fails` |
| `server/tests/test_identifiers.py`（根·单元） | UUIDv7 合法、唯一、单调有序：`test_uuid7_strings_are_valid_and_monotonically_ordered` |
| `server/tests/test_init_sql.py`（根·契约） | `init.sql` 与 ORM 逐表逐列一致 + 种子账号 + 模板清单：见「重点：`server/tests/test_init_sql.py`」专节（4 个用例） |
| `server/tests/test_logging.py`（根·单元） | 月度日志轮转、备份数、健康检查过滤、控制台彩色开关：`test_daily_log_rotation_uses_month_directory`、`test_monthly_archives_honor_backup_count`、`test_health_check_filter_only_suppresses_health_requests`、`test_console_colors_are_enabled_by_default`、`test_console_colors_can_be_disabled` |
| `server/tests/test_middleware.py`（根·集成） | 真实 IP 头优先级与 `X-Response-Time`：`test_real_ip_header_priority`、`test_real_ip_uses_first_forwarded_address`、`test_real_ip_skips_invalid_headers_and_handles_missing_client`、`test_real_ip_keeps_original_client_without_valid_proxy_header`、`test_request_context_adds_response_time_header` |
| `server/tests/test_mini_program_service.py`（根·单元） | `access_token` 按 app_id 缓存隔离、按 app_id 选凭据、物料编码生成：`test_generate_unlimited_material_code_uses_compact_uuid_scene`、`test_access_token_cache_is_isolated_by_app_id`、`test_exchange_wechat_code_selects_credentials_by_app_id` |
| `server/tests/test_purchase_plan_cleanup.py`（根·单元+集成） | 清理任务（幂等、批处理、快照跳过）与凌晨 2 点调度时刻：`test_cleanup_removes_moved_plans_and_keeps_record`、`test_cleanup_is_idempotent`、`test_cleanup_skips_unmigrated_snapshot`、`test_cleanup_batches_over_limit`、`test_seconds_until_two_am`、`test_shanghai_constant` |
| `server/tests/test_schemas.py`（根·单元） | 图片去重、时区必填、状态 Literal 校验：`test_request_models_accept_valid_validator_values`、`test_request_models_reject_duplicate_images`、`test_operation_update_rejects_duplicate_materials`、`test_operation_update_requires_timezone`、`test_purchase_material_rejects_unknown_status` |
| `server/tests/test_search.py`（根·单元） | `split_or_search_terms` 对 `\|`／`｜`／空项归一化：`test_split_or_search_terms_normalizes_delimiters_and_empty_items` |

### 集成测试清单
集成测试通过 `httpx.ASGITransport` 直接打真实路由。

| 文件 | 覆盖接口路径 | 关键场景 |
| --- | --- | --- |
| `server/tests/integration/test_ai_search.py` | `/api/v1/ai-search/settings`、`/status`、`/test`、`/expand`、`/api/v1/system-settings/image-acceleration` | 超管配置密钥返回明文但库内密文；扩展应用到 `/purchase-materials`、`/purchase-records`；超时返回特定 400；GLM 关闭 thinking 并要求 JSON 输出；配置从事件日志迁移到系统设置表 |
| `server/tests/integration/test_auth.py` | `/api/v1/auth/login`、`/refresh`、`/me`、`/api/v1/users`、`/users/{id}/api-token/regenerate` | 刷新换发新令牌对；access 不能当 refresh 用；永久 API Token 支持多请求头认证；非法令牌 401 |
| `server/tests/integration/test_excel_export_job.py` | `/api/v1/excel-export-jobs/{id}`、`/files/{uuid}`、`/api/v1/purchase-materials/export-results`、`/purchase-records/export-results`、`/api/v1/files/images` | 中断任务标记失败并删文件；只清终态旧行；成功保留文件、失败删半成品；未就绪/过期下载被拒；任务行缺失仍可下载；超上限转为任务失败 |
| `server/tests/integration/test_files.py` | `/api/v1/files/images`、`/files/images/{id}`、`/files/images/orphans` | 上传重编码为 PNG；申购行图片不被判为孤图；上传需鉴权；超管上报并清理孤图 |
| `server/tests/integration/test_health.py` | `/health` | 探活检查数据库；日志使用代理真实 IP；数据库故障被上报 |
| `server/tests/integration/test_huaxing_inventory.py` | `/api/v1/huaxing-inventory`、`/filter-options`、`/import`、`/import-jobs/{id}` | 导入替换旧数据、完全重复行去重、表头别名识别、缺表头任务失败、权限校验、拒绝不支持的扩展名、csv/xls、型号规格与跨字段筛选 |
| `server/tests/integration/test_import_job.py` | 以 `/api/v1/material-code-library/import` 为入口 + `/import-jobs/{id}` | 中断任务标记失败并删文件；只删旧终态行；已有活跃任务时拒绝新导入；成功/业务错误/意外错误三种落库结果 |
| `server/tests/integration/test_inventory.py` | `/api/v1/inventory/inbounds`、`/outbounds`、`/operations/{id}`、`/operations/{id}/reverse`、`/balances`、`/balances/{material_id}`、`/low-stock`、`/low-stock/{id}/create-replenishment-draft`、`/replenishment-defaults`、`/api/v1/stock-materials`、`/purchase-materials` | 入库原因可空、出库原因必填；幂等键、负库存与权限；编辑历史流水重放快照后续流水重算；并发出库允许负库存且无丢失更新；低库存建议量取近期消耗；删除物资需无流水；部分冲销多次与超量被拒；全量消耗后反向入库标记已冲销 |
| `server/tests/integration/test_lite_inventory.py` | `/api/v1/secondary-warehouse`、`/import`、`/import-jobs/{id}`、`/last-import` | 精简模式导入替换与去重、缺表头/缺名称/非法数量导致任务失败、权限校验、拒绝不支持的扩展名、csv 与 xls、最近导入时间、名称 OR 与跨字段 AND 筛选 |
| `server/tests/integration/test_material_code_library.py` | `/api/v1/material-code-library`、`/exists`、`/import`、`/import-jobs/{id}` | 导入替换后可查询；非法导入不删除既有编码；导入需申购权限；拒绝不支持的扩展名；损坏文件任务失败；大文件成功；编码存在性软校验；csv/xls 导入 |
| `server/tests/integration/test_mcp.py` | `/api/v1/mcp/`、`/api/v1/auth/login`、`/api/v1/users` | 流式 HTTP 端点需 API Token；带用户令牌列出安全工具集 |
| `server/tests/integration/test_memos.py` | `/api/v1/memos`、`/memos/{id}` | CRUD 全生命周期；未鉴权被拒；按用户隔离；更新版本冲突；未知 id；内容长度校验 |
| `server/tests/integration/test_mini_program.py` | `/api/v1/mini-program/auth/wx-login`、`/profile`、`/inventory`、`/materials/{uuid}`、`/outbound`、`/outbound-reasons`、`/operations`、`/purchase-plans`、`/material-codes`、`/huaxing-inventory`、`/api/v1/mini-program-users`、`/{id}/merge`、`/api/v1/system-settings/mini-program-features` | 注册-扫码-出库全链路；跨小程序账号合并；库存搜索分页与详情；申购计划只展示有图正常项与下一项、排除已转记录；记录搜索分页；编码与华星库存查询分页；高级开关关闭新绑定与用户状态；小程序用户接口需超管 |
| `server/tests/integration/test_procurement.py` | `/api/v1/purchase-materials`（含 `?coded=false`、`?moved=false`）、`/{id}`、`/{id}/move-to-record`、`/batch`、`/batch-move-to-record`、`/filter-options`、`/export-purchase-application`、`/export-purchase-approval`、`/export-results`、`/export-uncoded`、`/api/v1/purchase-records`、`/{line_id}`、`/batch`、`/export-results`、`/api/v1/excel-export-jobs/files/{uuid}` | 状态筛选与批量归档；空需求人占位符 `\`；子项号精确/空筛选；按列任意排序与白名单拒绝未知列；OR 搜索与 AND 筛选组合；编号按日期序列、记录保留计划日期；无编码计划必须先补码；多条计划转同一申购单；合同签订日期为行级且可批量改；批量更新原子性；分组申购行跟踪字段；入库不改变申购记录；导出模板字段必填校验与按筛选/可见列导出；结果导出内嵌原图；缺模板返回可读 400 |
| `server/tests/integration/test_purchase_plan_template.py` | `/api/v1/purchase-plan-templates`、`/api/v1/files/images` | 模板 CRUD；权限；版本冲突 409；按模板生成完整计划且保留模板；同模板生成两次得到不同计划 |
| `server/tests/integration/test_purchase_record_sync.py` | `/api/v1/purchase-record-sync/targets`、`/trace/{trace_no}`、`/order-targets`、`/orders/{purchase_order_no}/apply`、`/api/v1/purchase-records/{line_id}` | 只填空字段并推进状态；最小申购单号过滤；非法字段被拒；游标分页；写入需申购权限；追溯号不存在；按申购单整单写入与未知追溯号计数；合同签订日期行级且只填空 |
| `server/tests/integration/test_secondary_warehouse_mode.py` | `/api/v1/system-settings/mini-program-features`、`/api/v1/dashboard/summary`、`/api/v1/inventory/inbounds`、`/api/v1/stock-materials`、`/api/v1/mini-program/lite-inventory`、`/outbound`、`/profile`、`/api/v1/secondary-warehouse/import` | features 端点暴露二级库模式；设置往返持久化；精简模式阻断小程序与后台完整出入库写入；小程序读取精简库存；工作台统计计入精简库存 |
| `server/tests/integration/test_share.py` | `/api/v1/shares`、`/shares/{token}` | 计划/记录分享与匿名查看；永久分享无过期；过期与未知 token 被拒；创建需鉴权且缺条目被拒；撤回权限；只清过期行；按列过滤公开视图与身份；默认列；非法列被拒；改权限/列/有效期；列表按归属隔离 |
| `server/tests/integration/test_users.py` | `/api/v1/users`、`/{id}`、`/{id}/api-token/regenerate`、`/api/v1/auth/login`、`/me`、`/api/v1/inventory/inbounds` | 改名不改隐藏 id；无关联用户可删；API Token 唯一可重生成；操作不引用认证用户；每次读取都回显令牌；历史仅哈希令牌在用后回填并回显 |
| `server/tests/integration/test_version.py` | `/api/v1/version` | 公开返回应用名/版本/构建信息，无需鉴权 |
| `server/tests/integration/test_webhooks.py` | `/api/v1/system-settings/webhooks`、`/{platform}`、`/{platform}/test`、`/api/v1/mini-program/profile`、`/api/v1/inventory/inbounds`、`/outbounds`、`/operations/{id}` | 设置权限与校验；通知消息格式（同步测试）；勾选事件只入队一次并投递到两个平台 |

</TabsContent>

<TabsContent id="t2">

### 前端测试
| 项 | 配置 |
| --- | --- |
| 运行器 | Vitest 3（`web/package.json` 的 `test` / `test:watch`） |
| 环境 | jsdom，全局 API 由 `web/tsconfig.app.json` 的 `types: ["vitest/globals"]` 提供 |
| 配置文件 | `web/vitest.config.ts`（`vite.config.ts` 内没有 vitest 段）：`plugins: [vue()]`、`alias['@'] → ./src`、`define.__BUILD_TIME__`、`test.environment = 'jsdom'`、`test.setupFiles = ['./src/test/setup.ts']` |
| setup | `web/src/test/setup.ts` 仅一条：`afterEach(() => vi.restoreAllMocks())` |
| 用例数 | 31 个 `*.spec.ts` |

| 文件 | 被测对象 | 关键用例 |
| --- | --- | --- |
| `web/src/components/ColumnVisibilityPicker.spec.ts` | 列可见性选择器 | 恢复合法列并忽略已删列、后续选择持久化、存储非法时回落默认 |
| `web/src/components/ExportButton.spec.ts` | 导出按钮 | 单个选项与多选项均渲染为下拉、单选项禁用时不直接触发 |
| `web/src/components/FilterExpandButton.spec.ts` | 筛选展开按钮 | 收起文案与 `aria-expanded`、点击发出切换值、箭头旋转 |
| `web/src/components/ImageUploader.spec.ts` | 图片上传组件 | 剪贴板粘贴上传、无图片时告警 |
| `web/src/components/LoadingMask.spec.ts` | 加载遮罩 | 隐藏时不渲染、显示时含指示器与文案、无文案不产生文本节点、关闭后复原 |
| `web/src/components/MaterialCodeSelector.spec.ts` | 物料编码选择器 | 用计划值作默认并支持重置与清空 |
| `web/src/components/OperationLinesEditor.spec.ts` | 流水明细编辑器 | 选择器连续事件时保持已选物资不丢 |
| `web/src/components/SortableHeader.spec.ts` | 可排序表头 | 三种排序选项、非当前列不激活、升降序箭头、选中后发出顺序 |
| `web/src/composables/useExportJob.spec.ts` | 导出任务 composable | 轮询至成功、失败带任务错误、启动错误（如 `ARCHIVED_PURCHASE_PLAN_FORBIDDEN`）向上抛 |
| `web/src/composables/useImplicitAiSearch.spec.ts` | 隐式 AI 搜索 | 使用扩展词但不改可见输入框 |
| `web/src/composables/useImportConfirm.spec.ts` | 导入确认弹窗 | 文案创建且禁遮罩/Esc 关闭、确认后按钮 loading 与禁用、失败不产生未处理拒绝 |
| `web/src/composables/useImportJob.spec.ts` | 导入任务 composable | 轮询至成功、失败透传错误、启动错误（如 `IMPORT_IN_PROGRESS`）、进行中不重复提交 |
| `web/src/composables/usePagedTable.spec.ts` | 分页表格 composable | 首屏加载、查询重置页码、翻页与页大小、重置筛选、空页回滚（含第 1 页不死循环）、分页关闭时固定页大小、无 `onError` 静默吞错、URL 同步、筛选类型正确 |
| `web/src/config/env.spec.ts` | 构建环境配置 | 去除末尾斜杠、绝对地址拼接、后端地址补 API 路径、图床补图片接口路径、生成带令牌的 MCP 绝对地址 |
| `web/src/constants/shareColumns.spec.ts` | 分享列常量 | 计划/记录列键与后端 Literal 一致、按类型返回列定义、默认列 = 全部列去掉「状态」 |
| `web/src/layouts/appearanceMenu.spec.ts` | 用户菜单外观分组 | 「外观」分组含自动/浅色/深色三档且各带图标、当前档用对勾、档位 key 判定只认三档、按钮说明同时给出档位与明暗 |
| `web/src/stores/settings.spec.ts` | settings store（二级库模式） | 未加载默认完整模式、load 后精简/完整、请求失败回落完整模式、只拉取一次 |
| `web/src/stores/theme.spec.ts` | theme store（界面外观） | 默认 auto 跟随系统、启动即写 html 属性、切深色落本地并同步 html/color-scheme、切回 auto、刷新读回已保存档位、非法档位回落 auto |
| `web/src/utils/themeMode.spec.ts` | 外观偏好工具 | 缺省 auto、三档识别、非法值回落、写入归一化、存储不可用静默降级 |
| `web/src/types/navigation.spec.ts` | 四角色权限矩阵 | 超管全写、仓库仅仓库域、申购仅申购域、只读无写权限 |
| `web/src/utils/decimal.spec.ts` | Decimal 工具 | 不经浮点比较大数与 1 位小数、按位校验正数量、出库后库存精确计算 |
| `web/src/utils/download.spec.ts` | 下载工具 | RFC 5987 `filename*`、普通引号文件名、空头返回 null、优先服务端文件名、缺头回退、锚点点击下载、地址拼接 |
| `web/src/utils/image.spec.ts` | 图片限制与地址 | 只收 JPG/PNG/WebP、单图 10 MB、每物资 9 张、按文件 ID 拼地址、使用运行时图床地址 |
| `web/src/utils/memoDrafts.spec.ts` | 备忘录草稿 | 按用户+备忘录生成主键不串号、仅区别于服务端才算未保存、IndexedDB 不可用时静默降级 |
| `web/src/utils/purchase.spec.ts` | 申购工具 | 按上海时区生成默认单号、记住最后实际需求人、不用空值覆盖已记住的值 |
| `web/src/utils/routeQuery.spec.ts` | 路由 query 工具 | 标量与数组读取、仅接受正整数分页、去空值并 trim |
| `web/src/utils/settings.spec.ts` | 二级库库存功能选项 | 完整模式提供禁用/仅查询/可读写，精简模式不含可读写 |
| `web/src/utils/tableRowNavigation.spec.ts` | 表格行点击保护 | 普通单击进详情、交互元素/拖动/选中文本时忽略跳转、其他区域选区不影响 |
| `web/src/utils/time.spec.ts` | 日期工具 | 空日期返回 null 不回落今天、按东八区解析、时间戳与字符串双向一致、空日期占位符 |
| `web/src/views/MemosView.spec.ts` | 备忘录视图 | 编辑不自动保存、在途请求不重复提交、切换后保留未保存标记、新建/删除均需弹窗确认 |
### CI 工作流
`.github/workflows/` 下共 8 个 `.yml`：

| 文件 | 名称 | 触发条件（`on:`） | 主要职责 | 依赖的 secrets |
| --- | --- | --- | --- | --- |
| `api-test.yml` | 基础接口测试 | push 所有分支 / PR，`paths`: `server/**`、本文件 | `ubuntu-latest` 上按 `cache-dependency-path: server/pyproject.toml` 装 Python 3.12，`pip install -e ".[dev]"` 后 `pytest`（无需 MySQL） | 无 |
| `contract-check.yml` | 契约一致性校验 | push 所有分支 / PR，`paths`: `server/**`、`docs/**`、`web/**`、本文件 | `python scripts/export_openapi.py` 后 `git diff --exit-code docs/openapi.yaml`；`npx openapi-typescript` 重生成 `generated.raw.ts` 后校验无 diff；最后 `npx vue-tsc -b` | 无 |
| `sync-contract.yml` | 契约文件自动同步 | PR，`paths`: `server/**`、`docs/**`、`web/**`、本文件 | 检出 PR 分支 → 重导 openapi → `npm run generate:api` → 有变更则 `chore: 自动同步 openapi 与前端类型` 提交并 push → `npx vue-tsc -b` | 无显式 secret（依赖 `GITHUB_TOKEN`，`permissions: contents: write`） |
| `e2e-simulation.yml` | 模拟用户操作测试 | push `main` / `workflow_dispatch`，`paths`: `server/**`、`docs/references/database/**`、本文件 | 起 MySQL 8.0 服务 → `mysql ... < docs/references/database/init.sql` → 后台 `uvicorn` 起后端并轮询 `/health` → `python scripts/e2e_simulation.py` | 无（数据库口令与 `APP_JWT_SECRET`、微信凭据均为脚本内测试值） |
| `build-images.yml` | 构建 Docker 镜像 | push 所有分支 + `v*` 标签 / PR / `workflow_dispatch`，`paths`: `server/**`、`web/**`、本文件 | `dorny/paths-filter` 检测改动组件 → matrix 构建 `server`/`web` 镜像 → 仅 main、`v*` 标签或手动触发时推送 ghcr.io | `secrets.GITHUB_TOKEN`（登录 ghcr.io） |
| `apifox.yml` | 同步接口文档到 Apifox | push `main` / `workflow_dispatch`，`paths`: `docs/openapi.yaml`、`server/app/**`、`server/scripts/export_openapi.py`、本文件 | 校验凭据 → 以 `OVERWRITE_EXISTING` 策略 POST 到 Apifox `import-openapi`（契约覆盖接口与数据模型，示例随契约更新） | `secrets.APIFOX_ACCESS_TOKEN`；仓库变量 `vars.APIFOX_PROJECT_ID` |
| `upload-miniprogram.yml` | 自动上传微信小程序代码 | push `main` / `workflow_dispatch`，`paths`: `miniprogram/**`、本文件 | 检查并落盘两个上传私钥 → `npm ci` → `npm run check` → 生成版本号/描述与 `config/build-info.js` → 连续两次 `npm run upload`（第二个小程序覆盖 appid/私钥）→ 清理私钥 | `WECHAT_MINIPROGRAM_APPID`、`WECHAT_MINIPROGRAM_PRIVATE_KEY`、`WECHAT_MINIPROGRAM_APPID_2`、`WECHAT_MINIPROGRAM_PRIVATE_KEY_2` |
| `website.yml` | 构建并发布项目站点 | push `main` / `workflow_dispatch`，`paths`: `docs/**`、本文件 | `npm ci` → `npx vitepress build --outDir $SITE_OUT_DIR` → 在 `.site-dist` 重新 `git init -b gh-pages` 并 `git push --force origin gh-pages` | `secrets.GITHUB_TOKEN` |

</TabsContent>

<TabsContent id="t3">

### 本地验证命令
| 目录 | 命令 | 作用 |
| --- | --- | --- |
| `server/` | `pip install -e ".[dev]"` | 安装后端与测试依赖（含 pytest / pytest-asyncio / aiosqlite） |
| `server/` | `pytest` | 跑全部后端测试（`testpaths = ["tests"]`、`asyncio_mode = "auto"`，默认内存 SQLite） |
| `server/` | `TEST_DATABASE_URL=... pytest` | 用真实 MySQL 跑同一套件（CI 未使用，供本地核对 DDL 差异） |
| `server/` | `ruff check .` / `ruff format .` | 静态检查与格式化；`server/pyproject.toml` 已配置 `target-version = "py312"`、`line-length = 100`、`select = ["E","F","I","UP","B","ASYNC"]`。**8 条 CI 流水线均未调用 ruff** |
| `server/` | `mypy` | 严格类型检查（`strict = true`，`plugins = ["pydantic.mypy"]`）。**8 条 CI 流水线均未调用 mypy** |
| `server/` | `python scripts/export_openapi.py` | 重新导出 `docs/openapi.yaml`，对应 contract-check / sync-contract |
| `server/` | `python scripts/e2e_simulation.py` | 需真实 MySQL + 已启动后端 + `E2E_BASE_URL`，对应 e2e-simulation |
| `web/` | `npm ci` | 按 lockfile 安装前端依赖 |
| `web/` | `npx vue-tsc -b` | TypeScript 类型检查（`npm run build` 第一段，CI 也在跑） |
| `web/` | `npm run lint` | `eslint . --max-warnings 0`（**当前无对应 CI 步骤，需本地执行**） |
| `web/` | `npm run test` | Vitest 单测（`vitest run`） |
| `web/` | `npm run build` | `vue-tsc -b && vite build`，提交前最终校验 |
| `web/` | `npm run generate:api` | `openapi-typescript ../docs/openapi.yaml -o src/api/generated.raw.ts`，改契约后必须重跑 |
| `docs/websites/` | `npm ci && npm run build` | 构建 VitePress 站点（CI 用 `npx vitepress build --outDir <外部目录>`） |
| `miniprogram/` | `npm ci && npm run check` | 小程序依赖安装与代码检查（CI 上传前执行） |
### 手工回归要点
完整用例（AUTH / DASH / MAT / INV / PUR / EXP / REC / SET / SHARE 九组，含 P0/P1/P2 优先级与通过准则）见 [人工功能测试方案](/manual-functional-test-plan)。每次修复或发布至少执行其中 P0 链路：

| # | 场景（关联用例号） |
| --- | --- |
| 1 | 仓库管理员新建二级库物资、设置库存预警并完成初始入库（MAT-01、MAT-07、INV-01） |
| 2 | 出库至低库存，确认工作台与低库存列表出现预警，并发起补库计划（INV-03、DASH-01、PUR-01） |
| 3 | 申购管理员补全物料编码，导出采购申请表并转为申购记录（EXP-03、REC-01） |
| 4 | 仓库管理员分两次到货，确认库存、流水、「部分到货」与「已完成」状态正确（REC-06、REC-07） |
| 5 | 修改第一次到货流水数量后再冲销，确认库存与申购进度按流水重算（INV-09、INV-10、REC-10） |
| 6 | 分别用四种角色复查菜单、按钮与直接地址访问权限（AUTH-01、AUTH-04、AUTH-05） |
| 7 | 历史流水编辑后按时间顺序重算后续流水（如「入库 10、出库 3」改为「入库 5」后库存为 2，INV-08） |
| 8 | 负库存与超额到货被视为合法行为，不判缺陷（INV-04、REC-08） |
| 9 | 流水字段校验：出库必填领用人与业务原因，数量不得为空/0/负数/超 1 位小数；入库原因可空（INV-05） |
| 10 | 已归档申购计划只有超级管理员可查询，其他角色直接调用接口返回 403（PUR-02A） |
| 11 | 分享链接「设置列」至少保留 1 列，改列后未选列数据不下发；非创建者改列/撤回返回 403（SHARE-02、SHARE-04、SHARE-06） |
| 12 | 停用当前登录用户后其会话请求被拒，且停用账号无法重新登录（SET-04） |
相关页面：[后端接口约定](/api-error-conventions)（与后端测试、`test_error_code_docs.py` 中的错误码文档同源）。

</TabsContent>

</Tabs>
