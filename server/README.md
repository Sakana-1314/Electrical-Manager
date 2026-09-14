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
init.sql 与 ORM 模型改库）。

FastAPI + SQLAlchemy 2.x async + MySQL 8.0，实现细节见 [架构设计](../docs/websites/pages/dev-architecture.md)。

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

数据库耗时由 SQLAlchemy 的 `before_cursor_execute` / `after_cursor_execute` 事件按请求上下文
（`app/core/db_timing.py` 的 `ContextVar`）累计，后台任务（定时清理、Webhook 投递等）的 SQL
不计入任何请求。访问日志同样记录 `db=… query` 与 `compute=…` 分项。跨域部署时这四个耗时头
（含 `X-Response-Time`）都已在 `Access-Control-Expose-Headers` 中暴露。

## 跨域配置

后端通过 `RefererCORSMiddleware` 处理跨域，优先从 `Referer` 解析前端站点，缺失或无效时回退到 `Origin`，并为预检和正常响应补齐 CORS Header。本项目不使用 HTTP 404 状态码：资源不存在返回 `400 + NOT_FOUND`，未匹配路径返回 `400 + ROUTE_NOT_FOUND`，详见 [接口约定](../docs/websites/pages/api-conventions.md)。跨域完整说明见 [部署指南](../docs/websites/pages/guide.md#前后端分离部署)。

## 本地启动

要求 Python 3.12 和 MySQL 8.0：

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"
copy ..\docs\env\backend.env.example .env
mysql -h <数据库地址> -u <用户名> -p <数据库名> < ../docs/references/database/init.sql
mkdir data\template
copy app\templates\*.json data\template\
.venv/Scripts/uvicorn app.main:app --reload
```

空数据库初始化通过 `../docs/references/database/init.sql` 完成；`/health` 仅检查数据库连接。
不提供远程任意 SQL 接口。接口文档位于 `http://localhost:8000/api/docs`。初始账号为 `admin`、
`warehouse`、`purchase`、`readonly`，初始密码均为 `123456`，首次登录后请修改。

## 验证与契约

```bash
ruff check app tests
mypy app
pytest
python scripts/export_openapi.py
```

生产部署前必须修改 `APP_JWT_SECRET`。扫码出库小程序还需要配置
`APP_WECHAT_MINI_PROGRAM_APP_ID` 和 `APP_WECHAT_MINI_PROGRAM_APP_SECRET`。多个小程序分别按
相同顺序用英文逗号分隔，例如 `wx-app-1,wx-app-2` 和 `secret-1,secret-2`，两边数量必须一致，
并可继续追加。AppSecret 只能保存在后端。
图片位于 `server/data/uploads/`，应与 MySQL 使用相同备份周期。

运行日志默认写入 `server/data/logs/spare-parts-api.log`。日志每天轮转，历史文件按
`YYYY-MM` 目录归档并保留 90 天；可通过 `APP_LOG_DIR` 和 `APP_LOG_BACKUP_COUNT` 调整。
控制台默认输出 ANSI 颜色，设置 `NO_COLOR=1` 可关闭。请求日志依次采用
`EO-Connecting-IP`、`X-Real-IP`、`X-Forwarded-For` 中的有效 IP；部署时应由可信反向代理覆盖这些请求头。
