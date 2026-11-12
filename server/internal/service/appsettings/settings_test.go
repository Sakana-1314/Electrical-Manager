package appsettings

import (
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

func TestFromDataDefaults(t *testing.T) {
	c := fromData(map[string]any{}, 0, nil)
	if !c.MiniProgramRegistrationEnabled || !c.MiniProgramNewUserEnabled {
		t.Fatalf("defaults should keep registration/new-user enabled: %+v", c)
	}
	if c.SecondaryWarehouseMode != domain.SecondaryWarehouseFull {
		t.Fatalf("default mode = %q", c.SecondaryWarehouseMode)
	}
	if c.DefaultPermissions != domain.DefaultRegistrationPermissions {
		t.Fatalf("default permissions = %d", c.DefaultPermissions)
	}
}

func TestFromDataParsesStoredValues(t *testing.T) {
	updated := jtype.NowUTC()
	c := fromData(map[string]any{
		"mini_program_registration_enabled": false,
		"mini_program_new_user_enabled":     false,
		"secondary_warehouse_mode":          "lite",
		"default_permissions":               float64(domain.PermWarehouseRead | domain.PermPurchaseRead),
	}, 3, &updated)
	if c.MiniProgramRegistrationEnabled || c.MiniProgramNewUserEnabled {
		t.Fatalf("bool switches: %+v", c)
	}
	if c.SecondaryWarehouseMode != domain.SecondaryWarehouseLite || c.Version != 3 {
		t.Fatalf("mode/version: %+v", c)
	}
	if c.DefaultPermissions != domain.PermWarehouseRead|domain.PermPurchaseRead {
		t.Fatalf("default permissions = %d", c.DefaultPermissions)
	}
}

func TestFromDataIgnoresInvalidMode(t *testing.T) {
	c := fromData(map[string]any{"secondary_warehouse_mode": "bogus"}, 1, nil)
	if c.SecondaryWarehouseMode != domain.SecondaryWarehouseFull {
		t.Fatalf("invalid mode must fall back to full: %q", c.SecondaryWarehouseMode)
	}
}
