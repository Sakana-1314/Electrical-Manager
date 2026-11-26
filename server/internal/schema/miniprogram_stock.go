package schema

// 小程序端二级库管理（物资档案 / 入库）的请求与响应结构。
//
// 这些端点是管理端接口的薄适配：请求体字段与 `stock_material` / `stock_operation` 的写模型同名同义，
// 服务层直接复用 `service/material` 与 `service/inventory`，这里只做「明文 UUID / 带时区时间」的解析
// 与响应裁剪（小程序只需要列表与结果确认，不需要关系对象与乐观锁版本）。

import (
	"encoding/json"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// ---------------- 物资档案 ----------------

// MiniProgramStockMaterialCreate 是新建二级库物资。名称 + 型号规格 + 单位唯一（与网页端一致）。
type MiniProgramStockMaterialCreate struct {
	Name      string   `json:"name" v:"required,min=1,max=128"`
	NameID    *string  `json:"name_id" v:"max=128"`
	Alias     *string  `json:"alias" v:"max=128"`
	ModelSpec string   `json:"model_spec" v:"required,min=1,max=255"`
	UnitName  string   `json:"unit_name" v:"required,min=1,max=32"`
	Remark    *string  `json:"remark" v:"max=1000"`
	ImageIDs  []string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
}

// NewMiniProgramStockMaterialCreate 预填默认值（image_ids=[]）。
func NewMiniProgramStockMaterialCreate() MiniProgramStockMaterialCreate {
	return MiniProgramStockMaterialCreate{ImageIDs: []string{}}
}

// MiniProgramStockMaterialUpdate 是编辑二级库物资；`image_ids` 省略＝不改图片，显式传 `[]` 才清空。
type MiniProgramStockMaterialUpdate struct {
	Name      string    `json:"name" v:"required,min=1,max=128"`
	NameID    *string   `json:"name_id" v:"max=128"`
	Alias     *string   `json:"alias" v:"max=128"`
	ModelSpec string    `json:"model_spec" v:"required,min=1,max=255"`
	UnitName  string    `json:"unit_name" v:"required,min=1,max=32"`
	Remark    *string   `json:"remark" v:"max=1000"`
	ImageIDs  *[]string `json:"image_ids" v:"max=9,unique=image_ids,itempattern=uuid7"`
	Version   int64     `json:"version" v:"required"`
}

// MiniProgramStockMaterialRead 是物资档案列表 / 表单回填的行（比库存列表多 id 与乐观锁版本，
// 编辑与删除要用它们；库存列表是只读展示，不暴露版本）。
type MiniProgramStockMaterialRead struct {
	ID          int64         `json:"id"`
	UUID        string        `json:"uuid"`
	Name        string        `json:"name"`
	ModelSpec   string        `json:"model_spec"`
	UnitName    string        `json:"unit_name"`
	CurrentQty  jtype.Decimal `json:"current_qty"`
	StockStatus string        `json:"stock_status"`
	Version     int64         `json:"version"`
}

// ---------------- 入库 ----------------

// MiniProgramInboundCreate 是扫码入库请求。material_uuid / occurred_at 以原始 JSON 接收，
// 在 Validate 中解析为规范化 UUID 与 UTC 时间（与出库端点同一口径）。
type MiniProgramInboundCreate struct {
	ClientRequestID string          `json:"client_request_id" v:"required,min=1,max=64"`
	MaterialUUIDRaw json.RawMessage `json:"material_uuid" v:"required"`
	OccurredAt      json.RawMessage `json:"occurred_at" v:"required"`
	Quantity        jtype.Decimal   `json:"quantity" v:"required,gt=0,digits=18,places=1"`
	BusinessReason  string          `json:"business_reason" v:"max=500"`

	// MaterialUUID / OccurredAtTime 由 Validate 填充；服务端内部构造时直接赋值。
	MaterialUUID   string    `json:"-"`
	OccurredAtTime time.Time `json:"-"`
}

func (o *MiniProgramInboundCreate) Validate(loc []any) []web.FieldError {
	var errs []web.FieldError
	if u, e := parseJSONUUID(o.MaterialUUIDRaw, stockLoc(loc, "material_uuid")); e != nil {
		errs = append(errs, *e)
	} else {
		o.MaterialUUID = u
	}
	t, err := parseAwareDatetime(o.OccurredAt, stockLoc(loc, "occurred_at"))
	if err != nil {
		errs = append(errs, *err)
	} else {
		o.OccurredAtTime = t
	}
	return errs
}

// MiniProgramInboundRead 是扫码入库结果（物料快照 + 前后数量）。
type MiniProgramInboundRead struct {
	OperationID  int64         `json:"operation_id"`
	OperationNo  string        `json:"operation_no"`
	MaterialUUID string        `json:"material_uuid"`
	MaterialName string        `json:"material_name"`
	ModelSpec    string        `json:"model_spec"`
	UnitName     string        `json:"unit_name"`
	Quantity     jtype.Decimal `json:"quantity"`
	BeforeQty    jtype.Decimal `json:"before_qty"`
	AfterQty     jtype.Decimal `json:"after_qty"`
	OccurredAt   AwareTime     `json:"occurred_at"`
	ExecutedBy   string        `json:"executed_by"`
}
