package security

// 对应原 Python 的 tests/test_identifiers.py（UUIDv7 单调递增）与 tests/unit/test_fernet.py（Fernet 往返与密钥回退）。

import (
	"crypto/sha256"
	"sort"
	"testing"

	"github.com/fernet/fernet-go"
	"github.com/google/uuid"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

func TestUUID7StringsAreValidAndMonotonicallyOrdered(t *testing.T) {
	ids := make([]string, 100)
	for i := range ids {
		ids[i] = UUID7()
	}
	if !sort.StringsAreSorted(ids) {
		t.Fatalf("UUIDv7 不是单调递增：%v", ids)
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if seen[id] {
			t.Fatalf("UUIDv7 重复：%s", id)
		}
		seen[id] = true
		parsed, err := uuid.Parse(id)
		if err != nil || parsed.Version() != 7 || parsed.Variant() != uuid.RFC4122 {
			t.Fatalf("%s 不是合法的 UUIDv7（err=%v）", id, err)
		}
	}
}

func withSecrets(t *testing.T, jwtSecret, fernetKey string) {
	t.Helper()
	prevJWT, prevFernet := config.S.JWTSecret, config.S.FernetKey
	config.S.JWTSecret, config.S.FernetKey = jwtSecret, fernetKey
	ResetFernetKey()
	t.Cleanup(func() {
		config.S.JWTSecret, config.S.FernetKey = prevJWT, prevFernet
		ResetFernetKey()
	})
}

func TestFernetRoundtrip(t *testing.T) {
	withSecrets(t, "test-secret-that-is-long-enough-123456", "")
	encrypted := EncryptSecret("super-secret-api-key")
	if encrypted == "super-secret-api-key" {
		t.Fatal("密文不应等于明文")
	}
	if got := DecryptSecret(encrypted); got == nil || *got != "super-secret-api-key" {
		t.Fatalf("decrypt = %v", got)
	}
	if DecryptSecret("") != nil || DecryptSecret("not-a-token") != nil {
		t.Fatal("空值或非法密文应返回 nil")
	}
}

// 未配置 APP_FERNET_KEY 时回退到 jwt_secret 派生密钥（SHA-256 → urlsafe base64），既有密文必须能解密。
func TestFernetFallsBackToJWTDerivedKey(t *testing.T) {
	const secret = "test-secret-that-is-long-enough-123456"
	withSecrets(t, secret, "")
	digest := sha256.Sum256([]byte(secret))
	legacy := fernet.Key(digest)
	token, err := fernet.EncryptAndSign([]byte("legacy-encrypted-value"), &legacy)
	if err != nil {
		t.Fatal(err)
	}
	if got := DecryptSecret(string(token)); got == nil || *got != "legacy-encrypted-value" {
		t.Fatalf("jwt 派生密钥加密的数据应能解密，got %v", got)
	}
}

// 配置了独立的 APP_FERNET_KEY 时以它为准：jwt 派生密钥加密的数据不再能解密（返回 nil 供读取路径降级）。
func TestFernetPrefersDedicatedKey(t *testing.T) {
	withSecrets(t, "jwt-secret-value-long-enough-0000000", "dedicated-fernet-key")
	digest := sha256.Sum256([]byte("dedicated-fernet-key"))
	key := fernet.Key(digest)
	token, _ := fernet.EncryptAndSign([]byte("v"), &key)
	if got := DecryptSecret(string(token)); got == nil || *got != "v" {
		t.Fatalf("APP_FERNET_KEY 加密的数据应能解密，got %v", got)
	}
	jwtDigest := sha256.Sum256([]byte("jwt-secret-value-long-enough-0000000"))
	jwtKey := fernet.Key(jwtDigest)
	old, _ := fernet.EncryptAndSign([]byte("v"), &jwtKey)
	if DecryptSecret(string(old)) != nil {
		t.Fatal("配置独立密钥后不应再用 jwt 派生密钥解密")
	}
}
