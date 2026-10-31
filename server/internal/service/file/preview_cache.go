package file

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

// previewLimiter 限制同时渲染缩略图的数量（APP_PREVIEW_CONCURRENCY，默认 6）。
// 生产环境配置在进程内不变；按配置值重建信号量是为了让测试能在同一进程内改配置。
type previewLimiter struct {
	mu   sync.Mutex
	sem  chan struct{}
	size int
}

var previewSlots previewLimiter

// acquire 占用一个渲染名额，返回释放函数。
func (l *previewLimiter) acquire() func() {
	l.mu.Lock()
	size := config.S.PreviewConcurrency
	if size < 1 {
		size = 1
	}
	if l.sem == nil || l.size != size {
		l.sem = make(chan struct{}, size)
		l.size = size
	}
	sem := l.sem
	l.mu.Unlock()
	sem <- struct{}{}
	return func() { <-sem }
}

// previewCachePath 返回缩略图缓存文件：<cache_dir>/<id 末两位>/<file_id>_<size>.webp。
// 用末两位而不是前缀分片：UUIDv7 前缀是时间戳，同一时期写入的 id 前缀相同。
// 返回空字符串表示未配置缓存目录（退化为每次渲染）。
func previewCachePath(fileID string, size int) string {
	dir := config.S.PreviewCacheDir
	if dir == "" {
		return ""
	}
	shard := fileID
	if len(shard) > 2 {
		shard = shard[len(shard)-2:]
	}
	return filepath.Join(dir, shard, fmt.Sprintf("%s_%d.webp", fileID, size))
}

// RenderPreviewCached 优先读取缩略图缓存；未命中时按 APP_PREVIEW_CONCURRENCY 限流渲染并原子写回缓存。
//
// 缓存键是 (file_id, size)：图片内容按 id 不可变，所以缓存可以长期复用；若源文件被替换
// （mtime 比缓存新）则视为失效重新渲染。缓存读写失败不影响请求，只是退化为每次渲染。
func RenderPreviewCached(fileID, path string, size int) ([]byte, error) {
	src, _ := os.Stat(path)
	cachePath := previewCachePath(fileID, size)
	if data, ok := readPreviewCache(cachePath, src); ok {
		return data, nil
	}
	release := previewSlots.acquire()
	defer release()
	// 拿到名额后重查：同一张图的并发请求可能已经渲染并写入了缓存。
	if data, ok := readPreviewCache(cachePath, src); ok {
		return data, nil
	}
	data, err := RenderPreview(path, size)
	if err != nil {
		return nil, err
	}
	writePreviewCache(cachePath, data)
	return data, nil
}

func readPreviewCache(cachePath string, src os.FileInfo) ([]byte, bool) {
	if cachePath == "" {
		return nil, false
	}
	st, err := os.Stat(cachePath)
	if err != nil || !st.Mode().IsRegular() {
		return nil, false
	}
	if src != nil && st.ModTime().Before(src.ModTime()) {
		return nil, false
	}
	data, err := os.ReadFile(cachePath)
	if err != nil {
		return nil, false
	}
	return data, true
}

// writePreviewCache 先写同目录临时文件再改名，避免读到写了一半的缓存。
func writePreviewCache(cachePath string, data []byte) {
	if cachePath == "" {
		return
	}
	dir := filepath.Dir(cachePath)
	if err := os.MkdirAll(dir, 0o777); err != nil {
		slog.Warn("preview cache dir unavailable", "dir", dir, "error", err)
		return
	}
	tmp, err := os.CreateTemp(dir, ".preview-*")
	if err != nil {
		slog.Warn("preview cache temp file failed", "dir", dir, "error", err)
		return
	}
	name := tmp.Name()
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		os.Remove(name)
		slog.Warn("preview cache write failed", "path", cachePath, "error", err)
		return
	}
	if err := tmp.Close(); err != nil {
		os.Remove(name)
		slog.Warn("preview cache close failed", "path", cachePath, "error", err)
		return
	}
	if err := os.Rename(name, cachePath); err != nil {
		// Windows 上目标已存在时 Rename 会失败；此时另一个请求已写好缓存，忽略即可。
		os.Remove(name)
		slog.Warn("preview cache rename failed", "path", cachePath, "error", err)
	}
}
