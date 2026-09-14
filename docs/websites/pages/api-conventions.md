# 接口约定

对外 API 的错误响应结构与状态码使用规则；全部错误码见 [错误码总表](/api-error-codes)。

## 核心约定：禁止 HTTP 404

**对外 API 不使用 HTTP 404**：资源不存在与路径错误必须区分，前者是正常业务分支，后者是调用方路径写错。

| 场景 | HTTP | code | 实现 |
| --- | --- | --- | --- |
| 按 ID / UUID 查询的资源不存在（物资、用户、流水、图片等） | 400 | `NOT_FOUND` | `app.core.errors.not_found()` / `AppError("NOT_FOUND", …)`；客户端按响应体 `code` 判断，不依赖状态码 |
| 请求打到不存在的 API 路径 | 400 | `ROUTE_NOT_FOUND` | `app/main.py` 用 `StarletteHTTPException` 全局处理，把框架默认 404 重映射为 400，message 为「接口路径不存在」 |
| 405、422 等其余 Starlette 异常 | 原状态码 | `HTTP_ERROR` | 原状态码透传，不做重映射 |
| 前端路由级「页面不存在」 | — | — | `web/src/views/NotFoundView.vue`，浏览器端 UI 展示，不涉及 HTTP 状态码 |
| 上游服务的 404 判断 | — | — | `ai_search_service` 判断上游 AI 接口 404 后转换为 `AI_ENDPOINT_NOT_FOUND`，属消费外部服务的逻辑 |

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

`HTTP_ERROR` 是其余 Starlette 异常的透传壳：状态码取框架原值（如 405），message 为框架 `detail`，因此不出现在固定映射里。

## 代码实现位置

| 职责 | 位置 |
| --- | --- |
| 错误码 → 默认状态码映射 | `server/app/core/errors.py`（`_DEFAULT_STATUS_BY_CODE`） |
| 业务错误全局处理 | `server/app/main.py`（`handle_app_error`） |
| 框架级 404 重映射 | `server/app/main.py`（`handle_http_exception`） |
| 校验错误（422） | `server/app/core/exception_handlers.py`（`handle_validation_error`） |
| 文档一致性测试 | `server/tests/test_error_code_docs.py` |

## 新增错误码

1. 在 `server/app/core/errors.py` 的 `_DEFAULT_STATUS_BY_CODE` 登记默认状态码（若所有调用点都显式传 `status_code` 可跳过）。
2. 在 [错误码总表](/api-error-codes) 对应分类补一行：code、HTTP 状态码、含义、来源文件。
3. 跑 `cd server && pytest tests/test_error_code_docs.py`。

## 前端如何消费

- 前端不按 HTTP 状态码分支，统一读响应体 `code`：`web/src/api/client.ts` 的响应拦截器把错误体转成 `AppError`（含 `code` / `message` / `details` / `request_id`）。
- 业务分支判断写 `error.code === 'NOT_FOUND'`，而不是 `status === 404`。
- Apifox Mock 的错误响应示例取自 `server/scripts/openapi_examples.py` 的 `ApiError`（code 与 message 成对出现，不会是「code 与文案打架」的假数据）。
