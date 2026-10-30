// Package openapi 内嵌接口契约（docs/openapi.yaml 的副本），供 /api/v1/openapi.json、
// /api/docs 与 MCP 工具目录使用。契约是唯一来源：副本须与 docs/openapi.yaml 保持一致（见 openapi_test.go）。
package openapi

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"gopkg.in/yaml.v3"
)

//go:embed openapi.yaml
var specYAML []byte

// Operation 是契约中的一个接口操作（按 paths 在文件中的顺序）。
type Operation struct {
	OperationID string
	Method      string // 小写：get / post / ...
	Path        string
	Raw         map[string]any
}

var (
	once       sync.Once
	loadErr    error
	document   map[string]any
	operations []Operation
	specJSON   []byte
)

var httpMethods = map[string]bool{"get": true, "post": true, "put": true, "patch": true, "delete": true}

func load() {
	once.Do(func() {
		var root yaml.Node
		if loadErr = yaml.Unmarshal(specYAML, &root); loadErr != nil {
			return
		}
		var doc map[string]any
		if loadErr = root.Decode(&doc); loadErr != nil {
			return
		}
		document = normalize(doc).(map[string]any)
		specJSON, loadErr = json.Marshal(document)
		if loadErr != nil {
			return
		}
		// 按文件顺序遍历 paths，保持与 FastAPI app.openapi() 相同的操作顺序。
		top := root.Content[0]
		for i := 0; i+1 < len(top.Content); i += 2 {
			if top.Content[i].Value != "paths" {
				continue
			}
			paths := top.Content[i+1]
			for j := 0; j+1 < len(paths.Content); j += 2 {
				path := paths.Content[j].Value
				item := paths.Content[j+1]
				for k := 0; k+1 < len(item.Content); k += 2 {
					method := item.Content[k].Value
					if !httpMethods[method] {
						continue
					}
					var raw map[string]any
					if err := item.Content[k+1].Decode(&raw); err != nil {
						loadErr = err
						return
					}
					raw = normalize(raw).(map[string]any)
					id, _ := raw["operationId"].(string)
					operations = append(operations, Operation{OperationID: id, Method: method, Path: path, Raw: raw})
				}
			}
		}
	})
}

// normalize 把 yaml 解出的 map[any]any 等转换为 JSON 友好的结构。
func normalize(v any) any {
	switch x := v.(type) {
	case map[string]any:
		for k, val := range x {
			x[k] = normalize(val)
		}
		return x
	case map[any]any:
		out := make(map[string]any, len(x))
		for k, val := range x {
			out[fmt.Sprint(k)] = normalize(val)
		}
		return out
	case []any:
		for i := range x {
			x[i] = normalize(x[i])
		}
		return x
	}
	return v
}

// Document 返回完整契约（只读使用）。
func Document() (map[string]any, error) {
	load()
	return document, loadErr
}

// Operations 返回全部操作（按契约顺序，只读使用）。
func Operations() ([]Operation, error) {
	load()
	return operations, loadErr
}

// JSON 返回契约的 JSON 文本（/api/v1/openapi.json）。
func JSON() ([]byte, error) {
	load()
	return specJSON, loadErr
}

// Schemas 返回 components.schemas。
func Schemas() map[string]any {
	load()
	comps, _ := document["components"].(map[string]any)
	schemas, _ := comps["schemas"].(map[string]any)
	return schemas
}

// SwaggerHTML 与 FastAPI get_swagger_ui_html 等价的文档页面。
func SwaggerHTML(title, openapiURL string) string {
	return `<!DOCTYPE html>
<html>
<head>
<link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
<link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
<title>` + title + ` - Swagger UI</title>
</head>
<body>
<div id="swagger-ui">
</div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
const ui = SwaggerUIBundle({
    url: '` + openapiURL + `',
    "dom_id": "#swagger-ui",
"layout": "BaseLayout",
"deepLinking": true,
"showExtensions": true,
"showCommonExtensions": true,
    presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
    })
</script>
</body>
</html>`
}
