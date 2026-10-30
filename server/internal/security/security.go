// Package security 对应原 core/security.py 与 core/identifiers.py：
// argon2 密码哈希（与 argon2-cffi 的 PHC 字符串互通）、JWT、Fernet 加解密、UUIDv7。
package security

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fernet/fernet-go"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/config"
)

// ---------------- argon2（argon2-cffi 默认参数：t=3, m=65536, p=4, hash_len=32, salt_len=16） ----------------

const (
	argonTime    = 3
	argonMemory  = 65536
	argonThreads = 4
	argonKeyLen  = 32
	argonSaltLen = 16
)

var b64 = base64.RawStdEncoding

func HashPassword(password string) string {
	salt := make([]byte, argonSaltLen)
	_, _ = rand.Read(salt)
	key := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return fmt.Sprintf("$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argonMemory, argonTime, argonThreads, b64.EncodeToString(salt), b64.EncodeToString(key))
}

// VerifyPassword 校验 PHC 格式哈希（支持 argon2id / argon2i）；格式错误视为不匹配。
func VerifyPassword(password, encoded string) bool {
	parts := strings.Split(encoded, "$")
	// ["", "argon2id", "v=19", "m=..,t=..,p=..", salt, hash]
	if len(parts) != 6 || parts[0] != "" {
		return false
	}
	variant := parts[1]
	if parts[2] != "v=19" {
		return false
	}
	var m, t uint64
	var p uint64
	for _, kv := range strings.Split(parts[3], ",") {
		k, v, ok := strings.Cut(kv, "=")
		if !ok {
			return false
		}
		n, err := strconv.ParseUint(v, 10, 32)
		if err != nil {
			return false
		}
		switch k {
		case "m":
			m = n
		case "t":
			t = n
		case "p":
			p = n
		}
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil {
		return false
	}
	want, err := b64.DecodeString(parts[5])
	if err != nil || len(want) == 0 || m == 0 || t == 0 || p == 0 || p > 255 {
		return false
	}
	var got []byte
	switch variant {
	case "argon2id":
		got = argon2.IDKey([]byte(password), salt, uint32(t), uint32(m), uint8(p), uint32(len(want)))
	case "argon2i":
		got = argon2.Key([]byte(password), salt, uint32(t), uint32(m), uint8(p), uint32(len(want)))
	default:
		return false
	}
	return subtle.ConstantTimeCompare(got, want) == 1
}

// ---------------- Fernet ----------------

var (
	fernetOnce sync.Once
	fernetKey  *fernet.Key
)

// fernetKeyFor 优先使用 APP_FERNET_KEY，未配置时由 jwt_secret 派生（均经 SHA-256 固定为 32 字节）。
func currentFernetKey() *fernet.Key {
	fernetOnce.Do(func() {
		secret := config.S.FernetKey
		if secret == "" {
			secret = config.S.JWTSecret
		}
		digest := sha256.Sum256([]byte(secret))
		k := fernet.Key(digest)
		fernetKey = &k
	})
	return fernetKey
}

// ResetFernetKey 供测试在修改配置后重置派生密钥。
func ResetFernetKey() { fernetOnce = sync.Once{} }

func EncryptSecret(value string) string {
	tok, err := fernet.EncryptAndSign([]byte(value), currentFernetKey())
	if err != nil {
		panic(err)
	}
	return string(tok)
}

// DecryptSecret 空值或解密失败（如密钥轮换）时返回 nil。
func DecryptSecret(value string) *string {
	if value == "" {
		return nil
	}
	msg := fernet.VerifyAndDecrypt([]byte(value), 0, []*fernet.Key{currentFernetKey()})
	if msg == nil {
		return nil
	}
	s := string(msg)
	return &s
}

// ---------------- JWT ----------------

func createToken(subject, tokenType string, expiresMinutes int, extra map[string]string) string {
	now := time.Now().UTC()
	claims := jwt.MapClaims{
		"sub":        subject,
		"token_type": tokenType,
		"iat":        now.Unix(),
		"exp":        now.Add(time.Duration(expiresMinutes) * time.Minute).Unix(),
	}
	for k, v := range extra {
		claims[k] = v
	}
	tok := jwt.NewWithClaims(jwt.GetSigningMethod(config.S.JWTAlgorithm), claims)
	signed, err := tok.SignedString([]byte(config.S.JWTSecret))
	if err != nil {
		panic(err)
	}
	return signed
}

func CreateAccessToken(userID int64) string {
	return createToken(strconv.FormatInt(userID, 10), "management_access", config.S.AccessTokenMinutes,
		map[string]string{"jti": uuid.NewString()})
}

func CreateRefreshToken(userID int64, userVersion int64) string {
	return createToken(strconv.FormatInt(userID, 10), "management_refresh", config.S.RefreshTokenDays*24*60,
		map[string]string{"version": strconv.FormatInt(userVersion, 10), "jti": uuid.NewString()})
}

func CreateMiniProgramAccessToken(userID int64) string {
	return createToken(strconv.FormatInt(userID, 10), "mini_program", config.S.AccessTokenMinutes, nil)
}

func CreateMiniProgramRegistrationToken(appID, openid string) string {
	return createToken(openid, "mini_program_registration", 10, map[string]string{"app_id": appID})
}

var ErrInvalidToken = errors.New("invalid token")

// DecodeAccessToken 校验签名与过期时间，返回 claims。
func DecodeAccessToken(token string) (jwt.MapClaims, error) {
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
		return []byte(config.S.JWTSecret), nil
	}, jwt.WithValidMethods([]string{config.S.JWTAlgorithm}))
	if err != nil || !parsed.Valid {
		return nil, ErrInvalidToken
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// ClaimString 读取字符串 claim（缺失或类型不对返回 false）。
func ClaimString(claims jwt.MapClaims, key string) (string, bool) {
	v, ok := claims[key]
	if !ok || v == nil {
		return "", false
	}
	switch x := v.(type) {
	case string:
		return x, true
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64), true
	}
	return fmt.Sprint(v), true
}

// ClaimInt 等价 Python int(payload[key])：接受数字或整数字符串。
func ClaimInt(claims jwt.MapClaims, key string) (int64, bool) {
	v, ok := claims[key]
	if !ok || v == nil {
		return 0, false
	}
	switch x := v.(type) {
	case float64:
		if x != float64(int64(x)) {
			return int64(x), true
		}
		return int64(x), true
	case string:
		n, err := strconv.ParseInt(strings.TrimSpace(x), 10, 64)
		if err != nil {
			return 0, false
		}
		return n, true
	case bool:
		if x {
			return 1, true
		}
		return 0, true
	}
	return 0, false
}

// ---------------- 摘要 / 标识 ----------------

func SHA256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// UUID4 返回随机 UUID v4 字符串。
func UUID4() string { return uuid.NewString() }

const randomBits = 74

var (
	uuidMu       sync.Mutex
	lastMilli    int64  = -1
	lastRandHigh uint64 // 高 10 位
	lastRandLow  uint64 // 低 64 位
)

// UUID7 返回单调递增的 UUIDv7 字符串（与原 identifiers.uuid7_string 同一算法）。
func UUID7() string {
	milli := time.Now().UnixMilli()
	uuidMu.Lock()
	var hi, lo uint64
	if milli > lastMilli {
		var buf [10]byte
		_, _ = rand.Read(buf[:])
		hi = uint64(binary.BigEndian.Uint16(buf[0:2])) & 0x3FF
		lo = binary.BigEndian.Uint64(buf[2:10])
	} else {
		milli = lastMilli
		hi, lo = lastRandHigh, lastRandLow+1
		if lo == 0 {
			hi = (hi + 1) & 0x3FF
			if hi == 0 {
				milli++
			}
		}
	}
	lastMilli, lastRandHigh, lastRandLow = milli, hi, lo
	uuidMu.Unlock()

	// 74 位随机数 = hi(10) | lo(64)；random_a = 高 12 位（rand >> 62），random_b = 低 62 位。
	randA := (hi << 2) | (lo >> 62)
	randB := lo & ((1 << 62) - 1)
	var b [16]byte
	ms := uint64(milli) & ((1 << 48) - 1)
	binary.BigEndian.PutUint16(b[0:2], uint16(ms>>32))
	binary.BigEndian.PutUint32(b[2:6], uint32(ms))
	binary.BigEndian.PutUint16(b[6:8], uint16(0x7<<12|randA&0xFFF))
	binary.BigEndian.PutUint64(b[8:16], (uint64(0b10)<<62)|randB)
	return uuid.UUID(b).String()
}
