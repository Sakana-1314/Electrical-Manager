// Package work 对应原 services/work_service.py + repositories/work_repository.py：
// 工作总览（按天展开）+ 任务视图 + 人员视图。
//
// 规则要点：
//   - 一条工作记录 = 一个任务 + 一段起止时间（起止都精确到上午 / 下午）+ 参与人员 + 备注；
//     参与人员落库时拆分、去重保序，以「、」连接存进 work_record.participants；
//   - 半日占用判定（OccupiedHalves）只有这里一处实现；
//   - 任务名在项目内唯一；任务下的工作记录不允许级联删除，删任务前必须先删记录；
//   - 三个视图都要求查询区间并封顶 WorkRangeMaxDays 天；
//   - 写操作走乐观锁：PATCH 用请求体 version，DELETE 用 If-Match 头。
//
// 数据库里任务状态存枚举**名称**，读写时用 domain.WorkTaskStatus 转换。
package work

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	SlotFullDay   = "全天"
	SlotMorning   = "上午"
	SlotAfternoon = "下午"

	tableTaskImage = "work_task_image"
)

// 总览行的时段排序权重：同一天同一任务先「全天」再「上午」再「下午」。
var slotOrder = map[string]int{SlotFullDay: 0, SlotMorning: 1, SlotAfternoon: 2}

var (
	taskKeywordColumns   = []string{"name", "description", "remark"}
	recordKeywordColumns = []string{"t.name", "r.participants", "r.remark"}
)

func trim(v *string) *string {
	if v == nil {
		return nil
	}
	t := schema.PyStrip(*v)
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

// ===== 参与人员与时间段的纯逻辑 =====

// ParseParticipants 把 work_record.participants 的姓名串解析成去重保序的姓名列表。
func ParseParticipants(value string) []string {
	names := []string{}
	if value == "" {
		return names
	}
	seen := map[string]bool{}
	for _, part := range schema.SplitParticipants(value) {
		name := schema.PyStrip(part)
		if name != "" && !seen[name] {
			seen[name] = true
			names = append(names, name)
		}
	}
	return names
}

// FormatParticipants 规范化写入：去重保序、以「、」连接。
func FormatParticipants(names []string) string {
	unique := []string{}
	seen := map[string]bool{}
	for _, n := range names {
		t := schema.PyStrip(n)
		if t != "" && !seen[t] {
			seen[t] = true
			unique = append(unique, t)
		}
	}
	return strings.Join(unique, "、")
}

func dateRange(code, msg string) error { return apperr.New(code, msg) }

// ValidateRecordRange 结束不得早于开始；同一天时「下午 → 上午」这种空区间也要拦掉。
func ValidateRecordRange(startDate jtype.Date, startHalf string, endDate jtype.Date, endHalf string) error {
	if endDate.Before(startDate.Time) {
		return dateRange("WORK_DATE_RANGE", "结束日期不能早于开始日期")
	}
	if endDate.Equal(startDate.Time) && startHalf == domain.HalfDayPM && endHalf == domain.HalfDayAM {
		return dateRange("WORK_DATE_RANGE", "当天的结束时段不能早于开始时段")
	}
	return nil
}

// ValidatePlanRange 任务计划起止：两者都填时结束不得早于开始。
func ValidatePlanRange(planStart, planEnd *jtype.Date) error {
	if planStart == nil || planEnd == nil {
		return nil
	}
	if planEnd.Before(planStart.Time) {
		return dateRange("WORK_DATE_RANGE", "计划结束日期不能早于计划开始日期")
	}
	return nil
}

// ValidateQueryRange 查询区间：结束不得早于开始，且最长 WorkRangeMaxDays 天（含端点）。
func ValidateQueryRange(startDate, endDate jtype.Date) error {
	if endDate.Before(startDate.Time) {
		return dateRange("WORK_DATE_RANGE", "查询区间的结束日期不能早于开始日期")
	}
	days := int(endDate.Sub(startDate.Time).Hours()/24) + 1
	if days > schema.WorkRangeMaxDays {
		return dateRange("WORK_RANGE_TOO_LONG", fmt.Sprintf("查询区间最长 %d 天，请缩小范围后重试", schema.WorkRangeMaxDays))
	}
	return nil
}

// OccupiedHalves 记录在 day 这一天的占用情况 (上午, 下午)；不在区间内返回 (false, false)。
func OccupiedHalves(r *model.WorkRecord, day jtype.Date) (bool, bool) {
	if day.Before(r.StartDate.Time) || day.After(r.EndDate.Time) {
		return false, false
	}
	morning := day.After(r.StartDate.Time) || r.StartHalf == domain.HalfDayAM
	afternoon := day.Before(r.EndDate.Time) || r.EndHalf == domain.HalfDayPM
	return morning, afternoon
}

// RecordSlots 记录在 day 的时段标签：全天 / 上午 / 下午；当天完全没占用返回 ""。
func RecordSlots(r *model.WorkRecord, day jtype.Date) string {
	morning, afternoon := OccupiedHalves(r, day)
	switch {
	case morning && afternoon:
		return SlotFullDay
	case morning:
		return SlotMorning
	case afternoon:
		return SlotAfternoon
	}
	return ""
}

// DaySlot 是记录按天展开后的一项。
type DaySlot struct {
	Date jtype.Date
	Slot string
}

func maxDate(a, b jtype.Date) jtype.Date {
	if a.After(b.Time) {
		return a
	}
	return b
}

func minDate(a, b jtype.Date) jtype.Date {
	if a.Before(b.Time) {
		return a
	}
	return b
}

// RecordDays 把一条记录展开成 (日期, 时段) 列表（只覆盖查询区间内的天）。
func RecordDays(r *model.WorkRecord, startDate, endDate jtype.Date) []DaySlot {
	first := maxDate(r.StartDate, startDate)
	last := minDate(r.EndDate, endDate)
	rows := []DaySlot{}
	for day := first; !day.After(last.Time); day = jtype.DateOf(day.AddDate(0, 0, 1)) {
		if slot := RecordSlots(r, day); slot != "" {
			rows = append(rows, DaySlot{Date: day, Slot: slot})
		}
	}
	return rows
}

// ===== 查询参数解析 =====

func parseDigitInt(part string) (int64, bool) {
	t := schema.PyStrip(part)
	if t == "" {
		return 0, false
	}
	for _, r := range t {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.ParseInt(t, 10, 64)
	if err != nil {
		return math.MaxInt64, true
	}
	return n, true
}

// ParseIDList 英文逗号分隔的正整数 id 串 → 去重升序列表（非数字项直接丢弃）。
func ParseIDList(value *string) []int64 {
	out := []int64{}
	if value == nil || *value == "" {
		return out
	}
	set := map[int64]bool{}
	for _, part := range strings.Split(*value, ",") {
		if n, ok := parseDigitInt(part); ok && n > 0 && !set[n] {
			set[n] = true
			out = append(out, n)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// ParseNames 英文逗号分隔的姓名串 → 去重保序的姓名列表。
func ParseNames(value *string) []string {
	names := []string{}
	if value == nil || *value == "" {
		return names
	}
	seen := map[string]bool{}
	for _, part := range strings.Split(*value, ",") {
		name := schema.PyStrip(part)
		if name != "" && !seen[name] {
			seen[name] = true
			names = append(names, name)
		}
	}
	return names
}

// ParseStatuses 英文逗号分隔的任务状态串（值）→ 状态值列表；无法识别的值直接丢弃。
func ParseStatuses(value *string) []string {
	out := []string{}
	if value == nil || *value == "" {
		return out
	}
	for _, part := range strings.Split(*value, ",") {
		st := schema.PyStrip(part)
		if !domain.WorkTaskStatus.Valid(st) {
			continue
		}
		dup := false
		for _, x := range out {
			if x == st {
				dup = true
			}
		}
		if !dup {
			out = append(out, st)
		}
	}
	return out
}

// matchesKeyword 姓名筛选：与全站 OR 搜索同口径（| / ｜ 分隔，命中任一即可）。
func matchesKeyword(name string, keyword *string) bool {
	if keyword == nil || *keyword == "" {
		return true
	}
	for _, term := range strings.Split(strings.ReplaceAll(*keyword, "｜", "|"), "|") {
		term = schema.PyStrip(term)
		if term != "" && strings.Contains(name, term) {
			return true
		}
	}
	return false
}

// ===== 持久化查询 =====

// recordRow 是带所属任务名称 / 状态的工作记录。
type recordRow struct {
	model.WorkRecord
	TaskName   string `db:"task_name"`
	TaskStatus string `db:"task_status"`
}

var recordCols = func() string {
	return model.Prefixed("r", model.ColsWorkRecord) + ", t.name AS task_name, t.status AS task_status"
}()

// TaskFilter 任务列表筛选条件（nil / 空 表示不限制）。Statuses 为枚举**值**。
type TaskFilter struct {
	Keyword  *string
	Statuses []string
}

func applyTaskFilter(w *common.Where, f TaskFilter) {
	w.ContainsAny(taskKeywordColumns, f.Keyword)
	if len(f.Statuses) > 0 {
		names := make([]any, len(f.Statuses))
		for i, st := range f.Statuses {
			names[i] = domain.WorkTaskStatus.ToDB(st)
		}
		w.Add("status IN ("+common.Placeholders(len(names))+")", names...)
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
	if err := s.Select(&tasks, "SELECT "+model.ColsWorkTask+" FROM work_task"+w.SQL()+" ORDER BY id LIMIT ? OFFSET ?", args...); err != nil {
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

func findTaskByName(s *db.Session, name string, excludeID *int64) (*model.WorkTask, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("name = ?", name)
	if excludeID != nil {
		w.Add("id != ?", *excludeID)
	}
	var t model.WorkTask
	ok, err := s.Find(&t, "SELECT "+model.ColsWorkTask+" FROM work_task"+w.SQL()+" LIMIT 1", w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

func countRecordsByTask(s *db.Session, taskIDs []int64) (map[int64]int64, error) {
	out := map[int64]int64{}
	if len(taskIDs) == 0 {
		return out, nil
	}
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("task_id IN ("+common.Placeholders(len(taskIDs))+")", common.AnyArgs(taskIDs)...)
	var rows []struct {
		TaskID int64 `db:"task_id"`
		N      int64 `db:"n"`
	}
	if err := s.Select(&rows, "SELECT task_id, COUNT(id) AS n FROM work_record"+w.SQL()+" GROUP BY task_id", w.Args...); err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.TaskID] = r.N
	}
	return out, nil
}

func countRecordsOfTask(s *db.Session, taskID int64) (int64, error) {
	w, err := scoped(s, "")
	if err != nil {
		return 0, err
	}
	w.Add("task_id = ?", taskID)
	var n int64
	err = s.Get(&n, "SELECT COUNT(id) FROM work_record"+w.SQL(), w.Args...)
	return n, err
}

// RecordFilter 工作记录筛选条件：必带查询区间（与区间有交集的记录才算命中）。
type RecordFilter struct {
	StartDate jtype.Date
	EndDate   jtype.Date
	TaskIDs   []int64
	Keyword   *string
}

func recordScope(s *db.Session) (*common.Where, error) {
	w, err := scoped(s, "r.")
	if err != nil {
		return nil, err
	}
	if err := w.Scope(s, "t."); err != nil {
		return nil, err
	}
	return w, nil
}

func listRecords(s *db.Session, f RecordFilter) ([]recordRow, error) {
	w, err := recordScope(s)
	if err != nil {
		return nil, err
	}
	w.Add("r.start_date <= ?", f.EndDate).Add("r.end_date >= ?", f.StartDate)
	if len(f.TaskIDs) > 0 {
		w.Add("r.task_id IN ("+common.Placeholders(len(f.TaskIDs))+")", common.AnyArgs(f.TaskIDs)...)
	}
	w.ContainsAny(recordKeywordColumns, f.Keyword)
	rows := []recordRow{}
	err = s.Select(&rows, "SELECT "+recordCols+" FROM work_record r JOIN work_task t ON r.task_id = t.id"+w.SQL()+
		" ORDER BY r.start_date, r.start_half, r.id", w.Args...)
	return rows, err
}

func getRecord(s *db.Session, id int64) (*recordRow, error) {
	w, err := recordScope(s)
	if err != nil {
		return nil, err
	}
	w.Add("r.id = ?", id)
	var r recordRow
	ok, err := s.Find(&r, "SELECT "+recordCols+" FROM work_record r JOIN work_task t ON r.task_id = t.id"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &r, nil
}

func listParticipantTexts(s *db.Session) ([]string, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	var out []string
	err = s.Select(&out, "SELECT participants FROM work_record"+w.SQL(), w.Args...)
	return out, err
}

// ===== 读模型组装 =====

func taskReads(s *db.Session, tasks []model.WorkTask, counts map[int64]int64) ([]schema.WorkTaskRead, error) {
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
		t := &tasks[i]
		out[i] = schema.WorkTaskRead{
			ID: t.ID, Name: t.Name, Description: t.Description, Status: domain.WorkTaskStatus.FromDB(t.Status),
			PlanStartDate: t.PlanStartDate, PlanEndDate: t.PlanEndDate, Remark: t.Remark,
			Images: nonNil(images[t.ID]), RecordCount: counts[t.ID],
			CreatedAt: common.UTC(t.CreatedAt), UpdatedAt: common.UTC(t.UpdatedAt), Version: t.Version,
		}
	}
	return out, nil
}

func recordRead(r *recordRow) schema.WorkRecordRead {
	return schema.WorkRecordRead{
		ID: r.ID, TaskID: r.TaskID, TaskName: r.TaskName, TaskStatus: domain.WorkTaskStatus.FromDB(r.TaskStatus),
		StartDate: r.StartDate, StartHalf: domain.WorkHalfDay.FromDB(r.StartHalf),
		EndDate: r.EndDate, EndHalf: domain.WorkHalfDay.FromDB(r.EndHalf),
		Participants: ParseParticipants(r.Participants), Remark: r.Remark,
		CreatedAt: common.UTC(r.CreatedAt), UpdatedAt: common.UTC(r.UpdatedAt), Version: r.Version,
	}
}

func taskReadFresh(s *db.Session, taskID int64) (schema.WorkTaskRead, error) {
	t, err := getTask(s, taskID)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	if t == nil {
		return schema.WorkTaskRead{}, apperr.NotFound("任务")
	}
	n, err := countRecordsOfTask(s, taskID)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	rows, err := taskReads(s, []model.WorkTask{*t}, map[int64]int64{t.ID: n})
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	return rows[0], nil
}

func recordReadFresh(s *db.Session, recordID int64) (schema.WorkRecordRead, error) {
	r, err := getRecord(s, recordID)
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	if r == nil {
		return schema.WorkRecordRead{}, apperr.NotFound("工作记录")
	}
	return recordRead(r), nil
}

// ===== 任务 =====

// ListTasks 任务列表：按主键升序分页。
func ListTasks(s *db.Session, keyword *string, statuses []string, page, pageSize int64) ([]schema.WorkTaskRead, int64, error) {
	tasks, total, err := listTasks(s, TaskFilter{Keyword: trim(keyword), Statuses: statuses}, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int64, len(tasks))
	for i := range tasks {
		ids[i] = tasks[i].ID
	}
	counts, err := countRecordsByTask(s, ids)
	if err != nil {
		return nil, 0, err
	}
	reads, err := taskReads(s, tasks, counts)
	if err != nil {
		return nil, 0, err
	}
	return reads, total, nil
}

// GetTaskRead 任务详情，不存在报 NOT_FOUND「任务不存在」。
func GetTaskRead(s *db.Session, taskID int64) (schema.WorkTaskRead, error) {
	return taskReadFresh(s, taskID)
}

func ensureTaskNameFree(s *db.Session, name string, excludeID *int64) error {
	t, err := findTaskByName(s, name, excludeID)
	if err != nil {
		return err
	}
	if t != nil {
		return apperr.New("DUPLICATE_WORK_TASK", fmt.Sprintf("任务「%s」已存在，请直接编辑该任务", name))
	}
	return nil
}

func CreateTask(s *db.Session, data schema.WorkTaskCreate) (schema.WorkTaskRead, error) {
	if err := ensureTaskNameFree(s, data.Name, nil); err != nil {
		return schema.WorkTaskRead{}, err
	}
	if err := ValidatePlanRange(data.PlanStartDate, data.PlanEndDate); err != nil {
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
		Name: data.Name, Description: trim(data.Description), Status: domain.WorkTaskStatus.ToDB(data.Status),
		PlanStartDate: data.PlanStartDate, PlanEndDate: data.PlanEndDate, Remark: trim(data.Remark),
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO work_task (name, description, status, plan_start_date, plan_end_date, remark, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		t.Name, t.Description, t.Status, t.PlanStartDate, t.PlanEndDate, t.Remark, t.ProjectID, t.CreatedAt, t.UpdatedAt, t.Version)
	if err != nil {
		return schema.WorkTaskRead{}, err
	}
	t.ID = id
	if err := insertImages(s, tableTaskImage, "task_id", id, fs); err != nil {
		return schema.WorkTaskRead{}, err
	}
	return schema.WorkTaskRead{
		ID: t.ID, Name: t.Name, Description: t.Description, Status: data.Status,
		PlanStartDate: t.PlanStartDate, PlanEndDate: t.PlanEndDate, Remark: t.Remark,
		Images: fileReads(fs), RecordCount: 0,
		CreatedAt: common.UTC(t.CreatedAt), UpdatedAt: common.UTC(t.UpdatedAt), Version: t.Version,
	}, nil
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
	if data.Name != nil && *data.Name != t.Name {
		if err := ensureTaskNameFree(s, *data.Name, &taskID); err != nil {
			return schema.WorkTaskRead{}, err
		}
		t.Name = *data.Name
	}
	if data.Status != nil {
		t.Status = domain.WorkTaskStatus.ToDB(*data.Status)
	}
	// 计划日期 / 描述 / 备注用「字段是否出现在请求里」区分：传 null 或空串表示清空，不传表示不改。
	if data.PlanStartDate.Set {
		t.PlanStartDate = data.PlanStartDate.Ptr()
	}
	if data.PlanEndDate.Set {
		t.PlanEndDate = data.PlanEndDate.Ptr()
	}
	if err := ValidatePlanRange(t.PlanStartDate, t.PlanEndDate); err != nil {
		return schema.WorkTaskRead{}, err
	}
	if data.Description.Set {
		t.Description = trim(data.Description.Ptr())
	}
	if data.Remark.Set {
		t.Remark = trim(data.Remark.Ptr())
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
	if _, err := s.Exec("UPDATE work_task SET name = ?, description = ?, status = ?, plan_start_date = ?, plan_end_date = ?, remark = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{t.Name, t.Description, t.Status, t.PlanStartDate, t.PlanEndDate, t.Remark, t.Version, t.UpdatedAt}, w.Args...)...); err != nil {
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
	n, err := countRecordsOfTask(s, taskID)
	if err != nil {
		return err
	}
	if n > 0 {
		return apperr.New("WORK_TASK_HAS_RECORDS", fmt.Sprintf("任务「%s」下还有 %d 条工作记录，请先删除记录", t.Name, n)).WithStatus(409)
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

// ===== 工作记录 =====

// GetRecordRead 工作记录详情，不存在报 NOT_FOUND「工作记录不存在」。
func GetRecordRead(s *db.Session, recordID int64) (schema.WorkRecordRead, error) {
	return recordReadFresh(s, recordID)
}

func requireTask(s *db.Session, taskID int64) (*model.WorkTask, error) {
	t, err := getTask(s, taskID)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, apperr.New("INVALID_WORK_TASK_ID", "任务不存在").WithDetails(apperr.D{"task_id": taskID})
	}
	return t, nil
}

func CreateRecord(s *db.Session, data schema.WorkRecordCreate) (schema.WorkRecordRead, error) {
	task, err := requireTask(s, data.TaskID)
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	if err := ValidateRecordRange(data.StartDate, data.StartHalf, data.EndDate, data.EndHalf); err != nil {
		return schema.WorkRecordRead{}, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	now := common.UTCNow()
	r := recordRow{
		WorkRecord: model.WorkRecord{
			TaskID: data.TaskID, StartDate: data.StartDate, StartHalf: domain.WorkHalfDay.ToDB(data.StartHalf),
			EndDate: data.EndDate, EndHalf: domain.WorkHalfDay.ToDB(data.EndHalf),
			Participants: FormatParticipants(data.Participants), Remark: trim(data.Remark),
			ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
		},
		TaskName: task.Name, TaskStatus: task.Status,
	}
	id, err := s.Insert("INSERT INTO work_record (task_id, start_date, start_half, end_date, end_half, participants, remark, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		r.TaskID, r.StartDate, r.StartHalf, r.EndDate, r.EndHalf, r.Participants, r.Remark, r.ProjectID, r.CreatedAt, r.UpdatedAt, r.Version)
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	r.ID = id
	return recordRead(&r), nil
}

func UpdateRecord(s *db.Session, recordID int64, data schema.WorkRecordUpdate) (schema.WorkRecordRead, error) {
	r, err := getRecord(s, recordID)
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	if r == nil {
		return schema.WorkRecordRead{}, apperr.NotFound("工作记录")
	}
	if err := apperr.ValidateVersion(&data.Version, r.Version); err != nil {
		return schema.WorkRecordRead{}, err
	}
	if data.TaskID != nil && *data.TaskID != r.TaskID {
		if _, err := requireTask(s, *data.TaskID); err != nil {
			return schema.WorkRecordRead{}, err
		}
		r.TaskID = *data.TaskID
	}
	// 日期与上下午档成对提交（schema 已校验），这里按落库后的值整体校验区间。
	startDate, startHalf := r.StartDate, domain.WorkHalfDay.FromDB(r.StartHalf)
	endDate, endHalf := r.EndDate, domain.WorkHalfDay.FromDB(r.EndHalf)
	if v := data.StartDate.Ptr(); v != nil {
		startDate = *v
	}
	if v := data.StartHalf.Ptr(); v != nil {
		startHalf = *v
	}
	if v := data.EndDate.Ptr(); v != nil {
		endDate = *v
	}
	if v := data.EndHalf.Ptr(); v != nil {
		endHalf = *v
	}
	if err := ValidateRecordRange(startDate, startHalf, endDate, endHalf); err != nil {
		return schema.WorkRecordRead{}, err
	}
	r.StartDate, r.StartHalf = startDate, domain.WorkHalfDay.ToDB(startHalf)
	r.EndDate, r.EndHalf = endDate, domain.WorkHalfDay.ToDB(endHalf)
	if data.Participants != nil {
		r.Participants = FormatParticipants(*data.Participants)
	}
	if data.Remark.Set {
		r.Remark = trim(data.Remark.Ptr())
	}
	r.Version++
	r.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return schema.WorkRecordRead{}, err
	}
	w.Add("id = ?", r.ID)
	if _, err := s.Exec("UPDATE work_record SET task_id = ?, start_date = ?, start_half = ?, end_date = ?, end_half = ?, participants = ?, remark = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{r.TaskID, r.StartDate, r.StartHalf, r.EndDate, r.EndHalf, r.Participants, r.Remark, r.Version, r.UpdatedAt}, w.Args...)...); err != nil {
		return schema.WorkRecordRead{}, err
	}
	return recordReadFresh(s, recordID)
}

func DeleteRecord(s *db.Session, recordID int64, expectedVersion *int64) error {
	r, err := getRecord(s, recordID)
	if err != nil {
		return err
	}
	if r == nil {
		return apperr.NotFound("工作记录")
	}
	if err := apperr.ValidateVersion(expectedVersion, r.Version); err != nil {
		return err
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", r.ID)
	_, err = s.Exec("DELETE FROM work_record"+w.SQL(), w.Args...)
	return err
}

// ===== 三个视图 =====

func pageSlice[T any](rows []T, page, pageSize int64) []T {
	start := (page - 1) * pageSize
	if start >= int64(len(rows)) {
		return []T{}
	}
	end := start + pageSize
	if end > int64(len(rows)) {
		end = int64(len(rows))
	}
	return rows[start:end]
}

// OverviewQuery 工作总览查询条件。
type OverviewQuery struct {
	StartDate    jtype.Date
	EndDate      jtype.Date
	TaskIDs      []int64
	Participants []string
	Keyword      *string
}

// ListOverview 工作总览：区间内的记录按天展开成 (日期, 任务, 时段) 行，再筛选、排序、分页。
// 人员筛选按拆分后的姓名做精确匹配。
func ListOverview(s *db.Session, q OverviewQuery, page, pageSize int64) ([]schema.WorkOverviewRowRead, int64, error) {
	if err := ValidateQueryRange(q.StartDate, q.EndDate); err != nil {
		return nil, 0, err
	}
	records, err := listRecords(s, RecordFilter{StartDate: q.StartDate, EndDate: q.EndDate, TaskIDs: q.TaskIDs, Keyword: trim(q.Keyword)})
	if err != nil {
		return nil, 0, err
	}
	wanted := map[string]bool{}
	for _, n := range q.Participants {
		wanted[n] = true
	}
	rows := []schema.WorkOverviewRowRead{}
	for i := range records {
		r := &records[i]
		names := ParseParticipants(r.Participants)
		if len(wanted) > 0 {
			hit := false
			for _, n := range names {
				if wanted[n] {
					hit = true
					break
				}
			}
			if !hit {
				continue
			}
		}
		for _, ds := range RecordDays(&r.WorkRecord, q.StartDate, q.EndDate) {
			rows = append(rows, schema.WorkOverviewRowRead{
				Date: ds.Date, RecordID: r.ID, TaskID: r.TaskID, TaskName: r.TaskName,
				TaskStatus: domain.WorkTaskStatus.FromDB(r.TaskStatus), Slot: ds.Slot, Participants: names, Remark: r.Remark,
			})
		}
	}
	// 最近的日期在前；同一天内按任务名、时段、记录 id 稳定排序。
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := rows[i], rows[j]
		if !a.Date.Equal(b.Date.Time) {
			return a.Date.After(b.Date.Time)
		}
		if a.TaskName != b.TaskName {
			return a.TaskName < b.TaskName
		}
		if slotOrder[a.Slot] != slotOrder[b.Slot] {
			return slotOrder[a.Slot] < slotOrder[b.Slot]
		}
		return a.RecordID < b.RecordID
	})
	return pageSlice(rows, page, pageSize), int64(len(rows)), nil
}

// ListTaskTimeline 任务视图：任务按分页返回，每个任务带上区间内它的工作记录（按开始日期升序）。
func ListTaskTimeline(s *db.Session, startDate, endDate jtype.Date, statuses []string, keyword *string, page, pageSize int64) ([]schema.WorkTaskTimelineRead, int64, error) {
	if err := ValidateQueryRange(startDate, endDate); err != nil {
		return nil, 0, err
	}
	tasks, total, err := listTasks(s, TaskFilter{Keyword: trim(keyword), Statuses: statuses}, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int64, len(tasks))
	for i := range tasks {
		ids[i] = tasks[i].ID
	}
	counts, err := countRecordsByTask(s, ids)
	if err != nil {
		return nil, 0, err
	}
	var records []recordRow
	if len(ids) > 0 {
		if records, err = listRecords(s, RecordFilter{StartDate: startDate, EndDate: endDate, TaskIDs: ids}); err != nil {
			return nil, 0, err
		}
	}
	byTask := map[int64][]schema.WorkRecordRead{}
	for i := range records {
		byTask[records[i].TaskID] = append(byTask[records[i].TaskID], recordRead(&records[i]))
	}
	reads, err := taskReads(s, tasks, counts)
	if err != nil {
		return nil, 0, err
	}
	out := make([]schema.WorkTaskTimelineRead, len(tasks))
	for i := range tasks {
		recs := byTask[tasks[i].ID]
		if recs == nil {
			recs = []schema.WorkRecordRead{}
		}
		out[i] = schema.WorkTaskTimelineRead{Task: reads[i], Records: recs}
	}
	return out, total, nil
}

// ListWorkerTimeline 人员视图：把区间内的记录按参与人姓名分组，一人一行（组内记录按开始日期升序）。
func ListWorkerTimeline(s *db.Session, startDate, endDate jtype.Date, keyword *string, page, pageSize int64) ([]schema.WorkWorkerTimelineRead, int64, error) {
	if err := ValidateQueryRange(startDate, endDate); err != nil {
		return nil, 0, err
	}
	records, err := listRecords(s, RecordFilter{StartDate: startDate, EndDate: endDate})
	if err != nil {
		return nil, 0, err
	}
	groups := map[string][]int{}
	for i := range records {
		for _, n := range ParseParticipants(records[i].Participants) {
			groups[n] = append(groups[n], i)
		}
	}
	all := make([]string, 0, len(groups))
	for n := range groups {
		all = append(all, n)
	}
	sort.Strings(all)
	kw := trim(keyword)
	names := []string{}
	for _, n := range all {
		if matchesKeyword(n, kw) {
			names = append(names, n)
		}
	}
	out := []schema.WorkWorkerTimelineRead{}
	for _, n := range pageSlice(names, page, pageSize) {
		recs := make([]schema.WorkRecordRead, len(groups[n]))
		for i, idx := range groups[n] {
			recs[i] = recordRead(&records[idx])
		}
		out = append(out, schema.WorkWorkerTimelineRead{Name: n, RecordCount: int64(len(recs)), Records: recs})
	}
	return out, int64(len(names)), nil
}

// ListParticipants 项目内历史上出现过的参与人姓名（去重升序），供输入辅助与筛选下拉使用。
func ListParticipants(s *db.Session, keyword *string) ([]string, error) {
	texts, err := listParticipantTexts(s)
	if err != nil {
		return nil, err
	}
	set := map[string]bool{}
	for _, t := range texts {
		for _, n := range ParseParticipants(t) {
			set[n] = true
		}
	}
	all := make([]string, 0, len(set))
	for n := range set {
		all = append(all, n)
	}
	sort.Strings(all)
	kw := trim(keyword)
	out := []string{}
	for _, n := range all {
		if matchesKeyword(n, kw) {
			out = append(out, n)
		}
	}
	return out, nil
}
