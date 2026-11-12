package domain

import (
	"reflect"
	"testing"
)

func TestPermissionBitsNormalizesWriteAndRejectsUnknown(t *testing.T) {
	bits, unknown := PermissionBits([]string{"warehouse:write", "bogus:read", "warehouse:write"})
	if len(unknown) != 1 || unknown[0] != "bogus:read" {
		t.Fatalf("unknown = %v", unknown)
	}
	if !bits.Has(PermWarehouseWrite) || !bits.Has(PermWarehouseRead) {
		t.Fatalf("write must imply read: %b", bits)
	}
	if bits.Has(PermSystemAdmin) {
		t.Fatalf("system admin unexpectedly set: %b", bits)
	}
}

func TestPermissionKeysFollowCatalogOrder(t *testing.T) {
	bits := (PermWorkWrite | PermSystemAdmin | PermWarehouseRead).Normalize()
	got := bits.Keys()
	want := []string{"system:admin", "warehouse:read", "work:read", "work:write"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("Keys() = %v, want %v", got, want)
	}
}

func TestPermissionCatalogBitsAreUniqueAndCoverAllPermissions(t *testing.T) {
	seen := map[Permission]string{}
	var all Permission
	for _, def := range PermissionCatalog {
		if def.Bit == 0 {
			t.Fatalf("%s 的权限位不能为 0", def.Key)
		}
		if prev, ok := seen[def.Bit]; ok {
			t.Fatalf("%s 与 %s 使用了同一个权限位 %d", def.Key, prev, def.Bit)
		}
		seen[def.Bit] = def.Key
		all |= def.Bit
	}
	if all != AllPermissions {
		t.Fatalf("AllPermissions = %d，目录并集 = %d", AllPermissions, all)
	}
	// 位值已经写进生产库（app_user.permissions），改位序会导致存量用户权限错位。
	if AllPermissions != 8191 {
		t.Fatalf("权限位总数变化会破坏已有库的位图语义：AllPermissions = %d", AllPermissions)
	}
}

func TestDefaultRegistrationPermissionsAreReadOnly(t *testing.T) {
	for _, def := range PermissionCatalog {
		has := DefaultRegistrationPermissions.Has(def.Bit)
		want := def.Action == "read" && def.Module != "system"
		if has != want {
			t.Fatalf("默认注册权限对 %s 的期望是 %v，实际 %v", def.Key, want, has)
		}
	}
}
