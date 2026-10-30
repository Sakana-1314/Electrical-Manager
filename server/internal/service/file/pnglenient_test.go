package file

import (
	"encoding/base64"
	"testing"
)

// 测试用例里的「最小 PNG」：IDAT 有多余数据、校验和错误、IEND 不完整——Pillow 可以解码，这里也必须能。
func TestLenientPNGMatchesPillow(t *testing.T) {
	raw, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7gAAAABJRU5ErkJggg==")
	img, err := decodeImage(raw)
	if err != nil {
		t.Fatal(err)
	}
	if img == nil {
		t.Fatal("nil image")
	}
	_, w, h, err := ReencodePNG(raw)
	if err != nil || w != 1 || h != 1 {
		t.Fatalf("reencode: %d x %d %v", w, h, err)
	}
}
