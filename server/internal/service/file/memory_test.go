package file

import (
	"math/rand"
	"os"
	"path/filepath"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/memprobe"
)

// writePhotoPNG 生成一张接近照片的 PNG（平滑渐变 + 噪声），用与上传相同的编码器写盘。
func writePhotoPNG(t testing.TB, dir string, w, h int, alpha bool, seed int64) string {
	t.Helper()
	img := &decodedImage{raster: newRaster(w, h, alpha)}
	rng := rand.New(rand.NewSource(seed))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			i := (y*w + x) * 4
			n := byte(rng.Intn(24))
			img.pix[i] = byte(x*255/w) + n
			img.pix[i+1] = byte(y*255/h) + n
			img.pix[i+2] = byte((x+y)*255/(w+h)) + n
			img.pix[i+3] = 255
			if alpha {
				img.pix[i+3] = byte(64 + (x*191)/w)
			}
		}
	}
	data, err := encodePNG(img)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "big.png")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

// TestPreviewMemoryReport 输出大图缩略图的堆峰值（MEMREPORT=1 时运行）。
func TestPreviewMemoryReport(t *testing.T) {
	if os.Getenv("MEMREPORT") == "" {
		t.Skip("MEMREPORT=1 时运行")
	}
	for _, alpha := range []bool{false, true} {
		path := writePhotoPNG(t, t.TempDir(), 4000, 3000, alpha, 1)
		st, _ := os.Stat(path)
		var err error
		peak, alloc := memprobe.Peak(func() { _, err = RenderPreview(path, 320) })
		if err != nil {
			t.Fatal(err)
		}
		t.Logf("preview 4000x3000 alpha=%v file=%.1fMB: peak heap %.1fMB, allocated %.1fMB", alpha, float64(st.Size())/1e6, float64(peak)/1e6, float64(alloc)/1e6)
	}
}
