package stock

import (
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/api/deps"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/dashboard"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/inventory"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/replenishment"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func registerInventory(g *web.Router) {
	g.GET("/inventory/replenishment-defaults", replenishmentDefaults, auth.CurrentUser)
	g.GET("/inventory/balances", balances, auth.CurrentUser)
	g.GET("/inventory/low-stock", lowStock, auth.CurrentUser)
	g.GET("/inventory/balances/{material_id}", balanceDetail, auth.CurrentUser)
	g.POST("/inventory/inbounds", inbound, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	g.POST("/inventory/outbounds", outbound, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	g.GET("/inventory/operations", operations, auth.CurrentUser)
	g.GET("/inventory/operations/{operation_id}", operationDetail, auth.CurrentUser)
	g.PATCH("/inventory/operations/{operation_id}", editOperation, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	g.POST("/inventory/operations/{operation_id}/reverse", reverseOperation, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	g.POST("/inventory/low-stock/{material_id}/create-replenishment-draft", replenish, auth.WarehouseWriter, deps.RequireFullSecondaryWarehouse)
	g.GET("/dashboard/summary", summary, auth.CurrentUser)
}

func invalidTimeFilter() error {
	return apperr.New("VALIDATION_ERROR", "日期筛选参数无效").WithStatus(422)
}

// queryTime 对应 _query_time：毫秒时间戳或 ISO 字符串（Z 视为 +00:00），统一为 naive UTC。
func queryTime(value *string) (*time.Time, error) {
	if value == nil || *value == "" {
		return nil, nil
	}
	v := *value
	if isDigits(v) {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return nil, invalidTimeFilter()
		}
		ms := float64(n) / 1000
		// datetime.fromtimestamp 的有效范围：公元 1 年 ~ 9999 年。
		if ms < -62135596800 || ms > 253402300799 || math.IsInf(ms, 0) {
			return nil, invalidTimeFilter()
		}
		sec := math.Floor(ms)
		t := time.Unix(int64(sec), int64(math.Round((ms-sec)*1e6))*1000).UTC()
		return &t, nil
	}
	t, aware, ok := parsePyISO(strings.ReplaceAll(v, "Z", "+00:00"))
	if !ok {
		return nil, invalidTimeFilter()
	}
	if aware {
		t = t.UTC()
	}
	return &t, nil
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

// parsePyISO 覆盖 Python datetime.fromisoformat 的常见格式：日期、日期 + 时间（T 或空格分隔，
// 可选秒与小数秒）、可选时区偏移（±HH:MM[:SS] / ±HHMM / ±HH）。
func parsePyISO(s string) (time.Time, bool, bool) {
	datePart, timePart := s, ""
	if len(s) > 10 {
		if s[10] != 'T' && s[10] != ' ' {
			return time.Time{}, false, false
		}
		datePart, timePart = s[:10], s[11:]
	}
	d, err := time.ParseInLocation("2006-01-02", datePart, time.UTC)
	if err != nil {
		if len(datePart) == 8 && isDigits(datePart) {
			if d, err = time.ParseInLocation("20060102", datePart, time.UTC); err != nil {
				return time.Time{}, false, false
			}
		} else {
			return time.Time{}, false, false
		}
	}
	if timePart == "" {
		return d, false, true
	}
	var loc *time.Location
	aware := false
	if i := strings.IndexAny(timePart, "+-"); i >= 0 {
		off := timePart[i:]
		timePart = timePart[:i]
		sign := 1
		if off[0] == '-' {
			sign = -1
		}
		digits := strings.ReplaceAll(off[1:], ":", "")
		if !isDigits(digits) || (len(digits) != 2 && len(digits) != 4 && len(digits) != 6) {
			return time.Time{}, false, false
		}
		h, _ := strconv.Atoi(digits[:2])
		m, sec := 0, 0
		if len(digits) >= 4 {
			m, _ = strconv.Atoi(digits[2:4])
		}
		if len(digits) == 6 {
			sec, _ = strconv.Atoi(digits[4:6])
		}
		if h > 23 || m > 59 || sec > 59 {
			return time.Time{}, false, false
		}
		loc = time.FixedZone("", sign*(h*3600+m*60+sec))
		aware = true
	}
	var clock time.Time
	ok := false
	for _, layout := range []string{"15:04:05.999999", "15:04:05", "15:04", "15"} {
		if c, err := time.Parse(layout, timePart); err == nil {
			clock, ok = c, true
			break
		}
	}
	if !ok {
		return time.Time{}, false, false
	}
	if loc == nil {
		loc = time.UTC
	}
	t := time.Date(d.Year(), d.Month(), d.Day(), clock.Hour(), clock.Minute(), clock.Second(), clock.Nanosecond()/1000*1000, loc)
	return t, aware, true
}

func replenishmentDefaults(c *web.Ctx) error {
	out, err := replenishment.Defaults(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func balancePage(c *web.Ctx, q inventory.BalanceSearch, page, size int64) error {
	items, total, err := inventory.InventoryBalances(c.DB, q)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func balances(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	minQty := p.QueryDecimal("min_qty", "")
	maxQty := p.QueryDecimal("max_qty", "")
	low := p.QueryBool("low_stock", false)
	if err := p.Err(); err != nil {
		return err
	}
	return balancePage(c, inventory.BalanceSearch{Keyword: keyword, MinimumQty: minQty, MaximumQty: maxQty, LowStockOnly: low, Page: page, PageSize: size}, page, size)
}

func lowStock(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "")
	if err := p.Err(); err != nil {
		return err
	}
	return balancePage(c, inventory.BalanceSearch{Keyword: keyword, LowStockOnly: true, Page: page, PageSize: size}, page, size)
}

func balanceDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	if err := p.Err(); err != nil {
		return err
	}
	items, _, err := inventory.InventoryBalances(c.DB, inventory.BalanceSearch{Page: 1, PageSize: 1, MaterialID: &id})
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return apperr.New("NOT_FOUND", "库存物资不存在")
	}
	return c.OK(items[0])
}

func createOperation(c *web.Ctx, operationType string) error {
	p := c.Params()
	var data schema.OperationCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	op, err := inventory.CreateOperation(c.DB, data, operationType, inventory.CreateOptions{})
	if err != nil {
		return err
	}
	return c.Created(inventory.OperationRead(op))
}

func inbound(c *web.Ctx) error  { return createOperation(c, domain.OperationInbound) }
func outbound(c *web.Ctx) error { return createOperation(c, domain.OperationOutbound) }

func operations(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	operationNo := p.QueryStr("operation_no", "")
	operationType := p.QueryStr("operation_type", "oneof=INBOUND|OUTBOUND")
	materialName := p.QueryStr("material_name", "")
	sourceType := p.QueryStr("source_type", "oneof=MANUAL|MINI_PROGRAM|REVERSAL|INITIALIZATION")
	startAt := p.QueryStr("start_at", "")
	endAt := p.QueryStr("end_at", "")
	if err := p.Err(); err != nil {
		return err
	}
	start, err := queryTime(startAt)
	if err != nil {
		return err
	}
	end, err := queryTime(endAt)
	if err != nil {
		return err
	}
	if start != nil && end != nil && start.After(*end) {
		return apperr.New("VALIDATION_ERROR", "开始时间不能晚于结束时间").WithStatus(422)
	}
	items, total, err := inventory.SearchOperations(c.DB, inventory.OperationSearch{
		OperationNo: operationNo, OperationType: operationType, MaterialName: materialName, SourceType: sourceType,
		StartAt: start, EndAt: end, Page: page, PageSize: size,
	})
	if err != nil {
		return err
	}
	out := make([]schema.StockOperationRead, len(items))
	for i, op := range items {
		out[i] = inventory.OperationRead(op)
	}
	return c.OK(schema.NewPage(out, page, size, total))
}

func operationDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("operation_id")
	if err := p.Err(); err != nil {
		return err
	}
	op, err := inventory.GetOperation(c.DB, id, false)
	if err != nil {
		return err
	}
	return c.OK(inventory.OperationRead(op))
}

func editOperation(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("operation_id")
	var data schema.OperationUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	op, err := inventory.GetOperation(c.DB, id, true)
	if err != nil {
		return err
	}
	if op, err = inventory.UpdateOperation(c.DB, op, data); err != nil {
		return err
	}
	return c.OK(inventory.OperationRead(op))
}

func reverseOperation(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("operation_id")
	var data schema.ReverseOperationRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	original, err := inventory.GetOperation(c.DB, id, true)
	if err != nil {
		return err
	}
	op, err := inventory.ReverseOperation(c.DB, original, data)
	if err != nil {
		return err
	}
	return c.OK(inventory.OperationRead(op))
}

func replenish(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("material_id")
	var data schema.ReplenishmentDraftCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := replenishment.CreateDraft(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func summary(c *web.Ctx) error {
	out, err := dashboard.Summary(c.DB)
	if err != nil {
		return err
	}
	return c.OK(out)
}
