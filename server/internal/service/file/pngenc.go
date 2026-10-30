package file

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"hash/crc32"
	"image"
	"io"

	webpenc "github.com/gen2brain/webp"
)

// encodePNG 等价 Pillow `converted.save(output, format="PNG", optimize=True)`：
// 8 位 RGB（颜色类型 2）或 RGBA（颜色类型 6，即使全不透明也保留 alpha），
// zlib 最高压缩级别，逐行按 libpng 启发式选择滤波器；带 ICC 时写 iCCP，RGB 带透明色时写 tRNS。
func encodePNG(img *decodedImage) ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteString("\x89PNG\r\n\x1a\n")
	colorType := byte(2)
	bpp := 3
	if img.alpha {
		colorType, bpp = 6, 4
	}
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], uint32(img.w))
	binary.BigEndian.PutUint32(ihdr[4:8], uint32(img.h))
	ihdr[8] = 8
	ihdr[9] = colorType
	writeChunk(&buf, "IHDR", ihdr)
	if len(img.icc) > 0 {
		var z bytes.Buffer
		zw := zlib.NewWriter(&z)
		if _, err := zw.Write(img.icc); err != nil {
			return nil, err
		}
		if err := zw.Close(); err != nil {
			return nil, err
		}
		writeChunk(&buf, "iCCP", append([]byte("ICC Profile\x00\x00"), z.Bytes()...))
	}
	if !img.alpha && len(img.trns) == 3 {
		t := make([]byte, 6)
		for i, v := range img.trns {
			binary.BigEndian.PutUint16(t[i*2:], uint16(v))
		}
		writeChunk(&buf, "tRNS", t)
	}

	idat := &chunkWriter{w: &buf, typ: "IDAT"}
	zw, err := zlib.NewWriterLevel(idat, zlib.BestCompression)
	if err != nil {
		return nil, err
	}
	rowLen := img.w * bpp
	prev := make([]byte, rowLen)
	cur := make([]byte, rowLen)
	var filtered [5][]byte
	for i := range filtered {
		filtered[i] = make([]byte, rowLen+1)
	}
	for y := 0; y < img.h; y++ {
		src := img.pix[y*img.w*4 : (y+1)*img.w*4]
		if bpp == 4 {
			copy(cur, src)
		} else {
			for x := 0; x < img.w; x++ {
				cur[x*3], cur[x*3+1], cur[x*3+2] = src[x*4], src[x*4+1], src[x*4+2]
			}
		}
		best := filterRow(cur, prev, bpp, &filtered)
		if _, err := zw.Write(filtered[best]); err != nil {
			return nil, err
		}
		prev, cur = cur, prev
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	if err := idat.flush(); err != nil {
		return nil, err
	}
	writeChunk(&buf, "IEND", nil)
	return buf.Bytes(), nil
}

func writeChunk(w io.Writer, typ string, data []byte) {
	var header [8]byte
	binary.BigEndian.PutUint32(header[:4], uint32(len(data)))
	copy(header[4:], typ)
	crc := crc32.NewIEEE()
	crc.Write(header[4:])
	crc.Write(data)
	var footer [4]byte
	binary.BigEndian.PutUint32(footer[:], crc.Sum32())
	w.Write(header[:])
	w.Write(data)
	w.Write(footer[:])
}

// chunkWriter 把 zlib 输出按 64 KiB 切成多个 IDAT 块。
type chunkWriter struct {
	w   io.Writer
	typ string
	buf []byte
}

const idatChunkSize = 64 * 1024

func (c *chunkWriter) Write(p []byte) (int, error) {
	c.buf = append(c.buf, p...)
	for len(c.buf) >= idatChunkSize {
		writeChunk(c.w, c.typ, c.buf[:idatChunkSize])
		c.buf = append(c.buf[:0], c.buf[idatChunkSize:]...)
	}
	return len(p), nil
}

func (c *chunkWriter) flush() error {
	if len(c.buf) > 0 {
		writeChunk(c.w, c.typ, c.buf)
		c.buf = c.buf[:0]
	}
	return nil
}

func abs8(v byte) int {
	if v < 128 {
		return int(v)
	}
	return 256 - int(v)
}

func paeth(a, b, c byte) byte {
	p := int(a) + int(b) - int(c)
	pa, pb, pc := p-int(a), p-int(b), p-int(c)
	if pa < 0 {
		pa = -pa
	}
	if pb < 0 {
		pb = -pb
	}
	if pc < 0 {
		pc = -pc
	}
	if pa <= pb && pa <= pc {
		return a
	}
	if pb <= pc {
		return b
	}
	return c
}

// filterRow 计算 5 种滤波结果，返回「有符号字节绝对值之和」最小者（libpng / Pillow 的启发式）。
func filterRow(cur, prev []byte, bpp int, out *[5][]byte) int {
	n := len(cur)
	for f := 0; f < 5; f++ {
		out[f][0] = byte(f)
	}
	none, sub, up, avg, pa := out[0][1:], out[1][1:], out[2][1:], out[3][1:], out[4][1:]
	copy(none, cur)
	for i := 0; i < n; i++ {
		var left, upper, ul byte
		if i >= bpp {
			left = cur[i-bpp]
			ul = prev[i-bpp]
		}
		upper = prev[i]
		sub[i] = cur[i] - left
		up[i] = cur[i] - upper
		avg[i] = cur[i] - byte((int(left)+int(upper))/2)
		pa[i] = cur[i] - paeth(left, upper, ul)
	}
	best, bestSum := 0, -1
	for f := 0; f < 5; f++ {
		sum := 0
		for _, v := range out[f][1:] {
			sum += abs8(v)
			if bestSum >= 0 && sum >= bestSum {
				break
			}
		}
		if bestSum < 0 || sum < bestSum {
			best, bestSum = f, sum
		}
	}
	return best
}

// encodeWebP 等价 Pillow `converted.save(output, format="WEBP", quality=82, method=6)`（libwebp 有损编码）。
func encodeWebP(img *raster) ([]byte, error) {
	nrgba := &image.NRGBA{Pix: img.pix, Stride: img.w * 4, Rect: image.Rect(0, 0, img.w, img.h)}
	if !img.alpha {
		for i := 3; i < len(nrgba.Pix); i += 4 {
			nrgba.Pix[i] = 255
		}
	}
	var buf bytes.Buffer
	if err := webpenc.Encode(&buf, nrgba, webpenc.Options{Quality: 82, Method: 6}); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
