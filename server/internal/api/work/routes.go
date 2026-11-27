// Package work 是工作管理接口：一行一个任务（工作任务 / 事项或步骤 / 开始时间 /
// 完成时间 / 责任人 / 完成度 / 备注 / 标签 / 图片）。
//
// 权限：读取需要 work:read，写操作需要 work:write（超级管理员 / 工作管理员）。
package work

import (
	"github.com/Sakana-1314/Electrical-Manager/server/internal/auth"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	svc "github.com/Sakana-1314/Electrical-Manager/server/internal/service/work"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/web"
)

func Register(r *web.Router) {
	g := r.Group("", auth.RequireProject)

	g.GET("/work-tasks", listTasks, auth.WorkReader)
	g.GET("/work-task-tags", listTaskTags, auth.WorkReader)
	g.GET("/work-tasks/{task_id}", getTask, auth.WorkReader)
	g.POST("/work-tasks", createTask, auth.WorkWriter)
	g.PATCH("/work-tasks/{task_id}", updateTask, auth.WorkWriter)
	g.DELETE("/work-tasks/{task_id}", deleteTask, auth.WorkWriter)
}

func listTasks(c *web.Ctx) error {
	p := c.Params()
	page, size := p.Page()
	keyword := p.QueryStr("keyword", "max=255")
	tags := p.QueryStr("tags", "max=500")
	status := p.QueryStr("status", "max=64")
	if err := p.Err(); err != nil {
		return err
	}
	items, total, err := svc.ListTasks(c.DB, svc.TaskFilter{
		Keyword: keyword, Tags: svc.ParseTags(tags), Done: svc.ParseDoneFilter(status),
	}, page, size)
	if err != nil {
		return err
	}
	return c.OK(schema.NewPage(items, page, size, total))
}

// listTaskTags 项目内出现过的标签（去重升序），供筛选下拉与标签输入辅助。
func listTaskTags(c *web.Ctx) error {
	p := c.Params()
	if err := p.Err(); err != nil {
		return err
	}
	tags, err := svc.ListTags(c.DB)
	if err != nil {
		return err
	}
	return c.OK(tags)
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
