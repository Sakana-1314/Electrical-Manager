package apperr

// 校验「错误码总表」docs/websites/pages/api-error-codes.md 与 Go 源码一致（取代原 Python 的 tests/test_error_code_docs.py）。
//
// 用 go/ast 扫描 server/internal 下全部非测试源码，收集对外错误码及其显式状态码：
//   - apperr.New("CODE", ...)（apperr 包内为 New(...)），链上的 .WithStatus(N) 视为显式状态码；
//   - 「错误码包装函数」：函数体内用自身参数调用 apperr.New(code, ...)（如 importfile.ValidateLength），
//     调用点在该参数位置传入的字符串字面量；包装函数内的 .WithStatus(N) 计为显式状态码；
//   - web.WriteErrorBody(c, N, "CODE", ...)；
//   - 动态码：同一赋值语句里 `code, ..., responseStatus = "CODE", ..., N`（AI 搜索按上游状态码映射）；
//   - 手写 JSON 里的 "code":"CODE"（MCP 鉴权失败）；
//   - defaultStatusByCode 的键与默认状态码。
//
// 断言：代码里出现的每个码都登记在文档里；文档里的码都真实存在；文档的 HTTP 列与「显式状态码，否则默认映射（未登记为 400）」一致。
// 异步任务记录里的 error_code（如 SERVER_RESTARTED）不是对外错误码，testhooks.go（仅契约测试注册）也不在扫描范围内。

import (
	"go/ast"
	"go/parser"
	"go/token"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

var (
	codeLiteralRe = regexp.MustCompile(`^[A-Z][A-Z0-9_]{2,}$`)
	inlineJSONRe  = regexp.MustCompile(`"code":\s*"([A-Z][A-Z0-9_]{2,})"`)
	docCodeRe     = regexp.MustCompile("`([A-Z][A-Z_]{2,})`")
	statusRe      = regexp.MustCompile(`\d{3}`)
)

// 文档里出现、但不是错误码的全大写词。
var docNonCodes = map[string]bool{"JPEG": true, "PNG": true, "WEBP": true, "UTF": true, "GBK": true}

// 已知的「文档有、Go 代码没有」的码（Go 与文档不一致，待文档清理；不改业务代码）：
var knownDocOnlyCodes = map[string]bool{}

func findRepoFile(t *testing.T, rel string) string {
	t.Helper()
	dir, _ := filepath.Abs(".")
	for {
		candidate := filepath.Join(dir, rel)
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Skipf("%s not found", rel)
		}
		dir = parent
	}
}

type codeScan struct {
	codes    map[string]bool
	explicit map[string]map[int]bool
	defaults map[string]int
}

func (s *codeScan) add(code string, status int) {
	s.codes[code] = true
	if status > 0 {
		if s.explicit[code] == nil {
			s.explicit[code] = map[int]bool{}
		}
		s.explicit[code][status] = true
	}
}

func stringLit(e ast.Expr) (string, bool) {
	lit, ok := e.(*ast.BasicLit)
	if !ok || lit.Kind != token.STRING {
		return "", false
	}
	v, err := strconv.Unquote(lit.Value)
	return v, err == nil
}

func intLit(e ast.Expr) int {
	lit, ok := e.(*ast.BasicLit)
	if !ok || lit.Kind != token.INT {
		return 0
	}
	n, _ := strconv.Atoi(lit.Value)
	return n
}

// calleeName 返回调用的函数名与包限定（apperr.New → ("apperr", "New")；bare New → ("", "New")）。
func calleeName(call *ast.CallExpr) (pkg, name string) {
	switch f := call.Fun.(type) {
	case *ast.Ident:
		return "", f.Name
	case *ast.SelectorExpr:
		if x, ok := f.X.(*ast.Ident); ok {
			return x.Name, f.Sel.Name
		}
		return "?", f.Sel.Name
	}
	return "?", ""
}

func isNewCall(call *ast.CallExpr, filePkg string) bool {
	pkg, name := calleeName(call)
	return name == "New" && (pkg == "apperr" || (pkg == "" && filePkg == "apperr"))
}

// baseOfChain 沿 x.WithDetails(...).WithStatus(...) 方法链找到最内层的调用。
func baseOfChain(e ast.Expr) *ast.CallExpr {
	for {
		call, ok := e.(*ast.CallExpr)
		if !ok {
			return nil
		}
		sel, ok := call.Fun.(*ast.SelectorExpr)
		if ok && (sel.Sel.Name == "WithStatus" || sel.Sel.Name == "WithDetails") {
			e = sel.X
			continue
		}
		return call
	}
}

type wrapper struct {
	argIndex int
	status   int
}

type parsedFile struct {
	pkg  string
	file *ast.File
}

func scanRuntimeCodes(t *testing.T) *codeScan {
	t.Helper()
	root := filepath.Dir(findRepoFile(t, "server/internal/apperr/apperr.go")) + "/.."
	fset := token.NewFileSet()
	var files []parsedFile
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		// testhooks.go 只在 APP_TEST_HOOKS=1 时注册（契约测试专用），其中的错误码不对外。
		if d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") || d.Name() == "testhooks.go" {
			return nil
		}
		f, err := parser.ParseFile(fset, path, nil, 0)
		if err != nil {
			return err
		}
		files = append(files, parsedFile{pkg: f.Name.Name, file: f})
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	scan := &codeScan{codes: map[string]bool{}, explicit: map[string]map[int]bool{}, defaults: map[string]int{}}

	// 第一遍：错误码包装函数（用自身参数作为 apperr.New 的错误码）。
	wrappers := map[string]wrapper{}
	for _, pf := range files {
		for _, decl := range pf.file.Decls {
			fn, ok := decl.(*ast.FuncDecl)
			if !ok || fn.Body == nil {
				continue
			}
			params := map[string]int{}
			index := 0
			for _, field := range fn.Type.Params.List {
				for _, name := range field.Names {
					params[name.Name] = index
					index++
				}
				if len(field.Names) == 0 {
					index++
				}
			}
			statusOf := map[*ast.CallExpr]int{}
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				if call, ok := n.(*ast.CallExpr); ok {
					if sel, ok := call.Fun.(*ast.SelectorExpr); ok && sel.Sel.Name == "WithStatus" && len(call.Args) == 1 {
						if base := baseOfChain(sel.X); base != nil {
							statusOf[base] = intLit(call.Args[0])
						}
					}
				}
				return true
			})
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				call, ok := n.(*ast.CallExpr)
				if !ok || !isNewCall(call, pf.pkg) || len(call.Args) == 0 {
					return true
				}
				if id, ok := call.Args[0].(*ast.Ident); ok {
					if i, ok := params[id.Name]; ok {
						wrappers[fn.Name.Name] = wrapper{argIndex: i, status: statusOf[call]}
					}
				}
				return true
			})
		}
	}

	// 第二遍：收集错误码。
	for _, pf := range files {
		ast.Inspect(pf.file, func(n ast.Node) bool {
			switch x := n.(type) {
			case *ast.CallExpr:
				pkg, name := calleeName(x)
				switch {
				case isNewCall(x, pf.pkg) && len(x.Args) > 0:
					if code, ok := stringLit(x.Args[0]); ok && codeLiteralRe.MatchString(code) {
						scan.add(code, 0)
					}
				case name == "WithStatus" && len(x.Args) == 1:
					sel := x.Fun.(*ast.SelectorExpr)
					if base := baseOfChain(sel.X); base != nil && isNewCall(base, pf.pkg) && len(base.Args) > 0 {
						if code, ok := stringLit(base.Args[0]); ok && codeLiteralRe.MatchString(code) {
							scan.add(code, intLit(x.Args[0]))
						}
					}
				case name == "WriteErrorBody" && (pkg == "web" || (pkg == "" && pf.pkg == "web")) && len(x.Args) >= 3:
					if code, ok := stringLit(x.Args[2]); ok && codeLiteralRe.MatchString(code) {
						scan.add(code, intLit(x.Args[1]))
					}
				default:
					if w, ok := wrappers[name]; ok && w.argIndex < len(x.Args) {
						if code, ok := stringLit(x.Args[w.argIndex]); ok && codeLiteralRe.MatchString(code) {
							scan.add(code, w.status)
						}
					}
				}
			case *ast.AssignStmt:
				codeIndex, statusIndex := -1, -1
				for i, lhs := range x.Lhs {
					if id, ok := lhs.(*ast.Ident); ok {
						switch id.Name {
						case "code":
							codeIndex = i
						case "status", "statusCode", "responseStatus":
							statusIndex = i
						}
					}
				}
				if codeIndex >= 0 && len(x.Rhs) == len(x.Lhs) {
					if code, ok := stringLit(x.Rhs[codeIndex]); ok && codeLiteralRe.MatchString(code) {
						status := 0
						if statusIndex >= 0 {
							status = intLit(x.Rhs[statusIndex])
						}
						scan.add(code, status)
					}
				}
			case *ast.BasicLit:
				if x.Kind == token.STRING {
					if v, err := strconv.Unquote(x.Value); err == nil {
						for _, m := range inlineJSONRe.FindAllStringSubmatch(v, -1) {
							scan.add(m[1], 0)
						}
					}
				}
			case *ast.ValueSpec:
				if pf.pkg == "apperr" && len(x.Names) == 1 && x.Names[0].Name == "defaultStatusByCode" && len(x.Values) == 1 {
					lit, _ := x.Values[0].(*ast.CompositeLit)
					if lit == nil {
						return true
					}
					for _, elt := range lit.Elts {
						kv := elt.(*ast.KeyValueExpr)
						code, _ := stringLit(kv.Key)
						scan.codes[code] = true
						scan.defaults[code] = intLit(kv.Value)
					}
				}
			}
			return true
		})
	}
	if len(scan.defaults) == 0 {
		t.Fatal("没有解析到 defaultStatusByCode")
	}
	return scan
}

func readErrorCodeDoc(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(findRepoFile(t, "docs/websites/pages/api-error-codes.md"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

// 文档里的 code 必须真的在代码里出现，避免写错名字或写已经不存在的码。
func TestDocumentedCodesExistInCode(t *testing.T) {
	scan := scanRuntimeCodes(t)
	var unknown []string
	seen := map[string]bool{}
	for _, m := range docCodeRe.FindAllStringSubmatch(readErrorCodeDoc(t), -1) {
		code := m[1]
		if seen[code] || docNonCodes[code] || scan.codes[code] || knownDocOnlyCodes[code] {
			continue
		}
		seen[code] = true
		unknown = append(unknown, code)
	}
	sort.Strings(unknown)
	if len(unknown) > 0 {
		t.Fatalf("api-error-codes.md 里出现代码中不存在的错误码：%v", unknown)
	}
}

// 代码里出现过的每个错误码，文档里必须能查到（漏登记会让 CI 失败）。
func TestEveryRuntimeCodeIsDocumented(t *testing.T) {
	scan := scanRuntimeCodes(t)
	doc := readErrorCodeDoc(t)
	var missing []string
	for code := range scan.codes {
		if !strings.Contains(doc, code) {
			missing = append(missing, code)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		t.Fatalf("以下错误码未登记到 api-error-codes.md：%v", missing)
	}
	if len(scan.codes) < 50 {
		t.Fatalf("只扫描到 %d 个错误码，扫描可能失效", len(scan.codes))
	}
}

// 文档里每个 code 的 HTTP 列，必须与显式指定（WithStatus / WriteErrorBody / 动态赋值）或默认映射一致。
func TestDocumentedStatusCodesMatchCode(t *testing.T) {
	scan := scanRuntimeCodes(t)
	checked := 0
	for _, line := range strings.Split(readErrorCodeDoc(t), "\n") {
		if !strings.HasPrefix(line, "| `") {
			continue
		}
		cells := strings.Split(strings.Trim(line, "|"), "|")
		if len(cells) < 2 {
			continue
		}
		statusCell := strings.TrimSpace(cells[1])
		if strings.Contains(statusCell, "透传") || strings.Contains(statusCell, "无固定") {
			continue // 状态码不固定的码在正文里单独说明，不参与比对
		}
		documented := map[int]bool{}
		for _, v := range statusRe.FindAllString(statusCell, -1) {
			n, _ := strconv.Atoi(v)
			documented[n] = true
		}
		for _, m := range docCodeRe.FindAllStringSubmatch(cells[0], -1) {
			code := m[1]
			expected := scan.explicit[code]
			if len(expected) == 0 {
				status, ok := scan.defaults[code]
				if !ok {
					status = 400
				}
				expected = map[int]bool{status: true}
			}
			if len(documented) == 0 {
				t.Errorf("%s 的 HTTP 列没有状态码：%s", code, line)
			} else if !reflect.DeepEqual(documented, expected) {
				t.Errorf("%s 文档写 %v，代码实际为 %v", code, keys(documented), keys(expected))
			}
			checked++
		}
	}
	if checked < 50 {
		t.Fatalf("只校验到 %d 个 code，文档解析可能失效", checked)
	}
}

func keys(m map[int]bool) []int {
	out := make([]int, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Ints(out)
	return out
}
