package miniprogram

// 申购记录的三个只读查询：申购模块（purchase_request_repository）由其他代理并行移植，暂不在本主线里，
// 这里按 Python 原样复制为私有函数，合并后与申购模块去重。

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// searchMiniProgramPurchaseRecords 对应 purchase_request_repository.search_mini_program_purchase_records：
// 小程序申购记录列表，keyword 仅 OR 匹配 名称 / 型号 / 追溯号 / 申购单号；按行 id 倒序分页。
func searchMiniProgramPurchaseRecords(s *db.Session, keyword, status, subitemNo *string, page, pageSize int64) ([]model.PurchaseRequestLine, int64, error) {
	requestScope, rargs, err := scopeAnd(s, "r.")
	if err != nil {
		return nil, 0, err
	}
	from := " FROM purchase_request_line l JOIN purchase_request r ON r.id = l.purchase_request_id" + requestScope
	w := &common.Where{}
	if err := w.Scope(s, "l."); err != nil {
		return nil, 0, err
	}
	w.ContainsAny([]string{"l.material_name_snapshot", "l.model_spec_snapshot", "l.trace_no", "r.purchase_order_no"}, keyword)
	if status != nil && *status != "" {
		w.Add("TRIM(l.status) = ?", pyStrip(*status))
	}
	if subitemNo != nil && *subitemNo != "" {
		w.Add("TRIM(l.subitem_no) = ?", pyStrip(*subitemNo))
	}
	args := append(append([]any{}, rargs...), w.Args...)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(*)"+from+w.SQL(), args...); err != nil {
		return nil, 0, err
	}
	var lines []model.PurchaseRequestLine
	if err := s.Select(&lines, "SELECT "+model.Prefixed("l", model.ColsPurchaseRequestLine)+from+w.SQL()+
		" ORDER BY l.id DESC LIMIT ? OFFSET ?", append(args, pageSize, common.Offset(page, pageSize))...); err != nil {
		return nil, 0, err
	}
	return lines, total, nil
}

// purchaseStatusOptions 对应 purchase_request_repository.purchase_status_options：非空状态去重升序。
func purchaseStatusOptions(s *db.Session) ([]string, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, err
	}
	w.Add("status IS NOT NULL")
	w.Add("TRIM(status) != ''")
	out := []string{}
	if err := s.Select(&out, "SELECT DISTINCT status FROM purchase_request_line"+w.SQL()+" ORDER BY status", w.Args...); err != nil {
		return nil, err
	}
	return out, nil
}

// purchaseSubitemOptions 对应 purchase_request_repository.purchase_subitem_options：非空子项号去重升序。
func purchaseSubitemOptions(s *db.Session) ([]string, error) {
	w := &common.Where{}
	if err := w.Scope(s, ""); err != nil {
		return nil, err
	}
	w.Add("subitem_no IS NOT NULL")
	w.Add("TRIM(subitem_no) != ''")
	var rows []*string
	if err := s.Select(&rows, "SELECT DISTINCT subitem_no FROM purchase_request_line"+w.SQL()+" ORDER BY subitem_no", w.Args...); err != nil {
		return nil, err
	}
	out := []string{}
	for _, v := range rows {
		if v != nil {
			out = append(out, *v)
		}
	}
	return out, nil
}
