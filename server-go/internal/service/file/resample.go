package file

import (
	"math"
)

// Pillow 缩略图算法的移植：Image.thumbnail(size, LANCZOS) → Image.resize(reducing_gap=2.0)
// → Image.reduce（整数倍盒式缩小）+ ImagingResample（Lanczos 卷积，8 位定点）。
// 系数计算、定点精度、舍入与边界处理均按 Pillow 的 Resample.c / Reduce.c 实现，
// 以保证输出尺寸完全一致、像素值与 Pillow 逐位一致（同一输入）。

const (
	lanczosSupport = 3.0
	precisionBits  = 32 - 8 - 2
	reducingGap    = 2.0
)

func sincFilter(x float64) float64 {
	if x == 0.0 {
		return 1.0
	}
	x *= math.Pi
	return math.Sin(x) / x
}

func lanczosFilter(x float64) float64 {
	if -3.0 <= x && x < 3.0 {
		return sincFilter(x) * sincFilter(x/3)
	}
	return 0.0
}

// thumbnailSize 等价 Image.thumbnail 中的 preserve_aspect_ratio；返回 ok=false 表示无需缩放。
func thumbnailSize(w, h, size int) (int, int, bool) {
	x, y := size, size
	if x >= w && y >= h {
		return 0, 0, false
	}
	aspect := float64(w) / float64(h)
	roundAspect := func(number float64, key func(n int) float64) int {
		lo, hi := int(math.Floor(number)), int(math.Ceil(number))
		best := lo
		if key(hi) < key(lo) {
			best = hi
		}
		if best < 1 {
			best = 1
		}
		return best
	}
	if float64(x)/float64(y) >= aspect {
		yy := float64(y)
		x = roundAspect(yy*aspect, func(n int) float64 { return math.Abs(aspect - float64(n)/yy) })
	} else {
		xx := float64(x)
		y = roundAspect(xx/aspect, func(n int) float64 {
			if n == 0 {
				return 0
			}
			return math.Abs(aspect - xx/float64(n))
		})
	}
	return x, y, true
}

// thumbnail 等价 `image.thumbnail((size, size), Image.Resampling.LANCZOS)`（源图为 PNG，无 draft）。
func thumbnail(src *raster, size int) *raster {
	fw, fh, ok := thumbnailSize(src.w, src.h, size)
	if !ok || (fw == src.w && fh == src.h) {
		return src
	}
	gap := reducingGap
	return resizeImage(src, fw, fh, [4]float64{0, 0, float64(src.w), float64(src.h)}, &gap)
}

// resizeImage 等价 Image.resize(size, LANCZOS, box, reducing_gap)。
func resizeImage(im *raster, w, h int, box [4]float64, gap *float64) *raster {
	if im.w == w && im.h == h && box == [4]float64{0, 0, float64(im.w), float64(im.h)} {
		return im.clone()
	}
	if im.alpha {
		// RGBA → RGBa（预乘）→ resize（不带 reducing_gap）→ RGBA
		pre := premultiply(im)
		out := resizeImage(pre, w, h, box, nil)
		unpremultiply(out)
		out.alpha = true
		return out
	}
	if gap != nil {
		factorX := int((box[2] - box[0]) / float64(w) / *gap)
		if factorX == 0 {
			factorX = 1
		}
		factorY := int((box[3] - box[1]) / float64(h) / *gap)
		if factorY == 0 {
			factorY = 1
		}
		if factorX > 1 || factorY > 1 {
			rb := safeBox(im, w, h, box)
			im = reduceImage(im, factorX, factorY, rb)
			box = [4]float64{
				(box[0] - float64(rb[0])) / float64(factorX),
				(box[1] - float64(rb[1])) / float64(factorY),
				(box[2] - float64(rb[0])) / float64(factorX),
				(box[3] - float64(rb[1])) / float64(factorY),
			}
		}
	}
	if im.h > im.w*100 && h < im.h {
		tmp := imagingResize(im, im.w, h, [4]float64{0, box[1], float64(im.w), box[3]})
		return imagingResize(tmp, w, h, [4]float64{box[0], 0, box[2], float64(h)})
	}
	return imagingResize(im, w, h, box)
}

// safeBox 等价 Image._get_safe_box。
func safeBox(im *raster, w, h int, box [4]float64) [4]int {
	support := lanczosSupport - 0.5
	supportX := support * ((box[2] - box[0]) / float64(w))
	supportY := support * ((box[3] - box[1]) / float64(h))
	return [4]int{
		max(0, int(box[0]-supportX)),
		max(0, int(box[1]-supportY)),
		min(im.w, int(math.Ceil(box[2]+supportX))),
		min(im.h, int(math.Ceil(box[3]+supportY))),
	}
}

func (r *raster) clone() *raster {
	out := &raster{w: r.w, h: r.h, alpha: r.alpha, pix: make([]byte, len(r.pix))}
	copy(out.pix, r.pix)
	return out
}

// premultiply 等价 Pillow rgba2rgbA。
func premultiply(im *raster) *raster {
	out := &raster{w: im.w, h: im.h, alpha: false, pix: make([]byte, len(im.pix))}
	for i := 0; i < len(im.pix); i += 4 {
		a := uint32(im.pix[i+3])
		out.pix[i] = uint8(muldiv255(uint32(im.pix[i]), a))
		out.pix[i+1] = uint8(muldiv255(uint32(im.pix[i+1]), a))
		out.pix[i+2] = uint8(muldiv255(uint32(im.pix[i+2]), a))
		out.pix[i+3] = uint8(a)
	}
	// 预乘图按 4 通道参与卷积（含 alpha）：标记为 alpha 以保留第 4 通道。
	out.alpha = false
	out.keep4 = true
	return out
}

// unpremultiply 等价 Pillow rgbA2rgba。
func unpremultiply(im *raster) {
	for i := 0; i < len(im.pix); i += 4 {
		a := uint32(im.pix[i+3])
		if a == 255 || a == 0 {
			continue
		}
		for c := 0; c < 3; c++ {
			v := (255 * uint32(im.pix[i+c])) / a
			if v > 255 {
				v = 255
			}
			im.pix[i+c] = uint8(v)
		}
	}
	im.keep4 = false
}

// ---------------- reduce ----------------

func divisionUint32(divider int) uint32 {
	maxDividend := float32(uint32(1<<8) * uint32(divider))
	maxInt := float32(1<<30) * 4.0
	return uint32(maxInt / maxDividend)
}

func quantize(value, multiplier uint32) uint8 {
	return uint8((value * multiplier) >> 24)
}

// reduceImage 等价 Image.reduce((fx, fy), box)（Reduce.c：各规格的盒式平均 + 角落处理）。
func reduceImage(im *raster, fx, fy int, box [4]int) *raster {
	if fx == 1 && fy == 1 && box == [4]int{0, 0, im.w, im.h} {
		return im.clone()
	}
	bx, by, bw, bh := box[0], box[1], box[2]-box[0], box[3]-box[1]
	ow, oh := (bw+fx-1)/fx, (bh+fy-1)/fy
	out := &raster{w: ow, h: oh, alpha: im.alpha, keep4: im.keep4, pix: make([]byte, ow*oh*4)}
	channels := im.channels()
	block := func(ox, oy, x0, y0, xs, ys int) {
		n := xs * ys
		mult := divisionUint32(n)
		amend := uint32(n / 2)
		for c := 0; c < 4; c++ {
			if c >= channels {
				out.pix[(oy*ow+ox)*4+c] = 255
				continue
			}
			ss := amend
			for y := y0; y < y0+ys; y++ {
				row := y * im.w * 4
				for x := x0; x < x0+xs; x++ {
					ss += uint32(im.pix[row+x*4+c])
				}
			}
			out.pix[(oy*ow+ox)*4+c] = quantize(ss, mult)
		}
	}
	fullW, fullH := bw/fx, bh/fy
	for oy := 0; oy < fullH; oy++ {
		for ox := 0; ox < fullW; ox++ {
			block(ox, oy, bx+ox*fx, by+oy*fy, fx, fy)
		}
	}
	// ImagingReduceCorners：右侧不足一格的列、底部不足一格的行与右下角。
	if rx := bw % fx; rx != 0 {
		for oy := 0; oy < fullH; oy++ {
			block(fullW, oy, bx+fullW*fx, by+oy*fy, rx, fy)
		}
	}
	if ry := bh % fy; ry != 0 {
		for ox := 0; ox < fullW; ox++ {
			block(ox, fullH, bx+ox*fx, by+fullH*fy, fx, ry)
		}
	}
	if rx, ry := bw%fx, bh%fy; rx != 0 && ry != 0 {
		block(fullW, fullH, bx+fullW*fx, by+fullH*fy, rx, ry)
	}
	return out
}

// ---------------- ImagingResample（Lanczos，8 位） ----------------

func (r *raster) channels() int {
	if r.alpha || r.keep4 {
		return 4
	}
	return 3
}

type coeffs struct {
	ksize  int
	bounds []int // 每个输出像素：xmin, xmax（个数）
	kk     []int32
}

// precomputeCoeffs 等价 Resample.c precompute_coeffs + normalize_coeffs_8bpc。
func precomputeCoeffs(inSize int, in0, in1 float32, outSize int) coeffs {
	scale := float64(in1-in0) / float64(outSize)
	filterscale := scale
	if filterscale < 1.0 {
		filterscale = 1.0
	}
	support := lanczosSupport * filterscale
	ksize := int(math.Ceil(support))*2 + 1
	pre := make([]float64, outSize*ksize)
	bounds := make([]int, outSize*2)
	for xx := 0; xx < outSize; xx++ {
		center := float64(in0) + (float64(xx)+0.5)*scale
		ww := 0.0
		ss := 1.0 / filterscale
		xmin := int(center - support + 0.5)
		if xmin < 0 {
			xmin = 0
		}
		xmax := int(center + support + 0.5)
		if xmax > inSize {
			xmax = inSize
		}
		xmax -= xmin
		k := pre[xx*ksize : (xx+1)*ksize]
		for x := 0; x < xmax; x++ {
			w := lanczosFilter((float64(x+xmin) - center + 0.5) * ss)
			k[x] = w
			ww += w
		}
		for x := 0; x < xmax; x++ {
			if ww != 0.0 {
				k[x] /= ww
			}
		}
		bounds[xx*2] = xmin
		bounds[xx*2+1] = xmax
	}
	kk := make([]int32, len(pre))
	for i, v := range pre {
		if v < 0 {
			kk[i] = int32(-0.5 + v*float64(int(1)<<precisionBits))
		} else {
			kk[i] = int32(0.5 + v*float64(int(1)<<precisionBits))
		}
	}
	return coeffs{ksize: ksize, bounds: bounds, kk: kk}
}

func clip8(in int64) uint8 {
	v := in >> precisionBits
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return uint8(v)
}

// imagingResize 等价 _imaging.c 的 resize：整数且尺寸一致的 box 走裁剪，否则 ImagingResample。
func imagingResize(im *raster, w, h int, boxIn [4]float64) *raster {
	box := [4]float32{float32(boxIn[0]), float32(boxIn[1]), float32(boxIn[2]), float32(boxIn[3])}
	if box[0] == float32(int(box[0])) && box[1] == float32(int(box[1])) &&
		box[2]-box[0] == float32(w) && box[3]-box[1] == float32(h) {
		return crop(im, int(box[0]), int(box[1]), int(box[2]), int(box[3]))
	}
	return resampleInner(im, w, h, box)
}

func crop(im *raster, x0, y0, x1, y1 int) *raster {
	w, h := x1-x0, y1-y0
	out := &raster{w: w, h: h, alpha: im.alpha, keep4: im.keep4, pix: make([]byte, w*h*4)}
	for y := 0; y < h; y++ {
		sy := y0 + y
		for x := 0; x < w; x++ {
			sx := x0 + x
			if sx < 0 || sy < 0 || sx >= im.w || sy >= im.h {
				continue
			}
			copy(out.pix[(y*w+x)*4:(y*w+x)*4+4], im.pix[(sy*im.w+sx)*4:(sy*im.w+sx)*4+4])
		}
	}
	return out
}

func resampleInner(im *raster, xsize, ysize int, box [4]float32) *raster {
	needH := xsize != im.w || box[0] != 0 || box[2] != float32(xsize)
	needV := ysize != im.h || box[1] != 0 || box[3] != float32(ysize)
	horiz := precomputeCoeffs(im.w, box[0], box[2], xsize)
	vert := precomputeCoeffs(im.h, box[1], box[3], ysize)
	yFirst := vert.bounds[0]
	yLast := vert.bounds[ysize*2-2] + vert.bounds[ysize*2-1]
	out := im
	if needH {
		for i := 0; i < ysize; i++ {
			vert.bounds[i*2] -= yFirst
		}
		out = resampleHorizontal(im, xsize, yLast-yFirst, yFirst, horiz)
	}
	if needV {
		out = resampleVertical(out, ysize, vert)
	}
	if out == im {
		return im.clone()
	}
	return out
}

func resampleHorizontal(im *raster, xsize, ysize, offset int, c coeffs) *raster {
	out := &raster{w: xsize, h: ysize, alpha: im.alpha, keep4: im.keep4, pix: make([]byte, xsize*ysize*4)}
	channels := im.channels()
	half := int64(1) << (precisionBits - 1)
	for yy := 0; yy < ysize; yy++ {
		row := im.pix[(yy+offset)*im.w*4:]
		for xx := 0; xx < xsize; xx++ {
			xmin, xmax := c.bounds[xx*2], c.bounds[xx*2+1]
			k := c.kk[xx*c.ksize:]
			var ss [4]int64
			for ch := range ss {
				ss[ch] = half
			}
			for x := 0; x < xmax; x++ {
				p := row[(x+xmin)*4:]
				kv := int64(k[x])
				ss[0] += int64(p[0]) * kv
				ss[1] += int64(p[1]) * kv
				ss[2] += int64(p[2]) * kv
				ss[3] += int64(p[3]) * kv
			}
			o := out.pix[(yy*xsize+xx)*4:]
			o[0], o[1], o[2] = clip8(ss[0]), clip8(ss[1]), clip8(ss[2])
			if channels == 4 {
				o[3] = clip8(ss[3])
			} else {
				o[3] = 255
			}
		}
	}
	return out
}

func resampleVertical(im *raster, ysize int, c coeffs) *raster {
	xsize := im.w
	out := &raster{w: xsize, h: ysize, alpha: im.alpha, keep4: im.keep4, pix: make([]byte, xsize*ysize*4)}
	channels := im.channels()
	half := int64(1) << (precisionBits - 1)
	stride := im.w * 4
	for yy := 0; yy < ysize; yy++ {
		ymin, ymax := c.bounds[yy*2], c.bounds[yy*2+1]
		k := c.kk[yy*c.ksize:]
		for xx := 0; xx < xsize; xx++ {
			var ss [4]int64
			for ch := range ss {
				ss[ch] = half
			}
			for y := 0; y < ymax; y++ {
				p := im.pix[(y+ymin)*stride+xx*4:]
				kv := int64(k[y])
				ss[0] += int64(p[0]) * kv
				ss[1] += int64(p[1]) * kv
				ss[2] += int64(p[2]) * kv
				ss[3] += int64(p[3]) * kv
			}
			o := out.pix[(yy*xsize+xx)*4:]
			o[0], o[1], o[2] = clip8(ss[0]), clip8(ss[1]), clip8(ss[2])
			if channels == 4 {
				o[3] = clip8(ss[3])
			} else {
				o[3] = 255
			}
		}
	}
	return out
}
