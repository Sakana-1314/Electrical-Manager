// 表结构体：与 docs/references/database/init.sql 一一对应（列名、可空性由 model_test.go 对照 init.sql 校验）。
// 改表结构时同步修改 init.sql 与本文件。

package model

import (
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

var _ = time.Time{}

// BusinessEventLog ↔ 表 `business_event_log`。
type BusinessEventLog struct {
	ID           int64      `db:"id" json:"id"`
	BusinessType string     `db:"business_type" json:"business_type"`
	BusinessID   int64      `db:"business_id" json:"business_id"`
	Action       string     `db:"action" json:"action"`
	OldStatus    *string    `db:"old_status" json:"old_status"`
	NewStatus    *string    `db:"new_status" json:"new_status"`
	OccurredAt   time.Time  `db:"occurred_at" json:"occurred_at"`
	Remark       *string    `db:"remark" json:"remark"`
	BeforeData   jtype.JSON `db:"before_data" json:"before_data"`
	AfterData    jtype.JSON `db:"after_data" json:"after_data"`
}

const TableBusinessEventLog = "business_event_log"
const ColsBusinessEventLog = `"id", "business_type", "business_id", "action", "old_status", "new_status", "occurred_at", "remark", "before_data", "after_data"`

// ExcelExportJob ↔ 表 `excel_export_job`（项目域）。
type ExcelExportJob struct {
	ID               int64      `db:"id" json:"id"`
	ExportType       string     `db:"export_type" json:"export_type"`
	Status           string     `db:"status" json:"status"` // enum: PENDING, RUNNING, SUCCEEDED, FAILED
	DownloadFilename *string    `db:"download_filename" json:"download_filename"`
	FilePath         *string    `db:"file_path" json:"file_path"`
	Params           jtype.JSON `db:"params" json:"params"`
	Result           jtype.JSON `db:"result" json:"result"`
	ErrorCode        *string    `db:"error_code" json:"error_code"`
	ErrorMessage     *string    `db:"error_message" json:"error_message"`
	CreatedBy        *int64     `db:"created_by" json:"created_by"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	StartedAt        *time.Time `db:"started_at" json:"started_at"`
	FinishedAt       *time.Time `db:"finished_at" json:"finished_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
	ProjectID        int64      `db:"project_id" json:"project_id"`
}

const TableExcelExportJob = "excel_export_job"
const ColsExcelExportJob = `"id", "export_type", "status", "download_filename", "file_path", "params", "result", "error_code", "error_message", "created_by", "created_at", "started_at", "finished_at", "updated_at", "project_id"`

// ExcelImportJob ↔ 表 `excel_import_job`（项目域）。
type ExcelImportJob struct {
	ID               int64      `db:"id" json:"id"`
	ImportType       string     `db:"import_type" json:"import_type"`
	Status           string     `db:"status" json:"status"` // enum: PENDING, RUNNING, SUCCEEDED, FAILED
	OriginalFilename string     `db:"original_filename" json:"original_filename"`
	FilePath         string     `db:"file_path" json:"file_path"`
	Result           jtype.JSON `db:"result" json:"result"`
	ErrorCode        *string    `db:"error_code" json:"error_code"`
	ErrorMessage     *string    `db:"error_message" json:"error_message"`
	CreatedBy        *int64     `db:"created_by" json:"created_by"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	StartedAt        *time.Time `db:"started_at" json:"started_at"`
	FinishedAt       *time.Time `db:"finished_at" json:"finished_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
	ProjectID        int64      `db:"project_id" json:"project_id"`
}

const TableExcelImportJob = "excel_import_job"
const ColsExcelImportJob = `"id", "import_type", "status", "original_filename", "file_path", "result", "error_code", "error_message", "created_by", "created_at", "started_at", "finished_at", "updated_at", "project_id"`

// FileObject ↔ 表 `file_object`。
type FileObject struct {
	ID           string     `db:"id" json:"id"`
	OriginalName string     `db:"original_name" json:"original_name"`
	MimeType     string     `db:"mime_type" json:"mime_type"`
	SizeBytes    int64      `db:"size_bytes" json:"size_bytes"`
	Width        int64      `db:"width" json:"width"`
	Height       int64      `db:"height" json:"height"`
	SHA256       string     `db:"sha256" json:"sha256"`
	SourceSHA256 *string    `db:"source_sha256" json:"source_sha256"`
	SourceProbes jtype.JSON `db:"source_probes" json:"source_probes"`
	DeletedAt    *time.Time `db:"deleted_at" json:"deleted_at"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
	Version      int64      `db:"version" json:"version"`
}

const TableFileObject = "file_object"
const ColsFileObject = `"id", "original_name", "mime_type", "size_bytes", "width", "height", "sha256", "source_sha256", "source_probes", "deleted_at", "created_at", "updated_at", "version"`

// Hazard ↔ 表 `hazard`（项目域）。
type Hazard struct {
	ID              int64      `db:"id" json:"id"`
	InspectionArea  string     `db:"inspection_area" json:"inspection_area"`
	InspectionDate  jtype.Date `db:"inspection_date" json:"inspection_date"`
	Inspector       string     `db:"inspector" json:"inspector"`
	Description     string     `db:"description" json:"description"`
	Suggestion      *string    `db:"suggestion" json:"suggestion"`
	HazardUnitID    int64      `db:"hazard_unit_id" json:"hazard_unit_id"`
	Person          string     `db:"person" json:"person"`
	DueDate         jtype.Date `db:"due_date" json:"due_date"`
	RecheckPerson   *string    `db:"recheck_person" json:"recheck_person"`
	RectifyPerson   *string    `db:"rectify_person" json:"rectify_person"`
	Status          string     `db:"status" json:"status"` // enum: PENDING, BLOCKED, DONE
	HazardTypeID    int64      `db:"hazard_type_id" json:"hazard_type_id"`
	Level           string     `db:"level" json:"level"` // enum: GENERAL, MAJOR
	Remark          *string    `db:"remark" json:"remark"`
	ClientRequestID *string    `db:"client_request_id" json:"client_request_id"`
	ProjectID       int64      `db:"project_id" json:"project_id"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
	Version         int64      `db:"version" json:"version"`
}

const TableHazard = "hazard"
const ColsHazard = `"id", "inspection_area", "inspection_date", "inspector", "description", "suggestion", "hazard_unit_id", "person", "due_date", "recheck_person", "rectify_person", "status", "hazard_type_id", "level", "remark", "client_request_id", "project_id", "created_at", "updated_at", "version"`

// HazardAfterImage ↔ 表 `hazard_after_image`（项目域）。
type HazardAfterImage struct {
	HazardID  int64  `db:"hazard_id" json:"hazard_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TableHazardAfterImage = "hazard_after_image"
const ColsHazardAfterImage = `"hazard_id", "file_id", "sort_order", "project_id"`

// HazardBeforeImage ↔ 表 `hazard_before_image`（项目域）。
type HazardBeforeImage struct {
	HazardID  int64  `db:"hazard_id" json:"hazard_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TableHazardBeforeImage = "hazard_before_image"
const ColsHazardBeforeImage = `"hazard_id", "file_id", "sort_order", "project_id"`

// HazardType ↔ 表 `hazard_type`（项目域）。
type HazardType struct {
	ID        int64     `db:"id" json:"id"`
	Major     string    `db:"major" json:"major"`
	Minor     string    `db:"minor" json:"minor"`
	ProjectID int64     `db:"project_id" json:"project_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableHazardType = "hazard_type"
const ColsHazardType = `"id", "major", "minor", "project_id", "created_at", "updated_at", "version"`

// HazardUnit ↔ 表 `hazard_unit`（项目域）。
type HazardUnit struct {
	ID        int64     `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Person    string    `db:"person" json:"person"`
	Remark    *string   `db:"remark" json:"remark"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	ProjectID int64     `db:"project_id" json:"project_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableHazardUnit = "hazard_unit"
const ColsHazardUnit = `"id", "name", "person", "remark", "enabled", "project_id", "created_at", "updated_at", "version"`

// HuaxingInventory ↔ 表 `huaxing_inventory`（项目域）。
type HuaxingInventory struct {
	ID                 int64          `db:"id" json:"id"`
	FirstInboundDate   *jtype.Date    `db:"first_inbound_date" json:"first_inbound_date"`
	Warehouse          *string        `db:"warehouse" json:"warehouse"`
	MaterialCode       *string        `db:"material_code" json:"material_code"`
	Name               *string        `db:"name" json:"name"`
	ModelSpec          *string        `db:"model_spec" json:"model_spec"`
	Quantity           *jtype.Decimal `db:"quantity" json:"quantity"`
	UnitName           *string        `db:"unit_name" json:"unit_name"`
	Purchaser          *string        `db:"purchaser" json:"purchaser"`
	PurchaseDepartment *string        `db:"purchase_department" json:"purchase_department"`
	SubitemNoName      *string        `db:"subitem_no_name" json:"subitem_no_name"`
	CreatedAt          time.Time      `db:"created_at" json:"created_at"`
	ProjectID          int64          `db:"project_id" json:"project_id"`
}

const TableHuaxingInventory = "huaxing_inventory"
const ColsHuaxingInventory = `"id", "first_inbound_date", "warehouse", "material_code", "name", "model_spec", "quantity", "unit_name", "purchaser", "purchase_department", "subitem_no_name", "created_at", "project_id"`

// Ledger ↔ 表 `ledger`（项目域）。
type Ledger struct {
	ID        int64     `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	ModelSpec string    `db:"model_spec" json:"model_spec"`
	SubitemNo *string   `db:"subitem_no" json:"subitem_no"`
	Quantity  int64     `db:"quantity" json:"quantity"`
	UnitName  string    `db:"unit_name" json:"unit_name"`
	Usage     string    `db:"usage" json:"usage"`
	Remark    *string   `db:"remark" json:"remark"`
	TagIds    string    `db:"tag_ids" json:"tag_ids"`
	ProjectID int64     `db:"project_id" json:"project_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableLedger = "ledger"
const ColsLedger = `"id", "name", "model_spec", "subitem_no", "quantity", "unit_name", "usage", "remark", "tag_ids", "project_id", "created_at", "updated_at", "version"`

// LedgerImage ↔ 表 `ledger_image`（项目域）。
type LedgerImage struct {
	LedgerID  int64  `db:"ledger_id" json:"ledger_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TableLedgerImage = "ledger_image"
const ColsLedgerImage = `"ledger_id", "file_id", "sort_order", "project_id"`

// LedgerTag ↔ 表 `ledger_tag`（项目域）。
type LedgerTag struct {
	ID        int64     `db:"id" json:"id"`
	ParentID  *int64    `db:"parent_id" json:"parent_id"`
	Name      string    `db:"name" json:"name"`
	Remark    *string   `db:"remark" json:"remark"`
	ProjectID int64     `db:"project_id" json:"project_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableLedgerTag = "ledger_tag"
const ColsLedgerTag = `"id", "parent_id", "name", "remark", "project_id", "created_at", "updated_at", "version"`

// LedgerTagImage ↔ 表 `ledger_tag_image`（项目域）。
type LedgerTagImage struct {
	TagID     int64  `db:"tag_id" json:"tag_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TableLedgerTagImage = "ledger_tag_image"
const ColsLedgerTagImage = `"tag_id", "file_id", "sort_order", "project_id"`

// LiteInventory ↔ 表 `lite_inventory`（项目域）。
type LiteInventory struct {
	ID        int64          `db:"id" json:"id"`
	Name      string         `db:"name" json:"name"`
	ModelSpec *string        `db:"model_spec" json:"model_spec"`
	UnitName  *string        `db:"unit_name" json:"unit_name"`
	Quantity  *jtype.Decimal `db:"quantity" json:"quantity"`
	Remark    *string        `db:"remark" json:"remark"`
	CreatedAt time.Time      `db:"created_at" json:"created_at"`
	ProjectID int64          `db:"project_id" json:"project_id"`
}

const TableLiteInventory = "lite_inventory"
const ColsLiteInventory = `"id", "name", "model_spec", "unit_name", "quantity", "remark", "created_at", "project_id"`

// MaterialCodeLibrary ↔ 表 `material_code_library`（项目域）。
type MaterialCodeLibrary struct {
	ID           int64     `db:"id" json:"id"`
	MaterialCode string    `db:"material_code" json:"material_code"`
	Name         *string   `db:"name" json:"name"`
	ModelSpec    *string   `db:"model_spec" json:"model_spec"`
	UnitName     string    `db:"unit_name" json:"unit_name"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	ProjectID    int64     `db:"project_id" json:"project_id"`
}

const TableMaterialCodeLibrary = "material_code_library"
const ColsMaterialCodeLibrary = `"id", "material_code", "name", "model_spec", "unit_name", "created_at", "project_id"`

// MaterialPrice ↔ 表 `material_price`（项目域）。
type MaterialPrice struct {
	ID           int64         `db:"id" json:"id"`
	MaterialCode string        `db:"material_code" json:"material_code"`
	UnitPrice    jtype.Decimal `db:"unit_price" json:"unit_price"`
	CreatedAt    time.Time     `db:"created_at" json:"created_at"`
	ProjectID    int64         `db:"project_id" json:"project_id"`
}

const TableMaterialPrice = "material_price"
const ColsMaterialPrice = `"id", "material_code", "unit_price", "created_at", "project_id"`

// Memo ↔ 表 `memo`。
type Memo struct {
	ID        int64     `db:"id" json:"id"`
	Title     string    `db:"title" json:"title"`
	Content   string    `db:"content" json:"content"`
	CreatedBy int64     `db:"created_by" json:"created_by"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableMemo = "memo"
const ColsMemo = `"id", "title", "content", "created_by", "created_at", "updated_at", "version"`

// MiniProgramIdentity ↔ 表 `mini_program_identity`。
type MiniProgramIdentity struct {
	ID                int64     `db:"id" json:"id"`
	MiniProgramUserID int64     `db:"mini_program_user_id" json:"mini_program_user_id"`
	AppID             string    `db:"app_id" json:"app_id"`
	WechatOpenid      string    `db:"wechat_openid" json:"wechat_openid"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
	Version           int64     `db:"version" json:"version"`
}

const TableMiniProgramIdentity = "mini_program_identity"
const ColsMiniProgramIdentity = `"id", "mini_program_user_id", "app_id", "wechat_openid", "created_at", "updated_at", "version"`

// MiniProgramUser ↔ 表 `mini_program_user`。
type MiniProgramUser struct {
	ID             int64      `db:"id" json:"id"`
	DisplayName    string     `db:"display_name" json:"display_name"`
	DepartmentName string     `db:"department_name" json:"department_name"`
	Enabled        bool       `db:"enabled" json:"enabled"`
	LastUsedAt     *time.Time `db:"last_used_at" json:"last_used_at"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
	Version        int64      `db:"version" json:"version"`
}

const TableMiniProgramUser = "mini_program_user"
const ColsMiniProgramUser = `"id", "display_name", "department_name", "enabled", "last_used_at", "created_at", "updated_at", "version"`

// Project ↔ 表 `project`。
type Project struct {
	ID        int64     `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	Enabled   bool      `db:"enabled" json:"enabled"`
	IsDefault bool      `db:"is_default" json:"is_default"`
	Remark    *string   `db:"remark" json:"remark"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
	Version   int64     `db:"version" json:"version"`
}

const TableProject = "project"
const ColsProject = `"id", "name", "enabled", "is_default", "remark", "created_at", "updated_at", "version"`

// PurchaseMaterial ↔ 表 `purchase_material`（项目域）。
type PurchaseMaterial struct {
	ID                  int64         `db:"id" json:"id"`
	PlanNo              string        `db:"plan_no" json:"plan_no"`
	PlanDate            jtype.Date    `db:"plan_date" json:"plan_date"`
	MaterialCode        *string       `db:"material_code" json:"material_code"`
	Category            *string       `db:"category" json:"category"`
	Urgency             string        `db:"urgency" json:"urgency"`
	DemandDepartment    string        `db:"demand_department" json:"demand_department"`
	Name                string        `db:"name" json:"name"`
	ModelSpec           string        `db:"model_spec" json:"model_spec"`
	UnitName            string        `db:"unit_name" json:"unit_name"`
	ActualDemandPerson  string        `db:"actual_demand_person" json:"actual_demand_person"`
	PurchaseResponsible string        `db:"purchase_responsible" json:"purchase_responsible"`
	PlannedQty          jtype.Decimal `db:"planned_qty" json:"planned_qty"`
	Usage               string        `db:"usage" json:"usage"`
	SubitemNo           *string       `db:"subitem_no" json:"subitem_no"`
	Remark              *string       `db:"remark" json:"remark"`
	StockMaterialID     *int64        `db:"stock_material_id" json:"stock_material_id"`
	Status              string        `db:"status" json:"status"` // enum: NORMAL, DEFERRED, ARCHIVED
	ProjectID           int64         `db:"project_id" json:"project_id"`
	CreatedAt           time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time     `db:"updated_at" json:"updated_at"`
	Version             int64         `db:"version" json:"version"`
}

const TablePurchaseMaterial = "purchase_material"
const ColsPurchaseMaterial = `"id", "plan_no", "plan_date", "material_code", "category", "urgency", "demand_department", "name", "model_spec", "unit_name", "actual_demand_person", "purchase_responsible", "planned_qty", "usage", "subitem_no", "remark", "stock_material_id", "status", "project_id", "created_at", "updated_at", "version"`

// PurchaseMaterialImage ↔ 表 `purchase_material_image`（项目域）。
type PurchaseMaterialImage struct {
	MaterialID int64  `db:"material_id" json:"material_id"`
	FileID     string `db:"file_id" json:"file_id"`
	SortOrder  int64  `db:"sort_order" json:"sort_order"`
	ProjectID  int64  `db:"project_id" json:"project_id"`
}

const TablePurchaseMaterialImage = "purchase_material_image"
const ColsPurchaseMaterialImage = `"material_id", "file_id", "sort_order", "project_id"`

// PurchasePlanTemplate ↔ 表 `purchase_plan_template`（项目域）。
type PurchasePlanTemplate struct {
	ID                  int64         `db:"id" json:"id"`
	MaterialCode        *string       `db:"material_code" json:"material_code"`
	Category            *string       `db:"category" json:"category"`
	Urgency             string        `db:"urgency" json:"urgency"`
	DemandDepartment    string        `db:"demand_department" json:"demand_department"`
	Name                string        `db:"name" json:"name"`
	ModelSpec           string        `db:"model_spec" json:"model_spec"`
	UnitName            string        `db:"unit_name" json:"unit_name"`
	ActualDemandPerson  string        `db:"actual_demand_person" json:"actual_demand_person"`
	PurchaseResponsible string        `db:"purchase_responsible" json:"purchase_responsible"`
	PlannedQty          jtype.Decimal `db:"planned_qty" json:"planned_qty"`
	Usage               string        `db:"usage" json:"usage"`
	SubitemNo           *string       `db:"subitem_no" json:"subitem_no"`
	Remark              *string       `db:"remark" json:"remark"`
	StockMaterialID     *int64        `db:"stock_material_id" json:"stock_material_id"`
	ProjectID           int64         `db:"project_id" json:"project_id"`
	CreatedAt           time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time     `db:"updated_at" json:"updated_at"`
	Version             int64         `db:"version" json:"version"`
}

const TablePurchasePlanTemplate = "purchase_plan_template"
const ColsPurchasePlanTemplate = `"id", "material_code", "category", "urgency", "demand_department", "name", "model_spec", "unit_name", "actual_demand_person", "purchase_responsible", "planned_qty", "usage", "subitem_no", "remark", "stock_material_id", "project_id", "created_at", "updated_at", "version"`

// PurchasePlanTemplateImage ↔ 表 `purchase_plan_template_image`（项目域）。
type PurchasePlanTemplateImage struct {
	PlanID    int64  `db:"plan_id" json:"plan_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TablePurchasePlanTemplateImage = "purchase_plan_template_image"
const ColsPurchasePlanTemplateImage = `"plan_id", "file_id", "sort_order", "project_id"`

// PurchaseRequest ↔ 表 `purchase_request`（项目域）。
type PurchaseRequest struct {
	ID                int64       `db:"id" json:"id"`
	PurchaseOrderNo   *string     `db:"purchase_order_no" json:"purchase_order_no"`
	ContractNo        *string     `db:"contract_no" json:"contract_no"`
	VesselNo          *string     `db:"vessel_no" json:"vessel_no"`
	ConsolidationDate *jtype.Date `db:"consolidation_date" json:"consolidation_date"`
	ConsolidationPort *string     `db:"consolidation_port" json:"consolidation_port"`
	SailingDate       *jtype.Date `db:"sailing_date" json:"sailing_date"`
	Remark            *string     `db:"remark" json:"remark"`
	PurchaseDate      *jtype.Date `db:"purchase_date" json:"purchase_date"`
	ProjectID         int64       `db:"project_id" json:"project_id"`
	CreatedAt         time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time   `db:"updated_at" json:"updated_at"`
	Version           int64       `db:"version" json:"version"`
}

const TablePurchaseRequest = "purchase_request"
const ColsPurchaseRequest = `"id", "purchase_order_no", "contract_no", "vessel_no", "consolidation_date", "consolidation_port", "sailing_date", "remark", "purchase_date", "project_id", "created_at", "updated_at", "version"`

// PurchaseRequestLine ↔ 表 `purchase_request_line`（项目域）。
type PurchaseRequestLine struct {
	ID                          int64          `db:"id" json:"id"`
	PurchaseRequestID           int64          `db:"purchase_request_id" json:"purchase_request_id"`
	PurchaseMaterialID          *int64         `db:"purchase_material_id" json:"purchase_material_id"`
	PlanNoSnapshot              string         `db:"plan_no_snapshot" json:"plan_no_snapshot"`
	PlanDateSnapshot            jtype.Date     `db:"plan_date_snapshot" json:"plan_date_snapshot"`
	MaterialCodeSnapshot        *string        `db:"material_code_snapshot" json:"material_code_snapshot"`
	CategorySnapshot            *string        `db:"category_snapshot" json:"category_snapshot"`
	DemandDepartmentSnapshot    string         `db:"demand_department_snapshot" json:"demand_department_snapshot"`
	MaterialNameSnapshot        string         `db:"material_name_snapshot" json:"material_name_snapshot"`
	ModelSpecSnapshot           string         `db:"model_spec_snapshot" json:"model_spec_snapshot"`
	UnitNameSnapshot            string         `db:"unit_name_snapshot" json:"unit_name_snapshot"`
	ActualDemandPersonSnapshot  string         `db:"actual_demand_person_snapshot" json:"actual_demand_person_snapshot"`
	PurchaseResponsibleSnapshot string         `db:"purchase_responsible_snapshot" json:"purchase_responsible_snapshot"`
	PlanRemarkSnapshot          *string        `db:"plan_remark_snapshot" json:"plan_remark_snapshot"`
	StockMaterialIDSnapshot     *int64         `db:"stock_material_id_snapshot" json:"stock_material_id_snapshot"`
	PurchaseQty                 jtype.Decimal  `db:"purchase_qty" json:"purchase_qty"`
	Status                      string         `db:"status" json:"status"`
	Usage                       string         `db:"usage" json:"usage"`
	UsageHash                   string         `db:"usage_hash" json:"usage_hash"`
	SubitemNo                   *string        `db:"subitem_no" json:"subitem_no"`
	TraceNo                     *string        `db:"trace_no" json:"trace_no"`
	Salesperson                 *string        `db:"salesperson" json:"salesperson"`
	ContractSignDate            *jtype.Date    `db:"contract_sign_date" json:"contract_sign_date"`
	UnitPrice                   *jtype.Decimal `db:"unit_price" json:"unit_price"`
	ProjectID                   int64          `db:"project_id" json:"project_id"`
	CreatedAt                   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt                   time.Time      `db:"updated_at" json:"updated_at"`
	Version                     int64          `db:"version" json:"version"`
}

const TablePurchaseRequestLine = "purchase_request_line"
const ColsPurchaseRequestLine = `"id", "purchase_request_id", "purchase_material_id", "plan_no_snapshot", "plan_date_snapshot", "material_code_snapshot", "category_snapshot", "demand_department_snapshot", "material_name_snapshot", "model_spec_snapshot", "unit_name_snapshot", "actual_demand_person_snapshot", "purchase_responsible_snapshot", "plan_remark_snapshot", "stock_material_id_snapshot", "purchase_qty", "status", "usage", "usage_hash", "subitem_no", "trace_no", "salesperson", "contract_sign_date", "unit_price", "project_id", "created_at", "updated_at", "version"`

// PurchaseRequestLineImage ↔ 表 `purchase_request_line_image`（项目域）。
type PurchaseRequestLineImage struct {
	LineID    int64  `db:"line_id" json:"line_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TablePurchaseRequestLineImage = "purchase_request_line_image"
const ColsPurchaseRequestLineImage = `"line_id", "file_id", "sort_order", "project_id"`

// ShareLink ↔ 表 `share_link`（项目域）。
type ShareLink struct {
	ID        int64      `db:"id" json:"id"`
	Token     string     `db:"token" json:"token"`
	ShareType string     `db:"share_type" json:"share_type"` // enum: PURCHASE_PLAN, PURCHASE_RECORD
	ItemIds   jtype.JSON `db:"item_ids" json:"item_ids"`
	Columns   jtype.JSON `db:"columns" json:"columns"`
	ExpiresAt *time.Time `db:"expires_at" json:"expires_at"`
	CreatedBy *int64     `db:"created_by" json:"created_by"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
	ProjectID int64      `db:"project_id" json:"project_id"`
}

const TableShareLink = "share_link"
const ColsShareLink = `"id", "token", "share_type", "item_ids", "columns", "expires_at", "created_by", "created_at", "updated_at", "project_id"`

// StockBalance ↔ 表 `stock_balance`（项目域）。
type StockBalance struct {
	StockMaterialID int64         `db:"stock_material_id" json:"stock_material_id"`
	Quantity        jtype.Decimal `db:"quantity" json:"quantity"`
	Version         int64         `db:"version" json:"version"`
	UpdatedAt       time.Time     `db:"updated_at" json:"updated_at"`
	ProjectID       int64         `db:"project_id" json:"project_id"`
}

const TableStockBalance = "stock_balance"
const ColsStockBalance = `"stock_material_id", "quantity", "version", "updated_at", "project_id"`

// StockMaterial ↔ 表 `stock_material`（项目域）。
type StockMaterial struct {
	ID           int64     `db:"id" json:"id"`
	UUID         string    `db:"uuid" json:"uuid"`
	Name         string    `db:"name" json:"name"`
	NameID       *string   `db:"name_id" json:"name_id"`
	Alias        *string   `db:"alias" json:"alias"`
	ModelSpec    string    `db:"model_spec" json:"model_spec"`
	UnitName     string    `db:"unit_name" json:"unit_name"`
	Remark       *string   `db:"remark" json:"remark"`
	IdentityHash string    `db:"identity_hash" json:"identity_hash"`
	ProjectID    int64     `db:"project_id" json:"project_id"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
	Version      int64     `db:"version" json:"version"`
}

const TableStockMaterial = "stock_material"
const ColsStockMaterial = `"id", "uuid", "name", "name_id", "alias", "model_spec", "unit_name", "remark", "identity_hash", "project_id", "created_at", "updated_at", "version"`

// StockMaterialImage ↔ 表 `stock_material_image`（项目域）。
type StockMaterialImage struct {
	MaterialID int64  `db:"material_id" json:"material_id"`
	FileID     string `db:"file_id" json:"file_id"`
	SortOrder  int64  `db:"sort_order" json:"sort_order"`
	ProjectID  int64  `db:"project_id" json:"project_id"`
}

const TableStockMaterialImage = "stock_material_image"
const ColsStockMaterialImage = `"material_id", "file_id", "sort_order", "project_id"`

// StockOperation ↔ 表 `stock_operation`（项目域）。
type StockOperation struct {
	ID                          int64     `db:"id" json:"id"`
	OperationNo                 string    `db:"operation_no" json:"operation_no"`
	OperationType               string    `db:"operation_type" json:"operation_type"` // enum: INBOUND, OUTBOUND
	OccurredAt                  time.Time `db:"occurred_at" json:"occurred_at"`
	BusinessReason              string    `db:"business_reason" json:"business_reason"`
	ReceiverUnit                *string   `db:"receiver_unit" json:"receiver_unit"`
	ReceiverName                *string   `db:"receiver_name" json:"receiver_name"`
	SubitemNo                   *string   `db:"subitem_no" json:"subitem_no"`
	SourceType                  string    `db:"source_type" json:"source_type"` // enum: MANUAL, MINI_PROGRAM, REVERSAL, INITIALIZATION
	ReversalOfID                *int64    `db:"reversal_of_id" json:"reversal_of_id"`
	ClientRequestID             string    `db:"client_request_id" json:"client_request_id"`
	MiniProgramUserNameSnapshot *string   `db:"mini_program_user_name_snapshot" json:"mini_program_user_name_snapshot"`
	ProjectID                   int64     `db:"project_id" json:"project_id"`
	CreatedAt                   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt                   time.Time `db:"updated_at" json:"updated_at"`
	Version                     int64     `db:"version" json:"version"`
}

const TableStockOperation = "stock_operation"
const ColsStockOperation = `"id", "operation_no", "operation_type", "occurred_at", "business_reason", "receiver_unit", "receiver_name", "subitem_no", "source_type", "reversal_of_id", "client_request_id", "mini_program_user_name_snapshot", "project_id", "created_at", "updated_at", "version"`

// StockOperationLine ↔ 表 `stock_operation_line`（项目域）。
type StockOperationLine struct {
	ID                   int64         `db:"id" json:"id"`
	OperationID          int64         `db:"operation_id" json:"operation_id"`
	StockMaterialID      int64         `db:"stock_material_id" json:"stock_material_id"`
	Quantity             jtype.Decimal `db:"quantity" json:"quantity"`
	RemainingQty         jtype.Decimal `db:"remaining_qty" json:"remaining_qty"`
	BeforeQty            jtype.Decimal `db:"before_qty" json:"before_qty"`
	AfterQty             jtype.Decimal `db:"after_qty" json:"after_qty"`
	MaterialNameSnapshot string        `db:"material_name_snapshot" json:"material_name_snapshot"`
	ModelSpecSnapshot    string        `db:"model_spec_snapshot" json:"model_spec_snapshot"`
	UnitNameSnapshot     string        `db:"unit_name_snapshot" json:"unit_name_snapshot"`
	ProjectID            int64         `db:"project_id" json:"project_id"`
	CreatedAt            time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time     `db:"updated_at" json:"updated_at"`
	Version              int64         `db:"version" json:"version"`
}

const TableStockOperationLine = "stock_operation_line"
const ColsStockOperationLine = `"id", "operation_id", "stock_material_id", "quantity", "remaining_qty", "before_qty", "after_qty", "material_name_snapshot", "model_spec_snapshot", "unit_name_snapshot", "project_id", "created_at", "updated_at", "version"`

// StockReplenishmentPolicy ↔ 表 `stock_replenishment_policy`（项目域）。
type StockReplenishmentPolicy struct {
	StockMaterialID int64         `db:"stock_material_id" json:"stock_material_id"`
	MinimumQty      jtype.Decimal `db:"minimum_qty" json:"minimum_qty"`
	Enabled         bool          `db:"enabled" json:"enabled"`
	CreatedAt       time.Time     `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time     `db:"updated_at" json:"updated_at"`
	Version         int64         `db:"version" json:"version"`
	ProjectID       int64         `db:"project_id" json:"project_id"`
}

const TableStockReplenishmentPolicy = "stock_replenishment_policy"
const ColsStockReplenishmentPolicy = `"stock_material_id", "minimum_qty", "enabled", "created_at", "updated_at", "version", "project_id"`

// SystemSetting ↔ 表 `system_setting`。
type SystemSetting struct {
	SettingKey   string     `db:"setting_key" json:"setting_key"`
	SettingValue jtype.JSON `db:"setting_value" json:"setting_value"`
	Version      int64      `db:"version" json:"version"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

const TableSystemSetting = "system_setting"
const ColsSystemSetting = `"setting_key", "setting_value", "version", "updated_at"`

// User ↔ 表 `user`。
type User struct {
	ID           int64     `db:"id" json:"id"`
	Username     string    `db:"username" json:"username"`
	PasswordHash string    `db:"password_hash" json:"password_hash"`
	APITokenHash string    `db:"api_token_hash" json:"api_token_hash"`
	APITokenEnc  string    `db:"api_token_enc" json:"api_token_enc"`
	DisplayName  string    `db:"display_name" json:"display_name"`
	Role         string    `db:"role" json:"role"` // enum: SUPER_ADMIN, WAREHOUSE_ADMIN, PURCHASE_ADMIN, HAZARD_ADMIN, READ_ONLY, LEDGER_ADMIN, WORK_ADMIN
	Enabled      bool      `db:"enabled" json:"enabled"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
	Version      int64     `db:"version" json:"version"`
}

const TableUser = "user"
const ColsUser = `"id", "username", "password_hash", "api_token_hash", "api_token_enc", "display_name", "role", "enabled", "created_at", "updated_at", "version"`

// WebhookChannel ↔ 表 `webhook_channel`。
type WebhookChannel struct {
	ID                  int64      `db:"id" json:"id"`
	Platform            string     `db:"platform" json:"platform"` // enum: FEISHU, DINGTALK
	Enabled             bool       `db:"enabled" json:"enabled"`
	WebhookURLEncrypted string     `db:"webhook_url_encrypted" json:"webhook_url_encrypted"`
	SecretEncrypted     string     `db:"secret_encrypted" json:"secret_encrypted"`
	SubscribedEvents    jtype.JSON `db:"subscribed_events" json:"subscribed_events"`
	CreatedAt           time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt           time.Time  `db:"updated_at" json:"updated_at"`
	Version             int64      `db:"version" json:"version"`
}

const TableWebhookChannel = "webhook_channel"
const ColsWebhookChannel = `"id", "platform", "enabled", "webhook_url_encrypted", "secret_encrypted", "subscribed_events", "created_at", "updated_at", "version"`

// WebhookDelivery ↔ 表 `webhook_delivery`。
type WebhookDelivery struct {
	ID              int64      `db:"id" json:"id"`
	EventID         string     `db:"event_id" json:"event_id"`
	EventType       string     `db:"event_type" json:"event_type"` // enum: STOCK_OUTBOUND_CREATED, STOCK_INBOUND_CREATED, MINI_PROGRAM_USER_BOUND
	ChannelID       int64      `db:"channel_id" json:"channel_id"`
	Payload         jtype.JSON `db:"payload" json:"payload"`
	Status          string     `db:"status" json:"status"` // enum: PENDING, SENDING, SUCCEEDED, FAILED
	Attempts        int64      `db:"attempts" json:"attempts"`
	NextRetryAt     time.Time  `db:"next_retry_at" json:"next_retry_at"`
	ResponseStatus  *int64     `db:"response_status" json:"response_status"`
	ResponseExcerpt *string    `db:"response_excerpt" json:"response_excerpt"`
	LastError       *string    `db:"last_error" json:"last_error"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
	DeliveredAt     *time.Time `db:"delivered_at" json:"delivered_at"`
}

const TableWebhookDelivery = "webhook_delivery"
const ColsWebhookDelivery = `"id", "event_id", "event_type", "channel_id", "payload", "status", "attempts", "next_retry_at", "response_status", "response_excerpt", "last_error", "created_at", "updated_at", "delivered_at"`

// WorkRecord ↔ 表 `work_record`（项目域）。
type WorkRecord struct {
	ID           int64      `db:"id" json:"id"`
	TaskID       int64      `db:"task_id" json:"task_id"`
	StartDate    jtype.Date `db:"start_date" json:"start_date"`
	StartHalf    string     `db:"start_half" json:"start_half"` // enum: AM, PM
	EndDate      jtype.Date `db:"end_date" json:"end_date"`
	EndHalf      string     `db:"end_half" json:"end_half"` // enum: AM, PM
	Participants string     `db:"participants" json:"participants"`
	Remark       *string    `db:"remark" json:"remark"`
	ProjectID    int64      `db:"project_id" json:"project_id"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
	Version      int64      `db:"version" json:"version"`
}

const TableWorkRecord = "work_record"
const ColsWorkRecord = `"id", "task_id", "start_date", "start_half", "end_date", "end_half", "participants", "remark", "project_id", "created_at", "updated_at", "version"`

// WorkTask ↔ 表 `work_task`（项目域）。
type WorkTask struct {
	ID            int64       `db:"id" json:"id"`
	Name          string      `db:"name" json:"name"`
	Description   *string     `db:"description" json:"description"`
	Status        string      `db:"status" json:"status"` // enum: PENDING, IN_PROGRESS, DONE, PAUSED
	PlanStartDate *jtype.Date `db:"plan_start_date" json:"plan_start_date"`
	PlanEndDate   *jtype.Date `db:"plan_end_date" json:"plan_end_date"`
	Remark        *string     `db:"remark" json:"remark"`
	ProjectID     int64       `db:"project_id" json:"project_id"`
	CreatedAt     time.Time   `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time   `db:"updated_at" json:"updated_at"`
	Version       int64       `db:"version" json:"version"`
}

const TableWorkTask = "work_task"
const ColsWorkTask = `"id", "name", "description", "status", "plan_start_date", "plan_end_date", "remark", "project_id", "created_at", "updated_at", "version"`

// WorkTaskImage ↔ 表 `work_task_image`（项目域）。
type WorkTaskImage struct {
	TaskID    int64  `db:"task_id" json:"task_id"`
	FileID    string `db:"file_id" json:"file_id"`
	SortOrder int64  `db:"sort_order" json:"sort_order"`
	ProjectID int64  `db:"project_id" json:"project_id"`
}

const TableWorkTaskImage = "work_task_image"
const ColsWorkTaskImage = `"task_id", "file_id", "sort_order", "project_id"`

// ProjectScopedTables 是带 project_id 的项目域业务表（对应 PROJECT_SCOPED_MODELS）。
var ProjectScopedTables = []string{
	"excel_export_job",
	"excel_import_job",
	"hazard",
	"hazard_after_image",
	"hazard_before_image",
	"hazard_type",
	"hazard_unit",
	"huaxing_inventory",
	"ledger",
	"ledger_image",
	"ledger_tag",
	"ledger_tag_image",
	"lite_inventory",
	"material_code_library",
	"material_price",
	"purchase_material",
	"purchase_material_image",
	"purchase_plan_template",
	"purchase_plan_template_image",
	"purchase_request",
	"purchase_request_line",
	"purchase_request_line_image",
	"share_link",
	"stock_balance",
	"stock_material",
	"stock_material_image",
	"stock_operation",
	"stock_operation_line",
	"stock_replenishment_policy",
	"work_record",
	"work_task",
	"work_task_image",
}
