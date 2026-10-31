package purchase

import (
	"context"
	"fmt"
	"io"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/excelexport"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/exportjob"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/file"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/purchaserequest"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

const recordSearchFields = "plan_no|plan_date|purchase_order_no|trace_no|contract_no|vessel_no|consolidation_date|consolidation_port|sailing_date|contract_sign_date|unit_price|category|material_code|material_name|model_spec|unit_name|purchase_qty|salesperson|status|purchase_date|usage|subitem_no|plan_remark|record_remark"

// recordResultHeaders 申购记录结果导出列 → 表头。
var recordResultHeaders = map[string]string{
	"purchase_qty":         "申购数量",
	"plan_date":            "需求日期",
	"purchase_order_no":    "申购单号",
	"trace_no":             "追溯号",
	"contract_no":          "合同号",
	"vessel_no":            "船号",
	"consolidation_date":   "集港日期",
	"consolidation_port":   "集港港口",
	"sailing_date":         "发船日期",
	"contract_sign_date":   "合同签订日期",
	"unit_price":           "单价",
	"category":             "类别",
	"demand_department":    "需求部门",
	"material_name":        "物资名称",
	"model_spec":           "物资型号",
	"material_code":        "物料编码",
	"actual_demand_person": "提报员工",
	"usage":                "用途",
	"purchase_responsible": "实际需求人",
	"salesperson":          "业务员",
	"status":               "状态",
	"purchase_date":        "申购日期",
	"images":               "图片",
	"subitem_no":           "子项号",
}

func listPurchaseRecords(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	status := p.QueryStr("status", "max=128")
	emptyStatus := p.QueryBool("empty_status", false)
	keyword := p.QueryStr("keyword", "")
	searchField := p.QueryStr("search_field", "oneof="+recordSearchFields)
	searchValue := p.QueryStr("search_value", "max=255")
	purchaseOrderNo := p.QueryStr("purchase_order_no", "max=255")
	traceNo := p.QueryStr("trace_no", "max=255")
	category := p.QueryStr("category", "max=64")
	name := p.QueryStr("name", "max=128")
	modelSpec := p.QueryStr("model_spec", "max=255")
	usage := p.QueryStr("usage", "max=500")
	actualDemandPerson := p.QueryStr("actual_demand_person", "max=128")
	purchaseResponsible := p.QueryStr("purchase_responsible", "max=128")
	salesperson := p.QueryStr("salesperson", "max=128")
	subitemNo := p.QueryStr("subitem_no", "max=64")
	emptySubitemNo := p.QueryBool("empty_subitem_no", false)
	aiExpand := p.QueryBool("ai_expand", false)
	sortBy := p.QueryStr("sort_by", "oneof="+schema.PurchaseRecordResultColumns)
	sortOrder := p.QueryStrDefault("sort_order", "asc", "oneof=asc|desc")
	if err := p.Err(); err != nil {
		return err
	}
	if aiExpand {
		var err error
		if keyword, err = expand(c, keyword); err != nil {
			return err
		}
		if name, err = expand(c, name); err != nil {
			return err
		}
		if searchField != nil && *searchField == "material_name" {
			if searchValue, err = expand(c, searchValue); err != nil {
				return err
			}
		}
	}
	lines, total, err := purchaserequest.SearchPurchaseRecords(c.DB, purchaserequest.RecordSearch{
		Status: status, EmptyStatus: emptyStatus, Keyword: keyword, SearchField: searchField, SearchValue: searchValue,
		PurchaseOrderNo: purchaseOrderNo, TraceNo: traceNo, Category: category, Name: name, ModelSpec: modelSpec,
		Usage: usage, ActualDemandPerson: actualDemandPerson, PurchaseResponsible: purchaseResponsible,
		Salesperson: salesperson, SubitemNo: subitemNo, EmptySubitemNo: emptySubitemNo, Page: page, PageSize: size,
		SortBy: sortBy, SortOrder: sortOrder,
	})
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(purchaserequest.PurchaseRecordReads(lines), page, size, total))
}

func purchaseRecordFilterOptions(c *web.Ctx) error {
	persons, responsibles, subitems, categories, err := purchaserequest.PurchaseRecordFilterOptions(c.DB)
	if err != nil {
		return err
	}
	salespersons, err := purchaserequest.PurchaseSalespersonOptions(c.DB)
	if err != nil {
		return err
	}
	statuses, err := purchaserequest.PurchaseStatusOptions(c.DB)
	if err != nil {
		return err
	}
	return c.OK(schema.PurchaseRecordFilterOptions{
		ActualDemandPersons: persons, PurchaseResponsibles: responsibles, SubitemNos: subitems,
		Categories: categories, Salespersons: salespersons, Statuses: statuses,
	})
}

// exportPurchaseRecordResults 查询结果导出（含图片，耗时较长）：202 秒回任务，渲染在后台异步执行。
func exportPurchaseRecordResults(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewPurchaseRecordResultExportRequest()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	job, err := exportjob.EnqueueExport(c.DB, "PURCHASE_RECORD_RESULTS", data, recordExportProcessor(data), userIDPtr(c))
	if err != nil {
		return err
	}
	return c.JSON(202, job)
}

// searchRecordsForExport 便于测试钩子模拟「结果超限」（对应 Python 用例 monkeypatch search_purchase_records）。
func searchRecordsForExport(s *db.Session, q purchaserequest.RecordSearch) ([]*purchaserequest.Line, int64, error) {
	if total := fakeRecordExportTotal.Swap(0); total > 0 {
		return []*purchaserequest.Line{}, total, nil
	}
	return purchaserequest.SearchPurchaseRecords(s, q)
}

// recordExportProcessor 申购记录导出处理器：查库 + 拼行 + 渲染图片 Excel。
func recordExportProcessor(data schema.PurchaseRecordResultExportRequest) exportjob.Processor {
	return func(ctx context.Context, s *db.Session, target string) (map[string]any, error) {
		lines, total, err := searchRecordsForExport(s, purchaserequest.RecordSearch{
			Status: data.Status, EmptyStatus: data.EmptyStatus, PurchaseOrderNo: data.PurchaseOrderNo,
			TraceNo: data.TraceNo, Category: data.Category, Name: data.Name, ModelSpec: data.ModelSpec, Usage: data.Usage,
			ActualDemandPerson: data.ActualDemandPerson, PurchaseResponsible: data.PurchaseResponsible,
			Salesperson: data.Salesperson, SubitemNo: data.SubitemNo, EmptySubitemNo: data.EmptySubitemNo,
			Page: 1, PageSize: common.ExportRowLimit + 1, SortBy: data.SortBy, SortOrder: data.SortOrder,
		})
		if err != nil {
			return nil, err
		}
		if total > common.ExportRowLimit {
			return nil, exportLimitExceeded(total)
		}
		rows := make([]map[string]any, 0, len(lines))
		for _, line := range lines {
			r := purchaserequest.PurchaseRecordRead(line)
			paths := excelexport.ImagePaths{}
			for _, img := range r.Images {
				if file.FileExists(img.ID) {
					paths = append(paths, file.FilePath(img.ID))
				}
			}
			rows = append(rows, map[string]any{
				"purchase_qty":         fmt.Sprintf("%s %s", purchaserequest.QuantityText(r.PurchaseQty), r.UnitName),
				"plan_date":            r.PlanDate,
				"purchase_order_no":    r.PurchaseOrderNo,
				"trace_no":             r.TraceNo,
				"contract_no":          r.ContractNo,
				"vessel_no":            r.VesselNo,
				"consolidation_date":   r.ConsolidationDate,
				"consolidation_port":   r.ConsolidationPort,
				"sailing_date":         r.SailingDate,
				"contract_sign_date":   r.ContractSignDate,
				"unit_price":           r.UnitPrice,
				"category":             r.Category,
				"demand_department":    r.DemandDepartment,
				"material_name":        r.MaterialName,
				"model_spec":           r.ModelSpec,
				"material_code":        r.MaterialCode,
				"actual_demand_person": r.ActualDemandPerson,
				"usage":                r.Usage,
				"purchase_responsible": r.PurchaseResponsible,
				"salesperson":          r.Salesperson,
				"status":               r.Status,
				"purchase_date":        r.PurchaseDate,
				"subitem_no":           r.SubitemNo,
				"images":               paths,
			})
		}
		columns := make([]excelexport.Column, len(data.Columns))
		for i, key := range data.Columns {
			columns[i] = excelexport.Column{Key: key, Label: recordResultHeaders[key]}
		}
		var filename string
		if err := excelexport.WriteExportFileFrom(target, func(w io.Writer) error {
			var err error
			filename, err = excelexport.RenderResultExcelTo(w, "申购记录导出", columns, rows)
			return err
		}); err != nil {
			return nil, err
		}
		return map[string]any{"download_filename": filename, "rows": len(rows), "image_count": imageCount(rows)}, nil
	}
}

func batchEditPurchaseRecords(c *web.Ctx) error {
	p := c.Params()
	var data schema.BatchUpdatePurchaseRecordsRequest
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	lines, err := purchaserequest.BatchUpdatePurchaseRecords(c.DB, data)
	if err != nil {
		return err
	}
	return c.OK(purchaserequest.PurchaseRecordReads(lines))
}

func purchaseRecordDetail(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("line_id")
	if err := p.Err(); err != nil {
		return err
	}
	line, err := purchaserequest.GetPurchaseRecord(c.DB, id, false)
	if err != nil {
		return err
	}
	return c.OK(purchaserequest.PurchaseRecordRead(line))
}

func restorePurchaseRecordToPlan(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("line_id")
	ifMatch := p.IfMatch()
	if err := p.Err(); err != nil {
		return err
	}
	line, err := purchaserequest.GetPurchaseRecord(c.DB, id, true)
	if err != nil {
		return err
	}
	item, err := purchaserequest.RestorePurchaseRecordToPlan(c.DB, line, ifMatch)
	if err != nil {
		return err
	}
	out, err := material.PurchaseRead(c.DB, item, nil)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func editPurchaseRecord(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("line_id")
	data := schema.NewPurchaseRecordUpdate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	line, err := purchaserequest.GetPurchaseRecord(c.DB, id, true)
	if err != nil {
		return err
	}
	if line, err = purchaserequest.UpdatePurchaseRecord(c.DB, line, data); err != nil {
		return err
	}
	return c.OK(purchaserequest.PurchaseRecordRead(line))
}
