// Package work 是工作管理：一行一个任务，列与车间《任务详细计划》表一致
// （工作任务 / 事项或步骤 / 开始时间 / 完成时间 / 责任人 / 完成度 / 备注），
// 另加标签（英文逗号分隔字符串）与任务图片。
//
// 规则要点：
//   - 任务名不再要求唯一：同一件活可以在不同周重复登记；
//   - 标签按英文逗号规范化（去空、去重、去空白），筛选按标签精确匹配；
//   - 完成度是 0~100 的整数百分比，100 即「已完成」；
//   - 开始 / 完成时间都可留空，两者都填时完成不得早于开始；
//   - 写操作走乐观锁：PATCH 用请求体 version，DELETE 用 If-Match 头。
package work

import (
	"sort"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const tableTaskImage = "work_task_image"

// 关键字搜索覆盖任务名 / 事项或步骤 / 责任人 / 备注 / 标签。
var taskKeywordColumns = []string{"name", "steps", "owner", "remark", "tags"}

func trim(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.TrimSpace(*v)
	if t == "" {
		return nil
	}
	return &t
}

func scoped(s *db.Session, alias string) (*common.Where, error) {
	w := &common.Where{}
	if err := w.Scope(s, alias); err != nil {
		return nil, err
	}
	return w, nil
}

func nonNil(items []schema.FileObjectRead) []schema.FileObjectRead {
	if items == nil {
		return []schema.FileObjectRead{}
	}
	return items
}

// ValidateDateRange 开始 / 完成时间都可留空；两者都填时完成不得早于开始。
func ValidateDateRange(startDate, endDate *jtype.Date) error {
	if startDate == nil || endDate == nil {
		return nil
	}
	if endDate.Before(startDate.Time) {
		return apperr.New("WORK_DATE_RANGE", "完成时间不能早于开始时间")
	}
	return nil
}

// ParseDoneFilter 把 status 查询参数（未完成 / 已完成，可逗号分隔）解析成完成度过滤。
// 同时传两个值或空值时表示不限。
func ParseDoneFilter(value *string) *bool {
	if value == nil || *value == "" {
		return nil
	}
	done, undone := false, false
	for _, part := range strings.Split(*value, ",") {
		switch strings.TrimSpace(part) {
		case "已完成":
			done = true
		case "未完成":
			undone = true
		}
	}
	if done == undone {
		return nil
	}
	v := done
	return &v
}

// ParseTags 逗号分隔的标签筛选串 → 去重保序的标签列表。
func ParseTags(value *string) []string {
	if value == nil || *value == "" {
		return []string{}
	}
	return schema.SplitWorkTags(*value)
}

// TaskFilter 任务列表筛选条件（nil / 空 表示不限制）。
type TaskFilter struct {
	Keyword *string
	Tags    []string
	Done    *bool
}

func applyTaskFilter(w *common.Where, f TaskFilter) {
	w.ContainsAny(taskKeywordColumns, f.Keyword)
	if len(f.Tags) > 0 {
		// 命中任意一个选中标签即可：标签按英文逗号规范化落库，这里用「,标签,」包起来做精确匹配。
		parts := make([]string, 0, len(f.Tags))
		args := make([]any, 0, len(f.Tags))
		for _, tag := range f.Tags {
			parts = append(parts, "CONCAT(',', tags, ',') LIKE ? ESCAPE '/'")
			args = append(args, "%,"+common.LikeEscape(tag)+",%")
		}
		w.Add("("+strings.Join(parts, " OR ")+")", args...)
	}
	if f.Done != nil {
		if *f.Done {
			w.Add("progress >= ?", 100)
		} else {
			w.Add("progress < ?", 100)
		}
	}
}

func listTasks(s *db.Session, f TaskFilter, page, pageSize int64) ([]model.WorkTask, int64, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, 0, err
	}
	applyTaskFilter(w, f)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(id) FROM work_task"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	tasks := []model.WorkTask{}
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	// 开始时间新的在前；没有开始时间的排在最后，同一天按 id 倒序。
	if err := s.Select(&tasks, "SELECT "+model.ColsWorkTask+" FROM work_task"+w.SQL()+" ORDER BY start_date DESC NULLS LAST, id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	return tasks, total, nil
}

func getTask(s *db.Session, id int64) (*model.WorkTask, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var t model.WorkTask
	ok, err := s.Find(&t, "SELECT "+model.ColsWorkTask+" FROM work_task"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

// ===== 读模型组装 =====

func taskRead(t *model.WorkTask, images []schema.FileObjectRead) schema.WorkTaskRead {
	return schema.WorkTaskRead{
		ID: t.ID, Name: t.Name, Steps: t.Steps, StartDate: t.StartDate, EndDate: t.EndDate,
		Owner: t.Owner, Progress: t.Progress, Remark: t.Remark, Tags: t.Tags,
		Images:    nonNil(images),
		CreatedAt: common.UTC(t.CreatedAt), UpdatedAt: common.UTC(t.UpdatedAt), Version: t.Version,
	}
}

func taskReads(s *db.Session, tasks []model.WorkTask) ([]schema.WorkTaskRead, error) {
	ids := make([]int64, len(tasks))
	for i := range tasks {
		ids[i] = tasks[i].ID
	}
	images, err := loadImages(s, tableTaskImage, "task_id", ids)
	if err != nil {
		return nil, err
	}
	out := make([]schema.WorkTaskRead, len(tasks))
	for i := range tasks {
		out[i] = taskRead(&tasks[i], images[tasks[i].ID])
	}
	return out, nil
}

func taskReadFresh(s *db.Session, taskID int64) (schema.WorkTaskRead, error) {
	t, err := getTask(s, taskID)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	if t == nil {
		return schema.WorkTaskRead{}, apperr.NotFound("任务")
	}
	rows, err := taskReads(s, []model.WorkTask{*t})
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	return rows[0], nil
}

// ===== 任务 =====

// ListTasks 任务列表：按开始时间倒序分页（没有开始时间的排在最后）。
func ListTasks(s *db.Session, f TaskFilter, page, pageSize int64) ([]schema.WorkTaskRead, int64, error) {
	tasks, total, err := listTasks(s, f, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	reads, err := taskReads(s, tasks)
	if err != nil {
		return nil, 0, err
	}
	return reads, total, nil
}

// GetTaskRead 任务详情，不存在报 NOT_FOUND「任务不存在」。
func GetTaskRead(s *db.Session, taskID int64) (schema.WorkTaskRead, error) {
	return taskReadFresh(s, taskID)
}

func CreateTask(s *db.Session, data schema.WorkTaskCreate) (schema.WorkTaskRead, error) {
	if err := ValidateDateRange(data.StartDate, data.EndDate); err != nil {
		return schema.WorkTaskRead{}, err
	}
	fs, err := files(s, data.ImageIDs)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	now := common.UTCNow()
	t := model.WorkTask{
		Name: data.Name, Steps: trim(data.Steps), StartDate: data.StartDate, EndDate: data.EndDate,
		Owner: trim(data.Owner), Progress: data.Progress, Remark: trim(data.Remark), Tags: data.Tags,
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO work_task (name, steps, start_date, end_date, owner, progress, remark, tags, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		t.Name, t.Steps, t.StartDate, t.EndDate, t.Owner, t.Progress, t.Remark, t.Tags, t.ProjectID, t.CreatedAt, t.UpdatedAt, t.Version)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	t.ID = id
	if err := insertImages(s, tableTaskImage, "task_id", id, fs); err != nil {
		return schema.WorkTaskRead{}, err
	}
	return taskRead(&t, fileReads(fs)), nil
}

func UpdateTask(s *db.Session, taskID int64, data schema.WorkTaskUpdate) (schema.WorkTaskRead, error) {
	t, err := getTask(s, taskID)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	if t == nil {
		return schema.WorkTaskRead{}, apperr.NotFound("任务")
	}
	if err := apperr.ValidateVersion(&data.Version, t.Version); err != nil {
		return schema.WorkTaskRead{}, err
	}
	if data.Name != nil {
		t.Name = *data.Name
	}
	// 文本 / 日期字段用「字段是否出现在请求里」区分：传 null 或空串表示清空，不传表示不改。
	if data.Steps.Set {
		t.Steps = trim(data.Steps.Ptr())
	}
	if data.StartDate.Set {
		t.StartDate = data.StartDate.Ptr()
	}
	if data.EndDate.Set {
		t.EndDate = data.EndDate.Ptr()
	}
	if data.Owner.Set {
		t.Owner = trim(data.Owner.Ptr())
	}
	if data.Progress != nil {
		t.Progress = *data.Progress
	}
	if data.Remark.Set {
		t.Remark = trim(data.Remark.Ptr())
	}
	if data.Tags.Set {
		if v := data.Tags.Ptr(); v != nil {
			t.Tags = *v
		} else {
			t.Tags = ""
		}
	}
	if err := ValidateDateRange(t.StartDate, t.EndDate); err != nil {
		return schema.WorkTaskRead{}, err
	}
	if data.ImageIDs != nil {
		fs, err := files(s, *data.ImageIDs)
		if err != nil {
			return schema.WorkTaskRead{}, err
		}
		if err := replaceImages(s, tableTaskImage, "task_id", t.ID, fs); err != nil {
			return schema.WorkTaskRead{}, err
		}
	}
	t.Version++
	t.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	w.Add("id = ?", t.ID)
	if _, err := s.Exec("UPDATE work_task SET name = ?, steps = ?, start_date = ?, end_date = ?, owner = ?, progress = ?, remark = ?, tags = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{t.Name, t.Steps, t.StartDate, t.EndDate, t.Owner, t.Progress, t.Remark, t.Tags, t.Version, t.UpdatedAt}, w.Args...)...); err != nil {
		return schema.WorkTaskRead{}, err
	}
	return taskReadFresh(s, taskID)
}

func DeleteTask(s *db.Session, taskID int64, expectedVersion *int64) error {
	t, err := getTask(s, taskID)
	if err != nil {
		return err
	}
	if t == nil {
		return apperr.NotFound("任务")
	}
	if err := apperr.ValidateVersion(expectedVersion, t.Version); err != nil {
		return err
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("task_id = ?", t.ID)
	if _, err := s.Exec("DELETE FROM "+tableTaskImage+w.SQL(), w.Args...); err != nil {
		return err
	}
	w, err = scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", t.ID)
	_, err = s.Exec("DELETE FROM work_task"+w.SQL(), w.Args...)
	return err
}

// ListTags 项目内出现过的标签（去重升序），供筛选下拉与输入辅助使用。
func ListTags(s *db.Session) ([]string, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	var texts []string
	if err := s.Select(&texts, "SELECT tags FROM work_task"+w.SQL(), w.Args...); err != nil {
		return nil, err
	}
	set := map[string]bool{}
	for _, text := range texts {
		for _, tag := range schema.SplitWorkTags(text) {
			set[tag] = true
		}
	}
	out := make([]string, 0, len(set))
	for tag := range set {
		out = append(out, tag)
	}
	sort.Strings(out)
	return out, nil
}
