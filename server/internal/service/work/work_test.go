package work

// 对应原 tests/unit/test_work_service.py：半日占用判定、按天展开、参与人员规范化、查询参数解析。

import (
	"reflect"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
)

func d(s string) jtype.Date {
	v, err := jtype.ParseDate(s)
	if err != nil {
		panic(err)
	}
	return v
}

func rec(start, startHalf, end, endHalf string) *model.WorkRecord {
	return &model.WorkRecord{StartDate: d(start), StartHalf: startHalf, EndDate: d(end), EndHalf: endHalf}
}

func sp(s string) *string { return &s }

func TestSameDaySlots(t *testing.T) {
	whole := rec("2026-09-01", domain.HalfDayAM, "2026-09-01", domain.HalfDayPM)
	if m, a := OccupiedHalves(whole, d("2026-09-01")); !m || !a {
		t.Fatalf("whole day occupied = (%v, %v)", m, a)
	}
	if got := RecordSlots(whole, d("2026-09-01")); got != "全天" {
		t.Fatalf("whole slot = %q", got)
	}
	morning := rec("2026-09-01", domain.HalfDayAM, "2026-09-01", domain.HalfDayAM)
	if got := RecordSlots(morning, d("2026-09-01")); got != "上午" {
		t.Fatalf("morning slot = %q", got)
	}
	afternoon := rec("2026-09-01", domain.HalfDayPM, "2026-09-01", domain.HalfDayPM)
	if got := RecordSlots(afternoon, d("2026-09-01")); got != "下午" {
		t.Fatalf("afternoon slot = %q", got)
	}
	// 区间之外没有占用
	if m, a := OccupiedHalves(morning, d("2026-09-02")); m || a {
		t.Fatalf("outside occupied = (%v, %v)", m, a)
	}
	if got := RecordSlots(morning, d("2026-09-02")); got != "" {
		t.Fatalf("outside slot = %q", got)
	}
}

func TestMultiDaySlotsAndExpansion(t *testing.T) {
	r := rec("2026-09-01", domain.HalfDayPM, "2026-09-03", domain.HalfDayAM)
	for day, want := range map[string]string{"2026-09-01": "下午", "2026-09-02": "全天", "2026-09-03": "上午"} {
		if got := RecordSlots(r, d(day)); got != want {
			t.Fatalf("slot(%s) = %q, want %q", day, got, want)
		}
	}
	want := []DaySlot{{d("2026-09-01"), "下午"}, {d("2026-09-02"), "全天"}, {d("2026-09-03"), "上午"}}
	if got := RecordDays(r, d("2026-09-01"), d("2026-09-10")); !reflect.DeepEqual(got, want) {
		t.Fatalf("days = %v", got)
	}
	// 查询区间收窄后只展开落在区间内的天
	if got := RecordDays(r, d("2026-09-02"), d("2026-09-02")); !reflect.DeepEqual(got, []DaySlot{{d("2026-09-02"), "全天"}}) {
		t.Fatalf("clipped = %v", got)
	}
	// 跨月的连续记录：9/30 上午 → 10/02 下午
	cross := rec("2026-09-30", domain.HalfDayAM, "2026-10-02", domain.HalfDayPM)
	wantCross := []DaySlot{{d("2026-09-30"), "全天"}, {d("2026-10-01"), "全天"}, {d("2026-10-02"), "全天"}}
	if got := RecordDays(cross, d("2026-09-01"), d("2026-10-31")); !reflect.DeepEqual(got, wantCross) {
		t.Fatalf("cross month = %v", got)
	}
}

func TestParticipantsParsingAndFormatting(t *testing.T) {
	eq := func(got, want []string) {
		t.Helper()
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
	eq(ParseParticipants("李建军、王海涛"), []string{"李建军", "王海涛"})
	// 混合分隔符、重复姓名、多余空白都能规范化
	eq(ParseParticipants(" 李建军,王海涛; 李建军 |陈志远 "), []string{"李建军", "王海涛", "陈志远"})
	eq(ParseParticipants(""), []string{})
	if got := FormatParticipants([]string{"李建军", " 王海涛 ", "李建军", ""}); got != "李建军、王海涛" {
		t.Fatalf("format = %q", got)
	}
	// 写出去再读回来必须稳定
	eq(ParseParticipants(FormatParticipants([]string{"李建军", "王海涛"})), []string{"李建军", "王海涛"})
}

func TestQueryParamParsing(t *testing.T) {
	if got := ParseIDList(sp("3, 12,12,abc,0")); !reflect.DeepEqual(got, []int64{3, 12}) {
		t.Fatalf("ids = %v", got)
	}
	if got := ParseIDList(nil); len(got) != 0 {
		t.Fatalf("nil ids = %v", got)
	}
	if got := ParseNames(sp("李建军, 王海涛 ,李建军")); !reflect.DeepEqual(got, []string{"李建军", "王海涛"}) {
		t.Fatalf("names = %v", got)
	}
	if got := ParseNames(nil); len(got) != 0 {
		t.Fatalf("nil names = %v", got)
	}
	if got := ParseStatuses(sp("进行中,已完成,乱填")); !reflect.DeepEqual(got, []string{domain.WorkTaskInProgress, domain.WorkTaskDone}) {
		t.Fatalf("statuses = %v", got)
	}
	if got := ParseStatuses(nil); len(got) != 0 {
		t.Fatalf("nil statuses = %v", got)
	}
}

func TestParticipantNameKeywordIsOrSearch(t *testing.T) {
	cases := []struct {
		keyword *string
		want    bool
	}{
		{nil, true},
		{sp("王|李"), true},
		{sp("王|张"), false},
		// 全角竖线同样按「或」处理
		{sp("王｜李"), true},
	}
	for _, c := range cases {
		if got := matchesKeyword("李建军", c.keyword); got != c.want {
			t.Fatalf("matchesKeyword(%v) = %v, want %v", c.keyword, got, c.want)
		}
	}
}
