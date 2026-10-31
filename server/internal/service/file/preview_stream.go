package file

import (
	"bufio"
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
)

// 流式缩略图：附件统一存为 8 位、非隔行的 PNG，缩略图不必把整张原图解码进内存。
//
// 这里逐行解压 PNG 扫描线，边读边完成与整图路径（decodeImage + thumbnail）完全相同的运算：
//   - 无 alpha：按 reducing_gap=2.0 先做 reduce（盒式平均，只依赖相邻 fy 行），再做 Lanczos 水平卷积；
//   - 有 alpha：逐行预乘后直接做 Lanczos 水平卷积（Pillow 对 RGBA 不走 reduce）；
//   - 水平卷积的结果只有「输出宽度 × 行数」，最后再整体做垂直卷积。
//
// 内存只与输出尺寸成正比（几行原图 + 输出宽度的中间图），与原图尺寸无关。
// 遇到不适用的情况（非 PNG、16 位 / 隔行、无需缩放的小图、极端长宽比等）返回 ok=false，交给整图路径。

// errStreamUnsupported 表示该文件不走流式路径（不是错误）。
var errStreamUnsupported = errors.New("stream thumbnail unsupported")

type pngHeader struct {
	w, h      int
	colorType byte
	palette   []byte // PLTE（RGB 三元组）
}

func (h *pngHeader) bpp() int {
	switch h.colorType {
	case 0, 3:
		return 1
	case 4:
		return 2
	case 2:
		return 3
	case 6:
		return 4
	}
	return 0
}

func (h *pngHeader) alpha() bool { return h.colorType == 4 || h.colorType == 6 }

// idatReader 把连续的 IDAT 块拼成一个字节流（遇到非 IDAT 块即结束）。
type idatReader struct {
	r      *bufio.Reader
	remain uint32 // 当前块剩余数据
	done   bool
}

func (d *idatReader) Read(p []byte) (int, error) {
	for d.remain == 0 {
		if d.done {
			return 0, io.EOF
		}
		// 跳过上一块的 CRC，读取下一块头。
		var hdr [12]byte
		if _, err := io.ReadFull(d.r, hdr[:4]); err != nil {
			return 0, err
		}
		if _, err := io.ReadFull(d.r, hdr[4:12]); err != nil {
			d.done = true
			return 0, io.EOF
		}
		if string(hdr[8:12]) != "IDAT" {
			d.done = true
			return 0, io.EOF
		}
		d.remain = binary.BigEndian.Uint32(hdr[4:8])
	}
	if uint32(len(p)) > d.remain {
		p = p[:d.remain]
	}
	n, err := d.r.Read(p)
	d.remain -= uint32(n)
	if err == io.EOF && n > 0 {
		err = nil
	}
	return n, err
}

// readPNGHeader 读到第一个 IDAT 块头为止；返回头信息与第一个 IDAT 的长度。
func readPNGHeader(r *bufio.Reader) (*pngHeader, uint32, error) {
	var sig [8]byte
	if _, err := io.ReadFull(r, sig[:]); err != nil || !bytes.Equal(sig[:], []byte("\x89PNG\r\n\x1a\n")) {
		return nil, 0, errStreamUnsupported
	}
	h := &pngHeader{}
	seenIHDR := false
	for {
		var hdr [8]byte
		if _, err := io.ReadFull(r, hdr[:]); err != nil {
			return nil, 0, err
		}
		n := binary.BigEndian.Uint32(hdr[:4])
		typ := string(hdr[4:8])
		switch typ {
		case "IHDR":
			if n != 13 {
				return nil, 0, errUnsupportedImage
			}
			var b [13]byte
			if _, err := io.ReadFull(r, b[:]); err != nil {
				return nil, 0, err
			}
			h.w = int(binary.BigEndian.Uint32(b[0:4]))
			h.h = int(binary.BigEndian.Uint32(b[4:8]))
			depth, ct, interlace := b[8], b[9], b[12]
			if depth != 8 || interlace != 0 || (ct != 0 && ct != 2 && ct != 3 && ct != 4 && ct != 6) {
				return nil, 0, errStreamUnsupported
			}
			h.colorType = ct
			seenIHDR = true
		case "PLTE":
			if n%3 != 0 || n > 256*3 {
				return nil, 0, errStreamUnsupported
			}
			h.palette = make([]byte, n)
			if _, err := io.ReadFull(r, h.palette); err != nil {
				return nil, 0, err
			}
		case "IDAT":
			if !seenIHDR || (h.colorType == 3 && h.palette == nil) {
				return nil, 0, errStreamUnsupported
			}
			return h, n, nil
		case "IEND":
			return nil, 0, errUnsupportedImage
		default:
			if !seenIHDR {
				return nil, 0, errStreamUnsupported
			}
			if _, err := r.Discard(int(n)); err != nil {
				return nil, 0, err
			}
		}
		if _, err := r.Discard(4); err != nil { // CRC
			return nil, 0, err
		}
	}
}

// pngRows 逐行产出转换后的 RGBA 像素（无 alpha 时 A=255，与 decodeImage 的转换一致）。
type pngRows struct {
	h         *pngHeader
	z         io.ReadCloser
	cur, prev []byte
	rgba      []byte
	premul    bool
	y         int
}

func newPNGRows(h *pngHeader, r *bufio.Reader, firstIDAT uint32, premul bool) (*pngRows, error) {
	z, err := zlib.NewReader(&idatReader{r: r, remain: firstIDAT})
	if err != nil {
		return nil, err
	}
	stride := h.w*h.bpp() + 1
	return &pngRows{h: h, z: z, cur: make([]byte, stride), prev: make([]byte, stride), rgba: make([]byte, h.w*4), premul: premul}, nil
}

// next 解出下一行并返回 RGBA 行（复用内部缓冲，调用方在下一次 next 前用完）。
func (p *pngRows) next() ([]byte, error) {
	if _, err := io.ReadFull(p.z, p.cur); err != nil {
		if err == io.EOF {
			err = io.ErrUnexpectedEOF
		}
		return nil, err
	}
	bpp := p.h.bpp()
	if err := unfilter(p.cur[0], p.cur[1:], p.prev[1:], bpp); err != nil {
		return nil, err
	}
	src := p.cur[1:]
	out := p.rgba
	switch p.h.colorType {
	case 0:
		for x, v := range src {
			out[x*4], out[x*4+1], out[x*4+2], out[x*4+3] = v, v, v, 255
		}
	case 2:
		for x := 0; x < p.h.w; x++ {
			out[x*4], out[x*4+1], out[x*4+2], out[x*4+3] = src[x*3], src[x*3+1], src[x*3+2], 255
		}
	case 3:
		pal := p.h.palette
		for x, idx := range src {
			i := int(idx) * 3
			if i+2 < len(pal) {
				out[x*4], out[x*4+1], out[x*4+2] = pal[i], pal[i+1], pal[i+2]
			} else {
				// 越界索引：与 Go 解码器一致按不透明黑色处理。
				out[x*4], out[x*4+1], out[x*4+2] = 0, 0, 0
			}
			out[x*4+3] = 255
		}
	case 4:
		for x := 0; x < p.h.w; x++ {
			v := src[x*2]
			out[x*4], out[x*4+1], out[x*4+2], out[x*4+3] = v, v, v, src[x*2+1]
		}
	case 6:
		copy(out, src)
	}
	if p.premul {
		premultiplyRow(out, out)
	}
	p.cur, p.prev = p.prev, p.cur
	p.y++
	return out, nil
}

// unfilter 按 PNG 扫描线滤波器类型还原一行（cur 原地改写）。
func unfilter(filter byte, cur, prev []byte, bpp int) error {
	switch filter {
	case 0:
	case 1:
		for i := bpp; i < len(cur); i++ {
			cur[i] += cur[i-bpp]
		}
	case 2:
		for i := range cur {
			cur[i] += prev[i]
		}
	case 3:
		for i := 0; i < bpp; i++ {
			cur[i] += prev[i] / 2
		}
		for i := bpp; i < len(cur); i++ {
			cur[i] += uint8((int(cur[i-bpp]) + int(prev[i])) / 2)
		}
	case 4:
		for i := 0; i < bpp; i++ {
			cur[i] += prev[i]
		}
		for i := bpp; i < len(cur); i++ {
			a, b, c := int(cur[i-bpp]), int(prev[i]), int(prev[i-bpp])
			pa, pb, pc := abs(b-c), abs(a-c), abs(a+b-2*c)
			switch {
			case pa <= pb && pa <= pc:
				cur[i] += uint8(a)
			case pb <= pc:
				cur[i] += uint8(b)
			default:
				cur[i] += uint8(c)
			}
		}
	default:
		return fmt.Errorf("png: bad filter type %d", filter)
	}
	return nil
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}

// streamThumbnail 流式生成缩略图；ok=false 表示不适用（调用方改走整图路径）。
func streamThumbnail(path string, size int) (out *raster, ok bool, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, true, err
	}
	defer f.Close()
	r := bufio.NewReaderSize(f, 64<<10)
	h, firstIDAT, err := readPNGHeader(r)
	if errors.Is(err, errStreamUnsupported) {
		return nil, false, nil
	}
	if err != nil {
		return nil, true, err
	}
	if h.w <= 0 || h.h <= 0 {
		return nil, true, errUnsupportedImage
	}
	if int64(h.w)*int64(h.h) > 2*maxImagePixels {
		return nil, true, errors.New("decompression bomb")
	}
	fw, fh, resize := thumbnailSize(h.w, h.h, size)
	if !resize || (fw == h.w && fh == h.h) {
		return nil, false, nil
	}

	// 与 resizeImage 相同的规划：RGB 先按 reducing_gap 计算 reduce 倍数；RGBA 预乘后不 reduce。
	alpha := h.alpha()
	fx, fy := 1, 1
	if !alpha {
		fx = max(1, int(float64(h.w)/float64(fw)/reducingGap))
		fy = max(1, int(float64(h.h)/float64(fh)/reducingGap))
		if fx > 1 || fy > 1 {
			full := [4]float64{0, 0, float64(h.w), float64(h.h)}
			if safeBoxDims(h.w, h.h, fw, fh, full) != [4]int{0, 0, h.w, h.h} {
				return nil, false, nil
			}
		} else {
			fx, fy = 1, 1
		}
	}
	ow, oh := (h.w+fx-1)/fx, (h.h+fy-1)/fy
	boxIn := [4]float64{0, 0, float64(h.w) / float64(fx), float64(h.h) / float64(fy)}
	if fx == 1 && fy == 1 {
		boxIn = [4]float64{0, 0, float64(h.w), float64(h.h)}
	}
	if oh > ow*100 && fh < oh {
		return nil, false, nil // 极端细长图：整图路径先做一次垂直缩放，这里不复刻
	}
	box := [4]float32{float32(boxIn[0]), float32(boxIn[1]), float32(boxIn[2]), float32(boxIn[3])}
	if box[0] == float32(int(box[0])) && box[1] == float32(int(box[1])) && box[2]-box[0] == float32(fw) && box[3]-box[1] == float32(fh) {
		return nil, false, nil // 走裁剪捷径的情况由整图路径处理
	}

	channels := 3
	if alpha {
		channels = 4 // 预乘图按 4 通道参与卷积
	}
	needH := fw != ow || box[0] != 0 || box[2] != float32(fw)
	needV := fh != oh || box[1] != 0 || box[3] != float32(fh)
	horiz := precomputeCoeffs(ow, box[0], box[2], fw)
	vert := precomputeCoeffs(oh, box[1], box[3], fh)
	yFirst := vert.bounds[0]
	yLast := vert.bounds[fh*2-2] + vert.bounds[fh*2-1]
	if !needH {
		yFirst, yLast = 0, oh
	}
	tw := ow
	if needH {
		tw = fw
		for i := 0; i < fh; i++ {
			vert.bounds[i*2] -= yFirst
		}
	}
	temp := &raster{w: tw, h: yLast - yFirst, keep4: alpha, pix: make([]byte, tw*(yLast-yFirst)*4)}

	rows, err := newPNGRows(h, r, firstIDAT, alpha)
	if err != nil {
		return nil, true, err
	}
	defer rows.z.Close()
	emit := func(oy int, row []byte) {
		if oy < yFirst || oy >= yLast {
			return
		}
		dst := temp.pix[(oy-yFirst)*tw*4 : (oy-yFirst+1)*tw*4]
		if needH {
			resampleRow(dst, row, fw, horiz, channels)
		} else {
			copy(dst, row)
		}
	}
	if fx == 1 && fy == 1 {
		for y := 0; y < h.h; y++ {
			row, err := rows.next()
			if err != nil {
				return nil, true, err
			}
			emit(y, row)
			if y+1 >= yLast {
				break // 之后的行不参与卷积
			}
		}
	} else {
		stride := h.w * 4
		band := make([]byte, fy*stride)
		reduced := make([]byte, ow*4)
		for oy := 0; oy < oh; oy++ {
			ys := min(fy, h.h-oy*fy)
			for i := 0; i < ys; i++ {
				row, err := rows.next()
				if err != nil {
					return nil, true, err
				}
				copy(band[i*stride:], row)
			}
			if oy >= yFirst && oy < yLast {
				reduceBand(reduced, band, stride, 0, h.w, fx, ys, channels)
				emit(oy, reduced)
			}
			if oy+1 >= yLast {
				break // 之后的行不参与卷积
			}
		}
	}
	out = temp
	if needV {
		out = resampleVertical(temp, fh, vert)
	}
	if alpha {
		unpremultiply(out)
		out.alpha = true
	}
	return out, true, nil
}

// safeBoxDims 与 safeBox 相同，但只依赖原图宽高（流式路径没有整图 raster）。
func safeBoxDims(imW, imH, w, h int, box [4]float64) [4]int {
	support := lanczosSupport - 0.5
	supportX := support * ((box[2] - box[0]) / float64(w))
	supportY := support * ((box[3] - box[1]) / float64(h))
	return [4]int{
		max(0, int(box[0]-supportX)),
		max(0, int(box[1]-supportY)),
		min(imW, int(math.Ceil(box[2]+supportX))),
		min(imH, int(math.Ceil(box[3]+supportY))),
	}
}
