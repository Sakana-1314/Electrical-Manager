# 接口约定

对外 API 的错误响应结构与状态码使用规则；全部错误码见 [错误码总表](/api-error-codes)。

## 核心约定：禁止 HTTP 404

**对外 API 不使用 HTTP 404**：资源不存在与路径错误必须区分，前者是正常业务分支，后者是调用方路径写错。

| 场景 | HTTP | code | 实现 |
| --- | --- | --- | --- |
| 按 ID / UUID 查询的资源不存在（物资、用户、流水、图片等） | 400 | `NOT_FOUND` | `apperr.NotFound(resource)` / `apperr.New("NOT_FOUND", …)`；客户端按响应体 `code` 判断，不依赖状态码 |
| 请求打到不存在的 API 路径 | 400 | `ROUTE_NOT_FOUND` | `server/internal/app` 的 Gin `NoRoute` 处理器直接返回 400，message 为「接口路径不存在」，框架默认的 404 不会出现 |
| 路径存在但方法不匹配 | 405 | `HTTP_ERROR` | Gin `NoMethod` 处理器返回，message 为 `Method Not Allowed` |
| 前端路由级「页面不存在」 | — | — | `web/src/views/NotFoundView.vue`，浏览器端 UI 展示，不涉及 HTTP 状态码 |
| 上游服务的 404 判断 | — | — | `service/aisearch` 判断上游 AI 接口 404 后转换为 `AI_ENDPOINT_NOT_FOUND`，属消费外部服务的逻辑 |

```json
{ "code": "NOT_FOUND", "message": "二级库物资不存在", "details": {}, "request_id": "…" }
```

## 错误响应体结构

| 字段 | 说明 |
| --- | --- |
| `code` | 业务错误码，全局唯一（完整清单见 [错误码总表](/api-error-codes)） |
| `message` | 人类可读的中文提示 |
| `details` | 可选的结构化详情（校验错误、版本号、状态机上下文等） |
| `request_id` | 请求追踪 ID，与应用日志关联 |

```json
{
  "code": "VERSION_CONFLICT",
  "message": "数据已被其他用户修改，请刷新后重试",
  "details": {"expected": 3, "actual": 5},
  "request_id": "…"
}
```

### 422 校验错误体

请求参数（路径 / 查询 / 请求头 / 请求体）校验失败统一返回 422 `VALIDATION_ERROR`，message 为「请求参数校验失败」。
同一请求里的全部字段错误合并成一次响应，放在 `details.errors` 数组里，每项是与 Pydantic 兼容的结构：

| 字段 | 说明 |
| --- | --- |
| `type` | 错误类型，如 `missing`、`int_parsing`、`string_too_long`、`greater_than_equal`、`literal_error`、`value_error` |
| `loc` | 出错位置，首元素是参数来源（`path` / `query` / `header` / `body`），其后是字段名或数组下标 |
| `msg` | 英文错误说明 |
| `input` | 原始输入值 |
| `ctx` | 可选，校验规则的上下文（如长度上限 `max_length`） |

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数校验失败",
  "details": {
    "errors": [
      {"type": "greater_than_equal", "loc": ["query", "page"], "msg": "Input should be greater than or equal to 1", "input": "0", "ctx": {"ge": 1}}
    ]
  },
  "request_id": "…"
}
```

## 状态码使用总表

| HTTP 状态码 | 用途 | 典型 code |
| --- | --- | --- |
| 200 / 201 / 204 | 成功 | 创建 201、无内容 204 |
| 400 | 请求无法满足 | 业务校验失败、`NOT_FOUND`、`ROUTE_NOT_FOUND`、多数上游封装错误 |
| 401 | 未认证或凭证无效 | `INVALID_TOKEN`、`UNAUTHORIZED`、`INVALID_CREDENTIALS` |
| 403 | 权限不足 / 账号禁用 | `FORBIDDEN`、`ACCOUNT_DISABLED` |
| 409 | 版本冲突 / 数据约束冲突 / 状态机不允许 | `VERSION_CONFLICT`、`DATA_CONFLICT`、`INVALID_STATUS_TRANSITION` |
| 413 | 请求体过大 | `IMAGE_TOO_LARGE` |
| 422 | 请求参数校验失败 | `VALIDATION_ERROR` |
| 429 | 上游限流透传 | `AI_RATE_LIMITED` |
| 500 | 服务内部错误 | `INTERNAL_SERVER_ERROR`、`DATABASE_ERROR`、`DATABASE_QUERY_ERROR` |
| 502 / 503 | 上游不可用 / 服务不可用 | `AI_UPSTREAM_FAILED`、`AI_INVALID_RESPONSE`、`DATABASE_UNAVAILABLE`、`AI_NOT_CONFIGURED` |

`HTTP_ERROR` 只用于方法不匹配（405），状态码由 `NoMethod` 处理器直接指定，因此不出现在默认状态码映射里。

## 代码实现位置

| 职责 | 位置 |
| --- | --- |
| 错误码 → 默认状态码映射 | `server/internal/apperr`（`defaultStatusByCode`，`apperr.New` 据此推断状态码） |
| 错误到响应体的统一映射 | `server/internal/web`（`WriteError`：业务错误、校验错误、数据库错误与未知错误） |
| 未匹配路径 / 方法 | `server/internal/app`（Gin `NoRoute` → `ROUTE_NOT_FOUND`、`NoMethod` → `HTTP_ERROR`） |
| 校验错误（422） | `server/internal/web`（`Params` 收集参数错误，`ValidationError` → `VALIDATION_ERROR`） |
| 文档一致性测试 | `server` 目录下 `go test ./...` |

## 新增错误码

1. 在 `server/internal/apperr` 的 `defaultStatusByCode` 登记默认状态码（若所有调用点都用 `WithStatus` 显式指定可跳过）。
2. 在 [错误码总表](/api-error-codes) 对应分类补一行：code、HTTP 状态码、含义、来源包。
3. 跑 `cd server && go test ./...`。

## 更新接口的可选字段语义

更新（PATCH）里「整体替换」的字段（`image_ids`、`before_image_ids` / `after_image_ids` 等）必须区分
「没传」和「传空」，否则脚本 / MCP 只改一个字段就会顺手清掉附件：

| 请求里的写法 | 服务端行为 |
| --- | --- |
| 字段省略，或显式传 `null` | **不改动**该字段对应的图片 |
| 显式传 `[]` | 清空图片 |
| 显式传 id 列表 | 按列表整体替换（列表顺序即 `sort_order`） |

实现约定：更新用的请求结构体里这些字段写成指针切片 `*[]string`（省略与 `null` 都解码为 `nil`），服务层只在
`data.ImageIDs != nil` 时才替换；只有「新建」的结构体才用普通切片并预填空列表。
网页端表单每次都显式带上图片列表，所以这条差异只影响脚本 / MCP 调用方。

## 附件（图片）删除的三道闸

图片的业务链路是「上传到全局附件池 → 业务表按 `file_id` 引用」，因此删除要过三道闸，任何一道都不能替代另外两道：

| 闸 | 位置 | 规则 |
| --- | --- | --- |
| ① 引用门禁 | `file.SoftDeleteImage` / `file.SoftDeleteUnreferenced`（`server/internal/service/file`） | 被引用次数 > 0 的附件不允许删除；批量标记只挑「零引用」的行 |
| ② 新人保护期 | `file.SoftDeleteUnreferenced` | 上传未满 `AttachmentUnreferencedMinAgeDays`（7）天、且从未被引用的附件本轮不标记，避免「刚上传、还没挂到业务上」的图片被整批扫走；跳过数量在回执的 `skipped_recent_count` 里回报 |
| ③ 保留期 + 复查 | `file.PurgeDeletedAttachments`（由附件清理后台任务调用） | 软删除后保留 7 个完整自然日，到期后的第一个凌晨 2 点**逐张复查引用**：有新引用就撤销删除，仍无引用才物理清除 |

配套接口：`GET /files/images/attachments/delete-unreferenced/preview` 先返回会被标记的数量与明细
（`total` / `items`）以及被保护期跳过的数量（`protected_count` / `protect_days`），管理员确认后再调
`POST /files/images/attachments/delete-unreferenced`。

图片集合发生变化（新增 / 移除）时会写一条 `IMAGES_CHANGED` 业务事件（`business_event_log`），
`before_data` / `after_data` 里带上变更前后的 `image_ids` 与增删明细：图片从业务记录上被摘掉不会
留下别的痕迹（附件池与磁盘文件都还在，只是不再被引用），所以变更必须自己留痕。

## 项目上下文（`X-Project-Id`）

业务数据按项目隔离：业务接口都必须带 `X-Project-Id: <项目 id>`，服务端据此只读写该项目的
数据（实现见 [数据模型](/dev-data-model) 与 [架构设计](/dev-architecture)）。

| 场景 | 行为 |
| --- | --- |
| 业务接口（库存、申购、隐患、台账、导入导出、分享链接等） | 必须带 `X-Project-Id`；缺失 → 400 `PROJECT_REQUIRED`；项目不存在 / 已停用 → 400 `PROJECT_NOT_FOUND` / `PROJECT_DISABLED` |
| 全局接口（登录、项目列表、管理端用户、系统设置、图片读取） | 不需要项目上下文，带了也不改变行为 |
| 匿名分享页 `GET /shares/{token}` | 不带项目头，服务端按分享记录所属项目读取数据 |
| 匿名导出下载 `GET /excel-export-jobs/files/{file_uuid}` | 不带项目头（uuid 不可猜解；查任务行取下载名时按全项目处理） |
| 小程序 | 可带 `X-Project-Id` 切换项目；不带时落默认项目，旧版本客户端因此不受影响 |
| MCP | 请求头 `X-Project-Id` 优先，其次 MCP 链接上的 `?project_id=`，都缺省时用默认项目；`operation_call` 会把项目头转发给业务接口 |
| 后台任务（导入 / 导出 / 清理） | 按任务行上记录的项目恢复上下文；跨项目的系统级任务显式声明「全项目」上下文 |

## 前端如何消费

- 前端不按 HTTP 状态码分支，统一读响应体 `code`：`web/src/api/client.ts` 的响应拦截器把错误体转成 `AppError`（含 `code` / `message` / `details` / `request_id`）。
- 业务分支判断写 `error.code === 'NOT_FOUND'`，而不是 `status === 404`。
- Apifox Mock 的错误响应示例取自 `server/scripts/openapi_examples.py` 的 `ApiError`（code 与 message 成对出现，不会是「code 与文案打架」的假数据）。
