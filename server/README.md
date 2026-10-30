# HXNI 电气无忧 服务端

## AI Agent / MCP 服务

每个管理端用户都有一个永不过期的 UUID v4 接口令牌。超级管理员可在“管理端用户”页面一键
复制令牌或带令牌的 MCP 地址，也可重新生成令牌；重新生成后旧令牌立即失效。普通业务接口支持
以下两种等价写法，接口权限与令牌所属用户的角色一致：

```text
X-API-Token: <接口令牌>
Authorization: Bearer <接口令牌>
```

MCP 使用 Streamable HTTP，服务地址格式为：

```text
https://<服务域名>/api/v1/mcp/?token=<接口令牌>
```

支持自定义请求头的 MCP 客户端也可以把地址设为不含查询参数的 `/api/v1/mcp/`，并发送
`X-API-Token` 或 `Authorization: Bearer <接口令牌>`。

服务提供四个工具：

- `system_whoami`：确认令牌对应的用户和角色。
- `operations_list`：按标签或关键字查询可用业务操作。
- `operation_describe`：读取某个操作的参数和响应契约。
- `operation_call`：调用已登记的业务接口；文件上传和下载使用 Base64。

MCP 不接受 SQL、数据库表名或任意 URL，只能按 OpenAPI 中登记的 `operationId` 调用管理端业务
接口。每次调用仍经过原有的参数校验、角色权限、乐观锁、事务和审计逻辑；只读用户不能借助 MCP
执行写操作。登录、令牌续期以及需要微信身份的小程序专用接口不会暴露给 MCP。MCP 地址本身包含
永久令牌，应视为密码保存并仅通过 HTTPS 使用。

## 图片一致性与悬空文件

上传接口会在 `file_object` 记录提交成功后才返回 201；提交失败时同步回收已写入的磁盘文件。业务关联表只保存 `file_id`，文件名固定为 `<file_id>.png`，前端按 ID 拼接 `/api/v1/files/images/{file_id}`。

- `GET /api/v1/files/images/orphans?older_than_hours=24`：超级管理员查看未引用记录、无记录磁盘文件及磁盘缺失记录。
- `DELETE /api/v1/files/images/orphans?older_than_hours=24`：删除未引用记录和无记录磁盘文件；默认 24 小时保护期，避免误删刚上传但尚未绑定的图片。

数据库结构以 `../docs/references/database/init.sql` 为准，业务服务不会在运行时修改数据库结构。
仓库只保留 init.sql，不保存增量迁移脚本；已有数据库的结构调整由部署方自行完成（先备份，再参照
init.sql 改库）。

Go 1.26 + Gin + pgx（database/sql + sqlx）+ PostgreSQL 16+，实现细节见 [架构设计](../docs/websites/pages/dev-architecture.md)。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `cmd/server` | 入口：读配置、初始化日志与连接池、执行启动清理、启动后台任务与 HTTP 服务；`server healthcheck` 供容器健康检查 |
| `internal/api/<模块>` | 路由与处理函数（依赖顺序、参数校验、响应） |
| `internal/service/<模块>` | 业务逻辑与 SQL |
| `internal/schema` | 请求 / 响应结构体（与接口契约字段、格式逐一对应） |
| `internal/model` | 表结构体（与 init.sql 一致） |
| `internal/web` | Gin 之上的薄封装：依赖链、参数校验（422 错误体）、提交事务后再写响应、统一错误体 |
| `internal/db` | 请求级事务会话、项目隔离上下文、SQL 方言转换、语句耗时统计、错误分类 |
| `internal/auth` | 管理端 / 小程序鉴权、角色与项目依赖 |
| `internal/openapi` | 内嵌的接口契约副本（`docs/openapi.yaml`），供 `/api/v1/openapi.json`、`/api/docs` 与 MCP 使用 |
| `templates` | Excel 导出模板（运行时目录由 `APP_TEMPLATE_DIR` 指定） |
| `tests` | 黑盒契约测试（pytest 通过 HTTP 调用运行中的服务，直连同一 PostgreSQL 校验落库结果） |

## 接口性能响应头

每个 HTTP 响应的头部都带有服务端耗时分项（均在服务端计量，不含网络传输时间），可用于判断
接口慢在数据库、慢在应用计算，还是慢在网络链路：

| 响应头 | 含义 |
| --- | --- |
| `X-Response-Time` | 服务端处理总耗时（毫秒），从收到请求到生成响应 |
| `X-DB-Time` | 其中数据库语句执行耗时合计（毫秒） |
| `X-Compute-Time` | 其中应用计算耗时（毫秒）= 总耗时 - 数据库耗时，含参数校验、权限、编码、序列化等 |
| `X-DB-Queries` | 本次请求执行的 SQL 条数，便于识别 N+1 |
| `X-Request-ID` | 本次请求标识，与访问日志中的 `request_id` 一致（请求头传入时沿用） |

示例：`X-Response-Time: 63.44` + `X-DB-Time: 0.79` + `X-Compute-Time: 62.65` 表示耗时几乎
全在应用计算（密码哈希等）；`X-DB-Time` 接近 `X-Response-Time` 则说明瓶颈在数据库。

数据库耗时由请求级会话（`internal/db`）在每条语句执行时按请求累计，后台任务（定时清理、Webhook 投递等）的 SQL
不计入任何请求。访问日志同样记录 `db=… query` 与 `compute=…` 分项。跨域部署时这四个耗时头
（含 `X-Response-Time`）都已在 `Access-Control-Expose-Headers` 中暴露。

## 跨域配置

后端通过 CORS 中间件（`internal/middleware`）处理跨域，优先从 `Referer` 解析前端站点，缺失或无效时回退到 `Origin`，并为预检和正常响应补齐 CORS Header。本项目不使用 HTTP 404 状态码：资源不存在返回 `400 + NOT_FOUND`，未匹配路径返回 `400 + ROUTE_NOT_FOUND`，详见 [接口约定](../docs/websites/pages/api-conventions.md)。跨域完整说明见 [部署指南](../docs/websites/pages/guide.md#前后端分离部署)。

## 本地启动

要求 Go 1.26+ 和 PostgreSQL 16+：

```bash
cp ../docs/env/backend.env.example .env
psql -h <数据库地址> -U <用户名> -d <数据库名> -f ../docs/references/database/init.sql
go run ./cmd/server
```

`APP_DATABASE_URL` 沿用 `postgresql+asyncpg://user:pass@host:5432/db` 写法（也接受 `postgresql://`）。
空数据库初始化通过 `../docs/references/database/init.sql` 完成；`/health` 仅检查数据库连接。
不提供远程任意 SQL 接口。接口文档位于 `http://localhost:8000/api/docs`。初始账号为 `admin`、
`warehouse`、`purchase`、`readonly`，初始密码均为 `123456`，首次登录后请修改。

## 验证与契约

```bash
gofmt -l .                    # 应无输出
go vet ./...
go test ./...                 # 单元测试 + 契约 / 文档一致性校验
tools/run_contract_tests.sh   # 黑盒契约测试：重建本地 PostgreSQL 测试库、启动服务、运行 tests/
```

黑盒契约测试需要 `pip install -r tests/requirements.txt` 与本机 PostgreSQL（默认 `postgres@127.0.0.1:5432`，
可用 `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` 覆盖）。

接口契约以 `../docs/openapi.yaml` 为唯一来源（手工维护）：改接口时先改契约，再执行 `make sync-openapi`
同步内嵌副本；`go test ./internal/app` 会校验契约里的每个操作都有路由、且没有契约外的业务路由。
`python scripts/openapi_examples.py` 可为契约补齐示例。

生产部署前必须修改 `APP_JWT_SECRET`。扫码出库小程序还需要配置
`APP_WECHAT_MINI_PROGRAM_APP_ID` 和 `APP_WECHAT_MINI_PROGRAM_APP_SECRET`。多个小程序分别按
相同顺序用英文逗号分隔，例如 `wx-app-1,wx-app-2` 和 `secret-1,secret-2`，两边数量必须一致，
并可继续追加。AppSecret 只能保存在后端。
图片位于 `server/data/uploads/`，应与 PostgreSQL 使用相同备份周期。

运行日志默认写入 `server/data/logs/spare-parts-api.log`。日志每天轮转，历史文件按
`YYYY-MM` 目录归档并保留 90 天；可通过 `APP_LOG_DIR` 和 `APP_LOG_BACKUP_COUNT` 调整。
控制台默认输出 ANSI 颜色，设置 `NO_COLOR=1` 可关闭。请求日志依次采用
`EO-Connecting-IP`、`X-Real-IP`、`X-Forwarded-For` 中的有效 IP；部署时应由可信反向代理覆盖这些请求头。
