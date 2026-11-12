# 在线演示

下面嵌入的是本系统网页端的完整体验环境，可直接操作。演示后端为
[Apifox Mock 服务](/api)：返回的是契约里的响应示例（一套华星镍业电气自动化车间业务台账），
所有读写均为模拟数据，不影响任何真实业务数据。

<iframe
  src="/Electrical-Manager/demo/"
  title="HXNI 电气无忧 在线演示"
  width="390"
  height="844"
  style="display:block;margin:16px auto;border:1px solid var(--vp-c-divider);border-radius:24px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.08)"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>

<p style="text-align:center;margin-top:8px">
  <a href="/Electrical-Manager/demo/" target="_blank" rel="noopener">在新窗口打开演示 ↗</a>
</p>

## 可用功能

| 项 | 说明 |
| --- | --- |
| 登录账号 | `admin` / `warehouse` / `purchase` / `readonly`，密码均为 `123456`；Mock 的登录响应是固定示例，四个账号都以示例用户身份进入 |
| 覆盖模块 | 工作台、二级库物资、库存余额与流水、申购计划、申购记录、物料编码库、华星库存、周期性计划、精简库存、备忘录 |
| 可交互操作 | 新增、编辑、删除、出入库、冲销流水、筛选与分页排序；写入仅作用于 Mock 服务，刷新后恢复响应示例 |
| 权限差异 | 接真实后端时按用户权限位区分菜单、入口与写操作；Mock 下统一按示例用户（系统管理员）呈现 |

演示为手机端比例的窗口，与系统在移动端的呈现一致；宽屏下建议点「在新窗口打开演示」。

## 构建与发布

| 产物 | 构建命令 | base | 部署位置 |
| --- | --- | --- | --- |
| 业务网页端 | `npm run build` | `/` | 自有服务器 / 容器镜像 |
| 在线演示 | `vite build --mode demo` | `/Electrical-Manager/demo/` | 本站在 `/demo/` |

演示的构建参数在 `web/.env.demo`（子路径与 Mock 地址），后端由 `VITE_API_BASE_URL` 指向
Apifox Mock（前端不内置 Mock 层）。发布由 `.github/workflows/website.yml`
在站点构建完成后构建演示并复制到站点输出的 `demo/` 目录，因此与文档站同域，可直接 iframe 嵌入。

## 深链刷新

演示使用 history 路由，静态托管本身没有 SPA fallback。这里加了一层回退，**深层路由可以直接刷新**：

| 步骤 | 行为 |
| --- | --- |
| 1 | 刷新 `/demo/warehouse/stock` 时静态托管找不到文件，落到站点 404 页 |
| 2 | 站点 404 页识别为演示路径，带原路径跳回演示入口（`?path=…`） |
| 3 | 演示入口的引导脚本在路由挂载前还原真实路径，页面正常渲染 |

只影响演示产物与站点 404 页：业务构建不带该标记，行为不变；路由配置未改，正常访问时 URL 也不变。
