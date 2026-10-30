package plancleanup

import (
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// 对应 tests/test_purchase_plan_cleanup.py::test_seconds_until_two_am。
func TestSecondsUntilTwoAM(t *testing.T) {
	sh := time.FixedZone("", 8*3600)
	cases := []struct {
		now  time.Time
		want time.Duration
	}{
		{time.Date(2026, 8, 10, 1, 30, 0, 0, sh), 1800 * time.Second},
		{time.Date(2026, 8, 10, 2, 0, 0, 0, sh), 86400 * time.Second},
		{time.Date(2026, 8, 10, 14, 0, 0, 0, sh), 43200 * time.Second},
	}
	for _, c := range cases {
		if got := SecondsUntilTwoAM(c.now); got != c.want {
			t.Errorf("SecondsUntilTwoAM(%v) = %v, want %v", c.now, got, c.want)
		}
	}
}

// 对应 test_shanghai_constant：上海时区固定 UTC+8；批大小与原版 _BATCH_SIZE 一致。
func TestShanghaiConstantAndBatchSize(t *testing.T) {
	if _, offset := time.Date(2026, 1, 1, 0, 0, 0, 0, common.Shanghai).Zone(); offset != 8*3600 {
		t.Fatalf("Shanghai offset = %d", offset)
	}
	if BatchSize != 50 {
		t.Fatalf("BatchSize = %d", BatchSize)
	}
}
