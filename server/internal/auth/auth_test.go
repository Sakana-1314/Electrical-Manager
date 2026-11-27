package auth

import "testing"

func TestIsManagementTokenType(t *testing.T) {
	cases := []struct {
		name string
		tt   any
		want bool
	}{
		{name: "缺失 token_type（旧版管理端令牌）", tt: nil, want: true},
		{name: "management", tt: "management", want: true},
		{name: "management_access", tt: "management_access", want: true},
		{name: "mini_program（小程序令牌直连网页）", tt: "mini_program", want: true},
		{name: "management_refresh", tt: "management_refresh", want: false},
		{name: "mini_program_registration", tt: "mini_program_registration", want: false},
		{name: "非字符串", tt: 1, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isManagementTokenType(tc.tt); got != tc.want {
				t.Fatalf("isManagementTokenType(%v) = %v, want %v", tc.tt, got, tc.want)
			}
		})
	}
}
