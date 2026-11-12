# 部署指南

## 组成

| 部分 | 目录 | 发布方式 |
| --- | --- | --- |
| 服务端（Go + Gin） | `server/` | 镜像 `electrical-manager:server` |
| 网页端（Vue 3 + nginx） | `web/` | 镜像 `electrical-manager:web` |
| 小程序 | `miniprogram/` | CI 上传微信小程序代码 |
| 数据库结构与种子数据 | `docs/references/database/init.sql` | 手工初始化 |
| 项目站点（本站） | `docs/websites/` | CI 构建后发布到 `gh-pages` 分支 |
| 接口文档 / Mock | `docs/openapi.yaml` | CI 同步到 Apifox |

接口文档与 Mock 由 CI 从 `docs/openapi.yaml` 同步到 Apifox，在线查看见[接口文档](/api)。

## Docker 部署

前提：外部 PostgreSQL 16+（库先建好）与外部网络 `1panel-network`。

```bash
git clone https://github.com/Sakana-1314/Electrical-Manager.git
cd Electrical-Manager
cp docs/env/.env.example .env          # 按注释填写
psql -h <host> -U <user> -d <database> -f docs/references/database/init.sql
docker compose pull
docker compose up -d
```

`docker-compose.yml` 使用 `ghcr.io/sakana-1314/electrical-manager:server` 与 `:web` 两个镜像；端口由 `BACKEND_PORT`（默认 8000）和 `FRONTEND_PORT`（默认 8080）控制。

## 环境变量

至少设置 `APP_DATABASE_URL` 与 `APP_JWT_SECRET`，其余按需：

| 变量 | 说明 |
| --- | --- |
| `APP_DATABASE_URL` | 如 `postgresql+asyncpg://user:pass@postgresql:5432/db`（也接受 `postgresql://`），密码需 URL 编码。 |
| `APP_JWT_SECRET` | 至少 32 位随机字符串，生产环境必须修改。 |
| `APP_ACCESS_TOKEN_MINUTES` | 登录有效期（分钟），默认 480。 |
| `APP_FERNET_KEY` | 可选，加密用户接口令牌的专用密钥；留空则从 `APP_JWT_SECRET` 派生。 |
| `APP_WECHAT_MINI_PROGRAM_APP_ID` | HXNI 电气无忧小程序 AppID，多个按相同顺序用英文逗号分隔。 |
| `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | 与上一项一一对应，只能保存在服务端。 |
| `APP_WECHAT_MINI_PROGRAM_CODE_ENV` | 小程序码环境：`trial` / `release`（默认 `release`）；AppID 取上面第一个已配置项。 |
| `APP_AI_SEARCH_ENABLED` | 是否启用 AI 搜索扩展，默认 `false`。 |
| `APP_AI_SEARCH_ENDPOINT` / `APP_AI_SEARCH_API_KEY` / `APP_AI_SEARCH_MODEL` | OpenAI 兼容端点、API Key 与模型；启用时必须全部填写。 |
| `APP_FEISHU_WEBHOOK_ENABLED` / `APP_FEISHU_WEBHOOK_URL` / `APP_FEISHU_WEBHOOK_SECRET` / `APP_FEISHU_WEBHOOK_EVENTS` | 飞书机器人推送开关、地址、签名密钥与订阅事件（英文逗号分隔：`stock.outbound.created,stock.inbound.created,mini_program.user.bound`）。 |
| `APP_DINGTALK_WEBHOOK_ENABLED` / `APP_DINGTALK_WEBHOOK_URL` / `APP_DINGTALK_WEBHOOK_SECRET` / `APP_DINGTALK_WEBHOOK_EVENTS` | 钉钉机器人推送，字段同飞书。 |
| `BACKEND_PORT` / `FRONTEND_PORT` | 宿主机映射端口，默认 8000 / 8080。 |

模板见 `docs/env/.env.example`（Compose 部署）与 `docs/env/backend.env.example`、`docs/env/frontend.env.example`（独立部署后端 / 前端时使用）；完整清单（含日志、跨域、限流等）见[架构设计](/dev-architecture)。

## 运行形态

| 组件 | 端口 | 说明 |
| --- | --- | --- |
| 后端 | 8000 | `/health`（含 DB 探测）、`/api/docs`（Swagger）、`/api/v1/openapi.json`、`/api/v1/*`、`/api/v1/mcp` |
| 前端 | 容器 80，宿主默认 8080 | Nginx 托管静态资源并代理 `/api` 到后端 |
| 数据库 | 外部 PostgreSQL 16+ | 由部署方用 `docs/references/database/init.sql` 初始化；容器不自动执行脚本 |
| 持久化 | `uploads`、`logs` 两个命名卷 | 图片、导入临时文件、导出文件与日志 |

## 数据库

| 事项 | 说明 |
| --- | --- |
| 结构与种子数据 | `docs/references/database/init.sql` 是唯一来源，用于新库初始化；Go 测试校验它与 `server/internal/model/models_gen.go` 一致（表、列、NULL 约束），改表结构必须同时改两边。 |
| 初始账号 | `admin`、`warehouse`、`purchase`、`hazard`、`ledger`、`work`、`readonly`，初始密码均为 `123456`，首次登录后请修改。 |
| 已有库升级 | 仓库不保存增量迁移脚本：先备份，再参照 `init.sql` 与现有库结构的差异，按各自流程改库。 |

表结构说明见[数据模型](/dev-data-model)。

## 前后端分离部署

前端用 Vite 构建，后端地址在**构建阶段**注入并写进静态产物，部署后改服务器环境变量不生效，必须重新构建。图片直接走当前后端线路的 `/api/v1/files/images`。

### 构建变量

| 变量 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `VITE_API_BASE_URLS` | 否 | `https://api-a.example.com,https://api-b.example.com` | 多后端线路，英文逗号分隔；配置后优先于 `VITE_API_BASE_URL`，首次进入并发探测并选延迟更低的一条，见[双后端线路](#双后端线路) |
| `VITE_API_BASE_URL` | 单后端时必填 | `https://api.example.com` | 后端地址（兼容旧配置）；只填域名会自动补 `/api/v1`，也可填完整 API 根地址 |
| `VITE_API_PROXY` | 否 | `http://localhost:8000` | 仅 `npm run dev` 的本地代理 |
| `VITE_BASE_PATH` | 否 | `/Electrical-Manager/demo/` | 部署到子路径时用，默认 `/` |

所有 `VITE_*` 都会暴露给浏览器，禁止放密钥、Token。地址末尾可带斜杠，构建会自动清理。

### 构建

| 平台 | 命令 |
| --- | --- |
| Linux | `cd web && npm ci && VITE_API_BASE_URL=https://api.example.com npm run build` |
| PowerShell | `Set-Location web; npm ci; $env:VITE_API_BASE_URL='https://api.example.com'; npm run build` |

产物在 `web/dist/`，CD 阶段把它发布到静态站点、对象存储或 CDN 即可。

### 双后端线路

`VITE_API_BASE_URLS` 用英文逗号配置多条后端地址后，网页首次进入会并发请求每条线路的 `GET /api/v1/version`，选耗时最低的一条；结果存在浏览器 `sessionStorage`，同一标签页刷新不重复探测。请求遇到连接失败、超时或网关 `502 / 503 / 504` 时自动切到下一条并记入会话，后续请求都走新线路；左下角用户菜单的「线路」子菜单也可手动切换（切换后整页刷新）。只配置一条地址时不发探测请求，行为与旧版一致。

| 项 | 要求 |
| --- | --- |
| 数据一致性 | 多条线路应指向同一套数据库（主备入口 / 同库多域名），否则切换后看到的数据会不同 |
| 跨域 | 每条线路都要在后端 `APP_CORS_ORIGINS` 放行前端站点；探测与业务请求走同一套 CORS 规则 |
| 探测口径 | 只比较 `/version` 首包延迟，不做数据库健康检查；某条线路数据库不可用不会被判为「线路不可用」 |
| 切换范围 | 网络类错误与网关不可用会切；业务 `5xx`、`401`、用户主动取消不切 |

### 环境划分

| 环境 | `VITE_API_BASE_URL` |
| --- | --- |
| 测试 | `https://api-test.example.com` |
| 生产 | `https://api.example.com` |

每套环境单独出产物，避免同一个静态包跨环境复用。

### 后端跨域

后端用 CORS 中间件（`server/internal/middleware` 的 `CORS`）：优先按 `Referer` 解析前端站点，缺失或无效时回退 `Origin`，并为预检与正常响应（含结构化错误响应）补齐 CORS Header。

```text
Referer: https://spares.example.com/login?redirect=/
Origin: https://spares.example.com
Access-Control-Allow-Origin: https://spares.example.com
Vary: Origin, Referer
```

| 项 | 内容 |
| --- | --- |
| 响应头 | 暴露 `Content-Disposition`、`X-Request-ID` 与性能头 `X-Response-Time`、`X-DB-Time`、`X-Compute-Time`、`X-DB-Queries` |
| 错误体 | 不使用 HTTP 404，错误统一为结构化业务错误体，见[接口约定](/api-conventions) |

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `APP_CORS_ALLOW_CREDENTIALS` | `true` | 是否允许携带凭证 |
| `APP_CORS_MAX_AGE` | `86400` | 预检结果缓存秒数 |

正常部署时 `Referer` 所属站点应与浏览器 `Origin` 相同；浏览器不发送 `Referer` 时自动回退 `Origin`。

### EdgeOne Pages

| 项 | 值 |
| --- | --- |
| 部署配置 | `web/edgeone.json`（EdgeOne 项目根目录为 `web/`） |
| 构建命令 | `npm run build` 经 `web/scripts/build.mjs` 在 POSIX 构建机上先尽量提升 `nofile`，再执行 `vue-tsc -b && vite build`（即 `build:ci`）。EdgeOne 构建容器的 nofile 软限制较低，直接构建可能报 `EMFILE: too many open files`；若平台仍失败，把构建命令改成 `sh -c 'ulimit -n 65535; npm run build'`。 |
| 构建产物 | `dist/`（JS/CSS 在 `dist/yangrucheng-assets/`，文件名带内容 hash） |
| 缓存规则 | `/yangrucheng-assets/*`、`/*.png`、`/*.jpg` → `max-age=1209600`（14 天） |

图片（`logo.png`、`qrcode.png`）在 `dist/` 根目录，因此 png/jpg 规则用全站后缀匹配而非限定在 `yangrucheng-assets/` 内；`edgeone.json` 的 `source` 是 URL 通配符（以 `/` 开头、最多一个 `*`）。

## 文档站点

本站由 `docs/websites/` 下的 VitePress 工程构建：CI 在 `main` 变更时构建并推送到 `gh-pages` 分支，由 GitHub Pages 发布。

```bash
cd docs/websites
npm install
npm run dev        # 本地预览
npm run build      # 产物在 .vitepress/dist
```
