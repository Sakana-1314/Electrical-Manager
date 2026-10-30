package file

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"image"
	"image/color"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"sort"

	"golang.org/x/image/bmp"
	"golang.org/x/image/tiff"
	"golang.org/x/image/webp"
)

// 图片解码 / 转换层：复刻 Pillow 的 `Image.open(...).convert("RGBA" if "A" in getbands() else "RGB")`。
//
// 与 Pillow 对齐的要点：
//   - 按文件内容识别格式（与上传声明的 Content-Type 无关），支持 JPEG / PNG / WebP / GIF / BMP / TIFF；
//   - 不处理 EXIF 方向（Pillow 的 open/convert 同样不做 exif_transpose）；
//   - 像素数超过 2 × MAX_IMAGE_PIXELS 视为解压炸弹（DecompressionBombError）；
//   - 是否带 alpha 通道按原图「模式」判断（PNG 颜色类型 4/6、WebP 的 has_alpha 等）：
//     调色板 / 灰度 / RGB 图即使带 tRNS 透明色，Pillow 也转成 RGB，并把透明色记成 RGB 三元组；
//   - 16 位灰度（Pillow 的 I;16）转 RGB 时按 0..255 截断，16 位 RGB/RGBA 取高字节；
//   - ICC 色彩配置随图保留（Pillow 保存 PNG 时会写 iCCP）。

// maxImagePixels 等于 PIL.Image.MAX_IMAGE_PIXELS；超过它的两倍时 Pillow 抛 DecompressionBombError。
const maxImagePixels = 1024 * 1024 * 1024 / 4 / 3

var errUnsupportedImage = errors.New("cannot identify image file")

// raster 是 8 位、每像素 4 字节（RGBA；无 alpha 时 A 恒为 255）的像素缓冲，对应 Pillow 的 RGB / RGBA 模式。
type raster struct {
	w, h  int
	alpha bool
	// keep4：预乘（RGBa）中间图，第 4 通道参与运算但不是「带 alpha 的输出模式」。
	keep4 bool
	pix   []byte
}

func newRaster(w, h int, alpha bool) *raster {
	return &raster{w: w, h: h, alpha: alpha, pix: make([]byte, w*h*4)}
}

// decodedImage 是转换后的图片及随图元数据（Pillow 的 `im.info` 中会被 PNG 编码器使用的部分）。
type decodedImage struct {
	*raster
	icc  []byte
	trns []int // RGB 透明色（tRNS），仅无 alpha 通道时有效
}

type imageFormat int

const (
	formatUnknown imageFormat = iota
	formatPNG
	formatJPEG
	formatWebP
	formatGIF
	formatBMP
	formatTIFF
)

func sniffFormat(raw []byte) imageFormat {
	switch {
	case bytes.HasPrefix(raw, []byte("\x89PNG\r\n\x1a\n")):
		return formatPNG
	case bytes.HasPrefix(raw, []byte{0xFF, 0xD8, 0xFF}):
		return formatJPEG
	case len(raw) >= 12 && string(raw[:4]) == "RIFF" && string(raw[8:12]) == "WEBP":
		return formatWebP
	case bytes.HasPrefix(raw, []byte("GIF87a")) || bytes.HasPrefix(raw, []byte("GIF89a")):
		return formatGIF
	case bytes.HasPrefix(raw, []byte("BM")):
		return formatBMP
	case bytes.HasPrefix(raw, []byte("II*\x00")) || bytes.HasPrefix(raw, []byte("MM\x00*")):
		return formatTIFF
	}
	return formatUnknown
}

// decodeImage 解码并转换为 RGB / RGBA；任何失败都返回错误（调用方映射成 INVALID_IMAGE）。
func decodeImage(raw []byte) (img *decodedImage, err error) {
	defer func() {
		// 第三方解码器在畸形输入上可能 panic：与 Pillow 的 OSError 一样视为无法解码。
		if r := recover(); r != nil {
			img, err = nil, errUnsupportedImage
		}
	}()
	format := sniffFormat(raw)
	var (
		configFn func(io.Reader) (image.Config, error)
		decodeFn func(io.Reader) (image.Image, error)
	)
	switch format {
	case formatPNG:
		configFn, decodeFn = png.DecodeConfig, png.Decode
	case formatJPEG:
		configFn, decodeFn = jpeg.DecodeConfig, jpeg.Decode
	case formatWebP:
		configFn, decodeFn = webp.DecodeConfig, webp.Decode
	case formatGIF:
		configFn, decodeFn = gif.DecodeConfig, gif.Decode
	case formatBMP:
		configFn, decodeFn = bmp.DecodeConfig, bmp.Decode
	case formatTIFF:
		configFn, decodeFn = tiff.DecodeConfig, tiff.Decode
	default:
		return nil, errUnsupportedImage
	}
	cfg, err := configFn(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return nil, errUnsupportedImage
	}
	if int64(cfg.Width)*int64(cfg.Height) > 2*maxImagePixels {
		return nil, errors.New("decompression bomb")
	}
	src, err := decodeFn(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}

	out := &decodedImage{}
	alpha := false
	gray16Clip := false
	switch format {
	case formatPNG:
		meta := parsePNGMeta(raw)
		alpha = meta.colorType == 4 || meta.colorType == 6
		gray16Clip = meta.colorType == 0 && meta.bitDepth == 16
		out.icc = meta.icc
		if !alpha {
			out.trns = pngTransparency(meta, src)
		}
	case formatJPEG:
		out.icc = jpegICC(raw)
	case formatWebP:
		var icc []byte
		alpha, icc = webpFeatures(raw)
		out.icc = icc
	case formatBMP:
		_, alpha = src.(*image.NRGBA)
	case formatTIFF:
		alpha = !opaque(src)
	}
	if _, ok := src.(*image.Gray16); ok {
		gray16Clip = true
	}
	switch img := src.(type) {
	case *image.YCbCr:
		if format == formatJPEG {
			out.raster = jpegYCbCrToRaster(img)
			return out, nil
		}
		if format == formatWebP {
			out.raster = webpYCbCrToRaster(img, nil, 0, alpha)
			return out, nil
		}
	case *image.NYCbCrA:
		if format == formatWebP {
			out.raster = webpYCbCrToRaster(&img.YCbCr, img.A, img.AStride, alpha)
			return out, nil
		}
	}
	out.raster = toRaster(src, alpha, gray16Clip)
	return out, nil
}

func opaque(img image.Image) bool {
	if o, ok := img.(interface{ Opaque() bool }); ok {
		return o.Opaque()
	}
	return false
}

func clip255(v uint32) uint8 {
	if v > 255 {
		return 255
	}
	return uint8(v)
}

// toRaster 把 Go 的解码结果转成非预乘的 RGBA 字节；alpha=false 时丢弃 alpha（Pillow convert("RGB")）。
func toRaster(src image.Image, alpha, gray16Clip bool) *raster {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	out := newRaster(w, h, alpha)
	pix := out.pix
	set := func(i int, r, g, bl, a uint8) {
		pix[i], pix[i+1], pix[i+2] = r, g, bl
		if alpha {
			pix[i+3] = a
		} else {
			pix[i+3] = 255
		}
	}
	switch img := src.(type) {
	case *image.NRGBA:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				s := row[x*4 : x*4+4]
				set((y*w+x)*4, s[0], s[1], s[2], s[3])
			}
		}
	case *image.NRGBA64:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				s := row[x*8 : x*8+8]
				r16 := uint32(s[0])<<8 | uint32(s[1])
				g16 := uint32(s[2])<<8 | uint32(s[3])
				b16 := uint32(s[4])<<8 | uint32(s[5])
				if gray16Clip {
					set((y*w+x)*4, clip255(r16), clip255(g16), clip255(b16), s[6])
				} else {
					set((y*w+x)*4, s[0], s[2], s[4], s[6])
				}
			}
		}
	case *image.RGBA:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				s := row[x*4 : x*4+4]
				c := color.NRGBAModel.Convert(color.RGBA{s[0], s[1], s[2], s[3]}).(color.NRGBA)
				set((y*w+x)*4, c.R, c.G, c.B, c.A)
			}
		}
	case *image.RGBA64:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				s := row[x*8 : x*8+8]
				c := color.NRGBA64Model.Convert(color.RGBA64{
					uint16(s[0])<<8 | uint16(s[1]), uint16(s[2])<<8 | uint16(s[3]),
					uint16(s[4])<<8 | uint16(s[5]), uint16(s[6])<<8 | uint16(s[7]),
				}).(color.NRGBA64)
				set((y*w+x)*4, uint8(c.R>>8), uint8(c.G>>8), uint8(c.B>>8), uint8(c.A>>8))
			}
		}
	case *image.Gray:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				v := row[x]
				set((y*w+x)*4, v, v, v, 255)
			}
		}
	case *image.Gray16:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				v16 := uint32(row[x*2])<<8 | uint32(row[x*2+1])
				var v uint8
				if gray16Clip {
					v = clip255(v16)
				} else {
					v = uint8(v16 >> 8)
				}
				set((y*w+x)*4, v, v, v, 255)
			}
		}
	case *image.Paletted:
		lut := make([]color.NRGBA, 256)
		for i := range lut {
			lut[i] = color.NRGBA{A: 255}
		}
		for i, c := range img.Palette {
			if i < 256 {
				lut[i] = color.NRGBAModel.Convert(c).(color.NRGBA)
			}
		}
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				c := lut[row[x]]
				set((y*w+x)*4, c.R, c.G, c.B, c.A)
			}
		}
	case *image.CMYK:
		for y := 0; y < h; y++ {
			row := img.Pix[img.PixOffset(b.Min.X, b.Min.Y+y):]
			for x := 0; x < w; x++ {
				s := row[x*4 : x*4+4]
				r, g, bl := cmykToRGB(s[0], s[1], s[2], s[3])
				set((y*w+x)*4, r, g, bl, 255)
			}
		}
	case *image.YCbCr:
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Src)
		for i := 0; i < w*h; i++ {
			set(i*4, dst.Pix[i*4], dst.Pix[i*4+1], dst.Pix[i*4+2], 255)
		}
	case *image.NYCbCrA:
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				c := img.NYCbCrAAt(b.Min.X+x, b.Min.Y+y)
				r, g, bl := color.YCbCrToRGB(c.Y, c.Cb, c.Cr)
				set((y*w+x)*4, r, g, bl, c.A)
			}
		}
	default:
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				c := color.NRGBAModel.Convert(src.At(b.Min.X+x, b.Min.Y+y)).(color.NRGBA)
				set((y*w+x)*4, c.R, c.G, c.B, c.A)
			}
		}
	}
	return out
}

// muldiv255 等价 Pillow 的 MULDIV255 宏（带舍入的 a*b/255）。
func muldiv255(a, b uint32) uint32 {
	tmp := a*b + 128
	return ((tmp >> 8) + tmp) >> 8
}

// cmykToRGB 等价 Pillow Convert.c 的 cmyk2rgb。
func cmykToRGB(c, m, y, k uint8) (uint8, uint8, uint8) {
	nk := 255 - uint32(k)
	conv := func(v uint8) uint8 {
		r := int32(nk) - int32(muldiv255(uint32(v), nk))
		if r < 0 {
			return 0
		}
		return uint8(r)
	}
	return conv(c), conv(m), conv(y)
}

// ---------------- PNG 元数据 ----------------

type pngMeta struct {
	colorType byte
	bitDepth  byte
	trns      []byte
	icc       []byte
}

// parsePNGMeta 读取 IDAT 之前的 IHDR / tRNS / iCCP（与 Pillow PngImagePlugin 读取 info 的范围一致）。
func parsePNGMeta(raw []byte) pngMeta {
	var meta pngMeta
	pos := 8
	for pos+8 <= len(raw) {
		length := int(binary.BigEndian.Uint32(raw[pos : pos+4]))
		typ := string(raw[pos+4 : pos+8])
		start := pos + 8
		end := start + length
		if length < 0 || end > len(raw) {
			break
		}
		data := raw[start:end]
		switch typ {
		case "IHDR":
			if len(data) >= 10 {
				meta.bitDepth = data[8]
				meta.colorType = data[9]
			}
		case "tRNS":
			meta.trns = append([]byte{}, data...)
		case "iCCP":
			if i := bytes.IndexByte(data, 0); i >= 0 && i+1 < len(data) && data[i+1] == 0 {
				if zr, err := zlib.NewReader(bytes.NewReader(data[i+2:])); err == nil {
					if profile, err := io.ReadAll(io.LimitReader(zr, 64<<20)); err == nil {
						meta.icc = profile
					}
					zr.Close()
				}
			}
		case "IDAT", "IEND":
			return meta
		}
		pos = end + 4
	}
	return meta
}

// pngTransparency 复刻 Pillow：P / L / RGB 图的 tRNS 在 convert("RGB") 后变成 RGB 透明色三元组。
func pngTransparency(meta pngMeta, src image.Image) []int {
	t := meta.trns
	if t == nil {
		return nil
	}
	switch meta.colorType {
	case 0: // 灰度：Pillow 记 i16(s)，再按模式换算成 RGB
		if len(t) < 2 {
			return nil
		}
		v := int(binary.BigEndian.Uint16(t))
		switch {
		case meta.bitDepth == 1:
			if v != 0 {
				v = 255
			}
		case meta.bitDepth == 16:
			if v > 255 {
				v = 255
			}
		}
		return []int{v, v, v}
	case 2: // RGB：原样记录 16 位值
		if len(t) < 6 {
			return nil
		}
		return []int{int(binary.BigEndian.Uint16(t)), int(binary.BigEndian.Uint16(t[2:])), int(binary.BigEndian.Uint16(t[4:]))}
	case 3: // 调色板：仅「恰好一个全透明、其余全不透明」时记成透明色索引（_simple_palette）
		zero := -1
		for i, a := range t {
			switch a {
			case 0:
				if zero >= 0 {
					return nil
				}
				zero = i
			case 255:
			default:
				return nil
			}
		}
		pal, ok := src.(*image.Paletted)
		if zero < 0 || !ok {
			return nil
		}
		c := color.NRGBA{}
		if zero < len(pal.Palette) {
			c = color.NRGBAModel.Convert(pal.Palette[zero]).(color.NRGBA)
		}
		return []int{int(c.R), int(c.G), int(c.B)}
	}
	return nil
}

// ---------------- JPEG ICC ----------------

// jpegICC 拼接 APP2 "ICC_PROFILE" 分段（与 Pillow JpegImagePlugin 的 icclist 处理一致）。
func jpegICC(raw []byte) []byte {
	var segments [][]byte
	pos := 2
	for pos+4 <= len(raw) {
		if raw[pos] != 0xFF {
			break
		}
		marker := raw[pos+1]
		if marker == 0xFF { // 填充字节
			pos++
			continue
		}
		if marker == 0xD8 || (marker >= 0xD0 && marker <= 0xD7) || marker == 0x01 {
			pos += 2
			continue
		}
		if marker == 0xDA || marker == 0xD9 { // SOS / EOI：之后是熵编码数据
			break
		}
		length := int(binary.BigEndian.Uint16(raw[pos+2 : pos+4]))
		if length < 2 || pos+2+length > len(raw) {
			break
		}
		payload := raw[pos+4 : pos+2+length]
		if marker == 0xE2 && len(payload) >= 14 && string(payload[:12]) == "ICC_PROFILE\x00" {
			segments = append(segments, payload)
		}
		pos += 2 + length
	}
	if len(segments) == 0 {
		return nil
	}
	sort.SliceStable(segments, func(i, j int) bool { return bytes.Compare(segments[i], segments[j]) < 0 })
	if int(segments[0][13]) != len(segments) {
		return nil
	}
	var profile []byte
	for _, s := range segments {
		profile = append(profile, s[14:]...)
	}
	return profile
}

// ---------------- WebP 特征 ----------------

// webpFeatures 返回 (has_alpha, ICC)：对应 libwebp WebPGetFeatures 与 Pillow 读取的 ICCP 块。
func webpFeatures(raw []byte) (bool, []byte) {
	if len(raw) < 20 {
		return false, nil
	}
	pos := 12
	first := true
	hasAlpha := false
	var icc []byte
	extended := false
	for pos+8 <= len(raw) {
		fourcc := string(raw[pos : pos+4])
		size := int(binary.LittleEndian.Uint32(raw[pos+4 : pos+8]))
		start := pos + 8
		end := start + size
		if size < 0 || end > len(raw) {
			end = len(raw)
		}
		data := raw[start:end]
		switch fourcc {
		case "VP8X":
			if first && len(data) >= 1 {
				extended = true
				hasAlpha = data[0]&0x10 != 0
			}
		case "VP8L":
			if !extended && len(data) >= 5 {
				bits := binary.LittleEndian.Uint32(data[1:5])
				hasAlpha = (bits>>28)&1 == 1
			}
		case "ICCP":
			if extended && icc == nil {
				icc = append([]byte{}, data...)
			}
		}
		first = false
		pos = start + size + size&1
	}
	return hasAlpha, icc
}
