package appsettings

import (
	"testing"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/domain"
	"github.com/Sakana-1314/Electrical-Manager/server/internal/jtype"
)

func TestFromDataDefaults(t *testing.T) {
	c := fromData(map[string]any{}, 0, nil)
	if !c.MiniProgramRegistrationEnabled {
		t.Fatalf("defaults should keep registration enabled: %+v", c)
	}
	if c.DefaultPermissions != domain.DefaultRegistrationPermissions {
		t.Fatalf("default permissions = %d", c.DefaultPermissions)
	}
}

func TestFromDataParsesStoredValues(t *testing.T) {
	updated := jtype.NowUTC()
	c := fromData(map[string]any{
		"mini_program_registration_enabled": false,
		"default_permissions":               float64(domain.PermLiteRead | domain.PermPurchaseRead),
		// 旧库残留的模式 / 开关键：读取时直接忽略
		"secondary_warehouse_mode":      "lite",
		"mini_program_new_user_enabled": false,
	}, 3, &updated)
	if c.MiniProgramRegistrationEnabled {
		t.Fatalf("registration switch: %+v", c)
	}
	if c.DefaultPermissions != domain.PermLiteRead|domain.PermPurchaseRead {
		t.Fatalf("default permissions = %d", c.DefaultPermissions)
	}
	if c.Version != 3 {
		t.Fatalf("version = %d", c.Version)
	}
}
