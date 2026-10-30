package config

// 对应原 Python 的 tests/test_excel_export_service.py::test_default_template_directory_is_inside_backend_code
// 与 tests/test_init_sql.py::test_excel_templates_are_json_specs_not_binary_workbooks：
// 默认模板目录是服务端代码内的 templates/，且其中只有三份 JSON 模板规格（不提交二进制工作簿）。

import (
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"testing"
)

func TestDefaultTemplateDirectoryIsInsideServerCode(t *testing.T) {
	serverDir, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	prev := *S
	t.Cleanup(func() { *S = prev })
	t.Setenv("APP_BASE_DIR", serverDir)
	if v, ok := os.LookupEnv("APP_TEMPLATE_DIR"); ok {
		t.Cleanup(func() { os.Setenv("APP_TEMPLATE_DIR", v) })
		os.Unsetenv("APP_TEMPLATE_DIR")
	}
	if _, err := os.Stat(filepath.Join(serverDir, ".env")); err == nil {
		t.Skip("server/.env 存在，可能覆盖默认值")
	}
	t.Setenv("APP_JWT_SECRET", "test-secret-that-is-long-enough-123456")

	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if want := filepath.Join(serverDir, "templates"); s.TemplateDir != want {
		t.Fatalf("TemplateDir = %s, want %s", s.TemplateDir, want)
	}
}

func TestExcelTemplatesAreJSONSpecsNotBinaryWorkbooks(t *testing.T) {
	entries, err := os.ReadDir("../../templates")
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	want := []string{"material-code-application.json", "purchase-application.json", "purchase-approval.json"}
	if !reflect.DeepEqual(names, want) {
		t.Fatalf("templates/ = %v, want %v", names, want)
	}
}
