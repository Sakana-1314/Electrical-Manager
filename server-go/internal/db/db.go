// Package db 封装数据库连接、请求级事务会话、项目隔离上下文与语句耗时统计。
//
// 对应原 Python 版的 core/database.py + core/project_scope.py + core/db_timing.py：
//
//   - Session 是「请求级工作单元」：第一条语句时惰性开启事务，处理成功后在写响应**之前**提交
//     （与原 CommitBeforeResponseMiddleware 语义一致：返回 2xx 时写库已可见），失败则回滚。
//   - 项目隔离由 Session 携带的项目上下文表达：业务 SQL 显式带 `project_id = ?`，
//     取项目 id 用 ProjectID()；未设定项目且不在系统上下文时返回 PROJECT_REQUIRED（fail-closed）。
//   - 每条语句的服务端耗时累计进请求的 Timing，用于 X-DB-Time / X-DB-Queries 响应头。
package db

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

// DB 是进程级连接池。
var DB *sqlx.DB

func Open(dsn string) (*sqlx.DB, error) {
	if !strings.Contains(dsn, "interpolateParams=") {
		if strings.Contains(dsn, "?") {
			dsn += "&interpolateParams=true"
		} else {
			dsn += "?interpolateParams=true"
		}
	}
	conn, err := sqlx.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(50)
	conn.SetMaxIdleConns(20)
	conn.SetConnMaxLifetime(30 * time.Minute)
	conn.SetConnMaxIdleTime(5 * time.Minute)
	DB = conn
	return conn, nil
}

// Timing 是单次请求内数据库语句的累计耗时与条数（并发安全）。
type Timing struct {
	nanos atomic.Int64
	count atomic.Int64
}

func (t *Timing) add(d time.Duration) {
	t.nanos.Add(int64(d))
	t.count.Add(1)
}

func (t *Timing) TotalMS() float64 { return float64(t.nanos.Load()) / 1e6 }
func (t *Timing) Count() int64     { return t.count.Load() }

type timingKey struct{}

func WithTiming(ctx context.Context, t *Timing) context.Context {
	return context.WithValue(ctx, timingKey{}, t)
}

func timingFrom(ctx context.Context) *Timing {
	t, _ := ctx.Value(timingKey{}).(*Timing)
	return t
}

// core 是同一事务共享的状态；Session 的项目 / 系统上下文副本共用同一个 core。
type core struct {
	mu     sync.Mutex
	ctx    context.Context
	pool   *sqlx.DB
	tx     *sqlx.Tx
	timing *Timing
	// afterCommit 在事务提交成功后执行（如：提交成功才回收的磁盘文件、后台任务投递）。
	afterCommit   []func()
	afterRollback []func()
}

// Session 是一个工作单元：惰性事务 + 项目上下文。
type Session struct {
	c       *core
	project int64
	system  bool
}

// NewSession 新建会话（请求处理或后台任务各自一个）。
func NewSession(ctx context.Context) *Session {
	return &Session{c: &core{ctx: ctx, pool: DB, timing: timingFrom(ctx)}}
}

// ProjectSession 指定项目上下文的自开会话（后台任务按行上记录的项目恢复上下文）。
func ProjectSession(ctx context.Context, projectID int64) *Session {
	s := NewSession(ctx)
	s.project = projectID
	return s
}

// SystemSession 跨项目（系统级）上下文的自开会话：清理任务、附件引用统计、匿名下载等。
func SystemSession(ctx context.Context) *Session {
	s := NewSession(ctx)
	s.system = true
	return s
}

func (s *Session) Ctx() context.Context { return s.c.ctx }

// SetProject 设定当前项目（就地修改，供请求依赖使用）。
func (s *Session) SetProject(projectID int64) {
	s.project = projectID
	s.system = false
}

// WithProject 返回共享同一事务、但处于指定项目上下文的会话副本（project_scope）。
func (s *Session) WithProject(projectID int64) *Session {
	return &Session{c: s.c, project: projectID}
}

// System 返回共享同一事务、处于系统（跨项目）上下文的会话副本（system_scope）。
func (s *Session) System() *Session {
	return &Session{c: s.c, project: s.project, system: true}
}

// SetSystem 把会话就地切到系统上下文（整个请求都跨项目，如附件管理接口）。
func (s *Session) SetSystem() { s.system = true }

func (s *Session) IsSystem() bool { return s.system }

// ProjectID 当前项目 id；未设定（且不在系统上下文）时返回 PROJECT_REQUIRED。
// 系统上下文中若设定过项目也会返回它，否则同样报 PROJECT_REQUIRED。
func (s *Session) ProjectID() (int64, error) {
	if s.project <= 0 {
		return 0, apperr.ProjectRequired()
	}
	return s.project, nil
}

// ProjectIDOrZero 返回当前项目 id，未设定时为 0。
func (s *Session) ProjectIDOrZero() int64 { return s.project }

// ScopeFilter 生成项目过滤条件片段：系统上下文返回 ("1=1", nil)；否则返回
// ("<alias>project_id = ?", [pid])。alias 形如 "t." 或 ""。
func (s *Session) ScopeFilter(alias string) (string, []any, error) {
	if s.system {
		return "1=1", nil, nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return "", nil, err
	}
	return alias + "project_id = ?", []any{pid}, nil
}

func (s *Session) ext() (sqlx.ExtContext, error) {
	s.c.mu.Lock()
	defer s.c.mu.Unlock()
	if s.c.tx != nil {
		return s.c.tx, nil
	}
	tx, err := s.c.pool.BeginTxx(s.c.ctx, nil)
	if err != nil {
		return nil, err
	}
	s.c.tx = tx
	return tx, nil
}

func (s *Session) track(start time.Time) {
	if s.c.timing != nil {
		s.c.timing.add(time.Since(start))
	}
}

// Get 查询单行到 dest；无结果返回 sql.ErrNoRows。
func (s *Session) Get(dest any, query string, args ...any) error {
	e, err := s.ext()
	if err != nil {
		return err
	}
	defer s.track(time.Now())
	return sqlx.GetContext(s.c.ctx, e, dest, query, args...)
}

// Find 查询单行；无结果时返回 (false, nil)。
func (s *Session) Find(dest any, query string, args ...any) (bool, error) {
	err := s.Get(dest, query, args...)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	return err == nil, err
}

// Select 查询多行到切片。
func (s *Session) Select(dest any, query string, args ...any) error {
	e, err := s.ext()
	if err != nil {
		return err
	}
	defer s.track(time.Now())
	return sqlx.SelectContext(s.c.ctx, e, dest, query, args...)
}

// Exec 执行写语句。
func (s *Session) Exec(query string, args ...any) (sql.Result, error) {
	e, err := s.ext()
	if err != nil {
		return nil, err
	}
	defer s.track(time.Now())
	return e.ExecContext(s.c.ctx, query, args...)
}

// Insert 执行 INSERT 并返回自增 id。
func (s *Session) Insert(query string, args ...any) (int64, error) {
	res, err := s.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// Query 返回原始行游标（调用方负责 Close）。
func (s *Session) Query(query string, args ...any) (*sqlx.Rows, error) {
	e, err := s.ext()
	if err != nil {
		return nil, err
	}
	defer s.track(time.Now())
	return e.QueryxContext(s.c.ctx, query, args...)
}

// Scalar 查询单个值（COUNT 等）。
func (s *Session) Scalar(dest any, query string, args ...any) error {
	return s.Get(dest, query, args...)
}

// In 展开 IN (?) 参数后执行 Select。
func (s *Session) SelectIn(dest any, query string, args ...any) error {
	q, a, err := sqlx.In(query, args...)
	if err != nil {
		return err
	}
	return s.Select(dest, q, a...)
}

// ExecIn 展开 IN (?) 参数后执行写语句。
func (s *Session) ExecIn(query string, args ...any) (sql.Result, error) {
	q, a, err := sqlx.In(query, args...)
	if err != nil {
		return nil, err
	}
	return s.Exec(q, a...)
}

// AfterCommit 登记事务提交成功后的回调（未开启事务时提交也会触发）。
func (s *Session) AfterCommit(fn func()) {
	s.c.mu.Lock()
	s.c.afterCommit = append(s.c.afterCommit, fn)
	s.c.mu.Unlock()
}

// AfterRollback 登记回滚后的回调（如：回收本次已写入磁盘、但记录未落库的文件）。
func (s *Session) AfterRollback(fn func()) {
	s.c.mu.Lock()
	s.c.afterRollback = append(s.c.afterRollback, fn)
	s.c.mu.Unlock()
}

// Commit 提交事务（未开启事务时只执行 afterCommit 回调）。提交后会话可继续使用（会开启新事务）。
func (s *Session) Commit() error {
	s.c.mu.Lock()
	tx := s.c.tx
	s.c.tx = nil
	callbacks := s.c.afterCommit
	s.c.afterCommit = nil
	s.c.afterRollback = nil
	s.c.mu.Unlock()
	if tx != nil {
		start := time.Now()
		err := tx.Commit()
		s.track(start)
		if err != nil {
			return err
		}
	}
	for _, fn := range callbacks {
		fn()
	}
	return nil
}

// Rollback 回滚事务（幂等）。
func (s *Session) Rollback() {
	s.c.mu.Lock()
	tx := s.c.tx
	s.c.tx = nil
	callbacks := s.c.afterRollback
	s.c.afterCommit = nil
	s.c.afterRollback = nil
	s.c.mu.Unlock()
	if tx != nil {
		_ = tx.Rollback()
	}
	for _, fn := range callbacks {
		fn()
	}
}

// Close 结束会话：未提交的事务回滚。
func (s *Session) Close() { s.Rollback() }

// ---- MySQL 错误分类 ----

func mysqlErrNo(err error) uint16 {
	var me *mysql.MySQLError
	if errors.As(err, &me) {
		return me.Number
	}
	return 0
}

// IsDuplicate 唯一键冲突（1062）。
func IsDuplicate(err error) bool { return mysqlErrNo(err) == 1062 }

// IsIntegrity 完整性约束错误（唯一键 / 外键 / 非空 / CHECK），对应 SQLAlchemy IntegrityError。
func IsIntegrity(err error) bool {
	switch mysqlErrNo(err) {
	case 1062, 1451, 1452, 1048, 1216, 1217, 3819, 1364, 1586, 1557, 1022:
		return true
	}
	return false
}

// IsForeignKey 外键约束错误。
func IsForeignKey(err error) bool {
	switch mysqlErrNo(err) {
	case 1451, 1452, 1216, 1217:
		return true
	}
	return false
}

// IsQueryError SQL 本身有误（未知列 / 语法错误 / 表不存在等）。
func IsQueryError(err error) bool {
	switch mysqlErrNo(err) {
	case 1052, 1054, 1064, 1066, 1109, 1146:
		return true
	}
	return false
}

// IsMySQLError 是否为服务端返回的 MySQL 错误。
func IsMySQLError(err error) bool { return mysqlErrNo(err) != 0 }
