package excelexport

import (
	"archive/zip"
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/memprobe"
)

// writeNoisePNG 生成一张难以压缩的 PNG（模拟照片原图）。
func writeNoisePNG(t testing.TB, path string, w, h int, seed int64) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	rng := rand.New(rand.NewSource(seed))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.SetRGBA(x, y, color.RGBA{uint8(rng.Intn(256)), uint8(x), uint8(y), 255})
		}
	}
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := (&png.Encoder{CompressionLevel: png.BestSpeed}).Encode(f, img); err != nil {
		t.Fatal(err)
	}
}

// TestExportMemoryReport 输出带图结果导出的堆峰值（MEMREPORT=1 时运行）。
func TestExportMemoryReport(t *testing.T) {
	if os.Getenv("MEMREPORT") == "" {
		t.Skip("MEMREPORT=1 时运行")
	}
	dir := t.TempDir()
	const images = 200
	var total int64
	paths := make([]string, images)
	for i := range paths {
		paths[i] = filepath.Join(dir, fmt.Sprintf("img%03d.png", i))
		writeNoisePNG(t, paths[i], 800, 600, int64(i))
		st, _ := os.Stat(paths[i])
		total += st.Size()
	}
	rows := make([]map[string]any, images/2)
	for i := range rows {
		rows[i] = map[string]any{"name": fmt.Sprintf("物资%d", i), "images": ImagePaths{paths[2*i], paths[2*i+1]}}
	}
	columns := []Column{{Key: "name", Label: "名称"}, {Key: "images", Label: "图片"}}
	target := filepath.Join(dir, "out.xlsx")
	var err error
	peak, alloc := memprobe.Peak(func() { err = renderResultToFile(target, columns, rows) })
	if err != nil {
		t.Fatal(err)
	}
	st, _ := os.Stat(target)
	t.Logf("export %d images (%.1fMB on disk) → xlsx %.1fMB: peak heap %.1fMB, allocated %.1fMB",
		images, float64(total)/1e6, float64(st.Size())/1e6, float64(peak)/1e6, float64(alloc)/1e6)
}

func renderResultToFile(target string, columns []Column, rows []map[string]any) error {
	return WriteExportFileFrom(target, func(w io.Writer) error {
		_, err := RenderResultExcelTo(w, "申购记录导出", columns, rows)
		return err
	})
}

// 嵌入的图片与磁盘原图逐字节一致；同一路径只存一份；占位图不会残留在产物里。
func TestEmbeddedImagesAreOriginalBytes(t *testing.T) {
	dir := t.TempDir()
	a, b := filepath.Join(dir, "a.png"), filepath.Join(dir, "b.png")
	writeNoisePNG(t, a, 120, 80, 1)
	writeNoisePNG(t, b, 60, 90, 2)
	rows := []map[string]any{
		{"name": "甲", "images": ImagePaths{a, b}},
		{"name": "乙", "images": ImagePaths{a}},
		{"name": "丙", "images": ImagePaths{filepath.Join(dir, "missing.png")}},
	}
	target := filepath.Join(dir, "out.xlsx")
	if err := renderResultToFile(target, []Column{{Key: "name", Label: "名称"}, {Key: "images", Label: "图片"}}, rows); err != nil {
		t.Fatal(err)
	}
	zr, err := zip.OpenReader(target)
	if err != nil {
		t.Fatal(err)
	}
	defer zr.Close()
	want := map[string]bool{}
	for _, p := range []string{a, b} {
		data, _ := os.ReadFile(p)
		want[string(data)] = false
	}
	mediaCount := 0
	for _, zf := range zr.File {
		if !strings.HasPrefix(zf.Name, "xl/media/") {
			continue
		}
		mediaCount++
		rc, _ := zf.Open()
		data, _ := io.ReadAll(rc)
		rc.Close()
		if _, ok := placeholderToken(data); ok {
			t.Fatalf("placeholder leaked into %s", zf.Name)
		}
		if _, ok := want[string(data)]; !ok {
			t.Fatalf("%s is not an original image", zf.Name)
		}
		want[string(data)] = true
	}
	if mediaCount != 2 {
		t.Fatalf("media entries = %d, want 2 (same path stored once)", mediaCount)
	}
	for _, seen := range want {
		if !seen {
			t.Fatal("original image missing from package")
		}
	}
}

// 原图在嵌入后、保存前被删除：写入 1×1 透明图，工作簿仍然完整。
func TestEmbeddedImageDeletedBeforeSave(t *testing.T) {
	dir := t.TempDir()
	a := filepath.Join(dir, "a.png")
	writeNoisePNG(t, a, 40, 40, 3)
	b, err := newBook("测试")
	if err != nil {
		t.Fatal(err)
	}
	if b.embedRowImages(2, 1, ImagePaths{a}) != 1 {
		t.Fatal("image not embedded")
	}
	os.Remove(a)
	var buf bytes.Buffer
	b.saveTo(&buf)
	zr, err := zip.NewReader(bytes.NewReader(buf.Bytes()), int64(buf.Len()))
	if err != nil {
		t.Fatal(err)
	}
	for _, zf := range zr.File {
		if strings.HasPrefix(zf.Name, "xl/media/") {
			rc, _ := zf.Open()
			data, _ := io.ReadAll(rc)
			rc.Close()
			if !bytes.Equal(data, fallbackPNG) {
				t.Fatalf("expected fallback image, got %d bytes", len(data))
			}
			if _, err := png.DecodeConfig(bytes.NewReader(data)); err != nil {
				t.Fatalf("fallback image invalid: %v", err)
			}
			return
		}
	}
	t.Fatal("no media entry")
}
