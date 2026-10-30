package project

// 「已有数据的项目不能删除」的结构性保证（对应原 tests/test_project_scope_registry.py::test_delete_guard_counts_every_registered_table）：
// 删除前的存在性统计必须遍历 model.ProjectScopedTables 的每一张表（而不是只查主表），
// Delete 必须先拦默认项目、再统计数据，并把外键兜底的完整性错误也映射成 PROJECT_IN_USE。
// 清单本身是否完整由 internal/model 的 TestProjectScopedTablesMatchInitSQL 对照 init.sql 校验。

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
	"testing"
)

func funcSources(t *testing.T, path string) map[string]string {
	t.Helper()
	src, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, src, 0)
	if err != nil {
		t.Fatal(err)
	}
	out := map[string]string{}
	for _, decl := range file.Decls {
		if fn, ok := decl.(*ast.FuncDecl); ok && fn.Body != nil {
			out[fn.Name.Name] = string(src[fset.Position(fn.Body.Pos()).Offset:fset.Position(fn.Body.End()).Offset])
		}
	}
	return out
}

func TestDeleteGuardCountsEveryRegisteredTable(t *testing.T) {
	funcs := funcSources(t, "project.go")

	count := funcs["CountProjectRows"]
	for _, want := range []string{"range model.ProjectScopedTables", "WHERE project_id = ?"} {
		if !strings.Contains(count, want) {
			t.Errorf("CountProjectRows 缺少 %q：统计必须遍历全部项目域表并按 project_id 过滤", want)
		}
	}

	del := funcs["Delete"]
	for _, want := range []string{"CountProjectRows(", "PROJECT_IN_USE", "PROJECT_IS_DEFAULT", "db.IsIntegrity(err)"} {
		if !strings.Contains(del, want) {
			t.Errorf("Delete 缺少 %q（删除前统计 / 默认项目保护 / 外键兜底映射 PROJECT_IN_USE）", want)
		}
	}
	if i, j := strings.Index(del, "PROJECT_IS_DEFAULT"), strings.Index(del, "DELETE FROM project"); i < 0 || j < 0 || i > j {
		t.Error("默认项目校验必须发生在 DELETE 之前")
	}
}
