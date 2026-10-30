package model

import "strings"

// Prefixed 给列清单（如 ColsWorkRecord）的每一列加上表别名：Prefixed("r", ColsWorkRecord) → `r."id", r."name", ...`。
func Prefixed(alias, cols string) string {
	parts := strings.Split(cols, ", ")
	for i, p := range parts {
		name := strings.Trim(p, "`\"")
		parts[i] = alias + `."` + name + `"`
	}
	return strings.Join(parts, ", ")
}
