// 权限位（位图）：`app_user.permissions` 是 BIGINT，每一位对应一个权限点，按位与判断。
// 管理端与小程序端共用同一套权限位：功能是否展示、接口是否放行都由位图决定，不再有角色表与功能开关。
package domain

// Permission 权限位图（每一位见 PermissionCatalog）。
type Permission int64

// 权限位：位顺序即 PermissionCatalog 的展示顺序；`system:admin` 只代表系统管理能力，
// 「超级管理员」不再是独立角色，而是系统管理位与各功能读写位的并集。
//
// 位 6 已退役（原 `codes:read`，物料编码库并入申购权限）；保留空位，避免存量位图整体错位。
// 标准二级库（warehouse）与精简二级库（lite）是两套独立权限：精简二级库是独立的
// Excel 导入台账（lite_inventory），与标准二级库的物资 / 出入库互不依赖。
const (
	PermSystemAdmin    Permission = 1 << 0  // 系统管理：用户 / 项目 / 高级设置 / 附件池 / 分享链接
	PermWarehouseRead  Permission = 1 << 1  // 标准二级库与出入库记录查看
	PermWarehouseWrite Permission = 1 << 2  // 标准二级库出入库 / 导入 / 库存调整
	PermPurchaseRead   Permission = 1 << 3  // 申购计划 / 请购 / 申购记录 / 物料编码库查看
	PermPurchaseWrite  Permission = 1 << 4  // 申购计划 / 请购 / 申购记录 / 物料编码库编辑
	PermHuaxingRead    Permission = 1 << 5  // 华星总库存查看
	PermLedgerRead     Permission = 1 << 7  // 台账查看
	PermLedgerWrite    Permission = 1 << 8  // 台账编辑
	PermHazardRead     Permission = 1 << 9  // 隐患查看
	PermHazardWrite    Permission = 1 << 10 // 隐患上报与整改
	PermWorkRead       Permission = 1 << 11 // 工单查看
	PermWorkWrite      Permission = 1 << 12 // 工单编辑
	PermLiteRead       Permission = 1 << 13 // 精简二级库查看
	PermLiteWrite      Permission = 1 << 14 // 精简二级库导入
)

// AllPermissions 全部权限位（系统管理 + 各功能读写；不包含退役的位 6）。
const AllPermissions = PermSystemAdmin | PermWarehouseRead | PermWarehouseWrite |
	PermPurchaseRead | PermPurchaseWrite | PermHuaxingRead |
	PermLedgerRead | PermLedgerWrite | PermHazardRead | PermHazardWrite |
	PermWorkRead | PermWorkWrite | PermLiteRead | PermLiteWrite

// DefaultRegistrationPermissions 默认用户权限（可在高级设置里改）：
// 精简二级库只读 + 申购只读（含物料编码库）+ 华星总库存只读。
const DefaultRegistrationPermissions = PermLiteRead | PermPurchaseRead | PermHuaxingRead

// PermissionDef 权限目录项（用户管理界面的可勾选项，bit 为位图里的数值）。
type PermissionDef struct {
	Key    string     `json:"key"`
	Module string     `json:"module"`
	Action string     `json:"action"`
	Label  string     `json:"label"`
	Bit    Permission `json:"bit"`
}

// PermissionCatalog 全部权限位（顺序即用户管理界面的展示顺序）。
var PermissionCatalog = []PermissionDef{
	{"system:admin", "system", "admin", "系统管理（用户 / 项目 / 高级设置 / 附件 / 分享链接）", PermSystemAdmin},
	{"warehouse:read", "warehouse", "read", "标准二级库与出入库查看", PermWarehouseRead},
	{"warehouse:write", "warehouse", "write", "标准二级库出入库与库存调整", PermWarehouseWrite},
	{"lite:read", "lite", "read", "精简二级库查看", PermLiteRead},
	{"lite:write", "lite", "write", "精简二级库导入", PermLiteWrite},
	{"purchase:read", "purchase", "read", "申购计划 / 申购记录 / 物料编码库查看", PermPurchaseRead},
	{"purchase:write", "purchase", "write", "申购计划 / 申购记录 / 物料编码库编辑", PermPurchaseWrite},
	{"huaxing:read", "huaxing", "read", "华星总库存查看", PermHuaxingRead},
	{"ledger:read", "ledger", "read", "台账查看", PermLedgerRead},
	{"ledger:write", "ledger", "write", "台账编辑", PermLedgerWrite},
	{"hazard:read", "hazard", "read", "隐患查看", PermHazardRead},
	{"hazard:write", "hazard", "write", "隐患上报与整改", PermHazardWrite},
	{"work:read", "work", "read", "工单查看", PermWorkRead},
	{"work:write", "work", "write", "工单编辑", PermWorkWrite},
}

// PermissionForKey 权限键 → 权限位。
func PermissionForKey(key string) (Permission, bool) {
	for _, def := range PermissionCatalog {
		if def.Key == key {
			return def.Bit, true
		}
	}
	return 0, false
}

// Has 位图是否包含某个权限位。
func (p Permission) Has(perm Permission) bool { return p&perm == perm }

// Normalize 归一化位图：丢掉未知位；写权限自动带上同模块的读权限（有写必然能看）。
func (p Permission) Normalize() Permission {
	p &= AllPermissions
	for _, def := range PermissionCatalog {
		if def.Action != "write" || !p.Has(def.Bit) {
			continue
		}
		if read, ok := PermissionForKey(def.Module + ":read"); ok {
			p |= read
		}
	}
	return p
}

// Keys 位图展开成权限键（按目录顺序）。
func (p Permission) Keys() []string {
	keys := make([]string, 0, len(PermissionCatalog))
	for _, def := range PermissionCatalog {
		if p.Has(def.Bit) {
			keys = append(keys, def.Key)
		}
	}
	return keys
}

// PermissionBits 权限键数组 → 位图；返回无法识别的键（由调用方报 422）。
func PermissionBits(keys []string) (Permission, []string) {
	var bits Permission
	var unknown []string
	seen := map[string]bool{}
	for _, key := range keys {
		if seen[key] {
			continue
		}
		seen[key] = true
		bit, ok := PermissionForKey(key)
		if !ok {
			unknown = append(unknown, key)
			continue
		}
		bits |= bit
	}
	return bits.Normalize(), unknown
}
