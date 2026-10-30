// Package deps 对应原 api/deps.py 中的共享依赖。
package deps

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/aisearch"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

// OrSearchDescription 是 OR 关键词查询参数的说明。
const OrSearchDescription = "可使用 | 或 ｜ 分隔多个关键词，同一参数内匹配任意关键词"

// RequireFullSecondaryWarehouse 二级库精简模式下只允许导入与查询：拦截完整模式写接口。
func RequireFullSecondaryWarehouse(c *web.Ctx) error {
	lite, err := aisearch.IsLiteSecondaryWarehouse(c.DB)
	if err != nil {
		return err
	}
	if lite {
		return apperr.New("SECONDARY_WAREHOUSE_LITE_MODE", "精简模式下二级库仅支持导入与查询").WithStatus(403)
	}
	return nil
}
