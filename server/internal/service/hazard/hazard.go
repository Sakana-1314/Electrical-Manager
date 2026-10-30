// Package hazard 对应原 services/hazard_service.py + repositories/hazard_repository.py：
// 隐患台账 + 隐患类型 + 责任单位。
//
// 规则要点：
//   - 新建隐患时按责任单位带出责任人快照，缺省值（检查区域/检查人员/要求完成时间）在服务端兜底；
//   - 要求完成时间缺省 = 检查日期 + 7 天（今天按上海时区取业务日期）；
//   - 责任单位停用后不再出现在新增下拉里，但历史隐患仍保留名称与责任人快照；
//   - 隐患类型同一「大类 + 小类」组合唯一，隐患类型与责任单位被隐患引用时不允许删除；
//   - 隐患、隐患类型、责任单位为物理删除（图片关联表随隐患删除）。
//
// 数据库里隐患状态 / 等级存枚举**名称**，读写时用 domain.HazardStatus / domain.HazardLevel 转换。
package hazard

import (
	"fmt"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

const (
	DefaultArea      = "华星现场"
	DefaultInspector = "电气自查"
	DefaultDueDays   = 7

	tableBefore = "hazard_before_image"
	tableAfter  = "hazard_after_image"
)

// BusinessToday 业务「今天」按上海时区取（部署在 UTC 容器里也不会差一天）。
func BusinessToday() jtype.Date { return jtype.DateOf(time.Now().In(common.Shanghai)) }

func pyStrip(s string) string { return strings.TrimFunc(s, common.PyIsSpace) }

// trim 对应 _trim：None 原样返回，去空白后为空串返回 None。
func trim(v *string) *string {
	if v == nil {
		return nil
	}
	t := pyStrip(*v)
	if t == "" {
		return nil
	}
	return &t
}

func orDefault(v *string, def string) string {
	if t := trim(v); t != nil {
		return *t
	}
	return def
}

// containsOne 等价 col.contains(term, autoescape=True)（单个关键词，不拆分 |）。
func containsOne(col, term string) (string, any) {
	return col + " LIKE ? ESCAPE '/'", "%" + common.LikeEscape(term) + "%"
}

func scoped(s *db.Session, alias string) (*common.Where, error) {
	w := &common.Where{}
	if err := w.Scope(s, alias); err != nil {
		return nil, err
	}
	return w, nil
}

// ===== 读模型 =====

// HazardRead 组装单条隐患读模型（加载责任单位 / 隐患类型 / 整改前后图片）。
func HazardRead(s *db.Session, item *model.Hazard) (schema.HazardRead, error) {
	out, err := hazardReads(s, []model.Hazard{*item})
	if err != nil {
		return schema.HazardRead{}, err
	}
	return out[0], nil
}

func hazardReads(s *db.Session, items []model.Hazard) ([]schema.HazardRead, error) {
	out := make([]schema.HazardRead, 0, len(items))
	if len(items) == 0 {
		return out, nil
	}
	ids := make([]int64, len(items))
	unitIDs := make([]int64, 0, len(items))
	typeIDs := make([]int64, 0, len(items))
	for i, it := range items {
		ids[i] = it.ID
		unitIDs = append(unitIDs, it.HazardUnitID)
		typeIDs = append(typeIDs, it.HazardTypeID)
	}
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	var units []model.HazardUnit
	if err := s.SelectIn(&units, "SELECT "+model.ColsHazardUnit+" FROM hazard_unit"+w.SQL()+andWord(w)+"id IN (?)", append(append([]any{}, w.Args...), unitIDs)...); err != nil {
		return nil, err
	}
	var types []model.HazardType
	if err := s.SelectIn(&types, "SELECT "+model.ColsHazardType+" FROM hazard_type"+w.SQL()+andWord(w)+"id IN (?)", append(append([]any{}, w.Args...), typeIDs)...); err != nil {
		return nil, err
	}
	unitByID := map[int64]*model.HazardUnit{}
	for i := range units {
		unitByID[units[i].ID] = &units[i]
	}
	typeByID := map[int64]*model.HazardType{}
	for i := range types {
		typeByID[types[i].ID] = &types[i]
	}
	before, err := loadImages(s, tableBefore, "hazard_id", ids)
	if err != nil {
		return nil, err
	}
	after, err := loadImages(s, tableAfter, "hazard_id", ids)
	if err != nil {
		return nil, err
	}
	for i := range items {
		it := &items[i]
		r := schema.HazardRead{
			ID: it.ID, InspectionArea: it.InspectionArea, InspectionDate: it.InspectionDate, Inspector: it.Inspector,
			Description: it.Description, Suggestion: it.Suggestion, HazardUnitID: it.HazardUnitID, Person: it.Person,
			DueDate: it.DueDate, RecheckPerson: it.RecheckPerson, RectifyPerson: it.RectifyPerson,
			Status: domain.HazardStatus.FromDB(it.Status), HazardTypeID: it.HazardTypeID,
			Level: domain.HazardLevel.FromDB(it.Level), Remark: it.Remark,
			BeforeImages: nonNil(before[it.ID]), AfterImages: nonNil(after[it.ID]),
			CreatedAt: common.UTC(it.CreatedAt), UpdatedAt: common.UTC(it.UpdatedAt), Version: it.Version,
		}
		if u := unitByID[it.HazardUnitID]; u != nil {
			r.HazardUnitName = u.Name
		}
		if t := typeByID[it.HazardTypeID]; t != nil {
			r.Major, r.Minor = t.Major, t.Minor
		}
		out = append(out, r)
	}
	return out, nil
}

func andWord(w *common.Where) string {
	if w.Empty() {
		return " WHERE "
	}
	return " AND "
}

func nonNil(items []schema.FileObjectRead) []schema.FileObjectRead {
	if items == nil {
		return []schema.FileObjectRead{}
	}
	return items
}

// ===== 隐患台账 =====

// HazardFilter 隐患列表筛选条件（nil 表示不限制）。Status / Level 为枚举**值**。
type HazardFilter struct {
	Status        *string
	Level         *string
	HazardTypeID  *int64
	HazardUnitID  *int64
	Area          *string
	Keyword       *string
	RectifyPerson *string
	DateFrom      *jtype.Date
	DateTo        *jtype.Date
	// 小程序搜索框只匹配「检查区域 + 隐患描述」；网页端关键字匹配更多字段。
	KeywordAreaDescriptionOnly bool
}

var (
	keywordColumns         = []string{"description", "suggestion", "remark", "inspection_area", "inspector", "person"}
	areaDescriptionColumns = []string{"inspection_area", "description"}
)

func applyFilter(w *common.Where, f HazardFilter) {
	if f.Status != nil {
		w.Add("status = ?", domain.HazardStatus.ToDB(*f.Status))
	}
	if f.Level != nil && *f.Level != "" {
		w.Add("level = ?", domain.HazardLevel.ToDB(*f.Level))
	}
	if f.HazardTypeID != nil && *f.HazardTypeID != 0 {
		w.Add("hazard_type_id = ?", *f.HazardTypeID)
	}
	if f.HazardUnitID != nil && *f.HazardUnitID != 0 {
		w.Add("hazard_unit_id = ?", *f.HazardUnitID)
	}
	if f.Area != nil && *f.Area != "" {
		cond, arg := containsOne("inspection_area", *f.Area)
		w.Add(cond, arg)
	}
	if f.RectifyPerson != nil && *f.RectifyPerson != "" {
		w.Add("TRIM(rectify_person) = ?", *f.RectifyPerson)
	}
	if f.Keyword != nil && *f.Keyword != "" {
		cols := keywordColumns
		if f.KeywordAreaDescriptionOnly {
			cols = areaDescriptionColumns
		}
		parts := make([]string, len(cols))
		args := make([]any, len(cols))
		for i, col := range cols {
			parts[i], args[i] = containsOne(col, *f.Keyword)
		}
		w.Add("("+strings.Join(parts, " OR ")+")", args...)
	}
	if f.DateFrom != nil {
		w.Add("inspection_date >= ?", *f.DateFrom)
	}
	if f.DateTo != nil {
		w.Add("inspection_date <= ?", *f.DateTo)
	}
}

// ListHazards 隐患列表：按创建时间倒序分页；返回 (当前页读模型, 总条数)。
// Area / Keyword / RectifyPerson 在这里去空白（空串视为不限）。
func ListHazards(s *db.Session, f HazardFilter, page, pageSize int64) ([]schema.HazardRead, int64, error) {
	f.Area, f.Keyword, f.RectifyPerson = trim(f.Area), trim(f.Keyword), trim(f.RectifyPerson)
	w, err := scoped(s, "")
	if err != nil {
		return nil, 0, err
	}
	applyFilter(w, f)
	var total int64
	if err := s.Get(&total, "SELECT COUNT(id) FROM hazard"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var items []model.Hazard
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&items, "SELECT "+model.ColsHazard+" FROM hazard"+w.SQL()+" ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	reads, err := hazardReads(s, items)
	if err != nil {
		return nil, 0, err
	}
	return reads, total, nil
}

func findHazard(s *db.Session, id int64) (*model.Hazard, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var h model.Hazard
	ok, err := s.Find(&h, "SELECT "+model.ColsHazard+" FROM hazard"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &h, nil
}

// GetHazard 按 id 取隐患，不存在报 NOT_FOUND「隐患不存在」。
func GetHazard(s *db.Session, id int64) (*model.Hazard, error) {
	h, err := findHazard(s, id)
	if err != nil {
		return nil, err
	}
	if h == nil {
		return nil, apperr.NotFound("隐患")
	}
	return h, nil
}

// GetHazardRead = hazard_read(get_hazard(...))。
func GetHazardRead(s *db.Session, id int64) (schema.HazardRead, error) {
	h, err := GetHazard(s, id)
	if err != nil {
		return schema.HazardRead{}, err
	}
	return HazardRead(s, h)
}

func findByClientRequestID(s *db.Session, clientRequestID string) (*model.Hazard, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("client_request_id = ?", clientRequestID)
	var h model.Hazard
	ok, err := s.Find(&h, "SELECT "+model.ColsHazard+" FROM hazard"+w.SQL()+" LIMIT 1", w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &h, nil
}

func unitPersonRequired(u *model.HazardUnit) error {
	return apperr.New("HAZARD_UNIT_PERSON_REQUIRED", fmt.Sprintf("责任单位「%s」未配置责任人", u.Name))
}

// CreateHazard 登记隐患。
//
// clientRequestID 非空时先查幂等键：小程序弱网重试命中既有记录直接返回，不会重复登记；
// defaultInspector 供小程序把检查人员缺省成当前用户姓名（网页端传 DefaultInspector）。
func CreateHazard(s *db.Session, data schema.HazardCreate, clientRequestID *string, defaultInspector string) (schema.HazardRead, error) {
	if clientRequestID != nil {
		existing, err := findByClientRequestID(s, *clientRequestID)
		if err != nil {
			return schema.HazardRead{}, err
		}
		if existing != nil {
			return HazardRead(s, existing)
		}
	}
	unit, err := findUnit(s, data.HazardUnitID)
	if err != nil {
		return schema.HazardRead{}, err
	}
	if unit == nil {
		return schema.HazardRead{}, apperr.NotFound("责任单位")
	}
	if pyStrip(unit.Person) == "" {
		return schema.HazardRead{}, unitPersonRequired(unit)
	}
	hazardType, err := findType(s, data.HazardTypeID)
	if err != nil {
		return schema.HazardRead{}, err
	}
	if hazardType == nil {
		return schema.HazardRead{}, apperr.NotFound("隐患类型")
	}

	inspectionDate := BusinessToday()
	if data.InspectionDate != nil {
		inspectionDate = *data.InspectionDate
	}
	inspector := orDefault(data.Inspector, defaultInspector)
	beforeFiles, err := files(s, data.BeforeImageIDs)
	if err != nil {
		return schema.HazardRead{}, err
	}
	afterFiles, err := files(s, data.AfterImageIDs)
	if err != nil {
		return schema.HazardRead{}, err
	}
	dueDate := jtype.DateOf(inspectionDate.Time.AddDate(0, 0, DefaultDueDays))
	if data.DueDate != nil {
		dueDate = *data.DueDate
	}
	recheck := inspector
	if t := trim(data.RecheckPerson); t != nil {
		recheck = *t
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.HazardRead{}, err
	}
	now := common.UTCNow()
	item := model.Hazard{
		InspectionArea:  orDefault(data.InspectionArea, DefaultArea),
		InspectionDate:  inspectionDate,
		Inspector:       inspector,
		Description:     pyStrip(data.Description),
		Suggestion:      data.Suggestion,
		HazardUnitID:    unit.ID,
		Person:          pyStrip(unit.Person),
		DueDate:         dueDate,
		RecheckPerson:   &recheck,
		RectifyPerson:   trim(data.RectifyPerson),
		Status:          domain.HazardStatus.ToDB(data.Status),
		HazardTypeID:    hazardType.ID,
		Level:           domain.HazardLevel.ToDB(data.Level),
		Remark:          data.Remark,
		ClientRequestID: clientRequestID,
		ProjectID:       pid,
		CreatedAt:       now,
		UpdatedAt:       now,
		Version:         1,
	}
	id, err := s.Insert("INSERT INTO hazard (inspection_area, inspection_date, inspector, description, suggestion, hazard_unit_id, person, due_date, recheck_person, rectify_person, status, hazard_type_id, level, remark, client_request_id, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		item.InspectionArea, item.InspectionDate, item.Inspector, item.Description, item.Suggestion, item.HazardUnitID, item.Person,
		item.DueDate, item.RecheckPerson, item.RectifyPerson, item.Status, item.HazardTypeID, item.Level, item.Remark,
		item.ClientRequestID, item.ProjectID, item.CreatedAt, item.UpdatedAt, item.Version)
	if err != nil {
		return schema.HazardRead{}, err
	}
	item.ID = id
	if err := insertImages(s, tableBefore, "hazard_id", id, beforeFiles); err != nil {
		return schema.HazardRead{}, err
	}
	if err := insertImages(s, tableAfter, "hazard_id", id, afterFiles); err != nil {
		return schema.HazardRead{}, err
	}
	return readWith(&item, unit, hazardType, beforeFiles, afterFiles), nil
}

// readWith 用已知的关联对象直接组装读模型（写操作后免去重新查询）。
func readWith(it *model.Hazard, unit *model.HazardUnit, t *model.HazardType, before, after []model.FileObject) schema.HazardRead {
	return schema.HazardRead{
		ID: it.ID, InspectionArea: it.InspectionArea, InspectionDate: it.InspectionDate, Inspector: it.Inspector,
		Description: it.Description, Suggestion: it.Suggestion, HazardUnitID: it.HazardUnitID, HazardUnitName: unit.Name,
		Person: it.Person, DueDate: it.DueDate, RecheckPerson: it.RecheckPerson, RectifyPerson: it.RectifyPerson,
		Status: domain.HazardStatus.FromDB(it.Status), HazardTypeID: it.HazardTypeID, Major: t.Major, Minor: t.Minor,
		Level: domain.HazardLevel.FromDB(it.Level), Remark: it.Remark,
		BeforeImages: fileReads(before), AfterImages: fileReads(after),
		CreatedAt: common.UTC(it.CreatedAt), UpdatedAt: common.UTC(it.UpdatedAt), Version: it.Version,
	}
}

// UpdateHazard 更新隐患（PATCH，请求体 version 乐观锁）。
func UpdateHazard(s *db.Session, id int64, data schema.HazardUpdate) (schema.HazardRead, error) {
	item, err := GetHazard(s, id)
	if err != nil {
		return schema.HazardRead{}, err
	}
	if err := apperr.ValidateVersion(&data.Version, item.Version); err != nil {
		return schema.HazardRead{}, err
	}
	if data.InspectionArea != nil {
		item.InspectionArea = orDefault(data.InspectionArea, DefaultArea)
	}
	if data.InspectionDate != nil {
		item.InspectionDate = *data.InspectionDate
	}
	if data.Inspector != nil {
		item.Inspector = orDefault(data.Inspector, DefaultInspector)
	}
	if data.Description != nil {
		item.Description = pyStrip(*data.Description)
	}
	if data.Suggestion != nil {
		item.Suggestion = data.Suggestion
	}
	if data.DueDate != nil {
		item.DueDate = *data.DueDate
	}
	if data.RecheckPerson != nil {
		item.RecheckPerson = trim(data.RecheckPerson)
	}
	if data.RectifyPerson != nil {
		item.RectifyPerson = trim(data.RectifyPerson)
	}
	if data.Status != nil {
		item.Status = domain.HazardStatus.ToDB(*data.Status)
	}
	if data.Level != nil {
		item.Level = domain.HazardLevel.ToDB(*data.Level)
	}
	if data.Remark != nil {
		item.Remark = data.Remark
	}
	// 只有换单位时才重新快照责任人；之后单位换人不回写历史隐患。
	if data.HazardUnitID != nil && *data.HazardUnitID != item.HazardUnitID {
		unit, err := findUnit(s, *data.HazardUnitID)
		if err != nil {
			return schema.HazardRead{}, err
		}
		if unit == nil {
			return schema.HazardRead{}, apperr.NotFound("责任单位")
		}
		if pyStrip(unit.Person) == "" {
			return schema.HazardRead{}, unitPersonRequired(unit)
		}
		item.HazardUnitID = unit.ID
		item.Person = pyStrip(unit.Person)
	}
	if data.HazardTypeID != nil && *data.HazardTypeID != item.HazardTypeID {
		t, err := findType(s, *data.HazardTypeID)
		if err != nil {
			return schema.HazardRead{}, err
		}
		if t == nil {
			return schema.HazardRead{}, apperr.NotFound("隐患类型")
		}
		item.HazardTypeID = t.ID
	}
	if data.BeforeImageIDs != nil {
		fs, err := files(s, *data.BeforeImageIDs)
		if err != nil {
			return schema.HazardRead{}, err
		}
		if err := replaceImages(s, tableBefore, "hazard_id", item.ID, fs); err != nil {
			return schema.HazardRead{}, err
		}
	}
	if data.AfterImageIDs != nil {
		fs, err := files(s, *data.AfterImageIDs)
		if err != nil {
			return schema.HazardRead{}, err
		}
		if err := replaceImages(s, tableAfter, "hazard_id", item.ID, fs); err != nil {
			return schema.HazardRead{}, err
		}
	}
	item.Version++
	item.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return schema.HazardRead{}, err
	}
	w.Add("id = ?", item.ID)
	args := append([]any{item.InspectionArea, item.InspectionDate, item.Inspector, item.Description, item.Suggestion,
		item.HazardUnitID, item.Person, item.DueDate, item.RecheckPerson, item.RectifyPerson, item.Status, item.HazardTypeID,
		item.Level, item.Remark, item.Version, item.UpdatedAt}, w.Args...)
	if _, err := s.Exec("UPDATE hazard SET inspection_area = ?, inspection_date = ?, inspector = ?, description = ?, suggestion = ?, hazard_unit_id = ?, person = ?, due_date = ?, recheck_person = ?, rectify_person = ?, status = ?, hazard_type_id = ?, level = ?, remark = ?, version = ?, updated_at = ?"+w.SQL(), args...); err != nil {
		return schema.HazardRead{}, err
	}
	return HazardRead(s, item)
}

// DeleteHazard 物理删除隐患（图片关联行一并删除）。
func DeleteHazard(s *db.Session, id int64, expectedVersion *int64) error {
	item, err := GetHazard(s, id)
	if err != nil {
		return err
	}
	if err := apperr.ValidateVersion(expectedVersion, item.Version); err != nil {
		return err
	}
	for _, table := range []string{tableBefore, tableAfter} {
		w, err := scoped(s, "")
		if err != nil {
			return err
		}
		w.Add("hazard_id = ?", item.ID)
		if _, err := s.Exec("DELETE FROM "+table+w.SQL(), w.Args...); err != nil {
			return err
		}
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", item.ID)
	_, err = s.Exec("DELETE FROM hazard"+w.SQL(), w.Args...)
	return err
}

// HazardStats 工作台隐患概览。
func HazardStats(s *db.Session) (schema.HazardStatsRead, error) {
	w, err := scoped(s, "")
	if err != nil {
		return schema.HazardStatsRead{}, err
	}
	var rows []struct {
		Status string `db:"status"`
		N      int64  `db:"n"`
	}
	if err := s.Select(&rows, "SELECT status, COUNT(id) AS n FROM hazard"+w.SQL()+" GROUP BY status", w.Args...); err != nil {
		return schema.HazardStatsRead{}, err
	}
	counts := map[string]int64{}
	for _, r := range rows {
		counts[r.Status] = r.N
	}
	w.Add("due_date < ?", BusinessToday()).Add("status != ?", domain.HazardStatus.ToDB(domain.HazardStatusDone))
	var overdue int64
	if err := s.Get(&overdue, "SELECT COUNT(id) FROM hazard"+w.SQL(), w.Args...); err != nil {
		return schema.HazardStatsRead{}, err
	}
	return schema.HazardStatsRead{
		Pending: counts["PENDING"],
		Blocked: counts["BLOCKED"],
		Done:    counts["DONE"],
		Overdue: overdue,
	}, nil
}

func countHazardsBy(s *db.Session, col string, id int64) (int64, error) {
	w, err := scoped(s, "")
	if err != nil {
		return 0, err
	}
	w.Add(col+" = ?", id)
	var n int64
	err = s.Get(&n, "SELECT COUNT(id) FROM hazard"+w.SQL(), w.Args...)
	return n, err
}

// ===== 责任单位 =====

func listUnits(s *db.Session, keyword *string) ([]model.HazardUnit, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	if keyword != nil && *keyword != "" {
		c1, a1 := containsOne("name", *keyword)
		c2, a2 := containsOne("person", *keyword)
		w.Add("("+c1+" OR "+c2+")", a1, a2)
	}
	items := []model.HazardUnit{}
	err = s.Select(&items, "SELECT "+model.ColsHazardUnit+" FROM hazard_unit"+w.SQL()+" ORDER BY id", w.Args...)
	return items, err
}

// ListUnits 责任单位列表（按 id）；enabled 非 nil 时按启用状态过滤。
func ListUnits(s *db.Session, keyword *string, enabled *bool) ([]model.HazardUnit, error) {
	units, err := listUnits(s, trim(keyword))
	if err != nil {
		return nil, err
	}
	if enabled == nil {
		return units, nil
	}
	out := []model.HazardUnit{}
	for _, u := range units {
		if u.Enabled == *enabled {
			out = append(out, u)
		}
	}
	return out, nil
}

func findUnit(s *db.Session, id int64) (*model.HazardUnit, error) {
	return findUnitBy(s, "id = ?", id)
}

func findUnitBy(s *db.Session, cond string, arg any) (*model.HazardUnit, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add(cond, arg)
	var u model.HazardUnit
	ok, err := s.Find(&u, "SELECT "+model.ColsHazardUnit+" FROM hazard_unit"+w.SQL()+" LIMIT 1", w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &u, nil
}

// GetUnit 按 id 取责任单位，不存在报 NOT_FOUND。
func GetUnit(s *db.Session, id int64) (*model.HazardUnit, error) {
	u, err := findUnit(s, id)
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, apperr.NotFound("责任单位")
	}
	return u, nil
}

func duplicateUnit(name string) error {
	return apperr.New("DUPLICATE_HAZARD_UNIT", fmt.Sprintf("责任单位「%s」已存在", name))
}

func CreateUnit(s *db.Session, data schema.HazardUnitCreate) (*model.HazardUnit, error) {
	name := pyStrip(data.Name)
	existing, err := findUnitBy(s, "name = ?", name)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, duplicateUnit(name)
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	u := &model.HazardUnit{Name: name, Person: pyStrip(data.Person), Remark: trim(data.Remark), Enabled: data.Enabled,
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1}
	id, err := s.Insert("INSERT INTO hazard_unit (name, person, remark, enabled, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		u.Name, u.Person, u.Remark, u.Enabled, u.ProjectID, u.CreatedAt, u.UpdatedAt, u.Version)
	if err != nil {
		return nil, err
	}
	u.ID = id
	return u, nil
}

func UpdateUnit(s *db.Session, id int64, data schema.HazardUnitUpdate) (*model.HazardUnit, error) {
	u, err := GetUnit(s, id)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.Version, u.Version); err != nil {
		return nil, err
	}
	if data.Name != nil {
		name := pyStrip(*data.Name)
		existing, err := findUnitBy(s, "name = ?", name)
		if err != nil {
			return nil, err
		}
		if existing != nil && existing.ID != u.ID {
			return nil, duplicateUnit(name)
		}
		u.Name = name
	}
	if data.Person != nil {
		u.Person = pyStrip(*data.Person)
	}
	if data.Remark != nil {
		u.Remark = trim(data.Remark)
	}
	if data.Enabled != nil {
		u.Enabled = *data.Enabled
	}
	u.Version++
	u.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", u.ID)
	_, err = s.Exec("UPDATE hazard_unit SET name = ?, person = ?, remark = ?, enabled = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{u.Name, u.Person, u.Remark, u.Enabled, u.Version, u.UpdatedAt}, w.Args...)...)
	return u, err
}

func DeleteUnit(s *db.Session, id int64, expectedVersion *int64) error {
	u, err := GetUnit(s, id)
	if err != nil {
		return err
	}
	if err := apperr.ValidateVersion(expectedVersion, u.Version); err != nil {
		return err
	}
	n, err := countHazardsBy(s, "hazard_unit_id", u.ID)
	if err != nil {
		return err
	}
	if n > 0 {
		return apperr.New("HAZARD_UNIT_IN_USE", fmt.Sprintf("责任单位「%s」已被隐患记录引用，无法删除", u.Name)).WithStatus(409)
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", u.ID)
	_, err = s.Exec("DELETE FROM hazard_unit"+w.SQL(), w.Args...)
	return err
}

// ===== 隐患类型 =====

// ListTypes 隐患类型列表（按 大类 / 小类 / id 排序）。
func ListTypes(s *db.Session) ([]model.HazardType, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	items := []model.HazardType{}
	err = s.Select(&items, "SELECT "+model.ColsHazardType+" FROM hazard_type"+w.SQL()+" ORDER BY major, minor, id", w.Args...)
	return items, err
}

func findType(s *db.Session, id int64) (*model.HazardType, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var t model.HazardType
	ok, err := s.Find(&t, "SELECT "+model.ColsHazardType+" FROM hazard_type"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

func findTypeByPair(s *db.Session, major, minor string, excludeID *int64) (*model.HazardType, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("major = ?", major).Add("minor = ?", minor)
	if excludeID != nil {
		w.Add("id != ?", *excludeID)
	}
	var t model.HazardType
	ok, err := s.Find(&t, "SELECT "+model.ColsHazardType+" FROM hazard_type"+w.SQL()+" LIMIT 1", w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

// GetType 按 id 取隐患类型，不存在报 NOT_FOUND。
func GetType(s *db.Session, id int64) (*model.HazardType, error) {
	t, err := findType(s, id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, apperr.NotFound("隐患类型")
	}
	return t, nil
}

func CreateType(s *db.Session, data schema.HazardTypeCreate) (*model.HazardType, error) {
	major, minor := pyStrip(data.Major), pyStrip(data.Minor)
	existing, err := findTypeByPair(s, major, minor, nil)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, apperr.New("DUPLICATE_HAZARD_TYPE", fmt.Sprintf("隐患类型「%s / %s」已存在，无需重复新增", major, minor))
	}
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	t := &model.HazardType{Major: major, Minor: minor, ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1}
	id, err := s.Insert("INSERT INTO hazard_type (major, minor, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?)",
		t.Major, t.Minor, t.ProjectID, t.CreatedAt, t.UpdatedAt, t.Version)
	if err != nil {
		return nil, err
	}
	t.ID = id
	return t, nil
}

func UpdateType(s *db.Session, id int64, data schema.HazardTypeUpdate) (*model.HazardType, error) {
	t, err := GetType(s, id)
	if err != nil {
		return nil, err
	}
	if err := apperr.ValidateVersion(&data.Version, t.Version); err != nil {
		return nil, err
	}
	major, minor := t.Major, t.Minor
	if data.Major != nil {
		major = pyStrip(*data.Major)
	}
	if data.Minor != nil {
		minor = pyStrip(*data.Minor)
	}
	if major != t.Major || minor != t.Minor {
		existing, err := findTypeByPair(s, major, minor, &t.ID)
		if err != nil {
			return nil, err
		}
		if existing != nil {
			return nil, apperr.New("DUPLICATE_HAZARD_TYPE", fmt.Sprintf("隐患类型「%s / %s」与已有类型重复", major, minor))
		}
	}
	// 已被隐患引用的类型允许改名：隐患按 id 引用，不做级联校验。
	t.Major, t.Minor = major, minor
	t.Version++
	t.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", t.ID)
	_, err = s.Exec("UPDATE hazard_type SET major = ?, minor = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{t.Major, t.Minor, t.Version, t.UpdatedAt}, w.Args...)...)
	return t, err
}

func DeleteType(s *db.Session, id int64, expectedVersion *int64) error {
	t, err := GetType(s, id)
	if err != nil {
		return err
	}
	if err := apperr.ValidateVersion(expectedVersion, t.Version); err != nil {
		return err
	}
	n, err := countHazardsBy(s, "hazard_type_id", t.ID)
	if err != nil {
		return err
	}
	if n > 0 {
		return apperr.New("HAZARD_TYPE_IN_USE", fmt.Sprintf("隐患类型「%s / %s」已被隐患记录引用，只能修改，不能删除", t.Major, t.Minor)).WithStatus(409)
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", t.ID)
	_, err = s.Exec("DELETE FROM hazard_type"+w.SQL(), w.Args...)
	return err
}

// ===== 小程序端（也被网页端筛选下拉复用） =====

// HazardFilterOptions 隐患列表筛选项：库中已有的整改员工去重（两端筛选下拉共用）。
func HazardFilterOptions(s *db.Session) (schema.HazardFilterOptionsRead, error) {
	w, err := scoped(s, "")
	if err != nil {
		return schema.HazardFilterOptionsRead{}, err
	}
	w.Add("rectify_person IS NOT NULL").Add("TRIM(rectify_person) != ''")
	var rows []*string
	if err := s.Select(&rows, "SELECT TRIM(rectify_person) FROM hazard"+w.SQL()+" GROUP BY TRIM(rectify_person) ORDER BY TRIM(rectify_person)", w.Args...); err != nil {
		return schema.HazardFilterOptionsRead{}, err
	}
	out := []string{}
	for _, v := range rows {
		if v != nil && *v != "" {
			out = append(out, *v)
		}
	}
	return schema.HazardFilterOptionsRead{RectifyPersons: out}, nil
}

// HazardFormOptions 小程序登记隐患用的下拉数据：只列启用中的责任单位 + 全部隐患类型。
func HazardFormOptions(s *db.Session) (schema.HazardFormOptionsRead, error) {
	units, err := listUnits(s, nil)
	if err != nil {
		return schema.HazardFormOptionsRead{}, err
	}
	types, err := ListTypes(s)
	if err != nil {
		return schema.HazardFormOptionsRead{}, err
	}
	out := schema.HazardFormOptionsRead{Units: []schema.HazardUnitRead{}, Types: make([]schema.HazardTypeRead, len(types))}
	for i := range units {
		if units[i].Enabled {
			out.Units = append(out.Units, schema.NewHazardUnitRead(&units[i]))
		}
	}
	for i := range types {
		out.Types[i] = schema.NewHazardTypeRead(&types[i])
	}
	return out, nil
}

// MiniProgramCreateHazard 小程序登记隐患：检查人员缺省为当前小程序用户姓名，幂等键防重复登记。
func MiniProgramCreateHazard(s *db.Session, data schema.MiniProgramHazardCreate, user *model.MiniProgramUser) (schema.HazardRead, error) {
	crid := data.ClientRequestID
	return CreateHazard(s, data.Base(), &crid, user.DisplayName)
}

// MiniProgramUpdateHazard 小程序跟进隐患：只更新整改闭环相关字段，复用网页端同一套校验与乐观锁。
func MiniProgramUpdateHazard(s *db.Session, id int64, data schema.MiniProgramHazardUpdate) (schema.HazardRead, error) {
	return UpdateHazard(s, id, schema.HazardUpdate{
		Status:        data.Status,
		RectifyPerson: data.RectifyPerson,
		RecheckPerson: data.RecheckPerson,
		Remark:        data.Remark,
		AfterImageIDs: data.AfterImageIDs,
		Version:       data.Version,
	})
}
