package schema

import "github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"

// HuaXingInventoryRead 是华星库存行。
type HuaXingInventoryRead struct {
	ID                 int64          `json:"id"`
	FirstInboundDate   *jtype.Date    `json:"first_inbound_date"`
	Warehouse          *string        `json:"warehouse"`
	MaterialCode       *string        `json:"material_code"`
	Name               *string        `json:"name"`
	ModelSpec          *string        `json:"model_spec"`
	Quantity           *jtype.Decimal `json:"quantity"`
	UnitName           *string        `json:"unit_name"`
	Purchaser          *string        `json:"purchaser"`
	PurchaseDepartment *string        `json:"purchase_department"`
	SubitemNoName      *string        `json:"subitem_no_name"`
}

// HuaXingFilterOptions 是华星库存筛选下拉选项。
type HuaXingFilterOptions struct {
	PurchaseDepartments []string `json:"purchase_departments"`
	Purchasers          []string `json:"purchasers"`
}

// LiteInventoryRead 是管理端精简二级库行（Excel 一次性导入 + 只读查询）。
type LiteInventoryRead struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	ModelSpec *string        `json:"model_spec"`
	UnitName  *string        `json:"unit_name"`
	Quantity  *jtype.Decimal `json:"quantity"`
	Remark    *string        `json:"remark"`
}

// MaterialCodeLibraryRead 是物料编码库行；unit_price 来自「价格表」（无匹配时为 null）。
type MaterialCodeLibraryRead struct {
	ID           int64          `json:"id"`
	MaterialCode string         `json:"material_code"`
	Name         *string        `json:"name"`
	ModelSpec    *string        `json:"model_spec"`
	UnitName     string         `json:"unit_name"`
	UnitPrice    *jtype.Decimal `json:"unit_price"`
}

// MaterialCodeExistsRead 是编码存在性软校验结果。
type MaterialCodeExistsRead struct {
	MaterialCode string `json:"material_code"`
	Exists       bool   `json:"exists"`
}

// MaterialCodeLibraryImportRead 是物料编码导入结果摘要。
type MaterialCodeLibraryImportRead struct {
	ImportedCount       int64 `json:"imported_count"`
	BlankNameCount      int64 `json:"blank_name_count"`
	BlankModelSpecCount int64 `json:"blank_model_spec_count"`
}
