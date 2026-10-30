// Package mcp 对应原 app/mcp_server.py：面向 AI Agent 的 MCP 服务（Streamable HTTP，无状态，JSON 响应）。
//
// 工具目录由内嵌的 OpenAPI 契约生成，operation_call 在进程内把请求转发给应用自身的 HTTP 处理器，
// 因此每次调用仍经过原有的参数校验、角色权限、乐观锁、事务与审计逻辑。
package mcp

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/openapi"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const maxBinaryResponseBytes = 25 * 1024 * 1024
const maxRequestBodyBytes = 16 * 1024 * 1024

// ExcludedPaths / ExcludedPrefixes 不暴露给 MCP 的接口（同步维护 dev-architecture.md 的 MCP 小节）。
var (
	ExcludedPaths    = []string{"/api/v1/auth/login", "/api/v1/auth/refresh"}
	ExcludedPrefixes = []string{"/api/v1/mini-program/"}
	// ManagedHeaders 由 MCP 层统一设置、不接受调用方覆盖的请求头。
	ManagedHeaders = map[string]bool{"x-api-token": true, "x-project-id": true}
	headerNotes    = map[string]string{"if-match": "乐观锁版本号（String(version)）；不传则不校验版本"}
)

const instructions = "先调用 operations_list 查找操作，再调用 operation_describe 确认参数，最后使用 " +
	"operation_call 执行。operation_describe 的 call_arguments 说明每个参数该放进 " +
	"path_params / query / headers / body / file 的哪一个；带乐观锁的写操作把版本号放进 " +
	"headers（如 {\"If-Match\": \"3\"}）。当前项目由 MCP 连接决定（请求头 X-Project-Id 优先，" +
	"其次链接参数 ?project_id=，都缺省时用默认项目），可用 system_whoami 查看。" +
	"不得猜测 operation_id 或绕过现有业务接口。"

var (
	handlerMu  sync.RWMutex
	appHandler http.Handler
)

// SetHandler 绑定应用自身的 HTTP 处理器（operation_call 进程内转发用）。
func SetHandler(h http.Handler) {
	handlerMu.Lock()
	appHandler = h
	handlerMu.Unlock()
}

func application() http.Handler {
	handlerMu.RLock()
	defer handlerMu.RUnlock()
	return appHandler
}

// Register 挂载 /api/v1/mcp/。
func Register(r *web.Router) {
	r.Raw().Any("/mcp/", serve)
}

// identity 是一次 MCP 请求的令牌身份与项目上下文。
type identity struct {
	Token         string
	ID            int64
	Username      string
	DisplayName   string
	Role          string
	ProjectID     *int64
	ProjectSource *string
}

func sendAuthError(c *gin.Context, message string) {
	body := fmt.Sprintf(`{"code":"INVALID_TOKEN","message":"%s"}`, message)
	c.Header("Content-Type", "application/json; charset=utf-8")
	c.Header("Content-Length", strconv.Itoa(len(body)))
	c.Status(401)
	_, _ = c.Writer.WriteString(body)
	c.Abort()
}

func authenticate(c *gin.Context) (*identity, bool) {
	query := c.Request.URL.Query()
	token := query.Get("token")
	if token == "" {
		token = c.GetHeader("X-API-Token")
		authz := c.GetHeader("Authorization")
		scheme, credential, _ := strings.Cut(authz, " ")
		if token == "" && strings.EqualFold(scheme, "bearer") && credential != "" {
			token = credential
		}
	}
	if token == "" {
		sendAuthError(c, "缺少 MCP 接口令牌")
		return nil, false
	}
	s := db.NewSession(c.Request.Context())
	defer s.Close()
	user, err := auth.FindUserByAPIToken(s, token)
	if err == nil {
		// 持久化懒迁移回写的令牌密文
		err = s.Commit()
	}
	if err != nil {
		web.WriteError(c, err)
		return nil, false
	}
	pid, source, err := resolveProject(s, c.GetHeader("X-Project-Id"), query.Get("project_id"))
	if err != nil {
		web.WriteError(c, err)
		return nil, false
	}
	if user == nil || !user.Enabled {
		sendAuthError(c, "MCP 接口令牌无效或用户已停用")
		return nil, false
	}
	return &identity{Token: token, ID: user.ID, Username: user.Username, DisplayName: user.DisplayName, Role: user.Role, ProjectID: pid, ProjectSource: source}, true
}

// resolveProject MCP 请求的项目：X-Project-Id 头 → 链接 ?project_id= → 默认项目。
// 合法但已停用 / 不存在的 id 不回退到它，而是继续按下一档解析。
func resolveProject(s *db.Session, header, link string) (*int64, *string, error) {
	for _, cand := range []struct{ source, raw string }{{"header", strings.TrimSpace(header)}, {"link", strings.TrimSpace(link)}} {
		if cand.raw == "" {
			continue
		}
		id, err := strconv.ParseInt(cand.raw, 10, 64)
		if err != nil || id <= 0 {
			continue
		}
		p, err := auth.GetProject(s, id)
		if err != nil {
			return nil, nil, err
		}
		if p != nil && p.Enabled {
			src := cand.source
			return &p.ID, &src, nil
		}
	}
	p, err := auth.DefaultProject(s)
	if err != nil || p == nil {
		return nil, nil, err
	}
	src := "default"
	return &p.ID, &src, nil
}

// ---------------- JSON-RPC / Streamable HTTP ----------------

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

var supportedVersions = []string{"2024-11-05", "2025-03-26", "2025-06-18", "2025-11-25"}

func writeJSON(c *gin.Context, status int, v any) {
	body, _ := json.Marshal(v)
	c.Header("Content-Type", "application/json")
	c.Header("Content-Length", strconv.Itoa(len(body)))
	c.Status(status)
	_, _ = c.Writer.Write(body)
}

func serve(c *gin.Context) {
	ident, ok := authenticate(c)
	if !ok {
		return
	}
	if c.Request.Method != http.MethodPost {
		// 无状态模式不提供 GET SSE 流与 DELETE 会话终止。
		c.Header("Allow", "POST")
		writeJSON(c, http.StatusMethodNotAllowed, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32000, Message: "Method Not Allowed"}})
		return
	}
	ct := c.GetHeader("Content-Type")
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(ct)), "application/json") {
		writeJSON(c, http.StatusUnsupportedMediaType, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32000, Message: "Unsupported Media Type: Content-Type must be application/json"}})
		return
	}
	accept := strings.ToLower(c.GetHeader("Accept"))
	if accept != "" && !strings.Contains(accept, "application/json") && !strings.Contains(accept, "*/*") {
		writeJSON(c, http.StatusNotAcceptable, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32000, Message: "Not Acceptable: Client must accept application/json"}})
		return
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxRequestBodyBytes+1))
	if err != nil || len(body) > maxRequestBodyBytes {
		writeJSON(c, http.StatusRequestEntityTooLarge, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32600, Message: "Request body too large"}})
		return
	}
	trimmed := bytes.TrimSpace(body)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var batch []rpcRequest
		if err := json.Unmarshal(trimmed, &batch); err != nil {
			writeJSON(c, 400, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32700, Message: "Parse error"}})
			return
		}
		var out []rpcResponse
		for _, req := range batch {
			if resp := dispatch(c, ident, req); resp != nil {
				out = append(out, *resp)
			}
		}
		if len(out) == 0 {
			c.Status(http.StatusAccepted)
			return
		}
		writeJSON(c, 200, out)
		return
	}
	var req rpcRequest
	if err := json.Unmarshal(trimmed, &req); err != nil || req.Method == "" {
		writeJSON(c, 400, rpcResponse{JSONRPC: "2.0", ID: json.RawMessage("null"), Error: &rpcError{Code: -32700, Message: "Parse error: Invalid JSON-RPC message"}})
		return
	}
	resp := dispatch(c, ident, req)
	if resp == nil {
		c.Status(http.StatusAccepted)
		return
	}
	writeJSON(c, 200, resp)
}

func dispatch(c *gin.Context, ident *identity, req rpcRequest) *rpcResponse {
	isNotification := len(req.ID) == 0 || string(req.ID) == "null"
	if isNotification {
		return nil
	}
	resp := &rpcResponse{JSONRPC: "2.0", ID: req.ID}
	switch req.Method {
	case "initialize":
		var params struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		_ = json.Unmarshal(req.Params, &params)
		version := supportedVersions[len(supportedVersions)-1]
		for _, v := range supportedVersions {
			if v == params.ProtocolVersion {
				version = v
			}
		}
		resp.Result = map[string]any{
			"protocolVersion": version,
			"capabilities": map[string]any{
				"experimental": map[string]any{},
				"tools":        map[string]any{"listChanged": false},
			},
			"serverInfo": map[string]any{
				"name":        "spare-parts-management",
				"title":       "备件管理系统",
				"description": "通过受控业务接口操作备件、库存、申购、用户、系统配置和附件。",
				"version":     "1.0.0",
			},
			"instructions": instructions,
		}
	case "ping":
		resp.Result = map[string]any{}
	case "tools/list":
		resp.Result = map[string]any{"tools": toolDefinitions()}
	case "tools/call":
		var params struct {
			Name      string         `json:"name"`
			Arguments map[string]any `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			resp.Error = &rpcError{Code: -32602, Message: "Invalid params"}
			return resp
		}
		resp.Result = callTool(c, ident, params.Name, params.Arguments)
	default:
		resp.Error = &rpcError{Code: -32601, Message: "Method not found"}
	}
	return resp
}

// toolError 是工具执行失败（返回 isError=true 的结果，而不是 JSON-RPC 错误）。
type toolError struct{ msg string }

func (e *toolError) Error() string { return e.msg }

func errf(format string, args ...any) error { return &toolError{fmt.Sprintf(format, args...)} }

func callTool(c *gin.Context, ident *identity, name string, args map[string]any) map[string]any {
	if args == nil {
		args = map[string]any{}
	}
	var result map[string]any
	var err error
	switch name {
	case "system_whoami":
		result, err = systemWhoami(c, ident)
	case "projects_list":
		result, err = callInternal(c, ident, "GET", "/api/v1/projects", nil, nil, nil, nil)
	case "operations_list":
		result, err = operationsList(optString(args, "category"), optString(args, "keyword"))
	case "operation_describe":
		id, ok := args["operation_id"].(string)
		if !ok {
			err = errf("operation_id: Field required")
			break
		}
		result, err = operationDescribe(id)
	case "operation_call":
		result, err = operationCall(c, ident, args)
	default:
		return map[string]any{
			"content": []any{map[string]any{"type": "text", "text": "Unknown tool: " + name}},
			"isError": true,
		}
	}
	if err != nil {
		return map[string]any{
			"content": []any{map[string]any{"type": "text", "text": fmt.Sprintf("Error executing tool %s: %s", name, err.Error())}},
			"isError": true,
		}
	}
	text, _ := json.MarshalIndent(result, "", "  ")
	return map[string]any{
		"content":           []any{map[string]any{"type": "text", "text": string(text)}},
		"structuredContent": result,
		"isError":           false,
	}
}

func optString(args map[string]any, key string) string {
	if v, ok := args[key].(string); ok {
		return v
	}
	return ""
}

// ---------------- 工具实现 ----------------

func systemWhoami(c *gin.Context, ident *identity) (map[string]any, error) {
	payload := map[string]any{
		"id":             ident.ID,
		"username":       ident.Username,
		"display_name":   ident.DisplayName,
		"role":           ident.Role,
		"project_id":     ident.ProjectID,
		"project_source": ident.ProjectSource,
	}
	if ident.ProjectID != nil {
		s := db.NewSession(c.Request.Context())
		defer s.Close()
		var p model.Project
		ok, err := s.Find(&p, "SELECT "+model.ColsProject+" FROM project WHERE id = ?", *ident.ProjectID)
		if err != nil {
			return nil, err
		}
		if ok {
			payload["project_name"] = p.Name
		}
	}
	return payload, nil
}

// CatalogEntry 是工具目录中的一个操作。
type CatalogEntry struct {
	OperationID   string
	Method        string
	Path          string
	Summary       string
	Description   string
	Tags          []any
	Parameters    []any
	RequestBody   any
	Responses     any
	Schemas       map[string]any
	CallArguments map[string]any
}

func (e *CatalogEntry) describe() map[string]any {
	return map[string]any{
		"operation_id":   e.OperationID,
		"method":         e.Method,
		"path":           e.Path,
		"summary":        e.Summary,
		"description":    e.Description,
		"tags":           e.Tags,
		"parameters":     e.Parameters,
		"request_body":   e.RequestBody,
		"responses":      e.Responses,
		"schemas":        e.Schemas,
		"call_arguments": e.CallArguments,
	}
}

var (
	catalogOnce  sync.Once
	catalogList  []*CatalogEntry
	catalogByID  map[string]*CatalogEntry
	catalogError error
)

func isExcluded(path string) bool {
	for _, p := range ExcludedPaths {
		if p == path {
			return true
		}
	}
	for _, prefix := range ExcludedPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	return false
}

// Catalog 返回工具目录（契约顺序）。
func Catalog() ([]*CatalogEntry, map[string]*CatalogEntry, error) {
	catalogOnce.Do(func() {
		ops, err := openapi.Operations()
		if err != nil {
			catalogError = err
			return
		}
		schemas := openapi.Schemas()
		catalogByID = map[string]*CatalogEntry{}
		for _, op := range ops {
			if isExcluded(op.Path) || op.OperationID == "" {
				continue
			}
			entry := &CatalogEntry{
				OperationID: op.OperationID,
				Method:      strings.ToUpper(op.Method),
				Path:        op.Path,
				Summary:     str(op.Raw["summary"]),
				Description: str(op.Raw["description"]),
				Tags:        list(op.Raw["tags"]),
				Parameters:  list(op.Raw["parameters"]),
				RequestBody: op.Raw["requestBody"],
				Responses:   op.Raw["responses"],
			}
			if entry.Responses == nil {
				entry.Responses = map[string]any{}
			}
			entry.Schemas = referencedSchemas([]any{entry.Parameters, entry.RequestBody, entry.Responses}, schemas)
			entry.CallArguments = callArguments(entry)
			catalogList = append(catalogList, entry)
			catalogByID[entry.OperationID] = entry
		}
	})
	return catalogList, catalogByID, catalogError
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func list(v any) []any {
	if l, ok := v.([]any); ok {
		return l
	}
	return []any{}
}

func referencedSchemas(value any, schemas map[string]any) map[string]any {
	names := map[string]bool{}
	const prefix = "#/components/schemas/"
	var collect func(node any)
	collect = func(node any) {
		switch x := node.(type) {
		case map[string]any:
			if ref, ok := x["$ref"].(string); ok && strings.HasPrefix(ref, prefix) {
				name := strings.TrimPrefix(ref, prefix)
				if _, exists := schemas[name]; exists && !names[name] {
					names[name] = true
					collect(schemas[name])
				}
			}
			for _, child := range x {
				collect(child)
			}
		case []any:
			for _, child := range x {
				collect(child)
			}
		}
	}
	collect(value)
	out := make(map[string]any, len(names))
	for name := range names {
		out[name] = schemas[name]
	}
	return out
}

func callArguments(e *CatalogEntry) map[string]any {
	pathParams, queryParams := []string{}, []string{}
	headers := []any{}
	for _, raw := range e.Parameters {
		item, _ := raw.(map[string]any)
		name := str(item["name"])
		switch item["in"] {
		case "path":
			pathParams = append(pathParams, name)
		case "query":
			queryParams = append(queryParams, name)
		case "header":
			key := strings.ToLower(name)
			if !ManagedHeaders[key] {
				headers = append(headers, map[string]any{"name": name, "note": headerNotes[key]})
			}
		}
	}
	fileField := multipartFileField(e)
	var body any
	if fileField == nil {
		rb, _ := e.RequestBody.(map[string]any)
		content, _ := rb["content"].(map[string]any)
		if len(content) > 0 {
			keys := make([]string, 0, len(content))
			for k := range content {
				keys = append(keys, k)
			}
			sort.Strings(keys)
			body = keys
		}
	}
	var file any
	if fileField != nil {
		file = *fileField
	}
	return map[string]any{"path_params": pathParams, "query": queryParams, "headers": headers, "body": body, "file": file}
}

func multipartFileField(e *CatalogEntry) *string {
	rb, _ := e.RequestBody.(map[string]any)
	content, _ := rb["content"].(map[string]any)
	mp, ok := content["multipart/form-data"].(map[string]any)
	if !ok {
		return nil
	}
	resolved, _ := mp["schema"].(map[string]any)
	if ref, ok := resolved["$ref"].(string); ok && strings.HasPrefix(ref, "#/components/schemas/") {
		if s, ok := e.Schemas[strings.TrimPrefix(ref, "#/components/schemas/")].(map[string]any); ok {
			resolved = s
		}
	}
	props, _ := resolved["properties"].(map[string]any)
	names := make([]string, 0, len(props))
	for name := range props {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		if spec, ok := props[name].(map[string]any); ok && spec["format"] == "binary" {
			n := name
			return &n
		}
	}
	if len(names) > 0 {
		return &names[0]
	}
	return nil
}

func operationsList(category, keyword string) (map[string]any, error) {
	entries, _, err := Catalog()
	if err != nil {
		return nil, err
	}
	concise := []any{}
	for _, e := range entries {
		if category != "" {
			matched := false
			for _, t := range e.Tags {
				if strings.Contains(strings.ToLower(fmt.Sprint(t)), strings.ToLower(category)) {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		if keyword != "" {
			parts := []string{e.OperationID, e.Summary, e.Description}
			for _, t := range e.Tags {
				parts = append(parts, fmt.Sprint(t))
			}
			if !strings.Contains(strings.ToLower(strings.Join(parts, " ")), strings.ToLower(keyword)) {
				continue
			}
		}
		concise = append(concise, map[string]any{"operation_id": e.OperationID, "method": e.Method, "path": e.Path, "summary": e.Summary, "tags": e.Tags})
	}
	return map[string]any{"count": len(concise), "operations": concise}, nil
}

func operationDescribe(id string) (map[string]any, error) {
	_, byID, err := Catalog()
	if err != nil {
		return nil, err
	}
	e, ok := byID[id]
	if !ok {
		return nil, errf("未知或不允许的 operation_id: %s", id)
	}
	return e.describe(), nil
}

var pathParamRe = regexp.MustCompile(`{([^{}]+)}`)

// BuildPath 用路径参数填充模板（缺少或多余的参数报错）。
func BuildPath(template string, params map[string]any) (string, error) {
	required := map[string]bool{}
	for _, m := range pathParamRe.FindAllStringSubmatch(template, -1) {
		required[m[1]] = true
	}
	var missing, extra []string
	for name := range required {
		if _, ok := params[name]; !ok {
			missing = append(missing, name)
		}
	}
	for name := range params {
		if !required[name] {
			extra = append(extra, name)
		}
	}
	sort.Strings(missing)
	sort.Strings(extra)
	if len(missing) > 0 {
		return "", errf("缺少路径参数: %s", strings.Join(missing, ", "))
	}
	if len(extra) > 0 {
		return "", errf("存在未定义的路径参数: %s", strings.Join(extra, ", "))
	}
	path := template
	for name := range required {
		path = strings.ReplaceAll(path, "{"+name+"}", web.PyQuote(pyStr(params[name]), ""))
	}
	return path, nil
}

// pyStr 近似 Python str(value)。
func pyStr(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		if x == float64(int64(x)) {
			return strconv.FormatInt(int64(x), 10)
		}
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		if x {
			return "True"
		}
		return "False"
	case nil:
		return "None"
	}
	return fmt.Sprint(v)
}

type fileInput struct {
	Filename      string
	ContentBase64 string
	MimeType      string
}

func operationCall(c *gin.Context, ident *identity, args map[string]any) (map[string]any, error) {
	id, ok := args["operation_id"].(string)
	if !ok {
		return nil, errf("operation_id: Field required")
	}
	_, byID, err := Catalog()
	if err != nil {
		return nil, err
	}
	e, ok := byID[id]
	if !ok {
		return nil, errf("未知或不允许的 operation_id: %s", id)
	}
	pathParams, err := optObject(args, "path_params")
	if err != nil {
		return nil, err
	}
	query, err := optObject(args, "query")
	if err != nil {
		return nil, err
	}
	rawHeaders, err := optObject(args, "headers")
	if err != nil {
		return nil, err
	}
	var file *fileInput
	if raw, ok := args["file"]; ok && raw != nil {
		obj, ok := raw.(map[string]any)
		if !ok {
			return nil, errf("file: Input should be a valid dictionary")
		}
		file = &fileInput{MimeType: "application/octet-stream"}
		for k, v := range obj {
			s, isStr := v.(string)
			switch k {
			case "filename":
				file.Filename = s
			case "content_base64":
				file.ContentBase64 = s
			case "mime_type":
				file.MimeType = s
			default:
				return nil, errf("file.%s: Extra inputs are not permitted", k)
			}
			if !isStr {
				return nil, errf("file.%s: Input should be a valid string", k)
			}
		}
		if n := len([]rune(file.Filename)); n < 1 || n > 255 {
			return nil, errf("file.filename: String should have between 1 and 255 characters")
		}
		if file.ContentBase64 == "" {
			return nil, errf("file.content_base64: String should have at least 1 character")
		}
		if n := len([]rune(file.MimeType)); n < 1 || n > 128 {
			return nil, errf("file.mime_type: String should have between 1 and 128 characters")
		}
	}
	path, err := BuildPath(e.Path, pathParams)
	if err != nil {
		return nil, err
	}
	headers, err := operationHeaders(e, rawHeaders)
	if err != nil {
		return nil, err
	}
	return callInternal(c, ident, e.Method, path, query, headers, args["body"], file)
}

func optObject(args map[string]any, key string) (map[string]any, error) {
	raw, ok := args[key]
	if !ok || raw == nil {
		return map[string]any{}, nil
	}
	obj, ok := raw.(map[string]any)
	if !ok {
		return nil, errf("%s: Input should be a valid dictionary", key)
	}
	return obj, nil
}

func operationHeaders(e *CatalogEntry, headers map[string]any) (map[string]string, error) {
	if len(headers) == 0 {
		return map[string]string{}, nil
	}
	declared := map[string]string{}
	for _, raw := range e.Parameters {
		item, _ := raw.(map[string]any)
		if item["in"] == "header" {
			declared[strings.ToLower(str(item["name"]))] = str(item["name"])
		}
	}
	resolved := map[string]string{}
	for name, value := range headers {
		key := strings.ToLower(name)
		if ManagedHeaders[key] {
			return nil, errf("请求头 %s 由 MCP 统一设置（令牌与项目取自 MCP 连接），不能通过 headers 传入", name)
		}
		canonical, ok := declared[key]
		if !ok {
			names := make([]string, 0, len(declared))
			for k := range declared {
				names = append(names, k)
			}
			sort.Strings(names)
			available := strings.Join(names, "、")
			if available == "" {
				available = "无"
			}
			return nil, errf("操作 %s 不接受请求头 %s；可用：%s", e.OperationID, name, available)
		}
		s, ok := value.(string)
		if !ok {
			return nil, errf("请求头 %s 的值必须是字符串", name)
		}
		resolved[canonical] = s
	}
	return resolved, nil
}

// callInternal 按令牌 + 当前项目在进程内调用应用自身的 HTTP 接口。
func callInternal(c *gin.Context, ident *identity, method, path string, query map[string]any, headers map[string]string, body any, file *fileInput) (map[string]any, error) {
	h := application()
	if h == nil {
		return nil, errf("MCP 服务尚未绑定应用")
	}
	values := url.Values{}
	for k, v := range query {
		switch x := v.(type) {
		case []any:
			for _, item := range x {
				values.Add(k, queryValue(item))
			}
		case nil:
		default:
			values.Add(k, queryValue(x))
		}
	}
	var reqBody []byte
	contentType := ""
	if file != nil {
		if body != nil {
			return nil, errf("文件上传操作不能同时传 body")
		}
		content, err := base64.StdEncoding.Strict().DecodeString(file.ContentBase64)
		if err != nil {
			return nil, errf("file.content_base64 不是有效的 Base64")
		}
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		hdr := textproto.MIMEHeader{}
		hdr.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, escapeQuotes(file.Filename)))
		hdr.Set("Content-Type", file.MimeType)
		part, _ := mw.CreatePart(hdr)
		_, _ = part.Write(content)
		_ = mw.Close()
		reqBody = buf.Bytes()
		contentType = mw.FormDataContentType()
	} else if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reqBody = b
		contentType = "application/json"
	}
	target := path
	if enc := values.Encode(); enc != "" {
		target += "?" + enc
	}
	for redirects := 0; ; redirects++ {
		req, err := http.NewRequestWithContext(c.Request.Context(), method, "http://mcp.internal"+target, bytes.NewReader(reqBody))
		if err != nil {
			return nil, err
		}
		for k, v := range headers {
			req.Header.Set(k, v)
		}
		if contentType != "" {
			req.Header.Set("Content-Type", contentType)
		}
		// 托管头最后设置：调用方无法覆盖令牌与项目。
		req.Header.Set("X-API-Token", ident.Token)
		if ident.ProjectID != nil {
			req.Header.Set("X-Project-Id", strconv.FormatInt(*ident.ProjectID, 10))
		}
		req.RemoteAddr = c.Request.RemoteAddr
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code >= 300 && rec.Code < 400 && redirects < 5 {
			if loc := rec.Header().Get("Location"); loc != "" {
				if u, err := url.Parse(loc); err == nil {
					target = u.RequestURI()
					if rec.Code == 303 || ((rec.Code == 301 || rec.Code == 302) && method == http.MethodPost) {
						method, reqBody, contentType = http.MethodGet, nil, ""
					}
					continue
				}
			}
		}
		return toResult(rec)
	}
}

func escapeQuotes(s string) string {
	return strings.NewReplacer("\\", "\\\\", `"`, "%22").Replace(s)
}

func queryValue(v any) string {
	switch x := v.(type) {
	case bool:
		if x {
			return "true"
		}
		return "false"
	case nil:
		return ""
	}
	return pyStr(v)
}

var filenameRe = regexp.MustCompile(`(?i)filename="?([^";]+)`)

func toResult(rec *httptest.ResponseRecorder) (map[string]any, error) {
	content := rec.Body.Bytes()
	contentType := strings.ToLower(rec.Header().Get("Content-Type"))
	if rec.Code == 204 || len(content) == 0 {
		return map[string]any{"status_code": rec.Code, "data": nil}, nil
	}
	if strings.Contains(contentType, "application/json") {
		var data any
		if err := json.Unmarshal(content, &data); err != nil {
			return nil, err
		}
		return map[string]any{"status_code": rec.Code, "data": data}, nil
	}
	if len(content) > maxBinaryResponseBytes {
		return nil, errf("接口返回文件超过 25 MB，无法通过 MCP 返回")
	}
	var filename any
	if m := filenameRe.FindStringSubmatch(rec.Header().Get("Content-Disposition")); m != nil {
		filename = m[1]
	}
	ct := rec.Header().Get("Content-Type")
	if ct == "" {
		ct = "application/octet-stream"
	}
	return map[string]any{
		"status_code":    rec.Code,
		"content_type":   ct,
		"filename":       filename,
		"content_base64": base64.StdEncoding.EncodeToString(content),
	}, nil
}

// ---------------- 工具定义 ----------------

func readOnly() map[string]any {
	return map[string]any{"readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": false}
}

func objectOutput(title string) map[string]any {
	return map[string]any{"additionalProperties": true, "title": title, "type": "object"}
}

func nullable(schema map[string]any) map[string]any {
	return map[string]any{"anyOf": []any{schema, map[string]any{"type": "null"}}, "default": nil}
}

func toolDefinitions() []any {
	empty := map[string]any{"properties": map[string]any{}, "type": "object"}
	return []any{
		map[string]any{
			"name": "system_whoami", "title": "查看当前身份",
			"description": "返回当前 MCP 令牌对应的管理端用户、角色，以及本次调用所属的项目。\n\n多项目隔离下业务数据只在「当前项目」内可见，这里显式回显项目与项目来源（请求头 / 链接参数 /\n默认项目），便于 Agent 自检。",
			"inputSchema": empty, "outputSchema": objectOutput("system_whoamiDictOutput"), "annotations": readOnly(),
		},
		map[string]any{
			"name": "projects_list", "title": "查看可用项目",
			"description": "列出全部项目（多项目数据隔离：业务接口只操作当前项目的数据）。",
			"inputSchema": empty, "outputSchema": objectOutput("projects_listDictOutput"), "annotations": readOnly(),
		},
		map[string]any{
			"name": "operations_list", "title": "查询可用操作",
			"description": "列出可调用的业务操作。category 按接口标签筛选，keyword 按名称和说明搜索。",
			"inputSchema": map[string]any{"type": "object", "properties": map[string]any{
				"category": nullable(map[string]any{"type": "string"}),
				"keyword":  nullable(map[string]any{"type": "string"}),
			}},
			"outputSchema": objectOutput("operations_listDictOutput"), "annotations": readOnly(),
		},
		map[string]any{
			"name": "operation_describe", "title": "查看操作参数",
			"description": "返回指定业务操作的路径参数、查询参数、请求体和响应契约。",
			"inputSchema": map[string]any{"type": "object", "required": []any{"operation_id"}, "properties": map[string]any{
				"operation_id": map[string]any{"type": "string", "title": "Operation Id"},
			}},
			"outputSchema": objectOutput("operation_describeDictOutput"), "annotations": readOnly(),
		},
		map[string]any{
			"name": "operation_call", "title": "执行业务操作",
			"description": "调用一个已登记的业务操作。\n\npath 参数放 `path_params`，查询参数放 `query`，JSON 请求体放 `body`，附件用\n`file.content_base64`；带乐观锁的写操作把版本号放 `headers`（如 `{\"If-Match\": \"3\"}`）。\n具体落位见 operation_describe 的 `call_arguments`。",
			"inputSchema": map[string]any{
				"type":     "object",
				"required": []any{"operation_id"},
				"$defs": map[string]any{"McpFileInput": map[string]any{
					"additionalProperties": false, "type": "object", "title": "McpFileInput",
					"required": []any{"filename", "content_base64"},
					"properties": map[string]any{
						"filename":       map[string]any{"type": "string", "minLength": 1, "maxLength": 255, "title": "Filename"},
						"content_base64": map[string]any{"type": "string", "minLength": 1, "title": "Content Base64"},
						"mime_type":      map[string]any{"type": "string", "minLength": 1, "maxLength": 128, "default": "application/octet-stream", "title": "Mime Type"},
					},
				}},
				"properties": map[string]any{
					"operation_id": map[string]any{"type": "string", "title": "Operation Id"},
					"path_params":  nullable(map[string]any{"type": "object", "additionalProperties": true}),
					"query":        nullable(map[string]any{"type": "object", "additionalProperties": true}),
					"headers":      nullable(map[string]any{"type": "object", "additionalProperties": map[string]any{"type": "string"}}),
					"body": map[string]any{"anyOf": []any{
						map[string]any{"type": "object", "additionalProperties": true},
						map[string]any{"type": "array", "items": map[string]any{}},
						map[string]any{"type": "null"},
					}, "default": nil},
					"file": nullable(map[string]any{"$ref": "#/$defs/McpFileInput"}),
				},
			},
			"outputSchema": objectOutput("operation_callDictOutput"),
			"annotations":  map[string]any{"readOnlyHint": false, "destructiveHint": true, "idempotentHint": false, "openWorldHint": false},
		},
	}
}
