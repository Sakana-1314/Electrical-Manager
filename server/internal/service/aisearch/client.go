package aisearch

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Sakana-1314/Electrical-Manager/server/internal/lifecycle"
)

// 与 httpx.Timeout(read, connect=3) 语义一致的 HTTP 客户端：
//   - 连接（TCP + TLS 握手）超时 3 秒；
//   - 读 / 写超时按「单次读写」计（每次 Read/Write 前重置期限），而不是整个请求的总时长；
//   - 不跟随重定向（httpx 默认），3xx 由调用方按非 2xx 处理。

type errKind int

const (
	errRequest errKind = iota
	errConnectTimeout
	errReadTimeout
	errOtherTimeout
	errConnect
)

type deadlineConn struct {
	net.Conn
	timeout time.Duration
}

type opError struct {
	op  string
	err error
}

func (e *opError) Error() string   { return e.err.Error() }
func (e *opError) Unwrap() error   { return e.err }
func (e *opError) Timeout() bool   { return isTimeout(e.err) }
func (e *opError) Temporary() bool { return false }

func (c *deadlineConn) Read(b []byte) (int, error) {
	_ = c.Conn.SetReadDeadline(time.Now().Add(c.timeout))
	n, err := c.Conn.Read(b)
	if err != nil && isTimeout(err) {
		err = &opError{op: "read", err: err}
	}
	return n, err
}

func (c *deadlineConn) Write(b []byte) (int, error) {
	_ = c.Conn.SetWriteDeadline(time.Now().Add(c.timeout))
	n, err := c.Conn.Write(b)
	if err != nil && isTimeout(err) {
		err = &opError{op: "write", err: err}
	}
	return n, err
}

func isTimeout(err error) bool {
	if errors.Is(err, os.ErrDeadlineExceeded) {
		return true
	}
	var ne net.Error
	return errors.As(err, &ne) && ne.Timeout()
}

var clients sync.Map // time.Duration → *http.Client

func clientFor(timeout time.Duration) *http.Client {
	if c, ok := clients.Load(timeout); ok {
		return c.(*http.Client)
	}
	dialer := &net.Dialer{Timeout: connectTimeout, KeepAlive: 30 * time.Second}
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			conn, err := dialer.DialContext(ctx, network, addr)
			if err != nil {
				return nil, err
			}
			return &deadlineConn{Conn: conn, timeout: timeout}, nil
		},
		TLSHandshakeTimeout: connectTimeout,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     5 * time.Second,
		ForceAttemptHTTP2:   false,
	}
	c := &http.Client{
		Transport: transport,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	actual, _ := clients.LoadOrStore(timeout, c)
	return actual.(*http.Client)
}

// classify 把 net/http 错误映射为 httpx 的异常类别。
func classify(err error) errKind {
	var oe *opError
	if errors.As(err, &oe) {
		if oe.op == "read" {
			return errReadTimeout
		}
		return errOtherTimeout
	}
	if strings.Contains(err.Error(), "TLS handshake timeout") {
		return errConnectTimeout
	}
	var netOp *net.OpError
	if errors.As(err, &netOp) && netOp.Op == "dial" {
		if netOp.Timeout() {
			return errConnectTimeout
		}
		return errConnect
	}
	var dnsErr *net.DNSError
	if errors.As(err, &dnsErr) {
		if dnsErr.IsTimeout {
			return errConnectTimeout
		}
		return errConnect
	}
	var certErr *tls.CertificateVerificationError
	var unknownAuth x509.UnknownAuthorityError
	var hostErr x509.HostnameError
	var recErr tls.RecordHeaderError
	var alert tls.AlertError
	if errors.As(err, &certErr) || errors.As(err, &unknownAuth) || errors.As(err, &hostErr) || errors.As(err, &recErr) || errors.As(err, &alert) {
		return errConnect
	}
	if isTimeout(err) {
		return errOtherTimeout
	}
	return errRequest
}

// ---------------- 测试钩子（仅 APP_TEST_HOOKS=1 时由路由层调用） ----------------

var (
	testMu       sync.RWMutex
	testUpstream *url.URL
	testTimeout  time.Duration
)

// SetTestUpstream 把对 AI 服务的请求改投到本地桩服务 base（保留原路径与查询，Host 头保持原主机）；
// responseTimeout > 0 时用它替代实际等待时长（错误文案与 details 仍按原超时）。base 为空则取消。
func SetTestUpstream(base string, responseTimeout time.Duration) error {
	testMu.Lock()
	defer testMu.Unlock()
	testTimeout = responseTimeout
	if base == "" {
		testUpstream = nil
	} else {
		u, err := url.Parse(base)
		if err != nil {
			return err
		}
		testUpstream = u
	}
	clearCache()
	return nil
}

func effectiveTimeout(timeout time.Duration) time.Duration {
	testMu.RLock()
	defer testMu.RUnlock()
	if testTimeout > 0 {
		return testTimeout
	}
	return timeout
}

// rewriteForTest 返回实际请求地址与需保留的 Host 头（未启用桩服务时原样返回）。
func rewriteForTest(target string) (string, string, error) {
	testMu.RLock()
	base := testUpstream
	testMu.RUnlock()
	if base == nil {
		return target, "", nil
	}
	u, err := url.Parse(target)
	if err != nil {
		return "", "", err
	}
	host := u.Host
	u.Scheme = base.Scheme
	u.Host = base.Host
	return u.String(), host, nil
}

// CloseClients 关闭空闲连接（进程退出时调用，对应 close_client）。
func CloseClients() {
	clients.Range(func(_, v any) bool {
		v.(*http.Client).CloseIdleConnections()
		return true
	})
}

func init() {
	lifecycle.OnShutdown(CloseClients)
}
