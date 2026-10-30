package purchaserequest

import (
	"regexp"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

func TestUsageHashIsSHA256Prefix(t *testing.T) {
	if got := UsageHash("备件更换"); len(got) != 32 {
		t.Fatalf("len = %d", len(got))
	}
	// hashlib.sha256(b"").hexdigest()[:32]
	if got := UsageHash(""); got != "e3b0c44298fc1c149afbf4c8996fb924" {
		t.Fatalf("empty usage hash = %s", got)
	}
}

// QuantityText 复刻 format(value, "f").rstrip("0").rstrip(".") or "0"（含 Python 版对整数 Decimal 的同样行为）。
func TestQuantityText(t *testing.T) {
	cases := map[string]string{"10.0": "10", "2.5": "2.5", "0.0": "0", "100": "1", "3.50": "3.5"}
	for in, want := range cases {
		if got := QuantityText(jtype.MustDecimal(in)); got != want {
			t.Errorf("QuantityText(%s) = %q, want %q", in, got, want)
		}
	}
}

func TestDefaultPurchaseOrderNoFormat(t *testing.T) {
	if got := DefaultPurchaseOrderNo(); !regexp.MustCompile(`^申购 \d{4}/[1-9]\d?/[1-9]\d?$`).MatchString(got) {
		t.Fatalf("unexpected default order no %q", got)
	}
}
