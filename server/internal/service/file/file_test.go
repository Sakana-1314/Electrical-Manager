package file

import (
	"bytes"
	"compress/zlib"
	"context"
	"crypto/sha256"
	"database/sql"
	"database/sql/driver"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/jmoiron/sqlx"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// ---------------- 源文件指纹（对应 tests/test_file_service.py） ----------------

func noisyBytes(size int) []byte {
	out := make([]byte, size)
	for i := range out {
		out[i] = byte((i*31 + 7) % 256)
	}
	return out
}

func hexSum(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

func TestSourceFingerprintSkipsFilesAtOrBelowThreshold(t *testing.T) {
	for _, size := range []int{0, 1, 1024, DefaultDedupMinBytes} {
		if fp := ComputeSourceFingerprint(make([]byte, size)); fp != nil {
			t.Fatalf("size %d: want nil fingerprint", size)
		}
	}
}

func TestSourceFingerprintRecordsFullDigestAndMiddleWindows(t *testing.T) {
	raw := noisyBytes(DefaultDedupMinBytes + 4096)
	fp := ComputeSourceFingerprint(raw)
	if fp == nil {
		t.Fatal("want fingerprint")
	}
	if fp.SHA256 != hexSum(raw) {
		t.Fatal("digest mismatch")
	}
	if fp.Probes.Size != len(raw) {
		t.Fatalf("size = %d", fp.Probes.Size)
	}
	if len(fp.Probes.Windows) != len(ProbeFractions) {
		t.Fatalf("windows = %d", len(fp.Probes.Windows))
	}
	offsets := map[int]bool{}
	for _, w := range fp.Probes.Windows {
		offsets[w.Offset] = true
		if w.Length != ProbeWindowBytes {
			t.Fatalf("length = %d", w.Length)
		}
		// 窗口必须整段落在中间一半
		if w.Offset < len(raw)/4 || w.Offset+w.Length > len(raw)-len(raw)/4 {
			t.Fatalf("window out of middle half: %+v", w)
		}
		if w.SHA256 != hexSum(raw[w.Offset:w.Offset+w.Length]) {
			t.Fatal("window digest mismatch")
		}
	}
	if len(offsets) != len(fp.Probes.Windows) {
		t.Fatal("window offsets must be distinct")
	}
}

func TestSourceFingerprintIsDeterministic(t *testing.T) {
	raw := noisyBytes(DefaultDedupMinBytes + 1)
	a, b := ComputeSourceFingerprint(raw), ComputeSourceFingerprint(raw)
	if a.SHA256 != b.SHA256 || len(a.Probes.Windows) != len(b.Probes.Windows) {
		t.Fatal("not deterministic")
	}
	for i := range a.Probes.Windows {
		if a.Probes.Windows[i] != b.Probes.Windows[i] {
			t.Fatal("not deterministic")
		}
	}
}

func TestSourceFingerprintWindowForSmallFilesAboveThreshold(t *testing.T) {
	raw := noisyBytes(DefaultDedupMinBytes + 1)
	fp := ComputeSourceFingerprint(raw)
	if fp == nil || len(fp.Probes.Windows) != 3 {
		t.Fatalf("want 3 windows: %+v", fp)
	}
	for _, w := range fp.Probes.Windows {
		if w.Length != ProbeWindowBytes {
			t.Fatalf("length = %d", w.Length)
		}
	}
}

func TestSourceFingerprintWindowShrinksToQuarter(t *testing.T) {
	SetTestTuning(8*1024, false)
	defer SetTestTuning(0, false)
	raw := noisyBytes(40 * 1024)
	fp := ComputeSourceFingerprint(raw)
	if fp == nil || len(fp.Probes.Windows) != 3 {
		t.Fatalf("want 3 windows: %+v", fp)
	}
	for _, w := range fp.Probes.Windows {
		if w.Length != len(raw)/4 {
			t.Fatalf("length = %d, want %d", w.Length, len(raw)/4)
		}
	}
}

// ---------------- 时间规则（对应 tests/test_attachment_cleanup.py 的纯函数部分） ----------------

func TestAttachmentPurgeAfterIsFirstTwoAMAfterSevenFullDays(t *testing.T) {
	sh := common.Shanghai
	cases := []struct{ in, want time.Time }{
		// 下午提交：7 天后同一时刻已过当天 2 点，顺延到次日 02:00
		{time.Date(2026, 9, 22, 14, 30, 0, 0, sh), time.Date(2026, 9, 30, 2, 0, 0, 0, sh)},
		// 凌晨 2 点前提交：当天 02:00 即到期
		{time.Date(2026, 9, 15, 1, 30, 0, 0, sh), time.Date(2026, 9, 22, 2, 0, 0, 0, sh)},
		// 正好落在 2 点整：含边界
		{time.Date(2026, 9, 15, 2, 0, 0, 0, sh), time.Date(2026, 9, 22, 2, 0, 0, 0, sh)},
		// 入参为 UTC：结果一致
		{time.Date(2026, 9, 22, 6, 30, 0, 0, time.UTC), time.Date(2026, 9, 30, 2, 0, 0, 0, sh)},
	}
	for _, c := range cases {
		got := AttachmentPurgeAfter(c.in)
		if !got.Equal(c.want) || got.Location() != time.UTC {
			t.Errorf("AttachmentPurgeAfter(%v) = %v, want %v (UTC)", c.in, got, c.want)
		}
	}
}

func TestUnreferencedProtectedCutoff(t *testing.T) {
	now := time.Date(2026, 9, 22, 14, 30, 0, 0, time.UTC)
	if got := UnreferencedProtectedCutoff(now); !got.Equal(now.Add(-7 * 24 * time.Hour)) {
		t.Fatalf("cutoff = %v", got)
	}
}

// ---------------- 文件名 ----------------

func TestPyPathName(t *testing.T) {
	cases := map[string]string{
		"a.png":       "a.png",
		"dir/b.jpg":   "b.jpg",
		"/abs/c.webp": "c.webp",
		"a/b/.":       "b",
		"a/":          "a",
		".":           "",
		"/":           "",
		"..":          "..",
	}
	for in, want := range cases {
		if got := pyPathName(in); got != want {
			t.Errorf("pyPathName(%q) = %q, want %q", in, got, want)
		}
	}
}

// ---------------- 图片编解码 ----------------

func pngOf(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func uniform(w, h int, c color.Color) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	return img
}

func pngChunks(data []byte) map[string][]byte {
	out := map[string][]byte{}
	pos := 8
	for pos+8 <= len(data) {
		n := int(binary.BigEndian.Uint32(data[pos:]))
		out[string(data[pos+4:pos+8])] = data[pos+8 : pos+8+n]
		pos += 12 + n
	}
	return out
}

func TestReencodeJPEGToRGBPNG(t *testing.T) {
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, uniform(64, 48, color.NRGBA{255, 0, 0, 255}), nil); err != nil {
		t.Fatal(err)
	}
	data, w, h, err := ReencodePNG(buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if w != 64 || h != 48 {
		t.Fatalf("size %dx%d", w, h)
	}
	if !bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) {
		t.Fatal("not a PNG")
	}
	if ihdr := pngChunks(data)["IHDR"]; ihdr[8] != 8 || ihdr[9] != 2 {
		t.Fatalf("want 8-bit RGB, got depth=%d type=%d", ihdr[8], ihdr[9])
	}
	// 同一输入重编码结果稳定（sha256 去重的前提）
	again, _, _, _ := ReencodePNG(buf.Bytes())
	if !bytes.Equal(data, again) {
		t.Fatal("re-encoding is not deterministic")
	}
	decoded, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if decoded.Bounds().Dx() != 64 || decoded.Bounds().Dy() != 48 {
		t.Fatal("decoded size mismatch")
	}
}

func TestReencodeKeepsAlphaChannelEvenWhenOpaque(t *testing.T) {
	data, _, _, err := ReencodePNG(pngOf(t, uniform(8, 8, color.NRGBA{1, 2, 3, 128})))
	if err != nil {
		t.Fatal(err)
	}
	if pngChunks(data)["IHDR"][9] != 6 {
		t.Fatal("want RGBA color type")
	}
	// Pillow 的 RGBA 模式即使全不透明也保存为 RGBA
	opaque := &decodedImage{raster: &raster{w: 4, h: 4, alpha: true, pix: bytes.Repeat([]byte{9, 8, 7, 255}, 16)}}
	src, err := encodePNG(opaque) // 全不透明的 RGBA PNG（颜色类型 6）
	if err != nil {
		t.Fatal(err)
	}
	data, _, _, err = ReencodePNG(src)
	if err != nil {
		t.Fatal(err)
	}
	if ihdr := pngChunks(data)["IHDR"]; ihdr[8] != 8 || ihdr[9] != 6 {
		t.Fatalf("want 8-bit RGBA, got depth=%d type=%d", ihdr[8], ihdr[9])
	}
}

func TestReencodePalettedTransparencyBecomesRGBColorKey(t *testing.T) {
	pal := color.Palette{color.NRGBA{10, 20, 30, 255}, color.NRGBA{200, 100, 50, 0}}
	img := image.NewPaletted(image.Rect(0, 0, 4, 4), pal)
	img.Pix[0] = 1
	data, _, _, err := ReencodePNG(pngOf(t, img))
	if err != nil {
		t.Fatal(err)
	}
	chunks := pngChunks(data)
	if chunks["IHDR"][9] != 2 {
		t.Fatal("paletted image must become RGB")
	}
	if !bytes.Equal(chunks["tRNS"], []byte{0, 200, 0, 100, 0, 50}) {
		t.Fatalf("tRNS = %v", chunks["tRNS"])
	}
}

func TestReencodePreservesICCProfile(t *testing.T) {
	src := pngOf(t, uniform(4, 4, color.NRGBA{9, 9, 9, 255}))
	profile := []byte(strings.Repeat("icc-profile-bytes", 8))
	var z bytes.Buffer
	zw := zlib.NewWriter(&z)
	zw.Write(profile)
	zw.Close()
	chunk := append([]byte("ICC Profile\x00\x00"), z.Bytes()...)
	var withICC bytes.Buffer
	withICC.Write(src[:33]) // 签名 + IHDR
	writeChunk(&withICC, "iCCP", chunk)
	withICC.Write(src[33:])
	img, err := decodeImage(withICC.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(img.icc, profile) {
		t.Fatal("icc not parsed")
	}
	data, err := encodePNG(img)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := pngChunks(data)["iCCP"]; !ok {
		t.Fatal("iCCP chunk missing")
	}
}

func TestDecodeRejectsGarbageAndBombs(t *testing.T) {
	if _, _, _, err := ReencodePNG([]byte("not an image")); err == nil {
		t.Fatal("want error for garbage")
	}
	// IHDR 声称 20000×20000（超过 2×MAX_IMAGE_PIXELS）
	src := pngOf(t, uniform(1, 1, color.NRGBA{A: 255}))
	bomb := append([]byte{}, src...)
	binary.BigEndian.PutUint32(bomb[16:], 20000)
	binary.BigEndian.PutUint32(bomb[20:], 20000)
	if _, err := decodeImage(bomb); err == nil {
		t.Fatal("want decompression bomb error")
	}
	// 截断的图片
	if _, _, _, err := ReencodePNG(src[:len(src)/2]); err == nil {
		t.Fatal("want error for truncated image")
	}
}

func TestThumbnailSizesMatchPillow(t *testing.T) {
	// 期望值取自 Pillow 12 的 Image.thumbnail((size, size))
	cases := []struct{ w, h, size, ww, wh int }{
		{100, 80, 16, 16, 13},
		{100, 80, 99, 99, 79},
		{640, 480, 333, 333, 250},
		{37, 1000, 16, 1, 16},
		{37, 1000, 120, 4, 120},
		{1000, 9, 300, 300, 3},
		{501, 333, 64, 64, 43},
		{3, 400, 16, 1, 16},
	}
	for _, c := range cases {
		w, h, ok := thumbnailSize(c.w, c.h, c.size)
		if !ok || w != c.ww || h != c.wh {
			t.Errorf("thumbnailSize(%d,%d,%d) = %d,%d want %d,%d", c.w, c.h, c.size, w, h, c.ww, c.wh)
		}
	}
	if _, _, ok := thumbnailSize(16, 12, 16); ok {
		t.Error("images not larger than size must stay untouched")
	}
}

func TestThumbnailOfUniformImageKeepsColor(t *testing.T) {
	src := &raster{w: 300, h: 200, pix: bytes.Repeat([]byte{12, 34, 56, 255}, 300*200)}
	out := thumbnail(src, 64)
	if out.w != 64 || out.h != 43 {
		t.Fatalf("size %dx%d", out.w, out.h)
	}
	for i := 0; i < len(out.pix); i += 4 {
		if out.pix[i] != 12 || out.pix[i+1] != 34 || out.pix[i+2] != 56 {
			t.Fatalf("pixel %d = %v", i/4, out.pix[i:i+4])
		}
	}
	rgba := &raster{w: 120, h: 90, alpha: true, pix: bytes.Repeat([]byte{200, 100, 50, 128}, 120*90)}
	out = thumbnail(rgba, 47)
	if out.w != 47 || out.h != 35 || !out.alpha {
		t.Fatalf("size %dx%d alpha=%v", out.w, out.h, out.alpha)
	}
}

func TestReduceRoundingMatchesPillow(t *testing.T) {
	// 3×1 缩小：Pillow 的定点乘法对 (1+1+0+amend) 得 0（而不是精确舍入的 1）
	src := &raster{w: 3, h: 1, pix: []byte{1, 1, 1, 255, 1, 1, 1, 255, 0, 0, 0, 255}}
	out := reduceImage(src, 3, 1, [4]int{0, 0, 3, 1})
	if out.w != 1 || out.pix[0] != 0 {
		t.Fatalf("reduce = %v", out.pix)
	}
}

func TestRenderPreviewProducesWebP(t *testing.T) {
	dir := t.TempDir()
	data, _, _, err := ReencodePNG(pngOf(t, uniform(64, 48, color.NRGBA{0, 128, 255, 255})))
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "x.png")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
	out, err := RenderPreview(path, 16)
	if err != nil {
		t.Fatal(err)
	}
	if string(out[:4]) != "RIFF" || string(out[8:12]) != "WEBP" {
		t.Fatal("not a webp")
	}
	img, err := decodeImage(out)
	if err != nil {
		t.Fatal(err)
	}
	if img.w != 16 || img.h != 12 {
		t.Fatalf("preview size %dx%d", img.w, img.h)
	}
	if _, err := RenderPreview(filepath.Join(dir, "missing.png"), 16); err == nil {
		t.Fatal("want INVALID_IMAGE for missing file")
	}
}

// ---------------- 上传提交失败时回收磁盘文件 ----------------

// failingCommitDriver：查询一律返回空结果、写语句成功、事务提交失败（对应 Python 的 FailingCommitSession）。
type failingCommitDriver struct{}

func (failingCommitDriver) Open(string) (driver.Conn, error) { return &failingConn{}, nil }

type failingConn struct{ rolledBack bool }

func (c *failingConn) Prepare(string) (driver.Stmt, error) { return nil, errors.New("not supported") }
func (c *failingConn) Close() error                        { return nil }
func (c *failingConn) Begin() (driver.Tx, error)           { return &failingTx{c}, nil }
func (c *failingConn) QueryContext(context.Context, string, []driver.NamedValue) (driver.Rows, error) {
	return emptyRows{}, nil
}
func (c *failingConn) ExecContext(context.Context, string, []driver.NamedValue) (driver.Result, error) {
	return driver.RowsAffected(1), nil
}

type failingTx struct{ c *failingConn }

func (t *failingTx) Commit() error   { return errors.New("commit failed") }
func (t *failingTx) Rollback() error { t.c.rolledBack = true; return nil }

type emptyRows struct{}

func (emptyRows) Columns() []string         { return []string{"id"} }
func (emptyRows) Close() error              { return nil }
func (emptyRows) Next([]driver.Value) error { return io.EOF }

func init() { sql.Register("failing-commit", failingCommitDriver{}) }

func TestUploadRemovesDiskFileWhenDatabaseCommitFails(t *testing.T) {
	conn, err := sql.Open("failing-commit", "")
	if err != nil {
		t.Fatal(err)
	}
	prevDB, prevDir := db.DB, config.S.UploadDir
	db.DB = sqlx.NewDb(conn, "mysql")
	config.S.UploadDir = filepath.Join(t.TempDir(), "uploads")
	prevMax := config.S.MaxImageBytes
	config.S.MaxImageBytes = 10 * 1024 * 1024
	defer func() { db.DB, config.S.UploadDir, config.S.MaxImageBytes = prevDB, prevDir, prevMax }()

	s := db.NewSession(context.Background())
	defer s.Close()
	src := pngOf(t, uniform(16, 12, color.NRGBA{255, 0, 0, 255}))
	_, err = SaveImage(s, "source.png", "image/png", bytes.NewReader(src))
	if err == nil || !strings.Contains(err.Error(), "commit failed") {
		t.Fatalf("want commit failure, got %v", err)
	}
	matches, _ := filepath.Glob(filepath.Join(config.S.UploadDir, "*.png"))
	if len(matches) != 0 {
		t.Fatalf("disk file not removed: %v", matches)
	}
}

func TestSaveImageRejectsTypeAndSize(t *testing.T) {
	prevMax := config.S.MaxImageBytes
	config.S.MaxImageBytes = 100
	defer func() { config.S.MaxImageBytes = prevMax }()
	if _, err := SaveImage(nil, "a.gif", "image/gif", bytes.NewReader(nil)); err == nil || !strings.Contains(err.Error(), "INVALID_IMAGE_TYPE") {
		t.Fatalf("want INVALID_IMAGE_TYPE, got %v", err)
	}
	if _, err := SaveImage(nil, "a.png", "image/png", bytes.NewReader(make([]byte, 101))); err == nil || !strings.Contains(err.Error(), "IMAGE_TOO_LARGE") {
		t.Fatalf("want IMAGE_TOO_LARGE, got %v", err)
	}
	if _, err := SaveImage(nil, "a.png", "image/png", bytes.NewReader([]byte("garbage"))); err == nil || !strings.Contains(err.Error(), "INVALID_IMAGE") {
		t.Fatalf("want INVALID_IMAGE, got %v", err)
	}
}
