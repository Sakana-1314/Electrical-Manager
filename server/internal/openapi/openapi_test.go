package openapi

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// 内嵌契约必须与仓库唯一来源 docs/openapi.yaml 一致（在仓库内运行时校验）。
func TestEmbeddedSpecMatchesDocs(t *testing.T) {
	for _, candidate := range []string{"../../../docs/openapi.yaml", "../../../../docs/openapi.yaml"} {
		path, _ := filepath.Abs(candidate)
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		if !bytes.Equal(data, specYAML) {
			t.Fatalf("internal/openapi/openapi.yaml 与 %s 不一致：请复制最新契约（make sync-openapi）", path)
		}
		return
	}
	t.Skip("docs/openapi.yaml not found")
}

func TestOperationsLoaded(t *testing.T) {
	ops, err := Operations()
	if err != nil || len(ops) == 0 {
		t.Fatalf("operations not loaded: %v", err)
	}
}
