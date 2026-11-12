# HXNI 电气无忧 网页端

按 [架构设计](../docs/websites/pages/dev-architecture.md) 中的前端架构实现 Vue 3 + TypeScript 前端。本地开发把 `/api` 代理到本机后端，也可直接指向 [Apifox Mock](https://Sakana-1314.github.io/Electrical-Manager/api) 联调。

## 启动

```bash
npm install
npm run dev
```

演示账号密码均为 `123456`：`admin`、`warehouse`、`purchase`、`hazard`、`ledger`、`readonly`，分别对应六种角色。

## 接入后端

复制 `../docs/env/frontend.env.example` 为 `.env.local`。

| 场景 | `VITE_API_BASE_URL` | 说明 |
| --- | --- | --- |
| 本地后端（缺省） | `/api/v1` | `npm run dev` 由 Vite 代理到 `VITE_API_PROXY`（缺省 `http://localhost:8000`） |
| Apifox Mock | Mock 环境的完整地址（含 `/api/v1`） | 直连 Mock，不经过代理 |
| 线上后端 | `https://api.example.com` | 只填域名时自动补 `/api/v1` |

生产环境由 CI/CD 在 `npm run build` 前注入：

```dotenv
VITE_API_BASE_URL=https://api.example.com
# 可选：多后端线路，逗号分隔；配置后优先于 VITE_API_BASE_URL
VITE_API_BASE_URLS=https://api-a.example.com,https://api-b.example.com
```

`VITE_API_BASE_URLS` / `VITE_API_BASE_URL` 只填写服务器域名时会自动补全接口路径。图片直接走当前后端线路的 `/api/v1/files/images`。配置多条线路时，网页首次进入并发探测并选延迟更低的一条，会话内保持；请求遇到网络类错误自动切到下一条，左下角用户菜单的「线路」子菜单也可手动切换。完整的前后端分离、跨域、CDN 与双线路配置见 [部署指南](../docs/websites/pages/guide.md#前后端分离部署)。

运行 `npm run generate:api` 可依据 `../docs/openapi.yaml` 更新 `src/api/generated.ts`；页面和组件没有另建 DTO。

## 校验

```bash
npm run build
npm run test
npm run lint
```

数量在表单、状态和请求体中始终保存为字符串；时区按 `Asia/Shanghai` 展示，写接口发送带 `+08:00` 的 ISO 8601 时间。入出库提交使用 UUID `client_request_id`，确认和请求期间锁定按钮。
