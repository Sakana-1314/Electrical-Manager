// 权限目录（RBAC）：角色持有权限键数组（role.permissions），用户可挂多个角色（user_role），
// 实际权限取全部角色的并集。管理端与小程序端共用同一套权限。
package domain

// 权限键：`模块:动作`（键名与网页端既有菜单门禁一致）。角色数据里可用 `*` 通配全部权限、
// `模块:*` 通配模块内权限（加载时展开成具体键）。
const (
	PermSettingsWrite  = "settings:write"  // 系统管理：用户 / 角色 / 项目 / 系统设置 / 附件池 / 小程序用户
	PermWarehouseRead  = "warehouse:read"  // 二级库与出入库记录查看
	PermWarehouseWrite = "warehouse:write" // 二级库出入库 / 导入 / 库存调整
	PermPurchaseRead   = "purchase:read"   // 申购计划 / 请购 / 申购记录查看
	PermPurchaseWrite  = "purchase:write"  // 申购计划 / 请购 / 申购记录编辑与编码库导入
	PermHuaxingRead    = "huaxing:read"    // 精简库存查看
	PermCodesRead      = "codes:read"      // 物料编码库查看
	PermLedgerRead     = "ledger:read"     // 台账查看
	PermLedgerWrite    = "ledger:write"    // 台账编辑
	PermHazardRead     = "hazard:read"     // 隐患查看
	PermHazardWrite    = "hazard:write"    // 隐患上报与整改
	PermWorkRead       = "work:read"       // 工单查看
	PermWorkWrite      = "work:write"      // 工单编辑
)

// PermissionDef 权限目录项（角色编辑界面的可选项，key 为 role.permissions 里的权限键）。
type PermissionDef struct {
	Key    string `json:"key"`
	Module string `json:"module"`
	Action string `json:"action"`
	Label  string `json:"label"`
}

// PermissionCatalog 全部权限键（顺序即角色编辑界面的展示顺序）。
var PermissionCatalog = []PermissionDef{
	{PermSettingsWrite, "settings", "write", "系统管理（用户 / 角色 / 项目 / 设置 / 小程序用户）"},
	{PermWarehouseRead, "warehouse", "read", "二级库与出入库查看"},
	{PermWarehouseWrite, "warehouse", "write", "二级库出入库与库存调整"},
	{PermPurchaseRead, "purchase", "read", "申购计划与申购记录查看"},
	{PermPurchaseWrite, "purchase", "write", "申购计划与申购记录编辑"},
	{PermHuaxingRead, "huaxing", "read", "精简库存查看"},
	{PermCodesRead, "codes", "read", "物料编码库查看"},
	{PermLedgerRead, "ledger", "read", "台账查看"},
	{PermLedgerWrite, "ledger", "write", "台账编辑"},
	{PermHazardRead, "hazard", "read", "隐患查看"},
	{PermHazardWrite, "hazard", "write", "隐患上报与整改"},
	{PermWorkRead, "work", "read", "工单查看"},
	{PermWorkWrite, "work", "write", "工单编辑"},
}

// IsKnownPermission 角色保存时校验权限键是否都在目录内（不允许自定义键与通配键，通配只用于内置超级管理员）。
func IsKnownPermission(key string) bool {
	for _, def := range PermissionCatalog {
		if def.Key == key {
			return true
		}
	}
	return false
}

// 用户来源（user.source）：管理端账号（用户名密码 / 接口令牌）与小程序端账号（微信 openid 身份）。
const (
	UserSourceManage      = "MANAGE"
	UserSourceMiniProgram = "MINI_PROGRAM"
)

// 内置角色名：与 init.sql 种子同名（按 name 幂等 upsert），代码里按名引用（勿改文案）。
// 角色集合 = 各功能「只读 / 读写」+ 超级管理员，固定种子、无 CRUD；用户可挂多个角色取并集。
const (
	SystemRoleSuperAdmin = "超级管理员"
)

// DefaultRegistrationRoleNames 小程序新用户默认挂载的角色：全局只读（各功能查看）。
var DefaultRegistrationRoleNames = []string{"全局只读"}

// ExpandPermissions 把角色权限键展开成具体权限集合：
// `*` → 全部目录权限；`模块:*` → 该模块全部权限；其余键原样保留。输出去重并按目录顺序排列。
func ExpandPermissions(keys []string) []string {
	granted := map[string]bool{}
	for _, key := range keys {
		switch {
		case key == "*":
			for _, def := range PermissionCatalog {
				granted[def.Key] = true
			}
		case len(key) > 1 && key[len(key)-1] == '*' && key[len(key)-2] == ':':
			prefix := key[:len(key)-1] // `模块:*` → `模块:`
			for _, def := range PermissionCatalog {
				if len(def.Key) > len(prefix) && def.Key[:len(prefix)] == prefix {
					granted[def.Key] = true
				}
			}
		case key != "":
			granted[key] = true
		}
	}
	out := make([]string, 0, len(granted))
	for _, def := range PermissionCatalog {
		if granted[def.Key] {
			out = append(out, def.Key)
		}
	}
	return out
}
