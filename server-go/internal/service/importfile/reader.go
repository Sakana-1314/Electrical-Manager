// Package importfile 对应原 services/import_file_reader.py：按扩展名统一读取 xlsx/xlsm/xls/csv 为二维单元格值。
//
// 物料编码库、物料价格、华星库存与精简二级库共用底层读取器。这里只负责把文件解析成
// [][]any（每行是原始单元格值列表），表头定位、字段校验、日期/数量换算由各 service 负责。
//
// 单元格值的 Go 类型与原 openpyxl / xlrd 返回的 Python 类型一一对应，下游按这些类型做解析：
//
//	nil        ↔ None（空单元格）
//	string     ↔ str
//	int64      ↔ int（openpyxl 读到不带小数点 / 指数的数字；xlrd 的布尔 / 错误码也是 int）
//	*big.Int   ↔ 超出 int64 的 Python int
//	float64    ↔ float
//	bool       ↔ bool（仅 openpyxl）
//	time.Time  ↔ datetime.datetime（naive）
//	TimeOfDay  ↔ datetime.time（openpyxl 对 [0, 1) 区间日期序列值返回时间）
//	time.Duration ↔ datetime.timedelta（openpyxl 的 [h]:mm:ss 一类格式）
//
// 约定：xlsx/xlsm 复刻 openpyxl 只读模式（data_only=True，读取缓存值）；xls 复刻 xlrd
// （formatting_info=False，第一个工作表）；csv 复刻标准库 csv（自动探测 UTF-8(BOM)/GB18030 编码）。
package importfile

import (
	"path/filepath"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

// SupportedSuffixes 与 API 层校验保持一致；改动时两处都要同步。
var SupportedSuffixes = []string{".xlsx", ".xlsm", ".xls", ".csv"}

// HasSupportedSuffix 对应 filename.lower().endswith(SUPPORTED_IMPORT_SUFFIXES)。
func HasSupportedSuffix(filename string) bool {
	lower := strings.ToLower(filename)
	for _, s := range SupportedSuffixes {
		if strings.HasSuffix(lower, s) {
			return true
		}
	}
	return false
}

// UnsupportedFileError 是 UNSUPPORTED_EXCEL_FILE 业务错误。
func UnsupportedFileError() *apperr.Error {
	return apperr.New("UNSUPPORTED_EXCEL_FILE", "仅支持 .xls、.xlsx 或 .csv 格式的表格文件")
}

// PySuffix 等价 pathlib.PurePath(name).suffix（最后一个点及其后内容；隐藏文件名 / 以点结尾时为空）。
func PySuffix(name string) string {
	name = filepath.Base(strings.ReplaceAll(name, "\\", "/"))
	i := strings.LastIndexByte(name, '.')
	if i <= 0 || i == len(name)-1 {
		return ""
	}
	return name[i:]
}

// ReadTabularRows 读取表格文件为二维原始值；不支持的类型返回 UNSUPPORTED_EXCEL_FILE。
func ReadTabularRows(path string) ([][]any, error) {
	switch strings.ToLower(PySuffix(path)) {
	case ".xlsx", ".xlsm":
		return readXLSX(path)
	case ".xls":
		return readXLS(path)
	case ".csv":
		return readCSV(path)
	}
	return nil, UnsupportedFileError()
}

func invalidExcel() *apperr.Error {
	return apperr.New("INVALID_EXCEL_FILE", "无法读取 Excel 文件，请确认文件格式正确")
}

func unknownExcel() *apperr.Error {
	return apperr.New("INVALID_EXCEL_FILE", "读取 Excel 文件时发生未知错误，请确认文件未被损坏")
}
