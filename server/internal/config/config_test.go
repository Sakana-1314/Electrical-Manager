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

// preparePreviewEnv 在临时目录下准备配置环境，避免读到仓库里的 server/.env。
func preparePreviewEnv(t *testing.T) string {
	t.Helper()
	prev := *S
	t.Cleanup(func() { *S = prev })
	base := t.TempDir()
	t.Setenv("APP_BASE_DIR", base)
	t.Setenv("APP_JWT_SECRET", "test-secret-that-is-long-enough-123456")
	for _, key := range []string{"APP_PREVIEW_CACHE_DIR", "APP_PREVIEW_CONCURRENCY"} {
		if v, ok := os.LookupEnv(key); ok {
			t.Cleanup(func() { os.Setenv(key, v) })
			os.Unsetenv(key)
		}
	}
	return base
}

func TestPreviewSettingsDefaults(t *testing.T) {
	base := preparePreviewEnv(t)
	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if s.PreviewConcurrency != 6 {
		t.Fatalf("PreviewConcurrency = %d, want 6", s.PreviewConcurrency)
	}
	want := filepath.Join(base, "data", "preview-cache")
	if s.PreviewCacheDir != want {
		t.Fatalf("PreviewCacheDir = %s, want %s", s.PreviewCacheDir, want)
	}
}

func TestPreviewSettingsFromEnv(t *testing.T) {
	preparePreviewEnv(t)
	t.Setenv("APP_PREVIEW_CONCURRENCY", "3")
	t.Setenv("APP_PREVIEW_CACHE_DIR", filepath.Join("tmp", "previews"))
	s, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if s.PreviewConcurrency != 3 {
		t.Fatalf("PreviewConcurrency = %d, want 3", s.PreviewConcurrency)
	}
	if want := filepath.Join("tmp", "previews"); s.PreviewCacheDir != want {
		t.Fatalf("PreviewCacheDir = %s, want %s", s.PreviewCacheDir, want)
	}
}

func TestPreviewConcurrencyRejectsInvalid(t *testing.T) {
	for _, value := range []string{"0", "-1", "abc"} {
		preparePreviewEnv(t)
		t.Setenv("APP_PREVIEW_CONCURRENCY", value)
		if _, err := Load(); err == nil {
			t.Fatalf("APP_PREVIEW_CONCURRENCY=%q 应报错", value)
		}
	}
}
