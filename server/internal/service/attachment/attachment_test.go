package attachment

import (
	"testing"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// 对应 tests/test_attachment_cleanup.py 的纯函数用例。

func TestSecondsUntilTwoAM(t *testing.T) {
	sh := common.Shanghai
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

func TestPurgeScheduleHelpersAgree(t *testing.T) {
	sh := common.Shanghai
	now := time.Date(2026, 8, 10, 14, 0, 0, 0, sh)
	target := common.NextLocalHour(now, 2, false)
	if !target.Equal(time.Date(2026, 8, 11, 2, 0, 0, 0, sh)) {
		t.Fatalf("next = %v", target)
	}
	if common.SecondsUntilLocalHour(now, 2) != target.Sub(now) {
		t.Fatal("helpers disagree")
	}
	// inclusive：刚好落在整点上时取当下这一天，不顺延
	atTwo := time.Date(2026, 8, 10, 2, 0, 0, 0, sh)
	if !common.NextLocalHour(atTwo, 2, false).Equal(time.Date(2026, 8, 11, 2, 0, 0, 0, sh)) {
		t.Fatal("exclusive boundary")
	}
	if !common.NextLocalHour(atTwo, 2, true).Equal(atTwo) {
		t.Fatal("inclusive boundary")
	}
}
