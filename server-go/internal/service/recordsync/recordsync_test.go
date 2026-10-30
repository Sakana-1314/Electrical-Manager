package recordsync

import (
	"strings"
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/apperr"
)

func strp(s string) *string { return &s }

func TestResolveActiveFields(t *testing.T) {
	if got, err := resolveActiveFields(nil); err != nil || got != nil {
		t.Fatalf("nil fields: %v %v", got, err)
	}
	if got, err := resolveActiveFields(strp("")); err != nil || got != nil {
		t.Fatalf("empty fields: %v %v", got, err)
	}
	got, err := resolveActiveFields(strp(" salesperson , status,"))
	if err != nil || len(got) != 2 || !got["salesperson"] || !got["status"] {
		t.Fatalf("parsed = %v, %v", got, err)
	}
	_, err = resolveActiveFields(strp("zeta,salesperson,alpha"))
	ae, ok := err.(*apperr.Error)
	if !ok || ae.Status != 422 || ae.Code != "VALIDATION_ERROR" || ae.Message != "未知同步字段: alpha, zeta" {
		t.Fatalf("unknown fields error = %#v", err)
	}
}

func TestResolveOrderNoCutoff(t *testing.T) {
	if v, err := resolveOrderNoCutoff(strp(""), "x"); err != nil || v != nil {
		t.Fatal("empty cutoff should be nil")
	}
	if v, _ := resolveOrderNoCutoff(strp("  PO-1 "), "x"); v == nil || *v != "PO-1" {
		t.Fatalf("cutoff = %v", v)
	}
	_, err := resolveOrderNoCutoff(strp(strings.Repeat("a", 129)), "申购单号起始值")
	if ae, ok := err.(*apperr.Error); !ok || ae.Message != "申购单号起始值过长" {
		t.Fatalf("too long error = %#v", err)
	}
}

func TestTargetConditions(t *testing.T) {
	all := targetConditions(nil)
	if !strings.Contains(all, "l.unit_price IS NULL") || !strings.Contains(all, "l.status IN") {
		t.Fatalf("all conditions = %s", all)
	}
	if only := targetConditions(map[string]bool{"status": true}); only != "(l.status IN ('已申购', '已采购', '部分入库'))" {
		t.Fatalf("status only = %s", only)
	}
	if targetConditions(map[string]bool{}) != "" {
		t.Fatal("no active fields should produce no condition")
	}
}

func TestStatusProgression(t *testing.T) {
	if !statusProgression["已入库"]["部分入库"] || statusProgression["已采购"]["已入库"] {
		t.Fatal("status progression mismatch")
	}
}
