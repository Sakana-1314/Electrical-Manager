// Package material 对应原 services/material_service.py + repositories/material_repository.py：
// 二级库物资（stock_material）与申购计划（purchase_material）。
package material

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// Stock 是带 selectin 关系（余额、补库策略、图片）的二级库物资。
type Stock struct {
	model.StockMaterial
	Balance *model.StockBalance
	Policy  *model.StockReplenishmentPolicy
	Images  []Image
}

func duplicateMaterial() error {
	return apperr.New("DUPLICATE_MATERIAL", "相同名称、型号规格和单位的物资已存在").WithStatus(409)
}

// LoadStockRelations 批量加载余额 / 补库策略 / 图片（每个关系一次 IN 查询）。
func LoadStockRelations(s *db.Session, items []*Stock) error {
	if len(items) == 0 {
		return nil
	}
	ids := make([]int64, len(items))
	for i, it := range items {
		ids[i] = it.ID
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return err
	}
	var balances []model.StockBalance
	if err := s.SelectIn(&balances, "SELECT "+model.ColsStockBalance+" FROM stock_balance WHERE stock_material_id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
		return err
	}
	var policies []model.StockReplenishmentPolicy
	if err := s.SelectIn(&policies, "SELECT "+model.ColsStockReplenishmentPolicy+" FROM stock_replenishment_policy WHERE stock_material_id IN (?)"+scope, append([]any{ids}, sargs...)...); err != nil {
		return err
	}
	images, err := loadImages(s, "stock_material_image", "material_id", ids)
	if err != nil {
		return err
	}
	balanceBy := map[int64]*model.StockBalance{}
	for i := range balances {
		balanceBy[balances[i].StockMaterialID] = &balances[i]
	}
	policyBy := map[int64]*model.StockReplenishmentPolicy{}
	for i := range policies {
		policyBy[policies[i].StockMaterialID] = &policies[i]
	}
	for _, it := range items {
		it.Balance = balanceBy[it.ID]
		it.Policy = policyBy[it.ID]
		it.Images = images[it.ID]
		if it.Images == nil {
			it.Images = []Image{}
		}
	}
	return nil
}

func findStock(s *db.Session, where string, arg any) (*Stock, error) {
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var m model.StockMaterial
	ok, err := s.Find(&m, "SELECT "+model.ColsStockMaterial+" FROM stock_material WHERE "+where+scope, append([]any{arg}, sargs...)...)
	if err != nil || !ok {
		return nil, err
	}
	item := &Stock{StockMaterial: m}
	if err := LoadStockRelations(s, []*Stock{item}); err != nil {
		return nil, err
	}
	return item, nil
}

// FindStock 按 id 读取（含关系），不存在返回 nil。
func FindStock(s *db.Session, materialID int64) (*Stock, error) {
	return findStock(s, "id = ?", materialID)
}

// GetStock 对应 get_stock_material：不存在报 NOT_FOUND「二级库物资不存在」。
func GetStock(s *db.Session, materialID int64) (*Stock, error) {
	item, err := FindStock(s, materialID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperr.NotFound("二级库物资")
	}
	return item, nil
}

// GetStockByUUID 对应 get_stock_material_by_uuid（uuid 为规范化小写带连字符形式）。
func GetStockByUUID(s *db.Session, materialUUID string) (*Stock, error) {
	item, err := findStock(s, "uuid = ?", materialUUID)
	if err != nil {
		return nil, err
	}
	if item == nil {
		return nil, apperr.NotFound("二级库物资")
	}
	return item, nil
}

// StockRead 对应 stock_read。
func StockRead(item *Stock, hasOperationRecords bool) schema.StockMaterialRead {
	current := zero
	if item.Balance != nil {
		current = item.Balance.Quantity
	}
	var policy *schema.ReplenishmentPolicyRead
	if item.Policy != nil {
		policy = &schema.ReplenishmentPolicyRead{MinimumQty: item.Policy.MinimumQty, Enabled: item.Policy.Enabled, Version: item.Policy.Version}
	}
	return schema.StockMaterialRead{
		ID: item.ID, UUID: item.UUID, Name: item.Name, NameID: item.NameID, Alias: item.Alias,
		ModelSpec: item.ModelSpec, UnitName: item.UnitName, Remark: item.Remark, CurrentQty: current,
		Images: FileReads(item.Images), ReplenishmentPolicy: policy, HasOperationRecords: hasOperationRecords,
		CreatedAt: schema.NewAwareTime(item.CreatedAt), UpdatedAt: schema.NewAwareTime(item.UpdatedAt), Version: item.Version,
	}
}

// StockIDsWithOperations 对应 stock_material_ids_with_operations：有出入库流水行的物资 id 集合。
func StockIDsWithOperations(s *db.Session, materialIDs []int64) (map[int64]bool, error) {
	out := map[int64]bool{}
	if len(materialIDs) == 0 {
		return out, nil
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var ids []int64
	if err := s.SelectIn(&ids, "SELECT DISTINCT stock_material_id FROM stock_operation_line WHERE stock_material_id IN (?)"+scope, append([]any{materialIDs}, sargs...)...); err != nil {
		return nil, err
	}
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}

// DeleteStock 对应 delete_stock_material：有流水的物资不能删；先解除申购计划关联再删除（级联余额 / 策略 / 图片）。
func DeleteStock(s *db.Session, item *Stock, version *int64) error {
	if err := apperr.ValidateVersion(version, item.Version); err != nil {
		return err
	}
	used, err := StockIDsWithOperations(s, []int64{item.ID})
	if err != nil {
		return err
	}
	if len(used) > 0 {
		return apperr.New("STOCK_MATERIAL_IN_USE", "该物资已有出入库操作记录，仅支持编辑，不能删除").WithStatus(409)
	}
	pid, err := s.ProjectID()
	if err != nil {
		return err
	}
	if _, err := s.Exec("UPDATE purchase_material SET stock_material_id = NULL, updated_at = ? WHERE stock_material_id = ? AND project_id = ?", common.UTCNow(), item.ID, pid); err != nil {
		return err
	}
	for _, q := range []string{
		"DELETE FROM stock_material_image WHERE material_id = ? AND project_id = ?",
		"DELETE FROM stock_balance WHERE stock_material_id = ? AND project_id = ?",
		"DELETE FROM stock_replenishment_policy WHERE stock_material_id = ? AND project_id = ?",
		"DELETE FROM stock_material WHERE id = ? AND project_id = ?",
	} {
		if _, err := s.Exec(q, item.ID, pid); err != nil {
			return err
		}
	}
	return nil
}

// CreateStock 对应 create_stock_material：同时建零余额；身份重复报 DUPLICATE_MATERIAL。
func CreateStock(s *db.Session, data schema.StockMaterialCreate) (*Stock, error) {
	files, err := Files(s, data.ImageIDs)
	if err != nil {
		return nil, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	m := model.StockMaterial{
		UUID: security.UUID4(), Name: data.Name, NameID: emptyToNil(data.NameID), Alias: emptyToNil(data.Alias),
		ModelSpec: data.ModelSpec, UnitName: data.UnitName, Remark: data.Remark,
		IdentityHash: common.IdentityHash(data.Name, data.ModelSpec, data.UnitName),
		ProjectID:    pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO stock_material (uuid, name, name_id, alias, model_spec, unit_name, remark, identity_hash, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		m.UUID, m.Name, m.NameID, m.Alias, m.ModelSpec, m.UnitName, m.Remark, m.IdentityHash, m.ProjectID, m.CreatedAt, m.UpdatedAt, m.Version)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateMaterial()
		}
		return nil, err
	}
	m.ID = id
	balance := &model.StockBalance{StockMaterialID: id, Quantity: zero, Version: 1, UpdatedAt: now, ProjectID: pid}
	if _, err := s.Exec("INSERT INTO stock_balance (stock_material_id, quantity, version, updated_at, project_id) VALUES (?, ?, ?, ?, ?)",
		balance.StockMaterialID, balance.Quantity, balance.Version, balance.UpdatedAt, balance.ProjectID); err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateMaterial()
		}
		return nil, err
	}
	if err := insertImages(s, "stock_material_image", "material_id", id, files); err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateMaterial()
		}
		return nil, err
	}
	return &Stock{StockMaterial: m, Balance: balance, Images: imagesFromFiles(files)}, nil
}

// UpdateStock 对应 update_stock_material：image_ids 为 nil 时不动图片。
func UpdateStock(s *db.Session, item *Stock, data schema.StockMaterialUpdate) (*Stock, error) {
	if err := apperr.ValidateVersion(&data.Version, item.Version); err != nil {
		return nil, err
	}
	var files []model.FileObject
	if data.ImageIDs != nil {
		var err error
		if files, err = Files(s, *data.ImageIDs); err != nil {
			return nil, err
		}
	}
	item.Name = data.Name
	item.NameID = emptyToNil(data.NameID)
	item.Alias = emptyToNil(data.Alias)
	item.ModelSpec = data.ModelSpec
	item.UnitName = data.UnitName
	item.Remark = data.Remark
	item.IdentityHash = common.IdentityHash(data.Name, data.ModelSpec, data.UnitName)
	if data.ImageIDs != nil {
		if err := common.LogImageChange(s, "STOCK_MATERIAL", item.ID, ImageIDs(item.Images), *data.ImageIDs, "二级库物资 "+item.Name); err != nil {
			return nil, err
		}
	}
	item.Version++
	item.UpdatedAt = common.UTCNow()
	_, err := s.Exec("UPDATE stock_material SET name = ?, name_id = ?, alias = ?, model_spec = ?, unit_name = ?, remark = ?, identity_hash = ?, version = ?, updated_at = ? WHERE id = ? AND project_id = ?",
		item.Name, item.NameID, item.Alias, item.ModelSpec, item.UnitName, item.Remark, item.IdentityHash, item.Version, item.UpdatedAt, item.ID, item.ProjectID)
	if err != nil {
		if db.IsIntegrity(err) {
			return nil, duplicateMaterial()
		}
		return nil, err
	}
	if data.ImageIDs != nil {
		if err := replaceImages(s, "stock_material_image", "material_id", item.ID, files); err != nil {
			if db.IsIntegrity(err) {
				return nil, duplicateMaterial()
			}
			return nil, err
		}
		item.Images = imagesFromFiles(files)
	}
	return item, nil
}

// SearchStock 对应 search_stock_materials：名称 / 名称编号 / 别名 / 型号 OR 关键词，按 id 倒序分页。
func SearchStock(s *db.Session, keyword *string, page, pageSize int64) ([]*Stock, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"name", "name_id", "alias", "model_spec"}, keyword)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*) FROM stock_material"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var rows []model.StockMaterial
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&rows, "SELECT "+model.ColsStockMaterial+" FROM stock_material"+w.SQL()+" ORDER BY id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	items := make([]*Stock, len(rows))
	for i := range rows {
		items[i] = &Stock{StockMaterial: rows[i]}
	}
	if err := LoadStockRelations(s, items); err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

// ValidateStockLink 对应 _validate_stock_link：nil 返回 nil；不存在报 NOT_FOUND「二级库物资不存在」。
func ValidateStockLink(s *db.Session, stockMaterialID *int64) (*model.StockMaterial, error) {
	if stockMaterialID == nil {
		return nil, nil
	}
	scope, sargs, err := scopeAnd(s, "")
	if err != nil {
		return nil, err
	}
	var m model.StockMaterial
	ok, err := s.Find(&m, "SELECT "+model.ColsStockMaterial+" FROM stock_material WHERE id = ?"+scope, append([]any{*stockMaterialID}, sargs...)...)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.NotFound("二级库物资")
	}
	return &m, nil
}

// CurrentQty 当前库存（无余额记录时为 0）。
func (st *Stock) CurrentQty() jtype.Decimal {
	if st.Balance != nil {
		return st.Balance.Quantity
	}
	return zero
}
