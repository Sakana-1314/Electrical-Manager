# AGENTS.md — 面向 AI 编程智能体的项目约定

本文档约束在 `Electrical-Manager`（HXNI 电气无忧）仓库内工作的 AI 编程智能体。
与 `README.md`（面向人类开发者）互补，此处聚焦「如何改代码、如何提交、如何上线」。

> `CLAUDE.md` 只有一行 `@AGENTS.md`，用 Claude Code 的导入语法把本文件共享给它（Windows 上不依赖符号链接）；
> 智能体约定**只写在本文件**，改约定不要往 `CLAUDE.md` 里加内容。

## 项目概况

- 项目名称：**HXNI 电气无忧**（英文标识 `Electrical-Manager`）。面向华星镍业检修维护部电气自动化车间，覆盖二级库库存、申购计划、请购与到货、采购跟踪、精简库存、图片附件、表格导入导出、链接分享、用户权限、AI 搜索/MCP 与备忘录；不涉及物资价格和成本核算。
- 前端（网页端）：Vue 3 + TypeScript + Vite + Naive UI + Pinia，位于 `web/`。
- 后端（服务端）：FastAPI + SQLAlchemy 异步，位于 `server/`。
- 小程序：微信小程序，位于 `miniprogram/`。
- 项目站点：VitePress，位于 `docs/websites/`，由 CI 构建后发布到 `gh-pages` 分支（GitHub Pages）。
- 前后端契约统一维护在 `docs/openapi.yaml`，前端类型由它生成（`src/api/generated.raw.ts`、`src/api/generated.ts`），**禁止手改生成文件**。
- 数据库只维护 `docs/references/database/init.sql`（结构与种子数据唯一来源，**不提交迁移脚本**，见下文「数据库结构约定」），env 模板位于 `docs/env/`。
- 部署：Docker Compose 使用 `ghcr.io/sakana-1314/electrical-manager:server` 与 `:web` 两个镜像，由 CI 在合并后推送到 GitHub Container Registry；`web/.dockerignore` 与 `server/.dockerignore` 各自对应其构建上下文。
- 默认工作目录：仓库根目录 `/workspace/备件管理系统`。

## 必读先做

动手改代码前，先阅读并遵守：

- `docs/openapi.yaml` — 接口契约；改后端接口时同步契约，并用 `npm run generate:api`（在 `web/` 目录）重新生成前端类型。
- `docs/websites/pages/ui-design-guidelines.md` — UI 组件与样式约定。
- `docs/websites/pages/api-conventions.md`（接口约定：错误响应与状态码规则）、`docs/websites/pages/api-error-codes.md`（全部错误码总表，改错误码必须同步，见 `server/tests/test_error_code_docs.py`）。
- `.github/workflows/` — CI 流水线（契约一致性校验 / 接口测试 / 构建镜像 / 发布站点）。

## 项目站点（必须遵守）

- 站点源码在 `docs/websites/`：`pages/` 是内容（VitePress `srcDir`），`.vitepress/config.ts` 是配置，`package.json` 管理依赖。
- 已发布的文档（部署指南、接口约定、系统设计：数据模型 / 状态机 / 数据流 / 架构设计 / UI 设计）都在 `pages/` 下，**不要再放回 `docs/` 根目录**；`docs/` 根只保留 `openapi.yaml`、`env/`、`references/` 与 `websites/`。
- `base` 必须与仓库路径一致（`/Electrical-Manager/`）；**仓库改名后要同步改** `.vitepress/config.ts` 的 `base` 与 README／AGENTS 里的站点地址。
- 站点地址统一写作 `https://Sakana-1314.github.io/Electrical-Manager/`（大小写按账号名书写；域名解析本身不区分大小写，但文档里保持一致更易读）。
- 发布由 `.github/workflows/website.yml` 在 `main` 变更时自动完成：构建 `docs/websites` 后推送到 `gh-pages` 分支，由 GitHub Pages 发布；不要手工提交构建产物。
- 本地预览：`cd docs/websites && npm install && npm run dev`；提交前跑一次 `npm run build` 确认能构建。
- **长页面必须拆成二级 tab**：用站点自带的 `<Tabs>` / `<TabsContent>` 组件（见 `.vitepress/theme/components/`），
  不要把一个主题写成几百行的滚动长文。tab 列表写在 `<Tabs :tabs="[{ id, title }, …]">` 上，面板用同名 id：

  ```md
  <Tabs :tabs="[{ id: 'a', title: '标题 A' }, { id: 'b', title: '标题 B' }]">
  <TabsContent id="a">
  …markdown…
  </TabsContent>
  <TabsContent id="b">
  …markdown…
  </TabsContent>
  </Tabs>
  ```

  这些是站内 Vue 组件，**在 GitHub 上浏览 markdown 时会显示成标签文本**，因此 README 与其它给 GitHub 看的
  文档不要用它们（README 只用普通 markdown 表格）。
- **图用 Mermaid 写**（```` ```mermaid ```` 代码块）：站点已接入 `vitepress-plugin-mermaid`
  （见 `.vitepress/config.ts` 的 `withMermaid`），状态机用 `stateDiagram-v2`、调用链用 `sequenceDiagram`、
  表关系用 `erDiagram`；不要贴图片，图片会随代码变化而过期。
- 文档页面之间互相引用用站点绝对路径（如 `/dev-data-model`、`/api-error-codes`），不要用相对路径 `../`；
  VitePress 构建会检查死链，写错会在 CI 里失败。
- 站点文档不要写项目演进史或「以后会覆盖什么业务」，只描述当前实现与当前功能。
- **演示站的深链刷新靠站点 404 页回退**：GitHub Pages 只回站点根目录的 `404.html`（子目录内的
  `404.html` 不生效，已实测），所以回传脚本由 `docs/websites/scripts/inject_demo_fallback.py`
  注入到站点 404 产物；演示入口的还原脚本在 `web/index.html`，只在带
  `data-demo-base` 标记的演示产物里生效（业务构建直接 return）。演示后端直连 Apifox Mock
  （`web/.env.demo` 的 `VITE_API_BASE_URL`），**不使用 service worker 转发**；改这条链路时两边要一起改。

## 验证命令（提交前必须通过）

在 `web/` 目录执行：

```bash
npx vue-tsc -b            # TypeScript 类型检查
npx eslint <改动的文件>    # 或 cd web && npm run lint（全量）
npm run test              # vitest 单测（如有涉及组件）
npm run build             # 类型检查 + 生产构建
```

后端在 `server/` 目录：`pytest`。
注意 CI 含「校验 openapi / generated.ts 未漂移」：改接口契约后必须重新生成并提交生成文件，否则 CI 失败。

## 代码与提交规范

- **提交信息**：中文 + Conventional Commits 前缀（`feat` / `fix` / `style` / `chore` / `ci` / `docs` / `refactor` / `test`），一行简洁标题 + 空行 + 详细说明（可选列点）。
- **分功能点提交**：一个逻辑改动（一个功能/一个修复）对应一个 commit；不要把无关改动混进同一 commit。
- **分支命名**：`<type>/<kebab-case-描述>`，如 `fix/export-total-display`、`feat/share-link-columns`。
- **public/ 资源要用 `publicUrl()` 拼 base**：Vite 只重写 `index.html` 里的绝对路径，代码里写死的
  `'/logo.png'` 不会自动加 base，子路径部署（演示站 `/Electrical-Manager/demo/`）会 404。
  需要引用 `web/public/` 下的资源时用 `web/src/config/env.ts` 的 `publicUrl('xxx.png')`。
- **模板 vs JS 中 ref 的差异**：`<script setup>` 里从 composable 解构出的 `ref` 只在模板中自动解包；在 computed / 普通 JS / 模板字符串中必须写 `.value`（否则显示 `[object Object]`）。

## 数据库结构约定（必须遵守）

- **只保留 `docs/references/database/init.sql`**：它是数据库结构与种子数据的唯一来源，`server/tests/test_init_sql.py` 会校验它与 ORM 模型完全一致（表、列、NULL 约束、ENUM、索引、外键）。改模型必须同步改 `init.sql`，否则测试失败。
- **禁止再往仓库提交任何增量迁移脚本**：包括 `migrations/` 目录、`upgrade-*.sql`、按日期命名的 `*.sql`，以及任何"已有库升级步骤"脚本。历史迁移脚本已全部删除，今后**不要再新增**，也不要恢复已删除的文件。
- **需要帮部署方升级已有库时**：在 PR 描述、issue 或对话里给出一次性 SQL 文本，或让部署方自行按各自流程改库；仓库只维护 init.sql。
- **不在仓库文档里罗列升级脚本清单**：README 只说明「新库用 init.sql 初始化 + 已有库由部署方自行改库」，不逐条列迁移历史。

## 接口令牌 / 密钥的回显约定（必须遵守）

> 原则：**凭证可以加密（或哈希）入库，但界面必须每次都回显已保存的值，避免每次重新生成 / 重置。**

- **存储**：接口令牌、API Key 等敏感凭证不得明文落库，须加密（如 Fernet 对称加密，参考 `server/app/services/ai_search_service.py` 的 `_encrypt_api_key` / `_decrypt_api_key`，密文存 `*_encrypted` 字段）或哈希后存储；需要界面回显的凭证必须**加密**（可逆）入库，哈希仅用于纯认证查找。
- **回显**：读取接口必须解密回显明文凭证，前端每次进入页面都能看到已保存的值（如 AI 搜索配置读取时 `api_key` 字段始终回显，用户无需每次重置）。**禁止**让界面出现「库中只存哈希，请重新生成后再复制」之类需要用户每次重新生成 / 输入的提示。
- **用户接口令牌（已按约定改造）**：`user` 表双列存储——`api_token_hash`（SHA-256，认证快速查找）+ `api_token_enc`（Fernet 密文，可逆回显）；`/users` 读取与 PATCH 每次解密回显（见 `dictionary_service._echo_api_token`）。仅存哈希的历史数据在令牌下次成功用于接口调用时由认证路径自动加密回写（见 `core.permissions.find_user_by_api_token`），此后持续回显，无需用户重新生成。
- **涉及此类存储 / 回显改动时**：同步更新 `docs/openapi.yaml` 契约并重新生成前端类型（在 `web/` 目录执行 `npm run generate:api`），在 PR 描述中说明加解密与回显方案。

## 项目隔离约定（必须遵守）

业务数据按「项目」隔离（现有项目 + 后续可继续新增项目），实现集中在 `server/app/core/project_scope.py`：
请求头 `X-Project-Id` + `ContextVar` + ORM 事件（读过滤 / 写守卫）。改代码时遵守以下约定：

- **新增业务表必须继承 `ProjectScoped` 并登记到 `app.models.PROJECT_SCOPED_MODELS`**（同时改 `init.sql`、ORM 与 `test_init_sql.py` 能过），否则该表不会被隔离。
- **业务路由必须声明项目依赖**：`APIRouter(..., dependencies=[Depends(require_current_project)])`（`share` / `excel_export_jobs` 这类含匿名端点的路由按端点声明），让缺项目头时返回 400 `PROJECT_REQUIRED`。
- **service 不要逐个写 `project_id` 过滤**：读过滤由全局事件注入；只有显式跨项目语义的地方（按 id 反查任意项目的数据）才写 `Model.project_id == ...`，并放在 `system_scope()` 内。
- **后台任务与匿名入口必须显式声明上下文**：按行记录恢复用 `project_scope(job.project_id)` / `async with project_session(...)`；系统级（清理、附件引用统计、匿名导出下载）用 `system_scope()` / `async with system_session()`。调用 `SessionLocal()` 而不设上下文会 fail-closed 报 `PROJECT_REQUIRED`。
- **项目域唯一键要带 `project_id`**（如 `(project_id, plan_no)`）：编号/编码按项目生成，跨项目必须允许同号。
- **不隔离的全局表**（`project`、`user`、`mini_program_user`、`mini_program_identity`、`system_setting`、`file_object`、`memo`、`webhook_channel`、`webhook_delivery`、`business_event_log`）新增字段时不受隔离层影响。
- **匿名分享/导出下载按记录自身解析项目**：分享页先在全项目上下文取 `share_link`，再切到该分享的项目读数据。
- **老库升级**：仓库不提交迁移脚本；已有库的升级 SQL 放在 PR 描述或对话里（`outputs/` 下的脚本不入库），新库直接用 `init.sql`。

## MCP 可调用性约定（必须遵守）

MCP 工具目录由 `app.openapi()` 自动生成（`server/app/mcp_server.py`），**默认要求每个管理端接口都能被 `operation_call` 完整操作**：

- **参数位置只用** 路径 / 查询 / 请求头 / JSON 请求体；文件上传只能单文件 multipart 且表单字段名必须是 `file`（cookie、多文件或其它表单字段 MCP 传不进去，新增这类接口必须同时扩展 `operation_call`）。
- **乐观锁版本号走 `If-Match` 请求头**（`IfMatchVersion`）：网页端由 `web/src/api/*.ts` 按需传，MCP 端用 `operation_call` 的 `headers` 传（如 `{"If-Match": "3"}`）；`X-API-Token` 与 `X-Project-Id` 由 MCP 层统一设置，不接受调用方传入。
- **排除项必须显式且同步**：需要排除的接口（登录/刷新、小程序专用前缀等）写进 `mcp_server.py` 的 `EXCLUDED_PATHS` / `EXCLUDED_PREFIXES`，同时更新 `docs/websites/pages/dev-architecture.md` 的 MCP 小节；排除项必须仍能命中存活路由（端点删除后要清理），由 `server/tests/test_mcp_docs.py` 与 `server/tests/unit/test_mcp_server.py` 校验。
- **文档同步**：改工具清单、排除清单或 MCP 链接参数（`project_id` 在 `token` 之前）时必须同步文档，否则 CI 的文档一致性测试失败。

## 标准开发与发布工作流（必须遵守）

> 目标：每个功能点独立成 PR，合并后不留残余分支。所有操作在仓库根目录执行。

### 1. 从最新 main 开功能分支

```bash
git checkout main && git pull
git checkout -b <type>/<描述>
```

### 2. 分功能点提交

```bash
git add <本次功能点涉及的文件>
git commit -m "type: 中文标题"
```

确认 `git status` 干净、无本功能点之外的改动。

### 3. 推送并创建 PR

```bash
git push -u origin <分支名>
gh pr create --title "type: 中文标题" --body "<问题/原因/改动/验证>"
```

PR 标题与 commit 标题一致（squash 后作为最终 commit 标题）。

### 4. 检查通过后才合并

- 本地验证通过（见「验证命令」）。
- `gh pr checks <编号> --watch` 等 CI 全部通过（含契约一致性校验、接口测试、构建镜像）。
- 自查 `gh pr diff <编号>` 确认改动只涉及本功能点。
- 通过后合并：本仓库只允许 squash：

```bash
gh pr merge <编号> --squash --delete-branch
```

`--delete-branch` 会同时删除本地和远端的功能分支。

### 5. 回到 main 并同步

```bash
git checkout main && git pull
```

### 6. 清理多余分支

- 合并后功能分支已由 `--delete-branch` 删除。
- 定期清理远端孤立/已关闭 PR 的分支：

```bash
git fetch --prune
gh pr list --state all   # 找出 CLOSED 且未合并的分支
git push origin --delete <多余分支名>
git branch -D <多余分支名>  # 如需删除本地对应分支
```

## 注意事项

- 不直接提交到 `main`：所有改动经功能分支 + PR 合并（squash）。
- 不修改 CI / 契约生成文件以外的受保护文件；生成文件（`generated.*`、`openapi.yaml` 派生内容）通过脚本再生成，不手改。
- PR 描述遵循「问题 / 原因 / 改动 / 验证」结构，便于 review 与回溯。
- 涉及接口或 Excel 模板变更时，同步更新 `docs/openapi.yaml` 与对应模板，并在 PR 描述中说明。
