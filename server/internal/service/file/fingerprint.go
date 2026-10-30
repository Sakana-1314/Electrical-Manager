package file

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"sync"
)

// 前端「本地摘要校验、命中免上传」的阈值：只对大于 1MB 的图片记挑战材料并允许查重，
// 与 web/src/utils/image.ts 的 dedupMinBytes 一一对应。
const DefaultDedupMinBytes = 1024 * 1024

// 二次校验的窗口大小与取窗位置：窗口都开在文件的中间一半，避开编码器头部固定字段。
const ProbeWindowBytes = 64 * 1024

var ProbeFractions = [3]float64{0.25, 0.5, 0.75}

// 摘要命中时最多取几条候选来随机挑选（正常情况下同一份原始字节只有一行）。
const MatchCandidateLimit = 5

var (
	tuningMu sync.RWMutex
	// dedupMinBytes 对应 Python 的模块常量 DEDUP_MIN_BYTES（测试钩子可临时调小）。
	dedupMinBytes = DefaultDedupMinBytes
	// chooseLast 为 true 时「随机挑选」固定取最后一个（测试钩子，等价 monkeypatch secrets.choice）。
	chooseLast = false
)

// DedupMinBytes 返回当前查重阈值。
func DedupMinBytes() int {
	tuningMu.RLock()
	defer tuningMu.RUnlock()
	return dedupMinBytes
}

// SetTestTuning 仅供 APP_TEST_HOOKS 测试钩子使用：调整查重阈值与随机挑选策略（minBytes<=0 恢复默认）。
func SetTestTuning(minBytes int, last bool) {
	tuningMu.Lock()
	defer tuningMu.Unlock()
	if minBytes <= 0 {
		minBytes = DefaultDedupMinBytes
	}
	dedupMinBytes = minBytes
	chooseLast = last
}

// choice 等价 secrets.choice：密码学安全的均匀随机下标。
func choice(n int) int {
	tuningMu.RLock()
	last := chooseLast
	tuningMu.RUnlock()
	if last {
		return n - 1
	}
	v, err := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if err != nil {
		return 0
	}
	return int(v.Int64())
}

// ProbeWindow 是一个中间片段挑战窗口。
type ProbeWindow struct {
	Offset int    `json:"offset"`
	Length int    `json:"length"`
	SHA256 string `json:"sha256"`
}

// SourceProbes 是 file_object.source_probes 的结构：{"size": 原始字节数, "windows": [...]}。
type SourceProbes struct {
	Size    int           `json:"size"`
	Windows []ProbeWindow `json:"windows"`
}

// SourceFingerprint 是原始上传字节（重编码前）的指纹，供前端「先比对摘要、命中免上传」使用。
type SourceFingerprint struct {
	SHA256 string
	Probes SourceProbes
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// probeWindows 计算中间片段挑战材料；不超过阈值的文件返回 nil。
func probeWindows(raw []byte) *SourceProbes {
	size := len(raw)
	if size <= DedupMinBytes() {
		return nil
	}
	length := min(ProbeWindowBytes, size/4)
	low := size / 4
	high := size - size/4
	windows := []ProbeWindow{}
	seen := map[int]bool{}
	for _, fraction := range ProbeFractions {
		offset := min(max(int(float64(size)*fraction)-length/2, low), high-length)
		if offset < 0 || seen[offset] {
			continue
		}
		seen[offset] = true
		windows = append(windows, ProbeWindow{Offset: offset, Length: length, SHA256: sha256Hex(raw[offset : offset+length])})
	}
	return &SourceProbes{Size: size, Windows: windows}
}

// ComputeSourceFingerprint 等价 Python source_fingerprint：(原始字节摘要, 挑战材料)；不超过阈值返回 nil。
func ComputeSourceFingerprint(raw []byte) *SourceFingerprint {
	probes := probeWindows(raw)
	if probes == nil {
		return nil
	}
	return &SourceFingerprint{SHA256: sha256Hex(raw), Probes: *probes}
}
