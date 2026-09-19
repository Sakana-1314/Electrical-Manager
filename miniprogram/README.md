# HXNI 电气无忧 小程序（简称「电气无忧」）

原生微信小程序（扫码出库、隐患登记与整改跟进），使用 TDesign Mini Program 组件库。启动后通过 `wx.login` 无感登录；未注册用户只有在提交姓名后才会创建 OpenID 与姓名映射，管理端不支持手工新增。之后可扫描物资小程序码直接进入对应物资的出库页面。

## 本地运行

1. 在本目录执行 `npm install`。
2. 使用微信开发者工具导入本目录。
3. 将 `project.config.json` 的 `appid` 替换为正式小程序 AppID。
4. 在微信开发者工具中执行“工具 → 构建 npm”。
5. 在小程序后台将 `https://materials-manager.qcloud.19890605.xyz` 配置为 request 合法域名。

提交前执行 `npm run check`（静态结构检查，含深色模式令牌与接线校验）。

## 深色模式（界面外观）

三档语义与网页端一致：`auto`（自动，跟随系统，默认）、`light`（浅色）、`dark`（深色）；档位按本机保存在
storage 的 `miniProgramThemeMode`，不落库、不产生请求。首页「个人信息」弹窗里的「外观」下拉菜单（收起时显示当前档位，展开后选自动 / 浅色 / 深色）可切换三档。

| 层 | 位置 | 约定 |
| --- | --- | --- |
| 原生外观 | `app.json` 的 `darkmode` / `themeLocation` + `theme.json` | 窗口与导航栏颜色用 `@变量` 引用 `theme.json`，自动档跟随系统 |
| 主题运行时 | `utils/theme.js` | 解析档位（`auto` 读系统主题，显式档覆盖系统），把 `theme-dark` 类与原生配色同步到页面；页面统一用 `Page(withTheme({…}))` 接入 |
| 样式令牌 | `app.wxss` | 浅色令牌定义在 `page`，深色同名覆盖在 `.theme-dark`；`page, .theme-dark` 把 `--td-*` 桥接到 `--app-*` 供 TDesign 组件使用 |

- 页面与组件样式**只引用 `--app-*` 令牌，不写颜色字面量**（`npm run check` 会拦截），新增令牌时明暗两档必须同名同义。
- 不引入 `tdesign-miniprogram` 自带的 `common/style/theme/*`（媒体查询版暗色）：媒体查询只跟随系统，无法支持显式档，两者混用会互相打架。
- 显式档与系统档不一致时，导航栏与窗口底色由 `wx.setNavigationBarColor` / `wx.setBackgroundColor` 纠正；软键盘、原生选择器弹层等系统级外观仍跟随系统。

后端需要配置：

```env
APP_WECHAT_MINI_PROGRAM_APP_ID=第一个小程序AppID,第二个小程序AppID
APP_WECHAT_MINI_PROGRAM_APP_SECRET=第一个小程序AppSecret,第二个小程序AppSecret
```

AppID 和 AppSecret 按相同顺序使用英文逗号分隔，可继续追加任意数量。AppSecret 仅配置在
后端，不得写入小程序代码。

## 当前项目（项目隔离）

业务数据按项目隔离，小程序始终处在某一个项目内：当前项目 id 存本机 storage（`currentProjectId`），每个请求（含图片上传）都带 `X-Project-Id`；请求没带头时后端落到默认项目（P05），所以旧版本客户端也能继续用。切换入口在首页「个人信息」弹窗的「当前项目」一行：收起时显示项目名称，点击后弹出 `t-picker` 滚轮选择器（默认定位到当前项目，取消不改动、确认才切换）。项目被停用或删除时，请求会自动清掉失效项目、重新解析后再重试一次。

| 层 | 位置 | 约定 |
| --- | --- | --- |
| 项目状态 | `utils/project.js` | 当前项目 id 与项目对象缓存在本机 storage；项目列表一次会话只拉一次，拉取失败不阻塞业务（后端有默认项目兜底）；停用项目不展示、不能被选中 |
| 请求头 | `utils/request.js` | 请求与图片上传都带 `X-Project-Id`（每次重试都重新读取）；收到 `PROJECT_DISABLED` / `PROJECT_NOT_FOUND` 时清掉本地项目、重新解析后重试一次 |
| 切换入口 | `pages/home/home.wxml`（个人信息弹窗） | 单行触发器打开 `t-picker` + `t-picker-item`：选项用组件约定的 `{ label, value }`（`value` 即项目 id），`value` 属性传 `[当前项目 id]` 以定位当前项；取消 / 确认按钮文案取自 `utils/i18n.js`（不沿用组件库的 zh_CN 词典）；确认后整页重启回首页（`wx.reLaunch`） |

## GitHub Actions 自动上传

推送 `miniprogram/` 下的改动到 `main` 分支后，工作流“自动上传微信小程序代码”会检查并上传开发版本，也可以在 GitHub Actions 页面手动运行。版本号统一使用北京时间日期，例如 `v2026.07.26`；上传备注统一使用 `CI 自动上传于 2026/07/26 09:37:12` 格式。

请在仓库的 `Settings → Secrets and variables → Actions` 中添加：

- `WECHAT_MINIPROGRAM_APPID`：正式小程序 AppID。
- `WECHAT_MINIPROGRAM_PRIVATE_KEY`：微信公众平台“小程序代码上传”中生成的上传私钥完整内容。
- `WECHAT_MINIPROGRAM_APPID_2`：第二个小程序 AppID。
- `WECHAT_MINIPROGRAM_PRIVATE_KEY_2`：第二个小程序的上传私钥完整内容。

工作流会先完成一次依赖安装和代码检查，再将同一版本依次上传到两个小程序。运行时，小程序
会通过 `wx.getAccountInfoSync()` 上报自身 AppID，后端据此选择对应 AppSecret；不要把 AppSecret
或上传私钥写入小程序代码。

如果微信公众平台启用了上传 IP 白名单，GitHub 托管运行器的动态出口 IP 可能导致上传失败。此时需要关闭上传 IP 白名单，或改用具有固定出口 IP 的自托管运行器。

## 小程序码内容

网页端通过微信 `getUnlimitedQRCode` 接口生成物资小程序码，`scene` 使用物资 UUID 的 32 位无连字符形式。扫码进入后会自动载入对应物资；小程序内扫码同样兼容该小程序码。
