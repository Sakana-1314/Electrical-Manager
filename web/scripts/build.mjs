#!/usr/bin/env node
import { spawnSync } from 'node:child_process'

/**
 * EdgeOne Pages 的构建容器把 nofile 软限制设得很低，`vite build` 并行读取 SFC 时会报
 * `EMFILE: too many open files`。POSIX 构建机先把 nofile 提到硬限制（通常远高于软限制）
 * 再执行真正的构建；Windows 本地没有 ulimit，直接跑同一套命令。
 */
const isWindows = process.platform === 'win32'
const result = isWindows
  ? spawnSync('npm run build:ci', { stdio: 'inherit', shell: true })
  : spawnSync(
      'sh',
      [
        '-c',
        'ulimit -n 65535 2>/dev/null || ulimit -n "$(ulimit -Hn)" 2>/dev/null || true; exec npm run build:ci',
      ],
      { stdio: 'inherit' },
    )

if (result.error) {
  console.error(result.error)
  process.exit(1)
}
process.exit(result.status ?? 1)
