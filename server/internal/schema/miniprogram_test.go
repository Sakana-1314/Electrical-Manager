package schema

import "testing"

// 期望值取自 pydantic-core 2.50（TypeAdapter(UUID).validate_json）的实测输出。
func TestParseUUIDTextMatchesPydantic(t *testing.T) {
	const v = "0190a000-0000-7000-8000-000000000001"
	ok := map[string]string{
		v:                                      v,
		"0190a000000070008000000000000001":     v,
		"{" + v + "}":                          v,
		"urn:uuid:" + v:                        v,
		"0190A000-0000-7000-8000-000000000001": v,
	}
	for in, want := range ok {
		if got, msg := ParseUUIDText(in); got != want || msg != "" {
			t.Errorf("ParseUUIDText(%q) = %q, %q", in, got, msg)
		}
	}
	bad := map[string]string{
		"abc":                                    "invalid length: found 3",
		"":                                       "invalid length: found 0",
		"0190a000-0000-7000-8000-00000000000":    "invalid group length in group 4: expected 12, found 11",
		"0190a000-0000-7000-8000-0000000000001":  "invalid group length in group 4: expected 12, found 13",
		"URN:UUID:" + v:                          "invalid character: found `U` at 0",
		"0190a0000-000-7000-8000-000000000001":   "invalid group length in group 0: expected 8, found 9",
		"0190a000-0000-7000-8000-00000000000g":   "invalid character: found `g` at 35",
		"0190a000-0000-7000-8000-00000000000é":   "invalid character: found `é` at 35",
		"abc-def":                                "invalid group count: expected 5, found 2",
		"  " + v:                                 "invalid character: found ` ` at 0",
		"{abc}":                                  "invalid group count: expected 5, found 1",
		"urn:uuid:abc":                           "invalid group count: expected 5, found 1",
		"0190a000x0000-7000-8000-000000000001":   "invalid character: found `x` at 8",
		"{0190a000-0000-7000-8000-00000000000g}": "invalid character: found `g` at 35",
		"urn:uuid:0190a000-0000-7000-8000-00000000000g":  "invalid character: found `g` at 35",
		"{0190a000-0000-7000-8000-0000000000011}":        "invalid group length in group 4: expected 12, found 15",
		"urn:uuid:0190a000-0000-7000-8000-0000000000011": "invalid length: found 46",
		"{" + v:                                "invalid character: found `{` at 0",
		"0190a000--0000-7000-8000-00000000001": "invalid group count: expected 5, found 6",
		"{}":                                   "invalid group count: expected 5, found 1",
		"urn:uuid:0190a000-0000-7000-8000-00000000000":   "invalid group length in group 4: expected 12, found 20",
		"urn:uuid:0190a000000070008000000000000001":      "invalid group count: expected 5, found 1",
		"abcdefabcdefabcdefabcdefabcdefab0":              "invalid length: found 33",
		"0190a000-0000-7000-8000-000000000001012345678":  "invalid group length in group 4: expected 12, found 21",
		"0190a000-0000-7000-8000-0000000000010123456789": "invalid length: found 46",
		"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx":  "invalid character: found `x` at 0",
		"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":  "invalid length: found 45",
		"not-a-uuid": "invalid character: found `n` at 0",
	}
	for in, want := range bad {
		got, msg := ParseUUIDText(in)
		if got != "" || msg != "Input should be a valid UUID, "+want {
			t.Errorf("ParseUUIDText(%q) = %q, %q; want %q", in, got, msg, want)
		}
	}
}
