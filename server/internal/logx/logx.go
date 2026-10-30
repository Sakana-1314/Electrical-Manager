// Package logx 对应原 core/logging.py：控制台（可彩色）+ 按天轮转、按月归档的文件日志。
//
// 行格式：`2026-01-02 03:04:05 | INFO     | spare_parts.api | message`。
// 轮转后的文件放入 `YYYY-MM/spare-parts-api.YYYY-MM-DD.log`，保留最近 backupCount 个。
package logx

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

const defaultLogger = "spare_parts.api"

// handler 输出与 Python logging.Formatter 一致的行格式。
type handler struct {
	mu       sync.Mutex
	console  io.Writer
	file     io.Writer
	color    bool
	name     string
	minLevel slog.Level
}

func (h *handler) Enabled(_ context.Context, l slog.Level) bool { return l >= h.minLevel }

func levelName(l slog.Level) string {
	switch {
	case l >= slog.LevelError:
		return "ERROR"
	case l >= slog.LevelWarn:
		return "WARNING"
	case l >= slog.LevelInfo:
		return "INFO"
	}
	return "DEBUG"
}

func (h *handler) Handle(_ context.Context, r slog.Record) error {
	name := h.name
	msg := r.Message
	var extras []string
	r.Attrs(func(a slog.Attr) bool {
		if a.Key == "logger" {
			name = a.Value.String()
			return true
		}
		extras = append(extras, fmt.Sprintf("%s=%v", a.Key, a.Value.Any()))
		return true
	})
	if len(extras) > 0 {
		msg += " " + strings.Join(extras, " ")
	}
	ts := r.Time.Local().Format("2006-01-02 15:04:05")
	level := fmt.Sprintf("%-8s", levelName(r.Level))
	plain := fmt.Sprintf("%s | %s | %s | %s\n", ts, level, name, msg)
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.console != nil && !strings.Contains(msg, "/health") {
		if h.color {
			fmt.Fprintf(h.console, "\033[32m%s\033[0m | \033[33m%s\033[0m | \033[36m%s\033[0m | %s\n", ts, level, name, msg)
		} else {
			io.WriteString(h.console, plain)
		}
	}
	if h.file != nil {
		io.WriteString(h.file, plain)
	}
	return nil
}

func (h *handler) WithAttrs(attrs []slog.Attr) slog.Handler {
	clone := &handler{console: h.console, file: h.file, color: h.color, name: h.name, minLevel: h.minLevel}
	for _, a := range attrs {
		if a.Key == "logger" {
			clone.name = a.Value.String()
		}
	}
	return clone
}

func (h *handler) WithGroup(string) slog.Handler { return h }

// Configure 初始化全局日志。
func Configure(logDir string, backupCount int) error {
	if err := os.MkdirAll(logDir, 0o755); err != nil {
		return err
	}
	w, err := newRotatingWriter(filepath.Join(logDir, "spare-parts-api.log"), backupCount)
	if err != nil {
		return err
	}
	_, noColor := os.LookupEnv("NO_COLOR")
	slog.SetDefault(slog.New(&handler{console: os.Stdout, file: w, color: !noColor, name: defaultLogger, minLevel: slog.LevelInfo}))
	return nil
}

// Named 返回指定 logger 名称的日志器（对应 logging.getLogger(name)）。
func Named(name string) *slog.Logger { return slog.Default().With("logger", name) }

// rotatingWriter 每天午夜（本地时间）轮转，旧文件归档到 YYYY-MM 目录。
type rotatingWriter struct {
	mu          sync.Mutex
	path        string
	backupCount int
	f           *os.File
	day         string
}

func newRotatingWriter(path string, backupCount int) (*rotatingWriter, error) {
	w := &rotatingWriter{path: path, backupCount: backupCount}
	if err := w.open(); err != nil {
		return nil, err
	}
	return w, nil
}

func (w *rotatingWriter) open() error {
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	w.f = f
	day := time.Now().Format("2006-01-02")
	if st, err := f.Stat(); err == nil && st.Size() > 0 {
		day = st.ModTime().Format("2006-01-02")
	}
	w.day = day
	return nil
}

func (w *rotatingWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	today := time.Now().Format("2006-01-02")
	if today != w.day {
		w.rotate()
	}
	return w.f.Write(p)
}

func (w *rotatingWriter) rotate() {
	old := w.day
	_ = w.f.Close()
	base := filepath.Base(w.path)
	ext := filepath.Ext(base)
	stem := strings.TrimSuffix(base, ext)
	archiveDir := filepath.Join(filepath.Dir(w.path), old[:7])
	_ = os.MkdirAll(archiveDir, 0o755)
	_ = os.Rename(w.path, filepath.Join(archiveDir, fmt.Sprintf("%s.%s%s", stem, old, ext)))
	_ = w.open()
	w.day = time.Now().Format("2006-01-02")
	w.prune(stem, ext)
}

func (w *rotatingWriter) prune(stem, ext string) {
	if w.backupCount <= 0 {
		return
	}
	type cand struct{ date, path string }
	var cands []cand
	dirs, _ := os.ReadDir(filepath.Dir(w.path))
	for _, d := range dirs {
		name := d.Name()
		if !d.IsDir() || len(name) != 7 || name[4] != '-' {
			continue
		}
		matches, _ := filepath.Glob(filepath.Join(filepath.Dir(w.path), name, stem+".*"+ext))
		for _, m := range matches {
			date := strings.TrimSuffix(strings.TrimPrefix(filepath.Base(m), stem+"."), ext)
			if _, err := time.Parse("2006-01-02", date); err == nil {
				cands = append(cands, cand{date, m})
			}
		}
	}
	sort.Slice(cands, func(i, j int) bool { return cands[i].date < cands[j].date })
	for i := 0; i < len(cands)-w.backupCount; i++ {
		_ = os.Remove(cands[i].path)
	}
}
