# 架构设计

三端与外部依赖的关系：

```mermaid
flowchart LR
    Web["网页端<br/>Vue 3 + Naive UI"] --> API["服务端<br/>FastAPI"]
    MP["微信小程序"] --> API
    Agent["AI Agent / MCP"] --> API
    API --> DB[("MySQL 8.0")]
    API --> WeChat["微信接口<br/>登录 / 小程序码"]
    API --> Ext["外部物资平台<br/>采购进度"]
    API --> Hook["飞书 / 钉钉<br/>Webhook"]
```

## 技术栈与版本

| 部分 | 技术 | 版本约束 |
| --- | --- | --- |
| 服务端语言与框架 | Python（镜像 `python:3.12-slim`）+ FastAPI + SQLAlchemy（asyncio）+ asyncmy | Python `>=3.12,<3.15`；FastAPI `>=0.141,<1`；SQLAlchemy `>=2.0.36,<3`；asyncmy `>=0.2.10,<1`（`server/pyproject.toml`、`server/Dockerfile`） |
| 服务端依赖与数据库 | pydantic-settings（`APP_` 前缀 + `server/.env`）；PyJWT + argon2-cffi（密码哈希）；cryptography（Fernet 凭证加密）；Pillow；openpyxl / xlrd；httpx；mcp；pytest / pytest-asyncio / aiosqlite、ruff、mypy(strict)；MySQL / InnoDB / `utf8mb4_0900_ai_ci` | pydantic-settings `>=2.7,<3`；PyJWT `>=2.10,<3`、argon2-cffi `>=23.1,<26`；cryptography `>=44,<47`；Pillow `>=11,<13`；openpyxl `>=3.1.5,<4`、xlrd `>=2.0,<3`；httpx `>=0.28,<1`；mcp `>=2,<3`；pytest `>=8.3,<9`、pytest-asyncio `>=0.25,<1`；MySQL 8.0（`server/app/core/config.py`、`server/app/core/security.py`、`server/app/services/file_service.py`、`server/app/services/import_file_reader.py`、`server/app/mcp_server.py`） |
| 网页端 | Vue、Vue Router、Pinia、Naive UI、Axios、VueUse | `^3.5.17`、`^4.5.1`、`^3.0.3`、`^2.42.0`、`^1.10.0`、`^13.5.0` |
| 网页端构建与测试 | Vite、TypeScript、vue-tsc；Vitest、Vue Test Utils、jsdom；openapi-typescript（契约生成） | Vite `^7.0.4`、TypeScript `~5.8.3`、vue-tsc `^3.0.3`；Vitest `^3.2.4`、Vue Test Utils `^2.4.6`、jsdom `^26.1.0`；openapi-typescript `^7.8.0`（`web/package.json`） |
| 小程序与站点 | 微信小程序原生（WXML/WXSS/JS）+ tdesign-miniprogram、miniprogram-ci；VitePress 站点（`srcDir: pages`、`base: /Electrical-Manager/`） | tdesign `^1.15.3`、miniprogram-ci `2.1.31`；VitePress `^1.6.4`（`miniprogram/package.json`、`docs/websites/package.json`、`docs/websites/.vitepress/config.ts`） |
| 部署 | Docker Compose；镜像 `ghcr.io/sakana-1314/electrical-manager:server` / `:web`；replica `nginx:1.27-alpine`（`docker-compose.yml`、`web/Dockerfile`） | — |

## 仓库目录结构

```text
Electrical-Manager/
├── AGENTS.md / CLAUDE.md / README.md / docker-compose.yml（backend:8000 + frontend:80→8080，外部 1panel-network）
├── docs/   openapi.yaml（契约唯一来源）、env/、references/database/init.sql（结构唯一来源）、websites/（VitePress）
├── server/ Dockerfile（python:3.12-slim）、pyproject.toml、scripts/（导出 OpenAPI 等）、data/（uploads/imports/exports、logs/）、tests/（unit/、integration/）
│   └── app/  main.py（FastAPI、lifespan worker、MCP 挂载）、mcp_server.py
│       ├── api/deps.py（分页/排序/精简模式守卫）、api/v1/（21 个路由模块）
│       ├── core/（config、database、security、permissions、errors、middleware、logging、constants…）
│       ├── domain/enums.py、models/__init__.py、schemas/__init__.py、templates/（Excel 布局 JSON）
│       └── repositories/（7 个查询仓储）、services/（26 个服务与公共模块）
├── web/    Dockerfile（node:22-alpine → nginx:1.27-alpine）、nginx.conf、vite.config.ts、vitest.config.ts、src/（api、router、stores、views、components、composables…）
└── miniprogram/  app.json（18 个页面）、pages/、components/、utils/、scripts/（check.js / upload.js）
```

<Tabs :tabs="[
  { id: 'frontend', title: '前端' },
  { id: 'backend', title: '后端' },
  { id: 'miniprogram', title: '小程序' }
]">

<TabsContent id="frontend">

`web/` 是 Vue 3 + TypeScript + Vite 单页应用：UI 用 Naive UI，状态用 Pinia，HTTP 用 axios，接口类型由 `docs/openapi.yaml` 生成。
## 技术栈与命令
| 类别 | 依赖 | 版本（`web/package.json`） |
| --- | --- | --- |
| 框架与运行时 | `vue`、`vue-router`、`pinia`、`naive-ui`、`axios`、`@vueuse/core`、`@vicons/ionicons5`、`vue3-tree-org` | `^3.5.17`、`^4.5.1`、`^3.0.3`、`^2.42.0`、`^1.10.0`、`^13.5.0`、`^0.13.0`、`^4.2.2` |
| 构建与类型 | `vite`、`@vitejs/plugin-vue`、`unplugin-vue-components`、`typescript`、`vue-tsc` | `^7.0.4`、`^6.0.0`、`^28.8.0`、`~5.8.3`、`^3.0.3` |
| 测试与契约 | `vitest`、`jsdom`、`@vue/test-utils`、`openapi-typescript` | `^3.2.4`、`^26.1.0`、`^2.4.6`、`^7.8.0` |

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器（端口 5173，见 `web/vite.config.ts`） |
| `npm run build` | `vue-tsc -b && vite build`（先类型检查再构建） |
| `npm run preview` | 预览构建产物 |
| `npm run test` / `npm run test:watch` | `vitest run` / 监听模式单测 |
| `npm run lint` / `npm run format` | `eslint . --max-warnings 0` / `prettier --write .` |
| `npm run generate:api` | `openapi-typescript ../docs/openapi.yaml -o src/api/generated.raw.ts` |
测试文件为 `*.spec.ts`，共 36 个；`web/vitest.config.ts` 中 `setupFiles: ['./src/test/setup.ts']`（仅 `afterEach(() => vi.restoreAllMocks())`）。
## 前端目录结构
```text
web/src/
├── App.vue                 根组件：n-config-provider（中文 locale + 按外观解析的 theme/theme-overrides）包 4 个 provider + router-view
├── main.ts                 启动引导：拉图片加速配置 → createApp + 应用外观 + 加载 settings store → mount
├── theme.ts / styles.css   Naive UI 全局主题覆盖（明/暗两套调色板）；全局样式与 CSS 变量（--color-*、--radius-*），深色档见 [data-theme='dark']
├── env.d.ts                ImportMetaEnv 声明 + __BUILD_TIME__
├── index.html              含两段入口脚本：首屏预置界面外观（读 theme.mode → html[data-theme] + color-scheme）、演示站深链回退
├── api/client.ts           axios 实例、拦截器、AppError
├── layouts/AppLayout.vue   唯一布局：侧边菜单/移动端抽屉 + 顶栏用户菜单（外观二级菜单）
├── layouts/appearanceMenu.ts 用户菜单「外观」二级菜单与档位判定（纯逻辑，有单测）
├── router/index.ts         路由表 + beforeEach 守卫
├── test/setup.ts           vitest setup
├── 其余目录与文件分见下文清单：api/（模块表）、components/、composables/、config/、constants/、
│   stores/、types/、utils/、views/
└── 页面文件清单见「路由表」的组件文件列
```
`web/components.d.ts` 由 `unplugin-vue-components` 生成（Naive UI 组件自动按需引入），同样不应手改。



### 路由表
来源 `web/src/router/index.ts`；`meta.permission` 是唯一权限点，**`meta.roles` 当前未实现**。除标注「公开」外都要求已登录。
`meta.title` 是页面短名（详情页也用短名），`meta.parent` 是顶栏面包屑与浏览器标题里的上级标题
（二级条目用菜单分组名，详情页/操作页用所属列表页或入口标题，顶级条目不设该字段）；移动端顶栏只展示 `meta.title`。

| 路径 | name | 组件文件 | 鉴权 | 职责 |
| --- | --- | --- | --- | --- |
| `/login` | `login` | `views/LoginView.vue` | 无（公开 `meta.public`） | 登录页：账号密码表单 + 演示提示，调 `auth.login`，支持 `?redirect=` 回跳 |
| `/` | — | `layouts/AppLayout.vue` | 需登录 | 布局壳：侧边菜单 + 顶栏用户菜单 |
| `/dashboard` | `dashboard` | `views/dashboard/DashboardView.vue` | 需登录 | 工作台：汇总卡片（`inventoryApi.summary`）与低库存/近期流水概览 |
| `/memos` | `memos` | `views/MemosView.vue` | 需登录 | 备忘录：多 tab、保存才提交、IndexedDB 草稿、字号偏好（浏览器本地，CSS 变量作用于编辑区） |
| `/warehouse/materials` | `stock-materials` | `views/warehouse/StockMaterialsView.vue` | 需登录 | 物资档案列表/新增编辑、补库策略、小程序码 |
| `/warehouse/materials/:id` | `stock-material-detail` | `views/warehouse/StockMaterialDetailView.vue` | 需登录 | 物资详情（图片、出入库记录、策略） |
| `/warehouse/inbound` | `inbound` | `views/warehouse/OperationEditorView.vue`（`props: { operationType: 'INBOUND' }`） | `warehouse:write` | 入库登记（行编辑与校验） |
| `/warehouse/outbound` | `outbound` | `views/warehouse/OperationEditorView.vue`（`props: { operationType: 'OUTBOUND' }`） | `warehouse:write` | 出库登记（行编辑与校验） |
| `/warehouse/stock` | `stock` | `views/warehouse/StockView.vue` | 需登录 | 库存查询（余额/低库存）、生成补库草稿 |
| `/warehouse/hua-xing-stock` | `hua-xing-stock` | `views/warehouse/HuaXingStockView.vue` | 需登录 | 华星总库存查询 + Excel 导入（`useImportJob`/`useImportConfirm`） |
| `/warehouse/lite` | `warehouse-lite` | `views/warehouse/SecondaryWarehouseLiteView.vue` | 需登录 | 精简二级库：Excel 导入 + 只读查询 |
| `/warehouse/operations` | `operations` | `views/warehouse/OperationsView.vue` | 需登录 | 流水列表（筛选/详情/冲减入口） |
| `/warehouse/operations/:id` | `operation-detail` | `views/warehouse/OperationDetailView.vue` | 需登录 | 流水详情与修改、冲减 |
| `/procurement/materials` | `purchase-materials` | `views/procurement/PurchaseMaterialsView.vue`（`keepAlive`） | 需登录 | 计划列表：筛选/排序/批量更新/批量转记录/导出、列显隐与 URL 同步 |
| `/procurement/materials/:id` | `purchase-material-detail` | `views/procurement/PurchaseMaterialDetailView.vue` | 需登录 | 计划详情与编辑 |
| `/procurement/purchase-plan-templates` | `purchase-plan-templates` | `views/procurement/PurchasePlanTemplatesView.vue`（`keepAlive`） | 需登录 | 模板列表/编辑/生成申购计划 |
| `/procurement/uncoded-materials` | `uncoded-materials` | `views/procurement/UncodedMaterialsView.vue` | 需登录 | 未编码物资（`coded: false`）批量编码与导出 |
| `/procurement/material-code-library` | `material-code-library` | `views/procurement/MaterialCodeLibraryView.vue` | 需登录 | 编码库列表 + Excel 导入 |
| `/procurement/records` | `purchase-records` | `views/procurement/PurchaseRequestsView.vue`（`keepAlive`） | 需登录 | 记录列表：批量更新/恢复为计划/分享/导出 |
| `/procurement/records/:id` | `purchase-record-detail` | `views/procurement/PurchaseRequestDetailView.vue` | 需登录 | 记录详情与编辑（含图片） |
| `/hazards` | `hazard-records` | `views/hazard/HazardRecordsView.vue`（`keepAlive`） | 需登录 | 隐患台账：筛选（类型/状态/等级/单位/整改员工/区域/关键字/日期）/分页/列显隐与 URL 同步、整行点击编辑弹窗、逾期标记 |
| `/hazard-types` | `hazard-types` | `views/hazard/HazardTypesView.vue` | 需登录 | 隐患类型：两级横向树（大类在左、小类在右，连线由 `vue3-tree-org` 绘制），大类可折叠，点小类编辑 |
| `/hazard-units` | `hazard-units` | `views/hazard/HazardUnitsView.vue` | 需登录 | 责任单位：单位与责任人一一对应、行内启停 |
| `/ledger/items` | `ledger-items` | `views/ledger/LedgerItemsView.vue`（`keepAlive`） | 需登录 | 台账总览：固定列（名称 / 型号 / 子项号 / 标签 / 数量（合并单位展示）/ 用途 / 备注 / 图片）、关键字与标签多选筛选（命中选中标签及其全部子孙标签）、分页/列显隐与 URL 同步、整行点击编辑弹窗 |
| `/ledger/tags` | `ledger-tags` | `views/ledger/LedgerTagsView.vue` | 需登录 | 标签管理：横向树（至多 3 层，`vue3-tree-org`）、节点悬停浮层看备注与图片、按「孤立标签 / 树标签」筛选、节点上新增子标签与编辑 |
| `/settings/advanced` | `advanced-settings` | `views/settings/AdvancedSettingsView.vue` | `settings:write` | AI 搜索、小程序功能开关、图片加速、Webhook |
| `/settings/ai-search` | — | 无组件，`redirect: { name: 'advanced-settings' }` | — | 无组件，重定向到 advanced-settings |
| `/settings/users` | `users` | `views/settings/UsersView.vue` | `settings:write` | 用户管理：角色、启停、令牌回显/重置、MCP 链接 |
| `/settings/mini-program-users` | `mini-program-users` | `views/settings/MiniProgramUsersView.vue` | `settings:write` | 小程序用户查询/更新/删除/合并 |
| `/settings/about` | `about` | `views/settings/AboutView.vue` | `settings:write` | 版本信息与构建时间（`versionApi.get()`） |
| `/settings/share-links` | `share-links` | `views/settings/ShareLinksView.vue` | `settings:write` | 分享链接列表/改列/改期/撤回 |
| `/share/:token` | `share` | `views/public/ShareView.vue` | 无（公开 `meta.public`） | 匿名分享预览（按配置列渲染） |
| `/:pathMatch(.*)*` | — | `views/NotFoundView.vue` | 无（公开 `meta.public`） | 404 页面 |

路由守卫 `router.beforeEach`（同步函数，顺序即执行顺序）：

| 序 | 规则 |
| --- | --- |
| 1 | 设置标题：`` document.title = `${to.meta.title || '系统'} - HXNI 电气无忧` `` |
| 2 | 非 `public` 且 `auth.isAuthenticated` 为 false → `{ name: 'login', query: { redirect: to.fullPath } }` |
| 3 | 目标是 `login` 但已登录 → `{ name: 'dashboard' }` |
| 4 | `to.meta.permission` 存在且 `auth.can(permission)` 为 false → `{ name: 'dashboard' }` |
| 5 | `settings.isLiteMode` 为 true 且目标 name 属于 `FULL_WAREHOUSE_ROUTES`（`stock-materials`、`stock-material-detail`、`inbound`、`outbound`、`stock`、`operations`、`operation-detail`）→ `{ name: 'warehouse-lite' }` |

| 项 | 实现 | 位置 |
| --- | --- | --- |
| 是否已登录 | `isAuthenticated` = `token && user` 同时存在 | `stores/auth.ts` |
| 权限点 | `can(permission)` 查 `rolePermissions`：`SUPER_ADMIN` 全部 6 项；`WAREHOUSE_ADMIN` `warehouse:write`+`read`；`PURCHASE_ADMIN` `purchase:write`+`read`；`HAZARD_ADMIN` `hazard:write`+`read`；`LEDGER_ADMIN` `ledger:write`+`read`；`READ_ONLY` 仅 `read` | `types/navigation.ts` |
| 无权限时 | 静默重定向到工作台；无独立 403 页、无全局拦截，页面内用 `auth.can()` 自行隐藏入口 | `router/index.ts`、`layouts/AppLayout.vue` |
| keep-alive | `meta.keepAlive` 只在 5 个列表路由（`purchase-materials`、`purchase-plan-templates`、`purchase-records`、`hazard-records`、`ledger-items`）声明，由 `<keep-alive>` 使用，路由守卫不读该字段 | 同上 |
### 状态管理
`web/src/stores/` 下只有 3 个 store，均为 setup 语法（`defineStore(id, () => {...})`）。

| store | state | getters | actions | 持久化 | 职责 |
| --- | --- | --- | --- | --- | --- |
| `stores/auth.ts`（`useAuthStore`） | `user: User \| null`、`token: string \| null` | `isAuthenticated`（`Boolean(token && user)`） | `login(payload)`、`refresh()`（调 `/auth/me` 回填 user）、`logout()`、`can(permission)` | 读写 `localStorage`：`access_token`、`refresh_token`、`auth_user`；`user`/`token` 初值在 store 定义时就读取 `auth_user` / `access_token` | 登录态与角色权限判断 |
| `stores/settings.ts`（`useSettingsStore`） | `secondaryWarehouseMode: SecondaryWarehouseMode`（初值 `'full'`）、`loaded: boolean` | `isLiteMode`（`secondaryWarehouseMode === 'lite'`） | `load()`（调 `systemSettingsApi.miniProgramFeatures()`，失败回退 `'full'`，`loaded` 置 true 后不再重复请求） | 无持久化（每次启动重新拉公开配置） | 全局二级库模式，供路由守卫与侧边菜单在首次导航前同步读取 |
| `stores/theme.ts`（`useThemeStore`） | `mode: ThemeMode`（初值读本地 `theme.mode`，缺省 `'auto'`） | `isDark`（`auto` 时取 `usePreferredDark()`，否则看档位） | `setMode(mode)`（写本地并立即生效）、`apply()`（把解析结果写到 `<html data-theme>` + `color-scheme` + `meta[name=theme-color]`） | `localStorage` key `theme.mode`（`auto` / `light` / `dark`）；系统外观变化由 `watch(isDark)` 实时同步 | 界面外观，供 App.vue 切 Naive UI 主题、styles.css 切令牌 |
`main.ts` 在 `app.mount('#app')` 之前 `await useSettingsStore(pinia).load()`，因此守卫里能同步读到 `isLiteMode`；同一处 `useThemeStore(pinia).apply()` 先把外观落到 `<html>`，与 `index.html` 首屏预置脚本结果一致，避免闪主题。



### API 客户端与契约生成
#### `web/src/api/client.ts`
- 实例：`axios.create({ baseURL: apiBaseUrl, timeout: 30_000, paramsSerializer: { indexes: null } })`（数组参数序列化为重复 key，不带 `[]`）。
| 导出 | 来源 | 缺省行为 |
| --- | --- | --- |
| `apiBaseUrl` | `VITE_API_BASE_URL` | 回退 `/api/v1`；只填域名（纯 origin）时自动补 `/api/v1` |
| `imageBaseUrl` | `VITE_IMAGE_BASE_URL` | 缺省 = `apiBaseUrl/files/images` |
| `buildTime` | 构建期注入的 `__BUILD_TIME__` | — |
| `resolveMcpUrl(apiBaseUrl, token)` | — | 拼出 `mcp/?token=` 地址 |

位置：`web/src/config/env.ts`。
- 请求拦截器：`localStorage` 有 `access_token` 时注入 `Authorization: Bearer <token>`；`config.headers['X-Request-ID']` 缺失时生成 `crypto.randomUUID()`（一个逻辑请求一个 id，重试复用同一个，服务端日志里多次尝试能串起来）。
- 版本头：客户端**不统一注入**，由业务模块按需传 `If-Match`（值均为 `String(version)`）：
  `procurement.deleteMaterial`、`procurement.restoreRecordToPlan`、`purchasePlanTemplates.deleteTemplate`、
  `inventory.deleteMaterial`、`dictionaries.deleteMiniProgramUser`。
- `X-API-Token`：**前端当前未实现**（代码中无该请求头，接口令牌仅在「管理端用户」页展示/复制与 MCP 链接里使用）。
- 401 处理：仅当 `status === 401 && data.code === 'INVALID_TOKEN' && 未重试过 && localStorage 有 refresh_token`
  时，调用 `renewAccessToken()`（`POST /auth/refresh`，`timeout: 30_000`）并重放原请求；并发请求共用模块级
  `refreshRequest` promise，避免刷新风暴。刷新失败或其余 401：`clearSession()` 后跳登录页。
- 错误归一化：响应体带 `code` 时抛 `AppError`（保留 `code` / `message` / `details` / `request_id`）；否则按有无 `response` 构造 `SERVER_ERROR`（`服务请求失败（HTTP <status>），请稍后重试`）或 `NETWORK_ERROR`（`无法连接服务器，请检查网络后重试`），`request_id` 取自本次请求的 `X-Request-ID`。已归一化的 `AppError` 会被后续拦截器直接透传，不会因重放被再次包装。
- 未消费响应头：**前端当前不读取任何响应头**（无 `X-Response-Time` / 服务端 `X-Request-ID` 的读取逻辑）。
- 超时覆盖：默认 30s；`systemSettings.imageAcceleration`、`systemSettings.miniProgramFeatures` 为 3000ms 且 `retry: false`（都在启动路径上、带各自回退值，弱网下宁可快速失败也不拖住首屏）；`aiSearch.testSettings` 为 35s；`procurement.importMaterialCodes`、`secondaryWarehouse.import`、`huaXingInventory.import` 为 120s。
#### 弱网自动重试（`web/src/api/retry.ts`）

瞬时失败（断网、超时、连接被重置、网关抖动）自动重放，用户不必手点重试；策略与小程序同一套参数：

| 维度 | 规则 |
| --- | --- |
| 可重放 | 缺省只有 `GET` / `HEAD` / `OPTIONS`；写请求需业务显式声明幂等（`{ retry: true }`，如带 `client_request_id` 的 `inventory.inbound` / `inventory.outbound` / `inventory.reverseOperation`）；`{ retry: false }` 关闭重试（启动路径上的两个 3000ms 探针） |
| 触发条件 | 无 `response`（连接层失败）或状态码 ∈ `408 / 429 / 500 / 502 / 503 / 504`；`axios.isCancel` 与已 `abort` 的请求不重试 |
| 次数与节奏 | 最多 3 次尝试；失败后退避 600ms → 1800ms（上限 6s），叠加 30% 以内抖动，避免并发请求同时复活 |
| 最坏耗时 | 单次 30s × 3 + 退避 ≈ 92s |
| 重放方式 | 复用同一份 config 重发：`X-Request-ID` 不变、`Authorization` 重新读取（等待期间 token 可能刚刷新） |
| 拦截器顺序 | 重试拦截器注册在 401 刷新与错误归一化**之前**：只有它拿得到原始 `AxiosError`（状态码、取消标记） |

#### 契约生成
| 文件 | 说明 |
| --- | --- |
| `docs/openapi.yaml` | 唯一事实源（后端导出） |
| `web/src/api/generated.raw.ts` | 由 `npm run generate:api`（`openapi-typescript`）从 `docs/openapi.yaml` 生成，**禁止手改** |
| `web/src/api/generated.ts` | 手写类型别名层：能一一映射的写 `export type X = components['schemas']['X']`，再补前端自建视图模型（`Page<T>`、`PagedQueryParams`、`ManagedUser`、`OperationWrite`、`PurchaseRequest` 等）；**不是生成产物，但生成段仍不应手改** |
#### `web/src/api/` 模块职责
| 模块 | 接口域 | 职责 |
| --- | --- | --- |
| `auth.ts` | `/auth/login`、`/auth/refresh`、`/auth/me` | 登录、刷新令牌、取当前用户 |
| `inventory.ts` | `/dashboard/summary`、`/stock-materials*`、`/inventory/*` | 工作台汇总、物资档案 CRUD + 小程序码、补库策略、库存查询、低库存、出入库、流水查询/修改/冲减、补库草稿 |
| `procurement.ts` | `/material-code-library*`、`/purchase-materials*`、`/purchase-records*`、`/excel-export-jobs/:id` | 申购计划/记录 CRUD 与批量操作、筛选选项、计划转记录、未编码物资、物料编码库导入与检查、各类导出与导出任务轮询 |
| `purchasePlanTemplates.ts` | `/purchase-plan-templates*` | 周期性计划模板 CRUD 与「生成申购计划」 |
| `huaXingInventory.ts` | `/huaxing-inventory*` | 华星总库存查询、筛选选项、Excel 导入任务与最近导入 |
| `secondaryWarehouse.ts` | `/secondary-warehouse*` | 精简二级库列表、Excel 导入任务与最近导入 |
| `dictionaries.ts` | `/users*`、`/mini-program-users*` | 管理端用户 CRUD 与接口令牌重置、小程序用户查询/更新/删除/合并 |
| `systemSettings.ts` | `/system-settings/*` | 图片加速配置、小程序功能开关、Webhook 渠道读取/更新/测试 |
| `aiSearch.ts` | `/ai-search/*` | AI 搜索扩展、状态、配置读取/更新/测试 |
| `share.ts` | `/shares*` | 创建/读取/列取/更新/撤回匿名分享链接 |
| `memos.ts` | `/memos*` | 个人备忘录 CRUD |
| `hazards.ts` | `/hazards*`、`/hazard-types*`、`/hazard-units*` | 隐患台账 CRUD、概览统计与筛选项（整改员工）、隐患类型与责任单位字典维护 |
| `ledger.ts` | `/ledger-items*`、`/ledger-tags*` | 台账记录 CRUD 与分层标签维护（含孤立 / 树标签筛选、标签多选） |
| `files.ts` | `/files/images*` | 图片上传与删除 |
| `version.ts` | `/version` | 版本信息（关于页） |
`web/src/utils/download.ts` 的 `exportDownloadUrl(fileUuid)` 直接拼导出文件下载地址（该端点不鉴权）。



### 公共组件清单
`web/src/components/` 下 20 个 `.vue`（不含 `.spec.ts`）：

| 组件 | 职责 | 关键 props / emits |
| --- | --- | --- |
| `ColumnVisibilityPicker.vue` | 表格列显隐勾选，可选按 `storageKey` 从 `localStorage` 恢复/持久化（最后一列不允许取消） | props：`value: string[]`、`options: ColumnOption[]`、`storageKey?: string`；emit：`update:value` |
| `ExportButton.vue` | 导出下拉按钮（Naive UI `NDropdown`），无选项或无数据时禁用 | props：`options: ExportOption[]`、`loading?`、`disabled?`（默认 false）；emit：`select: [key: string]` |
| `ExportLoadingOverlay.vue` | 全屏「正在生成 Excel，请稍候…」遮罩 | props：`show: boolean` |
| `FilterExpandButton.vue` | 筛选区展开/收起按钮（`aria-expanded`） | props：`expanded: boolean`；emit：`update:expanded` |
| `ImageThumbnails.vue` | 图片缩略图（最多显示 3 张 + 剩余数量），用 `imagePreviewUrl`/`imageUrl` | props：`images: FileObject[]` |
| `ImageUploader.vue` | 图片上传（校验类型/大小、上传/删除、预览），并处理 ESC 只关一层预览的捕获逻辑 | props：`files: FileObject[]`、`disabled?`、`max?`（默认 9）；emit：`update:files` |
| `LoadingMask.vue` | 元素内局部加载遮罩（模糊宿主 + 居中 loading） | props：`show: boolean`、`text?: string` |
| `MaterialCodeSelector.vue` | 物料编码库弹窗选择器，支持按编码/名称/型号检索分页 | props：`modelValue: string`、`defaultName?`、`defaultModelSpec?`、`disabled?`；emits：`update:modelValue`、`select: [MaterialCodeLibrary]` |
| `MaterialSelector.vue` | 二级库物资下拉选择（支持关键词加载与排除已选） | props：`value: number \| null`、`disabled?`、`excludeIds?: number[]`；emits：`update:value`、`select: [StockMaterial?]` |
| `OperationLinesEditor.vue` | 出入库行编辑器（选物资 + 数量，出库多一列领用信息） | props：`lines: OperationLineModel[]`、`type: 'INBOUND' \| 'OUTBOUND'`、`disabled?`；emit：`update:lines` |
| `PurchaseRecordHistoryDialog.vue` | 申购记录历史弹窗（按名称/型号检索历史记录表格） | props：`show: boolean`、`initialName?`；emit：`update:show` |
| `QuantityInput.vue` | 数量输入框：正则限制 1 位小数，用 `isDecimalString` / `compareDecimal` 校验并显示 error/success 状态 | props：`value: string`、`decimalPlaces?`（默认 1）、`max?`、`disabled?`、`placeholder?`；emit：`update:value` |
| `ReverseOperationDialog.vue` | 出入库流水冲减弹窗（按行填写冲减数量，`reversed` 回传操作 id） | props：`show: boolean`、`operation: StockOperation \| null`；emits：`update:show`、`reversed: [id: number]` |
| `ShareLinkDialog.vue` | 分享链接生成弹窗（三步：确认 → 选择失效时间 → 生成并复制链接） | props：`show: boolean`、`shareType: ShareType`、`itemIds?: number[]`、`title: string`；emit：`update:show` |
| `SortableHeader.vue` | 表头排序下拉（默认/升序/降序），高亮当前排序状态 | props：`label: string`、`sortByKey: string`、`sortBy: string \| null`、`sortOrder: 'asc' \| 'desc' \| null`；emit：`select` |
| `HazardFormModal.vue` | 隐患登记 / 编辑弹窗（新增与编辑共用，删除入口在页脚左下角，责任人由责任单位只读联动） | props：`show: boolean`、`hazardId?: number \| null`（默认 null，null 为新增）；emits：`update:show`、`saved` |
| `HazardLevelTag.vue` | 隐患等级标签（一般隐患 / 重大隐患），色值取自 `hazardLevelTypes` | props：`level: HazardLevel` |
| `HazardStatusTag.vue` | 整改状态标签（待整改 / 整改受阻 / 已整改），色值取自 `hazardStatusTypes` | props：`status: HazardStatus` |
| `LedgerItemFormModal.vue` | 台账记录新增 / 编辑弹窗（标签多选树 + 图片上传，删除入口在页脚） | props：`show: boolean`、`itemId?: number \| null`（默认 null，null 为新增）；emits：`update:show`、`saved` |
| `LedgerTagFormModal.vue` | 标签新增 / 编辑弹窗（上级标签选择、备注、图片；新增子标签时预填上级） | props：`show: boolean`、`tag?: LedgerTag \| null`、`parentId?: number \| null`、`tags: LedgerTag[]`；emits：`update:show`、`saved` |
### Composable 清单
`web/src/composables/` 下 6 个 `.ts`（不含 `.spec.ts`），全部为函数式组合式 API：

| Composable | 职责 | 关键返回项 | 典型使用位置 |
| --- | --- | --- | --- |
| `usePagedTable.ts` | 统一列表分页/加载/筛选/URL 同步：`load/query/changePage/changePageSize/resetFilters`，可选 `rollbackEmptyPage` 防空页回退、`paginated: false` 全量拉取、`urlSync` 把 page/page_size/筛选写回 URL | `items`、`total`、`page`、`pageSize`、`loading`、`filters`、`pageSizeOptions`、`load`、`query`、`changePage`、`changePageSize`、`resetFilters`、`syncRoute` | 18 个列表页（仓库 5、申购 5、设置 4、隐患 3、台账 1） |
| `useExportJob.ts` | 异步导出任务轮询：提交 → 轮询到 `SUCCEEDED`/`FAILED`（默认 1500ms 间隔），失败抛 `AppError` | `running`、`run(payload)` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useImportJob.ts` | 异步导入任务轮询：同样的提交+轮询流程，带同步重入保护（重复提交抛 `IMPORT_IN_PROGRESS`），成功返回 `result` | `running`、`run(file)` | `HuaXingStockView`、`SecondaryWarehouseLiteView`、`MaterialCodeLibraryView` |
| `useImportConfirm.ts` | 全量更新导入的确认弹窗：确认后立刻禁用按钮并切换进行中文案，防重复提交（`maskClosable/closeOnEsc` 均为 false），错误交给 `onError` | 返回 `confirmImport(options)` 函数 | 同上三个导入页面 |
| `useImplicitAiSearch.ts` | 隐式 AI 搜索：用户显式展开关键词优先，源输入变化时自动清除展开值 | `searchName`、`applyExpandedName(value)`、`clearExpandedName()` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useShiftWheelHorizontalScroll.ts` | 在表格滚动容器上支持 Shift+滚轮横向滚动 | 无返回值（内部挂/卸 `wheel` 监听，`passive: false`） | 申购 3 个列表页 |



### 其它 src 子目录
#### `web/src/utils/`
| 文件 | 职责 |
| --- | --- |
| `decimal.ts` | Decimal 字符串处理：**前端数量/库存全部用字符串而不是 number**，避免浮点误差与后端 `Decimal` 精度丢失。导出 `isDecimalString(value, decimalPlaces = 1, allowZero = false)`（正则 `^\d+(?:\.\d)?$` + 小数位/整数位上限 + 是否允许 0）、`decimalPlacesOf`、`normalizeDecimal`、`compareDecimal`、`subtractDecimal`，内部用 `BigInt` 对齐小数位比较与相减 |
| `download.ts` | Blob/URL 下载、`exportDownloadUrl(fileUuid)`、解析 `Content-Disposition` 文件名、`downloadBlobWithDisposition` |
| `image.ts` | 图片类型/大小校验（允许 `image/jpeg`/`png`/`webp`，上限 10MB）、`configureImageBaseUrl`、`imageUrl`、`imagePreviewUrl` |
| `memoDrafts.ts` | 备忘录未保存草稿的 IndexedDB 暂存：按 `${userId}:${memoId}` 隔离，不可用时静默降级为无操作，另有 `hasPendingDraft` |
| `memoFontSize.ts` | 备忘录编辑区字号偏好（`localStorage` key `memos.font-size`，档位 `14/16/18/20/24`，默认 16px）：`MEMO_FONT_SIZE_OPTIONS`、`normalizeMemoFontSize`、`readMemoFontSize`、`writeMemoFontSize`；非法 / 越界值回落默认且不写回脏值，存储不可用时静默降级 |
| `themeMode.ts` | 界面外观偏好（`localStorage` key `theme.mode`，档位 `auto` / `light` / `dark`，默认 `auto`）：`THEME_MODE_OPTIONS`、`normalizeThemeMode`、`readThemeMode`、`writeThemeMode`；非法值回落 `auto` 且不写回脏值，存储不可用时静默降级。`index.html` 的首屏预置脚本用同一套 key 与档位规则 |
| `purchase.ts` | 申购默认值辅助：`defaultPurchaseOrderNo`、`getLastPurchaseResponsible`、`rememberPurchaseResponsible`（本地记住上次填写人） |
| `routeQuery.ts` | 路由 query 读写辅助：`routeQueryString`、`routeQueryPositiveInteger`、`compactRouteQuery`（压缩空值） |
| `settings.ts` | `inventoryModeOptionsFor(secondaryWarehouseMode)`：精简模式下不提供「可读写」选项 |
| `tableRowNavigation.ts` | `createTableRowClickGuard()`：区分行点击与行内按钮/选择交互，避免误跳转 |
| `tableText.ts` | `renderTwoLineText(primary, secondary)`：表格单元格两行文本渲染 |
| `time.ts` | 时间格式化（东八区）：`formatShanghaiTime`、`toIsoWithTimezone`、`toShanghaiDate`、`formatDate`、`dateToTimestamp`（空值返回 null，避免日期选择器默认成今天） |
| `ledger.ts` | 台账标签纯逻辑：`parseTagIds` / `formatTagIds`（`tag_ids` 逗号串与数组互转）、`isOrphanTag`（孤立标签判定）、`tagPath`（完整层级路径）、`collectSubtreeIds`（节点自身 + 全部子孙，改上级时排除可选父节点）、`buildLedgerTagTree`（扁平标签 → 横向树，返回全新对象）、`tagSelectOptions` / `tagParentOptions`（标签选择器与上级选择器选项，后者支持按节点排除子树）、`tagColumnDisplay`（标签列展示切片）、`ledgerQuery` / `ledgerFiltersFromQuery`（筛选与 URL 同步） |
#### `web/src/constants/`、`types/`、`config/`
| 文件 | 职责 |
| --- | --- |
| `constants/branding.ts` / `constants/purchase.ts` | `LOGO_URL = '/logo.png'`；申购默认值/选项：`defaultPurchasePlanStatus`、`purchasePlanStatusOptions`、`defaultDemandDepartment`、`defaultPurchaseUrgency`、`purchaseUrgencyOptions`、`purchaseCategoryOptions` |
| `constants/shareColumns.ts` | 分享页可展示列定义（键名与后端 Literal 严格一致）：`SHARE_PLAN_COLUMNS`、`SHARE_RECORD_COLUMNS`、`shareColumnOptions()`、`SHARE_DEFAULT_HIDDEN_KEYS = ['status']`、`defaultShareColumnKeys()`，供 `ShareView` 渲染与 `ShareLinksView` 勾选共用 |
| `constants/table.ts` | `tableColumnWidths`（unit/quantity/date/datetime/status/person/code/identifier/name/material/model/text/action）、`preventTableColumnCompression`、`getTableScrollX` |
| `types/navigation.ts` | `Permission` 字面量联合（`warehouse:write`、`purchase:write`、`settings:write`、`hazard:write`、`ledger:write`、`read`）、`rolePermissions: Record<Role, Permission[]>`、`roleLabels: Record<Role, string>` |
| `types/export.ts` / `config/env.ts` | `ExportOption = DropdownOption & { label: string; key: string }`；VITE_* 解析（见 API 客户端一节的 baseURL 说明） |
| `theme.ts` | Naive UI `themeOverrides`（主题色 `#3f63d8`、圆角与阴影等），由 `App.vue` 传给 `n-config-provider` |
| `styles.css` | 全局样式与 CSS 变量：字体栈、`--color-primary/-success/-warning/-danger`、文本/边框/表面色、`--radius-control`、局部加载遮罩底色等 |
#### `web/src/layouts/`
页面文件与职责见「路由表」的职责列。`layouts/AppLayout.vue` 是唯一布局：`n-layout` + 侧边菜单（`menuOptions` 由 `auth.can()`、`settings.isLiteMode` 动态拼装：工作台、备忘录、二级库分组或精简二级库、华星总库存、申购管理、系统管理），顶栏含用户信息与下拉（「外观」二级菜单：悬浮父项向左展开自动/浅色/深色三档，另有「退出登录」调 `auth.logout()` + 跳 `login`；顶栏不放独立的明暗切换图标）；`useMediaQuery('(max-width: 768px)')` 时侧栏切换为抽屉。




### 联调与 Mock
前端不再内置模拟数据：`npm run dev` 默认打 `/api/v1`，由 Vite 代理（`VITE_API_PROXY`，缺省
`http://localhost:8000`）转发到本地后端。要连 Mock 服务，把 `VITE_API_BASE_URL` 直接指向
[Apifox Mock 环境](/api)（演示站的构建参数见 `web/.env.demo`），请求不再经过代理。

| 场景 | 配置 | 说明 |
| --- | --- | --- |
| 本地后端 | 不配（缺省）或 `VITE_API_PROXY=http://localhost:8000` | 走 Vite 同源代理 |
| Apifox Mock | `VITE_API_BASE_URL=https://m1.apifoxmock.com/m1/•••/api/v1` | 直连 Mock，读写都作用于 Mock |
| 线上后端 | `VITE_API_BASE_URL=https://api.example.com` | 只填域名时自动补 `/api/v1` |

Mock 数据由 `docs/openapi.yaml` 的响应示例（`responses.*.content.application/json.example`，
由 `server/scripts/openapi_examples.py` 生成）决定，后端不参与；没有响应示例的接口会降级到
Apifox 智能 Mock，按字段名自己编数据（见 [/api](/api)）。

### 构建与代理
| 项 | 值（`web/vite.config.ts`） |
| --- | --- |
| 插件 | `@vitejs/plugin-vue`、`unplugin-vue-components` + `NaiveUiResolver()`（Naive UI 组件自动按需引入，产物清单写入 `web/components.d.ts`） |
| alias | `@` → `web/src` |
| 全局常量 | `define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) }` |
| 构建产物 | `build.assetsDir: 'yangrucheng-assets'`（静态资源目录名，与 `web/edgeone.json` 的缓存规则对应） |
| dev server | `server.port: 5173` |
| 代理 | `npm run dev` 始终启用 `{ '/api': env.VITE_API_PROXY \|\| 'http://localhost:8000' }`；`VITE_API_BASE_URL` 填完整地址时不经过代理 |

| 文件 | 说明 |
| --- | --- |
| `web/vitest.config.ts` | 独立于 `vite.config.ts`：`environment: 'jsdom'`、`setupFiles: ['./src/test/setup.ts']`、同样的 `@` alias 与 `__BUILD_TIME__` |
| `web/tsconfig.json` | 空 `files`，只做 project references（`tsconfig.app.json`、`tsconfig.node.json`） |

| 文件 | 关键项 |
| --- | --- |
| `web/tsconfig.app.json` | 继承 `@vue/tsconfig/tsconfig.dom.json`；`paths: { "@/*": ["src/*"] }`；`types: ["vitest/globals"]`；`strict`、`noUnusedLocals`、`noUnusedParameters` 均为 true；`include` 覆盖 `src/**/*.ts\|tsx\|vue` |
| `web/tsconfig.node.json` | 覆盖 `vite.config.ts`、`vitest.config.ts`、`eslint.config.js`；`moduleResolution: Bundler`、`verbatimModuleSyntax`、`noEmit`、`strict` |
环境变量：`web/.env.example` **不存在**，模板在 `docs/env/frontend.env.example`，变量声明见 `web/src/env.d.ts`。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 接口基础地址，缺省 `/api/v1`；只填域名时自动补 `/api/v1` |
| `VITE_IMAGE_BASE_URL` | 图片读取前缀，缺省为 `VITE_API_BASE_URL/files/images` |
| `VITE_API_PROXY` | **仅供 `npm run dev` 的 Vite 代理目标**，生产构建不读取 |
这些值在**构建阶段**被写入静态产物，部署后改环境变量无效，需重新构建（详见 [前后端分离部署](/guide#前后端分离部署)）。
### 部署
| 项 | 内容 |
| --- | --- |
| 构建变量与跨域/CDN | 见 [前后端分离部署](/guide#前后端分离部署) |
| `web/Dockerfile` | 两阶段：`node:22-alpine` 执行 `npm ci` + `npm run build`（`ARG VITE_API_BASE_URL=/api/v1` 经 `ENV` 注入），再用 `nginx:1.27-alpine` 托管 `/app/dist`；`EXPOSE 80`，健康检查 `wget -q --spider http://127.0.0.1/` |
| `web/nginx.conf` | `location /api/` 反代到 `http://backend:8000`（带 `X-Real-IP`/`X-Forwarded-*`，`proxy_read_timeout 60s`）；`location /` 用 `try_files $uri $uri/ /index.html` 支持 history 路由；静态资源（js/css/图片/字体）7 天 `immutable` 缓存；`client_max_body_size 50m` |
| `web/edgeone.json` | 静态托管的输出目录 `dist` 与 `/yangrucheng-assets/*`、`*.png`、`*.jpg` 的 14 天缓存头 |



</TabsContent>

<TabsContent id="backend">

FastAPI + SQLAlchemy 2.x async 单进程应用（MySQL 8.0 / asyncmy），源码在 `server/`，包名 `app`。

| 入口 | 路径 |
| --- | --- |
| 管理端 REST | `/api/v1/*` |
| 微信小程序 | `/api/v1/mini-program/*` |
| MCP（Streamable HTTP） | `/api/v1/mcp` |

运行：开发 `uvicorn app.main:app --reload`；容器 CMD `uvicorn app.main:app --host 0.0.0.0 --port 8000`（`server/Dockerfile`）。同一进程内还有若干常驻后台 worker。
## 分层架构
分层调用方向为 `api → service → repository → models`，service 之间也可互相调用（如 `inventory_service` 调用 `webhook_service`）；`from app.repositories` 只在 `server/app/services/` 下命中，api 层不直接访问仓储层。

| 层 | 目录/文件 | 职责 |
| --- | --- | --- |
| 路由层 | `server/app/api/v1/*.py`、`server/app/api/deps.py` | 参数解析与校验（`Query(ge=1, le=200)`、`max_length`、`Literal["asc","desc"]`）、依赖注入取当前用户/权限、把 service 结果转成 `Page[...]` 等响应模型、抛 `AppError` 表达参数类错误 |
| 服务层 | `server/app/services/*.py` | 业务规则与状态流转校验、乐观锁校验（`common.validate_version`）、事务边界（显式 `await session.commit()`）、审计事件（`common.log_event`）、read 模型组装、后台任务编排 |
| 仓储层 | `server/app/repositories/*.py` | **只承载纯 SELECT 查询（含 `with_for_update` 锁定查询），不抛业务错误、不组装 read、不自建 session**；可排序列白名单字典也定义在这里 |
| 模型层 | `server/app/models/__init__.py` | 唯一的 ORM 声明文件（表名/列/约束/索引）；`docs/references/database/init.sql` 与其一致，由 `server/tests/test_init_sql.py` 校验 |
| 模型契约层 | `server/app/schemas/__init__.py`、`server/app/domain/enums.py` | pydantic 请求/读模型、`Page[T]`、`ApiError`；领域枚举（`Role`、`OperationType`、`SourceType`、`PurchasePlanStatus` 等） |
| 核心层 | `server/app/core/*.py` + `main.py`、`mcp_server.py` | 配置、引擎/会话、认证与权限、错误码与异常处理器、中间件、日志、常量、UUIDv7 生成、微信凭据 |
## 后端目录结构
`server/app/` 共 79 个 Python 文件：

```text
server/app/
├── main.py             # FastAPI 实例、lifespan（启动清理 + worker）、/health、router 与 MCP 挂载
├── mcp_server.py       # MCP 服务与 4 个工具、McpTokenAuthMiddleware
├── api/deps.py         # PageNo/PageSize/SortOrder/OrSearch/RequireFullSecondaryWarehouse
├── api/v1/__init__.py  # 汇总 router，统一声明错误响应模型
├── api/v1/             # 21 个模块：ai_search、auth、dictionaries、excel_export_jobs、files、hazards、
│                       #   huaxing_inventory、inventory、ledger、material_code_library、memos、mini_program、
│                       #   purchase_materials、purchase_plan_templates、purchase_record_sync、purchase_requests、
│                       #   secondary_warehouse、share、stock_materials、system_settings、version
├── core/               # config（Settings，env 前缀 APP_）、constants、database（Base/engine/SessionLocal/get_db）、
│                       #   db_timing、errors、exception_handlers、identifiers（uuid7_string）、logging、middleware、
│                       #   permissions（认证/角色/接口令牌/If-Match）、security（JWT/argon2/Fernet）、wechat
├── domain/enums.py
├── models/__init__.py
├── repositories/       # 7 个：dashboard_repository、hazard_repository、inventory_repository、
│                       #   ledger_repository、material_repository、purchase_plan_template_repository、
│                       #   purchase_request_repository
├── schemas/__init__.py
└── services/           # 26 个：ai_search、attachment_cleanup、common（utcnow/分页/OR 搜索/乐观锁/审计/文件 read 等共用件）、
                        #   dashboard、dictionary、excel_export_job、excel_export、file、hazard、huaxing_inventory、
                        #   import_file_reader、import_job、inventory、ledger、lite_inventory、material_code_library、
                        #   material、memo、mini_program、purchase_plan_cleanup、purchase_plan_template、
                        #   purchase_record_sync、purchase_request、replenishment、share_link、webhook
```


### 认证与权限
#### 角色与依赖注入器（`server/app/core/permissions.py`、`server/app/domain/enums.py`）
| 名称 | 定义 | 说明 |
| --- | --- | --- |
| `Role` | `SUPER_ADMIN` / `WAREHOUSE_ADMIN` / `PURCHASE_ADMIN` / `HAZARD_ADMIN` / `LEDGER_ADMIN` / `READ_ONLY` | 六值 `StrEnum`，存 `user.role` |
| `require_roles(*roles)` | 工厂函数 | 角色不在集合内抛 `FORBIDDEN`（403） |
| `CurrentUser` | `depends(get_current_user)` | 管理端用户（Bearer JWT 或 `X-API-Token`） |
| `WarehouseWriter` | `require_roles(SUPER_ADMIN, WAREHOUSE_ADMIN)` | 库存写操作 |
| `PurchaseWriter` | `require_roles(SUPER_ADMIN, PURCHASE_ADMIN)` | 申购写操作 |
| `HazardWriter` | `require_roles(SUPER_ADMIN, HAZARD_ADMIN)` | 隐患管理写操作（台账与两张字典表） |
| `LedgerWriter` | `require_roles(SUPER_ADMIN, LEDGER_ADMIN)` | 台账管理写操作（台账记录与标签） |
| `SuperAdmin` | `require_roles(SUPER_ADMIN)` | 系统配置、用户、文件治理 |
| `CurrentMiniProgramUser` | `depends(get_current_mini_program_user)` | 小程序用户；未审核（`enabled=False`）抛 `ACCOUNT_DISABLED`（403） |
| `MiniProgramRegistrationOpenId` | `depends(get_mini_program_registration_openid)` | 返回 `(app_id, openid)`，供注册/绑定用 |
| `DbSession` | `depends(get_db)` | 请求级 `AsyncSession` |
| `RequireFullSecondaryWarehouse` | `depends(_require_full_secondary_warehouse)` | 二级库精简模式下拦截写接口，抛 `SECONDARY_WAREHOUSE_LITE_MODE`（403） |
| `IfMatchVersion` | `depends(get_if_match_version)` | 从 `If-Match` 头读乐观锁版本 |
各接口模块使用的权限/身份依赖与路由数：

| 模块 | 权限/身份依赖 | 路由数 |
| --- | --- | --- |
| `api/v1/auth.py` | `CurrentUser` | 3 |
| `api/v1/ai_search.py` | `SuperAdmin`、`CurrentUser` | 5 |
| `api/v1/system_settings.py` | `SuperAdmin` | 5 |
| `api/v1/dictionaries.py` | `SuperAdmin` | 5 |
| `api/v1/files.py` | `SuperAdmin`、`FileWriter`（含 `HAZARD_ADMIN`、`LEDGER_ADMIN`） | 5 |
| `api/v1/inventory.py` | `CurrentUser`、`WarehouseWriter`、`RequireFullSecondaryWarehouse` | 12 |
| `api/v1/stock_materials.py` | `CurrentUser`、`WarehouseWriter`、`RequireFullSecondaryWarehouse`、`IfMatchVersion` | 8 |
| `api/v1/secondary_warehouse.py` | `CurrentUser`、`WarehouseWriter` | 4 |
| `api/v1/huaxing_inventory.py` | `CurrentUser`、`WarehouseWriter` | 5 |
| `api/v1/material_code_library.py` | `CurrentUser`、`PurchaseWriter` | 5 |
| `api/v1/memos.py` | `CurrentUser` | 4 |
| `api/v1/purchase_materials.py` | `CurrentUser`、`PurchaseWriter`、`IfMatchVersion` | 14 |
| `api/v1/purchase_plan_templates.py` | `CurrentUser`、`PurchaseWriter`、`IfMatchVersion` | 7 |
| `api/v1/purchase_requests.py` | `CurrentUser`、`PurchaseWriter`、`IfMatchVersion` | 7 |
| `api/v1/purchase_record_sync.py` | `PurchaseWriter` | 4 |
| `api/v1/hazards.py` | `CurrentUser`、`HazardWriter`、`IfMatchVersion` | 13 |
| `api/v1/ledger.py` | `CurrentUser`、`LedgerWriter`、`IfMatchVersion` | 9 |
| `api/v1/share.py` | `CurrentUser` | 5 |
| `api/v1/excel_export_jobs.py` | `CurrentUser` | 2 |
| `api/v1/mini_program.py` | `CurrentMiniProgramUser`、`SuperAdmin`、`MiniProgramRegistrationOpenId`、`IfMatchVersion` | 32（管理端 4 + 小程序 28） |
| `api/v1/version.py` | 无（公开） | 1 |
#### 接口令牌（`X-API-Token`）与双列存储
| 项 | 规则 |
| --- | --- |
| 取用顺序 | `APIKeyHeader(name="X-API-Token")`；`authenticate_management_user` 依次尝试 `X-API-Token` → Bearer 值（长度 ≤ 36 时先按接口令牌试）→ 按 JWT 解析 |
| 查找 | 令牌为 36 位；`find_user_by_api_token` 先用 `len(api_token) != 36` 快速排除，再按 `sha256` 命中 `user.api_token_hash` |
| 懒迁移回写 | 命中且 `user.api_token_enc` 为空时，用该明文令牌 `encrypt_secret()` 回写密文再 `flush()`，使管理界面之后可解密回显（`api_token_hash` 认证 + `api_token_enc` 可逆回显双列） |
| MCP 入口 | `McpTokenAuthMiddleware` 同样走 `find_user_by_api_token`，取令牌顺序 `?token=` → `X-API-Token` → `Authorization: Bearer`，并 `commit()` 持久化懒迁移结果 |
#### JWT `token_type` 取值（`server/app/core/security.py` 生成，`permissions.py` / `api/v1/auth.py` 校验）
| `token_type` | 生成函数 | 有效期 | 校验点 |
| --- | --- | --- | --- |
| `management_access` | `create_access_token` | `APP_ACCESS_TOKEN_MINUTES`（默认 30 分钟） | `authenticate_management_user`，同时兼容历史值 `management` 与缺失 |
| `management_refresh` | `create_refresh_token` | `APP_REFRESH_TOKEN_DAYS`（默认 7 天），带 `version` 声明 | `api/v1/auth.py` 续期接口 |
| `mini_program` | `create_mini_program_access_token` | `APP_ACCESS_TOKEN_MINUTES` | `get_current_mini_program_user` |
| `mini_program_registration` | `create_mini_program_registration_token` | 固定 10 分钟，带 `app_id` 声明 | `get_mini_program_registration_openid` |
三类凭据互不通用；注册令牌只能用于绑定/注册接口（`token_type` 不匹配即 `INVALID_TOKEN`）。
#### 乐观锁版本（`If-Match`）
所有带乐观锁的写操作（PATCH/PUT/DELETE/restore）版本号放 `If-Match` 头而非 query 参数，**避免版本号进入访问日志**（`permissions.get_if_match_version`）；缺失或非整数时返回 `None`，由 service 决定是否强制（`common.validate_version` → `VERSION_CONFLICT`，`details` 带 `expected`/`actual`）。



#### 角色、权限点与能力

`Role`（`server/app/domain/enums.py`）只有一个字段一个角色，无多角色组合；权限点为 `web/src/types/navigation.ts` 的 `rolePermissions`。

| 角色 | 权限点 | 能力 |
| --- | --- | --- |
| `SUPER_ADMIN` 超级管理员 | `warehouse:write`、`purchase:write`、`settings:write`、`hazard:write`、`ledger:write`、`read` | 全部能力：二级库物资增删改与安全库存、入库/出库/修改流水/冲销、精简二级库 Excel 导入、申购计划增删改与补录编码、关联二级库物资、转入/恢复申购记录与批量修改、采购跟踪同步回写、物料编码库导入与查询、查询已归档计划（`status=ARCHIVED`）、管理端用户/接口令牌/小程序用户合并、高级设置（AI 搜索、精简模式、小程序功能模式、Webhook）、图片孤儿文件排查清理、隐患台账与隐患类型/责任单位维护、台账记录与标签维护、创建/撤回分享链接、创建导出任务 |
| `WAREHOUSE_ADMIN` 仓库管理员 | `warehouse:write`、`read` | 二级库物资增删改与安全库存、入库/出库/修改流水/冲销、精简二级库 Excel 导入、创建/撤回分享链接、创建导出任务；其余只读 |
| `PURCHASE_ADMIN` 申购管理员 | `purchase:write`、`read` | 申购计划增删改与补录编码、关联二级库物资、转入/恢复申购记录与批量修改、采购跟踪同步回写、物料编码库导入与查询、创建/撤回分享链接、创建导出任务；其余只读 |
| `HAZARD_ADMIN` 隐患管理员 | `hazard:write`、`read` | 隐患台账增删改、隐患类型与责任单位维护、隐患图片上传；其余只读 |
| `LEDGER_ADMIN` 台账管理员 | `ledger:write`、`read` | 台账记录增删改、标签树维护（至多 3 层）与标签图片上传；其余只读 |
| `READ_ONLY` 只读角色 | `read` | 工作台、备忘录、华星总库存、库存/流水查询、隐患台账查询、台账总览查询、创建/撤回自己的分享链接、创建导出任务 |

#### 越权结果

| 越权场景 | 结果 | 实现 |
| --- | --- | --- |
| 写接口权限不足 | `403 FORBIDDEN` | `core.permissions.require_roles` |
| 查询已归档申购计划 | `403 ARCHIVED_PURCHASE_PLAN_FORBIDDEN` | `api/v1/purchase_materials.py` |
| 精简模式下调用完整模式写接口 | `403 SECONDARY_WAREHOUSE_LITE_MODE` | `api/deps._require_full_secondary_warehouse` |

前端按 `auth.can(permission)` 隐藏入口（`layouts/AppLayout.vue`、`router/index.ts` 的 `meta.permission`），**权限的最终判定在后端**。

### 错误处理与响应头
#### 错误码 → 默认 HTTP 状态码（`server/app/core/errors.py`）
`AppError(code, message, status_code=None, details=None)`：显式传 `status_code` 时以显式值为准，否则查下表；表中没有的 code 兜底为 `400`。

| code | 默认 HTTP | code | 默认 HTTP |
| --- | --- | --- | --- |
| `NOT_FOUND` | 400 | `ACCOUNT_DISABLED` | 403 |
| `VERSION_CONFLICT` | 409 | `FORBIDDEN` | 403 |
| `INVALID_STATUS_TRANSITION` | 409 | `INVALID_TOKEN` | 401 |
| `DATA_CONFLICT` | 409 | `UNAUTHORIZED` | 401 |
| `VALIDATION_ERROR` | 422 | `USER_DISABLED` | 401 |
| `DUPLICATE_HAZARD_UNIT` | 409 | `DUPLICATE_HAZARD_TYPE` | 409 |
| `HAZARD_UNIT_IN_USE` | 409 | `HAZARD_TYPE_IN_USE` | 409 |
| `HAZARD_UNIT_PERSON_REQUIRED` | 400 | — | — |
错误响应体统一为 `{code, message, details, request_id}`（`exception_handlers.error_response`），`request_id` 取 `request.state.request_id`。全量业务错误码清单见 [/api-error-codes](/api-error-codes)，约定背景见 [接口约定](/api-conventions)。
#### 全局异常处理器（`register_exception_handlers`）
| 注册的异常类型 | handler | 返回 code / status |
| --- | --- | --- |
| `AppError` | `handle_app_error` | 用异常自身的 `code` 与 `status_code`；`details` 原样透出 |
| `StarletteHTTPException` | `handle_http_exception` | 原状态码为 404 时重映射为 `400 ROUTE_NOT_FOUND`；其余原状态码 + `HTTP_ERROR` |
| `RequestValidationError` | `handle_validation_error` | `422 VALIDATION_ERROR`，`details.errors` 为 pydantic 错误列表 |
| `IntegrityError` | `handle_integrity_error` | `409 DATA_CONFLICT`（`logger.warning` + 堆栈） |
| `ProgrammingError` | `handle_database_programming_error` | `500 DATABASE_QUERY_ERROR` |
| `OperationalError` / `InterfaceError` / `DisconnectionError` / `SQLAlchemyTimeoutError` | `handle_database_unavailable` | 若 `exc.orig.args[0]` 落在 MySQL 查询错误码集合（1052/1054/1064/1066/1109/1146）→ `500 DATABASE_QUERY_ERROR`，否则 `503 DATABASE_UNAVAILABLE` |
| `SQLAlchemyError` | `handle_database_error` | `500 DATABASE_ERROR` |
| `Exception` | `handle_unexpected_error` | `500 INTERNAL_SERVER_ERROR`（`logger.exception`） |
禁止 HTTP 404：资源不存在时 service 用 `errors.not_found(resource)` → `400 NOT_FOUND`（message「<资源>不存在」）；未匹配路由由 `handle_http_exception` 改为 `400 ROUTE_NOT_FOUND`（message「接口路径不存在」）；后端对外不产生 404，文件类接口同样遵循。
#### 中间件与性能响应头（`server/app/core/middleware.py`）
`request_context` 为每个请求注入 `request_id`（取 `X-Request-ID`，截断到 128 字符，否则 `uuid4`）并写访问日志；响应头均只计量服务端时间。

| 响应头 | 含义 |
| --- | --- |
| `X-Request-ID` | 本次请求标识，与日志 `request_id` 一致 |
| `X-Response-Time` | 服务端处理总耗时（毫秒），`time.perf_counter()` 从进入中间件到生成响应 |
| `X-DB-Time` | 数据库语句执行耗时合计（毫秒），取 `min(采集值, 总耗时)` |
| `X-Compute-Time` | `总耗时 - DB 耗时`（毫秒），含校验/权限/序列化 |
| `X-DB-Queries` | 本次请求执行的 SQL 条数，用于识别 N+1 |
这 5 个头（加 `Content-Disposition`）都在 `RefererCORSMiddleware._expose_headers` 中，跨域时通过 `Access-Control-Expose-Headers` 暴露。

| 中间件 | 规则 |
| --- | --- |
| `RealIPMiddleware` | 把 `scope["client"]` 改写为可信边缘代理给出的真实 IP，取值优先级 `EO-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For` 的第一段；候选值需能被 `ipaddress.ip_address()` 解析，全部无效则不改写 |
| `RefererCORSMiddleware` | **Referer 优先**（兼容不发 `Origin` 的内嵌 WebView/微信），无效或缺失回退 `Origin`；`Referer: null` 原样返回 `null`。白名单为空表示不限制；否则需 `origin` 精确命中、或 `*`、或 `allowed` 以 `.` 开头时按 host 后缀匹配（`.example.com` 匹配 `app.example.com`）；未命中不回显 CORS 头。预检（`OPTIONS` + `Access-Control-Request-Method`）直接 200，方法白名单 `DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT`，回显请求的 `Access-Control-Request-Headers`，`Access-Control-Request-Private-Network: true` 时回私有网络头；正常响应补 `Vary: Origin, Referer` |
注册顺序（`main.py`，后注册的中间件更外层）：`RefererCORSMiddleware` → `project_context` → `request_context` → `RealIPMiddleware`；即最外层 `RealIPMiddleware`，最内层 CORS，`request_context` 位于 RealIP 内层以便读到改写后的真实 IP，`project_context` 在 `request_context` 内层、业务处理之前把 `X-Project-Id` 落进项目上下文。



### 项目隔离（`server/app/core/project_scope.py`）

业务数据按项目隔离，但**不是**多租户：没有用户-项目授权表，任何登录用户都能访问全部项目，只是同一请求只能处于一个项目。隔离在 ORM 层统一实现，service 里不再逐个写过滤条件。

| 机制 | 实现 |
| --- | --- |
| 读过滤 | `Session` 的 `do_orm_execute` 事件：语句里出现项目域表时，用 `with_loader_criteria` 给这些实体注入 `project_id = 当前项目`；SQLAlchemy 会把它带到所有出现该实体的位置（子查询、别名、`select(func.count())` 聚合、`Session.get()` 的按主键加载、ORM 的 `UPDATE` / `DELETE`） |
| 写守卫 | `Session` 的 `before_flush` 事件：新建的项目域对象自动补 `project_id`；与当前项目不一致的写入/删除直接抛 `PROJECT_MISMATCH`(409) |
| 语句识别 | 用 `sqlalchemy.sql.util.find_tables()` 判断语句是否涉及项目域表（约 5–20µs）；纯全局语句（`user`、`project`、`system_setting` 等）不参与过滤，因此登录、项目列表不需要项目上下文 |
| fail-closed | 涉及项目域表却没有项目上下文时抛 400 `PROJECT_REQUIRED`，绝不静默放行成「看到全部项目」；确实跨项目的系统级入口必须显式 `system_scope()` |
| 缓存安全 | `with_loader_criteria` 的项目 id 以**闭包变量**传入（lambda SQL 不允许在 lambda 内调用函数）；SQLAlchemy 把闭包值计入缓存键，项目切换会重新编译，不会串用别的项目的条件 |

```mermaid
flowchart LR
    H["请求头 X-Project-Id"] --> M["project_context 中间件：落进 ContextVar"]
    M --> D["业务路由依赖 require_current_project：校验项目存在且启用"]
    D --> ORM["do_orm_execute：注入 project_id 条件"]
    D --> F["before_flush：补项目 / 拦跨项目写入"]
    ORM --> DB[("MySQL")]
    F --> DB
```

项目域表清单在 `server/app/models/__init__.py` 的 `PROJECT_SCOPED_MODELS`（28 张），列/索引/外键由 `ProjectScoped` 混入统一下发；新增业务表必须同时继承 `ProjectScoped` 并登记进该元组，否则不会被隔离（`AGENTS.md` 已写成约定）。

上下文来源：

| 入口 | 项目从哪来 |
| --- | --- |
| 网页端业务接口 | `X-Project-Id`（前端 `web/src/api/client.ts` 统一注入；右上角切换项目后整页刷新） |
| 小程序 | 同上；不带时落默认项目（`get_current_mini_program_user` 内统一解析，端点无需各自声明） |
| MCP | 请求头优先，缺省用默认项目；`operation_call` 转发时带上项目头 |
| 匿名分享页 | 先在全项目上下文里按 token 取 `share_link`，再切到该分享所属项目读数据 |
| 导入 / 导出任务 | 任务行记录 `project_id`，后台任务用 `project_scope(job.project_id)` 恢复上下文 |
| 清理任务、附件引用统计、匿名导出下载 | 显式 `system_scope()` / `system_session()`（这些入口本就不属于单个项目） |

### 数据库会话与事务
| 项 | 真实配置（`server/app/core/database.py`） |
| --- | --- |
| engine | `create_async_engine(settings.database_url, pool_pre_ping=True)`；`database_url` 以 `sqlite+aiosqlite:///:memory:` 开头时改用 `StaticPool` |
| 连接池 | 未显式设置 `pool_size`/`max_overflow`/`pool_recycle`/`connect_args`，使用 SQLAlchemy 默认 |
| 会话工厂 | `async_sessionmaker(engine, expire_on_commit=False, autoflush=False)` |
| `Base` | `AsyncAttrs + DeclarativeBase`，`MetaData` 带命名约定（`ix_/uq_/ck_/fk_/pk_`） |
| SQL 计时 | 创建引擎后立即 `register_database_timing(engine)` |
`get_db` 依赖：`yield` 会话 → 正常路径 `await session.commit()` → 异常路径 `await session.rollback()` 并重新抛出。路由内的 service 调用默认由依赖收尾提交，需要「先落库再返回/再抛错」的 service 会自行提交：

| 自行提交的示例 | 说明 |
| --- | --- |
| `file_service` 上传 | 上传是独立事务，只有数据库记录真正提交后才返回成功；失败回滚并删除已写磁盘文件 |
| `excel_export_job_service._run_job`、`webhook_service`、`import_job_service.enqueue_import`、`share_link_service.cleanup_expired` | 同上，各自显式 `commit()` |
| 后台任务（worker、导入/导出子任务） | **不使用 `get_db`**，而是 `async with SessionLocal() as session:` 自建会话并自行 `commit()` |
| 并发控制 | 锁定查询在仓储层构造 `with_for_update()`（如 `inventory_repository` 的余额/流水查询，`inventory_service` 在写路径内调用）；申购计划清理用 `with_for_update(skip_locked=True)` 逐批抢锁 |
| 事务块 | 未使用 `async with session.begin()`（`session.begin` 仅命中 `material_service` 的 `session.begin_nested()` 保存点用法） |
#### DB 计时实现（`server/app/core/db_timing.py`）
| 阶段 | 行为 |
| --- | --- |
| 传递 | `contextvars.ContextVar` 携带 `DatabaseTiming(total_ms, statement_count)` |
| 请求开始 | `request_context` 调 `begin_database_timing()` |
| 响应前 | `finish_database_timing()` |
| SQL 计时 | SQLAlchemy `before_cursor_execute` / `after_cursor_execute` 入栈出栈 `perf_counter()`，出栈累加耗时并 `statement_count += 1` |
| 只统计请求内 SQL | 启动清理与常驻 worker 的 SQL 不计入；并发请求互不干扰 |
| 边界情况 | 请求内派生的后台任务会继承采集器（窗口极短） |



### 分页与排序约定
| 项 | 约定 |
| --- | --- |
| 响应模型 | 列表统一为 `Page[T]`（`server/app/schemas/__init__.py`）：`items` / `page` / `page_size` / `total` |
| 参数与常量 | 经 `server/app/api/deps.py` 注入：`PageNo = Query(ge=1)`、`PageSize = Query(ge=1, le=200)`；路由默认 `page=1`、`page_size=20`。`server/app/core/constants.py` 定义 `DEFAULT_PAGE_SIZE = 20`、`MAX_PAGE_SIZE = 200`，但 `server/app/api/deps.py` 直接写死 `le=200`，**这两个常量当前未被引用** |
| 通用实现 | `services/common.paginate()`：先 `select(func.count()).select_from(query.order_by(None).subquery())` 取 `total`，再 `offset((page-1)*page_size).limit(page_size)` 并 `unique()` 去重；`common.page_result()` 组装 `Page` |
| 导出上限 | `EXPORT_ROW_LIMIT = 10_000`：导出发起前以 `page_size=EXPORT_ROW_LIMIT + 1` 试探，超限抛 `VALIDATION_ERROR`（`details` 带 `total`/`limit`） |
| 排序参数 | `sort_by` + `sort_order`；`sort_order` 用 `deps.SortOrder`（`Literal["asc","desc"]`，默认 `"asc"`）；`sort_by` 类型随接口不同——申购计划/申购记录用 `Literal` 列名（`PurchasePlanResultColumn` 15 值、`PurchaseRecordResultColumn` 23 值），周期性计划用 `str \| None` |
| 排序列白名单 | 仓储层 `PURCHASE_MATERIAL_SORT_COLUMNS`、`PURCHASE_PLAN_TEMPLATE_SORT_COLUMNS`、`PURCHASE_RECORD_SORT_COLUMNS`（注释写明「防止任意属性注入」）；`sort_by` 不在白名单时回退默认排序，固定次级排序键 `id desc`（如 `purchase_plan_template_repository.search_templates`） |
| 关键词 OR 搜索 | `OrSearch`/`OrSearch128`/`OrSearch255` 用 `|` 或 `｜` 分隔，`common.contains_any` 生成 `OR ... contains(..., autoescape=True)` |
### 日志与 request_id
| 项 | 实现（`server/app/core/logging.py`） |
| --- | --- |
| 初始化 | `lifespan` 中 `configure_logging(settings.log_dir, settings.log_backup_count)` |
| 文件 | `<log_dir>/spare-parts-api.log`（默认 `server/data/logs/`），UTF-8，`when="midnight", interval=1, utc=False`，`suffix="%Y-%m-%d"` |
| 归档 | 自定义 `MonthlyTimedRotatingFileHandler` 把每天轮转出的文件放进 `YYYY-MM` 子目录，删除时跨目录按日期排序，`backupCount`（默认 90）控制保留份数 |
| 控制台与级别 | `StreamHandler(sys.stdout)`，未设置 `NO_COLOR` 时用 ANSI 彩色格式；控制台 handler 挂 `IgnoreHealthCheckFilter`（消息含 `/health` 则不输出），文件 handler 未过滤。root 级别 INFO 并清空既有 handler；`uvicorn`/`uvicorn.error` 清空自身 handler 改为向 root 传播，`uvicorn.access` 与 `httpx` 提到 WARNING，`logging.captureWarnings(True)` |
| logger 名 | 统一为 `spare_parts.api`（`main.py` 与各 core 模块） |
| 访问日志字段 | `method`、`path`、`status`、`elapsed ms`、`db=<ms>/<query 数>`、`compute=<ms>`、`client_ip`、`user`（`request.state.username`，未认证为 `anonymous`，小程序为 `mini:<id>`）、`request_id` |
| 敏感信息 | 访问日志不打印请求体、查询参数与请求头（`Authorization`/`X-API-Token` 均不出现）；乐观锁版本号刻意放 `If-Match` 头而非 query；代码中没有统一的字段级脱敏黑名单 |



### 配置项清单
| 项 | 值 |
| --- | --- |
| 配置类 | `core/config.py` 的 `Settings`，`SettingsConfigDict(env_file=BACKEND_DIR/".env", env_prefix="APP_", extra="ignore")` |
| 环境文件 | `server/.env` |
| 变量前缀 | `APP_`（字段名大写：`database_url` → `APP_DATABASE_URL`） |
| 单例 | `settings = get_settings()`（`@lru_cache`），导入时构造一次 |
| 必填字段 | 代码层没有必填字段（部署时由 compose 要求 `APP_DATABASE_URL`、`APP_JWT_SECRET`） |

| 字段 | 环境变量 | 类型 | 默认值 | 校验/说明 |
| --- | --- | --- | --- | --- |
| `app_name` | `APP_APP_NAME` | `str` | `电气车间备件管理系统` | FastAPI `title` |
| `environment` | `APP_ENVIRONMENT` | `str` | `development` | 启动日志打印；compose 设 `production` |
| `database_url` | `APP_DATABASE_URL` | `str` | `mysql+asyncmy://spare:spare@mysql:3306/spare_parts?charset=utf8mb4` | 引擎 DSN |
| `jwt_secret` | `APP_JWT_SECRET` | `str` | `change-me-in-production` | `min_length=16`，生产必须替换 |
| `jwt_algorithm` | `APP_JWT_ALGORITHM` | `str` | `HS256` | JWT 签名算法 |
| `access_token_minutes` | `APP_ACCESS_TOKEN_MINUTES` | `int` | `30` | `ge=1`；管理端与小程序访问令牌有效期 |
| `refresh_token_days` | `APP_REFRESH_TOKEN_DAYS` | `int` | `7` | `ge=1` |
| `fernet_key` | `APP_FERNET_KEY` | `str` | `""` | 为空时由 `jwt_secret` 派生（`server/app/core/security.fernet`），影响接口令牌/API Key 等密文可解密性 |
| `wechat_mini_program_app_id` | `APP_WECHAT_MINI_PROGRAM_APP_ID` | `str` | `""` | 多个 AppID 逗号分隔，顺序须与 secret 一致（`core/wechat.py` 校验数量与唯一性，否则 503） |
| `wechat_mini_program_app_secret` | `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | `str` | `""` | 同上，仅后端保存 |
| `upload_dir` | `APP_UPLOAD_DIR` | `Path` | `<server>/data/uploads` | 启动时 `mkdir(parents=True, exist_ok=True)`；图片与导出文件根目录 |
| `template_dir` | `APP_TEMPLATE_DIR` | `Path` | `<server>/app/templates` | Excel 导出模板目录（`excel_export_service` 读取） |
| `log_dir` | `APP_LOG_DIR` | `Path` | `<server>/data/logs` | 日志目录 |
| `log_backup_count` | `APP_LOG_BACKUP_COUNT` | `int` | `90` | `ge=1`，保留的历史日志文件数 |
| `max_image_bytes` | `APP_MAX_IMAGE_BYTES` | `int` | `10 * 1024 * 1024` | 图片上传上限，比较前多读 1 字节 |
| `cors_origins` | `APP_CORS_ORIGINS` | `list[str]` | `[]` | `Annotated[..., NoDecode]` + `field_validator(mode="before")` 手工按逗号切分；空表示不限制。因使用 `NoDecode`，环境变量必须是逗号分隔字符串（如 `https://a.example.com,.example.com`），不能写成 JSON 数组 |
| `cors_allow_credentials` | `APP_CORS_ALLOW_CREDENTIALS` | `bool` | `True` | 是否回 `Access-Control-Allow-Credentials` |
| `cors_max_age` | `APP_CORS_MAX_AGE` | `int` | `86400` | `ge=0`，预检缓存秒数 |
| `purchase_plan_cleanup_enabled` | `APP_PURCHASE_PLAN_CLEANUP_ENABLED` | `bool` | `True` | 关闭后不启动申购计划清理 worker |
| `build_time` | `APP_BUILD_TIME` | `str \| None` | `None` | 构建期注入（Docker ARG/ENV），`/version` 返回 |
| `git_sha` | `APP_GIT_SHA` | `str \| None` | `None` | 同上 |
#### 部署方需要配置的变量
`docs/env/backend.env.example` 模板项（前端对应 `docs/env/frontend.env.example`）：

| 模板中的变量 | 示例/说明 |
| --- | --- |
| `APP_ENVIRONMENT` | `development` |
| `APP_DATABASE_URL` | `mysql+asyncmy://user:pass@host:3306/spare_parts?charset=utf8mb4` |
| `APP_JWT_SECRET` | `replace-with-at-least-32-random-characters` |
| `APP_ACCESS_TOKEN_MINUTES` / `APP_REFRESH_TOKEN_DAYS` | `30` / `7` |
| `APP_CORS_ALLOW_CREDENTIALS` / `APP_CORS_MAX_AGE` | `true` / `86400` |
| `APP_WECHAT_MINI_PROGRAM_APP_ID` / `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | 多个小程序按相同顺序逗号分隔 |
| `APP_LOG_DIR` / `APP_LOG_BACKUP_COUNT` | `./data/logs` / `90` |
模板未列出但代码支持的变量：`APP_FERNET_KEY`、`APP_CORS_ORIGINS`、`APP_UPLOAD_DIR`、`APP_TEMPLATE_DIR`、`APP_MAX_IMAGE_BYTES`、`APP_PURCHASE_PLAN_CLEANUP_ENABLED`、`APP_APP_NAME`、`APP_JWT_ALGORITHM`、`APP_BUILD_TIME`、`APP_GIT_SHA`。
| 变量 | 值 |
| --- | --- |
| `APP_ENVIRONMENT` | `production` |
| `APP_DATABASE_URL` | 必填，指向外部 MySQL |
| `APP_JWT_SECRET` | 必填 |
| `APP_ACCESS_TOKEN_MINUTES` | 默认 `480` |
| `APP_WECHAT_MINI_PROGRAM_APP_ID` / `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | 默认空 |
| `APP_UPLOAD_DIR` | `/app/data/uploads` |
| `APP_LOG_DIR` | `/app/data/logs` |
| `BACKEND_PORT` / `FRONTEND_PORT`（主机侧） | `8000` / `8080` |



### 后台定时任务
#### lifespan 启动时的一次性清理（`server/app/main.py` → `lifespan`）
| 调用 | 作用 | 保留/阈值 |
| --- | --- | --- |
| `settings.upload_dir.mkdir(...)`、`configure_logging(...)` | 准备目录与日志 | — |
| `import_job_service.mark_stale_jobs_failed()` | 重启前遗留的 `PENDING`/`RUNNING` 导入任务标记失败并删除临时文件 | — |
| `import_job_service.cleanup_finished_jobs()` | 删除已终态（`SUCCEEDED`/`FAILED`）导入任务行 | `retention_days=30` |
| `excel_export_job_service.mark_stale_exports_failed()` | 同上，针对导出任务 | — |
| `excel_export_job_service.cleanup_finished_exports()` | 删除已终态导出任务行及其文件 | `EXPORT_RETENTION_DAYS=3` |
| `share_link_service.cleanup_expired()` | 删除已过期分享链接行 | `expires_at < now` |
每次清理命中的条数会打印 `logger.info`（如 `purged N expired share links`）。导入任务的终态清理**只在启动时执行一次**，代码中未定义周期性导入清理 worker。
#### 常驻 worker（`asyncio.create_task`，name 即任务名）
| task name | 实现 | 触发/周期 | 关键参数 |
| --- | --- | --- | --- |
| `webhook-delivery-worker` | `webhook_service.run_delivery_worker(stop_event)` | 循环投递待发送 webhook，无可投递时 `asyncio.wait_for(stop_event.wait(), timeout=2.0)` 轮询 | `_POLL_INTERVAL_SECONDS=2.0`；`_MAX_ATTEMPTS=5`；退避 `_RETRY_MINUTES=(1,5,15,60,180)`；`_SENDING_LEASE_MINUTES=5`；HTTP 超时 8s/连接 3s |
| `purchase-plan-cleanup-worker` | `purchase_plan_cleanup_service.run_cleanup_worker(stop_event)` | 睡到下一个北京时间 02:00（`_CLEANUP_HOUR=2`，`SHANGHAI` 时区）后循环清理直到无候选 | 仅当 `settings.purchase_plan_cleanup_enabled` 为真时创建；批次 `_BATCH_SIZE=50`；先解绑 `purchase_request_line.purchase_material_id` 再物理删除计划；`with_for_update(skip_locked=True)` |
| `attachment-cleanup-worker` | `attachment_cleanup_service.run_cleanup_worker(stop_event)` | 睡到下一个北京时间 02:00（`_CLEANUP_HOUR=2`，`SHANGHAI` 时区）后循环清理直到无候选 | 仅当 `settings.attachment_cleanup_enabled` 为真时创建；批次上限 200；对 `file_object.deleted_at` 非空的待删除附件**逐张复查被引用次数**：仍无引用才物理删除数据库行与磁盘文件，复查到新增引用则撤销删除；`with_for_update(skip_locked=True)`。物理清除只能由本任务完成，**没有手动物理删除接口** |
| `excel-export-cleanup-worker` | `excel_export_job_service.run_cleanup_worker(stop_event)` | 启动后立即清理一次，随后每 24 小时一次 | 终态任务保留 3 天；顺带清理 `upload_dir/exports` 下超过 24 小时的 `.tmp` 孤儿文件 |
| `share-link-cleanup-worker` | `share_link_service.run_cleanup_worker(stop_event)` | 启动后立即清理一次，随后每 24 小时一次 | 删除 `expires_at < utcnow()` 的行 |

| 任务 | 生命周期 |
| --- | --- |
| 常驻 worker | 退出时 `finally` 置 `stop_event` 并 `await`，随后关闭 `httpx` 客户端（`webhook_service.close_client()`、`ai_search_service.close_client()`） |
| MCP | `lifespan` 全程包在 `async with mcp.session_manager.run():` 内 |
| 请求内派生任务 | `import_job_service.enqueue_import` 与 `excel_export_job_service` 用 `asyncio.create_task(...)` 起 `import-job-{id}` / `export-job-{id}`，引用存模块级 `_running_tasks` 防 GC（单进程有效） |
### 其它
#### MCP 服务（`server/app/mcp_server.py`）
| 项 | 内容 |
| --- | --- |
| 挂载 | `MCPServer("spare-parts-management", title="备件管理系统")`，`app.mount("/api/v1/mcp", mcp_http_app, name="mcp")`；传输 Streamable HTTP（`streamable_http_path="/"`、`stateless_http=True`、`json_response=True`、`max_request_body_size=16MB`），并显式关闭 DNS rebinding 保护以适配反向代理的 Host 头 |
| 工具 | `system_whoami`（返回令牌对应用户与角色）、`operations_list`（按标签/关键字列出操作）、`operation_describe`（返回某操作的参数与响应契约）、`operation_call`（以 `X-API-Token` 调用业务接口；文件用 `file.content_base64` 上传，二进制响应超过 25 MB 报错） |
| 操作目录 | 来自应用自身的 `app.openapi()` 路径，按 `operationId` 索引；排除 `/api/v1/auth/login`、`/api/v1/auth/refresh` 以及前缀 `/api/v1/agent/database`、`/api/v1/mini-program/` |
| 调用方式 | `operation_call` 通过 `httpx.ASGITransport` 在本进程内回环调用，仍完整经过参数校验、角色权限、乐观锁与事务；超时 60 秒 |
| 认证 | `McpTokenAuthMiddleware` 取 `?token=`、`X-API-Token` 或 `Authorization: Bearer`，命中用户后把身份放进 `ContextVar`，失败返回 `401` + `{"code":"INVALID_TOKEN", ...}` |
#### 健康检查与接口文档
| 项 | 内容 |
| --- | --- |
| `GET /health` | `include_in_schema=False`；执行 `SELECT 1`，成功返回 `{"status":"ok","database":"ok"}`；失败记录 warning 并返回 `503 DATABASE_UNAVAILABLE`；响应体会被 `IgnoreHealthCheckFilter` 从控制台日志略过 |
| Swagger / OpenAPI | Swagger UI 在 `/api/docs`，OpenAPI JSON 在 `/api/v1/openapi.json`；版本号硬编码 `1.0.0`（`FastAPI(openapi_url=..., docs_url=...)`） |
| 契约文件 | `docs/openapi.yaml` 由 `server/scripts/export_openapi.py` 从运行中的应用导出（示例补充见同目录 `openapi_examples.py`），前端类型由它生成 |
| 错误响应声明 | 所有路由的 `responses` 在 `api/v1/__init__.py` 统一声明 `400/401/403/409/422` 使用 `ApiError` 模型 |
#### Docker 与部署
| 项 | 内容（`server/Dockerfile`、`docker-compose.yml`） |
| --- | --- |
| 基础镜像与目录 | `python:3.12-slim`，`WORKDIR /app`；构建时 `mkdir -p /app/data/uploads /app/data/logs` |
| 构建参数与安装 | `ARG BUILD_TIME` / `ARG GIT_SHA` → `ENV APP_BUILD_TIME` / `APP_GIT_SHA`；`COPY pyproject.toml` + `COPY app ./app` → `pip install --no-cache-dir .`（构建上下文是 `server/` 自身） |
| 端口/启动 | `EXPOSE 8000`；`CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]` |
| compose 后端 | 镜像 `ghcr.io/sakana-1314/electrical-manager:server`，端口 `${BACKEND_PORT:-8000}:8000`，卷 `uploads:/app/data/uploads`、`logs:/app/data/logs`，健康检查轮询 `/health`（15s 间隔，30s 起始宽限） |
| compose 前端 | 镜像 `ghcr.io/sakana-1314/electrical-manager:web`，端口 `${FRONTEND_PORT:-8080}:80`，`depends_on: backend: service_healthy` |
| 网络 | 外部网络 `1panel-network` |
运行时依赖见 `server/pyproject.toml`：FastAPI、SQLAlchemy[asyncio]、asyncmy、pyjwt、argon2-cffi、cryptography、httpx、mcp、openpyxl、xlrd、pillow、pydantic-settings、uvicorn；开发依赖含 aiosqlite、pytest、pytest-asyncio、mypy(strict)、ruff、pyyaml；Python 版本要求 `>=3.12,<3.15`。



</TabsContent>

<TabsContent id="miniprogram">

原生微信小程序（WXML / WXSS / CommonJS JS），组件库 TDesign Mini Program，通过 `wx.login` 静默登录后使用。

### 页面构成（`miniprogram/app.json`，18 页）

| 分组 | 页面 |
| --- | --- |
| 入口与身份 | `pages/home/home`、`pages/bind/bind`、`pages/disabled/disabled`、`pages/registration-closed/registration-closed` |
| 库存与出库 | `pages/inventory/inventory`、`pages/material-detail/material-detail`、`pages/outbound/outbound`、`pages/outbound-success/outbound-success` |
| 申购与记录 | `pages/purchase-plans/purchase-plans`、`pages/purchase-plan-detail/purchase-plan-detail`、`pages/purchase-records/purchase-records`、`pages/purchase-record-detail/purchase-record-detail`、`pages/records/records` |
| 隐患管理 | `pages/hazards/hazards`、`pages/hazard-detail/hazard-detail`、`pages/hazard-create/hazard-create` |
| 参照数据 | `pages/material-codes/material-codes`、`pages/huaxing-inventory/huaxing-inventory` |

公共组件只有 `material-summary-card`；工具层在 `utils/`：`auth.js`（登录与建档）、`request.js`（请求、弱网重试、项目头与图片上传、静默重登）、`project.js`（当前项目：列表、默认项目兜底与切换）、`features.js`（功能模式）、`material.js`（物资 uuid 与幂等键）、`inventory.js`、`hazard.js`（隐患展示装饰与逾期判定）、`navigation.js`、`i18n.js`、`theme.js`（界面外观）。后端地址来自 `config/index.js` 的 `apiBaseUrl`。

### 界面外观（明 / 暗）

三档语义与网页端一致：`auto`（自动，跟随系统，默认）、`light`、`dark`；档位按本机存在 storage（`miniProgramThemeMode`），不落库、不产生请求，入口在首页「个人信息」弹窗的「外观」下拉菜单（收起态显示当前档位，展开后用 `t-radio-group` 列出三档，与列表页筛选下拉同一种表现）。

| 层 | 实现 |
| --- | --- |
| 原生外观 | `app.json` 开启 `darkmode` 并指定 `themeLocation`，窗口与导航栏颜色以 `@变量` 引用 `theme.json` 的 light / dark 调色板；自动档由此跟随系统 |
| 主题运行时 | `utils/theme.js` 把档位解析成实际外观（`auto` 读 `wx.getAppBaseInfo().theme`，取不到回落 `wx.getSystemInfoSync().theme`），系统切换由单个 `wx.onThemeChange` 广播给已绑定页面；页面统一 `Page(withTheme({…}))` 接入，`withTheme` 注入 `themeMode` / `theme` / `themeClass` 并在 `onLoad`、`onShow`、`onUnload` 完成应用与订阅 |
| 样式令牌 | `app.wxss` 中浅色令牌定义在 `page`，深色同名覆盖在 `.theme-dark`（由 `themeClass` 加到页面根节点）；`page, .theme-dark` 把 TDesign 的 `--td-*` 语义令牌桥接到 `--app-*`，两个作用域共用一套声明 |
| 显式档覆盖系统 | 导航栏与窗口底色由 `wx.setNavigationBarColor` / `wx.setBackgroundColor` 按解析结果纠正；软键盘、原生选择器弹层等系统级外观仍跟随系统 |

不使用 `@media (prefers-color-scheme)` 切换主题（媒体查询只跟随系统，与显式档并存会互相覆盖），也不引入 `tdesign-miniprogram` 自带的 `common/style/theme/*` 媒体查询主题；页面样式只引用令牌，颜色字面量只允许出现在 `app.wxss` 的令牌定义里，以上均由 `node scripts/check.js` 校验。

### 当前项目（多项目数据隔离）

业务数据按项目隔离，小程序同样一次只处理一个项目的数据：默认使用默认项目，可在首页「个人信息」弹窗里切换（`utils/project.js` + `pages/home/home.*`，切换后 `wx.reLaunch` 回首页，避免其它页面残留上一个项目的数据）。

| 项 | 实现 |
| --- | --- |
| 列表来源 | `GET /mini-program/projects`（小程序令牌鉴权，返回全部项目含停用项，前端只展示启用项） |
| 存储 | storage 键 `currentProjectId`，不落库；本机切换不影响网页端 |
| 请求头 | `utils/request.js` 在请求与图片上传时都带上 `X-Project-Id`（每次尝试重新读取，重登/重试后仍生效） |
| 默认兜底 | 不带项目头时服务端用默认项目，因此未升级的旧客户端照常可用 |
| 失效恢复 | 服务端返回 `PROJECT_DISABLED` / `PROJECT_NOT_FOUND` 时，小程序清掉已存项目、重新解析默认项目并重试一次 |

### 登录与建档

```mermaid
sequenceDiagram
    participant U as 小程序用户
    participant App as 小程序
    participant API as 服务端
    participant DB as MySQL
    U->>App: 打开小程序
    App->>App: wx.login 取 code（附 wx.getAccountInfoSync 的 AppID）
    App->>API: 静默登录（auth=false，不参与重登重试）
    API->>API: 按 AppID 选择对应小程序的 AppSecret，换取 OpenID
    API->>DB: 查 OpenID 绑定关系
    alt 已绑定且账号启用
        API-->>App: access_token + 用户档案（每次刷新最近使用时间）
    else 未绑定
        API-->>App: registration_token（10 分钟有效）+ requires_profile
        App->>U: 跳「绑定」页并提示提交姓名
        U->>App: 提交姓名
        App->>API: 用 registration_token 完成注册绑定
        API->>DB: 新建用户档案与 OpenID 映射
        API-->>App: access_token，回到原页面
    else 账号未启用 / 注册已关闭
        API-->>App: ACCOUNT_DISABLED / MINI_PROGRAM_REGISTRATION_DISABLED
        App->>U: 跳「停用」页 / 「注册已关闭」页
    end
```

OpenID 与姓名的绑定关系只在用户提交姓名后建立，管理端不能手工新增小程序用户；同一人在多个小程序下的身份可由管理端合并。

### 扫码出库

```mermaid
flowchart TD
    A["扫物资小程序码<br/>scene = 物资 uuid（32 位无连字符）"] --> B["解析 uuid（兼容带连字符与旧参数）"]
    B --> C{"功能模式允许出库？<br/>非精简模式且 inventory_mode = read_write"}
    C -- "否" --> D["不展示出库入口，仅可查看"]
    C -- "是" --> E["进入出库页：数量、用途、子项号"]
    E --> F["生成一次幂等键 client_request_id<br/>（提交重试复用，成功后作废）"]
    F --> G["提交出库"]
    G --> H{"服务端结果"}
    H -- "成功" --> I["出库成功页：物资、数量、剩余库存"]
    H -- "幂等键被不同物资复用" --> J["提示冲突，重新发起"]
    H -- "鉴权失效" --> K["静默重登后重试（见下）"]
```

出库必须填写用途；来源标记为小程序，领用人取当前小程序用户姓名并随流水保存快照。精简模式下小程序整体只读。

### 隐患管理（登记与跟进）

```mermaid
flowchart TD
    A["首页「隐患管理」入口"] --> B{"hazards_mode"}
    B -- "disabled" --> B1["不展示入口"]
    B -- "query_only / read_write" --> C["隐患列表<br/>搜索检查区域或隐患描述"]
    C --> D["按整改状态、整改员工筛选"]
    C --> E["点开详情：登记信息 + 整改前/后图片"]
    B -- "read_write" --> F["登记隐患：区域、日期、描述、责任单位、类型、整改前图片"]
    F --> G["生成一次幂等键 client_request_id<br/>（弱网重试复用，重复提交不新增）"]
    G --> H["提交登记"]
    E --> I["跟进整改：整改状态、整改员工、备注、整改后图片"]
    I --> J["带 version 提交，冲突时提示刷新"]
```

- 列表搜索只匹配「检查区域 + 隐患描述」两个字段，按整改状态与整改员工筛选；筛选项里整改员工来自库中已有值去重（`/mini-program/hazards/filter-options`）。
- 登记时检查人员缺省为当前小程序用户姓名，责任人仍由所选责任单位带出快照；`client_request_id` 是幂等键，重复提交返回同一条隐患而不是新增。
- 跟进走与网页端同一个更新接口：状态是普通可编辑字段，`version` 为乐观锁，提交旧版本会被拒（`VERSION_CONFLICT`）。
- 图片上传（`/mini-program/hazards/images`）与网页端共用同一套存储与去重规则，附件管理按两张关联表统计引用次数。
- 隐患类型与责任单位只在小程序里选择，维护仍在网页端。

### 弱网自动重试与鉴权失效的静默重登（`utils/request.js`）

请求统一走 `utils/request.js`：单次 `timeout` 30s，瞬时失败自动重放，策略与网页端 `web/src/api/retry.ts` 同一套参数。

| 维度 | 规则 |
| --- | --- |
| 可重放 | 缺省只有 `GET` / `HEAD` / `OPTIONS`；写请求需业务显式声明幂等（`retry: true`，出库与隐患登记都带 `client_request_id`、服务端按键去重）；`retry: false` 关闭重试 |
| 触发条件 | `fail` 回调（断网、超时、连接被重置）或状态码 ∈ `408 / 429 / 500 / 502 / 503 / 504` |
| 次数与节奏 | 最多 3 次尝试；失败后退避 600ms → 1800ms（上限 6s），叠加 30% 以内抖动 |
| 最坏耗时 | 单次 30s × 3 + 退避 ≈ 92s（原先是一次 60s 的默认超时，中途断连只能整单重来） |
| 重放方式 | 复用同一份 `options`（`data` 里的 `client_request_id` 不变），每次重新读取 token，重登后自动带上新凭证 |
| 图片上传 | `uploadImage`（`wx.uploadFile`）单次 120s 且不自动重放：包体大、慢，重发会重复建附件 |

鉴权失效单独走一次静默重登，不占用弱网重试额度（两者计数分开：`_attempt` 与 `_retried`）：

```mermaid
flowchart TD
    A["请求返回 401"] --> B{"请求需要鉴权且未显式带 token？"}
    B -- "否（登录/设置/绑定注册）" --> C["直接抛错"]
    B -- "是" --> D{"已有进行中的重登？"}
    D -- "是" --> E["复用同一个重登 Promise<br/>并发 401 只重登一次"]
    D -- "否" --> F["wx.login 静默重登"]
    E --> G
    F --> G{"重登结果"}
    G -- "需要补档案" --> H["跳绑定页，绑定后回跳原页面"]
    G -- "账号停用 / 注册关闭" --> I["清空本地凭证<br/>跳「停用」页 / 「注册已关闭」页"]
    G -- "成功" --> J["用新凭证重放原请求"]
```

登录（`auth: false`）、绑定注册（显式 `token`）与写请求不参与自动重放：前者的一次性 `code` / `registration_token` 不能复用，后者的副作用由服务端幂等键决定。重试额度用尽后仍按原样抛错，页面提示与改造前一致。

### 功能模式与运行模式（`utils/features.js`）

```mermaid
flowchart LR
    S["系统设置：小程序功能模式"] --> I["库存与出库<br/>read_write"]
    S --> H["华星总库存<br/>query_only"]
    S --> P["申购计划<br/>query_only"]
    S --> R["申购记录<br/>query_only"]
    S --> C["物料编码库<br/>query_only"]
    S --> Z["隐患管理<br/>read_write"]
    S --> L["二级库运行模式<br/>full"]
    I -- "disabled" --> I1["隐藏该功能页"]
    I -- "read_write" --> I2["可扫码出库"]
    Z -- "read_write" --> Z2["可登记隐患、更新整改状态"]
    L -- "lite" --> L1["整体只读，只查精简库存"]
```

每个功能页三档：`disabled`（隐藏）、`query_only`（只读）、`read_write`（可写：库存可出库、隐患可登记与跟进）。模式由服务端设置下发，小程序启动时拉取；拉取失败时回落到「库存可写、隐患可写、其余只读、完整二级库模式」的默认值，避免因一次网络失败把出库与隐患登记关掉。开关只用于小程序前端的入口拦截与展示，后端数据接口不按它鉴权。

### 构建与上传

- 依赖：`npm install` + 微信开发者工具「构建 npm」（TDesign 组件库）。
- 检查：`node scripts/check.js`；上传：`node scripts/upload.js`（`miniprogram-ci`）。
- CI 在 `miniprogram/` 变更时检查并上传开发版本，版本号取北京时间日期（如 `v2026.07.26`），同一版本依次上传到两个小程序；`AppID` 与上传私钥只存在于仓库 Secret，运行时由小程序上报自身 AppID，服务端据此选择对应 AppSecret。
- 请求合法域名需在小程序后台配置为 `apiBaseUrl` 的域名。

接口清单以[接口文档](/api)为准，库存与申购的数据模型见[数据模型](/dev-data-model)。

</TabsContent>

</Tabs>
