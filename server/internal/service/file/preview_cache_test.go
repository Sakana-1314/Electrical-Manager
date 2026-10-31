package file

import (
	"bytes"
	"image/color"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

const previewTestFileID = "019fb1a2-feec-7bd5-acf3-2c38b93f6b6f"

func withPreviewConfig(t *testing.T, cacheDir string, concurrency int) {
	t.Helper()
	prev := *config.S
	t.Cleanup(func() { *config.S = prev })
	config.S.PreviewCacheDir = cacheDir
	config.S.PreviewConcurrency = concurrency
}

// writeTestPNG 写一张 w×h 的纯色 PNG 到 dir，返回路径。
func writeTestPNG(t *testing.T, dir string, w, h int) string {
	t.Helper()
	data, _, _, err := ReencodePNG(pngOf(t, uniform(w, h, color.NRGBA{0, 128, 255, 255})))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "x.png")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestRenderPreviewCachedReusesCache(t *testing.T) {
	cacheDir := t.TempDir()
	withPreviewConfig(t, cacheDir, 2)
	dir := t.TempDir()
	path := writeTestPNG(t, dir, 64, 48)

	out, err := RenderPreviewCached(previewTestFileID, path, 16)
	if err != nil {
		t.Fatal(err)
	}
	cachePath := previewCachePath(previewTestFileID, 16)
	if _, err := os.Stat(cachePath); err != nil {
		t.Fatalf("缓存文件未写入: %v", err)
	}
	// 源文件消失后仍返回内容，说明这次走的是缓存而不是重新渲染。
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	again, err := RenderPreviewCached(previewTestFileID, path, 16)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out, again) {
		t.Fatal("缓存内容与首次渲染不一致")
	}
}

func TestRenderPreviewCachedInvalidatesWhenSourceNewer(t *testing.T) {
	cacheDir := t.TempDir()
	withPreviewConfig(t, cacheDir, 2)
	dir := t.TempDir()
	path := writeTestPNG(t, dir, 64, 48)

	out, err := RenderPreviewCached(previewTestFileID, path, 16)
	if err != nil {
		t.Fatal(err)
	}
	img, err := decodeImage(out)
	if err != nil {
		t.Fatal(err)
	}
	if img.w != 16 || img.h != 12 {
		t.Fatalf("首次预览尺寸 %dx%d", img.w, img.h)
	}

	// 缓存置为过去时间，源图换成 80×40 并刷新 mtime：应判定失效并重新渲染。
	cachePath := previewCachePath(previewTestFileID, 16)
	old := time.Now().Add(-time.Hour)
	if err := os.Chtimes(cachePath, old, old); err != nil {
		t.Fatal(err)
	}
	path = writeTestPNG(t, dir, 80, 40)
	now := time.Now()
	if err := os.Chtimes(path, now, now); err != nil {
		t.Fatal(err)
	}
	out, err = RenderPreviewCached(previewTestFileID, path, 16)
	if err != nil {
		t.Fatal(err)
	}
	img, err = decodeImage(out)
	if err != nil {
		t.Fatal(err)
	}
	if img.w != 16 || img.h != 8 {
		t.Fatalf("失效后预览尺寸 %dx%d, want 16x8", img.w, img.h)
	}
}

func TestRenderPreviewCachedWithoutCacheDir(t *testing.T) {
	withPreviewConfig(t, "", 2)
	dir := t.TempDir()
	path := writeTestPNG(t, dir, 64, 48)
	out, err := RenderPreviewCached(previewTestFileID, path, 16)
	if err != nil {
		t.Fatal(err)
	}
	img, err := decodeImage(out)
	if err != nil {
		t.Fatal(err)
	}
	if img.w != 16 || img.h != 12 {
		t.Fatalf("预览尺寸 %dx%d", img.w, img.h)
	}
}

func TestPreviewLimiterCapsConcurrency(t *testing.T) {
	withPreviewConfig(t, "", 2)
	release1 := previewSlots.acquire()
	release2 := previewSlots.acquire()
	acquired := make(chan struct{})
	go func() {
		release := previewSlots.acquire()
		close(acquired)
		release()
	}()
	select {
	case <-acquired:
		t.Fatal("并发名额超过 APP_PREVIEW_CONCURRENCY")
	case <-time.After(50 * time.Millisecond):
	}
	release1()
	select {
	case <-acquired:
	case <-time.After(time.Second):
		t.Fatal("释放名额后等待的请求仍未获得名额")
	}
	release2()
}
