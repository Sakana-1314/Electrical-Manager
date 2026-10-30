package purchase

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/recordsync"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func syncTargetQuery(p *web.Params) recordsync.TargetQuery {
	return recordsync.TargetQuery{
		Limit:              p.QueryInt("limit", 50, "ge=1,le=200"),
		Cursor:             p.QueryInt("cursor", 0, "ge=0"),
		Fields:             p.QueryStr("fields", ""),
		MinPurchaseOrderNo: p.QueryStr("min_purchase_order_no", "max=128"),
		MaxPurchaseOrderNo: p.QueryStr("max_purchase_order_no", "max=128"),
	}
}

func syncTargets(c *web.Ctx) error {
	p := c.Params()
	q := syncTargetQuery(p)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := recordsync.ListSyncTargets(c.DB, q)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func syncTrace(c *web.Ctx) error {
	p := c.Params()
	traceNo := p.PathStr("trace_no", "")
	var data schema.PurchaseRecordSyncTraceUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := recordsync.ApplyTraceSync(c.DB, traceNo, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// syncOrderTargets 按申购单号列出待同步整单目标（整单一次平台查询、整单批量回写）。
func syncOrderTargets(c *web.Ctx) error {
	p := c.Params()
	q := syncTargetQuery(p)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := recordsync.ListSyncOrderTargets(c.DB, q)
	if err != nil {
		return err
	}
	return c.OK(out)
}

// syncOrderApply 整单批量回写：把一个申购单下多个追溯号的结果一次写回。
func syncOrderApply(c *web.Ctx) error {
	p := c.Params()
	orderNo := p.PathStr("purchase_order_no", "")
	var data schema.PurchaseRecordSyncOrderApply
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := recordsync.ApplyOrderSync(c.DB, orderNo, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}
