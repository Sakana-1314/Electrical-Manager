---
layout: home
title: HXNI 电气无忧：电气车间业务管理系统

hero:
  name: HXNI 电气无忧
  text: 电气车间业务管理系统
  tagline: 库存、申购、请购与采购跟踪一体化，配套微信小程序扫码出库与 AI 接口。
  actions:
    - theme: brand
      text: 在线演示
      link: /demo
    - theme: alt
      text: 功能总览
      link: /features
    - theme: alt
      text: 部署指南
      link: /guide

features:
  - title: 库存管理
    details: 二级库物资、库存余额与流水，流水可修正、冲销并自动重算后续余额。
  - title: 申购与采购跟踪
    details: 申购计划可暂缺编码，低库存给出建议数量，申购记录按单同步外部平台。
  - title: 多端协同
    details: 网页端 + 微信小程序扫码出库 + MCP / 接口令牌对接 AI Agent。
---

## 模块概览

| 模块 | 覆盖 |
| --- | --- |
| 库存模块 | 二级库物资、库存余额与流水、补库与低库存、精简库存 |
| 申购模块 | 申购计划、请购与到货 |
| 采购跟踪 | 按申购单号整单同步外部平台 |
| 数据协同 | Excel 导入导出、链接分享 |
| 平台能力 | 图片附件、AI 搜索与 MCP、备忘录 |
| 用户与权限 | 四角色、微信身份合并、接口令牌 |

完整功能清单见 [功能总览](/features)；表结构、状态机与数据流见[系统设计](/dev-data-model)。

## 快速入口

| 想做什么 | 去哪里 |
| --- | --- |
| 先点一遍看效果 | [在线演示](/demo)（内嵌，不写真实数据） |
| 部署一套 | [部署指南](/guide) |
| 调接口 | [接口文档](/api)、[接口约定](/api-conventions)、[错误码总表](/api-error-codes) |
| 读/改代码 | [数据模型](/dev-data-model)、[状态机](/dev-state-machines)、[数据流](/dev-flows)、[架构设计](/dev-architecture) |
| 了解 UI | [UI 设计](/ui-design-guidelines) |
