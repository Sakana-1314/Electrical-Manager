package miniprogram

import (
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/model"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/service/material"
)

func strp(s string) *string { return &s }

func TestLocalizedMaterialName(t *testing.T) {
	item := &model.StockMaterial{Name: "接触器", NameID: strp("Kontaktor"), Alias: strp("备用")}
	cases := []struct {
		lang *string
		want string
	}{
		{nil, "接触器（备用）"},
		{strp("zh-CN,zh;q=0.9"), "接触器（备用）"},
		{strp("id-ID,id;q=0.9"), "Kontaktor"},
		{strp(" in_ID ;q=1"), "Kontaktor"},
		{strp("ID"), "Kontaktor"},
		{strp("en"), "接触器（备用）"},
	}
	for _, c := range cases {
		if got := LocalizedMaterialName(item, c.lang); got != c.want {
			t.Errorf("lang %v: got %q want %q", c.lang, got, c.want)
		}
	}
	plain := &model.StockMaterial{Name: "电机", NameID: strp(""), Alias: strp("")}
	if got := LocalizedMaterialName(plain, strp("id")); got != "电机" {
		t.Errorf("empty name_id fallback: %q", got)
	}
	if got := LocalizedMaterialName(plain, nil); got != "电机" {
		t.Errorf("empty alias: %q", got)
	}
}

func TestStockStatus(t *testing.T) {
	dec := jtype.MustDecimal
	mk := func(qty string, policy *model.StockReplenishmentPolicy) *material.Stock {
		s := &material.Stock{Policy: policy}
		if qty != "" {
			s.Balance = &model.StockBalance{Quantity: dec(qty)}
		}
		return s
	}
	enabled := &model.StockReplenishmentPolicy{MinimumQty: dec("5"), Enabled: true}
	disabled := &model.StockReplenishmentPolicy{MinimumQty: dec("5"), Enabled: false}
	cases := []struct {
		item *material.Stock
		want string
	}{
		{mk("", nil), "out_of_stock"},
		{mk("0", enabled), "out_of_stock"},
		{mk("5", enabled), "low_stock"},
		{mk("5", disabled), "normal"},
		{mk("5.5", enabled), "normal"},
	}
	for i, c := range cases {
		if got := StockStatus(c.item); got != c.want {
			t.Errorf("case %d: got %q want %q", i, got, c.want)
		}
	}
}
