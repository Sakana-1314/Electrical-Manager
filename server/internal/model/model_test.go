package model

// 对照 docs/references/database/init.sql（结构唯一来源）校验 models_gen.go：
// 表名、列名、可空性、Go 类型与 SQL 类型、枚举取值、Cols* 列清单，以及项目域表登记（ProjectScopedTables）。
// 取代原 Python 的 tests/test_init_sql.py 与 tests/test_project_scope_registry.py。

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// ---------------- init.sql 解析 ----------------

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

func readInitSQL(t *testing.T) string {
	t.Helper()
	data, err := os.ReadFile(repoFile(t, "docs/references/database/init.sql"))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

var (
	identRe      = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*`)
	createTypeRe = regexp.MustCompile(`(?s)CREATE TYPE (\w+) AS ENUM \((.*?)\);`)
	quotedRe     = regexp.MustCompile(`'([^']*)'`)
	projectFKRe  = regexp.MustCompile(`FOREIGN KEY \("?project_id"?\) REFERENCES "?project"? \("?id"?\)(?: ON DELETE ([A-Z]+(?: [A-Z]+)?))?`)
)

func readIdentifier(sql string, start int) (string, int) {
	if sql[start] == '"' {
		end := strings.IndexByte(sql[start+1:], '"') + start + 1
		return sql[start+1 : end], end + 1
	}
	m := identRe.FindString(sql[start:])
	return m, start + len(m)
}

// tableBlocks 按括号配对提取每张表的列 / 约束定义（CHECK、FK 内部还有括号，不能用正则一刀切）。
func tableBlocks(t *testing.T, sql string) map[string]string {
	t.Helper()
	const marker = "CREATE TABLE IF NOT EXISTS "
	blocks := map[string]string{}
	pos := 0
	for {
		idx := strings.Index(sql[pos:], marker)
		if idx < 0 {
			return blocks
		}
		name, cursor := readIdentifier(sql, pos+idx+len(marker))
		for sql[cursor] == ' ' || sql[cursor] == '\n' {
			cursor++
		}
		if sql[cursor] != '(' {
			t.Fatalf("%s 的建表语句格式不符合预期", name)
		}
		depth, i := 0, cursor
		for ; i < len(sql); i++ {
			if sql[i] == '(' {
				depth++
			} else if sql[i] == ')' {
				depth--
				if depth == 0 {
					break
				}
			}
		}
		blocks[name] = sql[cursor+1 : i]
		pos = i + 1
	}
}

type sqlColumn struct {
	name       string
	definition string
}

var constraintWords = map[string]bool{"CONSTRAINT": true, "PRIMARY": true, "FOREIGN": true, "UNIQUE": true, "CHECK": true, "INDEX": true, "EXCLUDE": true}

// columnDefinitions 只取两个空格缩进的列定义行（约束续行缩进更深，约束行以关键字开头）。
func columnDefinitions(block string) []sqlColumn {
	var out []sqlColumn
	for _, line := range strings.Split(block, "\n") {
		if !strings.HasPrefix(line, "  ") || strings.HasPrefix(line, "   ") {
			continue
		}
		content := line[2:]
		name, end := readIdentifier(content, 0)
		if name == "" || constraintWords[name] {
			continue
		}
		rest := strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(content[end:]), ","))
		if rest == "" {
			continue
		}
		out = append(out, sqlColumn{name: name, definition: rest})
	}
	return out
}

func enumTypes(sql string) map[string][]string {
	out := map[string][]string{}
	for _, m := range createTypeRe.FindAllStringSubmatch(sql, -1) {
		var values []string
		for _, v := range quotedRe.FindAllStringSubmatch(m[2], -1) {
			values = append(values, v[1])
		}
		out[m[1]] = values
	}
	return out
}

// ---------------- models_gen.go 解析 ----------------

type goField struct {
	column string
	goType string
	enum   []string
}

type goModel struct {
	structName string
	table      string
	scoped     bool
	fields     []goField
}

var tableDocRe = regexp.MustCompile("↔ 表 `([a-z_0-9]+)`(（项目域）)?")

func exprString(e ast.Expr) string {
	switch x := e.(type) {
	case *ast.Ident:
		return x.Name
	case *ast.StarExpr:
		return "*" + exprString(x.X)
	case *ast.SelectorExpr:
		return exprString(x.X) + "." + x.Sel.Name
	case *ast.ArrayType:
		return "[]" + exprString(x.Elt)
	}
	return "?"
}

func parseModels(t *testing.T) ([]goModel, map[string]string) {
	t.Helper()
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "models_gen.go", nil, parser.ParseComments)
	if err != nil {
		t.Fatal(err)
	}
	var models []goModel
	consts := map[string]string{}
	for _, decl := range file.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok {
			continue
		}
		for _, spec := range gen.Specs {
			switch s := spec.(type) {
			case *ast.ValueSpec:
				for i, name := range s.Names {
					if i < len(s.Values) {
						if lit, ok := s.Values[i].(*ast.BasicLit); ok && lit.Kind == token.STRING {
							v, _ := strconv.Unquote(lit.Value)
							consts[name.Name] = v
						}
					}
				}
			case *ast.TypeSpec:
				st, ok := s.Type.(*ast.StructType)
				if !ok || gen.Doc == nil {
					continue
				}
				m := tableDocRe.FindStringSubmatch(gen.Doc.Text())
				if m == nil {
					t.Errorf("结构体 %s 缺少「↔ 表 `name`」注释", s.Name.Name)
					continue
				}
				model := goModel{structName: s.Name.Name, table: m[1], scoped: m[2] != ""}
				for _, f := range st.Fields.List {
					if f.Tag == nil {
						continue
					}
					tag, _ := strconv.Unquote(f.Tag.Value)
					column := reflect.StructTag(tag).Get("db")
					if column == "" || column == "-" {
						continue
					}
					field := goField{column: column, goType: exprString(f.Type)}
					if f.Comment != nil {
						if c := strings.TrimSpace(f.Comment.Text()); strings.HasPrefix(c, "enum:") {
							for _, v := range strings.Split(strings.TrimPrefix(c, "enum:"), ",") {
								field.enum = append(field.enum, strings.TrimSpace(v))
							}
						}
					}
					model.fields = append(model.fields, field)
				}
				models = append(models, model)
			}
		}
	}
	return models, consts
}

// sqlTypeAllows 返回 SQL 列类型（定义首词）允许的 Go 类型（不含指针）。
func sqlTypeAllows(definition string, enums map[string][]string) (allowed []string, isEnum bool) {
	word := identRe.FindString(definition)
	switch word {
	case "BIGINT", "BIGSERIAL", "INTEGER", "SMALLINT":
		return []string{"int64"}, false
	case "VARCHAR", "TEXT":
		return []string{"string"}, false
	case "BOOLEAN":
		return []string{"bool"}, false
	case "TIMESTAMP":
		return []string{"time.Time"}, false
	case "DATE":
		return []string{"jtype.Date"}, false
	case "NUMERIC":
		return []string{"jtype.Decimal"}, false
	case "JSON", "JSONB":
		return []string{"jtype.JSON"}, false
	}
	if _, ok := enums[word]; ok {
		return []string{"string"}, true
	}
	return nil, false
}

// ---------------- 测试 ----------------

func TestModelsMatchInitSQL(t *testing.T) {
	sql := readInitSQL(t)
	blocks := tableBlocks(t, sql)
	enums := enumTypes(sql)
	models, consts := parseModels(t)

	byTable := map[string]goModel{}
	for _, m := range models {
		byTable[m.table] = m
	}
	var sqlTables, goTables []string
	for name := range blocks {
		sqlTables = append(sqlTables, name)
	}
	for name := range byTable {
		goTables = append(goTables, name)
	}
	sort.Strings(sqlTables)
	sort.Strings(goTables)
	if !reflect.DeepEqual(sqlTables, goTables) {
		t.Fatalf("表清单不一致：\ninit.sql: %v\nmodels:   %v", sqlTables, goTables)
	}

	for _, table := range sqlTables {
		m := byTable[table]
		cols := columnDefinitions(blocks[table])
		fields := map[string]goField{}
		var sqlNames, goNames []string
		for _, c := range cols {
			sqlNames = append(sqlNames, c.name)
		}
		for _, f := range m.fields {
			goNames = append(goNames, f.column)
			fields[f.column] = f
		}
		// 列顺序不影响（SQL 一律按列名读写），只比对列集合。
		sortedSQL := append([]string{}, sqlNames...)
		sortedGo := append([]string{}, goNames...)
		sort.Strings(sortedSQL)
		sort.Strings(sortedGo)
		if !reflect.DeepEqual(sortedSQL, sortedGo) {
			t.Errorf("%s 的列与 %s 不一致：\ninit.sql: %v\nmodels:   %v", table, m.structName, sortedSQL, sortedGo)
			continue
		}
		for _, c := range cols {
			f := fields[c.name]
			nullable := !strings.Contains(c.definition, "NOT NULL")
			base := strings.TrimPrefix(f.goType, "*")
			allowed, isEnum := sqlTypeAllows(c.definition, enums)
			if allowed == nil {
				t.Errorf("%s.%s：无法识别的 SQL 类型 %q", table, c.name, c.definition)
				continue
			}
			if !contains(allowed, base) {
				t.Errorf("%s.%s：SQL 类型 %q 对应 Go 类型应为 %v，models 为 %s", table, c.name, c.definition, allowed, f.goType)
			}
			// jtype.JSON 本身可承载 NULL（空值即 NULL），不以指针区分可空性。
			if base != "jtype.JSON" && nullable != strings.HasPrefix(f.goType, "*") {
				t.Errorf("%s.%s 的 NULL 约束不一致：init.sql nullable=%v，models 类型 %s", table, c.name, nullable, f.goType)
			}
			if isEnum {
				typeName := identRe.FindString(c.definition)
				if !reflect.DeepEqual(enums[typeName], f.enum) {
					t.Errorf("%s.%s 的枚举值不一致：init.sql %s=%v，models 注释 %v", table, c.name, typeName, enums[typeName], f.enum)
				}
			} else if f.enum != nil {
				t.Errorf("%s.%s 在 models 里标了 enum，但 init.sql 不是枚举类型", table, c.name)
			}
		}

		// Cols<Struct> / Table<Struct> 常量与字段一致（SELECT 列清单靠它拼）。
		quoted := make([]string, len(goNames))
		for i, n := range goNames {
			quoted[i] = `"` + n + `"`
		}
		if got := consts["Cols"+m.structName]; got != strings.Join(quoted, ", ") {
			t.Errorf("Cols%s 与字段不一致：%s", m.structName, got)
		}
		if got := consts["Table"+m.structName]; got != table {
			t.Errorf("Table%s = %q，应为 %q", m.structName, got, table)
		}
	}
}

func contains(items []string, s string) bool {
	for _, item := range items {
		if item == s {
			return true
		}
	}
	return false
}

// 项目域表清单必须完整：删项目前的存在性统计（project.CountProjectRows）遍历它，漏登记的表统计不到。
func TestProjectScopedTablesMatchInitSQL(t *testing.T) {
	sql := readInitSQL(t)
	blocks := tableBlocks(t, sql)
	models, _ := parseModels(t)

	var withProjectID []string
	for table, block := range blocks {
		for _, c := range columnDefinitions(block) {
			if c.name == "project_id" {
				withProjectID = append(withProjectID, table)
			}
		}
	}
	registered := append([]string{}, ProjectScopedTables...)
	sort.Strings(withProjectID)
	sort.Strings(registered)
	if !reflect.DeepEqual(withProjectID, registered) {
		t.Fatalf("ProjectScopedTables 与 init.sql 中带 project_id 的表不一致：\ninit.sql: %v\n登记:     %v", withProjectID, registered)
	}
	seen := map[string]bool{}
	for _, table := range ProjectScopedTables {
		if seen[table] {
			t.Errorf("ProjectScopedTables 重复登记 %s", table)
		}
		seen[table] = true
	}
	if len(ProjectScopedTables) < 20 {
		t.Fatalf("ProjectScopedTables 只有 %d 张表，解析可能失效", len(ProjectScopedTables))
	}
	// models_gen.go 的「（项目域）」标注与登记清单一致。
	for _, m := range models {
		if m.scoped != seen[m.table] {
			t.Errorf("%s：models 注释项目域=%v，ProjectScopedTables 登记=%v", m.table, m.scoped, seen[m.table])
		}
	}
}

// 项目域表 → project 的外键必须是 RESTRICT（不带 ON DELETE）：删项目不能被级联带走数据。
func TestProjectForeignKeysNeverCascade(t *testing.T) {
	blocks := tableBlocks(t, readInitSQL(t))
	for _, table := range ProjectScopedTables {
		m := projectFKRe.FindStringSubmatch(blocks[table])
		if m == nil {
			t.Errorf("%s 没有指向 project 的外键", table)
			continue
		}
		if m[1] != "" {
			t.Errorf("%s 的 project 外键带了 ON DELETE %s，删除项目会连带删数据，必须保持 RESTRICT", table, m[1])
		}
	}
}

// 项目只对外显示名称：编码列已删除，标识是内部自增 id；名称唯一。
func TestProjectTableHasNoCodeColumn(t *testing.T) {
	block := tableBlocks(t, readInitSQL(t))["project"]
	if strings.Contains(block, "\n  code ") {
		t.Fatal("project 表不应再有 code 列")
	}
	if _, ok := reflect.TypeOf(Project{}).FieldByName("Code"); ok {
		t.Fatal("model.Project 不应再有 Code 字段")
	}
	if !strings.Contains(block, "uq_project_name") {
		t.Fatal("project 表缺少 uq_project_name")
	}
}

func TestInitSQLSeedsRequiredAccounts(t *testing.T) {
	sql := readInitSQL(t)
	for _, username := range []string{"admin", "warehouse", "purchase", "readonly"} {
		if !strings.Contains(sql, "('"+username+"', '$argon2id$") {
			t.Errorf("init.sql 缺少种子账号 %s", username)
		}
	}
	if !strings.Contains(sql, "gen_random_uuid()") {
		t.Error("init.sql 应使用 gen_random_uuid() 生成接口令牌")
	}
	if strings.Contains(sql, "measurement_unit") {
		t.Error("init.sql 不应再出现 measurement_unit")
	}
}

func TestFileIdentifiersAreUUIDStrings(t *testing.T) {
	blocks := tableBlocks(t, readInitSQL(t))
	for _, tc := range [][2]string{{"file_object", "id"}, {"stock_material_image", "file_id"}, {"purchase_material_image", "file_id"}} {
		found := false
		for _, c := range columnDefinitions(blocks[tc[0]]) {
			if c.name == tc[1] {
				found = true
				if !strings.HasPrefix(c.definition, "VARCHAR(36) NOT NULL") {
					t.Errorf("%s.%s 应为 VARCHAR(36) NOT NULL，实际 %s", tc[0], tc[1], c.definition)
				}
			}
		}
		if !found {
			t.Errorf("init.sql 缺少 %s.%s", tc[0], tc[1])
		}
	}
}
