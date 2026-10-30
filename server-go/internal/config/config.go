// Package config 读取 APP_ 前缀的环境变量（兼容原 pydantic-settings 的变量名与 server/.env 文件）。
package config

import (
	"bufio"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Settings struct {
	AppName                    string
	Environment                string
	DatabaseURL                string
	JWTSecret                  string
	JWTAlgorithm               string
	AccessTokenMinutes         int
	RefreshTokenDays           int
	FernetKey                  string
	WechatMiniProgramAppID     string
	WechatMiniProgramAppSecret string
	// 微信接口根地址（默认官方地址；测试可指向本地桩服务）。
	WechatAPIBase              string
	UploadDir                  string
	TemplateDir                string
	LogDir                     string
	LogBackupCount             int
	MaxImageBytes              int64
	CORSOrigins                []string
	CORSAllowCredentials       bool
	CORSMaxAge                 int
	PurchasePlanCleanupEnabled bool
	AttachmentCleanupEnabled   bool
	BuildTime                  *string
	GitSHA                     *string
	Host                       string
	Port                       int
}

// S 是进程级配置单例，启动时由 Load 填充。
var S = &Settings{}

// BaseDir 是服务端根目录（默认取可执行文件所在目录的工作目录），用于拼默认数据路径。
func BaseDir() string {
	if dir := os.Getenv("APP_BASE_DIR"); dir != "" {
		return dir
	}
	wd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return wd
}

func Load() (*Settings, error) {
	base := BaseDir()
	loadDotEnv(filepath.Join(base, ".env"))
	s := &Settings{
		AppName:                    env("APP_APP_NAME", "电气车间备件管理系统"),
		Environment:                env("APP_ENVIRONMENT", "development"),
		DatabaseURL:                env("APP_DATABASE_URL", "postgresql+asyncpg://spare:spare@postgresql:5432/spare_parts"),
		JWTSecret:                  env("APP_JWT_SECRET", "change-me-in-production"),
		JWTAlgorithm:               env("APP_JWT_ALGORITHM", "HS256"),
		FernetKey:                  env("APP_FERNET_KEY", ""),
		WechatMiniProgramAppID:     env("APP_WECHAT_MINI_PROGRAM_APP_ID", ""),
		WechatMiniProgramAppSecret: env("APP_WECHAT_MINI_PROGRAM_APP_SECRET", ""),
		WechatAPIBase:              strings.TrimRight(env("APP_WECHAT_API_BASE", "https://api.weixin.qq.com"), "/"),
		UploadDir:                  env("APP_UPLOAD_DIR", filepath.Join(base, "data", "uploads")),
		TemplateDir:                env("APP_TEMPLATE_DIR", filepath.Join(base, "templates")),
		LogDir:                     env("APP_LOG_DIR", filepath.Join(base, "data", "logs")),
		Host:                       env("APP_HOST", "0.0.0.0"),
	}
	var err error
	if s.AccessTokenMinutes, err = envInt("APP_ACCESS_TOKEN_MINUTES", 30, 1); err != nil {
		return nil, err
	}
	if s.RefreshTokenDays, err = envInt("APP_REFRESH_TOKEN_DAYS", 7, 1); err != nil {
		return nil, err
	}
	if s.LogBackupCount, err = envInt("APP_LOG_BACKUP_COUNT", 90, 1); err != nil {
		return nil, err
	}
	if s.CORSMaxAge, err = envInt("APP_CORS_MAX_AGE", 86400, 0); err != nil {
		return nil, err
	}
	if s.Port, err = envInt("APP_PORT", 8000, 1); err != nil {
		return nil, err
	}
	maxImage, err := envInt("APP_MAX_IMAGE_BYTES", 10*1024*1024, 1)
	if err != nil {
		return nil, err
	}
	s.MaxImageBytes = int64(maxImage)
	if s.CORSAllowCredentials, err = envBool("APP_CORS_ALLOW_CREDENTIALS", true); err != nil {
		return nil, err
	}
	if s.PurchasePlanCleanupEnabled, err = envBool("APP_PURCHASE_PLAN_CLEANUP_ENABLED", true); err != nil {
		return nil, err
	}
	if s.AttachmentCleanupEnabled, err = envBool("APP_ATTACHMENT_CLEANUP_ENABLED", true); err != nil {
		return nil, err
	}
	for _, item := range strings.Split(env("APP_CORS_ORIGINS", ""), ",") {
		if item = strings.TrimSpace(item); item != "" {
			s.CORSOrigins = append(s.CORSOrigins, item)
		}
	}
	if v, ok := lookup("APP_BUILD_TIME"); ok && v != "" {
		s.BuildTime = &v
	}
	if v, ok := lookup("APP_GIT_SHA"); ok && v != "" {
		s.GitSHA = &v
	}
	if len([]rune(s.JWTSecret)) < 16 {
		return nil, fmt.Errorf("APP_JWT_SECRET 至少 16 个字符")
	}
	*S = *s
	return S, nil
}

// PostgresDSN 把 SQLAlchemy 风格的 `postgresql+asyncpg://user:pass@host:5432/db` 转换为 pgx 可用的
// `postgres://user:pass@host:5432/db`（去掉驱动后缀，会话时区固定为 UTC，与存 naive UTC 的口径一致）。
func (s *Settings) PostgresDSN() (string, error) {
	raw := strings.TrimSpace(s.DatabaseURL)
	scheme, rest, ok := strings.Cut(raw, "://")
	if !ok {
		return "", fmt.Errorf("APP_DATABASE_URL 无法解析")
	}
	base := strings.SplitN(scheme, "+", 2)[0]
	if base != "postgresql" && base != "postgres" {
		return "", fmt.Errorf("APP_DATABASE_URL 必须是 PostgreSQL 连接串（postgresql://...）")
	}
	u, err := url.Parse("postgres://" + rest)
	if err != nil {
		return "", fmt.Errorf("APP_DATABASE_URL 无法解析: %w", err)
	}
	q := u.Query()
	if q.Get("timezone") == "" && q.Get("TimeZone") == "" {
		q.Set("timezone", "UTC")
	}
	// asyncpg 风格的 ssl 参数映射到 libpq 的 sslmode。
	if v := q.Get("ssl"); v != "" && q.Get("sslmode") == "" {
		q.Set("sslmode", v)
		q.Del("ssl")
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func lookup(key string) (string, bool) { return os.LookupEnv(key) }

func env(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

func envInt(key string, fallback, minimum int) (int, error) {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil {
		return 0, fmt.Errorf("%s 必须是整数", key)
	}
	if n < minimum {
		return 0, fmt.Errorf("%s 不能小于 %d", key, minimum)
	}
	return n, nil
}

func envBool(key string, fallback bool) (bool, error) {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback, nil
	}
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on", "y", "t":
		return true, nil
	case "0", "false", "no", "off", "n", "f":
		return false, nil
	}
	return false, fmt.Errorf("%s 必须是布尔值", key)
}

// loadDotEnv 读取 KEY=VALUE 行（不覆盖已存在的环境变量），与 pydantic-settings 的 env_file 行为一致。
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimPrefix(line, "export ")
		i := strings.Index(line, "=")
		if i <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:i])
		val := strings.TrimSpace(line[i+1:])
		if len(val) >= 2 && (val[0] == '"' && val[len(val)-1] == '"' || val[0] == '\'' && val[len(val)-1] == '\'') {
			val = val[1 : len(val)-1]
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, val)
		}
	}
}
