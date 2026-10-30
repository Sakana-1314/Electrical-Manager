// Package ledger 对应原 services/ledger_service.py + repositories/ledger_repository.py：
// 台账总览（台账记录）+ 分层标签。
//
// 规则要点：
//   - 标签是自引用邻接表，至多 3 层；可以改上级（含移为一级），超层或成环拒绝（400）；
//   - 同一父节点下不允许同名标签，重名 409；
//   - 标签还有子节点、或（连同子孙）已被台账记录引用时不允许删除（409），删除是物理删除；
//   - 标签节点的 item_count 是**直接**引用该标签的台账记录数；
//   - 台账记录的 tag_ids 落库前规范化为「去重 + 升序 + 英文逗号分隔」，读出还原成 id 列表并附名称与路径；
//   - 按标签筛选命中「选中标签及其全部子孙标签」的记录。
package ledger

import (
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
)

// MaxTagLevel 标签最多 3 层：根节点为第 1 层。
const MaxTagLevel = 3

const (
	tableTagImage  = "ledger_tag_image"
	tableItemImage = "ledger_image"
)

var (
	keywordColumns    = []string{"name", "model_spec", "remark"}
	tagKeywordColumns = []string{"name", "remark"}
)

func pyStrip(s string) string { return strings.TrimFunc(s, common.PyIsSpace) }

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

// parseDigitInt 对应 `part.strip().isdigit()` + `int(part)`（超出 int64 时取一个不会命中的大值）。
func parseDigitInt(part string) (int64, bool) {
	t := pyStrip(part)
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

// ParseTagIDs 把 ledger.tag_ids 的逗号分隔 id 串解析成去重升序的正整数列表。
func ParseTagIDs(value string) []int64 {
	if value == "" {
		return []int64{}
	}
	set := map[int64]bool{}
	for _, part := range strings.Split(value, ",") {
		if n, ok := parseDigitInt(part); ok && n > 0 {
			set[n] = true
		}
	}
	return sortedKeys(set)
}

// FormatTagIDs 规范化写入：去重、升序、英文逗号分隔；空集合写空串。
func FormatTagIDs(tagIDs []int64) string {
	set := map[int64]bool{}
	for _, id := range tagIDs {
		if id > 0 {
			set[id] = true
		}
	}
	keys := sortedKeys(set)
	parts := make([]string, len(keys))
	for i, id := range keys {
		parts[i] = strconv.FormatInt(id, 10)
	}
	return strings.Join(parts, ",")
}

func sortedKeys(set map[int64]bool) []int64 {
	out := make([]int64, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// ===== 查询 =====

func listTags(s *db.Session, keyword *string) ([]model.LedgerTag, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.ContainsAny(tagKeywordColumns, keyword)
	items := []model.LedgerTag{}
	err = s.Select(&items, "SELECT "+model.ColsLedgerTag+" FROM ledger_tag"+w.SQL()+" ORDER BY id", w.Args...)
	return items, err
}

func getTag(s *db.Session, id int64) (*model.LedgerTag, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var t model.LedgerTag
	ok, err := s.Find(&t, "SELECT "+model.ColsLedgerTag+" FROM ledger_tag"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

func findTagBySibling(s *db.Session, parentID *int64, name string, excludeID *int64) (*model.LedgerTag, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("name = ?", name)
	if parentID == nil {
		w.Add("parent_id IS NULL")
	} else {
		w.Add("parent_id = ?", *parentID)
	}
	if excludeID != nil {
		w.Add("id != ?", *excludeID)
	}
	var t model.LedgerTag
	ok, err := s.Find(&t, "SELECT "+model.ColsLedgerTag+" FROM ledger_tag"+w.SQL()+" LIMIT 1", w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &t, nil
}

func countChildren(s *db.Session, tagID int64) (int64, error) {
	w, err := scoped(s, "")
	if err != nil {
		return 0, err
	}
	w.Add("parent_id = ?", tagID)
	var n int64
	err = s.Get(&n, "SELECT COUNT(id) FROM ledger_tag"+w.SQL(), w.Args...)
	return n, err
}

// tagIDMatch：ledger.tag_ids 是否包含某个标签 id（`1,12` 不会被 `1` 误命中）。
func tagIDMatch(tagID int64) (string, any) {
	return "CONCAT(',', tag_ids, ',') LIKE ?", "%," + strconv.FormatInt(tagID, 10) + ",%"
}

func listItemTagIDs(s *db.Session) ([]string, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("tag_ids != ''")
	var out []string
	err = s.Select(&out, "SELECT tag_ids FROM ledger"+w.SQL(), w.Args...)
	return out, err
}

func filterUsedTagIDs(s *db.Session, tagIDs []int64) (map[int64]bool, error) {
	used := map[int64]bool{}
	for _, id := range tagIDs {
		w, err := scoped(s, "")
		if err != nil {
			return nil, err
		}
		cond, arg := tagIDMatch(id)
		w.Add(cond, arg)
		var found int64
		ok, err := s.Find(&found, "SELECT id FROM ledger"+w.SQL()+" LIMIT 1", w.Args...)
		if err != nil {
			return nil, err
		}
		if ok {
			used[id] = true
		}
	}
	return used, nil
}

// ===== 层级计算（纯逻辑） =====

type tagMap map[int64]*model.LedgerTag

func toMap(tags []model.LedgerTag) tagMap {
	m := make(tagMap, len(tags))
	for i := range tags {
		m[tags[i].ID] = &tags[i]
	}
	return m
}

func childCounts(tags []model.LedgerTag) map[int64]int64 {
	out := map[int64]int64{}
	for _, t := range tags {
		if t.ParentID != nil {
			out[*t.ParentID]++
		}
	}
	return out
}

func childrenMap(tags []model.LedgerTag) map[int64][]int64 {
	out := map[int64][]int64{}
	for _, t := range tags {
		if t.ParentID != nil {
			out[*t.ParentID] = append(out[*t.ParentID], t.ID)
		}
	}
	return out
}

// subtreeIDs 根节点及其全部子孙。
func subtreeIDs(children map[int64][]int64, rootID int64) []int64 {
	var collected []int64
	stack := []int64{rootID}
	for len(stack) > 0 {
		cur := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		collected = append(collected, cur)
		stack = append(stack, children[cur]...)
	}
	return collected
}

// tagLevel 节点层级（从 1 起）：沿 parent_id 往上数；父节点缺失或成环时按当前结果封顶。
func tagLevel(byID tagMap, tag *model.LedgerTag) int64 {
	level := int64(1)
	cur := tag
	visited := map[int64]bool{tag.ID: true}
	for cur.ParentID != nil {
		parent := byID[*cur.ParentID]
		if parent == nil || visited[parent.ID] {
			break
		}
		visited[parent.ID] = true
		cur = parent
		level++
	}
	return level
}

// TagPath 完整层级路径，如「配电柜 / 低压柜 / 抽屉柜」。
func TagPath(byID map[int64]*model.LedgerTag, tag *model.LedgerTag) string {
	names := []string{tag.Name}
	cur := tag
	visited := map[int64]bool{tag.ID: true}
	for cur.ParentID != nil {
		parent := byID[*cur.ParentID]
		if parent == nil || visited[parent.ID] {
			break
		}
		visited[parent.ID] = true
		names = append(names, parent.Name)
		cur = parent
	}
	for i, j := 0, len(names)-1; i < j; i, j = i+1, j-1 {
		names[i], names[j] = names[j], names[i]
	}
	return strings.Join(names, " / ")
}

func isInSubtree(byID tagMap, node *model.LedgerTag, rootID int64) bool {
	cur := node
	visited := map[int64]bool{}
	for cur != nil && !visited[cur.ID] {
		if cur.ID == rootID {
			return true
		}
		visited[cur.ID] = true
		if cur.ParentID == nil {
			cur = nil
		} else {
			cur = byID[*cur.ParentID]
		}
	}
	return false
}

func deepestDepth(byID tagMap, children map[int64][]int64, tag *model.LedgerTag) int64 {
	deepest := tagLevel(byID, tag)
	visited := map[int64]bool{tag.ID: true}
	stack := subtreeIDs(children, tag.ID)
	for len(stack) > 0 {
		id := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if visited[id] {
			continue
		}
		visited[id] = true
		cur := byID[id]
		if cur == nil {
			continue
		}
		if l := tagLevel(byID, cur); l > deepest {
			deepest = l
		}
	}
	return deepest
}

func containsID(items []int64, id int64) bool {
	for _, v := range items {
		if v == id {
			return true
		}
	}
	return false
}

func maxLevelErr(msg string) error { return apperr.New("LEDGER_TAG_MAX_LEVEL", msg) }

func validatedNewParent(byID tagMap, children map[int64][]int64, tag *model.LedgerTag, parentID int64) (*model.LedgerTag, error) {
	if parentID == tag.ID || containsID(subtreeIDs(children, parentID), tag.ID) {
		return nil, maxLevelErr(fmt.Sprintf("标签最多 %d 层，不能把「%s」移到它自己或其子孙标签下", MaxTagLevel, tag.Name))
	}
	parent := byID[parentID]
	if parent == nil {
		return nil, apperr.NotFound("上级标签")
	}
	shift := tagLevel(byID, parent) + 1 - tagLevel(byID, tag)
	if deepestDepth(byID, children, tag)+shift > MaxTagLevel {
		return nil, maxLevelErr(fmt.Sprintf("标签最多 %d 层，移到该上级后「%s」及其子标签会超过 %d 层", MaxTagLevel, tag.Name, MaxTagLevel))
	}
	return parent, nil
}

// ===== 读模型 =====

func itemCounts(s *db.Session) (map[int64]int64, error) {
	rows, err := listItemTagIDs(s)
	if err != nil {
		return nil, err
	}
	out := map[int64]int64{}
	for _, r := range rows {
		for _, id := range ParseTagIDs(r) {
			out[id]++
		}
	}
	return out, nil
}

func tagReads(s *db.Session, tags []*model.LedgerTag, byID tagMap, cc, ic map[int64]int64) ([]schema.LedgerTagRead, error) {
	ids := make([]int64, len(tags))
	for i, t := range tags {
		ids[i] = t.ID
	}
	images, err := loadImages(s, tableTagImage, "tag_id", ids)
	if err != nil {
		return nil, err
	}
	out := make([]schema.LedgerTagRead, len(tags))
	for i, t := range tags {
		out[i] = schema.LedgerTagRead{
			ID: t.ID, ParentID: t.ParentID, Name: t.Name, Remark: t.Remark,
			Level: tagLevel(byID, t), ChildCount: cc[t.ID], ItemCount: ic[t.ID],
			Images: nonNil(images[t.ID]), CreatedAt: common.UTC(t.CreatedAt), UpdatedAt: common.UTC(t.UpdatedAt), Version: t.Version,
		}
	}
	return out, nil
}

func itemReads(s *db.Session, items []model.Ledger, byID tagMap) ([]schema.LedgerItemRead, error) {
	ids := make([]int64, len(items))
	for i := range items {
		ids[i] = items[i].ID
	}
	images, err := loadImages(s, tableItemImage, "ledger_id", ids)
	if err != nil {
		return nil, err
	}
	out := make([]schema.LedgerItemRead, len(items))
	for i := range items {
		it := &items[i]
		refs := []schema.LedgerTagRefRead{}
		tagIDs := []int64{}
		for _, id := range ParseTagIDs(it.TagIds) {
			t := byID[id]
			if t == nil {
				// 防御：标签被手工删除后残留的 id 直接跳过。
				continue
			}
			refs = append(refs, schema.LedgerTagRefRead{ID: t.ID, Name: t.Name, Path: TagPath(byID, t)})
			tagIDs = append(tagIDs, t.ID)
		}
		out[i] = schema.LedgerItemRead{
			ID: it.ID, Name: it.Name, ModelSpec: it.ModelSpec, SubitemNo: it.SubitemNo, Quantity: it.Quantity,
			UnitName: it.UnitName, Usage: it.Usage, Remark: it.Remark, TagIDs: tagIDs, Tags: refs,
			Images: nonNil(images[it.ID]), CreatedAt: common.UTC(it.CreatedAt), UpdatedAt: common.UTC(it.UpdatedAt), Version: it.Version,
		}
	}
	return out, nil
}

// ===== 标签 =====

// ListTags 标签列表（平铺）。scope="orphan" 只留孤立标签；scope="tree" 只留处在层级里的节点。
func ListTags(s *db.Session, keyword *string, scope *string) ([]schema.LedgerTagRead, error) {
	tags, err := listTags(s, trim(keyword))
	if err != nil {
		return nil, err
	}
	byID := toMap(tags)
	cc := childCounts(tags)
	ic, err := itemCounts(s)
	if err != nil {
		return nil, err
	}
	ptrs := make([]*model.LedgerTag, len(tags))
	for i := range tags {
		ptrs[i] = &tags[i]
	}
	rows, err := tagReads(s, ptrs, byID, cc, ic)
	if err != nil {
		return nil, err
	}
	if scope == nil {
		return rows, nil
	}
	out := []schema.LedgerTagRead{}
	for _, r := range rows {
		switch *scope {
		case "orphan":
			if r.ParentID == nil && r.ChildCount == 0 {
				out = append(out, r)
			}
		case "tree":
			if r.ParentID != nil || r.ChildCount > 0 {
				out = append(out, r)
			}
		default:
			out = append(out, r)
		}
	}
	return out, nil
}

// GetTagRead 单个标签读模型，不存在报 NOT_FOUND「标签不存在」。
func GetTagRead(s *db.Session, tagID int64) (schema.LedgerTagRead, error) {
	tags, err := listTags(s, nil)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	byID := toMap(tags)
	tag := byID[tagID]
	if tag == nil {
		return schema.LedgerTagRead{}, apperr.NotFound("标签")
	}
	ic, err := itemCounts(s)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	rows, err := tagReads(s, []*model.LedgerTag{tag}, byID, childCounts(tags), ic)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	return rows[0], nil
}

func duplicateTag(name string) error {
	return apperr.New("DUPLICATE_LEDGER_TAG", fmt.Sprintf("同一层级下已有标签「%s」", name))
}

func CreateTag(s *db.Session, data schema.LedgerTagCreate) (schema.LedgerTagRead, error) {
	tags, err := listTags(s, nil)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	byID := toMap(tags)
	if data.ParentID != nil {
		parent := byID[*data.ParentID]
		if parent == nil {
			return schema.LedgerTagRead{}, apperr.NotFound("上级标签")
		}
		if tagLevel(byID, parent) >= MaxTagLevel {
			return schema.LedgerTagRead{}, maxLevelErr(fmt.Sprintf("标签最多 %d 层，不能再往下新增子标签", MaxTagLevel))
		}
	}
	existing, err := findTagBySibling(s, data.ParentID, data.Name, nil)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	if existing != nil {
		return schema.LedgerTagRead{}, duplicateTag(data.Name)
	}
	fs, err := files(s, data.ImageIDs)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	now := common.UTCNow()
	id, err := s.Insert("INSERT INTO ledger_tag (parent_id, name, remark, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?)",
		data.ParentID, data.Name, trim(data.Remark), pid, now, now, 1)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	if err := insertImages(s, tableTagImage, "tag_id", id, fs); err != nil {
		return schema.LedgerTagRead{}, err
	}
	return GetTagRead(s, id)
}

func ensureSiblingNameFree(s *db.Session, parentID *int64, name string, excludeID int64) error {
	existing, err := findTagBySibling(s, parentID, name, &excludeID)
	if err != nil {
		return err
	}
	if existing != nil {
		return duplicateTag(name)
	}
	return nil
}

func equalPtr(a, b *int64) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

func UpdateTag(s *db.Session, tagID int64, data schema.LedgerTagUpdate) (schema.LedgerTagRead, error) {
	tag, err := getTag(s, tagID)
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	if tag == nil {
		return schema.LedgerTagRead{}, apperr.NotFound("标签")
	}
	if err := apperr.ValidateVersion(&data.Version, tag.Version); err != nil {
		return schema.LedgerTagRead{}, err
	}
	// parent_id 只在请求里出现时才处理：传 null = 移为一级，不传 = 不改上级。
	reqParent := data.ParentID.Ptr()
	reparent := data.ParentID.Set && !equalPtr(reqParent, tag.ParentID)
	newParentID := tag.ParentID
	if reparent {
		newParentID = reqParent
		tags, err := listTags(s, nil)
		if err != nil {
			return schema.LedgerTagRead{}, err
		}
		if newParentID != nil {
			if _, err := validatedNewParent(toMap(tags), childrenMap(tags), tag, *newParentID); err != nil {
				return schema.LedgerTagRead{}, err
			}
		}
	}
	nameChanged := data.Name != nil && *data.Name != tag.Name
	if reparent || nameChanged {
		name := tag.Name
		if data.Name != nil && *data.Name != "" {
			name = *data.Name
		}
		if err := ensureSiblingNameFree(s, newParentID, name, tag.ID); err != nil {
			return schema.LedgerTagRead{}, err
		}
	}
	if nameChanged {
		tag.Name = *data.Name
	}
	if reparent {
		tag.ParentID = newParentID
	}
	if data.Remark != nil {
		tag.Remark = trim(data.Remark)
	}
	if data.ImageIDs != nil {
		fs, err := files(s, *data.ImageIDs)
		if err != nil {
			return schema.LedgerTagRead{}, err
		}
		if err := replaceImages(s, tableTagImage, "tag_id", tag.ID, fs); err != nil {
			return schema.LedgerTagRead{}, err
		}
	}
	tag.Version++
	tag.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return schema.LedgerTagRead{}, err
	}
	w.Add("id = ?", tag.ID)
	if _, err := s.Exec("UPDATE ledger_tag SET parent_id = ?, name = ?, remark = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{tag.ParentID, tag.Name, tag.Remark, tag.Version, tag.UpdatedAt}, w.Args...)...); err != nil {
		return schema.LedgerTagRead{}, err
	}
	return GetTagRead(s, tagID)
}

func DeleteTag(s *db.Session, tagID int64, expectedVersion *int64) error {
	tags, err := listTags(s, nil)
	if err != nil {
		return err
	}
	byID := toMap(tags)
	tag := byID[tagID]
	if tag == nil {
		return apperr.NotFound("标签")
	}
	if err := apperr.ValidateVersion(expectedVersion, tag.Version); err != nil {
		return err
	}
	n, err := countChildren(s, tag.ID)
	if err != nil {
		return err
	}
	if n > 0 {
		return apperr.New("LEDGER_TAG_HAS_CHILDREN", fmt.Sprintf("标签「%s」下还有子标签，请先删除子标签", tag.Name)).WithStatus(409)
	}
	// 子孙一并检查：删除父节点会带走整棵子树，子树里有任何一个被引用都不允许删。
	var subtree []int64
	for i := range tags {
		if isInSubtree(byID, &tags[i], tag.ID) {
			subtree = append(subtree, tags[i].ID)
		}
	}
	used, err := filterUsedTagIDs(s, subtree)
	if err != nil {
		return err
	}
	if len(used) > 0 {
		names := []string{}
		for _, id := range sortedKeys(used) {
			names = append(names, byID[id].Name)
		}
		return apperr.New("LEDGER_TAG_IN_USE", fmt.Sprintf("标签「%s」已被台账记录引用（%s），请先解除引用", tag.Name, strings.Join(names, "、"))).WithStatus(409)
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("tag_id = ?", tag.ID)
	if _, err := s.Exec("DELETE FROM "+tableTagImage+w.SQL(), w.Args...); err != nil {
		return err
	}
	w, err = scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", tag.ID)
	_, err = s.Exec("DELETE FROM ledger_tag"+w.SQL(), w.Args...)
	return err
}

// ===== 台账记录 =====

// ListItems 台账列表：tagIDs 是英文逗号分隔的标签 id 串，命中任一（含其子孙）即返回；按创建时间倒序分页。
func ListItems(s *db.Session, keyword, tagIDs *string, page, pageSize int64) ([]schema.LedgerItemRead, int64, error) {
	tags, err := listTags(s, nil)
	if err != nil {
		return nil, 0, err
	}
	byID := toMap(tags)
	selected := []int64{}
	if tagIDs != nil {
		selected = ParseTagIDs(*tagIDs)
	}
	matched := map[int64]bool{}
	if len(selected) > 0 {
		children := childrenMap(tags)
		for _, id := range selected {
			if byID[id] != nil {
				for _, sub := range subtreeIDs(children, id) {
					matched[sub] = true
				}
			}
		}
		if len(matched) == 0 {
			// 选中的标签都不存在（例如手改 URL）：明确返回空结果，不当作「不限」。
			return []schema.LedgerItemRead{}, 0, nil
		}
	}
	w, err := scoped(s, "")
	if err != nil {
		return nil, 0, err
	}
	w.ContainsAny(keywordColumns, trim(keyword))
	if len(matched) > 0 {
		var parts []string
		var args []any
		for _, id := range sortedKeys(matched) {
			cond, arg := tagIDMatch(id)
			parts = append(parts, cond)
			args = append(args, arg)
		}
		w.Add("("+strings.Join(parts, " OR ")+")", args...)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(id) FROM ledger"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	var items []model.Ledger
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&items, "SELECT "+model.ColsLedger+" FROM ledger"+w.SQL()+" ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	reads, err := itemReads(s, items, byID)
	if err != nil {
		return nil, 0, err
	}
	return reads, total, nil
}

func getItem(s *db.Session, id int64) (*model.Ledger, error) {
	w, err := scoped(s, "")
	if err != nil {
		return nil, err
	}
	w.Add("id = ?", id)
	var it model.Ledger
	ok, err := s.Find(&it, "SELECT "+model.ColsLedger+" FROM ledger"+w.SQL(), w.Args...)
	if err != nil || !ok {
		return nil, err
	}
	return &it, nil
}

func tagMapAll(s *db.Session) (tagMap, error) {
	tags, err := listTags(s, nil)
	if err != nil {
		return nil, err
	}
	return toMap(tags), nil
}

func itemRead(s *db.Session, it *model.Ledger) (schema.LedgerItemRead, error) {
	byID, err := tagMapAll(s)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	rows, err := itemReads(s, []model.Ledger{*it}, byID)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	return rows[0], nil
}

// GetItemRead 台账详情读模型，不存在报 NOT_FOUND「台账记录不存在」。
func GetItemRead(s *db.Session, itemID int64) (schema.LedgerItemRead, error) {
	it, err := getItem(s, itemID)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	if it == nil {
		return schema.LedgerItemRead{}, apperr.NotFound("台账记录")
	}
	return itemRead(s, it)
}

// validatedTagIDs 校验标签 id 全部存在，返回去重升序的规范化列表。
func validatedTagIDs(byID tagMap, tagIDs []int64) ([]int64, error) {
	missing := map[int64]bool{}
	set := map[int64]bool{}
	for _, id := range tagIDs {
		set[id] = true
		if byID[id] == nil {
			missing[id] = true
		}
	}
	if len(missing) > 0 {
		return nil, apperr.New("INVALID_TAG_ID", "标签不存在").WithDetails(apperr.D{"tag_ids": sortedKeys(missing)})
	}
	return sortedKeys(set), nil
}

func CreateItem(s *db.Session, data schema.LedgerItemCreate) (schema.LedgerItemRead, error) {
	byID, err := tagMapAll(s)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	tagIDs, err := validatedTagIDs(byID, data.TagIDs)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	fs, err := files(s, data.ImageIDs)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	pid, err := s.ProjectID()
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	now := common.UTCNow()
	it := model.Ledger{
		Name: data.Name, ModelSpec: data.ModelSpec, SubitemNo: trim(data.SubitemNo), Quantity: data.Quantity,
		UnitName: data.UnitName, Usage: data.Usage, Remark: trim(data.Remark), TagIds: FormatTagIDs(tagIDs),
		ProjectID: pid, CreatedAt: now, UpdatedAt: now, Version: 1,
	}
	id, err := s.Insert("INSERT INTO ledger (name, model_spec, subitem_no, quantity, unit_name, `usage`, remark, tag_ids, project_id, created_at, updated_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		it.Name, it.ModelSpec, it.SubitemNo, it.Quantity, it.UnitName, it.Usage, it.Remark, it.TagIds, it.ProjectID, it.CreatedAt, it.UpdatedAt, it.Version)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	it.ID = id
	if err := insertImages(s, tableItemImage, "ledger_id", id, fs); err != nil {
		return schema.LedgerItemRead{}, err
	}
	rows, err := itemReads(s, []model.Ledger{it}, byID)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	return rows[0], nil
}

func UpdateItem(s *db.Session, itemID int64, data schema.LedgerItemUpdate) (schema.LedgerItemRead, error) {
	it, err := getItem(s, itemID)
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	if it == nil {
		return schema.LedgerItemRead{}, apperr.NotFound("台账记录")
	}
	if err := apperr.ValidateVersion(&data.Version, it.Version); err != nil {
		return schema.LedgerItemRead{}, err
	}
	if data.Name != nil {
		it.Name = *data.Name
	}
	if data.ModelSpec != nil {
		it.ModelSpec = *data.ModelSpec
	}
	if data.SubitemNo != nil {
		it.SubitemNo = trim(data.SubitemNo)
	}
	if data.Quantity != nil {
		it.Quantity = *data.Quantity
	}
	if data.UnitName != nil {
		it.UnitName = *data.UnitName
	}
	if data.Usage != nil {
		it.Usage = *data.Usage
	}
	if data.Remark != nil {
		it.Remark = trim(data.Remark)
	}
	if data.TagIDs != nil {
		byID, err := tagMapAll(s)
		if err != nil {
			return schema.LedgerItemRead{}, err
		}
		ids, err := validatedTagIDs(byID, *data.TagIDs)
		if err != nil {
			return schema.LedgerItemRead{}, err
		}
		it.TagIds = FormatTagIDs(ids)
	}
	if data.ImageIDs != nil {
		fs, err := files(s, *data.ImageIDs)
		if err != nil {
			return schema.LedgerItemRead{}, err
		}
		if err := replaceImages(s, tableItemImage, "ledger_id", it.ID, fs); err != nil {
			return schema.LedgerItemRead{}, err
		}
	}
	it.Version++
	it.UpdatedAt = common.UTCNow()
	w, err := scoped(s, "")
	if err != nil {
		return schema.LedgerItemRead{}, err
	}
	w.Add("id = ?", it.ID)
	if _, err := s.Exec("UPDATE ledger SET name = ?, model_spec = ?, subitem_no = ?, quantity = ?, unit_name = ?, `usage` = ?, remark = ?, tag_ids = ?, version = ?, updated_at = ?"+w.SQL(),
		append([]any{it.Name, it.ModelSpec, it.SubitemNo, it.Quantity, it.UnitName, it.Usage, it.Remark, it.TagIds, it.Version, it.UpdatedAt}, w.Args...)...); err != nil {
		return schema.LedgerItemRead{}, err
	}
	return itemRead(s, it)
}

func DeleteItem(s *db.Session, itemID int64, expectedVersion *int64) error {
	it, err := getItem(s, itemID)
	if err != nil {
		return err
	}
	if it == nil {
		return apperr.NotFound("台账记录")
	}
	if err := apperr.ValidateVersion(expectedVersion, it.Version); err != nil {
		return err
	}
	w, err := scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("ledger_id = ?", it.ID)
	if _, err := s.Exec("DELETE FROM "+tableItemImage+w.SQL(), w.Args...); err != nil {
		return err
	}
	w, err = scoped(s, "")
	if err != nil {
		return err
	}
	w.Add("id = ?", it.ID)
	_, err = s.Exec("DELETE FROM ledger"+w.SQL(), w.Args...)
	return err
}
