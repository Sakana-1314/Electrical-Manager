// Package lifecycle 登记启动清理任务与常驻后台任务（对应原 main.py 的 lifespan）。
//
// 各 service 在 init() 中调用 OnStartup / Worker 登记；main 按登记顺序执行启动任务，
// 再为每个后台任务起一个 goroutine，收到退出信号时取消 ctx 并等待全部结束。
package lifecycle

import (
	"context"
	"log/slog"
	"sort"
	"sync"
)

type startup struct {
	order int
	name  string
	fn    func(ctx context.Context) error
}

type worker struct {
	name    string
	enabled func() bool
	fn      func(ctx context.Context)
}

var (
	mu       sync.Mutex
	startups []startup
	workers  []worker
	closers  []func()
)

// OnStartup 登记启动任务；order 越小越先执行（与原 lifespan 中的顺序一致）。
func OnStartup(order int, name string, fn func(ctx context.Context) error) {
	mu.Lock()
	defer mu.Unlock()
	startups = append(startups, startup{order, name, fn})
}

// Worker 登记常驻后台任务；enabled 为 nil 表示总是启用。fn 需在 ctx 取消后尽快返回。
func Worker(name string, enabled func() bool, fn func(ctx context.Context)) {
	mu.Lock()
	defer mu.Unlock()
	workers = append(workers, worker{name, enabled, fn})
}

// OnShutdown 登记退出时的收尾（如关闭 HTTP 客户端）。
func OnShutdown(fn func()) {
	mu.Lock()
	defer mu.Unlock()
	closers = append(closers, fn)
}

// RunStartup 执行全部启动任务（单个失败只记日志，不阻止启动）。
func RunStartup(ctx context.Context) {
	mu.Lock()
	items := append([]startup{}, startups...)
	mu.Unlock()
	sort.SliceStable(items, func(i, j int) bool { return items[i].order < items[j].order })
	for _, s := range items {
		if err := s.fn(ctx); err != nil {
			slog.Error("startup task failed", "task", s.name, "error", err)
		}
	}
}

// StartWorkers 启动后台任务，返回等待全部退出的函数。
func StartWorkers(ctx context.Context) (wait func()) {
	mu.Lock()
	items := append([]worker{}, workers...)
	mu.Unlock()
	var wg sync.WaitGroup
	for _, w := range items {
		if w.enabled != nil && !w.enabled() {
			continue
		}
		wg.Add(1)
		go func(w worker) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					slog.Error("background worker panicked", "worker", w.name, "panic", r)
				}
			}()
			w.fn(ctx)
		}(w)
	}
	return func() {
		wg.Wait()
		mu.Lock()
		cs := append([]func(){}, closers...)
		mu.Unlock()
		for _, c := range cs {
			c()
		}
	}
}
