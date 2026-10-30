# Python → Go 移植约定（给并行移植的代理）

目标：把 `server/app`（FastAPI + SQLAlchemy）1:1 移植为本目录的 Go/Gin 实现，**不改任何业务逻辑**：
路由、状态码、错误码与文案、响应字段与格式、数据库读写效果都必须与 Python 版一致。
验收标准是原 pytest 集成测试通过 HTTP 打 Go 服务时全部通过（见文末「测试」）。

## 目录与归属

```
cmd/server/main.go          入口（勿改）
internal/config  db  web  auth  jtype  domain  apperr  logx  lifecycle  middleware  app   ← 共享基础层（勿改）
internal/model/models_gen.go  表结构体（生成，勿改）
internal/schema/<模块>.go     请求/响应结构体（每个模块一个文件，只改自己的文件）
internal/service/<模块>/      业务逻辑（对应 services/*.py + repositories/*.py）
internal/api/<模块>/routes.go 路由与处理函数（对应 api/v1/*.py），导出 func Register(r *web.Router)
internal/api/api.go           已按原注册顺序调用各模块 Register（勿改）
```

**只修改分配给你的包与 schema 文件**。需要共享层新增能力时，先在自己的包里实现私有辅助函数；
确实无法绕开的，在最终汇报里写明需要什么，不要直接改共享文件。跨模块调用对方 service 包的导出函数即可
（Go 不允许循环导入：service 之间按 Python 的导入方向单向依赖，api 包只被 api.go 导入）。

## 处理函数模板

```go
func Register(r *web.Router) {
    g := r.Group("/hazards", auth.RequireProject)        // APIRouter(dependencies=[Depends(require_current_project)])
    g.GET("", listHazards, auth.CurrentUser)               // 依赖按 Python 函数签名里出现的顺序列出
    g.PATCH("/{item_id}", updateHazard, auth.HazardWriter)
}

func updateHazard(c *web.Ctx) error {
    p := c.Params()                       // 依赖已执行完；以下参数错误合并成一次 422
    id := p.PathInt("item_id")
    ifMatch := p.IfMatch()                // IfMatchVersion
    var body schema.HazardUpdate          // 先填 Python 模型里的默认值
    p.Body(&body)
    if err := p.Err(); err != nil { return err }
    item, err := hazard.Update(c.DB, id, body, ifMatch, auth.User(c))
    if err != nil { return err }
    return c.OK(item)                     // c.Created / c.NoContent / c.File / c.Bytes / c.Redirect
}
```

- 依赖顺序 = FastAPI 解析顺序：路由分组依赖（如 `RequireProject`）→ 函数签名里的依赖（`CurrentUser`、
  `SuperAdmin`、`WarehouseWriter`、`RequireFullSecondaryWarehouse` 等，按出现顺序）→ 然后才校验
  路径/查询/请求头/请求体（全部错误合并为 422 VALIDATION_ERROR）。依赖报错立即返回。
- `auth.CurrentUser` / `auth.Roles(...)`/ `auth.SuperAdmin` 等见 `internal/auth`；`auth.User(c)` 取用户，
  小程序用 `auth.MiniProgramUser` + `auth.MiniUser(c)`。`auth.SystemScope` 让整个请求跨项目。
- 处理函数返回后框架先提交事务再写响应；返回 error 则回滚。**不要**在处理函数里手动 Commit
  （后台任务/独立会话除外）。FastAPI `BackgroundTasks` / 提交后才做的事用 `c.DB.AfterCommit(func(){...})`。
- 查询参数：`p.Page()`（page/page_size 默认 1/20、上限 200）、`p.QueryStr(name, "max=128")`（未传为 nil，
  注意查询参数**不去空白**）、`p.QueryInt/QueryIntPtr/QueryBool/QueryDate/QueryStrList/QueryIntList`、
  `p.QueryStrDefault`。Literal/枚举查询参数用 tag `oneof=asc|desc`。
- 文件上传：`c.FormFile("file")`（gin），表单字段校验错误用 `p.Add(web.FieldError{...})`。

## 请求体（Pydantic RequestModel 语义）

`p.Body(&dst)` 已实现：未知字段 → 422 extra_forbidden；所有字符串去首尾空白；缺字段保持预填默认值；
`v` 标签约束：`required`（无默认值的字段）、`min/max`（字符串按字符数、列表按长度）、`gt/ge/lt/le`、
`digits=18,places=1`（Decimal max_digits/decimal_places）、`oneof=A|B`（枚举/Literal，写**值**）、
`blanknil`（`_empty_string_to_none` 前置校验）、`unique`（列表去重校验，重复时报
"<字段> contains duplicates"：写 `unique=image_ids`）、`itemmin/itemmax/itempattern/itemoneof`（列表元素）、
`pattern=uuid7|uuid4|<正则>`（必须是最后一个规则）。
- `T | None = None` → `*T`；需要区分「省略」和「显式 null」（Python 用 `model_fields_set`/`exclude_unset`）→ `web.Opt[T]`。
- 嵌套模型 / 列表元素是结构体时同样递归校验；`@field_validator` / `@model_validator(mode="after")` 实现
  `Validate(loc []any) []web.FieldError`（只在该结构体字段全部合法后调用），用 `web.ValueError(loc, msg, input)`。
- Decimal 用 `jtype.Decimal`，date 用 `jtype.Date`，datetime 用 `jtype.UTCTime`（若 Python 要求带时区，
  自行在 Validate 中检查：用 `json.RawMessage` 或字符串字段先接再解析）。

## 响应序列化（必须逐字段一致）

- 字段顺序照抄 Pydantic 模型；`str | None = None` 输出 `null`（Go 用指针，**不要** omitempty）。
- `Decimal` → `jtype.Decimal`（输出规范化字符串 `"10"`、`"0.5"`）。
- `UtcDateTime` → `jtype.UTCTime`（`2026-01-02T03:04:05.123456+00:00`，微秒为 0 时省略）；
  未标注的 `datetime` → `jtype.NaiveTime`（无时区）；`date` → `jtype.Date`。数据库读出的 `time.Time` 是 naive UTC。
- 枚举字段输出**值**。数据库里 SAEnum 存的是**名称**：名称≠值的枚举（隐患状态/等级、申购计划状态、
  分享类型、Webhook 事件、工作任务状态）读写时用 `domain.X.ToDB(value)` / `domain.X.FromDB(name)`，
  原生 SQL 过滤条件里也写名称。
- 列表为空输出 `[]` 而不是 `null`（初始化切片）。分页用 `schema.NewPage(items, page, size, total)`。
- 只在 Python 返回裸 dict 时才用 `map[string]any`；dict 键顺序不影响测试，但尽量照抄。

## 数据库

- `c.DB`（`*db.Session`）：`Get/Find/Select/Exec/Insert/Query/SelectIn/ExecIn`。第一条语句时自动开事务。
- **项目隔离**：项目域表（`model.ProjectScopedTables`）的每条 SQL 都必须显式带 `project_id = ?`
  （`pid, err := s.ProjectID()`，未设定时返回 PROJECT_REQUIRED，与 Python fail-closed 一致），
  INSERT 时写入当前 `project_id`。`common.Where{}.Scope(s, "t.")` 可自动加条件（系统上下文不加）。
  Python 里 `system_scope()` 的地方用 `s.System()`（共享事务的跨项目副本）或 `db.SystemSession(ctx)`；
  `project_scope(pid)` / `project_session(pid)` 用 `s.WithProject(pid)` / `db.ProjectSession(ctx, pid)`。
- 全局表（user、project、mini_program_user、mini_program_identity、system_setting、file_object、memo、
  webhook_channel、webhook_delivery、business_event_log）不加 project_id。
- **AuditMixin**：ORM 的 `onupdate=_utcnow` 意味着每次 UPDATE 都要写 `updated_at = common.UTCNow()`；
  `version += 1` 的地方照做。INSERT 时 `created_at/updated_at = common.UTCNow()`、`version = 1`，
  以及 Python 模型里的 `default=`（如 uuid4、identity_hash、状态默认值）。
- SQLAlchemy `IntegrityError` 被 service 捕获转业务错误的地方，用 `db.IsIntegrity(err)` / `db.IsDuplicate(err)`；
  未捕获的会由框架统一转 409 DATA_CONFLICT。`with_for_update()` → `SELECT ... FOR UPDATE`。
- `col.contains(term, autoescape=True)` / `contains_any` → `common.ContainsAny(cols, value)`（`LIKE ? ESCAPE '/'`）。
  `col.like(f"%{kw}%")`（不转义）照写。MySQL 排序规则 utf8mb4_0900_ai_ci（大小写不敏感）与线上一致。
- selectin 关系（图片、余额等）用批量 `IN (?)` 查询加载，避免 N+1；保持与 Python 相同的排序（如 `sort_order`）。
- 后台任务（导入/导出/清理/Webhook）使用 `context.Background()` 派生的独立会话，自己 `Commit()`，按行记录的
  `project_id` 恢复项目上下文。启动清理与常驻任务用 `lifecycle.OnStartup(order, name, fn)` /
  `lifecycle.Worker(name, enabledFn, fn)` 在包的 `init()` 中登记（order 参照原 main.py lifespan 顺序：
  10 导入任务标记失败、11 清理导入任务、20 导出任务标记失败、21 清理导出、30 分享过期清理）。

## 错误

`apperr.New(code, msg).WithStatus(n).WithDetails(apperr.D{...})`、`apperr.NotFound("物资")`、
`apperr.ValidateVersion(expected *int64, actual)`、`apperr.ProjectRequired()`。文案逐字照抄。

## 配置与外部调用

`config.S`（上传目录 `UploadDir`、模板目录 `TemplateDir`、`MaxImageBytes`、微信配置等）。
外部 HTTP（AI 搜索、Webhook、微信）用标准库 `net/http`，超时与 Python 一致。

## 测试（验收）

```bash
PYTHON=<含后端依赖的 python> tools/run_contract_tests.sh tests/integration/test_xxx.py [-x -k ...]
```

脚本会：重建 MySQL 库（init.sql）→ 编译并启动 Go 服务 → 设置 `GO_SERVER_URL` 跑 pytest（conftest 每个用例清表并写种子数据，
测试里直接用 ORM 读写同一个 MySQL）。每个代理用不同的 `DB_NAME`、`PORT`、`WORK_DIR`，避免互相干扰：
`DB_NAME=em_go_<模块> PORT=<唯一端口> WORK_DIR=<自己的临时目录>`。

少数用例通过 monkeypatch 改 Python 进程内部（替换 httpx 客户端、伪造微信接口、直接调用 Python 后台函数等），
对独立运行的 Go 服务无效。处理办法（按优先级）：
1. 外部 HTTP：Go 侧读环境变量覆盖目标地址（如 `APP_WECHAT_API_BASE`），用例改为对本地桩服务断言——如需改 conftest/用例，
   只在 `if GO_SERVER_URL:` 分支里加，不改变 Python 原有行为；
2. 直接调用 Python 内部函数的（如手动触发一次后台投递）：在 Go 里加仅 `APP_TEST_HOOKS=1` 时注册的测试钩子路由
   `POST /__test__/<name>`，并在用例的 GO 分支里改为调用该钩子；
3. 纯 Python 实现细节的单元测试（tests/ 根目录、tests/unit）不需要通过，改为在 Go 包里写等价的 `_test.go`。
最终汇报里列出：通过/失败的用例、你做过的用例改动、仍需协调的问题。

## 性能

- 不做 N+1：列表接口一次查询主表 + 每个关系一次 `IN` 查询。
- 计数与分页分两条 SQL（`COUNT(*)` + `LIMIT/OFFSET`），与 Python `paginate` 一致。
- 避免在请求路径上做不必要的 SELECT（Python 里 flush 后的 refresh 在 Go 里直接用已知值）。
