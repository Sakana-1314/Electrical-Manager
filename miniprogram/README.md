# HXNI 电气无忧 小程序（简称「电气无忧」）

原生微信小程序（扫码出库、隐患登记与整改跟进、台账查看），使用 TDesign Mini Program 组件库（^1.18.0）。启动后通过 `wx.login` 无感登录；未注册用户只有在提交姓名后才会创建 OpenID 与姓名映射，管理端不支持手工新增。之后可扫描物资小程序码直接进入对应物资的出库页面。

## 功能开关

各功能页的模式由网页端「高级设置」下发（`utils/features.js` 的 `xxx_mode`）：`disabled` 隐藏入口、`query_only` 只读、`read_write` 可写（库存可出库、隐患可登记与跟进）。台账查看是纯浏览功能（列表 + 搜索 + 详情），只提供 `disabled` / `query_only` 两档。开关只做前端入口拦截，后端数据接口不按它鉴权。

## 本地运行

1. 在本目录执行 `npm install`。
2. 复制 `config/index.example.js` 为 `config/index.js`，把 `apiBaseUrl` 改成实际后端域名（形如 `https://<域名>`，不要带 `/api/v1`）。该文件已被 `.gitignore` 忽略，真实域名不要提交到仓库。
3. 使用微信开发者工具导入本目录。
4. 将 `project.config.json` 的 `appid` 替换为正式小程序 AppID。
5. 在微信开发者工具中执行“工具 → 构建 npm”。
6. 在小程序后台把 `config/index.js` 里的域名配置为 request 与 uploadFile 合法域名。

提交前执行 `npm run check`（静态结构检查，含官方主题令牌、接线与接口域名配置校验）与 `npm test`（页面逻辑冒烟测试，用最小 wx 桩加载页面，不需要开发者工具）。

## 接口域名配置

仓库是公开的，接口域名不写入版本库：运行时的 `config/index.js` 由本地配置或 CI 生成，仓库只保留 `config/index.example.js` 模板。

- 本地开发：复制模板后只填域名（origin），`/api/v1` 前缀由 `config/api.js` 统一追加。
- CI 上传：工作流从 GitHub Secret `MINIPROGRAM_API_BASE_URL` 生成 `config/index.js`（结尾斜杠会被去掉），缺失时直接失败。
- `npm run check` 会校验 `apiBaseUrl` 是纯域名（不带路径），且 `config/api.js` 能正确追加 `/api/v1`。

## 深色模式（自动跟随设备）

小程序端不提供手动切换：`app.json` 保持 `darkmode: true` + `themeLocation: theme.json`，外观由 TDesign 官方主题文件 `theme.wxss` 的 `@media (prefers-color-scheme: light/dark)` 自动跟随设备。

| 层 | 位置 | 约定 |
| --- | --- | --- |
| 官方主题 | `theme.wxss` | TDesign 官方浅 / 深两套 `--td-*` 令牌，靠 `prefers-color-scheme` 自动切换；不要手改其中的色值 |
| 项目别名 | `app.wxss` | 第一行 `@import "theme.wxss";`；`page, .page` 把 `--app-*` 语义别名全部指向官方 `--td-*`（如 `--app-bg: var(--td-bg-color-page)`） |
| 原生外观 | `theme.json` | 窗口底色与官方页面底色一致（浅色 `#f3f3f3` / 深色 `#181818`），`darkmode` 自动切换状态栏与下拉区域 |
| 导航栏 | `components/app-navbar` | 内部用 `t-navbar`，底色 / 标题色引用 `--app-*`，自动跟随主题 |

- 页面与组件样式**只引用 `--app-*` / `--td-*` 变量，不写颜色字面量**（`npm run check` 会拦截），也不在页面里用 `@media (prefers-color-scheme)`。
- 不再有 `utils/theme.js`、`withTheme`、`themeClass`、外观选择器或本机档位 storage；系统切换深色时无需任何 JS。
- 全站 `navigationStyle: custom`，每个页面首行是 `<app-navbar title="{{i18n.xxx}}" />`；列表页不再写顶部大标题，详情统一走独立页面而不是弹窗（`npm run check` 会校验 app-navbar 接线）。

后端需要配置：

```env
APP_WECHAT_MINI_PROGRAM_APP_ID=第一个小程序AppID,第二个小程序AppID
APP_WECHAT_MINI_PROGRAM_APP_SECRET=第一个小程序AppSecret,第二个小程序AppSecret
```

AppID 和 AppSecret 按相同顺序使用英文逗号分隔，可继续追加任意数量。AppSecret 仅配置在
后端，不得写入小程序代码。

## 列表页筛选与分字段搜索

列表页统一用共享组件 `components/filter-panel`（搜索 + 筛选）：收起态只占一行「字段选择 + 搜索框 + 筛选按钮（带已选数量角标）」，
点开是底部弹层，分区平铺选项。筛选维度再多也不占首屏；生效条件个数只体现在筛选按钮的角标上，具体条件在弹层里看与改。

**分字段搜索**指**多个字段组合搜索**，与网页端「每个字段一个输入框」一致：

- 弹层顶部把该页每个字段都列成一个输入框，填哪几个就**同时满足**哪几个（AND），留空的不参与过滤。
- 收起态的搜索框只做「综合搜索」（跨字段 OR），不放字段选择器——组合搜索统一在弹层里做。

| 页面 | 搜索字段 | 筛选维度 |
| --- | --- | --- |
| 二级库库存 | 综合 / 名称 / 型号规格 | 库存状态、库存数量区间（精简模式下只有综合搜索） |
| 华星总库存 | 综合 / 名称 / 型号 / 货品编码 | 申购部门（多选）、申购人（多选）、首次入库日期区间 |
| 申购计划 | 综合 / 名称 / 型号规格 / 物料编码 | 紧急程度、类别、提报员工（当前用户置顶）、实际需求人、需求部门、子项号、计划日期区间 |
| 申购记录 | 综合 / 名称 / 型号 / 物料编码 / 追溯号 / 申购单号 / 用途 | 状态、类别、子项号、业务员、提报员工、实际需求人 |
| 隐患管理 | 综合 / 检查区域 | 整改状态、仅逾期、隐患等级、隐患类型、责任单位、整改员工、检查日期区间 |
| 物料编码 | 综合 / 名称 / 型号规格 / 物料编码 | — |
| 台账查看 | 综合 | 标签（平铺 + 层级路径，选中父标签包含子标签） |

面板里点选项只改草稿，点「确定」一次性生效；点「重置」清空全部条件并立即生效（角标归零）。
多选在请求里用 `|` 连接（后端按「任一」匹配），区间拆成 `from` / `to` 两个参数。
选项来源：固定枚举在页面内置，自由文本来自各页的 `filter-options` 接口（分享带来的值若已不在候选里会补进选项）。

筛选项接口失败时**不弹提示**（列表本身是好的），面板顶部会出现一行「筛选项没加载出来 · 重新加载」，
点一下只重拉选项。固定枚举分区（状态、等级、仅逾期）不依赖接口，失败时照常可用。

## 分享带搜索 / 筛选

列表页转发给同事时，会把当前的搜索词、搜索字段与筛选值一起写进分享链接：对方点开分享卡片，**已注册就直接看到同一份筛选结果**；未注册则先绑定，绑定后由回跳参数自动落到同一份结果。覆盖申购计划、申购记录、隐患管理、二级库库存、华星总库存、物料编码与台账查看。

编解码集中在 `utils/share.js`（小程序 `onLoad` 的 query 不会自动解码，读取时统一解码）；分享值已不在筛选候选项里时会补进面板选项，固定枚举（库存状态、隐患状态 / 等级、仅逾期）则校验后再采用。

## 当前项目（项目隔离）

业务数据按项目隔离，小程序始终处在某一个项目内：当前项目 id 存本机 storage（`currentProjectId`），每个请求（含图片上传）都带 `X-Project-Id`；请求没带头时后端落到默认项目（P05），所以旧版本客户端也能继续用。切换入口在首页「个人信息」弹窗的「当前项目」一行：收起时显示项目名称，点击后弹出 `t-picker` 滚轮选择器（默认定位到当前项目，取消不改动、确认才切换）。项目被停用或删除时，请求会自动清掉失效项目、重新解析后再重试一次。

| 层 | 位置 | 约定 |
| --- | --- | --- |
| 项目状态 | `utils/project.js` | 当前项目 id 与项目对象缓存在本机 storage；项目列表一次会话只拉一次，拉取失败不阻塞业务（后端有默认项目兜底）；停用项目不展示、不能被选中 |
| 请求头 | `utils/request.js` | 请求与图片上传都带 `X-Project-Id`（每次重试都重新读取）；收到 `PROJECT_DISABLED` / `PROJECT_NOT_FOUND` 时清掉本地项目、重新解析后重试一次 |
| 切换入口 | `pages/home/home.wxml`（个人信息弹窗） | 单行触发器打开 `t-picker` + `t-picker-item`：选项用组件约定的 `{ label, value }`（`value` 即项目 id），`value` 属性传 `[当前项目 id]` 以定位当前项；取消 / 确认按钮文案取自 `utils/i18n.js`（不沿用组件库的 zh_CN 词典）；确认后整页重启回首页（`wx.reLaunch`） |

## GitHub Actions 自动上传

推送 `miniprogram/` 下的改动到 `main` 分支后，工作流“自动上传微信小程序代码”会检查并上传开发版本，也可以在 GitHub Actions 页面手动运行。版本号统一使用北京时间日期，例如 `v2026.07.26`；上传备注（版本描述）使用触发本次构建的提交标题，例如 `feat: 小程序详情页字段支持长按选中复制 (#390)`，因此合并时的 PR 标题会直接显示在微信公众平台的开发版本里。

请在仓库的 `Settings → Secrets and variables → Actions` 中添加：

- `WECHAT_MINIPROGRAM_APPID`：正式小程序 AppID。
- `WECHAT_MINIPROGRAM_PRIVATE_KEY`：微信公众平台“小程序代码上传”中生成的上传私钥完整内容。
- `WECHAT_MINIPROGRAM_APPID_2`：第二个小程序 AppID。
- `WECHAT_MINIPROGRAM_PRIVATE_KEY_2`：第二个小程序的上传私钥完整内容。
- `MINIPROGRAM_API_BASE_URL`：后端接口域名，形如 `https://<域名>`（不要带 `/api/v1`，代码会追加）。工作流用它生成 `config/index.js`，不写进仓库。

工作流会先完成一次依赖安装、接口域名配置生成和代码检查，再将同一版本依次上传到两个小程序。运行时，小程序
会通过 `wx.getAccountInfoSync()` 上报自身 AppID，后端据此选择对应 AppSecret；不要把 AppSecret
或上传私钥写入小程序代码。

如果微信公众平台启用了上传 IP 白名单，GitHub 托管运行器的动态出口 IP 可能导致上传失败。此时需要关闭上传 IP 白名单，或改用具有固定出口 IP 的自托管运行器。

## 小程序码内容

网页端通过微信 `getUnlimitedQRCode` 接口生成物资小程序码，`scene` 使用物资 UUID 的 32 位无连字符形式。扫码进入后会自动载入对应物资；小程序内扫码同样兼容该小程序码。
