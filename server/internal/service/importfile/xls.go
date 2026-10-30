package importfile

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"strings"
	"time"
	"unicode/utf16"

	"github.com/richardlehane/mscfb"
	"golang.org/x/text/encoding"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/encoding/korean"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/encoding/traditionalchinese"
)

// 本文件复刻 xlrd 2.x 对 BIFF5/7/8（.xls）工作簿的读取（formatting_info=False）：
// 只读第一个工作表；数字 / RK → float；日期格式的数字 → datetime；文本 → str；
// 布尔 / 错误 → int；空白（BLANK / MULBLANK）不产生单元格（读取为 None）。

const (
	recBOF        = 0x0809
	recEOF        = 0x000A
	recSST        = 0x00FC
	recContinue   = 0x003C
	recFormat     = 0x041E
	recXF         = 0x00E0
	recBoundsheet = 0x0085
	recDatemode   = 0x0022
	recCodepage   = 0x0042
	recFilepass   = 0x002F
	recNumber     = 0x0203
	recRK         = 0x027E
	recMulRK      = 0x00BD
	recLabelSST   = 0x00FD
	recLabel      = 0x0204
	recRString    = 0x00D6
	recBoolErr    = 0x0205
	recString     = 0x0207
	recStringB2   = 0x0007
	recShrFmla    = 0x04BC
	recArray      = 0x0221
	recArray2     = 0x0021
	recTableOp    = 0x0236
	recTableOp2   = 0x0037
	recTableOpB2  = 0x0036
)

var oleSignature = []byte{0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1}

// xlsError 对应 xlrd.XLRDError（→ INVALID_EXCEL_FILE）。
type xlsError struct{ msg string }

func (e *xlsError) Error() string { return e.msg }

func readXLS(path string) ([][]any, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	rows, err := parseXLS(data)
	if err != nil {
		var xe *xlsError
		if errors.As(err, &xe) {
			return nil, invalidExcel()
		}
		return nil, err
	}
	return rows, nil
}

func parseXLS(data []byte) ([][]any, error) {
	if bytes.HasPrefix(data, []byte("PK\x03\x04")) {
		return nil, &xlsError{"Excel xlsx file; not supported"}
	}
	stream := data
	if bytes.HasPrefix(data, oleSignature) {
		s, err := oleWorkbookStream(data)
		if err != nil {
			return nil, err
		}
		stream = s
	}
	bk := &biffBook{data: stream}
	if err := bk.parseGlobals(); err != nil {
		return nil, err
	}
	if len(bk.sheetOffsets) == 0 {
		return nil, errors.New("list index out of range")
	}
	return bk.readSheet(bk.sheetOffsets[0])
}

func oleWorkbookStream(data []byte) ([]byte, error) {
	doc, err := mscfb.New(bytes.NewReader(data))
	if err != nil {
		return nil, &xlsError{"Unsupported format, or corrupt file: " + err.Error()}
	}
	streams := map[string][]byte{}
	for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
		if len(entry.Path) != 0 || entry.Size <= 0 {
			continue
		}
		name := entry.Name
		if name != "Workbook" && name != "Book" {
			continue
		}
		buf := make([]byte, entry.Size)
		if _, err := io.ReadFull(entry, buf); err != nil {
			return nil, &xlsError{"corrupt OLE2 stream: " + err.Error()}
		}
		streams[name] = buf
	}
	for _, name := range []string{"Workbook", "Book"} {
		if s, ok := streams[name]; ok {
			return s, nil
		}
	}
	return nil, &xlsError{"Can't find workbook in OLE2 compound document"}
}

type biffBook struct {
	data         []byte
	pos          int
	biffVersion  int
	codepage     int
	datemode     int
	sst          []string
	formatIsDate map[int]bool
	xfFormatKeys []int
	sheetOffsets []int
}

func (b *biffBook) record() (int, []byte, error) {
	if b.pos+4 > len(b.data) {
		return 0, nil, &xlsError{"unexpected end of BIFF stream"}
	}
	code := int(binary.LittleEndian.Uint16(b.data[b.pos:]))
	n := int(binary.LittleEndian.Uint16(b.data[b.pos+2:]))
	start := b.pos + 4
	if start+n > len(b.data) {
		return 0, nil, &xlsError{"truncated BIFF record"}
	}
	b.pos = start + n
	return code, b.data[start : start+n], nil
}

func (b *biffBook) peekCode() int {
	if b.pos+4 > len(b.data) {
		return -1
	}
	return int(binary.LittleEndian.Uint16(b.data[b.pos:]))
}

// xlrd fmt_code_ranges 中的日期类内置格式。
func stdFormatIsDate(key int) (isDate, known bool) {
	switch {
	case key == 0, key >= 1 && key <= 13, key >= 37 && key <= 44, key == 48, key == 49,
		key >= 59 && key <= 62, key >= 67 && key <= 70:
		return false, true
	case key >= 14 && key <= 22, key >= 27 && key <= 36, key >= 45 && key <= 47,
		key >= 50 && key <= 58, key >= 71 && key <= 81:
		return true, true
	}
	return false, false
}

func (b *biffBook) parseGlobals() error {
	code, data, err := b.record()
	if err != nil {
		return err
	}
	if code != recBOF || len(data) < 4 {
		return &xlsError{"Unsupported format, or corrupt file: Expected BOF record"}
	}
	switch binary.LittleEndian.Uint16(data) {
	case 0x0600:
		b.biffVersion = 80
	case 0x0500:
		b.biffVersion = 50
	default:
		return &xlsError{"Unsupported BIFF version"}
	}
	if binary.LittleEndian.Uint16(data[2:]) != 0x0005 {
		return &xlsError{"Unsupported format, or corrupt file: expected workbook globals BOF"}
	}
	b.formatIsDate = map[int]bool{}
	defined := map[int]bool{}
	for {
		code, data, err := b.record()
		if err != nil {
			return err
		}
		switch code {
		case recEOF:
			for key := 0; key <= 81; key++ {
				if defined[key] {
					continue
				}
				if isDate, known := stdFormatIsDate(key); known {
					b.formatIsDate[key] = isDate
				}
			}
			return nil
		case recFilepass:
			return &xlsError{"Workbook is encrypted"}
		case recCodepage:
			if len(data) >= 2 {
				b.codepage = int(binary.LittleEndian.Uint16(data))
			}
		case recDatemode:
			if len(data) >= 2 {
				b.datemode = int(binary.LittleEndian.Uint16(data))
			}
		case recFormat:
			if len(data) < 2 {
				return &xlsError{"bad FORMAT record"}
			}
			key := int(binary.LittleEndian.Uint16(data))
			var s string
			if b.biffVersion >= 80 {
				s, _, err = unpackUnicode(data, 2, 2)
			} else {
				s, err = b.unpackString(data, 2, 1)
			}
			if err != nil {
				return err
			}
			defined[key] = true
			b.formatIsDate[key] = isDateFormatString(s)
		case recXF:
			if len(data) < 4 {
				return &xlsError{"bad XF record"}
			}
			key := int(binary.LittleEndian.Uint16(data[2:]))
			b.xfFormatKeys = append(b.xfFormatKeys, key)
		case recBoundsheet:
			if len(data) < 6 {
				return &xlsError{"bad BOUNDSHEET record"}
			}
			offset := int(int32(binary.LittleEndian.Uint32(data)))
			sheetType := data[5]
			if sheetType == 0 {
				b.sheetOffsets = append(b.sheetOffsets, offset)
			}
		case recSST:
			chunks := [][]byte{data}
			for b.peekCode() == recContinue {
				_, d, err := b.record()
				if err != nil {
					return err
				}
				chunks = append(chunks, d)
			}
			sst, err := unpackSST(chunks)
			if err != nil {
				return err
			}
			b.sst = sst
		}
	}
}

func (b *biffBook) xfDate(xf int) bool {
	if xf < 0 || xf >= len(b.xfFormatKeys) {
		return false
	}
	return b.formatIsDate[b.xfFormatKeys[xf]]
}

// isDateFormatString 复刻 xlrd.formatting.is_date_format_string。
func isDateFormatString(f string) bool {
	state := 0
	var s strings.Builder
	for _, c := range f {
		switch state {
		case 0:
			switch {
			case c == '"':
				state = 1
			case strings.ContainsRune(`\_*`, c):
				state = 2
			case strings.ContainsRune("$-+/(): ", c):
			default:
				s.WriteRune(c)
			}
		case 1:
			if c == '"' {
				state = 0
			}
		case 2:
			state = 0
		}
	}
	// fmt_bracketed_sub：去掉 [ ... ]
	reduced := s.String()
	var r strings.Builder
	for i := 0; i < len(reduced); {
		if reduced[i] == '[' {
			if j := strings.IndexByte(reduced[i:], ']'); j >= 0 {
				i += j + 1
				continue
			}
		}
		r.WriteByte(reduced[i])
		i++
	}
	red := r.String()
	switch red {
	case "0.00E+00", "##0.0E+0", "General", "GENERAL", "general", "@":
		return false
	}
	dateCount, numCount := 0, 0
	for _, c := range red {
		switch {
		case strings.ContainsRune("ymdhsYMDHS", c):
			dateCount += 5
		case strings.ContainsRune("0#?", c):
			numCount += 5
		}
	}
	if dateCount > 0 && numCount == 0 {
		return true
	}
	if numCount > 0 && dateCount == 0 {
		return false
	}
	return dateCount > numCount
}

func latin1(b []byte) string {
	r := make([]rune, len(b))
	for i, c := range b {
		r[i] = rune(c)
	}
	return string(r)
}

func utf16le(b []byte) string {
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = binary.LittleEndian.Uint16(b[2*i:])
	}
	return string(utf16.Decode(u))
}

// unpackUnicode 复刻 xlrd.biffh.unpack_unicode_update_pos。
func unpackUnicode(data []byte, pos, lenlen int) (string, int, error) {
	if pos+lenlen > len(data) {
		return "", pos, &xlsError{"truncated unicode string"}
	}
	var n int
	if lenlen == 1 {
		n = int(data[pos])
	} else {
		n = int(binary.LittleEndian.Uint16(data[pos:]))
	}
	pos += lenlen
	if n == 0 {
		return "", pos, nil
	}
	if pos >= len(data) {
		return "", pos, &xlsError{"truncated unicode string"}
	}
	options := data[pos]
	pos++
	rt, phosz := 0, 0
	if options&0x08 != 0 {
		rt = int(binary.LittleEndian.Uint16(data[pos:]))
		pos += 2
	}
	if options&0x04 != 0 {
		phosz = int(int32(binary.LittleEndian.Uint32(data[pos:])))
		pos += 4
	}
	var s string
	if options&0x01 != 0 {
		end := min(pos+2*n, len(data))
		s = utf16le(data[pos:end])
		pos = end
	} else {
		end := min(pos+n, len(data))
		s = latin1(data[pos:end])
		pos = end
	}
	pos += 4*rt + phosz
	return s, pos, nil
}

func (b *biffBook) unpackString(data []byte, pos, lenlen int) (string, error) {
	if pos+lenlen > len(data) {
		return "", &xlsError{"truncated string"}
	}
	var n int
	if lenlen == 1 {
		n = int(data[pos])
	} else {
		n = int(binary.LittleEndian.Uint16(data[pos:]))
	}
	pos += lenlen
	end := min(pos+n, len(data))
	return decodeCodepage(data[pos:end], b.codepage)
}

func decodeCodepage(raw []byte, cp int) (string, error) {
	var enc encoding.Encoding
	switch cp {
	case 1200:
		return utf16le(raw), nil
	case 936:
		enc = simplifiedchinese.GBK
	case 950:
		enc = traditionalchinese.Big5
	case 932:
		enc = japanese.ShiftJIS
	case 949:
		enc = korean.EUCKR
	case 1250:
		enc = charmap.Windows1250
	case 1251:
		enc = charmap.Windows1251
	case 1253:
		enc = charmap.Windows1253
	case 1254:
		enc = charmap.Windows1254
	case 1255:
		enc = charmap.Windows1255
	case 1256:
		enc = charmap.Windows1256
	case 1257:
		enc = charmap.Windows1257
	case 1258:
		enc = charmap.Windows1258
	case 10000, 32768:
		enc = charmap.Macintosh
	default:
		enc = charmap.Windows1252
	}
	out, err := enc.NewDecoder().Bytes(raw)
	if err != nil {
		return "", &xlsError{"string decode error"}
	}
	return string(out), nil
}

// unpackSST 复刻 xlrd.book.unpack_SST_table（含 CONTINUE 分段与压缩标志切换）。
func unpackSST(chunks [][]byte) ([]string, error) {
	data := chunks[0]
	if len(data) < 8 {
		return nil, &xlsError{"bad SST record"}
	}
	nstrings := int(int32(binary.LittleEndian.Uint32(data[4:])))
	idx := 0
	pos := 8
	strs := make([]string, 0, max(nstrings, 0))
	need := func(n int) error {
		if pos+n > len(data) {
			return &xlsError{"truncated SST"}
		}
		return nil
	}
	for i := 0; i < nstrings; i++ {
		if err := need(3); err != nil {
			return nil, err
		}
		nchars := int(binary.LittleEndian.Uint16(data[pos:]))
		pos += 2
		options := data[pos]
		pos++
		rtcount, phosz := 0, 0
		if options&0x08 != 0 {
			if err := need(2); err != nil {
				return nil, err
			}
			rtcount = int(binary.LittleEndian.Uint16(data[pos:]))
			pos += 2
		}
		if options&0x04 != 0 {
			if err := need(4); err != nil {
				return nil, err
			}
			phosz = int(int32(binary.LittleEndian.Uint32(data[pos:])))
			pos += 4
		}
		var acc strings.Builder
		got := 0
		for {
			needChars := nchars - got
			var avail int
			if options&0x01 != 0 {
				avail = min((len(data)-pos)>>1, needChars)
				acc.WriteString(utf16le(data[pos : pos+2*avail]))
				pos += 2 * avail
			} else {
				avail = min(len(data)-pos, needChars)
				acc.WriteString(latin1(data[pos : pos+avail]))
				pos += avail
			}
			got += avail
			if got == nchars {
				break
			}
			idx++
			if idx >= len(chunks) || len(chunks[idx]) == 0 {
				return nil, &xlsError{"truncated SST"}
			}
			data = chunks[idx]
			options = data[0]
			pos = 1
		}
		for r := 0; r < rtcount; r++ {
			if pos == len(data) {
				pos = 0
				idx++
				if idx >= len(chunks) {
					return nil, &xlsError{"truncated SST"}
				}
				data = chunks[idx]
			}
			pos += 4
		}
		pos += phosz
		if pos >= len(data) {
			pos -= len(data)
			idx++
			if idx < len(chunks) {
				data = chunks[idx]
			} else {
				data = nil
			}
		}
		strs = append(strs, acc.String())
	}
	return strs, nil
}

const (
	ctEmpty = iota
	ctText
	ctNumber
	ctBool
	ctError
)

type xlsCell struct {
	typ   int
	value any
	xf    int
}

func unpackRK(rk []byte) float64 {
	flags := rk[0]
	if flags&2 != 0 {
		i := int32(binary.LittleEndian.Uint32(rk)) >> 2
		if flags&1 != 0 {
			return float64(i) / 100.0
		}
		return float64(i)
	}
	var buf [8]byte
	buf[4] = flags & 252
	copy(buf[5:], rk[1:4])
	d := math.Float64frombits(binary.LittleEndian.Uint64(buf[:]))
	if flags&1 != 0 {
		return d / 100.0
	}
	return d
}

func (b *biffBook) readSheet(offset int) ([][]any, error) {
	if offset < 0 || offset >= len(b.data) {
		return nil, &xlsError{"bad sheet offset"}
	}
	b.pos = offset
	code, data, err := b.record()
	if err != nil {
		return nil, err
	}
	if code != recBOF || len(data) < 4 {
		return nil, &xlsError{"Unsupported format, or corrupt file: Expected BOF record"}
	}
	type key struct{ r, c int }
	cells := map[key]xlsCell{}
	maxRow, maxCol := -1, -1
	put := func(r, c, typ int, v any, xf int) {
		cells[key{r, c}] = xlsCell{typ: typ, value: v, xf: xf}
		maxRow = max(maxRow, r)
		maxCol = max(maxCol, c)
	}
	u16 := func(d []byte, i int) int { return int(binary.LittleEndian.Uint16(d[i:])) }
	short := func(d []byte, n int) error {
		if len(d) < n {
			return fmt.Errorf("unpack requires a buffer of %d bytes", n)
		}
		return nil
	}
	for {
		code, data, err := b.record()
		if err != nil {
			return nil, err
		}
		switch code {
		case recEOF:
			rows := make([][]any, maxRow+1)
			for r := 0; r <= maxRow; r++ {
				row := make([]any, maxCol+1)
				for c := 0; c <= maxCol; c++ {
					cell, ok := cells[key{r, c}]
					if !ok {
						continue
					}
					if cell.typ == ctNumber && b.xfDate(cell.xf) {
						t, err := xldateAsDatetime(cell.value.(float64), b.datemode)
						if err != nil {
							return nil, err
						}
						row[c] = t
						continue
					}
					row[c] = cell.value
				}
				rows[r] = row
			}
			return rows, nil
		case recNumber:
			if err := short(data, 14); err != nil {
				return nil, err
			}
			put(u16(data, 0), u16(data, 2), ctNumber, math.Float64frombits(binary.LittleEndian.Uint64(data[6:14])), u16(data, 4))
		case recRK:
			if err := short(data, 10); err != nil {
				return nil, err
			}
			put(u16(data, 0), u16(data, 2), ctNumber, unpackRK(data[6:10]), u16(data, 4))
		case recMulRK:
			if err := short(data, 6); err != nil {
				return nil, err
			}
			row, first := u16(data, 0), u16(data, 2)
			last := u16(data, len(data)-2)
			p := 4
			for c := first; c <= last; c++ {
				if p+6 > len(data) {
					return nil, errors.New("truncated MULRK")
				}
				put(row, c, ctNumber, unpackRK(data[p+2:p+6]), u16(data, p))
				p += 6
			}
		case recLabelSST:
			if err := short(data, 10); err != nil {
				return nil, err
			}
			i := int(int32(binary.LittleEndian.Uint32(data[6:])))
			if i < 0 || i >= len(b.sst) {
				return nil, errors.New("list index out of range")
			}
			put(u16(data, 0), u16(data, 2), ctText, b.sst[i], u16(data, 4))
		case recLabel, recRString:
			if err := short(data, 8); err != nil {
				return nil, err
			}
			var s string
			if b.biffVersion >= 80 {
				s, _, err = unpackUnicode(data, 6, 2)
			} else {
				s, err = b.unpackString(data, 6, 2)
			}
			if err != nil {
				return nil, err
			}
			put(u16(data, 0), u16(data, 2), ctText, s, u16(data, 4))
		case recBoolErr:
			if err := short(data, 8); err != nil {
				return nil, err
			}
			typ := ctBool
			if data[7] != 0 {
				typ = ctError
			}
			put(u16(data, 0), u16(data, 2), typ, int64(data[6]), u16(data, 4))
		case 0x0006, 0x0206, 0x0406:
			if err := short(data, 16); err != nil {
				return nil, err
			}
			row, col, xf := u16(data, 0), u16(data, 2), u16(data, 4)
			result := data[6:14]
			if result[6] == 0xFF && result[7] == 0xFF {
				switch result[0] {
				case 0:
					s, err := b.formulaString()
					if err != nil {
						return nil, err
					}
					put(row, col, ctText, s, xf)
				case 1:
					put(row, col, ctBool, int64(result[2]), xf)
				case 2:
					put(row, col, ctError, int64(result[2]), xf)
				case 3:
					put(row, col, ctText, "", xf)
				default:
					return nil, &xlsError{fmt.Sprintf("unexpected special case (0x%02x) in FORMULA", result[0])}
				}
			} else {
				put(row, col, ctNumber, math.Float64frombits(binary.LittleEndian.Uint64(result)), xf)
			}
		}
	}
}

// formulaString 读取公式字符串结果（可选的 SHRFMLA / ARRAY / TABLEOP 之后的 STRING 记录）。
func (b *biffBook) formulaString() (string, error) {
	code, data, err := b.record()
	if err != nil {
		return "", err
	}
	if code != recString && code != recStringB2 {
		switch code {
		case recShrFmla, recArray, recArray2, recTableOp, recTableOp2, recTableOpB2:
		default:
			return "", &xlsError{fmt.Sprintf("Expected SHRFMLA, ARRAY, TABLEOP* or STRING record; found 0x%04x", code)}
		}
		code, data, err = b.record()
		if err != nil {
			return "", err
		}
		if code != recString && code != recStringB2 {
			return "", &xlsError{fmt.Sprintf("Expected STRING record; found 0x%04x", code)}
		}
	}
	return b.stringRecordContents(data)
}

func (b *biffBook) stringRecordContents(data []byte) (string, error) {
	if len(data) < 2 {
		return "", errors.New("unpack requires a buffer of 2 bytes")
	}
	expected := int(binary.LittleEndian.Uint16(data))
	offset := 2
	found := 0
	var result strings.Builder
	for {
		var chunk string
		if b.biffVersion >= 80 {
			if offset >= len(data) {
				if expected == 0 {
					return "", nil
				}
				return "", errors.New("index out of range")
			}
			if data[offset]&1 != 0 {
				chunk = utf16le(data[offset+1:])
			} else {
				chunk = latin1(data[offset+1:])
			}
		} else {
			s, err := decodeCodepage(data[offset:], b.codepage)
			if err != nil {
				return "", err
			}
			chunk = s
		}
		result.WriteString(chunk)
		found += len([]rune(chunk))
		if found == expected {
			return result.String(), nil
		}
		if found > expected {
			return "", &xlsError{fmt.Sprintf("STRING/CONTINUE: expected %d chars, found %d", expected, found)}
		}
		code, d, err := b.record()
		if err != nil {
			return "", err
		}
		if code != recContinue {
			return "", &xlsError{fmt.Sprintf("Expected CONTINUE record; found record-type 0x%04X", code)}
		}
		data = d
		offset = 0
	}
}

var (
	epoch1904      = time.Date(1904, 1, 1, 0, 0, 0, 0, time.UTC)
	epoch1900      = time.Date(1899, 12, 31, 0, 0, 0, 0, time.UTC)
	epoch1900Minus = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
)

// xldateAsDatetime 复刻 xlrd.xldate.xldate_as_datetime。
func xldateAsDatetime(x float64, datemode int) (time.Time, error) {
	if math.IsNaN(x) || math.IsInf(x, 0) || math.Abs(x) > 3e6 {
		return time.Time{}, errors.New("date value out of range")
	}
	epoch := epoch1904
	if datemode == 0 {
		if x < 60 {
			epoch = epoch1900
		} else {
			epoch = epoch1900Minus
		}
	}
	days := math.Trunc(x)
	fraction := x - days
	ms := int64(math.RoundToEven(fraction * 86400000.0))
	t := epoch.AddDate(0, 0, int(days)).Add(time.Duration(ms) * time.Millisecond)
	if t.Year() < 1 || t.Year() > 9999 {
		return time.Time{}, errors.New("date value out of range")
	}
	return t, nil
}
