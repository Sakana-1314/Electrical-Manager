package model

// 校验「数据模型」文档 docs/websites/pages/dev-data-model.md 与 init.sql / ProjectScopedTables 一致
// （取代原 Python 的 tests/test_data_model_docs.py）：
//  1. 文档里出现的约束名（uq_ / ix_ / fk_ / pk_ / ck_）必须在 init.sql 里真实存在；
//  2. 「共 N 张表」「项目域表（N 张）」「全局表（N 张」三处计数与两份名单，必须与 init.sql 和 ProjectScopedTables 一致。

import (
	"os"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

var (
	constraintNameRe = regexp.MustCompile(`(?:uq|ix|fk|pk|ck)_[a-z_0-9]+`)
	backtickNameRe   = regexp.MustCompile("`([a-z_0-9]+)`")
)

func readDataModelDoc(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(repoFile(t, "docs/websites/pages/dev-data-model.md"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func TestDocumentedConstraintNamesExistInInitSQL(t *testing.T) {
	sql := readInitSQL(t)
	documented := map[string]bool{}
	for _, name := range constraintNameRe.FindAllString(readDataModelDoc(t), -1) {
		documented[name] = true
	}
	if len(documented) == 0 {
		t.Fatal("dev-data-model.md 里没有引用任何约束名，解析可能失效")
	}
	var unknown []string
	for name := range documented {
		if !strings.Contains(sql, name) {
			unknown = append(unknown, name)
		}
	}
	sort.Strings(unknown)
	if len(unknown) > 0 {
		t.Fatalf("dev-data-model.md 引用了 init.sql 里不存在的约束名：%v；改库时请同步文档里的索引 / 外键名字", unknown)
	}
}

func mustCount(t *testing.T, doc, pattern string) int {
	t.Helper()
	m := regexp.MustCompile(pattern).FindStringSubmatch(doc)
	if m == nil {
		t.Fatalf("dev-data-model.md 找不到 %q", pattern)
	}
	n, _ := strconv.Atoi(m[1])
	return n
}

func backtickNames(section string) []string {
	set := map[string]bool{}
	for _, m := range backtickNameRe.FindAllStringSubmatch(section, -1) {
		set[m[1]] = true
	}
	out := make([]string, 0, len(set))
	for name := range set {
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

func between(t *testing.T, text, start, end string) string {
	t.Helper()
	_, after, ok := strings.Cut(text, start)
	if !ok {
		t.Fatalf("dev-data-model.md 缺少 %q", start)
	}
	before, _, ok := strings.Cut(after, end)
	if !ok {
		t.Fatalf("dev-data-model.md 中 %q 之后缺少 %q", start, end)
	}
	return before
}

func TestDocumentedTableCountsAndListsMatchSchema(t *testing.T) {
	doc := readDataModelDoc(t)
	blocks := tableBlocks(t, readInitSQL(t))

	declaredTotal := mustCount(t, doc, `共 \*\*(\d+) 张表\*\*`)
	declaredScoped := mustCount(t, doc, `### 项目域表（(\d+) 张）`)
	declaredGlobal := mustCount(t, doc, `### 全局表（(\d+) 张`)

	scoped := append([]string{}, ProjectScopedTables...)
	sort.Strings(scoped)
	scopedSet := map[string]bool{}
	for _, name := range scoped {
		scopedSet[name] = true
	}
	var global []string
	for name := range blocks {
		if !scopedSet[name] {
			global = append(global, name)
		}
	}
	sort.Strings(global)

	if declaredTotal != len(blocks) {
		t.Errorf("文档写共 %d 张表，init.sql 建了 %d 张", declaredTotal, len(blocks))
	}
	if declaredScoped != len(scoped) {
		t.Errorf("文档写项目域表 %d 张，ProjectScopedTables 有 %d 张", declaredScoped, len(scoped))
	}
	if declaredGlobal != len(global) {
		t.Errorf("文档写全局表 %d 张，实际 %d 张", declaredGlobal, len(global))
	}

	if got := backtickNames(between(t, doc, "### 项目域表（", "每张表都有")); !reflect.DeepEqual(got, scoped) {
		t.Errorf("项目域表名单不一致：\n文档: %v\n代码: %v", got, scoped)
	}
	// 全局表小节第一段是标题行剩余部分，第二段是表名清单，随后才是「不隔离的原因」表格。
	section := between(t, doc, "### 全局表（", "### 项目域唯一键")
	var paragraphs []string
	for _, part := range strings.Split(section, "\n\n") {
		if strings.TrimSpace(part) != "" {
			paragraphs = append(paragraphs, part)
		}
	}
	if len(paragraphs) < 2 {
		t.Fatal("全局表小节格式不符合预期")
	}
	if got := backtickNames(paragraphs[1]); !reflect.DeepEqual(got, global) {
		t.Errorf("全局表名单不一致：\n文档: %v\n代码: %v", got, global)
	}
}
