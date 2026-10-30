package importfile

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"math"
	"math/big"
	"path"
	"strconv"
	"strings"
	"time"
)

// openpyxl.styles.numbers.BUILTIN_FORMATS（只含 openpyxl 认识的内置格式；其它内置编号视为无格式）。
var builtinFormats = map[int]string{
	0: "General", 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00",
	5: `"$"#,##0_);("$"#,##0)`, 6: `"$"#,##0_);[Red]("$"#,##0)`,
	7: `"$"#,##0.00_);("$"#,##0.00)`, 8: `"$"#,##0.00_);[Red]("$"#,##0.00)`,
	9: "0%", 10: "0.00%", 11: "0.00E+00", 12: "# ?/?", 13: "# ??/??",
	14: "mm-dd-yy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm AM/PM",
	19: "h:mm:ss AM/PM", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yy h:mm",
	37: "#,##0_);(#,##0)", 38: "#,##0_);[Red](#,##0)", 39: "#,##0.00_);(#,##0.00)",
	40: "#,##0.00_);[Red](#,##0.00)",
	41: `_(* #,##0_);_(* \(#,##0\);_(* "-"_);_(@_)`,
	42: `_("$"* #,##0_);_("$"* \(#,##0\);_("$"* "-"_);_(@_)`,
	43: `_(* #,##0.00_);_(* \(#,##0.00\);_(* "-"??_);_(@_)`,
	44: `_("$"* #,##0.00_)_("$"* \(#,##0.00\)_("$"* "-"??_)_(@_)`,
	45: "mm:ss", 46: "[h]:mm:ss", 47: "mmss.0", 48: "##0.0E+0", 49: "@",
}

// stripFormat 复刻 openpyxl STRIP_RE.sub("", fmt)：去掉 "引号文字" 与非时分秒的 [方括号] 段。
func stripFormat(f string) string {
	var b strings.Builder
	for i := 0; i < len(f); {
		c := f[i]
		if c == '"' {
			if j := strings.IndexByte(f[i+1:], '"'); j >= 0 && !strings.Contains(f[i+1:i+1+j], "\n") {
				i += j + 2
				continue
			}
		}
		if c == '[' {
			rest := f[i+1:]
			if !(hasBracketUnit(rest, 'h') || hasBracketUnit(rest, 'm') || hasBracketUnit(rest, 's')) {
				if j := strings.IndexByte(rest, ']'); j >= 0 {
					i += j + 2
					continue
				}
			}
		}
		b.WriteByte(c)
		i++
	}
	return b.String()
}

// hasBracketUnit 判断 rest 是否以 "x]" 或 "xx]" 开头（区分大小写）。
func hasBracketUnit(rest string, u byte) bool {
	if strings.HasPrefix(rest, string(u)+"]") {
		return true
	}
	return strings.HasPrefix(rest, string([]byte{u, u})+"]")
}

// isDateFormat 复刻 openpyxl.styles.numbers.is_date_format。
func isDateFormat(f string, ok bool) bool {
	if !ok {
		return false
	}
	f, _, _ = strings.Cut(f, ";")
	f = stripFormat(f)
	for i := 0; i < len(f); i++ {
		if strings.IndexByte("dmhysDMHYS", f[i]) >= 0 && (i == 0 || (f[i-1] != '_' && f[i-1] != '\\')) {
			return true
		}
	}
	return false
}

// isTimedeltaFormat 复刻 openpyxl.styles.numbers.is_timedelta_format。
func isTimedeltaFormat(f string, ok bool) bool {
	if !ok {
		return false
	}
	f, _, _ = strings.Cut(f, ";")
	l := strings.ToLower(f)
	for _, tok := range []string{"[h]", "[hh]", "[m]", "[mm]", "[s]", "[ss]"} {
		if strings.Contains(l, tok) {
			return true
		}
	}
	return false
}

type xlsxBook struct {
	zr             *zip.ReadCloser
	files          map[string]*zip.File
	sharedStrings  []string
	dateStyles     map[int]bool
	timedeltaStyle map[int]bool
	date1904       bool
	sheetPath      string
	sheetIsChart   bool
	activeMissing  bool
}

func readXLSX(p string) (rows [][]any, err error) {
	zr, err := zip.OpenReader(p)
	if err != nil {
		return nil, invalidExcel()
	}
	defer zr.Close()
	book := &xlsxBook{zr: zr, files: map[string]*zip.File{}}
	for _, f := range zr.File {
		book.files[f.Name] = f
	}
	if err := book.load(); err != nil {
		var inv *invalidErr
		if errors.As(err, &inv) {
			return nil, invalidExcel()
		}
		return nil, unknownExcel()
	}
	// 以下对应 workbook.active.iter_rows：出错按普通异常（导入任务记 INTERNAL_IMPORT_ERROR）。
	if book.activeMissing {
		return nil, errors.New("workbook has no active sheet")
	}
	if book.sheetIsChart {
		return nil, errors.New("active sheet is a chartsheet")
	}
	return book.readSheet()
}

type invalidErr struct{ msg string }

func (e *invalidErr) Error() string { return e.msg }

func (b *xlsxBook) open(name string) (io.ReadCloser, error) {
	f, ok := b.files[name]
	if !ok {
		return nil, fmt.Errorf("missing part %s", name)
	}
	return f.Open()
}

type rel struct{ id, typ, target string }

func (b *xlsxBook) readRels(name string) ([]rel, error) {
	rc, err := b.open(name)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	var out []rel
	dec := xml.NewDecoder(rc)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		if se, ok := tok.(xml.StartElement); ok && se.Name.Local == "Relationship" {
			out = append(out, rel{id: attr(se, "Id"), typ: attr(se, "Type"), target: attr(se, "Target")})
		}
	}
}

func attr(se xml.StartElement, local string) string {
	for _, a := range se.Attr {
		if a.Name.Local == local {
			return a.Value
		}
	}
	return ""
}

func attrNS(se xml.StartElement, local, spaceSuffix string) (string, bool) {
	for _, a := range se.Attr {
		if a.Name.Local == local && strings.HasSuffix(a.Name.Space, spaceSuffix) {
			return a.Value, true
		}
	}
	return "", false
}

func resolveTarget(base, target string) string {
	if strings.HasPrefix(target, "/") {
		return strings.TrimPrefix(target, "/")
	}
	return path.Clean(path.Join(path.Dir(base), target))
}

func xmlBool(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "on":
		return true
	}
	return false
}

func (b *xlsxBook) load() error {
	wbPath := "xl/workbook.xml"
	if rels, err := b.readRels("_rels/.rels"); err == nil {
		for _, r := range rels {
			if strings.HasSuffix(r.typ, "/officeDocument") {
				wbPath = resolveTarget("", r.target)
				break
			}
		}
	}
	if _, ok := b.files[wbPath]; !ok {
		return &invalidErr{"workbook part missing"}
	}
	relsPath := path.Join(path.Dir(wbPath), "_rels", path.Base(wbPath)+".rels")
	wbRels, err := b.readRels(relsPath)
	if err != nil {
		return err
	}
	relByID := map[string]rel{}
	stylesPath, sstPath := "", ""
	for _, r := range wbRels {
		r.target = resolveTarget(wbPath, r.target)
		relByID[r.id] = r
		switch {
		case strings.HasSuffix(r.typ, "/styles"):
			stylesPath = r.target
		case strings.HasSuffix(r.typ, "/sharedStrings"):
			sstPath = r.target
		}
	}
	// workbook.xml：sheets、bookViews/activeTab、workbookPr/date1904
	rc, err := b.open(wbPath)
	if err != nil {
		return err
	}
	type sheetRef struct{ rid string }
	var sheets []sheetRef
	active := -1
	dec := xml.NewDecoder(rc)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			rc.Close()
			return err
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		switch se.Name.Local {
		case "workbookPr":
			b.date1904 = xmlBool(attr(se, "date1904"))
		case "workbookView":
			if v := attr(se, "activeTab"); v != "" && active < 0 {
				n, err := strconv.Atoi(v)
				if err != nil {
					rc.Close()
					return err
				}
				active = n
			}
		case "sheet":
			rid, _ := attrNS(se, "id", "relationships")
			sheets = append(sheets, sheetRef{rid: rid})
		}
	}
	rc.Close()
	if active < 0 {
		active = 0
	}
	// read_worksheets：目标文件不存在的工作表被跳过（影响 active 索引）。
	type loaded struct {
		path  string
		chart bool
	}
	var valid []loaded
	for _, s := range sheets {
		r, ok := relByID[s.rid]
		if !ok {
			return fmt.Errorf("sheet relationship %s missing", s.rid)
		}
		if _, ok := b.files[r.target]; !ok {
			continue
		}
		valid = append(valid, loaded{path: r.target, chart: strings.Contains(r.typ, "chartsheet")})
	}
	if active >= len(valid) {
		b.activeMissing = true
	} else {
		b.sheetPath = valid[active].path
		b.sheetIsChart = valid[active].chart
	}
	if stylesPath != "" {
		if _, ok := b.files[stylesPath]; ok {
			if err := b.loadStyles(stylesPath); err != nil {
				return err
			}
		}
	}
	if sstPath != "" {
		if _, ok := b.files[sstPath]; ok {
			if err := b.loadSharedStrings(sstPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func (b *xlsxBook) loadStyles(name string) error {
	rc, err := b.open(name)
	if err != nil {
		return err
	}
	defer rc.Close()
	custom := map[int]string{}
	var xfFmt []int
	dec := xml.NewDecoder(rc)
	inCellXfs := false
	depth := 0
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			switch t.Name.Local {
			case "numFmt":
				id, err := strconv.Atoi(attr(t, "numFmtId"))
				if err != nil {
					return err
				}
				custom[id] = attr(t, "formatCode")
			case "cellXfs":
				inCellXfs = true
				depth = 0
			case "xf":
				if inCellXfs && depth == 0 {
					id := 0
					if v := attr(t, "numFmtId"); v != "" {
						n, err := strconv.Atoi(v)
						if err != nil {
							return err
						}
						id = n
					}
					xfFmt = append(xfFmt, id)
				}
				if inCellXfs {
					depth++
				}
			}
		case xml.EndElement:
			switch t.Name.Local {
			case "cellXfs":
				inCellXfs = false
			case "xf":
				if inCellXfs {
					depth--
				}
			}
		}
	}
	b.dateStyles = map[int]bool{}
	b.timedeltaStyle = map[int]bool{}
	for idx, id := range xfFmt {
		f, ok := custom[id]
		if !ok {
			f, ok = builtinFormats[id]
		}
		if isDateFormat(f, ok) {
			b.dateStyles[idx] = true
		}
		if isTimedeltaFormat(f, ok) {
			b.timedeltaStyle[idx] = true
		}
	}
	return nil
}

// richText 读取 CT_Rst（si / is）：t 直接子元素 + 每个 r 下的 t，忽略 rPh。
func richText(dec *xml.Decoder, start xml.StartElement) (string, error) {
	var b strings.Builder
	var stack []string
	for {
		tok, err := dec.Token()
		if err != nil {
			return "", err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			stack = append(stack, t.Name.Local)
			if t.Name.Local == "t" {
				keep := len(stack) == 1 || (len(stack) == 2 && stack[0] == "r")
				var text string
				if err := dec.DecodeElement(&text, &t); err != nil {
					return "", err
				}
				stack = stack[:len(stack)-1]
				if keep {
					b.WriteString(text)
				}
			}
		case xml.EndElement:
			if len(stack) == 0 {
				return b.String(), nil
			}
			stack = stack[:len(stack)-1]
		}
	}
}

func (b *xlsxBook) loadSharedStrings(name string) error {
	rc, err := b.open(name)
	if err != nil {
		return err
	}
	defer rc.Close()
	dec := xml.NewDecoder(rc)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if se, ok := tok.(xml.StartElement); ok && se.Name.Local == "si" {
			text, err := richText(dec, se)
			if err != nil {
				return err
			}
			b.sharedStrings = append(b.sharedStrings, strings.ReplaceAll(text, "x005F_", ""))
		}
	}
}

// colFromRef 解析单元格坐标 "B3" → (row 3, col 2)。
func coordinate(ref string) (row, col int, err error) {
	i := 0
	for i < len(ref) && ((ref[i] >= 'A' && ref[i] <= 'Z') || (ref[i] >= 'a' && ref[i] <= 'z')) {
		c := ref[i]
		if c >= 'a' {
			c -= 32
		}
		col = col*26 + int(c-'A'+1)
		i++
	}
	if i < len(ref) && ref[i] == '$' {
		i++
	}
	if i == 0 || i == len(ref) {
		return 0, 0, fmt.Errorf("invalid cell coordinates (%s)", ref)
	}
	row, err = strconv.Atoi(ref[i:])
	return row, col, err
}

// rangeBoundaries 复刻 openpyxl range_boundaries，返回 (min_col, min_row, max_col, max_row)，缺省为 0。
func rangeBoundaries(ref string) (int, int, int, int, bool) {
	ref = strings.ReplaceAll(strings.ToUpper(strings.TrimSpace(ref)), "$", "")
	parts := strings.Split(ref, ":")
	if len(parts) > 2 || ref == "" {
		return 0, 0, 0, 0, false
	}
	parse := func(s string) (col, row int, ok bool) {
		i := 0
		for i < len(s) && s[i] >= 'A' && s[i] <= 'Z' {
			col = col*26 + int(s[i]-'A'+1)
			i++
		}
		if i < len(s) {
			n, err := strconv.Atoi(s[i:])
			if err != nil {
				return 0, 0, false
			}
			row = n
		}
		return col, row, true
	}
	c1, r1, ok1 := parse(parts[0])
	c2, r2 := c1, r1
	ok2 := true
	if len(parts) == 2 {
		c2, r2, ok2 = parse(parts[1])
	}
	if !ok1 || !ok2 {
		return 0, 0, 0, 0, false
	}
	return c1, r1, c2, r2, true
}

type parsedCell struct {
	col   int
	value any
}

func (b *xlsxBook) readSheet() ([][]any, error) {
	rc, err := b.open(b.sheetPath)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	dec := xml.NewDecoder(rc)
	maxCol, maxRow := 0, 0
	seenData := false
	var rows [][]any
	counter, idx := 1, 1
	rowCounter := 0
	emptyRow := func() []any {
		if maxCol > 0 {
			return make([]any, maxCol)
		}
		return []any{}
	}
	stop := false
	for !stop {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		se, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		switch se.Name.Local {
		case "dimension":
			if !seenData {
				if _, _, c2, r2, ok := rangeBoundaries(attr(se, "ref")); ok {
					maxCol, maxRow = c2, r2
				}
			}
		case "sheetData":
			seenData = true
		case "row":
			if v := attr(se, "r"); v != "" {
				n, err := strconv.Atoi(v)
				if err != nil {
					f, ferr := strconv.ParseFloat(v, 64)
					if ferr != nil || f != math.Trunc(f) {
						return nil, fmt.Errorf("%s is not a valid row number", v)
					}
					n = int(f)
				}
				rowCounter = n
			} else {
				rowCounter++
			}
			cells, err := b.parseRow(dec, rowCounter)
			if err != nil {
				return nil, err
			}
			idx = rowCounter
			if maxRow > 0 && idx > maxRow {
				stop = true
				break
			}
			for ; counter < idx; counter++ {
				rows = append(rows, emptyRow())
			}
			if counter <= idx {
				rows = append(rows, buildRow(cells, maxCol))
				counter++
			}
		}
	}
	if maxRow > 0 && maxRow < idx {
		for ; counter <= maxRow; counter++ {
			rows = append(rows, emptyRow())
		}
	}
	return rows, nil
}

// buildRow 复刻 ReadOnlyWorksheet._get_row(values_only=True, min_col=1)。
func buildRow(cells []parsedCell, maxCol int) []any {
	if len(cells) == 0 && maxCol == 0 {
		return []any{}
	}
	width := maxCol
	if width == 0 {
		width = cells[len(cells)-1].col
	}
	if width < 0 {
		width = 0
	}
	out := make([]any, width)
	for _, c := range cells {
		if c.col >= 1 && c.col <= width {
			out[c.col-1] = c.value
		}
	}
	return out
}

func (b *xlsxBook) parseRow(dec *xml.Decoder, rowNo int) ([]parsedCell, error) {
	var cells []parsedCell
	colCounter := 0
	for {
		tok, err := dec.Token()
		if err != nil {
			return nil, err
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local != "c" {
				if err := dec.Skip(); err != nil {
					return nil, err
				}
				continue
			}
			cell, err := b.parseCell(dec, t, &colCounter)
			if err != nil {
				return nil, err
			}
			cells = append(cells, cell)
		case xml.EndElement:
			return cells, nil
		}
	}
}

func (b *xlsxBook) parseCell(dec *xml.Decoder, se xml.StartElement, colCounter *int) (parsedCell, error) {
	dataType := attr(se, "t")
	if dataType == "" {
		dataType = "n"
	}
	styleID := 0
	if v := attr(se, "s"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return parsedCell{}, err
		}
		styleID = n
	}
	var col int
	if ref := attr(se, "r"); ref != "" {
		_, c, err := coordinate(ref)
		if err != nil {
			return parsedCell{}, err
		}
		col = c
		*colCounter = c
	} else {
		*colCounter++
		col = *colCounter
	}
	var vText *string
	var inline *string
	for {
		tok, err := dec.Token()
		if err != nil {
			return parsedCell{}, err
		}
		if t, ok := tok.(xml.EndElement); ok && t.Name.Local == "c" {
			break
		}
		st, ok := tok.(xml.StartElement)
		if !ok {
			continue
		}
		switch st.Name.Local {
		case "v":
			var s string
			if err := dec.DecodeElement(&s, &st); err != nil {
				return parsedCell{}, err
			}
			if vText == nil {
				vText = &s
			}
		case "is":
			s, err := richText(dec, st)
			if err != nil {
				return parsedCell{}, err
			}
			if inline == nil {
				inline = &s
			}
		default:
			if err := dec.Skip(); err != nil {
				return parsedCell{}, err
			}
		}
	}
	var value any
	if dataType == "inlineStr" {
		if inline != nil {
			value = *inline
		}
		return parsedCell{col: col, value: value}, nil
	}
	if vText == nil || *vText == "" {
		return parsedCell{col: col, value: nil}, nil
	}
	raw := *vText
	switch dataType {
	case "n":
		num, err := castNumber(raw)
		if err != nil {
			return parsedCell{}, err
		}
		value = num
		if b.dateStyles[styleID] {
			value = b.fromExcel(num, b.timedeltaStyle[styleID])
		}
	case "s":
		i, err := strconv.Atoi(strings.TrimSpace(raw))
		if err != nil {
			return parsedCell{}, err
		}
		if i < 0 || i >= len(b.sharedStrings) {
			return parsedCell{}, fmt.Errorf("shared string index %d out of range", i)
		}
		value = b.sharedStrings[i]
	case "b":
		i, err := strconv.Atoi(strings.TrimSpace(raw))
		if err != nil {
			return parsedCell{}, err
		}
		value = i != 0
	case "d":
		t, err := fromISO8601(raw)
		if err != nil {
			return parsedCell{}, err
		}
		value = t
	default: // str / e / 其它：原样字符串
		value = raw
	}
	return parsedCell{col: col, value: value}, nil
}

// castNumber 复刻 openpyxl _cast_number：含 . / E / e 用 float，否则 int。
func castNumber(raw string) (any, error) {
	if strings.ContainsAny(raw, ".Ee") {
		s := strings.ReplaceAll(strings.TrimSpace(raw), "_", "")
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			var ne *strconv.NumError
			if errors.As(err, &ne) && errors.Is(ne.Err, strconv.ErrRange) {
				return f, nil
			}
			return nil, err
		}
		return f, nil
	}
	s := strings.ReplaceAll(strings.TrimSpace(raw), "_", "")
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return n, nil
	}
	if bi, ok := new(big.Int).SetString(s, 10); ok {
		return bi, nil
	}
	return nil, fmt.Errorf("invalid literal for int(): %q", raw)
}

func numFloat(v any) float64 {
	switch x := v.(type) {
	case int64:
		return float64(x)
	case float64:
		return x
	case *big.Int:
		f, _ := new(big.Float).SetInt(x).Float64()
		return f
	}
	return 0
}

var (
	windowsEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
	macEpoch     = time.Date(1904, 1, 1, 0, 0, 0, 0, time.UTC)
)

// fromExcel 复刻 openpyxl.utils.datetime.from_excel；超出日期范围返回 "#VALUE!"。
func (b *xlsxBook) fromExcel(num any, timedelta bool) any {
	value := numFloat(num)
	if math.IsInf(value, 0) || math.IsNaN(value) || math.Abs(value) > 3e6 {
		return "#VALUE!"
	}
	if timedelta {
		us := int64(math.RoundToEven(value * 86400e6))
		if us%1e6 != 0 {
			secs := math.Floor(value * 86400)
			ms := math.RoundToEven(float64(us-int64(secs)*1e6)/1e3) * 1e3
			us = int64(secs)*1e6 + int64(ms)
		}
		return time.Duration(us) * time.Microsecond
	}
	day := math.Floor(value)
	fraction := value - day
	ms := math.RoundToEven(fraction * 86400 * 1000)
	diff := time.Duration(ms) * time.Millisecond
	if value >= 0 && value < 1 && diff < 24*time.Hour {
		total := int64(ms)
		us := (total % 1000) * 1000
		secs := total / 1000
		return TimeOfDay{Hour: int(secs / 3600), Minute: int(secs % 3600 / 60), Second: int(secs % 60), Microsecond: int(us)}
	}
	epoch := windowsEpoch
	if b.date1904 {
		epoch = macEpoch
	}
	if value > 0 && value < 60 && !b.date1904 {
		day++
	}
	t := epoch.AddDate(0, 0, int(day)).Add(diff)
	if t.Year() < 1 || t.Year() > 9999 {
		return "#VALUE!"
	}
	return t
}

// fromISO8601 解析 t="d" 单元格（ISO 8601 日期时间）。
func fromISO8601(raw string) (any, error) {
	s := strings.TrimSuffix(strings.TrimSpace(raw), "Z")
	for _, layout := range []string{"2006-01-02T15:04:05.999999999", "2006-01-02T15:04:05", "2006-01-02T15:04"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	for _, layout := range []string{"15:04:05.999999999", "15:04:05", "15:04"} {
		if t, err := time.Parse(layout, s); err == nil {
			return TimeOfDay{Hour: t.Hour(), Minute: t.Minute(), Second: t.Second(), Microsecond: t.Nanosecond() / 1000}, nil
		}
	}
	return nil, fmt.Errorf("invalid ISO 8601 value %q", raw)
}
