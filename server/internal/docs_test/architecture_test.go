// Package docs_test 校验「架构设计」文档 docs/websites/pages/dev-architecture.md 里与代码无关包的清单/计数
// （取代原 Python 的 tests/test_architecture_docs.py 中仍有意义的部分）：
//  1. 路由表必须与 web/src/router/index.ts 的 path 字面量双向一致；
//  2. stores / components / composables 的计数声明与文件数一致，且 api / components / composables / constants /
//     layouts / stores / types / utils 下每个非 *.spec.ts 文件至少被文档提到一次。
//
// 原测试里「server/app/ 的 Python 文件数、api/v1 / repositories / services 模块名单」只描述 Python 后端结构，已删除。
package docs_test

import (
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// 文档里按惯例不逐个点名的文件（确实与「当前实现说明」无关时放这里，并写清原因）。
var undocumentedAllowed = map[string]bool{}

var webInventoryDirs = []string{"api", "components", "composables", "constants", "layouts", "stores", "types", "utils"}

func repoRoot(t *testing.T) string {
	t.Helper()
	dir, _ := filepath.Abs(".")
	for {
		if _, err := os.Stat(filepath.Join(dir, "docs", "websites", "pages", "dev-architecture.md")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Skip("repository root not found")
		}
		dir = parent
	}
}

func read(t *testing.T, path string) string {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func specFreeFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range entries {
		name := e.Name()
		ext := filepath.Ext(name)
		if e.IsDir() || (ext != ".ts" && ext != ".vue") || strings.HasSuffix(name, ".spec.ts") ||
			name == "generated.raw.ts" || name == "generated.ts" {
			continue
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func TestDocumentedRoutesMatchRouter(t *testing.T) {
	root := repoRoot(t)
	text := read(t, filepath.Join(root, "docs", "websites", "pages", "dev-architecture.md"))
	_, after, ok := strings.Cut(text, "### 路由表")
	section, _, ok2 := strings.Cut(after, "### 状态管理")
	if !ok || !ok2 {
		t.Fatal("dev-architecture.md 缺少路由表小节")
	}
	rowRe := regexp.MustCompile("^\\| `(/[^`]*)`")
	documentedSet := map[string]bool{}
	for _, line := range strings.Split(section, "\n") {
		if m := rowRe.FindStringSubmatch(line); m != nil {
			documentedSet[m[1]] = true
		}
	}
	actualSet := map[string]bool{}
	router := read(t, filepath.Join(root, "web", "src", "router", "index.ts"))
	for _, m := range regexp.MustCompile(`path: '([^']+)'`).FindAllStringSubmatch(router, -1) {
		p := m[1]
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		actualSet[p] = true
	}
	documented, actual := sortedKeys(documentedSet), sortedKeys(actualSet)
	if len(actual) == 0 {
		t.Fatal("router/index.ts 里没有解析到任何路由")
	}
	if !reflect.DeepEqual(documented, actual) {
		t.Fatalf("路由表与 index.ts 不一致：文档多 %v，文档少 %v", diff(documentedSet, actualSet), diff(actualSet, documentedSet))
	}
}

func TestDocumentedFrontendInventoryMatchesCode(t *testing.T) {
	root := repoRoot(t)
	text := read(t, filepath.Join(root, "docs", "websites", "pages", "dev-architecture.md"))
	webSrc := filepath.Join(root, "web", "src")

	for _, tc := range []struct{ dir, pattern string }{
		{"stores", "`web/src/stores/` 下只有 (\\d+) 个 store"},
		{"components", "`web/src/components/` 下 (\\d+) 个 `\\.vue`"},
		{"composables", "`web/src/composables/` 下 (\\d+) 个 `\\.ts`"},
	} {
		m := regexp.MustCompile(tc.pattern).FindStringSubmatch(text)
		if m == nil {
			t.Errorf("dev-architecture.md 缺少 %s 的计数声明", tc.dir)
			continue
		}
		declared, _ := strconv.Atoi(m[1])
		if actual := len(specFreeFiles(t, filepath.Join(webSrc, tc.dir))); declared != actual {
			t.Errorf("文档写 %s 有 %d 个，实际 %d 个", tc.dir, declared, actual)
		}
	}

	missing := map[string][]string{}
	for _, dir := range webInventoryDirs {
		for _, name := range specFreeFiles(t, filepath.Join(webSrc, dir)) {
			if !strings.Contains(text, name) && !undocumentedAllowed[name] {
				missing[dir] = append(missing[dir], name)
			}
		}
	}
	if len(missing) > 0 {
		t.Fatalf("以下前端文件没有在 dev-architecture.md 里出现：%v", missing)
	}
}

func sortedKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func diff(a, b map[string]bool) []string {
	var out []string
	for k := range a {
		if !b[k] {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}
