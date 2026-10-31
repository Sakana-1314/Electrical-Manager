package excelexport

import (
	"archive/zip"
	"bufio"
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"image"
	"io"
	"os"
	"strconv"
)

// 导出图片的延迟写入：
//
// excelize 会把 AddPictureFromBytes 收到的图片字节一直留在内存里直到保存，导出几百张原图时
// 内存峰值是图片总量的数倍。这里对 PNG 原图只交给 excelize 一张「占位图」——仅含 IHDR（真实宽高，
// excelize 只用它计算尺寸）和一个记录来源编号的私有块——保存时改写 zip 包，把占位图替换为
// 磁盘上的原图，按块流式复制，不在内存中保留图片内容；最终文件里的图片数据与原图逐字节一致。

// placeholderChunk 是占位图里记录来源编号的 PNG 私有辅助块（ancillary / private / safe-to-copy）。
const placeholderChunk = "emSr"

var pngSignature = []byte("\x89PNG\r\n\x1a\n")

// media 记录占位图与磁盘原图的对应关系。同一路径复用同一张占位图（excelize 按字节去重，
// 与直接嵌入同一文件时只存一份的行为一致）。
type media struct {
	byPath  map[string][]byte
	byToken map[string]string
}

func newMedia() *media {
	return &media{byPath: map[string][]byte{}, byToken: map[string]string{}}
}

// placeholder 返回 path 对应的占位 PNG（宽高与原图一致）。
func (m *media) placeholder(path string, w, h int) []byte {
	if data, ok := m.byPath[path]; ok {
		return data
	}
	token := strconv.Itoa(len(m.byToken) + 1)
	data := pngPlaceholder(w, h, token)
	m.byPath[path] = data
	m.byToken[token] = path
	return data
}

func writePNGChunk(buf *bytes.Buffer, typ string, data []byte) {
	var hdr [8]byte
	binary.BigEndian.PutUint32(hdr[:4], uint32(len(data)))
	copy(hdr[4:], typ)
	buf.Write(hdr[:])
	buf.Write(data)
	crc := crc32.NewIEEE()
	crc.Write(hdr[4:])
	crc.Write(data)
	var sum [4]byte
	binary.BigEndian.PutUint32(sum[:], crc.Sum32())
	buf.Write(sum[:])
}

func pngPlaceholder(w, h int, token string) []byte {
	var buf bytes.Buffer
	buf.Write(pngSignature)
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], uint32(w))
	binary.BigEndian.PutUint32(ihdr[4:8], uint32(h))
	ihdr[8], ihdr[9] = 8, 6
	writePNGChunk(&buf, "IHDR", ihdr)
	writePNGChunk(&buf, placeholderChunk, []byte(token))
	writePNGChunk(&buf, "IEND", nil)
	return buf.Bytes()
}

// placeholderToken 识别占位图并取出来源编号。
func placeholderToken(data []byte) (string, bool) {
	if len(data) < 8 || !bytes.Equal(data[:8], pngSignature) {
		return "", false
	}
	for pos := 8; pos+12 <= len(data); {
		n := int(binary.BigEndian.Uint32(data[pos:]))
		if pos+12+n > len(data) {
			return "", false
		}
		if string(data[pos+4:pos+8]) == placeholderChunk {
			return string(data[pos+8 : pos+8+n]), true
		}
		pos += 12 + n
	}
	return "", false
}

// probeImage 只读取文件头判断格式与像素尺寸（不把整张图读进内存）；无法识别返回 ok=false。
func probeImage(path string) (format string, w, h int, ok bool) {
	st, err := os.Stat(path)
	if err != nil || !st.Mode().IsRegular() {
		return "", 0, 0, false
	}
	f, err := os.Open(path)
	if err != nil {
		return "", 0, 0, false
	}
	defer f.Close()
	cfg, format, err := image.DecodeConfig(bufio.NewReader(f))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return "", 0, 0, false
	}
	return format, cfg.Width, cfg.Height, true
}

// fallbackPNG 是原图在导出过程中被删除时写入的 1×1 透明图（保证工作簿仍可打开）。
var fallbackPNG = []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\x0f\x00\x01\x01\x01\x00\x18\xdd\x8d\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

// copyMediaEntry 把磁盘原图以 Store 方式写入 zip（PNG 已压缩，不再二次压缩）：
// 先流式计算 CRC32 与大小，再流式复制，两遍都只占用固定大小的缓冲区。
func copyMediaEntry(zw *zip.Writer, hdr zip.FileHeader, path string) error {
	f, err := os.Open(path)
	if err != nil {
		return writeStoredEntry(zw, hdr, fallbackPNG)
	}
	defer f.Close()
	crc := crc32.NewIEEE()
	size, err := io.Copy(crc, f)
	if err != nil {
		return err
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return err
	}
	hdr.Method = zip.Store
	hdr.CRC32 = crc.Sum32()
	hdr.CompressedSize64 = uint64(size)
	hdr.UncompressedSize64 = uint64(size)
	w, err := zw.CreateRaw(&hdr)
	if err != nil {
		return err
	}
	n, err := io.Copy(w, f)
	if err != nil {
		return err
	}
	if n != size {
		return io.ErrUnexpectedEOF
	}
	return nil
}

func writeStoredEntry(zw *zip.Writer, hdr zip.FileHeader, data []byte) error {
	hdr.Method = zip.Store
	hdr.CRC32 = crc32.ChecksumIEEE(data)
	hdr.CompressedSize64 = uint64(len(data))
	hdr.UncompressedSize64 = uint64(len(data))
	w, err := zw.CreateRaw(&hdr)
	if err != nil {
		return err
	}
	_, err = w.Write(data)
	return err
}
