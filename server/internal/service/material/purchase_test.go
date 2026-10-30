package material

// 对应 server/tests/unit/test_material_service.py（Python 版 monkeypatch next_purchase_plan_no 模拟并发撞号）。
//
// 需要一个已按 init.sql 建好表的 PostgreSQL 库：默认连 tools/run_contract_tests.sh 用过的 em_go_test，
// 可用 GO_TEST_DATABASE_URL 覆盖；连不上时跳过。

import (
	"context"
	"os"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/db"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/schema"
)

const testProjectID = 1

func openTestDB(t *testing.T) {
	t.Helper()
	dsn := os.Getenv("GO_TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://postgres@127.0.0.1:5432/em_go_test?sslmode=disable&timezone=UTC"
	}
	conn, err := db.Open(dsn)
	if err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	if err := conn.Ping(); err != nil {
		t.Skipf("database unavailable: %v", err)
	}
	var n int
	if err := conn.Get(&n, db.Translate("SELECT COUNT(*) FROM project WHERE id = ?"), testProjectID); err != nil {
		t.Skipf("schema unavailable: %v", err)
	}
	if n == 0 {
		if _, err := conn.Exec(db.Translate("INSERT INTO project (id, name, enabled, is_default, created_at, updated_at, version) VALUES (?, ?, ?, ?, NOW() AT TIME ZONE 'UTC', NOW() AT TIME ZONE 'UTC', 1)"),
			testProjectID, "测试项目", true, true); err != nil {
			t.Fatalf("seed project: %v", err)
		}
	}
}

func cleanupPlans(t *testing.T, planDate jtype.Date) {
	t.Helper()
	if _, err := db.DB.Exec(db.Translate("DELETE FROM purchase_material WHERE plan_date = ? AND project_id = ?"), planDate, testProjectID); err != nil {
		t.Fatalf("cleanup: %v", err)
	}
}

func newPlan(planDate jtype.Date, name, model, qty, person string) schema.PurchaseMaterialCreate {
	data := schema.NewPurchaseMaterialCreate()
	category := "备品备件"
	data.PlanDate = &planDate
	data.Category = &category
	data.Name = name
	data.ModelSpec = model
	data.UnitName = "个"
	data.PlannedQty = jtype.MustDecimal(qty)
	data.Usage = "测试"
	data.ActualDemandPerson = &person
	return data
}

func TestCreatePurchaseRetriesPlanNoOnCollision(t *testing.T) {
	openTestDB(t)
	ctx := context.Background()
	planDate := jtype.NewDate(2026, 8, 1)
	cleanupPlans(t, planDate)
	t.Cleanup(func() { cleanupPlans(t, planDate) })

	s1 := db.ProjectSession(ctx, testProjectID)
	first, err := CreatePurchase(s1, newPlan(planDate, "重试测试物资", "RETRY-1", "1", "张三"))
	if err != nil {
		t.Fatalf("create first: %v", err)
	}
	if err := s1.Commit(); err != nil {
		t.Fatalf("commit first: %v", err)
	}
	s1.Close()

	// 模拟并发：第二次创建先拿到与 first 相同的序号（MAX+1 竞态），撞唯一约束后保存点重试。
	real := nextPlanNo
	calls := 0
	nextPlanNo = func(s *db.Session, d jtype.Date) (string, error) {
		calls++
		if calls == 1 {
			return first.PlanNo, nil
		}
		return real(s, d)
	}
	defer func() { nextPlanNo = real }()

	s2 := db.ProjectSession(ctx, testProjectID)
	defer s2.Close()
	second, err := CreatePurchase(s2, newPlan(planDate, "重试测试物资2", "RETRY-2", "2", "李四"))
	if err != nil {
		t.Fatalf("create second: %v", err)
	}
	if err := s2.Commit(); err != nil {
		t.Fatalf("commit second: %v", err)
	}
	if second.PlanNo == first.PlanNo {
		t.Fatalf("plan_no not regenerated: %s", second.PlanNo)
	}
	if second.ID == first.ID {
		t.Fatalf("same id %d", second.ID)
	}
	if calls < 2 {
		t.Fatalf("expected a retry, calls=%d", calls)
	}
	var stored []string
	if err := db.DB.Select(&stored, db.Translate("SELECT plan_no FROM purchase_material WHERE plan_date = ? AND project_id = ? ORDER BY id"), planDate, testProjectID); err != nil {
		t.Fatalf("query: %v", err)
	}
	if len(stored) != 2 || stored[0] != first.PlanNo || stored[1] != second.PlanNo {
		t.Fatalf("stored plan_nos = %v, want [%s %s]", stored, first.PlanNo, second.PlanNo)
	}
}

func TestMonthsBeforeClampsDay(t *testing.T) {
	cases := []struct{ in, want jtype.Date }{
		{jtype.NewDate(2026, 5, 31), jtype.NewDate(2026, 2, 28)},
		{jtype.NewDate(2026, 2, 15), jtype.NewDate(2025, 11, 15)},
		{jtype.NewDate(2024, 5, 31), jtype.NewDate(2024, 2, 29)},
	}
	for _, c := range cases {
		if got := monthsBefore(c.in, 3); !got.Equal(c.want.Time) {
			t.Errorf("monthsBefore(%s) = %s, want %s", c.in, got, c.want)
		}
	}
}

func TestPyDecStrKeepsScale(t *testing.T) {
	for in, want := range map[string]string{"5.0": "5.0", "7": "7", "0": "0", "12.50": "12.50"} {
		if got := pyDecStr(jtype.MustDecimal(in)); got != want {
			t.Errorf("pyDecStr(%s) = %s, want %s", in, got, want)
		}
	}
}
