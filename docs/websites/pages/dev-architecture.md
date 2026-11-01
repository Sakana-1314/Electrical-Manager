# 架构设计

三端与外部依赖的关系：

```mermaid
flowchart LR
    Web["网页端<br/>Vue 3 + Naive UI"] --> API["服务端<br/>Go + Gin"]
    MP["微信小程序"] --> API
    Agent["AI Agent / MCP"] --> API
    API --> DB[("PostgreSQL 16+")]
    API --> WeChat["微信接口<br/>登录 / 小程序码"]
    API --> Ext["外部物资平台<br/>采购进度"]
    API --> Hook["飞书 / 钉钉<br/>Webhook"]
```

## 技术栈与版本

| 部分 | 技术 | 版本约束 |
| --- | --- | --- |
| 服务端语言与框架 | Go + Gin + pgx（经 `database/sql` 驱动，查询用 sqlx）；单个静态二进制（构建镜像 `golang:1.26-alpine`，运行镜像 `alpine:3.22`） | Go `1.26`；Gin `v1.12.0`；pgx `v5.11.0`；sqlx `v1.4.0`（`server/go.mod`、`server/Dockerfile`） |
| 服务端依赖与数据库 | 配置读 `APP_` 前缀环境变量 + `server/.env`（`internal/config`）；golang-jwt（JWT）+ `golang.org/x/crypto/argon2`（argon2id 密码哈希）；fernet-go（凭证加密）；excelize（xlsx 读写与导出渲染）+ mscfb（`.xls` 复合文档解析）；`golang.org/x/image` + gen2brain/webp（图片解码与预览）；shopspring/decimal（数量与金额）；google/uuid；yaml.v3（内嵌接口契约）；PostgreSQL 16+ | golang-jwt `v5.3.1`；`golang.org/x/crypto v0.58.0`；fernet-go `v0.0.0-20240119011108-303da6aec611`；excelize `v2.11.0`、mscfb `v1.0.9`；`golang.org/x/image v0.47.0`、webp `v0.6.4`；decimal `v1.6.0`；uuid `v1.6.0`；yaml.v3 `v3.0.1`；PostgreSQL 16+（`server/go.mod`） |
| 网页端 | Vue、Vue Router、Pinia、Naive UI、Axios、VueUse | `^3.5.17`、`^4.5.1`、`^3.0.3`、`^2.42.0`、`^1.10.0`、`^13.5.0` |
| 网页端构建与测试 | Vite、TypeScript、vue-tsc；Vitest、Vue Test Utils、jsdom；openapi-typescript（契约生成） | Vite `^7.0.4`、TypeScript `~5.8.3`、vue-tsc `^3.0.3`；Vitest `^3.2.4`、Vue Test Utils `^2.4.6`、jsdom `^26.1.0`；openapi-typescript `^7.8.0`（`web/package.json`） |
| 小程序与站点 | 微信小程序原生（WXML/WXSS/JS）+ tdesign-miniprogram、miniprogram-ci；VitePress 站点（`srcDir: pages`、`base: /Electrical-Manager/`） | tdesign `^1.15.3`、miniprogram-ci `2.1.31`；VitePress `^1.6.4`（`miniprogram/package.json`、`docs/websites/package.json`、`docs/websites/.vitepress/config.ts`） |
| 部署 | Docker Compose；镜像 `ghcr.io/sakana-1314/electrical-manager:server` / `:web`；replica `nginx:1.27-alpine`（`docker-compose.yml`、`web/Dockerfile`） | — |

## 仓库目录结构

```text
Electrical-Manager/
├── AGENTS.md / CLAUDE.md / README.md / docker-compose.yml（backend:8000 + frontend:80→8080，外部 1panel-network）
├── docs/   openapi.yaml（契约唯一来源，手工维护）、env/、references/database/init.sql（结构唯一来源）、websites/（VitePress）
├── server/ Dockerfile（多阶段 Go 构建）、go.mod、Makefile、cmd/server/（入口）、internal/（见「后端目录结构」）、templates/（Excel 布局 JSON）、
│           data/（uploads/imports/exports、logs/）、scripts/（openapi_examples.py、e2e_simulation.py）、tools/run_contract_tests.sh、tests/（黑盒契约测试）
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
测试文件为 `*.spec.ts`，共 60 个；`web/vitest.config.ts` 中 `setupFiles: ['./src/test/setup.ts']`（仅 `afterEach(() => vi.restoreAllMocks())`）。CI 由 `.github/workflows/web-test.yml` 在 `web/**` 变更时跑 `npm run test`。

> **`NODE_ENV` 必须是 `test`**：Vue 的 `package.json` exports 在 `require` 条件下按 `NODE_ENV` 选构建产物，`production` 会解析到 `vue.cjs.prod.js`，而 prod 构建**移除了 devtools hook**——`@vue/test-utils` 的 `wrapper.emitted()` 正是靠这个 hook 捕获自定义事件。外部若是 `NODE_ENV=production`（CI / 生产 shell / Docker），所有断 `emit` 的用例都会静默失败、看起来像代码 bug。`vitest.config.ts` 已在加载 Vue 前强制改回 `test`，因此本地与 CI 结果一致；改动该文件时不要去掉这行。

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
├── layouts/mainMenu.ts     侧边菜单一级项拼装：按权限、二级库模式与「后台可见功能」开关过滤（纯逻辑，有单测）
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
| `/login` | `login` | `views/LoginView.vue` | 无（公开 `meta.public`） | 登录页：账号密码表单，调 `auth.login`，支持 `?redirect=` 回跳 |
| `/` | — | `layouts/AppLayout.vue` | 需登录 | 布局壳：侧边菜单 + 顶栏用户菜单 |
| `/dashboard` | `dashboard` | `views/dashboard/DashboardView.vue` | 需登录 | 工作台：按模块（二级库 / 申购 / 隐患）分组的可点击指标卡（`inventoryApi.summary` + `hazardApi.stats`，跟随「后台可见功能」与二级库精简模式）、按写权限出现的快捷操作、低库存提醒与最近出入库两栏；各块独立请求、独立失败 |
| `/memos` | `memos` | `views/MemosView.vue` | 需登录 | 备忘录：左侧列表 + 单编辑区，保存才提交、IndexedDB 草稿、字号偏好（浏览器本地，CSS 变量作用于编辑区） |
| `/warehouse/materials` | `stock-materials` | `views/warehouse/StockMaterialsView.vue` | 需登录 | 物资档案列表；行点击/编辑/新建都打开 `StockMaterialFormModal`（详情、档案与补库策略、出库小程序码、删除） |
| `/warehouse/materials/:id` | — | 无组件，`redirect` 到 `stock-materials` + `?detail=<id>` | — | 旧详情链接兼容：回列表并自动打开该物资的详情弹窗 |
| `/warehouse/inbound` | `inbound` | `views/warehouse/OperationEditorView.vue`（`props: { operationType: 'INBOUND' }`） | `warehouse:write` | 入库登记（行编辑与校验） |
| `/warehouse/outbound` | `outbound` | `views/warehouse/OperationEditorView.vue`（`props: { operationType: 'OUTBOUND' }`） | `warehouse:write` | 出库登记（行编辑与校验） |
| `/warehouse/stock` | `stock` | `views/warehouse/StockView.vue` | 需登录 | 库存查询（余额/低库存）、生成补库草稿 |
| `/warehouse/hua-xing-stock` | `hua-xing-stock` | `views/warehouse/HuaXingStockView.vue` | 需登录 | 华星总库存查询 + Excel 导入（`useImportJob`/`useImportConfirm`） |
| `/warehouse/lite` | `warehouse-lite` | `views/warehouse/SecondaryWarehouseLiteView.vue` | 需登录 | 精简二级库：Excel 导入 + 只读查询 |
| `/warehouse/operations` | `operations` | `views/warehouse/OperationsView.vue` | 需登录 | 流水列表；行点击/流水号/「详情」都打开 `OperationDetailModal`（单据信息、物资明细、修改、反向冲销） |
| `/warehouse/operations/:id` | — | 无组件，`redirect` 到 `operations` + `?detail=<id>` | — | 旧详情链接兼容：回列表并自动打开该流水的详情弹窗 |
| `/procurement/materials` | `purchase-materials` | `views/procurement/PurchaseMaterialsView.vue`（`keepAlive`） | 需登录 | 计划列表：筛选/排序/批量更新/批量转记录/导出、列显隐与 URL 同步；行点击打开计划详情弹窗（编辑、单条转入申购记录、删除、在新页面打开），单条转入成功后跳记录列表并打开新记录的详情弹窗 |
| `/procurement/materials/:id` | — | 无组件，`redirect` 到 `purchase-materials` + `?detail=<id>` | — | 旧详情链接兼容：回列表并自动打开该计划的详情弹窗 |
| `/procurement/purchase-plan-templates` | `purchase-plan-templates` | `views/procurement/PurchasePlanTemplatesView.vue`（`keepAlive`） | 需登录 | 模板列表/编辑/生成申购计划 |
| `/procurement/uncoded-materials` | `uncoded-materials` | `views/procurement/UncodedMaterialsView.vue` | 需登录 | 未编码物资（`coded: false`）批量编码与导出 |
| `/procurement/material-code-library` | `material-code-library` | `views/procurement/MaterialCodeLibraryView.vue` | 需登录 | 编码库列表 + Excel 导入 |
| `/procurement/records` | `purchase-records` | `views/procurement/PurchaseRequestsView.vue`（`keepAlive`） | 需登录 | 记录列表：批量更新/分享/导出；行点击打开记录详情弹窗（编辑、恢复为计划、再次申购、在新页面打开）；「转为申购计划」成功后跳计划列表并打开重建计划的详情弹窗 |
| `/procurement/records/:id` | — | 无组件，`redirect` 到 `purchase-records` + `?detail=<id>` | — | 旧详情链接兼容：回列表并自动打开该记录的详情弹窗 |
| `/hazards` | `hazard-records` | `views/hazard/HazardRecordsView.vue`（`keepAlive`） | 需登录 | 隐患台账：筛选（类型/状态/等级/单位/整改员工/区域/关键字/日期）/分页/列显隐与 URL 同步、整行点击编辑弹窗、逾期标记 |
| `/hazard-types` | `hazard-types` | `views/hazard/HazardTypesView.vue` | 需登录 | 隐患类型：两级横向树（大类在左、小类在右，连线由 `vue3-tree-org` 绘制），大类可折叠，点小类编辑 |
| `/hazard-units` | `hazard-units` | `views/hazard/HazardUnitsView.vue` | 需登录 | 责任单位：单位与责任人一一对应、行内启停 |
| `/ledger/items` | `ledger-items` | `views/ledger/LedgerItemsView.vue`（`keepAlive`） | 需登录 | 台账总览：固定列（子项号 / 名称 + 型号（合并一列两行展示）/ 标签 / 数量（合并单位展示）/ 用途 / 备注 / 图片）、关键字与标签多选筛选（命中选中标签及其全部子孙标签）、分页/列显隐与 URL 同步、整行点击编辑弹窗 |
| `/ledger/tags` | `ledger-tags` | `views/ledger/LedgerTagsView.vue` | 需登录 | 标签管理：横向树（至多 3 层，`vue3-tree-org`）、节点上的数字是「使用该标签的台账记录数」（`item_count`，只算直接引用，不含子标签的使用量，含 0）、节点悬停浮层看备注与图片、按「孤立标签 / 树标签」筛选、节点上新增子标签与编辑 |
| `/work/overview` | `work-overview` | `views/work/WorkOverviewView.vue`（`keepAlive`） | 需登录 | 工作总览：一行 = 日期 + 任务 + 时段（全天 / 上午 / 下午）并列出当天参与人员；日期区间（必填、≤92 天，`WorkRangePicker` 快捷档）/ 任务 / 参与人员 / 关键字筛选、分页与列显隐、URL 同步；点行打开记录弹窗（无写权限为只读详情） |
| `/work/tasks` | `work-tasks` | `views/work/WorkTasksView.vue`（`keepAlive`） | 需登录 | 任务视图：半日格时间线（一行一个任务，色块 = 该任务的一段工作并显示参与人员），点色块编辑记录、行尾编辑任务 / 排活、点任务名看该任务的时间段明细；任务 CRUD 按 `work:write` 隐藏 |
| `/work/workers` | `work-workers` | `views/work/WorkWorkersView.vue`（`keepAlive`） | 需登录 | 人员视图：半日格时间线（一行一个人，色块 = 该人干的任务，按任务固定配色），姓名由工作记录的参与人员派生并按拼音排序；点色块编辑记录、行尾给该人排活 |
| `/settings/advanced` | `advanced-settings` | `views/settings/AdvancedSettingsView.vue` | `settings:write` | AI 搜索、小程序功能开关、后台可见功能、图片加速、Webhook |
| `/settings/ai-search` | — | 无组件，`redirect: { name: 'advanced-settings' }` | — | 无组件，重定向到 advanced-settings |
| `/settings/projects` | `projects` | `views/settings/ProjectsView.vue` | `settings:write` | 项目管理：项目列表、新增/编辑（名称、启停）、默认项目标记、删除（有数据的项目不可删） |
| `/settings/users` | `users` | `views/settings/UsersView.vue` | `settings:write` | 用户管理：角色、启停、令牌回显/重置、MCP 链接 |
| `/settings/mini-program-users` | `mini-program-users` | `views/settings/MiniProgramUsersView.vue` | `settings:write` | 小程序用户查询/更新/删除/合并 |
| `/settings/attachments` | `attachments` | `views/settings/AttachmentsView.vue` | `settings:write` | 附件管理：列出全部图片与引用次数（含待删除，预览列照常显示缩略图、待删除的降透明度区分）、软删除单张、一键删除未引用附件（先调预检接口列出会被标记的清单与保护期跳过数量，再确认执行）、撤销删除 |
| `/settings/about` | `about` | `views/settings/AboutView.vue` | `settings:write` | 版本信息与构建时间（`versionApi.get()`） |
| `/settings/share-links` | `share-links` | `views/settings/ShareLinksView.vue` | `settings:write` | 分享链接列表/改列/改期/撤回 |
| `/share/:token` | `share` | `views/public/ShareView.vue` | 无（公开 `meta.public`） | 匿名分享预览（按配置列渲染） |
| `/:pathMatch(.*)*` | — | `views/NotFoundView.vue` | 无（公开 `meta.public`） | 404 页面，「返回首页」按落地页推导（当前可见的第一个主 tab） |

路由守卫 `router.beforeEach`（`async` 函数，顺序即执行顺序）：

| 序 | 规则 |
| --- | --- |
| 1 | 设置标题：`` document.title = `${to.meta.parent ? `${to.meta.parent} / ` : ''}${to.meta.title || '系统'} - HXNI 电气无忧` `` |
| 2 | 非 `public` 且 `auth.isAuthenticated` 为 false → `{ name: 'login', query: { redirect: to.fullPath } }` |
| 3 | 非 `public` 时先 `await useProjectStore().ensureLoaded()`（拉取项目列表失败不拦导航） |
| 4 | 目标是 `login` 但已登录 → 落地页（见下） |
| 5 | `to.meta.permission` 存在且 `auth.can(permission)` 为 false → 落地页（见下） |
| 6 | `settings.isLiteMode` 为 true 且目标 name 属于 `FULL_WAREHOUSE_ROUTES`（`stock-materials`、`inbound`、`outbound`、`stock`、`operations`）→ `{ name: 'warehouse-lite' }`；旧详情路径的 `redirect` 先解析成列表路由，因此同样会被这条守卫接管 |

**落地页**：`/`、登录成功（`LoginView`，无 `?redirect=` 时）与上面第 4、5 条都落到「当前可见的第一个主 tab」——
由 `utils/navigation.ts` 的 `resolveLandingRouteName(settings.webFeatures, { isLiteMode })` 推导（二级库在精简模式下落到 `warehouse-lite`），
默认 `dashboard`；全部主 tab 都不可见时回落 `dashboard`。工作台被后台可见功能关掉后不会再把用户扔进一个侧栏里没有入口的页面。


| 项 | 实现 | 位置 |
| --- | --- | --- |
| 是否已登录 | `isAuthenticated` = `token && user` 同时存在 | `stores/auth.ts` |
| 权限点 | `can(permission)` 查 `rolePermissions`：`SUPER_ADMIN` 全部 7 项；`WAREHOUSE_ADMIN` `warehouse:write`+`read`；`PURCHASE_ADMIN` `purchase:write`+`read`；`HAZARD_ADMIN` `hazard:write`+`read`；`LEDGER_ADMIN` `ledger:write`+`read`；`WORK_ADMIN` `work:write`+`read`；`READ_ONLY` 仅 `read` | `types/navigation.ts` |
| 无权限时 | 静默重定向到落地页（当前可见的第一个主 tab，默认工作台）；无独立 403 页、无全局拦截，页面内用 `auth.can()` 自行隐藏入口 | `router/index.ts`、`layouts/AppLayout.vue` |
| 后台可见功能 | 高级设置「功能状态 → 后台」里按**主 tab** 用下拉框选「显示 / 隐藏」（与小程序端档位同一套 `n-select` 写法），隐藏的项由 `isFeatureVisible()` 挡在侧栏外：只影响侧栏与落地页推导，**不拦路由、不拦接口**，被隐藏的页面仍可用链接直达；系统管理不参与该配置（始终显示），分组内部子项不单独配置 | `utils/navigation.ts`、`layouts/mainMenu.ts`、`stores/settings.ts` |
| keep-alive | `meta.keepAlive` 只在 8 个列表路由（`purchase-materials`、`purchase-plan-templates`、`purchase-records`、`hazard-records`、`ledger-items`、`work-overview`、`work-tasks`、`work-workers`）声明，由 `<keep-alive>` 使用，路由守卫不读该字段 | 同上 |
### 状态管理
`web/src/stores/` 下只有 4 个 store，均为 setup 语法（`defineStore(id, () => {...})`）。

| store | state | getters | actions | 持久化 | 职责 |
| --- | --- | --- | --- | --- | --- |
| `stores/auth.ts`（`useAuthStore`） | `user: User \| null`、`token: string \| null` | `isAuthenticated`（`Boolean(token && user)`） | `login(payload)`、`refresh()`（调 `/auth/me` 回填 user）、`logout()`、`can(permission)` | 读写 `localStorage`：`access_token`、`refresh_token`、`auth_user`；`user`/`token` 初值在 store 定义时就读取 `auth_user` / `access_token` | 登录态与角色权限判断 |
| `stores/project.ts`（`useProjectStore`） | `projects: Project[]`、`currentProjectId: number \| null`（初值读本地 `current_project_id`）、`loaded: boolean` | `enabledProjects`、`currentProject` | `ensureLoaded()`（首次导航前拉 `projectApi.list()`，失败不抛出）、`select(id)`（写本地并 `location.reload()`）、`clear()`、`fetchProjects()` | `localStorage` key `current_project_id`；已存项目被停用/删除时回退默认项目 | 当前项目：由 `web/src/api/client.ts` 注入 `X-Project-Id`，顶栏菜单与 MCP 链接共用 |
| `stores/settings.ts`（`useSettingsStore`） | `secondaryWarehouseMode: SecondaryWarehouseMode`（初值 `'full'`）、`webFeatures: WebFeatureVisibility`（初值全部可见）、`loaded: boolean` | `isLiteMode`（`secondaryWarehouseMode === 'lite'`） | `load()`（调 `systemSettingsApi.miniProgramFeatures()`，失败回退 `'full'` + 全部可见）、`isFeatureVisible(key)`（主 tab 是否可见，缺字段/全关按可见处理） | 无持久化（每次启动重新拉公开配置） | 全局二级库模式与后台可见功能，供路由守卫、落地页与侧边菜单在首次导航前同步读取 |
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
| `resolveMcpUrl(resolvedApiBaseUrl, token, projectId?, origin?)` | — | 拼出 `mcp/?project_id=&token=` 地址（`project_id` 在前，未选项目时不带该参数） |

位置：`web/src/config/env.ts`。
- 请求拦截器：`localStorage` 有 `access_token` 时注入 `Authorization: Bearer <token>`；有 `current_project_id` 时注入 `X-Project-Id`（项目隔离必需）；`config.headers['X-Request-ID']` 缺失时生成 `crypto.randomUUID()`（一个逻辑请求一个 id，重试复用同一个，服务端日志里多次尝试能串起来）。
- 版本头：客户端**不统一注入**，由业务模块按需传 `If-Match`（值均为 `String(version)`），共 13 处：
  `procurement.deleteMaterial`、`procurement.restoreRecordToPlan`、`purchasePlanTemplates.deleteTemplate`、
  `inventory.deleteMaterial`、`dictionaries.deleteMiniProgramUser`、`projects.deleteProject`、
  `hazards.deleteHazard`、`hazards.deleteUnit`、`hazards.deleteType`、`ledger.deleteItem`、`ledger.deleteTag`、
  `work.deleteTask`、`work.deleteRecord`。
- `X-API-Token`：**前端当前未实现**（代码中无该请求头，接口令牌仅在「管理端用户」页展示/复制与 MCP 链接里使用）。
- 401 处理：仅当 `status === 401 && data.code === 'INVALID_TOKEN' && 未重试过 && localStorage 有 refresh_token`
  时，调用 `renewAccessToken()`（`POST /auth/refresh`，`timeout: 30_000`）并重放原请求；并发请求共用模块级
  `refreshRequest` promise，避免刷新风暴。刷新失败或其余 401：`clearSession()` 后跳登录页。
- 错误归一化：响应体带 `code` 时抛 `AppError`（保留 `code` / `message` / `details` / `request_id`）；否则按有无 `response` 构造 `SERVER_ERROR`（`服务请求失败（HTTP <status>），请稍后重试`）或 `NETWORK_ERROR`（`无法连接服务器，请检查网络后重试`），`request_id` 取自本次请求的 `X-Request-ID`。已归一化的 `AppError` 会被后续拦截器直接透传，不会因重放被再次包装。
- 未消费响应头：**前端当前不读取任何响应头**（无 `X-Response-Time` / 服务端 `X-Request-ID` 的读取逻辑；`web/src/utils/download.ts` 的 `filenameFromContentDisposition` / `downloadBlobWithDisposition` 已实现但当前无调用点，导出下载走 `exportDownloadUrl` 拼地址）。
- 超时覆盖：默认 30s；`systemSettings.imageAcceleration`、`systemSettings.miniProgramFeatures` 为 3000ms 且 `retry: false`（都在启动路径上、带各自回退值，弱网下宁可快速失败也不拖住首屏）；`aiSearch.testSettings` 为 35s；`procurement.importMaterialCodes`、`secondaryWarehouse.import`、`huaXingInventory.import` 为 120s；`files.uploadImage`（图片上传）为 30 分钟——单张最大 10MB，慢上行光传输就可能超过 30s，而 XHR 的 `timeout` 是请求总时长，超时即中止、重传只能从头再来，故一次给足时间，把「传得慢」与「连接真断了」区分开（后者由浏览器/系统报错）。
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
| `docs/openapi.yaml` | 唯一事实源（手工维护；后端用 `make sync-openapi` 同步内嵌副本） |
| `web/src/api/generated.raw.ts` | 由 `npm run generate:api`（`openapi-typescript`）从 `docs/openapi.yaml` 生成，**禁止手改** |
| `web/src/api/generated.ts` | 手写类型别名层：能一一映射的写 `export type X = components['schemas']['X']`，再补前端自建视图模型（`Page<T>`、`PagedQueryParams`、`ManagedUser`、`OperationWrite`、`PurchaseRequest` 等）；**不是生成产物，但生成段仍不应手改** |
#### `web/src/api/` 模块职责
| 模块 | 接口域 | 职责 |
| --- | --- | --- |
| `auth.ts` | `/auth/login`、`/auth/refresh`、`/auth/me` | 登录、刷新令牌、取当前用户 |
| `inventory.ts` | `/dashboard/summary`、`/stock-materials*`、`/inventory/*` | 工作台汇总、物资档案 CRUD + 小程序码、补库策略、库存查询、低库存、出入库、流水查询/修改/冲减、补库草稿 |
| `procurement.ts` | `/material-code-library*`、`/purchase-materials*`、`/purchase-records*`、`/excel-export-jobs/:id` | 申购计划/记录 CRUD 与批量操作、筛选选项、计划转记录、未编码物资、物料编码库导入（`table=material` 物料表 / `table=price` 价格表）与编码检查、各类导出与导出任务轮询 |
| `purchasePlanTemplates.ts` | `/purchase-plan-templates*` | 周期性计划模板 CRUD 与「生成申购计划」 |
| `huaXingInventory.ts` | `/huaxing-inventory*` | 华星总库存查询、筛选选项、Excel 导入任务与最近导入 |
| `secondaryWarehouse.ts` | `/secondary-warehouse*` | 精简二级库列表、Excel 导入任务与最近导入 |
| `dictionaries.ts` | `/users*`、`/mini-program-users*` | 管理端用户 CRUD 与接口令牌重置、小程序用户查询/更新/删除/合并 |
| `projects.ts` | `/projects*` | 项目列表、新增、编辑（名称/启停）与删除 |
| `systemSettings.ts` | `/system-settings/*` | 图片加速配置、功能开关（小程序档位 + 后台主 tab 可见性，启动时拉取一次）、Webhook 渠道读取/更新/测试 |
| `aiSearch.ts` | `/ai-search/*` | AI 搜索扩展、状态、配置读取/更新/测试 |
| `share.ts` | `/shares*` | 创建/读取/列取/更新/撤回匿名分享链接 |
| `memos.ts` | `/memos*` | 个人备忘录 CRUD |
| `hazards.ts` | `/hazards*`、`/hazard-types*`、`/hazard-units*` | 隐患台账 CRUD、概览统计与筛选项（整改员工）、隐患类型与责任单位字典维护 |
| `ledger.ts` | `/ledger-items*`、`/ledger-tags*` | 台账记录 CRUD 与分层标签维护（含孤立 / 树标签筛选、标签多选） |
| `work.ts` | `/work-tasks*`、`/work-records*`、`/work-overview`、`/work-task-timeline`、`/work-worker-timeline`、`/work-participants` | 任务与工作记录 CRUD、三个视图查询、参与人历史姓名（表单下拉辅助输入与筛选共用） |
| `files.ts` | `/files/images*` | 图片上传与删除、上传前摘要查重（`dedup-check`）、附件列表、未引用附件软删除与撤销 |
| `retry.ts` | —（axios 拦截器） | 弱网自动重试：可重放方法判定、退避与抖动（见下文「弱网自动重试」） |
| `version.ts` | `/version` | 版本信息（关于页） |
`web/src/utils/download.ts` 的 `exportDownloadUrl(fileUuid)` 直接拼导出文件下载地址（该端点不鉴权）。



### 公共组件清单
`web/src/components/` 下 27 个 `.vue`（不含 `.spec.ts`）：

| 组件 | 职责 | 关键 props / emits |
| --- | --- | --- |
| `ColumnVisibilityPicker.vue` | 表格列显隐勾选，可选按 `storageKey` 从 `localStorage` 恢复/持久化（最后一列不允许取消） | props：`value: string[]`、`options: ColumnOption[]`、`storageKey?: string`；emit：`update:value` |
| `ExportButton.vue` | 导出下拉按钮（Naive UI `NDropdown`），无选项或无数据时禁用 | props：`options: ExportOption[]`、`loading?`、`disabled?`（默认 false）；emit：`select: [key: string]` |
| `ExportLoadingOverlay.vue` | 全屏「正在生成 Excel，请稍候…」遮罩 | props：`show: boolean` |
| `FilterExpandButton.vue` | 筛选区展开/收起按钮（`aria-expanded`） | props：`expanded: boolean`；emit：`update:expanded` |
| `ImageThumbnails.vue` | 图片缩略图（最多显示 3 张 + 剩余数量），用 `imagePreviewUrl`/`imageUrl` | props：`images: FileObject[]` |
| `ImageUploader.vue` | 图片上传（校验类型/大小、多选后本地排队、最多 2 个并发、逐项进度与失败重试、删除二次确认、预览），并处理 ESC 只关一层预览的捕获逻辑 | props：`files: FileObject[]`、`disabled?`、`max?`（默认 9）；emit：`update:files` |
| `LoadingMask.vue` | 元素内局部加载遮罩（模糊宿主 + 居中 loading） | props：`show: boolean`、`text?: string` |
| `MaterialCodeSelector.vue` | 物料编码库弹窗选择器，支持按编码/名称/型号检索分页 | props：`modelValue: string`、`defaultName?`、`defaultModelSpec?`、`disabled?`；emits：`update:modelValue`、`select: [MaterialCodeLibrary]` |
| `MaterialSelector.vue` | 二级库物资下拉选择（默认候选走 `stockMaterialCache` 的 15s 共享缓存，关键词搜索 300ms 防抖并丢弃过期响应，始终合并已选物资以免显示裸 id；支持排除已选） | props：`value: number \| null`、`selected?: StockMaterial \| null`、`disabled?`、`excludeIds?: number[]`；emits：`update:value`、`select: [StockMaterial?]` |
| `RouteProgress.vue` | 路由切换顶部进度条（无渲染输出，须放在 `n-loading-bar-provider` 内）：导航开始启动、结束收起、代码块加载失败标红；同路由只改 query 不触发 | 无 props / emits |
| `OperationLinesEditor.vue` | 出入库行编辑器（选物资 + 数量，出库多一列领用信息） | props：`lines: OperationLineModel[]`、`type: 'INBOUND' \| 'OUTBOUND'`、`disabled?`；emit：`update:lines` |
| `StockMaterialFormModal.vue` | 二级库物资详情 / 新建 / 编辑弹窗（当前库存与建议申购数量只读、补库策略、出库小程序码预览与下载、删除；无写权限时只读） | props：`show: boolean`、`materialId?: number \| null`（默认 null，null 为新建）；emits：`update:show`、`saved` |
| `OperationDetailModal.vue` | 出入库流水详情 / 编辑 / 冲销弹窗（Hero 摘要、单据信息、物资明细、修改影响提示与变化摘要确认、反向冲销） | props：`show: boolean`、`operationId?: number \| null`；emits：`update:show`、`saved`、`reversed: [id: number]` |
| `PurchaseRecordHistoryDialog.vue` | 申购记录历史弹窗（按名称/型号检索历史记录表格） | props：`show: boolean`、`initialName?`；emit：`update:show` |
| `QuantityInput.vue` | 数量输入框：正则限制 1 位小数，用 `isDecimalString` / `compareDecimal` 校验并显示 error/success 状态 | props：`value: string`、`decimalPlaces?`（默认 1）、`max?`、`disabled?`、`placeholder?`；emit：`update:value` |
| `ReverseOperationDialog.vue` | 出入库流水冲减弹窗（按行填写冲减数量，`reversed` 回传操作 id） | props：`show: boolean`、`operation: StockOperation \| null`；emits：`update:show`、`reversed: [id: number]` |
| `ShareLinkDialog.vue` | 分享链接生成弹窗（确认信息与失效时间 → 再次确认 → 生成并复制链接） | props：`show: boolean`、`shareType: ShareType`、`itemIds?: number[]`、`title: string`；emit：`update:show` |
| `SortableHeader.vue` | 表头排序下拉（默认/升序/降序），高亮当前排序状态 | props：`label: string`、`sortByKey: string`、`sortBy: string \| null`、`sortOrder: 'asc' \| 'desc' \| null`；emit：`select` |
| `HazardFormModal.vue` | 隐患登记 / 编辑弹窗（新增与编辑共用，删除入口在页脚左下角，责任人由责任单位只读联动） | props：`show: boolean`、`hazardId?: number \| null`（默认 null，null 为新增）；emits：`update:show`、`saved` |
| `HazardLevelTag.vue` | 隐患等级标签（一般隐患 / 重大隐患），色值取自 `hazardLevelTypes` | props：`level: HazardLevel` |
| `HazardStatusTag.vue` | 整改状态标签（待整改 / 整改受阻 / 已整改），色值取自 `hazardStatusTypes` | props：`status: HazardStatus` |
| `LedgerItemFormModal.vue` | 台账记录新增 / 编辑弹窗（标签多选树 + 图片上传，删除入口在页脚） | props：`show: boolean`、`itemId?: number \| null`（默认 null，null 为新增）；emits：`update:show`、`saved` |
| `LedgerTagFormModal.vue` | 标签新增 / 编辑弹窗（上级标签选择、备注、图片；新增子标签时预填上级） | props：`show: boolean`、`tag?: LedgerTag \| null`、`parentId?: number \| null`（组件自行加载全量标签）；emits：`update:show`、`saved` |
| `WorkRangePicker.vue` | 工作管理的日期区间选择器：日期区间 + 今天 / 本周 / 下周 / 本月 / 上月快捷档，超过 92 天就地收窄并提示 | props：`modelValue: WorkRange`、`disabled?`；emit：`update:modelValue` |
| `WorkTimelineGrid.vue` | 半日格时间线网格：粘性名称列 + 每天两个半天列，色块按泳道分层（最多 3 层，超出显示「+N」），Shift + 滚轮横向滚动；任务视图与人员视图共用 | props：`labelTitle`、`days`、`columns`、`rows`、`loading?`、`emptyText?`、`labelOf`、`titleOf`、`colorOf`；emit：`selectInterval`；插槽：`label`、`actions` |
| `WorkTaskFormModal.vue` | 任务新增 / 编辑弹窗（名称 / 状态 / 计划起止 / 工作内容 / 备注 / 图片，删除入口在页脚） | props：`show: boolean`、`taskId?: number \| null`（默认 null，null 为新增）；emits：`update:show`、`saved` |
| `WorkRecordFormModal.vue` | 工作记录新增 / 编辑弹窗（任务可搜索下拉、起止日期 + 上午 / 下午、参与人员可输入新姓名、备注；`readonly` 时变成只读详情） | props：`show`、`recordId?`、`presetTaskId?`、`presetDate?`、`presetParticipants?`、`readonly?`；emits：`update:show`、`saved` |
### Composable 清单
`web/src/composables/` 下 7 个 `.ts`（不含 `.spec.ts`），全部为函数式组合式 API：

| Composable | 职责 | 关键返回项 | 典型使用位置 |
| --- | --- | --- | --- |
| `usePagedTable.ts` | 统一列表分页/加载/筛选/URL 同步：`load/query/changePage/changePageSize/resetFilters`，可选 `rollbackEmptyPage` 防空页回退、`paginated: false` 全量拉取、`urlSync` 把 page/page_size/筛选写回 URL（`preservedQueryKeys` 声明要原样保留的非筛选参数，如详情弹窗的 `detail`，从当前 `route.query` 实时读）；只采纳最后一次发起的请求（旧响应丢弃）；不传 `onError` 时在组件内默认弹出错误消息，并暴露 `error` 供页面区分「加载失败」与「确实为空」；keepAlive 重新激活时若 URL 带了与本地不同的筛选条件（工作台指标卡等直达）则按 URL 恢复并重查，`create` 视为一次性动作参数不算筛选 | `items`、`total`、`page`、`pageSize`、`loading`、`error`、`filters`、`pageSizeOptions`、`load`、`query`、`changePage`、`changePageSize`、`resetFilters`、`syncRoute` | 19 个列表页（仓库 5、申购 5、设置 5、隐患 3、台账 1） |
| `useExportJob.ts` | 异步导出任务轮询：提交 → 轮询到 `SUCCEEDED`/`FAILED`（默认 1500ms 间隔），失败抛 `AppError` | `running`、`run(payload)` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useImportJob.ts` | 异步导入任务轮询：同样的提交+轮询流程，带同步重入保护（重复提交抛 `IMPORT_IN_PROGRESS`），成功返回 `result` | `running`、`run(file)` | `HuaXingStockView`、`SecondaryWarehouseLiteView`、`MaterialCodeLibraryView` |
| `useImportConfirm.ts` | 全量更新导入的确认弹窗：确认后立刻禁用按钮并切换进行中文案，防重复提交（`maskClosable/closeOnEsc` 均为 false），错误交给 `onError` | 返回 `confirmImport(options)` 函数 | 同上三个导入页面 |
| `useImplicitAiSearch.ts` | 隐式 AI 搜索：用户显式展开关键词优先，源输入变化时自动清除展开值 | `searchName`、`applyExpandedName(value)`、`clearExpandedName()` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useMaskCloseGuard.ts` | 详情弹窗的统一关闭入口（点遮罩 / ESC / 右上角 ×）：无未保存修改直接关，有修改先二次确认；脏判定由调用方实时求值 | `requestClose()` | 5 个详情弹窗（物资 / 流水 / 工作记录 / 计划 / 记录） |
| `useShiftWheelHorizontalScroll.ts` | 在表格滚动容器上支持 Shift+滚轮横向滚动 | 无返回值（内部挂/卸 `wheel` 监听，`passive: false`） | 申购 3 个列表页 |



### 其它 src 子目录
#### `web/src/utils/`
| 文件 | 职责 |
| --- | --- |
| `decimal.ts` | Decimal 字符串处理：**前端数量/库存全部用字符串而不是 number**，避免浮点误差与后端 `Decimal` 精度丢失。导出 `isDecimalString(value, decimalPlaces = 1, allowZero = false)`（正则 `^\d+(?:\.\d)?$` + 小数位/整数位上限 + 是否允许 0）、`decimalPlacesOf`、`normalizeDecimal`、`compareDecimal`、`subtractDecimal`，内部用 `BigInt` 对齐小数位比较与相减 |
| `download.ts` | Blob/URL 下载、`exportDownloadUrl(fileUuid)`、解析 `Content-Disposition` 文件名、`downloadBlobWithDisposition` |
| `image.ts` | 图片类型/大小校验（允许 `image/jpeg`/`png`/`webp`，上限 10MB）、`configureImageBaseUrl`、`imageUrl`、`imagePreviewUrl`；免重复上传相关：`dedupMinBytes`（1MB 门槛）、`shouldCheckDuplicate(file)`、`matchesDedupSlice(file, slice)`（对本地同位置字节做二次校验） |
| `sha256.ts` | 纯 JS SHA-256（局域网 HTTP 下没有 `crypto.subtle`）：`createSha256()` 增量哈希、`sha256Hex(bytes)`、`readBlobBytes(blob)`（优先 `Blob.arrayBuffer`，回退 `FileReader`）、`hashBlob(blob, { chunkSize, onProgress, shouldAbort })` 分块哈希并在块间让出主线程 |
| `memoDrafts.ts` | 备忘录未保存草稿的 IndexedDB 暂存：按 `${userId}:${memoId}` 隔离，不可用时静默降级为无操作，另有 `hasPendingDraft` |
| `memoFontSize.ts` | 备忘录编辑区字号偏好（`localStorage` key `memos.font-size`，档位 `14/16/18/20/24`，默认 16px）：`MEMO_FONT_SIZE_OPTIONS`、`normalizeMemoFontSize`、`readMemoFontSize`、`writeMemoFontSize`；非法 / 越界值回落默认且不写回脏值，存储不可用时静默降级 |
| `naiveDarkTheme.ts` | Naive UI 深色主题按需加载：`loadNaiveDarkTheme()`（缓存同一个 Promise，首次需要深色时才动态导入 `naive-ui/es/themes/dark`）、`naiveDarkTheme`（已加载的主题，未加载为 null）；`App.vue` 在解析为深色时触发，`main.ts` 在深色档下 mount 前等它就绪避免首屏先浅后深 |
| `stockMaterialCache.ts` | 物资选择器的请求合并：`fetchDefaultStockMaterials()`（前 200 条，15s 短时缓存，失败不缓存）、`fetchStockMaterial(id)`（只合并同时发出的重复请求）、`invalidateStockMaterialCache()`（出入库成功后调用） |
| `themeMode.ts` | 界面外观偏好（`localStorage` key `theme.mode`，档位 `auto` / `light` / `dark`，默认 `auto`）：`THEME_MODE_OPTIONS`、`normalizeThemeMode`、`readThemeMode`、`writeThemeMode`；非法值回落 `auto` 且不写回脏值，存储不可用时静默降级。`index.html` 的首屏预置脚本用同一套 key 与档位规则 |
| `purchase.ts` | 申购默认值辅助：`defaultPurchaseOrderNo`、`getLastPurchaseResponsible`、`rememberPurchaseResponsible`（本地记住上次填写人） |
| `routeQuery.ts` | 路由 query 读写辅助：`routeQueryString`、`routeQueryPositiveInteger`、`compactRouteQuery`（压缩空值） |
| `navigation.ts` | 后台侧栏主 tab 可见性纯逻辑：`NAV_FEATURES`（8 个主 tab 的 key / 标签 / 代表路由，数组顺序即侧栏顺序；系统管理不参与）、`ALL_NAV_FEATURES_VISIBLE`、`visibleNavFeatureKeys(flags)`（缺字段按可见、全关回落全可见）、`isNavFeatureVisible(flags, key)`、`resolveLandingRouteName(flags, { isLiteMode })`（落地页推导） |
| `settings.ts` | `inventoryModeOptionsFor(secondaryWarehouseMode)`：精简模式下不提供「可读写」选项 |
| `tableRowNavigation.ts` | `createTableRowClickGuard()`：区分行点击与行内按钮/选择交互，避免误跳转 |
| `tableText.ts` | `renderTwoLineText(primary, secondary)`：表格单元格两行文本渲染；`renderMaterialCode(value)`：物料编码列等宽展示 |
| `time.ts` | 时间格式化（东八区）：`formatShanghaiTime`、`toIsoWithTimezone`、`toShanghaiDate`、`formatDate`、`dateToTimestamp`（空值返回 null，避免日期选择器默认成今天） |
| `hazard.ts` | 隐患纯逻辑：`hazardStatuses` / `hazardLevels` / `hazardStatusTypes` / `hazardLevelTypes`（状态与等级选项、标签色）、`initialHazardFilters()` / `hazardQuery(filters)`（筛选默认值与 URL query 互转）、`isHazardOverdue(dueDate, status, today)`（逾期判定）、`buildHazardTypeTree(types)`（扁平「大类 + 小类」→ 两级横向树） |
| `work.ts` | 工作管理纯逻辑：`WORK_RANGE_MAX_DAYS`（与后端同值）、`shanghaiToday` / `addDays` / `workRangePresets`（今天 / 本周 / 下周 / 本月 / 上月）/ `defaultWorkRange`（本月整月）/ `rangeDays` / `clampWorkRange`（超限就地收窄）、`initialWorkOverviewFilters` / `initialWorkTaskFilters` / `initialWorkWorkerFilters` 与 `workOverviewQuery` / `workTaskQuery` / `workWorkerQuery` 及对应 `*FromQuery`（筛选与 URL 互转）、`parseIdList` / `parseNameList` / `parseStatusList` / `formatIdList` / `formatNameList`、`buildDaySlots` / `buildHalfColumns`（日 × 上下午列）、`recordSlotLabel` / `recordHalfKeys`（半天占用口径与后端 `record_slots` 一致）、`buildTimelineRow`（贪婪泳道打包 + 溢出计数）、`workBarPaletteIndex` / `workBarHash`（固定色板）、`formatRecordRange` / `sortParticipantNames` / `participantOptions` / `overviewRowKey` / `weekdayLabel` / `workTaskStatuses` / `workTaskStatusOptions` / `workTaskStatusTypes` / `workHalfOptions` / `workHalfLabel` |
| `ledger.ts` | 台账标签纯逻辑：`parseTagIds` / `formatTagIds`（`tag_ids` 逗号串与数组互转）、`isOrphanTag`（孤立标签判定）、`tagItemCount` / `tagItemCountHint`（节点上的台账使用数量与 tooltip 文案；字段缺失时返回 `null` 不显示徽标）、`tagPath`（完整层级路径）、`collectSubtreeIds`（节点自身 + 全部子孙，改上级时排除可选父节点）、`buildLedgerTagTree`（扁平标签 → 横向树，返回全新对象）、`tagSelectOptions` / `tagParentOptions`（标签选择器与上级选择器选项，后者支持按节点排除子树）、`tagColumnDisplay`（标签列展示切片）、`ledgerQuery` / `ledgerFiltersFromQuery`（筛选与 URL 同步） |
#### `web/src/constants/`、`types/`、`config/`
| 文件 | 职责 |
| --- | --- |
| `constants/branding.ts` / `constants/purchase.ts` | `LOGO_URL = publicUrl('logo.png')`（512px，登录页大图；按构建 base 拼前缀，子路径部署也正确）、`LOGO_MARK_URL = publicUrl('logo-96.png')`（侧栏 / 抽屉品牌行用的小图）；申购默认值/选项：`defaultPurchasePlanStatus`、`purchasePlanStatusOptions`、`defaultDemandDepartment`、`defaultPurchaseUrgency`、`purchaseUrgencyOptions`、`purchaseCategoryOptions` |
| `constants/shareColumns.ts` | 分享页可展示列定义（键名与后端 Literal 严格一致）：`SHARE_PLAN_COLUMNS`、`SHARE_RECORD_COLUMNS`、`shareColumnOptions()`、`SHARE_DEFAULT_HIDDEN_KEYS = ['status']`、`defaultShareColumnKeys()`，供 `ShareView` 渲染与 `ShareLinksView` 勾选共用 |
| `constants/table.ts` | `tableColumnWidths`（unit/quantity/date/datetime/status/person/code/identifier/name/material/model/text/action）、`preventTableColumnCompression`、`getTableScrollX` |
| `types/navigation.ts` | `Permission` 字面量联合（`warehouse:write`、`purchase:write`、`settings:write`、`hazard:write`、`ledger:write`、`read`）、`rolePermissions: Record<Role, Permission[]>`、`roleLabels: Record<Role, string>` |
| `types/export.ts` / `config/env.ts` | `ExportOption = DropdownOption & { label: string; key: string }`；VITE_* 解析（见 API 客户端一节的 baseURL 说明） |
| `theme.ts` | Naive UI `themeOverrides`（主题色 `#3f63d8`、圆角与阴影等），由 `App.vue` 传给 `n-config-provider` |
| `styles.css` | 全局样式与 CSS 变量：字体栈、`--color-primary/-success/-warning/-danger`、文本/边框/表面色、`--radius-control`、局部加载遮罩底色等 |
#### `web/src/layouts/`
页面文件与职责见「路由表」的职责列。`layouts/AppLayout.vue` 是唯一布局：`n-layout` + 侧边菜单（`menuOptions` 由 `layouts/mainMenu.ts` 的 `buildMainMenu()` 拼装，按 `auth.can()`、`settings.isLiteMode` 与「后台可见功能」开关 `settings.isFeatureVisible()` 过滤：工作台、备忘录、二级库分组或精简二级库、华星总库存、申购管理、隐患管理、台账管理、工作管理、系统管理；被关闭的主 tab 整个分组不渲染，系统管理始终显示），顶栏含用户信息与下拉（「外观」二级菜单：悬浮父项向左展开自动/浅色/深色三档；随后「项目：<当前项目名>」二级菜单，由 `layouts/projectMenu.ts` 的 `buildProjectMenuSubmenu()` 生成、`projectIdFromMenuKey()` 解析选中项，切换后整页刷新；分隔线之后是「退出登录」，调 `auth.logout()` + 跳 `login`；顶栏不放独立的明暗切换图标）；`layouts/projectMenu.ts` 另外导出 `PROJECT_MENU_KEY`、`PROJECT_NONE_KEY`（无可用项目时的占位项）等固定 key。`useMediaQuery('(max-width: 768px)')` 时侧栏切换为抽屉（桌面 sider 与移动抽屉共用同一份 `menuOptions`，可见性一处生效）。




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
| `VITE_BASE_PATH` | 子路径部署前缀（如 `/Electrical-Manager/demo/`），写进 Vite `base`；缺省 `/` 与既有部署一致（演示构建见 `web/.env.demo`） |
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

Go + Gin 单进程服务（PostgreSQL 16+ / pgx），源码在 `server/`，Go 模块名 `github.com/Sakana-1314/Electrical-Manager/server`，入口 `cmd/server`。

| 入口 | 路径 |
| --- | --- |
| 管理端 REST | `/api/v1/*` |
| 微信小程序 | `/api/v1/mini-program/*` |
| MCP（Streamable HTTP） | `/api/v1/mcp/` |

运行：开发 `go run ./cmd/server`（或 `make run`）；容器 `ENTRYPOINT ["/app/server"]`，监听 `APP_HOST:APP_PORT`（默认 `0.0.0.0:8000`）。同一进程内还有若干常驻后台 goroutine（见「日志、配置与后台任务」）。

<Tabs :tabs="[
  { id: 'be-layers', title: '分层与请求链' },
  { id: 'be-auth', title: '认证与权限' },
  { id: 'be-errors', title: '错误与响应头' },
  { id: 'be-data', title: '项目隔离与数据库' },
  { id: 'be-ops', title: '日志、配置与后台任务' },
  { id: 'be-mcp', title: 'MCP、契约、测试与部署' }
]">

<TabsContent id="be-layers">

## 分层架构
分层调用方向为 `api → service → schema / model`；service 之间单向依赖（如 `service/inventory` 调用 `service/webhook`），不得循环导入（Go 编译期即拒绝）。api 层只调 service，不直接写 SQL。

| 层 | 目录 | 职责 |
| --- | --- | --- |
| 路由层 | `server/internal/api/<模块>`、`server/internal/api/deps` | 用 `web.Router` 注册路由并列出依赖；经 `c.Params()` 解析与校验路径 / 查询 / 请求头 / 请求体（`ge=1`、`le=200`、`max=128`、`oneof=asc\|desc` 等规则写在参数调用或结构体 `v` 标签上）；把 service 结果组装成 `schema.Page[T]` 等响应；参数类业务错误用 `apperr.New` 返回 |
| 服务层 | `server/internal/service/<模块>` | 业务规则与状态流转校验、乐观锁校验（`apperr.ValidateVersion`）、SQL（`?` 占位符，显式带 `project_id` 过滤）、行锁（`FOR UPDATE` / `FOR UPDATE SKIP LOCKED`）、审计事件（`common.LogEvent`）、read 模型组装、后台任务编排 |
| 契约层 | `server/internal/schema`、`server/internal/domain` | 请求 / 响应结构体（与 `docs/openapi.yaml` 字段与格式逐一对应，`v` 标签声明校验规则）、`Page[T]`；领域枚举（`Role`、`OperationType`、`SourceType`、`PurchasePlanStatus` 等）及名称 ↔ 值转换（`domain.<Enum>.ToDB` / `FromDB`） |
| 模型层 | `server/internal/model` | 表结构体与列清单常量（`models_gen.go`，与 `docs/references/database/init.sql` 一致），项目域表清单 `ProjectScopedTables` |
| 基础层 | `server/internal/{web,db,auth,middleware,config,logx,lifecycle,openapi,apperr,jtype,security}`、`server/internal/app` | 请求处理框架、事务会话与项目上下文、鉴权依赖、中间件、配置、日志、启动清理与后台任务登记、内嵌契约、错误体、JSON 类型（`jtype.UTCTime` / `jtype.Date` / `jtype.Decimal`）、密码哈希 / JWT / Fernet / UUIDv7；`app.New()` 组装 Gin 引擎 |

## 后端目录结构
`server/` 下 `cmd/` 与 `internal/` 共 118 个非测试 Go 文件：

```text
server/
├── cmd/server/main.go  # 入口：读配置 → 建上传目录 → 初始化日志 → 打开连接池 → 启动清理 → 后台任务 → HTTP 服务；`server healthcheck` 子命令
├── internal/app/       # app.New()：中间件、NoRoute/NoMethod、/health、/api/v1/openapi.json、/api/docs、业务路由与 MCP 绑定；路由一致性测试
├── internal/api/       # 17 个路由包：aisearch、codelib、deps、exportjob、files、hazard、huaxing、ledger、mcp、
│                       #   miniprogram、purchase、secondary、settings、share、stock、system、work
├── internal/service/   # 29 个业务包：aisearch、attachment、codelib、common、dashboard、dictionary、excelexport、
│                       #   exportjob、file、hazard、huaxing、importfile、importjob、inventory、ledger、lite、material、
│                       #   memo、miniprogram、plancleanup、plantemplate、price、project、purchaserequest、recordsync、
│                       #   replenishment、share、webhook、work
├── internal/web/       # Router（依赖链）、Ctx、Params（参数校验 → 422）、先提交再写响应、统一错误体
├── internal/db/        # 连接池、请求级事务会话、项目 / 系统上下文、`?` → `$n` 方言转换、语句耗时统计、SQLSTATE 错误分类
├── internal/auth/      # 管理端 / 小程序鉴权、角色依赖、RequireProject / SystemScope、默认项目解析
├── internal/middleware/ # RealIP、RequestContext（request_id / 耗时头 / 访问日志）、Recovery、ProjectHeader、CORS
├── internal/config/    # Settings（APP_ 前缀环境变量 + server/.env）
├── internal/logx/      # 控制台 + 按天轮转、按月归档的文件日志（log/slog）
├── internal/lifecycle/ # 启动任务 / 常驻任务 / 退出收尾的登记与调度
├── internal/openapi/   # 内嵌契约副本 openapi.yaml（make sync-openapi 同步）及 JSON、Swagger UI、操作清单
├── internal/schema/    # 请求 / 响应结构体
├── internal/model/     # 表结构体（models_gen.go）、列清单、ProjectScopedTables
├── internal/domain/    # 领域枚举
├── internal/apperr/    # 业务错误与默认状态码表
├── internal/jtype/     # UTCTime / Date / Decimal / JSON 等序列化类型
├── internal/security/  # argon2id、JWT、Fernet、SHA-256、UUIDv4 / UUIDv7
├── templates/          # Excel 导出模板（3 个 JSON 布局）
├── tools/run_contract_tests.sh  # 黑盒契约测试入口
└── tests/              # 黑盒契约测试（pytest，HTTP 调用运行中的服务）
```

`internal/api/<模块>` 与接口前缀的对应：

| 路由包 | 接口前缀 | 依赖（按需列出） |
| --- | --- | --- |
| `api/system` | `/auth`、`/users`、`/memos`、`/version`、`/projects` | `auth.CurrentUser`、`auth.SuperAdmin`；`/version` 公开 |
| `api/aisearch` | `/ai-search` | `auth.SuperAdmin`、`auth.CurrentUser` |
| `api/settings` | `/system-settings` | `auth.SuperAdmin`（`/system-settings/mini-program-features`、`/system-settings/image-acceleration` 公开读取） |
| `api/stock` | `/stock-materials`、`/inventory*`、`/dashboard/summary` | `auth.RequireProject`、`auth.CurrentUser`、`auth.WarehouseWriter`、`deps.RequireFullSecondaryWarehouse` |
| `api/codelib` | `/material-code-library` | `auth.RequireProject`、`auth.CurrentUser`、`auth.PurchaseWriter` |
| `api/huaxing` | `/huaxing-inventory` | `auth.RequireProject`、`auth.CurrentUser`、`auth.WarehouseWriter` |
| `api/secondary` | `/secondary-warehouse` | `auth.RequireProject`、`auth.CurrentUser`、`auth.WarehouseWriter` |
| `api/miniprogram` | `/mini-program-users`（管理端）、`/mini-program/*`（小程序） | `auth.SuperAdmin`；`auth.MiniProgramUser`、`auth.MiniProgramRegistration` |
| `api/purchase` | `/purchase-materials`、`/purchase-plan-templates`、`/purchase-record-sync/*`、`/purchase-records*` | `auth.RequireProject`、`auth.CurrentUser`、`auth.PurchaseWriter` |
| `api/share` | `/shares` | `auth.CurrentUser`；`GET /shares/{token}` 匿名 |
| `api/exportjob` | `/excel-export-jobs` | `auth.CurrentUser`；`GET /excel-export-jobs/files/{file_uuid}` 匿名 |
| `api/files` | `/files/images` | 分组挂 `auth.SystemScope`；上传 / 查重用各写角色（`auth.Roles`），附件治理用 `auth.SuperAdmin`；读图公开 |
| `api/hazard` | `/hazards*`、`/hazard-types`、`/hazard-units` | `auth.RequireProject`、`auth.CurrentUser`、`auth.HazardWriter` |
| `api/ledger` | `/ledger-items`、`/ledger-tags` | `auth.RequireProject`、`auth.CurrentUser`、`auth.LedgerWriter` |
| `api/work` | `/work-tasks`、`/work-records`、`/work-overview`、`/work-task-timeline`、`/work-worker-timeline`、`/work-participants` | `auth.RequireProject`、`auth.CurrentUser`、`auth.WorkWriter` |
| `api/mcp` | `/mcp/` | 自带令牌认证（见 MCP 小节） |

路由注册顺序集中在 `internal/api/api.go` 的 `Register`。`/__test__/*` 钩子只在 `APP_TEST_HOOKS=1` 时注册，供契约测试驱动后台任务与上游桩服务，生产环境不存在。

## 请求处理链

中间件在 `internal/app` 里按 **由外到内** 注册：真实 IP → 请求上下文（request_id / 耗时头 / 访问日志）→ panic 兜底 → 项目头 → CORS；之后进入 `web.H` 包装的处理函数。

```mermaid
sequenceDiagram
    participant C as 客户端
    participant RIP as RealIP
    participant RC as RequestContext
    participant PH as ProjectHeader
    participant CORS as CORS
    participant H as web.H
    participant DB as PostgreSQL
    C->>RIP: HTTP 请求
    RIP->>RC: 取可信代理头里的真实 IP
    RC->>PH: 生成 / 沿用 request_id，挂上 DB 计时器
    PH->>CORS: 可解析的正整数 X-Project-Id 落进请求上下文
    CORS->>H: 预检直接 200 返回；正常请求补 CORS 头
    H->>H: 新建请求会话（带上项目头）
    H->>H: 依赖按声明顺序执行（分组依赖在前、路由依赖在后）
    H->>H: 参数统一校验，全部错误合并为一次 422
    H->>DB: 处理函数执行 SQL（首条语句时惰性开启事务）
    alt 处理函数返回错误
        H->>DB: 回滚
        H-->>C: 统一错误体
    else 成功
        H->>DB: 提交事务
        H-->>C: 写出响应（此刻写库已可见）
    end
    RC->>RC: 写耗时响应头与访问日志
```

| 环节 | 实现 |
| --- | --- |
| 中间件 | `middleware.RealIP()` → `middleware.RequestContext()` → `middleware.Recovery()` → `middleware.ProjectHeader()` → `middleware.CORS()`（`internal/app/app.go`）；`RequestContext` 在 RealIP 内层以便日志读到改写后的 IP；CORS 在最内层，`NoRoute` 的 400 与各类错误体同样带 CORS 头 |
| 依赖顺序 | `web.Router.Group(prefix, deps...)` 的分组依赖先于路由依赖；习惯顺序为项目（`auth.RequireProject`）→ 鉴权（`auth.CurrentUser`）→ 角色（`auth.WarehouseWriter` 等，内部会先确保已鉴权）→ 其它（`deps.RequireFullSecondaryWarehouse`）；任一依赖返回错误立即中止，参数尚未校验 |
| 参数校验与 422 | 依赖全部通过后，处理函数用 `c.Params()` 读取路径（`PathInt`）、查询（`QueryStr` / `QueryInt` / `Page` …）、请求头（`IfMatch`）、JSON 请求体（`Body`），每处的错误都追加进同一个列表，最后 `p.Err()` 一次性返回 `*web.ValidationError` → 422 `VALIDATION_ERROR`，`details.errors` 为 `type` / `loc` / `msg` / `input` 结构（与 Pydantic 兼容） |
| 先提交再写响应 | 处理函数通过 `c.OK` / `c.Created` / `c.NoContent` / `c.File` 等只是**登记**响应；`web.H` 在函数返回后先 `c.DB.Commit()` 再写出响应，所以客户端拿到 2xx 时写库已可见；提交失败按数据库错误返回错误体。出错则 `Rollback()`。处理函数不手动提交，提交后才做的事登记 `c.DB.AfterCommit`（回滚后的补偿用 `AfterRollback`） |
| panic | 处理函数里的 panic 由 `web.H` 转成 500 `INTERNAL_SERVER_ERROR`；中间件层的 panic 由 `middleware.Recovery()` 兜底 |
| 路由细节 | Gin 关闭 `RedirectFixedPath`、开启 `RedirectTrailingSlash` 与 `HandleMethodNotAllowed`；路由定义沿用契约里的 `{item_id}` 写法，由 `web.Router` 转成 Gin 的 `:item_id`；multipart 内存上限 32 MB（超出部分落临时文件） |

</TabsContent>

<TabsContent id="be-auth">

### 认证与权限
#### 角色与依赖（`server/internal/auth`、`server/internal/domain`）
| 名称 | 定义 | 说明 |
| --- | --- | --- |
| 角色 | `domain.RoleSuperAdmin` / `RoleWarehouseAdmin` / `RolePurchaseAdmin` / `RoleHazardAdmin` / `RoleLedgerAdmin` / `RoleWorkAdmin` / `RoleReadOnly` | 七个字符串常量（`SUPER_ADMIN` … `READ_ONLY`），存 `user.role`（PostgreSQL 枚举类型 `role`） |
| `auth.Roles(roles...)` | 依赖工厂 | 先确保 `CurrentUser`，角色不在集合内返回 `FORBIDDEN`（403） |
| `auth.CurrentUser` | 依赖 | 管理端用户（Bearer JWT、`X-API-Token` 或 Bearer 接口令牌）；同一请求只解析一次，并把用户名写进访问日志 |
| `auth.WarehouseWriter` | `auth.Roles(SUPER_ADMIN, WAREHOUSE_ADMIN)` | 库存写操作 |
| `auth.PurchaseWriter` | `auth.Roles(SUPER_ADMIN, PURCHASE_ADMIN)` | 申购写操作 |
| `auth.HazardWriter` | `auth.Roles(SUPER_ADMIN, HAZARD_ADMIN)` | 隐患管理写操作（台账与两张字典表） |
| `auth.LedgerWriter` | `auth.Roles(SUPER_ADMIN, LEDGER_ADMIN)` | 台账管理写操作（台账记录与标签） |
| `auth.WorkWriter` | `auth.Roles(SUPER_ADMIN, WORK_ADMIN)` | 工作管理写操作（任务、工作记录与任务图片） |
| `auth.SuperAdmin` | `auth.Roles(SUPER_ADMIN)` | 系统配置、用户、文件治理 |
| 图片上传角色 | `api/files` 的 `auth.Roles(...)`（除 `READ_ONLY` 外的六个角色） | 图片上传与上传前查重 |
| `auth.MiniProgramUser` | 依赖 | 小程序用户；未审核（`enabled=false`）返回 `ACCOUNT_DISABLED`（403）；同时落定项目上下文（带 `X-Project-Id` 按头校验，缺头用默认项目） |
| `auth.MiniProgramRegistration` | 依赖 | 校验注册凭证，`auth.Registration(c)` 返回 `(app_id, openid)`，供注册 / 绑定用 |
| `auth.RequireProject` | 依赖 | 校验 `X-Project-Id` 并设为本请求会话的项目上下文（见「项目隔离与数据库」） |
| `auth.SystemScope` | 依赖 | 把整个请求切到系统（跨项目）上下文，用于全局附件池接口 |
| `deps.RequireFullSecondaryWarehouse` | 依赖 | 二级库精简模式下拦截写接口，返回 `SECONDARY_WAREHOUSE_LITE_MODE`（403） |
| `c.DB` | `*db.Session` | 请求级会话，由 `web.H` 创建 |
| `p.IfMatch()` | 参数读取 | 从 `If-Match` 头读乐观锁版本 |

#### 接口令牌（`X-API-Token`）与双列存储
| 项 | 规则 |
| --- | --- |
| 取用顺序 | `auth.AuthenticateManagementUser` 依次尝试 `X-API-Token` → Bearer 值（长度 ≤ 36 时先按接口令牌试，命中停用用户直接报 `USER_DISABLED`）→ 按 JWT 解析 |
| 查找 | 令牌为 36 位；`auth.FindUserByAPIToken` 先用长度 ≠ 36 快速排除，再按 SHA-256 命中 `user.api_token_hash` |
| 懒迁移回写 | 命中且 `user.api_token_enc` 为空时，用该明文令牌 `security.EncryptSecret()` 回写密文（随请求事务提交），使管理界面之后可解密回显（`api_token_hash` 认证 + `api_token_enc` 可逆回显双列） |
| MCP 入口 | MCP 认证同样走 `auth.FindUserByAPIToken`，取令牌顺序 `?token=` → `X-API-Token` → `Authorization: Bearer`，并立即提交懒迁移结果 |

#### JWT `token_type` 取值（`server/internal/security` 生成，`server/internal/auth` / `api/system` 校验）
签名算法取 `APP_JWT_ALGORITHM`（默认 `HS256`），校验时只接受该算法。

| `token_type` | 生成函数 | 有效期 | 校验点 |
| --- | --- | --- | --- |
| `management_access` | `security.CreateAccessToken` | `APP_ACCESS_TOKEN_MINUTES`（默认 30 分钟） | `auth.AuthenticateManagementUser`，同时兼容历史值 `management` 与缺失 |
| `management_refresh` | `security.CreateRefreshToken` | `APP_REFRESH_TOKEN_DAYS`（默认 7 天），带 `version` 与 `jti` 声明 | `api/system` 续期接口 |
| `mini_program` | `security.CreateMiniProgramAccessToken` | `APP_ACCESS_TOKEN_MINUTES` | `auth.MiniProgramUser` |
| `mini_program_registration` | `security.CreateMiniProgramRegistrationToken` | 固定 10 分钟，带 `app_id` 声明 | `auth.MiniProgramRegistration` |
三类凭据互不通用；注册令牌只能用于绑定/注册接口（`token_type` 不匹配即 `INVALID_TOKEN`）。密码哈希为 argon2id（PHC 字符串，`t=3, m=65536, p=4`），同时能校验 argon2i 格式。

#### 乐观锁版本（`If-Match`）
所有带乐观锁的写操作（PATCH/PUT/DELETE/restore）版本号放 `If-Match` 头而非 query 参数，**避免版本号进入访问日志**（`web.Params.IfMatch`，允许带引号）；缺失或非整数时返回 `nil`，由 service 决定是否强制（`apperr.ValidateVersion` → `VERSION_CONFLICT`，`details` 带 `expected`/`actual`）。

#### 角色、权限点与能力

`domain` 里的角色只有一个字段一个角色，无多角色组合；权限点为 `web/src/types/navigation.ts` 的 `rolePermissions`。

| 角色 | 权限点 | 能力 |
| --- | --- | --- |
| `SUPER_ADMIN` 超级管理员 | `warehouse:write`、`purchase:write`、`settings:write`、`hazard:write`、`ledger:write`、`work:write`、`read` | 全部能力：二级库物资增删改与安全库存、入库/出库/修改流水/冲销、精简二级库 Excel 导入、申购计划增删改与补录编码、关联二级库物资、转入/恢复申购记录与批量修改、采购跟踪同步回写、物料编码库导入与查询、查询已归档计划（`status=ARCHIVED`）、管理端用户/接口令牌/小程序用户合并、高级设置（AI 搜索、精简模式、小程序功能模式、Webhook）、图片孤儿文件排查清理、隐患台账与隐患类型/责任单位维护、台账记录与标签维护、任务与工作记录维护（含任务图片）、创建/撤回分享链接、创建导出任务 |
| `WAREHOUSE_ADMIN` 仓库管理员 | `warehouse:write`、`read` | 二级库物资增删改与安全库存、入库/出库/修改流水/冲销、精简二级库 Excel 导入、创建/撤回分享链接、创建导出任务；其余只读 |
| `PURCHASE_ADMIN` 申购管理员 | `purchase:write`、`read` | 申购计划增删改与补录编码、关联二级库物资、转入/恢复申购记录与批量修改、采购跟踪同步回写、物料编码库导入与查询、创建/撤回分享链接、创建导出任务；其余只读 |
| `HAZARD_ADMIN` 隐患管理员 | `hazard:write`、`read` | 隐患台账增删改、隐患类型与责任单位维护、隐患图片上传；其余只读 |
| `LEDGER_ADMIN` 台账管理员 | `ledger:write`、`read` | 台账记录增删改、标签树维护（至多 3 层）与标签图片上传；其余只读 |
| `WORK_ADMIN` 工作管理员 | `work:write`、`read` | 任务与工作记录增删改、任务图片上传；其余只读 |
| `READ_ONLY` 只读角色 | `read` | 工作台、备忘录、华星总库存、库存/流水查询、隐患台账查询、台账总览查询、工作管理三个视图查询、创建/撤回自己的分享链接、创建导出任务 |

#### 越权结果

| 越权场景 | 结果 | 实现 |
| --- | --- | --- |
| 写接口权限不足 | `403 FORBIDDEN` | `auth.Roles` |
| 查询已归档申购计划 | `403 ARCHIVED_PURCHASE_PLAN_FORBIDDEN` | `api/purchase` |
| 精简模式下调用完整模式写接口 | `403 SECONDARY_WAREHOUSE_LITE_MODE` | `deps.RequireFullSecondaryWarehouse` |

前端按 `auth.can(permission)` 隐藏入口（`layouts/AppLayout.vue`、`router/index.ts` 的 `meta.permission`），**权限的最终判定在后端**。

</TabsContent>

<TabsContent id="be-errors">

### 错误处理与响应头
#### 错误码 → 默认 HTTP 状态码（`server/internal/apperr`）
`apperr.New(code, message)` 按下表推断状态码，表中没有的 code 兜底为 `400`；`WithStatus(n)` 显式指定时以显式值为准，`WithDetails(...)` 附带结构化详情。

| code | 默认 HTTP | code | 默认 HTTP |
| --- | --- | --- | --- |
| `NOT_FOUND` | 400 | `ACCOUNT_DISABLED` | 403 |
| `VERSION_CONFLICT` | 409 | `FORBIDDEN` | 403 |
| `INVALID_STATUS_TRANSITION` | 409 | `INVALID_TOKEN` | 401 |
| `DATA_CONFLICT` | 409 | `UNAUTHORIZED` | 401 |
| `VALIDATION_ERROR` | 422 | `USER_DISABLED` | 401 |
| `DUPLICATE_HAZARD_UNIT` | 409 | `DUPLICATE_HAZARD_TYPE` | 409 |
| `HAZARD_UNIT_IN_USE` | 409 | `HAZARD_TYPE_IN_USE` | 409 |
| `HAZARD_UNIT_PERSON_REQUIRED` | 400 | `DUPLICATE_LEDGER_TAG` | 409 |
| `LEDGER_TAG_HAS_CHILDREN` | 409 | `LEDGER_TAG_IN_USE` | 409 |
| `LEDGER_TAG_MAX_LEVEL` | 400 | `INVALID_TAG_ID` | 400 |
| `DUPLICATE_WORK_TASK` | 409 | `WORK_TASK_HAS_RECORDS` | 409 |
| `WORK_DATE_RANGE` | 400 | `WORK_RANGE_TOO_LONG` | 400 |
| `INVALID_WORK_TASK_ID` | 400 | `PROJECT_REQUIRED` | 400 |
| `PROJECT_NOT_FOUND` | 400 | `PROJECT_DISABLED` | 400 |
| `PROJECT_MISMATCH` | 409 | `PROJECT_IS_DEFAULT` | 409 |
| `PROJECT_IN_USE` | 409 | `DUPLICATE_PROJECT_NAME` | 409 |
错误响应体统一为 `{code, message, details, request_id}`（`web.ErrorBody`，`details` 为空时输出 `{}`），`request_id` 取请求上下文里的 request_id。全量业务错误码清单见 [/api-error-codes](/api-error-codes)，约定背景见 [接口约定](/api-conventions)。
#### 错误映射（`web.WriteError`）
| 错误类型 | 返回 code / status |
| --- | --- |
| `*apperr.Error` | 用错误自身的 `Code` 与 `Status`；`Details` 原样透出 |
| `*web.ValidationError` | `422 VALIDATION_ERROR`（message「请求参数校验失败」），`details.errors` 为字段错误列表（`type` / `loc` / `msg` / `input`，部分带 `ctx`） |
| SQLSTATE `23` 类（唯一键 / 外键 / 非空 / CHECK） | `409 DATA_CONFLICT`（记 warning 日志） |
| SQLSTATE `42` 类（语法错误 / 未定义列 / 未定义表 / 列名歧义） | `500 DATABASE_QUERY_ERROR` |
| SQLSTATE `08` / `53` 类、`57P*`，以及连接被拒、连接已关闭、超时等驱动层错误 | `503 DATABASE_UNAVAILABLE` |
| 其它带 SQLSTATE 的数据库错误 | `500 DATABASE_ERROR` |
| 其余错误（含处理函数 panic） | `500 INTERNAL_SERVER_ERROR`（记 error 日志） |
禁止 HTTP 404：资源不存在时 service 用 `apperr.NotFound(resource)` → `400 NOT_FOUND`（message「<资源>不存在」）；未匹配路由由 Gin 的 `NoRoute` 返回 `400 ROUTE_NOT_FOUND`（message「接口路径不存在」）；方法不匹配由 `NoMethod` 返回 `405 HTTP_ERROR`（message `Method Not Allowed`）；后端对外不产生 404，文件类接口同样遵循。
#### 中间件与性能响应头（`server/internal/middleware`）
`RequestContext` 为每个请求注入 `request_id`（取第一个 `X-Request-ID` 请求头，截断到 128 个字符，否则生成 UUIDv4）并写访问日志；耗时响应头在**响应头写出前一刻**补上（包住 `ResponseWriter`），因此包含事务提交耗时，只计量服务端时间。

| 响应头 | 含义 |
| --- | --- |
| `X-Request-ID` | 本次请求标识，与日志 `request_id` 一致 |
| `X-Response-Time` | 服务端处理总耗时（毫秒），从进入中间件到写出响应头 |
| `X-DB-Time` | 数据库语句执行耗时合计（毫秒），取 `min(采集值, 总耗时)` |
| `X-Compute-Time` | `总耗时 - DB 耗时`（毫秒），含校验/权限/序列化 |
| `X-DB-Queries` | 本次请求执行的 SQL 条数（含提交），用于识别 N+1 |
这 5 个头（加 `Content-Disposition`）都在 CORS 中间件的 `Access-Control-Expose-Headers` 中，跨域时可读。

| 中间件 | 规则 |
| --- | --- |
| `RealIP` | 取可信边缘代理给出的真实 IP，优先级 `EO-Connecting-IP` → `X-Real-IP` → `X-Forwarded-For` 的第一段；候选值需能被 `net.ParseIP` 解析，全部无效则用连接的远端地址 |
| `RequestContext` | request_id、DB 计时器、耗时响应头、访问日志（见「日志与 request_id」） |
| `Recovery` | 兜底中间件层未捕获的 panic，响应尚未写出时返回 `500 INTERNAL_SERVER_ERROR` |
| `ProjectHeader` | 把可解析的正整数 `X-Project-Id` 落进请求上下文（只解析、不查库）；`web.H` 新建会话时据此设定项目，真正的校验由 `auth.RequireProject` 完成 |
| `CORS` | **Referer 优先**（兼容不发 `Origin` 的内嵌 WebView/微信），无效或缺失回退 `Origin`；`Referer: null` 原样返回 `null`。白名单（`APP_CORS_ORIGINS`）为空表示不限制；否则需 `origin` 精确命中、或 `*`、或与 host 相同、或 `allowed` 以 `.` 开头时按 host 后缀匹配（`.example.com` 匹配 `app.example.com`）；未命中不回显 CORS 头。预检（`OPTIONS` + `Access-Control-Request-Method`）直接 200，方法白名单 `DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT`，回显请求的 `Access-Control-Request-Headers`，`Access-Control-Request-Private-Network: true` 时回私有网络头；正常响应补 `Vary: Origin, Referer` |
`internal/middleware` 的单元测试覆盖真实 IP、request_id 与耗时头、CORS 白名单与预检。

</TabsContent>

<TabsContent id="be-data">

### 项目隔离（`server/internal/db` + `server/internal/auth`）

业务数据按项目隔离，但**不是**多租户：没有用户-项目授权表，任何登录用户都能访问全部项目，只是同一请求只能处于一个项目。隔离由「会话上的项目上下文 + 业务 SQL 显式按 `project_id` 过滤」实现。

| 机制 | 实现 |
| --- | --- |
| 项目上下文 | `db.Session` 携带项目 id 与「系统上下文」标记；`auth.RequireProject` 校验 `X-Project-Id`（缺头 400 `PROJECT_REQUIRED`，非整数 422，项目不存在 / 停用 400 `PROJECT_NOT_FOUND` / `PROJECT_DISABLED`）后 `c.DB.SetProject(id)` |
| 读写过滤 | 项目域表的每条 SQL 都显式写 `project_id = ?`，项目 id 一律取 `s.ProjectID()`；列表查询用 `common.Where.Scope(s, alias)` / `s.ScopeFilter(alias)` 追加条件；INSERT 写入当前项目 id |
| fail-closed | `s.ProjectID()` 在未设定项目时返回 400 `PROJECT_REQUIRED`，绝不静默放行成「看到全部项目」 |
| 系统上下文 | 确实跨项目的入口显式进入系统上下文：`s.System()`（共享同一事务的副本）、`db.SystemSession(ctx)`（独立会话）、`auth.SystemScope`（整个请求）；系统上下文里 `ScopeFilter` 不加项目条件 |
| 切换项目 | `s.WithProject(pid)` 返回共享同一事务、处于指定项目的副本；后台任务用 `db.ProjectSession(ctx, job.ProjectID)` 按任务行恢复项目 |
| 唯一键 | 项目域唯一键都带 `project_id`（如 `(project_id, plan_no)`），编号按项目生成 |

```mermaid
flowchart LR
    H["请求头 X-Project-Id"] --> M["ProjectHeader 中间件：解析进请求上下文"]
    M --> S["web.H：新建会话并设定项目"]
    S --> D["业务路由依赖 auth.RequireProject：校验项目存在且启用"]
    D --> Q["service：s.ProjectID() + SQL 显式 project_id = ?"]
    Q --> DB[("PostgreSQL")]
    SYS["系统级入口：s.System() / db.SystemSession / auth.SystemScope"] --> DB
```

项目域表清单在 `server/internal/model` 的 `ProjectScopedTables`（32 张，删除项目前的数据统计依赖它）；新增业务表必须带 `project_id` 并登记进该清单，同时改 `init.sql` 与 Go 模型（`AGENTS.md` 已写成约定）。

上下文来源：

| 入口 | 项目从哪来 |
| --- | --- |
| 网页端业务接口 | `X-Project-Id`（前端 `web/src/api/client.ts` 统一注入；右上角切换项目后整页刷新），由 `auth.RequireProject` 校验 |
| `/shares`、`/excel-export-jobs` 管理端接口 | 不挂 `RequireProject`（同组有匿名端点）：会话项目取自 `ProjectHeader` 解析的 `X-Project-Id`，用到项目 id 时缺失即 `PROJECT_REQUIRED` |
| 小程序 | 同上请求头；不带时落默认项目（`auth.MiniProgramUser` 内统一解析，端点无需各自声明） |
| MCP | 请求头 `X-Project-Id` 优先，其次 MCP 链接上的 `?project_id=`，都缺省时用系统默认项目（`system_whoami` 回显项目与 `project_source`）；`operation_call` 转发时带上项目头 |
| 匿名分享页 | 先在系统上下文里按 token 取 `share_link`，再 `s.WithProject(link.ProjectID)` 读数据 |
| 导入 / 导出任务 | 任务行记录 `project_id`，后台 goroutine 用 `db.ProjectSession(ctx, job.ProjectID)` 恢复上下文 |
| 清理任务、附件引用统计、匿名导出下载 | 显式 `db.SystemSession(ctx)` / `s.System()` / `auth.SystemScope`（这些入口本就不属于单个项目） |

### 数据库会话与事务
| 项 | 真实配置（`server/internal/db`） |
| --- | --- |
| 连接池 | `sqlx.Open("pgx", dsn)`：`MaxOpenConns=50`、`MaxIdleConns=20`、`ConnMaxLifetime=30m`、`ConnMaxIdleTime=5m` |
| DSN | `config.PostgresDSN()` 把 `postgresql+asyncpg://…` / `postgresql://…` 统一转成 `postgres://…`，未指定时追加 `timezone=UTC`（时间按 UTC 存取），`ssl=` 参数映射为 `sslmode=` |
| 会话 | `db.Session` 是工作单元：第一条语句时惰性 `BEGIN`，`Commit()` / `Rollback()` 后仍可继续使用（下一条语句开启新事务）；`Close()` 回滚未提交的事务 |
| 请求会话 | `web.H` 为每个请求 `db.NewSession(ctx)`，处理成功后先提交再写响应，失败回滚（见「分层与请求链」） |
| 提交回调 | `AfterCommit(fn)`：提交成功后执行（如提交后才回收的磁盘文件）；`AfterRollback(fn)`：回滚后执行（如回收本次已写入磁盘、记录却没落库的文件） |
| SQL 方言 | 业务 SQL 写 `?` 占位符与反引号标识符，`db.Translate` 转成 PostgreSQL 的 `$n` 与双引号（跳过字符串字面量，结果缓存）；`IN (?)` 由 `SelectIn` / `ExecIn` 展开；`Insert` 自动追加 `RETURNING id` |
| 错误分类 | `db.IsIntegrity` / `IsDuplicate` / `IsForeignKey` / `IsQueryError` / `IsConnectionError` 按 SQLSTATE 判断，供 `web.WriteError` 与 service 使用 |
需要「先落库再返回 / 再继续」的 service 会在请求中途自行提交：

| 自行提交的示例 | 说明 |
| --- | --- |
| `service/file` 上传 | 上传是独立提交，只有数据库记录真正提交后才返回成功；提交失败回收已写磁盘文件。软删除 / 撤销删除 / 清理悬空文件同样自行提交 |
| `service/importjob.EnqueueImport`、`service/exportjob` 登记任务 | 在独立的 `db.ProjectSession` 里登记任务并立即提交，再启动后台 goroutine |
| 后台任务（常驻任务、导入 / 导出子任务、Webhook 投递） | 不使用请求会话，而是 `db.SystemSession` / `db.ProjectSession` 自建会话并自行 `Commit()` |
| 并发控制 | 行锁写在 service 的 SQL 里：库存余额 / 物资按 id 升序 `FOR UPDATE`（固定加锁顺序避免死锁），申购计划 / 记录批量操作同样按 id 加锁；Webhook 投递认领、申购计划清理、附件清理用 `FOR UPDATE SKIP LOCKED` 逐批抢锁 |
| 保存点 | 申购计划号冲突重试用 `SAVEPOINT purchase_plan_no` / `ROLLBACK TO SAVEPOINT`（`service/material`） |
#### DB 计时实现（`server/internal/db` 的 `Timing`）
| 阶段 | 行为 |
| --- | --- |
| 传递 | `RequestContext` 新建 `db.Timing`，经 `db.WithTiming` 放进请求的 `context.Context` |
| 采集 | `db.NewSession(ctx)` 取出计时器；`Get` / `Select` / `Exec` / `Query` 与 `Commit` 每次执行后原子累加耗时并 `count += 1` |
| 响应前 | 写响应头前一刻读出合计，生成 `X-DB-Time` / `X-DB-Queries` |
| 只统计请求内 SQL | 启动清理、常驻任务与请求派生的导入 / 导出 goroutine 都以 `context.Background()` 建会话，不携带计时器，不计入任何请求；并发请求互不干扰 |

### 分页与排序约定
| 项 | 约定 |
| --- | --- |
| 响应模型 | 列表统一为 `schema.Page[T]`：`items` / `page` / `page_size` / `total` |
| 参数 | `p.Page()` 读取 `page`（`ge=1`，默认 1）与 `page_size`（`ge=1,le=200`，默认 20）；个别接口用 `p.PageWithDefault(n)` 改默认页大小 |
| 通用实现 | service 先 `SELECT COUNT(*)` 取 `total`，再按 `LIMIT ? OFFSET ?`（`common.Offset(page, pageSize)`）取当页；列表避免 N+1：主表一次查询 + 每个关系一次 `IN` 查询 |
| 导出上限 | `common.ExportRowLimit = 10_000`：导出发起前以 `page_size=ExportRowLimit + 1` 试探，超限返回 `EXPORT_RESULT_LIMIT_EXCEEDED`（`details` 带 `total`/`limit`） |
| 排序参数 | `sort_by` + `sort_order`；`sort_order` 为 `oneof=asc\|desc`（默认 `asc`）；申购计划 / 申购记录的 `sort_by` 限定为结果列（`schema.PurchasePlanResultColumns` 15 值、`schema.PurchaseRecordResultColumns` 24 值，不在集合内即 422），周期性计划的 `sort_by` 为任意字符串 |
| 排序列白名单 | `material.PurchaseSortColumns`、`plantemplate.SortColumns`、`purchaserequest.PurchaseRecordSortColumns` 把 `sort_by` 映射到 SQL 列（防止任意列注入）；不在白名单时回退默认排序，固定次级排序键 `id DESC` |
| 关键词 OR 搜索 | 用 `\|` 或 `｜` 分隔，`common.ContainsAny` / `Where.ContainsAny` 生成 `(col LIKE ? ESCAPE '/' OR …)`，通配符按 `/` 转义 |

</TabsContent>

<TabsContent id="be-ops">

### 日志与 request_id
| 项 | 实现（`server/internal/logx`） |
| --- | --- |
| 初始化 | `cmd/server` 启动时 `logx.Configure(APP_LOG_DIR, APP_LOG_BACKUP_COUNT)`，设为 `log/slog` 的默认 handler |
| 行格式 | `时间 \| 级别 \| logger 名 \| 消息`，级别为 `INFO` / `WARNING` / `ERROR`，附加属性追加为 `key=value` |
| 文件 | `<log_dir>/spare-parts-api.log`（默认 `server/data/logs/`），本地时间午夜轮转 |
| 归档 | 轮转出的文件放进 `YYYY-MM/spare-parts-api.YYYY-MM-DD.log`，跨目录按日期排序，只保留最近 `APP_LOG_BACKUP_COUNT`（默认 90）份 |
| 控制台与级别 | 输出到 stdout，未设置 `NO_COLOR` 时 ANSI 彩色；消息含 `/health` 的行不输出到控制台（文件照写）；最低级别 INFO |
| logger 名 | 默认 `spare_parts.api`（`logx.Named(name)` 可取指定名称的日志器） |
| 访问日志字段 | `method`、`path`、`status`、`elapsed ms`、`db=<ms>/<query 数>`、`compute=<ms>`、`client_ip`、`user`（管理端为用户名，未认证为 `anonymous`，小程序为 `mini:<id>`）、`request_id`；`/health` 不写访问日志 |
| 敏感信息 | 访问日志不打印请求体、查询参数与请求头（`Authorization`/`X-API-Token` 均不出现）；乐观锁版本号刻意放 `If-Match` 头而非 query；代码中没有统一的字段级脱敏黑名单 |

### 配置项清单
| 项 | 值 |
| --- | --- |
| 配置类 | `server/internal/config` 的 `Settings`，`config.Load()` 启动时读取一次，结果放进进程级单例 `config.S` |
| 环境文件 | `<APP_BASE_DIR>/.env`（默认当前工作目录，即 `server/.env`）：逐行 `KEY=VALUE`，不覆盖已存在的环境变量 |
| 变量前缀 | `APP_`（如 `APP_DATABASE_URL`） |
| 解析失败 | 整数 / 布尔值非法、小于下限，或 `APP_JWT_SECRET` 不足 16 个字符时启动失败并退出 |
| 必填字段 | 代码层没有必填字段（部署时由 compose 要求 `APP_DATABASE_URL`、`APP_JWT_SECRET`） |

| 字段 | 环境变量 | 类型 | 默认值 | 校验/说明 |
| --- | --- | --- | --- | --- |
| `AppName` | `APP_APP_NAME` | `string` | `电气车间备件管理系统` | Swagger UI 标题、`/version` 的 `app_name` |
| `Environment` | `APP_ENVIRONMENT` | `string` | `development` | 启动日志打印；compose 设 `production` |
| `DatabaseURL` | `APP_DATABASE_URL` | `string` | `postgresql+asyncpg://spare:spare@postgresql:5432/spare_parts` | 连接串，接受 `postgresql+asyncpg://` / `postgresql://` / `postgres://`，由 `PostgresDSN()` 转成 pgx DSN |
| `JWTSecret` | `APP_JWT_SECRET` | `string` | `change-me-in-production` | 至少 16 个字符，生产必须替换 |
| `JWTAlgorithm` | `APP_JWT_ALGORITHM` | `string` | `HS256` | JWT 签名算法 |
| `AccessTokenMinutes` | `APP_ACCESS_TOKEN_MINUTES` | `int` | `30` | `≥1`；管理端与小程序访问令牌有效期 |
| `RefreshTokenDays` | `APP_REFRESH_TOKEN_DAYS` | `int` | `7` | `≥1` |
| `FernetKey` | `APP_FERNET_KEY` | `string` | `""` | 为空时由 `APP_JWT_SECRET` 派生（经 SHA-256 定长，`internal/security`），影响接口令牌/API Key 等密文可解密性 |
| `WechatMiniProgramAppID` | `APP_WECHAT_MINI_PROGRAM_APP_ID` | `string` | `""` | 多个 AppID 逗号分隔，顺序须与 secret 一致（数量或唯一性不符返回 503 `WECHAT_CONFIGURATION_INVALID`） |
| `WechatMiniProgramAppSecret` | `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | `string` | `""` | 同上，仅后端保存 |
| `WechatAPIBase` | `APP_WECHAT_API_BASE` | `string` | `https://api.weixin.qq.com` | 微信接口根地址（去掉末尾 `/`），测试可指向本地桩服务 |
| `UploadDir` | `APP_UPLOAD_DIR` | `string` | `<server>/data/uploads` | 启动时自动创建；图片、导入临时文件（`imports/`）与导出文件（`exports/`）根目录 |
| `PreviewCacheDir` | `APP_PREVIEW_CACHE_DIR` | `string` | `<server>/data/preview-cache` | 缩略图缓存目录，独立于上传目录（可单独清理）；读写失败只告警，预览退化为每次渲染 |
| `PreviewConcurrency` | `APP_PREVIEW_CONCURRENCY` | `int` | `6` | `≥1`；同时渲染缩略图的上限，超出的请求排队等待 |
| `TemplateDir` | `APP_TEMPLATE_DIR` | `string` | `<server>/templates` | Excel 导出模板目录（`service/excelexport` 读取）；镜像内为 `/app/templates` |
| `LogDir` | `APP_LOG_DIR` | `string` | `<server>/data/logs` | 日志目录 |
| `LogBackupCount` | `APP_LOG_BACKUP_COUNT` | `int` | `90` | `≥1`，保留的历史日志文件数 |
| `MaxImageBytes` | `APP_MAX_IMAGE_BYTES` | `int64` | `10 * 1024 * 1024` | 图片上传上限 |
| `CORSOrigins` | `APP_CORS_ORIGINS` | `[]string` | 空 | 逗号分隔字符串（如 `https://a.example.com,.example.com`），空表示不限制 |
| `CORSAllowCredentials` | `APP_CORS_ALLOW_CREDENTIALS` | `bool` | `true` | 是否回 `Access-Control-Allow-Credentials`；接受 `1/0`、`true/false`、`yes/no`、`on/off` 等写法 |
| `CORSMaxAge` | `APP_CORS_MAX_AGE` | `int` | `86400` | `≥0`，预检缓存秒数 |
| `PurchasePlanCleanupEnabled` | `APP_PURCHASE_PLAN_CLEANUP_ENABLED` | `bool` | `true` | 关闭后不启动申购计划清理任务 |
| `AttachmentCleanupEnabled` | `APP_ATTACHMENT_CLEANUP_ENABLED` | `bool` | `true` | 关闭后不启动附件清理任务 |
| `BuildTime` | `APP_BUILD_TIME` | `*string` | 未设置 | 构建期注入（Docker ARG/ENV），`/version` 返回 |
| `GitSHA` | `APP_GIT_SHA` | `*string` | 未设置 | 同上 |
| `Host` | `APP_HOST` | `string` | `0.0.0.0` | 监听地址 |
| `Port` | `APP_PORT` | `int` | `8000` | 监听端口；`server healthcheck` 也按它探测 `/health` |

`<server>` 指 `APP_BASE_DIR`（未设置时为进程工作目录，本地即 `server/`；镜像内设为 `/app`）。另有两个只在测试中使用的开关（不进 `Settings`）：`APP_DISABLE_WORKERS`（非空时不启动常驻后台任务）、`APP_TEST_HOOKS=1`（注册 `/__test__/*` 测试钩子）。
#### 部署方需要配置的变量
`docs/env/backend.env.example` 模板项（前端对应 `docs/env/frontend.env.example`）：

| 模板中的变量 | 示例/说明 |
| --- | --- |
| `APP_ENVIRONMENT` | `development` |
| `APP_DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/spare_parts` |
| `APP_JWT_SECRET` | `replace-with-at-least-32-random-characters` |
| `APP_ACCESS_TOKEN_MINUTES` / `APP_REFRESH_TOKEN_DAYS` | `30` / `7` |
| `APP_CORS_ALLOW_CREDENTIALS` / `APP_CORS_MAX_AGE` | `true` / `86400` |
| `APP_WECHAT_MINI_PROGRAM_APP_ID` / `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | 多个小程序按相同顺序逗号分隔 |
| `APP_LOG_DIR` / `APP_LOG_BACKUP_COUNT` | `./data/logs` / `90` |
| `APP_PREVIEW_CONCURRENCY` / `APP_PREVIEW_CACHE_DIR` | `6` / `./data/preview-cache` |
模板未列出但代码支持的变量：`APP_FERNET_KEY`、`APP_CORS_ORIGINS`、`APP_UPLOAD_DIR`、`APP_TEMPLATE_DIR`、`APP_MAX_IMAGE_BYTES`、`APP_PURCHASE_PLAN_CLEANUP_ENABLED`、`APP_ATTACHMENT_CLEANUP_ENABLED`、`APP_APP_NAME`、`APP_JWT_ALGORITHM`、`APP_WECHAT_API_BASE`、`APP_HOST`、`APP_PORT`、`APP_BASE_DIR`、`APP_BUILD_TIME`、`APP_GIT_SHA`。
`docker-compose.yml` 中后端服务的取值：

| 变量 | 值 |
| --- | --- |
| `APP_ENVIRONMENT` | `production` |
| `APP_DATABASE_URL` | 必填，指向外部 PostgreSQL |
| `APP_JWT_SECRET` | 必填 |
| `APP_ACCESS_TOKEN_MINUTES` | 默认 `480` |
| `APP_WECHAT_MINI_PROGRAM_APP_ID` / `APP_WECHAT_MINI_PROGRAM_APP_SECRET` | 默认空 |
| `APP_UPLOAD_DIR` | `/app/data/uploads` |
| `APP_PREVIEW_CACHE_DIR` | `/app/data/preview-cache` |
| `APP_LOG_DIR` | `/app/data/logs` |
| `BACKEND_PORT` / `FRONTEND_PORT`（主机侧） | `8000` / `8080` |

### 后台定时任务
各 service 在包的 `init()` 里向 `server/internal/lifecycle` 登记：`lifecycle.OnStartup(order, name, fn)`（启动清理）、`lifecycle.Worker(name, enabled, fn)`（常驻任务）、`lifecycle.OnShutdown(fn)`（退出收尾）。`cmd/server` 的启动顺序：

```mermaid
flowchart LR
    A["config.Load"] --> B["创建上传目录"]
    B --> C["logx.Configure"]
    C --> D["db.Open 连接池"]
    D --> E["lifecycle.RunStartup<br/>按 order 执行启动清理"]
    E --> F["lifecycle.StartWorkers<br/>每个常驻任务一个 goroutine"]
    F --> G["HTTP 服务 app.New()"]
    G --> H["SIGINT / SIGTERM：取消 ctx → Shutdown(20s) → 等待常驻任务 → OnShutdown → 关闭连接池"]
```

#### 启动时的一次性清理（`lifecycle.RunStartup`）
单个任务失败只记 error 日志，不阻止启动。

| order | 调用 | 作用 | 保留/阈值 |
| --- | --- | --- | --- |
| 10 | `importjob.MarkStaleJobsFailed` | 重启前遗留的 `PENDING`/`RUNNING` 导入任务标记失败并删除临时文件 | — |
| 11 | `importjob.CleanupFinishedJobs` | 删除已终态（`SUCCEEDED`/`FAILED`）导入任务行 | `DefaultRetentionDays=30` |
| 20 | `exportjob.MarkStaleExportsFailed` | 同上，针对导出任务 | — |
| 21 | `exportjob.CleanupFinishedExports` | 删除已终态导出任务行及其文件 | `RetentionDays=3` |
| 30 | `share.CleanupExpired` | 删除已过期分享链接行 | `expires_at < now` |
每次清理命中的条数会打印 info 日志（如 `purged N expired share links`）。导入任务的终态清理**只在启动时执行一次**，代码中未定义周期性导入清理任务。
#### 常驻任务（`lifecycle.StartWorkers`，每个一个 goroutine，panic 会被记录而不拖垮进程）
| 任务名 | 实现 | 触发/周期 | 关键参数 |
| --- | --- | --- | --- |
| `webhook-delivery-worker` | `webhook.RunDeliveryWorker` | 循环投递待发送 webhook，无可投递时等待 2 秒再轮询 | `pollInterval=2s`；`maxAttempts=5`；退避 `retryMinutes=(1,5,15,60,180)`；`sendingLease=5m`；HTTP 读写超时 8s / 连接 3s，不跟随重定向 |
| `purchase-plan-cleanup` | `plancleanup.RunCleanupWorker` | 睡到下一个北京时间 02:00（`cleanupHour=2`，`common.Shanghai` 时区）后循环清理直到无候选 | 仅当 `APP_PURCHASE_PLAN_CLEANUP_ENABLED` 为真时启动；批次 `BatchSize=50`；先解绑 `purchase_request_line.purchase_material_id` 再物理删除计划；`FOR UPDATE SKIP LOCKED` |
| `attachment-cleanup` | `attachment.RunCleanupWorker` | 睡到下一个北京时间 02:00（`file.AttachmentPurgeHour`，`common.Shanghai` 时区）后循环清理（一轮什么都没清也没撤销就结束） | 仅当 `APP_ATTACHMENT_CLEANUP_ENABLED` 为真时启动；批次上限 200；对 `file_object.deleted_at` 非空的待删除附件**逐张复查被引用次数**：复查到新增引用即撤销删除（不等保留期），仍无引用且已过保留期（提交删除的完整 7 天后的第一个 2 点，`file.AttachmentRetentionDays=7`）才物理删除数据库行与磁盘文件，保留期未满的继续留着；批量标记（`file.SoftDeleteUnreferenced`）另有**新人保护期**：上传未满 `file.AttachmentUnreferencedMinAgeDays=7` 天且从未被引用过的附件不会被标记，只在回执的 `skipped_recent_count` 里回报；`FOR UPDATE SKIP LOCKED`。物理清除只能由本任务完成，**没有手动物理删除接口** |
| `excel-export-cleanup-worker` | `exportjob.RunCleanupWorker` | 启动后立即清理一次，随后每 24 小时一次 | 终态任务保留 3 天；顺带清理 `<upload_dir>/exports` 下超过 24 小时的 `.tmp` 孤儿文件 |
| `share-link-cleanup-worker` | `share.RunCleanupWorker` | 启动后立即清理一次，随后每 24 小时一次 | 删除 `expires_at < now` 的行 |

| 任务 | 生命周期 |
| --- | --- |
| 常驻任务 | 收到退出信号后 ctx 取消，各任务尽快返回；全部结束后执行 `OnShutdown` 收尾（`webhook.CloseClient`、`aisearch.CloseClients` 关闭 HTTP 客户端空闲连接） |
| 请求内派生任务 | `importjob.EnqueueImport` 与 `exportjob` 登记任务后 `go RunJob(context.Background(), id, processor)`，由包级 `sync.WaitGroup` 跟踪（测试可 `Wait()`），单进程有效；进程重启时由启动清理把中断的任务标记失败 |
| 测试环境 | 设置 `APP_DISABLE_WORKERS` 时不启动常驻任务（启动清理照常执行），避免与用例并发改写数据 |

</TabsContent>

<TabsContent id="be-mcp">

### 其它
#### MCP 服务（`server/internal/api/mcp`）
| 项 | 内容 |
| --- | --- |
| 挂载 | `mcp.Register` 在 `/api/v1/mcp/` 上接收全部方法；传输为 Streamable HTTP 的**无状态 JSON** 模式：只接受 `POST`（`GET` / `DELETE` 返回 405，不提供 SSE 流与会话），`Content-Type` 必须是 `application/json`，响应为 JSON（支持 JSON-RPC 批量请求，纯通知返回 202）；请求体上限 16 MB；协议版本支持 `2024-11-05` / `2025-03-26` / `2025-06-18` / `2025-11-25`；`serverInfo.name` 为 `spare-parts-management` |
| 工具 | `system_whoami`（返回令牌对应用户、角色、当前项目与项目来源）、`projects_list`（列出全部项目）、`operations_list`（按标签/关键字列出操作）、`operation_describe`（返回某操作的参数、请求体、响应契约与参数落位提示 `call_arguments`）、`operation_call`（以 `X-API-Token` 调用业务接口；`path_params` / `query` / `headers` / `body` / `file` 分别对应路径参数、查询参数、请求头、JSON 请求体与附件，附件用 `file.content_base64` 上传，二进制响应超过 25 MB 报错） |
| 操作目录 | 由内嵌契约（`server/internal/openapi` 的 `openapi.Operations()`，按契约文件顺序）生成，按 `operationId` 索引；`ExcludedPaths` 排除 `/api/v1/auth/login`、`/api/v1/auth/refresh`，`ExcludedPrefixes` 排除小程序专用前缀 `/api/v1/mini-program/`，其余管理端接口全部可调用。小程序专用接口的能力都由管理端接口覆盖（库存与流水 → `/inventory/*`、隐患 → `/hazards*`、精简库存 → `/secondary-warehouse`、物料编码库 → `/material-code-library`、项目 → `/projects`），所以「完整操作所有功能」不依赖小程序端点 |
| 参数映射 | `operation_describe` 的 `call_arguments` 由契约派生：`path_params` / `query` 是名字列表，`headers` 是 `{name, note}` 列表（如 `if-match` 说明「乐观锁版本号（String(version)）；不传则不校验版本」），`body` 是请求体 content-type 列表（multipart 时为 `null`，改用 `file`），`file` 是上传表单字段名（固定 `file`）。`headers` 只接受契约里该操作声明的请求头；令牌头与项目头（`ManagedHeaders`）由 MCP 层统一设置，不接受调用方传入 |
| 上限 | 请求体上限 16 MB（附件 base64 编码后约 12MB 原文）；单次返回二进制不超过 25 MB，超出报错 |
| 调用方式 | `operation_call` 用 `httptest.ResponseRecorder` 把请求在进程内交给应用自身的 Gin 引擎（`mcp.SetHandler`），仍完整经过中间件、参数校验、角色权限、乐观锁与事务；最多跟随 5 次重定向。带乐观锁的写操作把版本号放进 `headers`（如 `{"If-Match": "3"}`），与网页端同一个入口（`If-Match` 头） |
| 认证 | 取 `?token=`、`X-API-Token` 或 `Authorization: Bearer`，经 `auth.FindUserByAPIToken` 命中启用用户后解析项目（`X-Project-Id` → `?project_id=` → 默认项目），失败返回 `401` + `{"code":"INVALID_TOKEN", ...}` |
| 一致性测试 | `internal/api/mcp` 的 Go 测试校验：目录不含排除项、排除项仍能命中存活路由、目录 + 排除项覆盖契约里的全部操作；改排除清单时同步本小节 |
#### 健康检查与接口文档
| 项 | 内容 |
| --- | --- |
| `GET /health` | 不在契约内；5 秒超时执行 `SELECT 1`，成功返回 `{"status":"ok","database":"ok"}`；失败记录 warning 并返回 `503 DATABASE_UNAVAILABLE`；不写访问日志 |
| 容器健康检查 | `/app/server healthcheck` 子命令请求 `http://127.0.0.1:$APP_PORT/health`（3 秒超时），200 返回 0，否则 1 |
| Swagger / OpenAPI | Swagger UI 在 `/api/docs`（页面从 jsDelivr 加载 swagger-ui-dist），OpenAPI JSON 在 `/api/v1/openapi.json`，内容即内嵌契约转成的 JSON（版本号取契约 `info.version`） |
| 契约文件 | `docs/openapi.yaml` 是**手工维护**的唯一来源：改接口时先改契约，再 `make sync-openapi` 把它复制到 `server/internal/openapi/openapi.yaml`（`go:embed` 内嵌）；`TestEmbeddedSpecMatchesDocs` 校验两份一致。示例数据由 `server/scripts/openapi_examples.py` 补齐，前端类型由契约生成 |
| 路由一致性 | `internal/app` 的 `TestRoutesMatchOpenAPIContract` 校验契约里的每个操作都有 Gin 路由、且没有契约外的 `/api/v1` 业务路由（MCP、`openapi.json` 与 `/__test__` 除外） |
| 错误响应声明 | 契约里各操作统一声明 `400/401/403/409/422` 使用 `ApiError` 结构 |
#### 测试与 CI
| 层次 | 内容 |
| --- | --- |
| 静态检查 | `gofmt -l .`（应无输出）、`go vet ./...` |
| Go 单元测试 | `go test ./...`：中间件、健康检查与未知路由、契约 / 路由一致性、MCP 目录、各 service 的纯逻辑（Excel 渲染、导入解析、图片重编码、附件保留期、Webhook、AI 搜索等）；少数需要 PostgreSQL 的用例默认连本机 `em_go_test` 库（可用 `GO_TEST_DATABASE_URL` 覆盖，CI 指向服务容器），连不上时跳过 |
| 黑盒契约测试 | `server/tools/run_contract_tests.sh`：重建本地 PostgreSQL 测试库（导入 `init.sql`）→ 编译并启动 Go 服务（独立上传 / 日志目录，`APP_DISABLE_WORKERS=1`、`APP_TEST_HOOKS=1`）→ 运行 `server/tests/` 下的 pytest 用例，通过 HTTP 调用服务并直连同一数据库校验落库结果；`PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` 可覆盖连接 |
| CI | `.github/workflows/api-test.yml`：PostgreSQL 16 服务容器 + 静态检查 + `go test ./...` + 黑盒契约测试；`contract-check.yml`：契约与内嵌副本、路由一致，前端生成类型未漂移；`e2e-simulation.yml`：编译后端连真实 PostgreSQL 跑 `server/scripts/e2e_simulation.py` 模拟用户操作 |
#### Docker 与部署
| 项 | 内容（`server/Dockerfile`、`docker-compose.yml`） |
| --- | --- |
| 构建阶段 | `golang:1.26-alpine`，`CGO_ENABLED=0`、`-trimpath`，先 `go mod download` 再 `go build -ldflags="-s -w" -o /out/server ./cmd/server`（构建上下文是 `server/` 自身） |
| 运行阶段 | `alpine:3.22` + `ca-certificates`、`tzdata`，非 root 用户 `app`；`WORKDIR /app`，复制二进制 `/app/server` 与 `templates/` 到 `/app/templates`，创建 `/app/data/uploads`、`/app/data/preview-cache`、`/app/data/logs` |
| 环境与构建参数 | `ENV APP_BASE_DIR=/app`、`APP_TEMPLATE_DIR=/app/templates`、`APP_UPLOAD_DIR=/app/data/uploads`、`APP_PREVIEW_CACHE_DIR=/app/data/preview-cache`、`APP_LOG_DIR=/app/data/logs`；`ARG BUILD_TIME` / `ARG GIT_SHA` → `APP_BUILD_TIME` / `APP_GIT_SHA` |
| 端口/启动 | `EXPOSE 8000`；`ENTRYPOINT ["/app/server"]`；`HEALTHCHECK` 执行 `/app/server healthcheck`（15s 间隔、5s 超时、10s 起始宽限、10 次重试） |
| compose 后端 | 镜像 `ghcr.io/sakana-1314/electrical-manager:server`，端口 `${BACKEND_PORT:-8000}:8000`，卷 `uploads:/app/data/uploads`、`preview-cache:/app/data/preview-cache`、`logs:/app/data/logs`，健康检查 `["CMD", "/app/server", "healthcheck"]`（15s 间隔，30s 起始宽限） |
| compose 前端 | 镜像 `ghcr.io/sakana-1314/electrical-manager:web`，端口 `${FRONTEND_PORT:-8080}:80`，`depends_on: backend: service_healthy` |
| 网络 | 外部网络 `1panel-network` |
运行时依赖全部编译进二进制，镜像内不需要 Go 工具链；依赖清单见 `server/go.mod`。

</TabsContent>

</Tabs>

</TabsContent>

<TabsContent id="miniprogram">

原生微信小程序（WXML / WXSS / CommonJS JS），组件库 TDesign Mini Program，通过 `wx.login` 静默登录后使用。

### 页面构成（`miniprogram/app.json`，20 页）

| 分组 | 页面 |
| --- | --- |
| 入口与身份 | `pages/home/home`、`pages/bind/bind`、`pages/disabled/disabled`、`pages/registration-closed/registration-closed` |
| 库存与出库 | `pages/inventory/inventory`、`pages/material-detail/material-detail`、`pages/outbound/outbound`、`pages/outbound-success/outbound-success` |
| 申购与记录 | `pages/purchase-plans/purchase-plans`、`pages/purchase-plan-detail/purchase-plan-detail`、`pages/purchase-records/purchase-records`、`pages/purchase-record-detail/purchase-record-detail`、`pages/records/records` |
| 隐患管理 | `pages/hazards/hazards`、`pages/hazard-detail/hazard-detail`、`pages/hazard-create/hazard-create` |
| 参照数据 | `pages/material-codes/material-codes`、`pages/huaxing-inventory/huaxing-inventory` |
| 台账查看 | `pages/ledger/ledger`（列表、搜索、分页）、`pages/ledger-detail/ledger-detail`（按 id 看详情） |

公共组件只有 `material-summary-card`；工具层在 `utils/`：`auth.js`（登录与建档）、`request.js`（请求、弱网重试、项目头与图片上传、静默重登）、`project.js`（当前项目：列表、默认项目兜底与切换）、`features.js`（功能模式）、`material.js`（物资 uuid 与幂等键）、`inventory.js`、`hazard.js`（隐患展示装饰与逾期判定）、`navigation.js`、`share.js`（分享链接的搜索 / 筛选参数编解码）、`i18n.js`、`theme.js`（界面外观）。后端地址来自 `config/index.js` 的 `apiBaseUrl`。

### 分享带搜索 / 筛选（`utils/share.js`）

列表页转发给同事时，把当前的搜索词与筛选值一并写进分享 `path`：对方点开分享卡片，**已注册直接落到同一份筛选结果**；未注册则先走绑定页，注册完由 `redirect` 回跳到同一份结果（`buildRedirectQuery(buildSharePath(route, shared))`）。

| 环节 | 实现 |
| --- | --- |
| 写 | 各页重写 `sharePath()`，用 `buildSharePath(route, params)` 拼 query：空值 / `null` / `undefined` 一律省略，其余逐个 `encodeURIComponent`（中文与 `&` `=` `#` 都不会破坏结构） |
| 读 | 小程序 `onLoad(options)` 的 query **不会自动解码**，统一走 `readShareParams(options, SHARE_PARAMS)`：按白名单 key 取值并解码，对已解码 / 含裸 `%` 的值做兜底，不抛错 |
| 携带范围 | 申购计划 `keyword`/`actualDemandPerson`/`subitemNo`；申购记录 `keyword`/`status`/`subitemNo`；隐患管理 `keyword`/`status`/`rectifyPerson`；二级库库存 `keyword`/`stockStatus`；物料编码、华星总库存、台账查看 `keyword` |
| 回填时机 | 带下拉筛选的页面先 `loadFilterOptions()` 再回填——`t-dropdown-item` 要靠 `options` 才能把当前值解析成文案，早于选项写入会显示成默认的「全部××」 |
| 值已不在候选项 | 自由文本类（申购人、子项号、整改人）用 `withSharedOption()` 把缺失值补成一项，避免下拉显示「全部」而列表其实仍在过滤 |
| 固定枚举 | 隐患状态与库存状态页签是固定几档，用 `isAllowedShareValue()` 校验，非法值直接忽略（不能凭空造出页签） |
| 精简模式 | 二级库精简模式下没有库存状态页签，既不分享该参数，也忽略外部传入值 |

### 界面外观（明 / 暗）

三档语义与网页端一致：`auto`（自动，跟随系统，默认）、`light`、`dark`；档位按本机存在 storage（`miniProgramThemeMode`），不落库、不产生请求，入口在首页「个人信息」弹窗的「外观」一行（收起态显示当前档位），点击后弹出 `t-picker` + `t-picker-item` 滚轮选择器（与「当前项目」同一套交互，确认才写入本机偏好）。

| 层 | 实现 |
| --- | --- |
| 原生外观 | `app.json` 开启 `darkmode` 并指定 `themeLocation`，窗口与导航栏颜色以 `@变量` 引用 `theme.json` 的 light / dark 调色板；自动档由此跟随系统 |
| 主题运行时 | `utils/theme.js` 把档位解析成实际外观（`auto` 读 `wx.getAppBaseInfo().theme`，取不到回落 `wx.getSystemInfoSync().theme`），系统切换由单个 `wx.onThemeChange` 广播给已绑定页面；页面统一 `Page(withTheme({…}))` 接入，`withTheme` 注入 `themeMode` / `theme` / `themeClass` 并在 `onLoad`、`onShow`、`onUnload` 完成应用与订阅 |
| 样式令牌 | `app.wxss` 中浅色令牌定义在 `page`，深色同名覆盖在 `.theme-dark`（由 `themeClass` 加到页面根节点）；`page, .theme-dark` 把 TDesign 的 `--td-*` 语义令牌桥接到 `--app-*`，两个作用域共用一套声明 |
| 显式档覆盖系统 | 导航栏与窗口底色由 `wx.setNavigationBarColor` / `wx.setBackgroundColor` 按解析结果纠正；软键盘、原生选择器弹层等系统级外观仍跟随系统 |

不使用 `@media (prefers-color-scheme)` 切换主题（媒体查询只跟随系统，与显式档并存会互相覆盖），也不引入 `tdesign-miniprogram` 自带的 `common/style/theme/*` 媒体查询主题；页面样式只引用令牌，颜色字面量只允许出现在 `app.wxss` 的令牌定义里，以上均由 `node scripts/check.js` 校验。

### 当前项目（多项目数据隔离）

业务数据按项目隔离，小程序同样一次只处理一个项目的数据：默认使用默认项目，可在首页「个人信息」弹窗里切换（`utils/project.js` + `pages/home/home.*`，切换后 `wx.reLaunch` 回首页，避免其它页面残留上一个项目的数据）。切换交互是 `t-picker` 滚轮选择器（选项用组件约定的 `label` / `value`，`value` 即项目 id，`value` 属性传 `[当前项目 id]` 以定位当前项），入口是弹窗里的单行触发器。

| 项 | 实现 |
| --- | --- |
| 列表来源 | `GET /mini-program/projects`（小程序令牌鉴权，返回全部项目含停用项，前端只展示启用项） |
| 存储 | storage 键 `currentProjectId`，不落库；本机切换不影响网页端 |
| 请求头 | `utils/request.js` 在请求与图片上传时都带上 `X-Project-Id`（每次尝试重新读取，重登/重试后仍生效） |
| 默认兜底 | 不带项目头时服务端用默认项目，因此未升级的旧客户端照常可用 |
| 切换入口 | 首页「个人信息」弹窗的「当前项目」行打开 `t-picker` + `t-picker-item`（选项按组件的 `label` / `value` 契约传入，`popup-props` 抬高层级以盖住弹窗），取消 / 确认文案来自 `utils/i18n.js`；确认后整页重启回首页 |
| 失效恢复 | 服务端返回 `PROJECT_DISABLED` / `PROJECT_NOT_FOUND` 时，小程序清掉已存项目、重新解析默认项目并重试一次 |

### 登录与建档

```mermaid
sequenceDiagram
    participant U as 小程序用户
    participant App as 小程序
    participant API as 服务端
    participant DB as PostgreSQL
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
    S --> G["台账查看<br/>query_only"]
    S --> Z["隐患管理<br/>read_write"]
    S --> L["二级库运行模式<br/>full"]
    I -- "disabled" --> I1["隐藏该功能页"]
    I -- "read_write" --> I2["可扫码出库"]
    Z -- "read_write" --> Z2["可登记隐患、更新整改状态"]
    L -- "lite" --> L1["整体只读，只查精简库存"]
```

每个功能页三档：`disabled`（隐藏）、`query_only`（只读）、`read_write`（可写：库存可出库、隐患可登记与跟进）。模式由服务端设置下发，小程序启动时拉取；拉取失败时回落到「库存可写、隐患可写、其余只读、完整二级库模式」的默认值，避免因一次网络失败把出库与隐患登记关掉。开关只用于小程序前端的入口拦截与展示，后端数据接口不按它鉴权。

台账查看只有浏览能力（列表、搜索、详情都是只读），所以网页端设置里只开放 `disabled` / `query_only` 两档，与物料编码库、华星总库存一致；`read_write` 档在台账上没有任何可写入口，因此不提供。

### 构建与上传

- 依赖：`npm install` + 微信开发者工具「构建 npm」（TDesign 组件库）。
- 检查：`node scripts/check.js`；上传：`node scripts/upload.js`（`miniprogram-ci`）。
- CI 在 `miniprogram/` 变更时检查并上传开发版本，版本号取北京时间日期（如 `v2026.07.26`），同一版本依次上传到两个小程序；`AppID` 与上传私钥只存在于仓库 Secret，运行时由小程序上报自身 AppID，服务端据此选择对应 AppSecret。
- 请求合法域名需在小程序后台配置为 `apiBaseUrl` 的域名。

接口清单以[接口文档](/api)为准，库存与申购的数据模型见[数据模型](/dev-data-model)。

</TabsContent>

</Tabs>
