# 状态机

枚举取值来自 `server/app/domain/enums.py`，流转规则来自 `server/app/services/` 与 `server/app/api/v1/`，错误码来自 `server/app/core/errors.py` 与各服务内抛出的业务错误。全部错误码见[错误码总表](/api-error-codes)。

```mermaid
flowchart LR
    A["业务状态字段"] --> B["「只进不退」的同步规则约束<br/>申购记录行状态"]
    A --> C["有写权限的用户可直接赋值<br/>申购计划状态、申购记录状态"]
    A --> D["缺少通用审批流引擎<br/>非法流转错误码已定义但没有调用点"]
```

<Tabs :tabs="[
  { id: 't0', title: '枚举与申购计划' },
  { id: 't1', title: '库存流水与冲销' },
  { id: 't2', title: '异步任务与推送' },
  { id: 't3', title: '小程序与分享' }
]">

<TabsContent id="t0">

### 枚举总表

| 枚举 | 取值（代码/API 层） | 数据库存储 | 说明 |
| --- | --- | --- | --- |
| `Role` | `SUPER_ADMIN` / `WAREHOUSE_ADMIN` / `PURCHASE_ADMIN` / `READ_ONLY` | ENUM 同名 | 一个用户一个角色 |
| `OperationType` | `INBOUND` / `OUTBOUND` | ENUM 同名 | 流水类型 |
| `SourceType` | `MANUAL` / `MINI_PROGRAM` / `REVERSAL` / `INITIALIZATION` | ENUM 同名 | 来源类型；**无** `PURCHASE_RECEIPT` |
| `PurchasePlanStatus` | `正常` / `暂不申购` / `已归档` | ENUM `NORMAL` / `DEFERRED` / `ARCHIVED` | DB 存枚举名，API 返回中文值 |
| `MiniProgramCodeEnv` | `trial` / `release` | — | 小程序码环境 |
| `MiniProgramStockStatus` | `normal` / `out_of_stock` / `low_stock` | 计算得出，不落库 | 小程序库存标签 |
| `MiniProgramFeatureMode` | `disabled` / `query_only` / `read_write` | 存在 `system_setting.setting_value` JSON | 5 个小程序功能页各自一档 |
| `SecondaryWarehouseMode` | `full` / `lite` | 同上 | 二级库运行模式 |
| `WebhookPlatform` | `FEISHU` / `DINGTALK` | ENUM 同名 | 推送渠道 |
| `WebhookEventType` | `stock.outbound.created` / `stock.inbound.created` / `mini_program.user.bound` | `webhook_delivery.event_type` 存枚举**名**（`STOCK_OUTBOUND_CREATED` 等） | `webhook_channel.subscribed_events` JSON 存**值**（点号形式） |
| `WebhookDeliveryStatus` / `ExcelImportJobStatus` / `ExcelExportJobStatus` | 前者 `PENDING` / `SENDING` / `SUCCEEDED` / `FAILED`，后两者 `PENDING` / `RUNNING` / `SUCCEEDED` / `FAILED` | ENUM 同名 | 投递队列 / 异步任务 |
| `ShareType` | `purchase_plan` / `purchase_record` | ENUM 同名 | 分享数据类型 |
| `ShareExpiryOption` | `24h` / `3d` / `7d` / `30d` / `permanent` | 换算为 `share_link.expires_at`（`permanent` → `NULL`） | 前端选择码，不落库 |
| 申购记录状态 | 自由字符串（`VARCHAR(128)`，默认 `已申购`） | 原样存字符串 | 取值非枚举，筛选项由库中 `DISTINCT` 得出 |
| `urgency` / `category` | 自由字符串 | 原样字符串 | 前端候选：`正常/紧急/非常紧急`、`工具/消耗物资/备品备件` |

### 申购计划状态

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 正常 : 新建计划 / 补库 / 模板生成
    正常 --> 暂不申购 : 人工修改状态
    暂不申购 --> 正常 : 人工修改状态
    正常 --> 已归档 : 人工修改状态
    已归档 --> 正常 : 人工修改状态
    暂不申购 --> 已归档 : 人工修改状态
    已归档 --> 暂不申购 : 人工修改状态
    已归档 --> [*] : 删除（需写入权限与版本号）
    note right of 已归档
        三个状态是运营标记，不是流程阶段：任意互转，只校验版本号
        非超管看不到「暂不申购」与「已归档」，查询被强制限定为正常：ARCHIVED_PURCHASE_PLAN_FORBIDDEN
        删除已转入申购记录的计划会被拒绝：PURCHASE_PLAN_IN_USE
    end note
```

### 转入申购记录、清理与恢复

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 未转入 : 新建计划
    未转入 --> 已转入 : 转入申购记录（单条或批量）
    已转入 --> 未转入 : 从申购记录恢复到计划
    已转入 --> 计划行被清理 : 每日凌晨清理任务置空记录行的计划关联
    计划行被清理 --> 未转入 : 按记录行快照重建计划（保留原计划单号）
    note right of 已转入
        未编码的计划不能转入：MATERIAL_CODE_REQUIRED
        重复转入被拒绝：PLAN_ALREADY_MOVED
        行状态默认「已申购」；申购单号默认按当天日期生成
        批量转入单次最多 200 条
    end note
    note left of 计划行被清理
        只清理「被记录行引用且计划单号快照非空」的计划
        每批 50 条并跳过已锁定行，可由环境变量关闭
    end note
```

### 申购记录行状态（只进不退）

```mermaid
stateDiagram-v2
    direction LR
    state "已申购" as S1
    state "已采购" as S2
    state "部分入库" as S3
    state "已入库" as S4
    [*] --> S1 : 转入申购记录（默认值）
    S1 --> S2 : 外部平台回写
    S1 --> S3 : 外部平台回写（允许跳跃）
    S1 --> S4 : 外部平台回写（允许跳跃）
    S2 --> S3 : 外部平台回写
    S2 --> S4 : 外部平台回写（允许跳跃）
    S3 --> S4 : 外部平台回写
    S4 --> S2 : 目标状态不再允许 → 静默忽略
    S4 --> S3 : 目标状态不再允许 → 静默忽略
    note right of S4
        状态是自由字符串，可被人工批量改成任意值（只校验版本号）
        没有「到货数量」字段，入库流水不自动推进状态
        非法回退不报错：接口仍然成功，只在结果里体现「未变更」
    end note
```

### 外部平台回写规则

```mermaid
flowchart TD
    A["按追溯号或按申购单号整单回写"] --> B["只补空值：文本字段当前为空才写，日期字段为空才写"]
    B --> C["只有实际发生变更才递增版本号"]
    A --> D["未知字段被拒绝；追溯号不存在时计入未命中并继续处理其余项"]
```

</TabsContent>

<TabsContent id="t1">

### 类型与来源的合法组合

```mermaid
flowchart TD
    A["入库 / 出库请求"] --> B{"单据类型"}
    B -- "入库" --> C1{"来源"}
    C1 -- "手工 / 初始化建账" --> OK1["允许"]
    C1 -- "小程序" --> N1["拒绝：小程序来源只能是出库"]
    C1 -- "冲销" --> N2["只能由冲销接口内部创建"]
    C1 -- "填了领用人 / 领用单位" --> N3["拒绝：入库不能填领用人"]
    B -- "出库" --> C2{"来源"}
    C2 -- "手工" --> OK2["允许：必须填用途与领用人"]
    C2 -- "小程序" --> OK3["允许：只能由小程序出库入口创建"]
    C2 -- "冲销" --> OK4["允许：无领用人要求"]
```

```mermaid
flowchart LR
    A["小程序出库流水"] --> B["落库时来源改写为手工，同时写入小程序用户姓名快照"]
    B --> C["读取时按姓名快照判定来源为小程序"]
    C --> D["修改流水时清空该来源会被拒绝"]
```

### 客户端请求键的幂等

```mermaid
flowchart TD
    A["提交出入库：携带客户端请求键"] --> B{"库里已有同键单据？"}
    B -- "是" --> C["返回原单据，库存不变"]
    B -- "是，但小程序出库的物资与请求不一致" --> D["拒绝：同键不同物资"]
    B -- "否" --> E["落单据并重放余额"]
```

### 冲销生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 未冲销 : 入 / 出库，剩余可冲量等于数量
    未冲销 --> 部分冲销 : 冲销数量小于剩余可冲量
    部分冲销 --> 部分冲销 : 继续冲销剩余部分
    未冲销 --> 完全冲销 : 一次性全量冲销
    部分冲销 --> 完全冲销 : 剩余可冲量归零
    完全冲销 --> 完全冲销 : 再次冲销被拒绝
    note right of 部分冲销
        冲销不修改原行数量，只扣减剩余可冲量，并新建方向相反的流水指向原单
        超过剩余可冲量被拒绝：INSUFFICIENT_QUANTITY；冲销行不属于原流水：INVALID_REVERSAL_LINE
        对已是冲销的流水再冲销被拒绝：REVERSAL_NOT_ALLOWED；原流水不存在即找不到资源
        重复提交同一次冲销返回原冲销流水（幂等成功）
        「已冲销」标记表示「这条记录本身是冲销记录」，不是「已被冲销」
    end note
    note left of 完全冲销
        冲销单不投递 Webhook
        发生时间取「当前时间」与「原流水时间加 1 微秒」中较晚者
        子项号继承原流水，领用人与领用单位强制为空
    end note
```

### 已确认流水的修改（重放）

```mermaid
flowchart TD
    A["修改已确认流水：类型 / 时间 / 原因 / 领用人 / 子项号 / 明细与数量"] --> B["按时间、单据、明细行顺序重放受影响物资的全部流水"]
    B --> C["重算每条流水的前后数量快照与当前余额"]
    C --> D["允许结果为负库存"]
    E["流水号、客户端请求键、创建人属于系统字段"] --> F["不可修改，请求体多余字段被拒绝"]
```

### 余额与小程序库存标签

```mermaid
flowchart TD
    A["出入库 / 修改流水"] --> B{"余额行存在？"}
    B -- "否" --> C["拒绝：余额行缺失（物资建立时同事务建余额行）"]
    B -- "是" --> D["重放后写回余额"]
    D --> E["余额可以为负：出库不校验是否充足"]
    F["直接改余额的写入入口"] --> G["不存在：余额只能由流水重放改变"]
```

```mermaid
stateDiagram-v2
    direction LR
    state "无库存" as S1
    state "低库存" as S2
    state "正常" as S3
    [*] --> S1 : 数量小于等于 0
    [*] --> S2 : 数量大于 0，策略启用且不高于最低库存
    [*] --> S3 : 其余情况（无策略 / 策略停用 / 余额充足）
```

这三个标签是查询时算出来的，不落库；列表筛选与标签用同一套判定。

</TabsContent>

<TabsContent id="t2">

### Excel 导入任务

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 待处理 : 上传文件并登记任务（立即返回任务号）
    待处理 --> 处理中 : 后台协程接手
    处理中 --> 成功 : 处理器返回导入与去重条数
    处理中 --> 失败 : 业务错误记录错误码与消息，未知异常记为内部导入错误
    待处理 --> 失败 : 服务重启
    处理中 --> 失败 : 服务重启并删除临时文件
    成功 --> [*] : 启动时清理 30 天前的终态行
    失败 --> [*] : 同上
    note right of 待处理
        文件过大或后缀不在支持范围内会被拒绝
        同一类型同时只允许一个进行中的任务，重复上传被拒绝：IMPORT_IN_PROGRESS
        失败时记录错误码与消息（消息截断到 1000 字符），服务重启导致的失败错误码为 SERVER_RESTARTED
        进程内按类型串行，单 worker 有效
    end note
```

| `import_type` | 必需表头 | 写入方式 |
| --- | --- | --- |
| `LITE_INVENTORY` | 物资名称、型号规格、单位、数量、备注 | 全量替换（`DELETE` 全表 + 分批 2000 行 `INSERT`，单次 `commit`），无逐行状态 |
| `MATERIAL_CODE_LIBRARY` | 编码、名称、型号、记账单位名称 | 同上 |
| `HUAXING_INVENTORY` | 见导入模板 | 同上 |

解析失败的错误码以类型前缀区分，如 `LITE_IMPORT_HEADERS_MISSING`、`HUAXING_IMPORT_CODE_REQUIRED`、`MATERIAL_CODE_IMPORT_DUPLICATE`。

### Excel 导出任务

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 待处理 : 创建导出（立即返回任务号）
    待处理 --> 处理中 : 后台协程接手
    处理中 --> 成功 : 生成文件并保留 3 天
    处理中 --> 失败 : 业务错误或未知异常，半成品文件立即删除
    待处理 --> 失败 : 服务重启
    成功 --> 已过期 : 3 天后清理任务删除行与文件
    失败 --> [*] : 3 天后清理行
    note right of 待处理
        导出允许并发，不像导入那样串行
        记录结果导出行数超过上限时任务直接失败：EXPORT_RESULT_LIMIT_EXCEEDED
        下载缺失或过期的文件被拒绝：EXPORT_FILE_EXPIRED
        写盘中途崩溃留下的临时文件 24 小时后被清理
    end note
```

```mermaid
flowchart LR
    A["导出"] --> B["异步任务：计划结果、记录结果<br/>生成任务号、轮询进度、按文件号下载"]
    A --> C["同步返回：未编码清单、采购申请表、采购审批表"]
    C --> D["必填字段缺失时导出被拒绝：采购申请表 / 采购审批表字段不足"]
    B --> E["文件保留 3 天，过期或缺失的下载被拒绝"]
    B --> F["任务状态只对创建者与超管可见，文件本身按文件号匿名下载"]
```

### Webhook 投递

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 待投递 : 事件入队（按订阅事件为每个启用渠道建一条）
    待投递 --> 投递中 : worker 每 2 秒认领一条，尝试次数加一
    投递中 --> 成功 : 平台返回成功码
    投递中 --> 待投递 : 失败且未满 5 次，按退避时间重排
    投递中 --> 失败 : 第 5 次失败
    投递中 --> 投递中 : 投递中超过 5 分钟租约后被重新认领
    note right of 待投递
        退避 1 / 5 / 15 / 60 / 180 分钟
        认领时跳过已锁定行，多 worker 不会重复投递
        进程崩溃后由租约超时恢复，无需重启清理
    end note
    note left of 成功
        终态没有重试入口
        渠道配置变更不影响已经入队的投递
    end note
```

渠道配置本身的校验与结果：

```mermaid
flowchart TD
    A["保存渠道配置"] --> B{"启用？"}
    B -- "否" --> OK["允许保存"]
    B -- "是" --> C{"地址已填？"}
    C -- "否" --> N1["拒绝：缺少地址"]
    C -- "是" --> D{"已选订阅事件？"}
    D -- "否" --> N2["拒绝：缺少订阅事件"]
    D -- "是" --> E{"地址是该平台的 https 域名与路径？"}
    E -- "否" --> N3["拒绝：地址不合法"]
    E -- "是" --> F{"密钥密文可解密？"}
    F -- "否" --> N4["读取与投递被拒绝：凭证解密失败"]
    F -- "是" --> OK2["保存并递增版本号"]
    G["推送测试失败"] --> N5["返回上游失败（WEBHOOK_TEST_FAILED），配置不变"]
    H["密钥无法解密"] --> N6["读取与投递被拒绝（WEBHOOK_CREDENTIAL_DECRYPT_FAILED）"]
```

新建渠道时传入的版本号与库中不一致会被拒绝；地址与事件缺失、地址非法分别报缺少地址 / 缺少订阅事件 / 地址不合法。

</TabsContent>

<TabsContent id="t3">

### 小程序用户

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 未绑定 : 静默登录，微信身份尚未建档
    未绑定 --> 未绑定 : 返回注册凭证（10 分钟有效）并要求补档案
    未绑定 --> 待审核 : 提交姓名建档，且新用户默认关闭注册开关
    未绑定 --> 已启用 : 提交姓名建档，且新用户默认开启注册开关
    待审核 --> 已启用 : 管理端启用
    已启用 --> 已停用 : 管理端停用
    已停用 --> 已启用 : 管理端启用
    已启用 --> 已合并 : 身份合并（身份转移到目标用户，源用户删除）
    已启用 --> [*] : 删除
    note right of 待审核
        待审核与已停用的小程序用户访问任何接口都被拒绝，重复建档同样被拒绝：ACCOUNT_DISABLED
        重新静默登录也不会放行；注册开关关闭时新用户无法建档：MINI_PROGRAM_REGISTRATION_DISABLED
    end note
    note left of 已启用
        每次静默登录刷新「最近使用时间」，不递增版本号
        合并到自身被拒绝：MINI_PROGRAM_USER_MERGE_SAME_ACCOUNT
        微信换码失败：WECHAT_AUTH_FAILED / WECHAT_AUTH_UNAVAILABLE
    end note
```

### 小程序功能模式

配置存在系统设置里，超管在高级设置中修改，小程序启动时拉取；拉取失败时小程序用默认值兜底。

| 配置项 | 默认值 | `disabled` | `query_only` | `read_write` |
| --- | --- | --- | --- | --- |
| `inventory_mode`（二级库库存） | `read_write` | 隐藏入口 | 只读 | 可扫码出库 |
| `huaxing_inventory_mode`、`purchase_plans_mode`、`purchase_records_mode`、`material_codes_mode` | `query_only` | 隐藏入口 | 只读 | —（默认只读） |

### 二级库运行模式

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 完整模式 : 未配置时的兜底值
    完整模式 --> 精简模式 : 超管在高级设置保存
    精简模式 --> 完整模式 : 超管在高级设置保存
    note right of 精简模式
        完整模式写接口全部被拒绝：二级库为精简模式
        小程序出库相关入口被拒绝：出库已关闭
        精简库存列表 / 导入 / 最后导入时间仍然可用；完整模式下这些接口仍可访问，只是数据为空
        拒绝码：完整模式写接口为 SECONDARY_WAREHOUSE_LITE_MODE，小程序出库相关为 OUTBOUND_DISABLED
        工作台物资数取精简库存行数，低库存恒为 0
        切换只校验版本号，没有流转校验；前端保存后强制刷新页面
    end note
```

### 物资小程序码

```mermaid
flowchart LR
    A["生成物资小程序码"] --> B{"指定了环境与 AppID？"}
    B -- "缺失或 AppID 未配置" --> N1["拒绝：小程序 App 未配置（MINI_PROGRAM_APP_NOT_CONFIGURED）"]
    B -- "已指定（trial 或 release）" --> C["调用微信接口生成"]
    C -- "微信侧失败" --> N2["返回上游失败（WECHAT_MINI_PROGRAM_CODE_FAILED）"]
```

### 分享链接生命周期

```mermaid
stateDiagram-v2
    direction LR
    [*] --> 生效 : 创建分享（按选项换算到期时间，永久则无到期时间）
    生效 --> 生效 : 修改展示列或到期时间（含改为永久）
    生效 --> 已过期 : 到达到期时间，行仍在库中
    生效 --> [*] : 撤回（行被删除）
    已过期 --> [*] : 每日清理任务删除行
    note right of 生效
        展示列为空表示默认列：该类型的全部列去掉「状态」
        非创建者且非超管不能修改或撤回
        勾选项包含不存在的计划 / 记录会被拒绝
    end note
    note left of 已过期
        读取已过期链接：SHARE_EXPIRED；读取不存在的链接：SHARE_NOT_FOUND
        展示列包含该类型不支持的列会被拒绝；非创建者且非超管的修改或撤回被拒绝
    end note
```

</TabsContent>

</Tabs>

相关页面：[数据模型](/dev-data-model)、[数据流](/dev-flows)、[架构设计](/dev-architecture)。
