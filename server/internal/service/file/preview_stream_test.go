package file

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
)

// encodeRawPNG 写一张 8 位非隔行 PNG：每行随机选择 0–4 号滤波器（覆盖全部还原分支），IDAT 拆成多块。
func encodeRawPNG(t testing.TB, w, h int, colorType byte, samples, palette []byte, rng *rand.Rand) []byte {
	t.Helper()
	bpp := map[byte]int{0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType]
	stride := w * bpp
	var filtered bytes.Buffer
	prev := make([]byte, stride)
	for y := 0; y < h; y++ {
		cur := samples[y*stride : (y+1)*stride]
		ft := byte(rng.Intn(5))
		filtered.WriteByte(ft)
		for i := 0; i < stride; i++ {
			var a, b, c int
			if i >= bpp {
				a, c = int(cur[i-bpp]), int(prev[i-bpp])
			}
			b = int(prev[i])
			var pred int
			switch ft {
			case 1:
				pred = a
			case 2:
				pred = b
			case 3:
				pred = (a + b) / 2
			case 4:
				pa, pb, pc := abs(b-c), abs(a-c), abs(a+b-2*c)
				switch {
				case pa <= pb && pa <= pc:
					pred = a
				case pb <= pc:
					pred = b
				default:
					pred = c
				}
			}
			filtered.WriteByte(cur[i] - byte(pred))
		}
		prev = cur
	}
	var z bytes.Buffer
	zw := zlib.NewWriter(&z)
	zw.Write(filtered.Bytes())
	zw.Close()
	var out bytes.Buffer
	out.WriteString("\x89PNG\r\n\x1a\n")
	chunk := func(typ string, data []byte) {
		var hdr [8]byte
		binary.BigEndian.PutUint32(hdr[:4], uint32(len(data)))
		copy(hdr[4:], typ)
		out.Write(hdr[:])
		out.Write(data)
		crc := crc32.NewIEEE()
		crc.Write(hdr[4:])
		crc.Write(data)
		binary.Write(&out, binary.BigEndian, crc.Sum32())
	}
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], uint32(w))
	binary.BigEndian.PutUint32(ihdr[4:], uint32(h))
	ihdr[8], ihdr[9] = 8, colorType
	chunk("IHDR", ihdr)
	chunk("tEXt", []byte("Comment\x00stream test"))
	if colorType == 3 {
		chunk("PLTE", palette)
	}
	data := z.Bytes()
	for len(data) > 0 { // 多个 IDAT 块
		n := min(len(data), 1+rng.Intn(4096))
		chunk("IDAT", data[:n])
		data = data[n:]
	}
	chunk("IEND", nil)
	return out.Bytes()
}

func randomSamples(w, h int, colorType byte, rng *rand.Rand) ([]byte, []byte) {
	bpp := map[byte]int{0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType]
	samples := make([]byte, w*h*bpp)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			for c := 0; c < bpp; c++ {
				// 渐变 + 噪声，alpha 通道覆盖 0 与 255 两个端点
				v := (x*(c+1)*7 + y*(c+3)*5 + rng.Intn(40)) & 0xff
				if (colorType == 6 && c == 3) || (colorType == 4 && c == 1) {
					v = []int{0, 255, v, v / 3}[rng.Intn(4)]
				}
				samples[(y*w+x)*bpp+c] = byte(v)
			}
		}
	}
	var palette []byte
	if colorType == 3 {
		n := 1 + rng.Intn(256)
		palette = make([]byte, n*3)
		rng.Read(palette)
		for i := range samples {
			samples[i] = byte(rng.Intn(n + 2)) // 少量越界索引
		}
	}
	return samples, palette
}

// 流式缩略图与整图路径（decodeImage + thumbnail）逐像素一致。
func TestStreamThumbnailMatchesFullDecode(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	dir := t.TempDir()
	type tc struct{ w, h int }
	dims := []tc{{2000, 1500}, {1501, 997}, {3000, 20}, {20, 3000}, {640, 480}, {257, 1023}, {33, 17}, {1, 900}, {900, 1}}
	for i := 0; i < 30; i++ {
		dims = append(dims, tc{1 + rng.Intn(1200), 1 + rng.Intn(1200)})
	}
	sizes := []int{16, 64, 100, 160, 256, 320, 480, 640, 1024}
	streamed := 0
	for i, d := range dims {
		for _, ct := range []byte{0, 2, 3, 4, 6} {
			samples, palette := randomSamples(d.w, d.h, ct, rng)
			raw := encodeRawPNG(t, d.w, d.h, ct, samples, palette, rng)
			path := filepath.Join(dir, fmt.Sprintf("%d_%d.png", i, ct))
			if err := os.WriteFile(path, raw, 0o644); err != nil {
				t.Fatal(err)
			}
			full, err := decodeImage(raw)
			if err != nil {
				t.Fatalf("%v type %d: decode: %v", d, ct, err)
			}
			for _, size := range sizes {
				got, ok, err := streamThumbnail(path, size)
				if !ok {
					continue
				}
				if err != nil {
					t.Fatalf("%v type %d size %d: %v", d, ct, size, err)
				}
				want := thumbnail(full.raster, size)
				if got.w != want.w || got.h != want.h || got.alpha != want.alpha || !bytes.Equal(got.pix, want.pix) {
					t.Fatalf("%v type %d size %d: stream %dx%d alpha=%v differs from full %dx%d alpha=%v",
						d, ct, size, got.w, got.h, got.alpha, want.w, want.h, want.alpha)
				}
				streamed++
			}
		}
	}
	if streamed < 500 {
		t.Fatalf("stream path exercised only %d times", streamed)
	}
}

// 不适用流式的文件交给整图路径；损坏的扫描线报错而不是返回错误图片。
func TestStreamThumbnailFallbacksAndErrors(t *testing.T) {
	dir := t.TempDir()
	rng := rand.New(rand.NewSource(7))
	small, _ := randomSamples(20, 20, 2, rng)
	smallPath := filepath.Join(dir, "small.png")
	os.WriteFile(smallPath, encodeRawPNG(t, 20, 20, 2, small, nil, rng), 0o644)
	if _, ok, _ := streamThumbnail(smallPath, 64); ok {
		t.Fatal("image smaller than size should fall back")
	}
	jpegLike := filepath.Join(dir, "x.jpg")
	os.WriteFile(jpegLike, []byte("\xff\xd8\xff\xe0not png"), 0o644)
	if _, ok, _ := streamThumbnail(jpegLike, 64); ok {
		t.Fatal("non-PNG should fall back")
	}
	big, _ := randomSamples(300, 200, 2, rng)
	raw := encodeRawPNG(t, 300, 200, 2, big, nil, rng)
	truncated := filepath.Join(dir, "truncated.png")
	os.WriteFile(truncated, raw[:len(raw)/3], 0o644)
	if _, ok, err := streamThumbnail(truncated, 64); !ok || err == nil {
		t.Fatalf("truncated PNG: ok=%v err=%v, want error", ok, err)
	}
	if _, err := RenderPreview(truncated, 64); err == nil {
		t.Fatal("RenderPreview should reject truncated PNG")
	}
}
