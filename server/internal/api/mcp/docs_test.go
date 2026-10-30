package mcp

// 校验 dev-architecture.md 的「MCP 服务」小节与代码一致（取代原 Python 的 tests/test_mcp_docs.py）：
//  1. 注册的每个 MCP 工具都在文档里出现，且文档写明请求头传参与附件上传方式；
//  2. 文档「操作目录」行写的排除清单与 ExcludedPaths / ExcludedPrefixes 逐项一致；
//  3. MCP 链接参数顺序：project_id 在 token 之前（文档与 web/src/config/env.ts 的 resolveMcpUrl）。

import (
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
)

const (
	mcpSectionStart = "#### MCP 服务（"
	mcpSectionEnd   = "#### 健康检查与接口文档"
)

func repoFile(t *testing.T, rel string) string {
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

func readRepoFile(t *testing.T, rel string) string {
	t.Helper()
	data, err := os.ReadFile(repoFile(t, rel))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func architectureDoc(t *testing.T) string {
	return readRepoFile(t, "docs/websites/pages/dev-architecture.md")
}

func mcpSection(t *testing.T) string {
	t.Helper()
	_, after, ok := strings.Cut(architectureDoc(t), mcpSectionStart)
	if !ok {
		t.Fatal("dev-architecture.md 缺少 MCP 小节标题")
	}
	section, _, ok := strings.Cut(after, mcpSectionEnd)
	if !ok {
		t.Fatal("dev-architecture.md 的 MCP 小节缺少结束标题")
	}
	return section
}

func TestDocumentedMCPToolsMatchCode(t *testing.T) {
	section := mcpSection(t)
	var names []string
	for _, raw := range toolDefinitions() {
		names = append(names, raw.(map[string]any)["name"].(string))
	}
	if len(names) == 0 {
		t.Fatal("MCP 服务没有注册任何工具")
	}
	for _, name := range names {
		if !strings.Contains(section, "`"+name+"`") {
			t.Errorf("dev-architecture.md 的 MCP 小节没有列出工具：%s", name)
		}
	}
	for _, keyword := range []string{"headers", "If-Match", "file.content_base64"} {
		if !strings.Contains(section, keyword) {
			t.Errorf("dev-architecture.md 的 MCP 小节缺少「%s」说明", keyword)
		}
	}
}

func TestDocumentedMCPExclusionsMatchCode(t *testing.T) {
	var row string
	for _, line := range strings.Split(mcpSection(t), "\n") {
		if strings.HasPrefix(line, "| 操作目录 |") {
			row = line
		}
	}
	if row == "" {
		t.Fatal("dev-architecture.md 的 MCP 小节缺少「操作目录」行")
	}
	documentedSet := map[string]bool{}
	for _, m := range regexp.MustCompile("`(/api/v1/[^`]+)`").FindAllStringSubmatch(row, -1) {
		documentedSet[m[1]] = true
	}
	var documented, excluded []string
	for p := range documentedSet {
		documented = append(documented, p)
	}
	excluded = append(append(excluded, ExcludedPaths...), ExcludedPrefixes...)
	sort.Strings(documented)
	sort.Strings(excluded)
	if !reflect.DeepEqual(documented, excluded) {
		t.Fatalf("文档写的排除项 %v 与代码 %v 不一致", documented, excluded)
	}
	// 排除项仍能命中存活路由由 TestEveryExclusionMatchesLiveOperation 校验。
}

func TestDocumentedMCPLinkPutsProjectBeforeToken(t *testing.T) {
	text := architectureDoc(t)
	if strings.Contains(text, "mcp/?token=") {
		t.Fatal("MCP 链接已改为 project_id 在 token 之前，dev-architecture.md 里仍有旧写法")
	}
	var row string
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "| `resolveMcpUrl(") {
			row = line
		}
	}
	if row == "" {
		t.Fatal("dev-architecture.md 缺少 resolveMcpUrl 行")
	}
	if !strings.Contains(row, "project_id") {
		t.Fatal("resolveMcpUrl 行没有说明 project_id 参数")
	}
	_, body, ok := strings.Cut(readRepoFile(t, "web/src/config/env.ts"), "export function resolveMcpUrl")
	if !ok {
		t.Fatal("web/src/config/env.ts 缺少 resolveMcpUrl")
	}
	p, k := strings.Index(body, "'project_id'"), strings.Index(body, "'token'")
	if p < 0 || k < 0 || p > k {
		t.Fatal("env.ts 的 resolveMcpUrl 必须把 project_id 写在 token 参数之前")
	}
}
