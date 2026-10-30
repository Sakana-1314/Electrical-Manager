package share

import (
	"encoding/json"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
)

func TestResolvedColumnsDefaultExcludesStatus(t *testing.T) {
	cols := resolvedColumns(domain.SharePurchasePlan, nil)
	if cols["status"] || !cols["name"] || !cols["images"] || len(cols) != len(sharePlanKeys)-1 {
		t.Fatalf("default plan columns = %v", cols)
	}
	explicit := resolvedColumns(domain.SharePurchaseRecord, []string{"material_name"})
	if len(explicit) != 1 || !explicit["material_name"] {
		t.Fatalf("explicit columns = %v", explicit)
	}
}

func TestValidateColumns(t *testing.T) {
	cols := []string{"name", "material_name", "trace_no"}
	err := validateColumns(domain.SharePurchasePlan, &cols)
	ae, ok := err.(*apperr.Error)
	if !ok || ae.Status != 422 || ae.Message != "包含不适用于申购计划的列: material_name, trace_no" {
		t.Fatalf("err = %#v", err)
	}
	if validateColumns(domain.SharePurchaseRecord, nil) != nil {
		t.Fatal("nil columns should be valid")
	}
}

func TestExpiresAtFor(t *testing.T) {
	if expiresAtFor(domain.ShareExpiryPermanent) != nil {
		t.Fatal("permanent should not expire")
	}
	if expiresAtFor(domain.ShareExpiry24h) == nil {
		t.Fatal("24h should expire")
	}
}

func TestFilterFieldsKeepsFieldOrder(t *testing.T) {
	type row struct {
		ID       int64   `json:"id"`
		Name     string  `json:"name"`
		UnitName string  `json:"unit_name"`
		Usage    *string `json:"usage"`
	}
	obj, err := filterFields(row{ID: 7, Name: "电机", UnitName: "台"}, func(k string) bool { return k != "usage" })
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(obj)
	if string(raw) != `{"id":7,"name":"电机","unit_name":"台"}` {
		t.Fatalf("filtered = %s", raw)
	}
}
