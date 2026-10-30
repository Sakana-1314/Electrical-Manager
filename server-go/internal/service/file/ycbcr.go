package file

import "image"

// YCbCr → RGB 的两套实现，分别复刻 Pillow 背后的 C 库，使解码像素尽量与 Pillow 一致：
//   - JPEG：libjpeg(-turbo) 的「fancy upsampling」（色度三角滤波插值）+ jdcolor.c 的定点转换表；
//   - WebP（有损）：libwebp 的 fancy upsampler + VP8YUVToRGB（BT.601 有限范围）。
// Go 标准库按最近邻取色度、按 JFIF 全范围换算，和 Pillow 的输出差异明显（WebP 尤甚）。

// ---------------- libjpeg ----------------

const (
	jpegScaleBits = 16
	jpegOneHalf   = 1 << (jpegScaleBits - 1)
)

func jpegFix(x float64) int32 { return int32(x*(1<<jpegScaleBits) + 0.5) }

var jpegCrR, jpegCbB, jpegCrG, jpegCbG [256]int32

func init() {
	for i := 0; i < 256; i++ {
		x := int32(i - 128)
		jpegCrR[i] = (jpegFix(1.40200)*x + jpegOneHalf) >> jpegScaleBits
		jpegCbB[i] = (jpegFix(1.77200)*x + jpegOneHalf) >> jpegScaleBits
		jpegCrG[i] = -jpegFix(0.71414) * x
		jpegCbG[i] = -jpegFix(0.34414)*x + jpegOneHalf
	}
}

func clampByte(v int32) uint8 {
	if v < 0 {
		return 0
	}
	if v > 255 {
		return 255
	}
	return uint8(v)
}

// jpegChromaUpsample 返回整幅的色度平面（与亮度同尺寸），按 libjpeg 的 h2v1 / h2v2 / h1v2 fancy upsampling；
// 其他采样比例（4:1:1 等）libjpeg 用整数倍复制，等价最近邻。
func jpegChromaUpsample(plane []uint8, stride, w, h int, ratio image.YCbCrSubsampleRatio) []uint8 {
	out := make([]uint8, w*h)
	cw, ch := w, h
	switch ratio {
	case image.YCbCrSubsampleRatio422:
		cw = (w + 1) / 2
	case image.YCbCrSubsampleRatio420:
		cw, ch = (w+1)/2, (h+1)/2
	case image.YCbCrSubsampleRatio440:
		ch = (h + 1) / 2
	case image.YCbCrSubsampleRatio411:
		cw = (w + 3) / 4
	case image.YCbCrSubsampleRatio410:
		cw, ch = (w+3)/4, (h+1)/2
	}
	at := func(cx, cy int) int32 {
		if cx < 0 {
			cx = 0
		} else if cx >= cw {
			cx = cw - 1
		}
		if cy < 0 {
			cy = 0
		} else if cy >= ch {
			cy = ch - 1
		}
		return int32(plane[cy*stride+cx])
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			var v int32
			switch ratio {
			case image.YCbCrSubsampleRatio444:
				v = at(x, y)
			case image.YCbCrSubsampleRatio422:
				c := x / 2
				if x%2 == 0 {
					v = (at(c, y)*3 + at(c-1, y) + 1) >> 2
				} else {
					v = (at(c, y)*3 + at(c+1, y) + 2) >> 2
				}
			case image.YCbCrSubsampleRatio440:
				r := y / 2
				if y%2 == 0 {
					v = (at(x, r)*3 + at(x, r-1) + 1) >> 2
				} else {
					v = (at(x, r)*3 + at(x, r+1) + 2) >> 2
				}
			case image.YCbCrSubsampleRatio420:
				r, c := y/2, x/2
				other := r - 1
				if y%2 == 1 {
					other = r + 1
				}
				this := at(c, r)*3 + at(c, other)
				if x%2 == 0 {
					last := at(c-1, r)*3 + at(c-1, other)
					v = (this*3 + last + 8) >> 4
				} else {
					next := at(c+1, r)*3 + at(c+1, other)
					v = (this*3 + next + 7) >> 4
				}
			case image.YCbCrSubsampleRatio411:
				v = at(x/4, y)
			case image.YCbCrSubsampleRatio410:
				v = at(x/4, y/2)
			}
			out[y*w+x] = uint8(v)
		}
	}
	return out
}

// jpegYCbCrToRaster 等价 libjpeg 解码输出 JCS_RGB（Pillow 的 JPEG 解码）。
func jpegYCbCrToRaster(img *image.YCbCr) *raster {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	cb := jpegChromaUpsample(img.Cb, img.CStride, w, h, img.SubsampleRatio)
	cr := jpegChromaUpsample(img.Cr, img.CStride, w, h, img.SubsampleRatio)
	out := newRaster(w, h, false)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			yy := int32(img.Y[y*img.YStride+x])
			cbv, crv := cb[y*w+x], cr[y*w+x]
			i := (y*w + x) * 4
			out.pix[i] = clampByte(yy + jpegCrR[crv])
			out.pix[i+1] = clampByte(yy + ((jpegCbG[cbv] + jpegCrG[crv]) >> jpegScaleBits))
			out.pix[i+2] = clampByte(yy + jpegCbB[cbv])
			out.pix[i+3] = 255
		}
	}
	return out
}

// ---------------- libwebp ----------------

const (
	yuvFix2  = 6
	yuvMask2 = (256 << yuvFix2) - 1
)

func multHi(v, coeff int32) int32 { return (v * coeff) >> 8 }

func vp8Clip8(v int32) uint8 {
	if v&^yuvMask2 == 0 {
		return uint8(v >> yuvFix2)
	}
	if v < 0 {
		return 0
	}
	return 255
}

func vp8YUVToRGB(y, u, v int32) (uint8, uint8, uint8) {
	return vp8Clip8(multHi(y, 19077) + multHi(v, 26149) - 14234),
		vp8Clip8(multHi(y, 19077) - multHi(u, 6419) - multHi(v, 13320) + 8708),
		vp8Clip8(multHi(y, 19077) + multHi(u, 33050) - 17685)
}

// webpChroma 计算亮度像素 (x, y) 处的色度值，复刻 libwebp UpsampleRgbaLinePair 的行对插值。
func webpChroma(plane []uint8, stride, w, h, x, y int) int32 {
	cw, ch := (w+1)/2, (h+1)/2
	sample := func(cx, cy int) int32 {
		if cy >= ch {
			cy = ch - 1
		}
		if cy < 0 {
			cy = 0
		}
		return int32(plane[cy*stride+cx])
	}
	// 偶数行（含第 0 行）：作为行对的下行，top=第 y/2-1 行色度、cur=第 y/2 行；
	// 奇数行：作为行对的上行，top=第 (y-1)/2 行、cur=第 (y+1)/2 行（越界时镜像为最后一行）。
	var topRow, curRow int
	bottom := y%2 == 0
	if bottom {
		topRow, curRow = y/2-1, y/2
		if topRow < 0 {
			topRow = 0
		}
	} else {
		topRow, curRow = (y-1)/2, (y+1)/2
	}
	near, far := topRow, curRow
	if bottom {
		near, far = curRow, topRow
	}
	lastPair := (w - 1) >> 1
	vertical := func(cx int) int32 {
		return (3*sample(cx, near) + sample(cx, far) + 2) >> 2
	}
	if x == 0 {
		return vertical(0)
	}
	k := (x + 1) / 2
	if k > lastPair { // 偶数宽度的最后一个像素
		return vertical(cw - 1)
	}
	tl, t := sample(k-1, topRow), sample(k, topRow)
	l, uv := sample(k-1, curRow), sample(k, curRow)
	avg := tl + t + l + uv + 8
	diag12 := (avg + 2*(t+l)) >> 3
	diag03 := (avg + 2*(tl+uv)) >> 3
	if x%2 == 1 {
		if bottom {
			return (diag03 + l) >> 1
		}
		return (diag12 + tl) >> 1
	}
	if bottom {
		return (diag12 + uv) >> 1
	}
	return (diag03 + t) >> 1
}

// webpYCbCrToRaster 等价 libwebp 解码输出 MODE_RGBA（Pillow 的 WebP 解码）；a 为 nil 表示无 alpha 平面。
func webpYCbCrToRaster(img *image.YCbCr, a []uint8, aStride int, alpha bool) *raster {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	out := newRaster(w, h, alpha)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			u := webpChroma(img.Cb, img.CStride, w, h, x, y)
			v := webpChroma(img.Cr, img.CStride, w, h, x, y)
			r, g, bl := vp8YUVToRGB(int32(img.Y[y*img.YStride+x]), u, v)
			i := (y*w + x) * 4
			out.pix[i], out.pix[i+1], out.pix[i+2] = r, g, bl
			out.pix[i+3] = 255
			if alpha && a != nil {
				out.pix[i+3] = a[y*aStride+x]
			}
		}
	}
	return out
}
