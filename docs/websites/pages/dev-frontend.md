# 前端架构
`web/` 是 Vue 3 + TypeScript + Vite 单页应用：UI 用 Naive UI，状态用 Pinia，HTTP 用 axios，接口类型由 `docs/openapi.yaml` 生成。
## 技术栈与命令
| 类别 | 依赖 | 版本（`web/package.json`） |
| --- | --- | --- |
| 框架与运行时 | `vue`、`vue-router`、`pinia`、`naive-ui`、`axios`、`@vueuse/core`、`@vicons/ionicons5` | `^3.5.17`、`^4.5.1`、`^3.0.3`、`^2.42.0`、`^1.10.0`、`^13.5.0`、`^0.13.0` |
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
测试文件为 `*.spec.ts`，共 31 个；`web/vitest.config.ts` 中 `setupFiles: ['./src/test/setup.ts']`（仅 `afterEach(() => vi.restoreAllMocks())`）。
## 目录结构
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

<Tabs :tabs="[
  { id: 't0', title: '路由与状态管理' },
  { id: 't1', title: 'API 与契约生成' },
  { id: 't2', title: '组件与 composable' },
  { id: 't3', title: '工具、布局与页面' },
  { id: 't4', title: 'Mock、构建与部署' }
]">

<TabsContent id="t0">

### 路由表
来源 `web/src/router/index.ts`；`meta.permission` 是唯一权限点，**`meta.roles` 当前未实现**。除标注「公开」外都要求已登录。
`meta.title` 是页面短名（详情页也用短名），`meta.parent` 是顶栏面包屑与浏览器标题里的上级标题
（二级条目用菜单分组名，详情页/操作页用所属列表页或入口标题）；移动端顶栏只展示 `meta.title`。

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
| 权限点 | `can(permission)` 查 `rolePermissions`：`SUPER_ADMIN` 全部 4 项；`WAREHOUSE_ADMIN` `warehouse:write`+`read`；`PURCHASE_ADMIN` `purchase:write`+`read`；`READ_ONLY` 仅 `read` | `types/navigation.ts` |
| 无权限时 | 静默重定向到工作台；无独立 403 页、无全局拦截，页面内用 `auth.can()` 自行隐藏入口 | `router/index.ts`、`layouts/AppLayout.vue` |
| keep-alive | `meta.keepAlive` 只在 3 个列表路由声明，由 `<keep-alive>` 使用，路由守卫不读该字段 | 同上 |
### 状态管理
`web/src/stores/` 下只有 3 个 store，均为 setup 语法（`defineStore(id, () => {...})`）。

| store | state | getters | actions | 持久化 | 职责 |
| --- | --- | --- | --- | --- | --- |
| `stores/auth.ts`（`useAuthStore`） | `user: User \| null`、`token: string \| null` | `isAuthenticated`（`Boolean(token && user)`） | `login(payload)`、`refresh()`（调 `/auth/me` 回填 user）、`logout()`、`can(permission)` | 读写 `localStorage`：`access_token`、`refresh_token`、`auth_user`；`user`/`token` 初值在 store 定义时就读取 `auth_user` / `access_token` | 登录态与角色权限判断 |
| `stores/settings.ts`（`useSettingsStore`） | `secondaryWarehouseMode: SecondaryWarehouseMode`（初值 `'full'`）、`loaded: boolean` | `isLiteMode`（`secondaryWarehouseMode === 'lite'`） | `load()`（调 `systemSettingsApi.miniProgramFeatures()`，失败回退 `'full'`，`loaded` 置 true 后不再重复请求） | 无持久化（每次启动重新拉公开配置） | 全局二级库模式，供路由守卫与侧边菜单在首次导航前同步读取 |
| `stores/theme.ts`（`useThemeStore`） | `mode: ThemeMode`（初值读本地 `theme.mode`，缺省 `'auto'`） | `isDark`（`auto` 时取 `usePreferredDark()`，否则看档位） | `setMode(mode)`（写本地并立即生效）、`apply()`（把解析结果写到 `<html data-theme>` + `color-scheme` + `meta[name=theme-color]`） | `localStorage` key `theme.mode`（`auto` / `light` / `dark`）；系统外观变化由 `watch(isDark)` 实时同步 | 界面外观，供 App.vue 切 Naive UI 主题、styles.css 切令牌 |
`main.ts` 在 `app.mount('#app')` 之前 `await useSettingsStore(pinia).load()`，因此守卫里能同步读到 `isLiteMode`；同一处 `useThemeStore(pinia).apply()` 先把外观落到 `<html>`，与 `index.html` 首屏预置脚本结果一致，避免闪主题。

</TabsContent>

<TabsContent id="t1">

### API 客户端与契约生成
#### `web/src/api/client.ts`
- 实例：`axios.create({ baseURL: apiBaseUrl, timeout: 15_000, paramsSerializer: { indexes: null } })`（数组参数序列化为重复 key，不带 `[]`）。
| 导出 | 来源 | 缺省行为 |
| --- | --- | --- |
| `apiBaseUrl` | `VITE_API_BASE_URL` | 回退 `/api/v1`；只填域名（纯 origin）时自动补 `/api/v1` |
| `imageBaseUrl` | `VITE_IMAGE_BASE_URL` | 缺省 = `apiBaseUrl/files/images` |
| `buildTime` | 构建期注入的 `__BUILD_TIME__` | — |
| `resolveMcpUrl(apiBaseUrl, token)` | — | 拼出 `mcp/?token=` 地址 |

位置：`web/src/config/env.ts`。
- 请求拦截器：`localStorage` 有 `access_token` 时注入 `Authorization: Bearer <token>`；每个请求生成 `config.headers['X-Request-ID'] = crypto.randomUUID()`。
- 版本头：客户端**不统一注入**，由业务模块按需传 `If-Match`（值均为 `String(version)`）：
  `procurement.deleteMaterial`、`procurement.restoreRecordToPlan`、`purchasePlanTemplates.deleteTemplate`、
  `inventory.deleteMaterial`、`dictionaries.deleteMiniProgramUser`。
- `X-API-Token`：**前端当前未实现**（代码中无该请求头，接口令牌仅在「管理端用户」页展示/复制与 MCP 链接里使用）。
- 401 处理：仅当 `status === 401 && data.code === 'INVALID_TOKEN' && 未重试过 && localStorage 有 refresh_token`
  时，调用 `renewAccessToken()`（`POST /auth/refresh`，`timeout: 15_000`）并重放原请求；并发请求共用模块级
  `refreshRequest` promise，避免刷新风暴。刷新失败或其余 401：`clearSession()` 后跳登录页。
- 错误归一化：响应体带 `code` 时抛 `AppError`（保留 `code` / `message` / `details` / `request_id`）；否则按有无 `response` 构造 `SERVER_ERROR`（`服务请求失败（HTTP <status>），请稍后重试`）或 `NETWORK_ERROR`（`无法连接服务器，请检查网络后重试`），`request_id` 取自本次请求的 `X-Request-ID`。
- 未消费响应头：**前端当前不读取任何响应头**（无 `X-Response-Time` / 服务端 `X-Request-ID` 的读取逻辑）。
- 超时覆盖：默认 15s；`systemSettings.imageAcceleration`、`systemSettings.miniProgramFeatures` 为 3000ms；`aiSearch.testSettings` 为 35s；`procurement.importMaterialCodes`、`secondaryWarehouse.import`、`huaXingInventory.import` 为 120s。
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
| `files.ts` | `/files/images*` | 图片上传与删除 |
| `version.ts` | `/version` | 版本信息（关于页） |
`web/src/utils/download.ts` 的 `exportDownloadUrl(fileUuid)` 直接拼导出文件下载地址（该端点不鉴权）。

</TabsContent>

<TabsContent id="t2">

### 公共组件清单
`web/src/components/` 下 15 个 `.vue`（不含 `.spec.ts`）：

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
### Composable 清单
`web/src/composables/` 下 6 个 `.ts`（不含 `.spec.ts`），全部为函数式组合式 API：

| Composable | 职责 | 关键返回项 | 典型使用位置 |
| --- | --- | --- | --- |
| `usePagedTable.ts` | 统一列表分页/加载/筛选/URL 同步：`load/query/changePage/changePageSize/resetFilters`，可选 `rollbackEmptyPage` 防空页回退、`paginated: false` 全量拉取、`urlSync` 把 page/page_size/筛选写回 URL | `items`、`total`、`page`、`pageSize`、`loading`、`filters`、`pageSizeOptions`、`load`、`query`、`changePage`、`changePageSize`、`resetFilters`、`syncRoute` | 13 个列表页（仓库 5、申购 5、设置 3） |
| `useExportJob.ts` | 异步导出任务轮询：提交 → 轮询到 `SUCCEEDED`/`FAILED`（默认 1500ms 间隔），失败抛 `AppError` | `running`、`run(payload)` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useImportJob.ts` | 异步导入任务轮询：同样的提交+轮询流程，带同步重入保护（重复提交抛 `IMPORT_IN_PROGRESS`），成功返回 `result` | `running`、`run(file)` | `HuaXingStockView`、`SecondaryWarehouseLiteView`、`MaterialCodeLibraryView` |
| `useImportConfirm.ts` | 全量更新导入的确认弹窗：确认后立刻禁用按钮并切换进行中文案，防重复提交（`maskClosable/closeOnEsc` 均为 false），错误交给 `onError` | 返回 `confirmImport(options)` 函数 | 同上三个导入页面 |
| `useImplicitAiSearch.ts` | 隐式 AI 搜索：用户显式展开关键词优先，源输入变化时自动清除展开值 | `searchName`、`applyExpandedName(value)`、`clearExpandedName()` | `PurchaseRequestsView`、`PurchaseMaterialsView` |
| `useShiftWheelHorizontalScroll.ts` | 在表格滚动容器上支持 Shift+滚轮横向滚动 | 无返回值（内部挂/卸 `wheel` 监听，`passive: false`） | 申购 3 个列表页 |

</TabsContent>

<TabsContent id="t3">

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
#### `web/src/constants/`、`types/`、`config/`
| 文件 | 职责 |
| --- | --- |
| `constants/branding.ts` / `constants/purchase.ts` | `LOGO_URL = '/logo.png'`；申购默认值/选项：`defaultPurchasePlanStatus`、`purchasePlanStatusOptions`、`defaultDemandDepartment`、`defaultPurchaseUrgency`、`purchaseUrgencyOptions`、`purchaseCategoryOptions` |
| `constants/shareColumns.ts` | 分享页可展示列定义（键名与后端 Literal 严格一致）：`SHARE_PLAN_COLUMNS`、`SHARE_RECORD_COLUMNS`、`shareColumnOptions()`、`SHARE_DEFAULT_HIDDEN_KEYS = ['status']`、`defaultShareColumnKeys()`，供 `ShareView` 渲染与 `ShareLinksView` 勾选共用 |
| `constants/table.ts` | `tableColumnWidths`（unit/quantity/date/datetime/status/person/code/identifier/name/material/model/text/action）、`preventTableColumnCompression`、`getTableScrollX` |
| `types/navigation.ts` | `Permission` 字面量联合（`warehouse:write`、`purchase:write`、`settings:write`、`read`）、`rolePermissions: Record<Role, Permission[]>`、`roleLabels: Record<Role, string>` |
| `types/export.ts` / `config/env.ts` | `ExportOption = DropdownOption & { label: string; key: string }`；VITE_* 解析（见 API 客户端一节的 baseURL 说明） |
| `theme.ts` | Naive UI `themeOverrides`（主题色 `#3f63d8`、圆角与阴影等），由 `App.vue` 传给 `n-config-provider` |
| `styles.css` | 全局样式与 CSS 变量：字体栈、`--color-primary/-success/-warning/-danger`、文本/边框/表面色、`--radius-control`、局部加载遮罩底色等 |
#### `web/src/layouts/`
页面文件与职责见「路由表」的职责列。`layouts/AppLayout.vue` 是唯一布局：`n-layout` + 侧边菜单（`menuOptions` 由 `auth.can()`、`settings.isLiteMode` 动态拼装：工作台、备忘录、二级库分组或精简二级库、华星总库存、申购管理、系统管理），顶栏含用户信息与下拉（「外观」二级菜单：悬浮父项向左展开自动/浅色/深色三档，另有「退出登录」调 `auth.logout()` + 跳 `login`；顶栏不放独立的明暗切换图标）；`useMediaQuery('(max-width: 768px)')` 时侧栏切换为抽屉。


</TabsContent>

<TabsContent id="t4">

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
这些值在**构建阶段**被写入静态产物，部署后改环境变量无效，需重新构建（详见 [/frontend-separated-deployment](/frontend-separated-deployment)）。
### 部署
| 项 | 内容 |
| --- | --- |
| 构建变量与跨域/CDN | 见 [/frontend-separated-deployment](/frontend-separated-deployment) |
| `web/Dockerfile` | 两阶段：`node:22-alpine` 执行 `npm ci` + `npm run build`（`ARG VITE_API_BASE_URL=/api/v1` 经 `ENV` 注入），再用 `nginx:1.27-alpine` 托管 `/app/dist`；`EXPOSE 80`，健康检查 `wget -q --spider http://127.0.0.1/` |
| `web/nginx.conf` | `location /api/` 反代到 `http://backend:8000`（带 `X-Real-IP`/`X-Forwarded-*`，`proxy_read_timeout 60s`）；`location /` 用 `try_files $uri $uri/ /index.html` 支持 history 路由；静态资源（js/css/图片/字体）7 天 `immutable` 缓存；`client_max_body_size 50m` |
| `web/edgeone.json` | 静态托管的输出目录 `dist` 与 `/yangrucheng-assets/*`、`*.png`、`*.jpg` 的 14 天缓存头 |

</TabsContent>

</Tabs>
