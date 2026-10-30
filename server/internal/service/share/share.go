// Package share 对应原 services/share_link_service.py：匿名分享链接（把勾选的申购计划 / 申购记录分享为无鉴权页面）。
//
// 与导出文件的匿名下载同一信任模型：分享 token 为 UUIDv7（不可猜解），匿名读取端点（GET /shares/{token}）
// 不鉴权，仅凭 token 返回该分享的数据快照。过期行由 CleanupExpired 定期删除（启动时 + 每日 worker）。
package share

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/security"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/common"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/purchaserequest"
)

func init() {
	lifecycle.OnStartup(30, "purge expired share links", func(ctx context.Context) error {
		n, err := CleanupExpired(ctx)
		if err != nil {
			return err
		}
		if n > 0 {
			slog.Info(fmt.Sprintf("purged %d expired share links", n))
		}
		return nil
	})
	lifecycle.Worker("share-link-cleanup-worker", nil, RunCleanupWorker)
}

// expiryDeltas 失效选项 → 相对时长（0 = 永久）。
var expiryDeltas = map[string]time.Duration{
	domain.ShareExpiry24h:       24 * time.Hour,
	domain.ShareExpiry3d:        3 * 24 * time.Hour,
	domain.ShareExpiry7d:        7 * 24 * time.Hour,
	domain.ShareExpiry30d:       30 * 24 * time.Hour,
	domain.ShareExpiryPermanent: 0,
}

var shareTypeLabels = map[string]string{
	domain.SharePurchasePlan:   "申购计划",
	domain.SharePurchaseRecord: "申购记录",
}

func keySet(keys ...string) map[string]bool {
	out := make(map[string]bool, len(keys))
	for _, k := range keys {
		out[k] = true
	}
	return out
}

// 分享页可展示列（键名与前端 ShareView 表头一致）。
var (
	sharePlanKeys = keySet("plan_date", "material_code", "category", "urgency", "demand_department", "name", "model_spec",
		"planned_qty", "actual_demand_person", "purchase_responsible", "subitem_no", "usage", "status", "images")
	shareRecordKeys = keySet("plan_date", "purchase_order_no", "trace_no", "category", "demand_department", "material_name",
		"model_spec", "purchase_qty", "actual_demand_person", "purchase_responsible", "salesperson", "subitem_no", "usage",
		"status", "images")
)

func allowedKeys(shareType string) map[string]bool {
	if shareType == domain.SharePurchasePlan {
		return sharePlanKeys
	}
	return shareRecordKeys
}

// validateColumns 校验展示列：nil 表示全部；否则都必须是该类型合法键。
func validateColumns(shareType string, columns *[]string) error {
	if columns == nil {
		return nil
	}
	allowed := allowedKeys(shareType)
	invalid := []string{}
	for _, k := range *columns {
		if !allowed[k] {
			invalid = append(invalid, k)
		}
	}
	if len(invalid) > 0 {
		return apperr.New("VALIDATION_ERROR", fmt.Sprintf("包含不适用于%s的列: %s", shareTypeLabels[shareType], strings.Join(invalid, ", "))).WithStatus(422)
	}
	return nil
}

// resolvedColumns 把存储的列配置解析为最终展示键集合：nil = 默认集合（全部列去掉「状态」）。
func resolvedColumns(shareType string, columns []string) map[string]bool {
	if columns != nil {
		return keySet(columns...)
	}
	out := map[string]bool{}
	for k := range allowedKeys(shareType) {
		if k != "status" {
			out[k] = true
		}
	}
	return out
}

// expiresAtFor 把失效选项换算为失效时间（naive UTC）；permanent 返回 nil。
func expiresAtFor(expiresIn string) *time.Time {
	delta := expiryDeltas[expiresIn]
	if delta == 0 {
		return nil
	}
	t := common.UTCNow().Add(delta)
	return &t
}

// Link 是一条分享链接（ShareType 为接口值，Columns / ItemIDs 已解码）。
type Link struct {
	model.ShareLink
	Type    string
	ItemIDs []int64
	Cols    []string
}

func decode(row model.ShareLink) (*Link, error) {
	l := &Link{ShareLink: row, Type: domain.ShareType.FromDB(row.ShareType), ItemIDs: []int64{}}
	if err := row.ItemIds.Unmarshal(&l.ItemIDs); err != nil {
		return nil, err
	}
	if len(row.Columns) > 0 && string(row.Columns) != "null" {
		cols := []string{}
		if err := row.Columns.Unmarshal(&cols); err != nil {
			return nil, err
		}
		l.Cols = cols
	}
	return l, nil
}

// Read 组装 ShareRead。
func Read(l *Link) schema.ShareRead {
	return schema.ShareRead{
		Token: l.Token, ShareType: l.Type, ItemCount: int64(len(l.ItemIDs)), ExpiresAt: common.UTCPtr(l.ExpiresAt),
		CreatedAt: common.UTC(l.CreatedAt), Columns: l.Cols,
	}
}

func colsJSON(cols []string) (jtype.JSON, error) {
	if cols == nil {
		return nil, nil
	}
	return jtype.ToJSON(cols)
}

// CreateShare 对应 create_share：校验勾选项存在后落库。
func CreateShare(s *db.Session, shareType string, itemIDs []int64, expiresIn string, createdBy int64, columns *[]string) (*Link, error) {
	seen := map[int64]bool{}
	ids := []int64{}
	for _, id := range itemIDs {
		if !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	table := "purchase_request_line"
	if shareType == domain.SharePurchasePlan {
		table = "purchase_material"
	}
	var found []int64
	if err := s.SelectIn(&found, "SELECT id FROM "+table+" WHERE id IN (?) AND project_id = ?", ids, pid); err != nil {
		return nil, err
	}
	if len(found) != len(ids) {
		return nil, apperr.NotFound(shareTypeLabels[shareType])
	}
	if err := validateColumns(shareType, columns); err != nil {
		return nil, err
	}
	var cols []string
	if columns != nil {
		cols = append([]string{}, (*columns)...)
	}
	itemsJSON, err := jtype.ToJSON(ids)
	if err != nil {
		return nil, err
	}
	cj, err := colsJSON(cols)
	if err != nil {
		return nil, err
	}
	now := common.UTCNow()
	createdByID := createdBy
	row := model.ShareLink{
		Token: security.UUID7(), ShareType: domain.ShareType.ToDB(shareType), ItemIds: itemsJSON, Columns: cj,
		ExpiresAt: expiresAtFor(expiresIn), CreatedBy: &createdByID, CreatedAt: now, UpdatedAt: now, ProjectID: pid,
	}
	id, err := s.Insert("INSERT INTO share_link (token, share_type, item_ids, columns, expires_at, created_by, created_at, updated_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		row.Token, row.ShareType, row.ItemIds, row.Columns, row.ExpiresAt, row.CreatedBy, row.CreatedAt, row.UpdatedAt, row.ProjectID)
	if err != nil {
		return nil, err
	}
	row.ID = id
	return &Link{ShareLink: row, Type: shareType, ItemIDs: ids, Cols: cols}, nil
}

// GetPublicShare 对应 get_public_share：先在系统上下文按 token 定位分享行，再切到该分享的项目读取数据快照。
func GetPublicShare(s *db.Session, token string) (schema.SharePublicView, error) {
	var row model.ShareLink
	ok, err := s.System().Find(&row, "SELECT "+model.ColsShareLink+" FROM share_link WHERE token = ?", token)
	if err != nil {
		return schema.SharePublicView{}, err
	}
	if !ok {
		return schema.SharePublicView{}, apperr.New("SHARE_NOT_FOUND", "分享链接不存在或已失效").WithStatus(400)
	}
	if row.ExpiresAt != nil && row.ExpiresAt.Before(common.UTCNow()) {
		return schema.SharePublicView{}, apperr.New("SHARE_EXPIRED", "分享链接已失效，请联系分享人重新分享").WithStatus(400)
	}
	l, err := decode(row)
	if err != nil {
		return schema.SharePublicView{}, err
	}
	return buildPublicView(s.WithProject(row.ProjectID), l)
}

func indexOf(ids []int64, id int64) int {
	for i, v := range ids {
		if v == id {
			return i
		}
	}
	return len(ids)
}

func buildPublicView(s *db.Session, l *Link) (schema.SharePublicView, error) {
	var rows []any
	var identity string
	if l.Type == domain.SharePurchasePlan {
		identity = "id"
		items := []*material.Purchase{}
		if len(l.ItemIDs) > 0 {
			var pms []model.PurchaseMaterial
			if err := s.SelectIn(&pms, "SELECT "+model.ColsPurchaseMaterial+" FROM purchase_material WHERE id IN (?) AND project_id = ?", l.ItemIDs, l.ProjectID); err != nil {
				return schema.SharePublicView{}, err
			}
			for i := range pms {
				items = append(items, &material.Purchase{PurchaseMaterial: pms[i]})
			}
			if err := material.LoadPurchaseRelations(s, items); err != nil {
				return schema.SharePublicView{}, err
			}
		}
		sort.SliceStable(items, func(i, j int) bool { return indexOf(l.ItemIDs, items[i].ID) < indexOf(l.ItemIDs, items[j].ID) })
		reads, err := material.PurchaseReads(s, items)
		if err != nil {
			return schema.SharePublicView{}, err
		}
		for _, r := range reads {
			rows = append(rows, r)
		}
	} else {
		identity = "line_id"
		lines, err := purchaserequest.LinesByIDs(s, l.ItemIDs)
		if err != nil {
			return schema.SharePublicView{}, err
		}
		sort.SliceStable(lines, func(i, j int) bool { return indexOf(l.ItemIDs, lines[i].ID) < indexOf(l.ItemIDs, lines[j].ID) })
		for _, line := range lines {
			rows = append(rows, purchaserequest.PurchaseRecordRead(line))
		}
	}
	selected := resolvedColumns(l.Type, l.Cols)
	items := make([]any, 0, len(rows))
	for _, r := range rows {
		obj, err := filterFields(r, func(key string) bool { return selected[key] || key == identity || key == "unit_name" })
		if err != nil {
			return schema.SharePublicView{}, err
		}
		items = append(items, obj)
	}
	return schema.SharePublicView{
		ShareType: l.Type, ItemCount: int64(len(l.ItemIDs)), ExpiresAt: common.UTCPtr(l.ExpiresAt),
		CreatedAt: common.UTC(l.CreatedAt), Columns: l.Cols, Items: items,
	}, nil
}

// orderedObject 按结构体字段顺序输出的 JSON 对象（等价 model_dump(mode="json") 后按键过滤的 dict）。
type orderedObject struct {
	keys []string
	vals []json.RawMessage
}

func (o orderedObject) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, k := range o.keys {
		if i > 0 {
			b.WriteByte(',')
		}
		kb, _ := jtype.Marshal(k)
		b.Write(kb)
		b.WriteByte(':')
		b.Write(o.vals[i])
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

// filterFields 把读模型结构体按字段顺序序列化，只保留 keep(key) 为真的字段。
func filterFields(v any, keep func(string) bool) (orderedObject, error) {
	rv := reflect.ValueOf(v)
	rt := rv.Type()
	out := orderedObject{}
	for i := 0; i < rt.NumField(); i++ {
		f := rt.Field(i)
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "" || name == "-" || !keep(name) {
			continue
		}
		raw, err := jtype.Marshal(rv.Field(i).Interface())
		if err != nil {
			return out, err
		}
		out.keys = append(out.keys, name)
		out.vals = append(out.vals, raw)
	}
	return out, nil
}

func findShare(s *db.Session, token string) (*Link, error) {
	pid, err := s.ProjectID()
	if err != nil {
		return nil, err
	}
	var row model.ShareLink
	ok, err := s.Find(&row, "SELECT "+model.ColsShareLink+" FROM share_link WHERE token = ? AND project_id = ?", token, pid)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.NotFound("分享链接")
	}
	return decode(row)
}

func canManage(l *Link, user *model.User) bool {
	return (l.CreatedBy != nil && *l.CreatedBy == user.ID) || user.Role == domain.RoleSuperAdmin
}

// RevokeShare 对应 revoke_share：仅创建者本人或超级管理员可执行。
func RevokeShare(s *db.Session, token string, user *model.User) error {
	l, err := findShare(s, token)
	if err != nil {
		return err
	}
	if !canManage(l, user) {
		return apperr.New("FORBIDDEN", "只能撤回自己创建的分享链接").WithStatus(403)
	}
	_, err = s.Exec("DELETE FROM share_link WHERE id = ? AND project_id = ?", l.ID, l.ProjectID)
	return err
}

// ListShares 对应 list_shares：普通用户只看自己创建的，超管看全部；按创建时间倒序。
func ListShares(s *db.Session, user *model.User, page, pageSize int64) ([]schema.ShareListRead, int64, error) {
	w := common.Where{}
	if err := w.Scope(s, "s."); err != nil {
		return nil, 0, err
	}
	if user.Role != domain.RoleSuperAdmin {
		w.Add("s.created_by = ?", user.ID)
	}
	var total int64
	if err := s.Get(&total, "SELECT COUNT(s.id) FROM share_link s"+w.SQL(), w.Args...); err != nil {
		return nil, 0, err
	}
	type row struct {
		model.ShareLink
		CreatorName *string `db:"creator_display_name"`
	}
	var rows []row
	args := append(append([]any{}, w.Args...), pageSize, common.Offset(page, pageSize))
	if err := s.Select(&rows, "SELECT "+model.Prefixed("s", model.ColsShareLink)+", u.display_name AS creator_display_name FROM share_link s LEFT JOIN \"user\" u ON u.id = s.created_by"+
		w.SQL()+" ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?", args...); err != nil {
		return nil, 0, err
	}
	out := make([]schema.ShareListRead, 0, len(rows))
	for _, r := range rows {
		l, err := decode(r.ShareLink)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, schema.ShareListRead{
			Token: l.Token, ShareType: l.Type, ItemCount: int64(len(l.ItemIDs)), ExpiresAt: common.UTCPtr(l.ExpiresAt),
			CreatedAt: common.UTC(l.CreatedAt), CreatedBy: l.CreatedBy, CreatedByName: r.CreatorName, Columns: l.Cols,
		})
	}
	return out, total, nil
}

func sameColumns(a, b []string) bool {
	if (a == nil) != (b == nil) || len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// UpdateShare 对应 update_share：展示列与到期时间；nil 表示对应项不修改。
func UpdateShare(s *db.Session, token string, user *model.User, columns *[]string, expiresIn *string) (*Link, error) {
	l, err := findShare(s, token)
	if err != nil {
		return nil, err
	}
	if !canManage(l, user) {
		return nil, apperr.New("FORBIDDEN", "只能修改自己创建的分享链接").WithStatus(403)
	}
	changed := false
	if columns != nil {
		if err := validateColumns(l.Type, columns); err != nil {
			return nil, err
		}
		cols := append([]string{}, (*columns)...)
		if !sameColumns(cols, l.Cols) {
			l.Cols = cols
			changed = true
		}
	}
	if expiresIn != nil {
		l.ExpiresAt = expiresAtFor(*expiresIn)
		changed = true
	}
	if changed {
		cj, err := colsJSON(l.Cols)
		if err != nil {
			return nil, err
		}
		l.UpdatedAt = common.UTCNow()
		if _, err := s.Exec("UPDATE share_link SET columns = ?, expires_at = ?, updated_at = ? WHERE id = ? AND project_id = ?",
			cj, l.ExpiresAt, l.UpdatedAt, l.ID, l.ProjectID); err != nil {
			return nil, err
		}
	}
	return l, nil
}

// CleanupExpired 对应 cleanup_expired：删除已过期的分享行（跨项目），返回删除数。
func CleanupExpired(ctx context.Context) (int, error) {
	now := common.UTCNow()
	s := db.SystemSession(ctx)
	defer s.Close()
	res, err := s.Exec("DELETE FROM share_link WHERE expires_at < ?", now)
	if err != nil {
		return 0, err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return 0, err
	}
	if err := s.Commit(); err != nil {
		return 0, err
	}
	return int(n), nil
}

// RunCleanupWorker 每日过期分享清理循环。
func RunCleanupWorker(ctx context.Context) {
	for {
		func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error(fmt.Sprintf("share link cleanup worker crashed: %v", r))
				}
			}()
			purged, err := CleanupExpired(ctx)
			if err != nil {
				slog.Error(fmt.Sprintf("share link cleanup worker crashed: %v", err))
				return
			}
			if purged > 0 {
				slog.Info(fmt.Sprintf("purged %d expired share links", purged))
			}
		}()
		select {
		case <-ctx.Done():
			return
		case <-time.After(24 * time.Hour):
		}
	}
}
