// Package memprobe 在测试 / 基准中测量一段代码执行期间的堆内存峰值（采样 runtime.MemStats）。
package memprobe

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"
)

// Peak 执行 fn，返回执行期间相对起始值的堆峰值增量（字节）与累计分配量（字节）。
// 采样间隔 200µs；fn 前后各强制一次 GC，使起点与终点可比。
func Peak(fn func()) (peak uint64, allocated uint64) {
	runtime.GC()
	var start runtime.MemStats
	runtime.ReadMemStats(&start)
	var maxHeap atomic.Uint64
	maxHeap.Store(start.HeapAlloc)
	stop := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		t := time.NewTicker(200 * time.Microsecond)
		defer t.Stop()
		var ms runtime.MemStats
		for {
			select {
			case <-stop:
				return
			case <-t.C:
				runtime.ReadMemStats(&ms)
				if ms.HeapAlloc > maxHeap.Load() {
					maxHeap.Store(ms.HeapAlloc)
				}
			}
		}
	}()
	fn()
	var end runtime.MemStats
	runtime.ReadMemStats(&end)
	close(stop)
	wg.Wait()
	if end.HeapAlloc > maxHeap.Load() {
		maxHeap.Store(end.HeapAlloc)
	}
	return maxHeap.Load() - start.HeapAlloc, end.TotalAlloc - start.TotalAlloc
}
