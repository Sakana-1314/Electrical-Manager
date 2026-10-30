package importfile

import (
	"bytes"
	"os"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

// readCSV 复刻 _read_csv：依次尝试 utf-8-sig、gb18030 解码，再按 csv.reader（excel 方言）解析。
func readCSV(path string) ([][]any, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	content, ok := decodeCSV(raw)
	if !ok {
		return nil, apperr.New("INVALID_CSV_FILE", "无法解析 CSV 文件编码，请使用 UTF-8 或 GBK 编码")
	}
	records := parsePyCSV(content)
	rows := make([][]any, len(records))
	for i, rec := range records {
		row := make([]any, len(rec))
		for j, v := range rec {
			row[j] = v
		}
		rows[i] = row
	}
	return rows, nil
}

// gb18030 对 U+FFFD 的编码：原文含它时解码出的 U+FFFD 不算解码失败。
var gb18030Replacement = []byte{0x84, 0x31, 0xA4, 0x37}

func decodeCSV(raw []byte) (string, bool) {
	if utf8.Valid(raw) {
		return strings.TrimPrefix(string(raw), string(rune(0xFEFF))), true
	}
	out, err := simplifiedchinese.GB18030.NewDecoder().Bytes(raw)
	if err != nil {
		return "", false
	}
	if bytes.ContainsRune(out, utf8.RuneError) && !bytes.Contains(raw, gb18030Replacement) {
		return "", false
	}
	return string(out), true
}

// splitUniversalLines 等价 StringIO(content, newline="") 的逐行迭代：按 \n、\r、\r\n 切分并保留行尾。
func splitUniversalLines(s string) []string {
	var lines []string
	start := 0
	for i := 0; i < len(s); i++ {
		switch s[i] {
		case '\n':
			lines = append(lines, s[start:i+1])
			start = i + 1
		case '\r':
			if i+1 < len(s) && s[i+1] == '\n' {
				i++
			}
			lines = append(lines, s[start:i+1])
			start = i + 1
		}
	}
	if start < len(s) {
		lines = append(lines, s[start:])
	}
	return lines
}

type csvState int

const (
	stStartRecord csvState = iota
	stStartField
	stInField
	stInQuotedField
	stQuoteInQuotedField
	stEatCRNL
)

// parsePyCSV 复刻 CPython _csv.reader 的状态机（delimiter=",", quotechar='"', doublequote=True,
// skipinitialspace=False, strict=False）：空行产出空记录，引号内可跨行。
func parsePyCSV(content string) [][]string {
	var records [][]string
	var fields []string
	var field []rune
	fieldLen := 0
	state := stStartRecord
	save := func() {
		fields = append(fields, string(field))
		field = field[:0]
		fieldLen = 0
	}
	add := func(r rune) {
		field = append(field, r)
		fieldLen++
	}
	const eol = rune(-1)
	process := func(c rune) {
		switch state {
		case stStartRecord:
			if c == eol {
				return
			}
			if c == '\n' || c == '\r' {
				state = stEatCRNL
				return
			}
			state = stStartField
			fallthrough
		case stStartField:
			switch {
			case c == '\n' || c == '\r' || c == eol:
				save()
				if c == eol {
					state = stStartRecord
				} else {
					state = stEatCRNL
				}
			case c == '"':
				state = stInQuotedField
			case c == ',':
				save()
			default:
				add(c)
				state = stInField
			}
		case stInField:
			switch {
			case c == '\n' || c == '\r' || c == eol:
				save()
				if c == eol {
					state = stStartRecord
				} else {
					state = stEatCRNL
				}
			case c == ',':
				save()
				state = stStartField
			default:
				add(c)
			}
		case stInQuotedField:
			switch {
			case c == eol:
			case c == '"':
				state = stQuoteInQuotedField
			default:
				add(c)
			}
		case stQuoteInQuotedField:
			switch {
			case c == '"':
				add(c)
				state = stInQuotedField
			case c == ',':
				save()
				state = stStartField
			case c == '\n' || c == '\r' || c == eol:
				save()
				if c == eol {
					state = stStartRecord
				} else {
					state = stEatCRNL
				}
			default:
				add(c)
				state = stInField
			}
		case stEatCRNL:
			if c == eol {
				state = stStartRecord
			}
			// 其他字符在 strict=False 下 CPython 会报错（new-line character seen in unquoted field）；
			// 由于按 universal newline 切行，行尾之后不会再出现字符，这里无需处理。
		}
	}
	lines := splitUniversalLines(content)
	li := 0
	for {
		fields = nil
		field = field[:0]
		fieldLen = 0
		state = stStartRecord
		for {
			if li >= len(lines) {
				if fieldLen != 0 || state == stInQuotedField {
					save()
					records = append(records, fields)
				}
				return records
			}
			for _, c := range lines[li] {
				process(c)
			}
			li++
			process(eol)
			if state == stStartRecord {
				break
			}
		}
		if fields == nil {
			fields = []string{}
		}
		records = append(records, fields)
	}
}
