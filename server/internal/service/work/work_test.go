package work

// 工作管理纯逻辑：标签规范化 / 筛选解析 / 日期区间校验。

import (
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
)

func d(s string) jtype.Date {
	v, err := jtype.ParseDate(s)
	if err != nil {
		panic(err)
	}
	return v
}

func sp(s string) *string { return &s }

func TestNormalizeWorkTags(t *testing.T) {
	cases := map[string]string{
		"":                "",
		"安全":              "安全",
		"安全,检修":           "安全,检修",
		" 安全 ， 检修 ,, 安全 ": "安全,检修",
		"11月第一周,重点工作":     "11月第一周,重点工作",
	}
	for input, want := range cases {
		got, msg := schema.NormalizeWorkTags(input)
		if msg != "" {
			t.Fatalf("NormalizeWorkTags(%q) 报错：%s", input, msg)
		}
		if got != want {
			t.Fatalf("NormalizeWorkTags(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestNormalizeWorkTagsLimits(t *testing.T) {
	long := ""
	for i := 0; i < 21; i++ {
		if i > 0 {
			long += ","
		}
		long += "标签" + string(rune('A'+i))
	}
	if _, msg := schema.NormalizeWorkTags(long); msg == "" {
		t.Fatal("超过 20 个标签应报错")
	}
	name := ""
	for i := 0; i < 25; i++ {
		name += "字"
	}
	if _, msg := schema.NormalizeWorkTags(name); msg == "" {
		t.Fatal("单标签超过 24 字应报错")
	}
}

func TestValidateDateRange(t *testing.T) {
	start, end := d("2026-09-10"), d("2026-09-01")
	if err := ValidateDateRange(nil, nil); err != nil {
		t.Fatalf("两端都空应允许：%v", err)
	}
	if err := ValidateDateRange(&start, nil); err != nil {
		t.Fatalf("只填开始应允许：%v", err)
	}
	if err := ValidateDateRange(nil, &end); err != nil {
		t.Fatalf("只填完成应允许：%v", err)
	}
	if err := ValidateDateRange(&start, &end); err == nil {
		t.Fatal("完成早于开始应报 WORK_DATE_RANGE")
	}
	before, after := d("2026-09-01"), d("2026-09-10")
	if err := ValidateDateRange(&before, &after); err != nil {
		t.Fatalf("正常区间不应报错：%v", err)
	}
}

func TestParseDoneFilter(t *testing.T) {
	if got := ParseDoneFilter(nil); got != nil {
		t.Fatalf("空参数应不限，实际 %v", *got)
	}
	if got := ParseDoneFilter(sp("已完成")); got == nil || !*got {
		t.Fatalf("已完成 = %v", got)
	}
	if got := ParseDoneFilter(sp("未完成")); got == nil || *got {
		t.Fatalf("未完成 = %v", got)
	}
	if got := ParseDoneFilter(sp("已完成,未完成")); got != nil {
		t.Fatalf("两个都传应不限，实际 %v", *got)
	}
	if got := ParseDoneFilter(sp("胡说")); got != nil {
		t.Fatalf("非法值应不限，实际 %v", *got)
	}
}

func TestParseTags(t *testing.T) {
	if got := ParseTags(nil); len(got) != 0 {
		t.Fatalf("空参数 = %v", got)
	}
	got := ParseTags(sp("安全,检修，安全"))
	if len(got) != 2 || got[0] != "安全" || got[1] != "检修" {
		t.Fatalf("标签解析 = %v", got)
	}
}
