// Package work 是工作管理接口：工作总览 / 任务视图 / 人员视图（对应 api/v1/work.py）。
//
// 权限：读取对所有登录用户开放；写操作需要 WorkWriter（超级管理员 / 工作管理员）。
// 三个视图的查询区间都是必填参数，且封顶 WorkRangeMaxDays 天。
package work

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/work"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("", auth.RequireProject)

	g.GET("/work-tasks", listTasks, auth.CurrentUser)
	g.GET("/work-tasks/{task_id}", getTask, auth.CurrentUser)
	g.POST("/work-tasks", createTask, auth.WorkWriter)
	g.PATCH("/work-tasks/{task_id}", updateTask, auth.WorkWriter)
	g.DELETE("/work-tasks/{task_id}", deleteTask, auth.WorkWriter)

	g.GET("/work-records/{record_id}", getRecord, auth.CurrentUser)
	g.POST("/work-records", createRecord, auth.WorkWriter)
	g.PATCH("/work-records/{record_id}", updateRecord, auth.WorkWriter)
	g.DELETE("/work-records/{record_id}", deleteRecord, auth.WorkWriter)

	g.GET("/work-overview", overview, auth.CurrentUser)
	g.GET("/work-task-timeline", taskTimeline, auth.CurrentUser)
	g.GET("/work-worker-timeline", workerTimeline, auth.CurrentUser)
	g.GET("/work-participants", participants, auth.CurrentUser)
}

// ===== 任务 =====

func listTasks(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	status := p.QueryStr("status", "max=128")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListTasks(c.DB, keyword, svc.ParseStatuses(status), page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

func getTask(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("task_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.GetTaskRead(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func createTask(c *web.Ctx) error {
	p := c.Params()
	data := schema.NewWorkTaskCreate()
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateTask(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func updateTask(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("task_id")
	var data schema.WorkTaskUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.UpdateTask(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteTask(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("task_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteTask(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ===== 工作记录 =====

func getRecord(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("record_id")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.GetRecordRead(c.DB, id)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func createRecord(c *web.Ctx) error {
	p := c.Params()
	var data schema.WorkRecordCreate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.CreateRecord(c.DB, data)
	if err != nil {
		return err
	}
	return c.Created(out)
}

func updateRecord(c *web.Ctx) error {
	p := c.Params()
	id := p.PathInt("record_id")
	var data schema.WorkRecordUpdate
	p.Body(&data)
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.UpdateRecord(c.DB, id, data)
	if err != nil {
		return err
	}
	return c.OK(out)
}

func deleteRecord(c *web.Ctx) error {
	p := c.Params()
	ifMatch := p.IfMatch()
	id := p.PathInt("record_id")
	if err := p.Err(); err != nil {
		return err
	}
	if err := svc.DeleteRecord(c.DB, id, ifMatch); err != nil {
		return err
	}
	return c.NoContent()
}

// ===== 三个视图 =====

func overview(c *web.Ctx) error {
	p := c.Params()
	start := p.QueryDateRequired("start_date")
	end := p.QueryDateRequired("end_date")
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	taskIDs := p.QueryStr("task_ids", "max=500")
	names := p.QueryStr("participants", "max=500")
	if err := p.Err(); err != nil {
		return err
	}
	rows, total, err := svc.ListOverview(c.DB, svc.OverviewQuery{
		StartDate: start, EndDate: end, TaskIDs: svc.ParseIDList(taskIDs), Participants: svc.ParseNames(names), Keyword: keyword,
	}, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(rows, page, size, total))
}

func taskTimeline(c *web.Ctx) error {
	p := c.Params()
	start := p.QueryDateRequired("start_date")
	end := p.QueryDateRequired("end_date")
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	status := p.QueryStr("status", "max=128")
	if err := p.Err(); err != nil {
		return err
	}
	rows, total, err := svc.ListTaskTimeline(c.DB, start, end, svc.ParseStatuses(status), keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(rows, page, size, total))
}

func workerTimeline(c *web.Ctx) error {
	p := c.Params()
	start := p.QueryDateRequired("start_date")
	end := p.QueryDateRequired("end_date")
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=128")
	if err := p.Err(); err != nil {
		return err
	}
	rows, total, err := svc.ListWorkerTimeline(c.DB, start, end, keyword, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(rows, page, size, total))
}

func participants(c *web.Ctx) error {
	p := c.Params()
	keyword := p.QueryStr("keyword", "max=128")
	if err := p.Err(); err != nil {
		return err
	}
	out, err := svc.ListParticipants(c.DB, keyword)
	if err != nil {
		return err
	}
	return c.OK(out)
}
