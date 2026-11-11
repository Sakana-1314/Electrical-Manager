// Package codelib 对应原 services/material_code_library_service.py：物料编码库导入与查询。
package codelib

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importfile"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/importjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/price"
)

// 规范化后的列名。旧模板与仓储管理导出的物料编码表只是叫法不同，归一后都落到这四个列。
const (
	CodeHeader  = "编码"
	NameHeader  = "名称"
	ModelHeader = "型号"
	UnitHeader  = "记账单位名称"
)

// ExpectedHeaders 是物料表的必需列（规范化后的列名）。
var ExpectedHeaders = []string{CodeHeader, NameHeader, ModelHeader, UnitHeader}

// HeaderAliases 兼容仓储管理导出的物料编码表：物料编码 / 物料名称 / 型号 / 单位。
var HeaderAliases = map[string]string{
	"物料编码": CodeHeader,
	"物料名称": NameHeader,
	"规格型号": ModelHeader,
	"单位":   UnitHeader,
	"计量单位": UnitHeader,
}

// normalizeHeader 去掉表头里的空白（仓储导出表的「型号」列带尾部 Tab），再把别名归一到列名。
func normalizeHeader(v string) string {
	v = strings.Map(func(r rune) rune {
		if importfile.PyIsSpace(r) {
			return -1
		}
		return r
	}, v)
	if alias, ok := HeaderAliases[v]; ok {
		return alias
	}
	return v
}

const (
	MaxImportBytes = 50 * 1024 * 1024
	// maxModelSpec 与 material_code_library.model_spec 的 VARCHAR(255) 保持一致。
	maxModelSpec = 255
	// JobType 是导入任务类型。
	JobType = "MATERIAL_CODE_LIBRARY"
)

// Row 是解析出的一行物料编码。
type Row struct {
	MaterialCode string
	Name         *string
	ModelSpec    *string
	UnitName     string
	// ModelSpecTruncated 表示型号超出 VARCHAR(255)，保存时截断了尾部。
	ModelSpecTruncated bool
}

// ParseRows 对应 _parse_material_codes；表头同时兼容旧模板与仓储导出的物料编码表。
func ParseRows(rows [][]any) ([]Row, error) {
	headerRow, idx, ok := importfile.FindHeaders(rows, ExpectedHeaders, normalizeHeader)
	if !ok {
		return nil, apperr.New("MATERIAL_CODE_IMPORT_HEADERS_MISSING", "表格缺少必需列：编码（物料编码）、名称（物料名称）、型号、记账单位名称（单位）")
	}
	var parsed []Row
	seen := map[string]int{}
	for index := headerRow + 1; index < len(rows); index++ {
		rowNumber := index + 1
		values, empty := importfile.RowValues(rows[index], idx)
		if empty {
			continue
		}
		code := values[CodeHeader]
		if code == "" {
			return nil, apperr.New("MATERIAL_CODE_IMPORT_CODE_REQUIRED", fmt.Sprintf("第 %d 行缺少编码", rowNumber)).
				WithDetails(apperr.D{"row": rowNumber})
		}
		if values[UnitHeader] == "" {
			return nil, apperr.New("MATERIAL_CODE_IMPORT_UNIT_REQUIRED", fmt.Sprintf("第 %d 行缺少记账单位名称", rowNumber)).
				WithDetails(apperr.D{"row": rowNumber})
		}
		if first, dup := seen[code]; dup {
			return nil, apperr.New("MATERIAL_CODE_IMPORT_DUPLICATE",
				fmt.Sprintf("编码“%s”在第 %d 行和第 %d 行重复", code, first, rowNumber)).
				WithDetails(apperr.D{"material_code": code, "first_row": first, "duplicate_row": rowNumber})
		}
		for _, c := range []struct {
			h   string
			max int
		}{{CodeHeader, 64}, {NameHeader, 128}, {UnitHeader, 32}} {
			if err := importfile.ValidateLength("MATERIAL_CODE_IMPORT_VALUE_TOO_LONG", values[c.h], c.max, rowNumber, c.h); err != nil {
				return nil, err
			}
		}
		// 型号是自由文本，仓储导出表里有超过 255 字符的长描述：截断保存并在结果里回报条数，
		// 避免单行超长让整个文件导入失败。
		modelSpec := values[ModelHeader]
		truncated := utf8.RuneCountInString(modelSpec) > maxModelSpec
		if truncated {
			modelSpec = string([]rune(modelSpec)[:maxModelSpec])
		}
		seen[code] = rowNumber
		parsed = append(parsed, Row{
			MaterialCode:       code,
			Name:               importfile.NilIfEmpty(values[NameHeader]),
			ModelSpec:          importfile.NilIfEmpty(modelSpec),
			UnitName:           values[UnitHeader],
			ModelSpecTruncated: truncated,
		})
	}
	if len(parsed) == 0 {
		return nil, apperr.New("MATERIAL_CODE_IMPORT_EMPTY", "表格中没有可导入的物料编码数据")
	}
	return parsed, nil
}

// ParseFile 对应 parse_material_code_file。
func ParseFile(path string) ([]Row, error) {
	rows, err := importfile.ReadTabularRows(path)
	if err != nil {
		return nil, err
	}
	return ParseRows(rows)
}

// ProcessImportFile 是异步导入处理器：解析（任何变更之前，坏文件不动现有数据）→ 全量替换 → 返回结果摘要。
func ProcessImportFile(ctx context.Context, s *db.Session, filePath string) (map[string]any, error) {
	rows, err := ParseFile(filePath)
	if err != nil {
		return nil, err
	}
	args := make([][]any, len(rows))
	blankName, blankModel, truncatedModel := 0, 0, 0
	for i, r := range rows {
		args[i] = []any{r.MaterialCode, r.Name, r.ModelSpec, r.UnitName}
		if r.Name == nil {
			blankName++
		}
		if r.ModelSpec == nil {
			blankModel++
		}
		if r.ModelSpecTruncated {
			truncatedModel++
		}
	}
	if err := importjob.ReplaceProjectRows(s, model.TableMaterialCodeLibrary, []string{"material_code", "name", "model_spec", "unit_name"}, args); err != nil {
		return nil, err
	}
	return map[string]any{
		"imported_count":             len(rows),
		"blank_name_count":           blankName,
		"blank_model_spec_count":     blankModel,
		"truncated_model_spec_count": truncatedModel,
	}, nil
}

// MaterialCodeExists 编码是否已收录于当前项目的物料编码库（空编码返回 false）。
func MaterialCodeExists(s *db.Session, materialCode string) (bool, error) {
	if materialCode == "" {
		return false, nil
	}
	pid, err := s.ProjectID()
	if err != nil {
		return false, err
	}
	var id int64
	return s.Find(&id, "SELECT id FROM material_code_library WHERE project_id = ? AND material_code = ? LIMIT 1", pid, materialCode)
}

// SearchParams 是 Search 的筛选条件。
type SearchParams struct {
	Keyword      *string
	Name         *string
	ModelSpec    *string
	MaterialCode *string
	Page         int64
	PageSize     int64
}

// Search 对应 search_material_codes：keyword 跨编码 / 名称 / 型号；字段筛选之间 AND；按编码排序；
// 单价按编码单独批量取（价格表没有的编码照样返回，只是没有价格）。
func Search(s *db.Session, p SearchParams) ([]schema.MaterialCodeLibraryRead, int64, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"material_code", "name", "model_spec"}, p.Keyword)
	w.ContainsAny([]string{"name"}, p.Name)
	w.ContainsAny([]string{"model_spec"}, p.ModelSpec)
	w.ContainsAny([]string{"material_code"}, p.MaterialCode)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM material_code_library"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []model.MaterialCodeLibrary
	args := append(append([]any{}, w.Args...), p.PageSize, common.Offset(p.Page, p.PageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsMaterialCodeLibrary+" FROM material_code_library"+w.SQL()+" ORDER BY material_code LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	codes := make([]string, len(rows))
	for i, r := range rows {
		codes[i] = r.MaterialCode
	}
	prices, err := price.LoadUnitPrices(s, codes)
	if err != nil {
		return nil, 0, err
	}
	items := make([]schema.MaterialCodeLibraryRead, len(rows))
	for i, r := range rows {
		item := schema.MaterialCodeLibraryRead{ID: r.ID, MaterialCode: r.MaterialCode, Name: r.Name, ModelSpec: r.ModelSpec, UnitName: r.UnitName}
		if v, ok := prices[r.MaterialCode]; ok {
			item.UnitPrice = &v
		}
		items[i] = item
	}
	return items, total, nil
}

// GetByID 按 id 读取单行编码；项目域过滤由会话 Scope 负责，无结果返回 (nil, nil)。
func GetByID(s *db.Session, id int64) (*model.MaterialCodeLibrary, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var row model.MaterialCodeLibrary
	found, err := s.Find(&row, "SELECT "+model.ColsMaterialCodeLibrary+" FROM material_code_library"+w.SQL(), w.Args...)
	if err != nil || !found {
		return nil, err
	}
	return &row, nil
}
