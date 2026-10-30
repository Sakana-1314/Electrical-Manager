package file

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/png"
	"io"
)

// decodePNG 先按标准库严格解码；失败时（如 IDAT 解压后有多余数据——Pillow 会忽略）
// 按 Pillow 的宽容口径重建一份规整的 PNG 再解码。
func decodePNG(r io.Reader) (image.Image, error) {
	raw, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	img, err := png.Decode(bytes.NewReader(raw))
	if err == nil {
		return img, nil
	}
	fixed, ferr := normalizePNG(raw)
	if ferr != nil {
		return nil, err
	}
	return png.Decode(bytes.NewReader(fixed))
}

var pngSignature = []byte("\x89PNG\r\n\x1a\n")

// normalizePNG 合并 IDAT、截掉超出图像尺寸的解压数据（忽略校验和）并重新压缩、补齐 IEND（仅非隔行图像）。
func normalizePNG(raw []byte) ([]byte, error) {
	if len(raw) < 8 || !bytes.Equal(raw[:8], pngSignature) {
		return nil, errors.New("not png")
	}
	type chunk struct {
		typ  string
		data []byte
	}
	var chunks []chunk
	var idat []byte
	var ihdr []byte
	for pos := 8; pos+12 <= len(raw); {
		n := int(binary.BigEndian.Uint32(raw[pos:]))
		typ := string(raw[pos+4 : pos+8])
		if pos+12+n > len(raw) {
			return nil, errors.New("truncated chunk")
		}
		data := raw[pos+8 : pos+8+n]
		pos += 12 + n
		switch typ {
		case "IHDR":
			ihdr = data
			chunks = append(chunks, chunk{typ, data})
		case "IDAT":
			if idat == nil {
				chunks = append(chunks, chunk{typ: "IDAT"})
			}
			idat = append(idat, data...)
		default:
			chunks = append(chunks, chunk{typ, data})
		}
		if typ == "IEND" {
			break
		}
	}
	// 末尾 IEND 缺失或不完整（Pillow 读到图像数据即停止，不要求 IEND）时补上。
	if len(chunks) == 0 || chunks[len(chunks)-1].typ != "IEND" {
		chunks = append(chunks, chunk{typ: "IEND"})
	}
	if len(ihdr) != 13 || idat == nil || ihdr[12] != 0 {
		return nil, errors.New("unsupported png")
	}
	width := int(binary.BigEndian.Uint32(ihdr[0:]))
	height := int(binary.BigEndian.Uint32(ihdr[4:]))
	bitDepth, colorType := int(ihdr[8]), ihdr[9]
	channels := map[byte]int{0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colorType]
	if channels == 0 || width <= 0 || height <= 0 {
		return nil, errors.New("bad ihdr")
	}
	rowBytes := (width*channels*bitDepth + 7) / 8
	expected := height * (1 + rowBytes)
	zr, err := zlib.NewReader(bytes.NewReader(idat))
	if err != nil {
		return nil, err
	}
	pixels := make([]byte, expected)
	if _, err := io.ReadFull(zr, pixels); err != nil {
		return nil, err
	}
	var compressed bytes.Buffer
	zw := zlib.NewWriter(&compressed)
	_, _ = zw.Write(pixels)
	_ = zw.Close()

	var out bytes.Buffer
	out.Write(pngSignature)
	for _, c := range chunks {
		data := c.data
		if c.typ == "IDAT" {
			data = compressed.Bytes()
		}
		var hdr [8]byte
		binary.BigEndian.PutUint32(hdr[:4], uint32(len(data)))
		copy(hdr[4:], c.typ)
		out.Write(hdr[:])
		out.Write(data)
		crc := crc32.NewIEEE()
		crc.Write(hdr[4:])
		crc.Write(data)
		var sum [4]byte
		binary.BigEndian.PutUint32(sum[:], crc.Sum32())
		out.Write(sum[:])
	}
	return out.Bytes(), nil
}
