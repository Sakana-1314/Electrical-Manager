package miniprogram

// 小程序端二级库管理（物资档案 / 扫码入库）。
//
// 管理端接口是同一业务能力的唯一实现：这里只是薄适配——把 UUID / 带时区时间解析成
// service 层的写模型，复用 `service/material` 与 `service/inventory`，再把结果裁成小程序
// 需要的字段（不返回关系对象与乐观锁版本以外的管理端字段）。

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/inventory"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
)

// ---------------- 物资档案 ----------------

// ListStockMaterials 是小程序物资档案列表：与管理端同样按「名称 / 名称编号 / 别名 / 型号」OR 关键词、
// 按 id 倒序分页，只裁剪响应字段（小程序列表不需要图片关系与补库策略）。
func ListStockMaterials(s *db.Session, keyword *string, page, pageSize int64, language *string) ([]schema.MiniProgramStockMaterialRead, int64, error) {
	items, total, err := material.SearchStock(s, keyword, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.MiniProgramStockMaterialRead, len(items))
	for i, item := range items {
		out[i] = stockMaterialRead(item, language)
	}
	return out, total, nil
}

// stockMaterialRead 是列表 / 表单回填的行：库存列表字段 + id 与 version。
func stockMaterialRead(item *material.Stock, language *string) schema.MiniProgramStockMaterialRead {
	return schema.MiniProgramStockMaterialRead{
		ID: item.ID, UUID: item.UUID, Name: LocalizedMaterialName(&item.StockMaterial, language),
		ModelSpec: item.ModelSpec, UnitName: item.UnitName, CurrentQty: currentQty(item),
		StockStatus: StockStatus(item), Version: item.Version,
	}
}

// CreateStockMaterial 对应管理端 create_stock_material：身份重复报 DUPLICATE_MATERIAL（409）。
func CreateStockMaterial(s *db.Session, data schema.MiniProgramStockMaterialCreate, language *string) (schema.MiniProgramStockMaterialRead, error) {
	item, err := material.CreateStock(s, schema.StockMaterialCreate{
		Name: data.Name, NameID: data.NameID, Alias: data.Alias, ModelSpec: data.ModelSpec,
		UnitName: data.UnitName, Remark: data.Remark, ImageIDs: data.ImageIDs,
	})
	if err != nil {
		return schema.MiniProgramStockMaterialRead{}, err
	}
	return stockMaterialRead(item, language), nil
}

// UpdateStockMaterial 按 id 编辑（version 乐观锁），返回更新后的列表行。
func UpdateStockMaterial(s *db.Session, materialID int64, data schema.MiniProgramStockMaterialUpdate, language *string) (schema.MiniProgramStockMaterialRead, error) {
	item, err := material.GetStock(s, materialID)
	if err != nil {
		return schema.MiniProgramStockMaterialRead{}, err
	}
	updated, err := material.UpdateStock(s, item, schema.StockMaterialUpdate{
		Name: data.Name, NameID: data.NameID, Alias: data.Alias, ModelSpec: data.ModelSpec,
		UnitName: data.UnitName, Remark: data.Remark, ImageIDs: data.ImageIDs, Version: data.Version,
	})
	if err != nil {
		return schema.MiniProgramStockMaterialRead{}, err
	}
	return stockMaterialRead(updated, language), nil
}

// DeleteStockMaterial 按 id 删除（有出入库流水时拒绝，与管理端同一规则）。
func DeleteStockMaterial(s *db.Session, materialID int64, version *int64) error {
	item, err := material.GetStock(s, materialID)
	if err != nil {
		return err
	}
	return material.DeleteStock(s, item, version)
}

// ---------------- 入库 ----------------

// CreateInbound 对应管理端入库：小程序来源在服务层会落成手工来源，并记录操作人快照；
// 入库不允许填领用人，因此这里不接触收人字段。
func CreateInbound(s *db.Session, data schema.MiniProgramInboundCreate, user *model.User) (schema.MiniProgramInboundRead, error) {
	m, err := GetMaterial(s, data.MaterialUUID)
	if err != nil {
		return schema.MiniProgramInboundRead{}, err
	}
	op, err := inventory.CreateOperation(s, schema.OperationCreate{
		ClientRequestID: data.ClientRequestID,
		SourceType:      domain.SourceManual,
		BusinessReason:  data.BusinessReason,
		Lines:           []schema.OperationLineWrite{{StockMaterialID: m.ID, Quantity: data.Quantity}},
		OccurredAtTime:  data.OccurredAtTime,
	}, domain.OperationInbound, inventory.CreateOptions{})
	if err != nil {
		return schema.MiniProgramInboundRead{}, err
	}
	if len(op.Lines) != 1 || op.Lines[0].StockMaterialID != m.ID {
		return schema.MiniProgramInboundRead{}, apperr.New("CLIENT_REQUEST_ID_CONFLICT", "请求标识已被其他业务使用").WithStatus(409)
	}
	line := op.Lines[0]
	return schema.MiniProgramInboundRead{
		OperationID: op.ID, OperationNo: op.OperationNo, MaterialUUID: m.UUID,
		MaterialName: line.MaterialNameSnapshot, ModelSpec: line.ModelSpecSnapshot, UnitName: line.UnitNameSnapshot,
		Quantity: line.Quantity, BeforeQty: line.BeforeQty, AfterQty: line.AfterQty,
		OccurredAt: schema.NewAwareTime(op.OccurredAt), ExecutedBy: user.DisplayName,
	}, nil
}
