package common

// 对应原 Python 的 tests/test_search.py：OR 关键词按 | / ｜ 拆分、去空白、去重并保持顺序。

import (
	"reflect"
	"testing"
)

func TestSplitOrSearchTermsNormalizesDelimitersAndEmptyItems(t *testing.T) {
	ptr := func(s string) *string { return &s }
	cases := []struct {
		in   *string
		want []string
	}{
		{ptr(" 断路器||接触器｜断路器| "), []string{"断路器", "接触器"}},
		{nil, nil},
		{ptr("｜ |"), nil},
	}
	for _, tc := range cases {
		if got := SplitOrSearchTerms(tc.in); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("SplitOrSearchTerms(%v) = %#v, want %#v", tc.in, got, tc.want)
		}
	}
}

func TestContainsAnyBuildsEscapedOrCondition(t *testing.T) {
	value := "a%b|c_d"
	clause, args := ContainsAny([]string{"name", "model_spec"}, &value)
	want := "(name LIKE ? ESCAPE '/' OR model_spec LIKE ? ESCAPE '/' OR name LIKE ? ESCAPE '/' OR model_spec LIKE ? ESCAPE '/')"
	if clause != want {
		t.Fatalf("clause = %s", clause)
	}
	if !reflect.DeepEqual(args, []any{"%a/%b%", "%a/%b%", "%c/_d%", "%c/_d%"}) {
		t.Fatalf("args = %v", args)
	}
	empty := " | "
	if clause, args := ContainsAny([]string{"name"}, &empty); clause != "" || args != nil {
		t.Fatalf("empty terms should produce no condition: %q %v", clause, args)
	}
}
