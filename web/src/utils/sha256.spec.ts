// @vitest-environment node
// 需要用 Node 内建 crypto 作为对照实现（jsdom 环境里没有 createHash）
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createSha256, hashBlob, sha256Hex, sha256HexOfText } from './sha256'

/** 与 Node 内建实现对照，确保自带实现（生产 HTTP 下没有 crypto.subtle）结果一致。 */
function reference(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** 确定性伪随机字节：同一份数据在多次断言里可复现。 */
function sampleBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  let state = 20260913
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) % 2147483648
    bytes[index] = state % 256
  }
  return bytes
}

describe('sha256Hex', () => {
  it('与 Node crypto 对同一批文本结果一致（含空串与 UTF-8）', () => {
    const cases = ['', 'abc', 'hello world', '中文测试内容 with mixed ascii', '🔧 emoji 也要对']
    for (const value of cases) {
      const bytes = new TextEncoder().encode(value)
      expect(sha256Hex(bytes), value).toBe(reference(bytes))
    }
  })

  it('与 Node crypto 对空串结果一致（已知向量）', () => {
    expect(sha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('与 Node crypto 对 "abc" 结果一致（已知向量）', () => {
    expect(sha256HexOfText('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('覆盖填充边界（55/56/63/64/65/119/120 字节）', () => {
    // 这些长度分别落在「不补块 / 刚好触发补块 / 跨块」的临界点上，填充算错只在这里暴露
    for (const length of [55, 56, 63, 64, 65, 119, 120, 121, 127, 128]) {
      const bytes = new Uint8Array(length).fill(0x61)
      expect(sha256Hex(bytes), `len=${length}`).toBe(reference(bytes))
    }
  })

  it('与 Node crypto 对随机二进制一致（含高位字节）', () => {
    for (let round = 0; round < 60; round += 1) {
      const length = Math.floor(Math.random() * 400)
      expect(sha256Hex(sampleBytes(length))).toBe(reference(sampleBytes(length)))
    }
  })

  it('大文件（>1MB）也一致——去重门槛正好是 1MB', () => {
    const bytes = sampleBytes(1024 * 1024 + 123)
    expect(sha256Hex(bytes)).toBe(reference(bytes))
  })

  it('返回 64 位小写十六进制', () => {
    expect(sha256Hex(new TextEncoder().encode('x'))).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('createSha256 增量接口', () => {
  it('分块喂入与一次性结果一致（跨块边界切分）', () => {
    const bytes = sampleBytes(3000)
    const chunkSizes = [1, 63, 64, 65, 127, 128, 1000]
    const hasher = createSha256()
    let offset = 0
    for (const size of chunkSizes) {
      hasher.update(bytes.subarray(offset, offset + size))
      offset += size
    }
    hasher.update(bytes.subarray(offset))
    expect(hasher.digestHex()).toBe(reference(bytes))
  })

  it('digestHex 可重复调用，之后还能继续 update', () => {
    const head = sampleBytes(100)
    const tail = sampleBytes(150)
    const hasher = createSha256()
    hasher.update(head)
    expect(hasher.digestHex()).toBe(reference(head))
    hasher.update(tail)
    expect(hasher.digestHex()).toBe(reference(new Uint8Array([...head, ...tail])))
  })
})

describe('hashBlob', () => {
  it('分块哈希 Blob 与一次性结果一致，并回报 0~100 的进度', async () => {
    const bytes = sampleBytes(2 * 1024 * 1024 + 777)
    const blob = new Blob([bytes])
    const progress: number[] = []

    const digest = await hashBlob(blob, {
      chunkSize: 1024 * 1024,
      onProgress: (percent) => progress.push(percent),
    })

    expect(digest).toBe(reference(bytes))
    expect(progress[0]).toBe(0)
    expect(progress[progress.length - 1]).toBe(100)
    expect([...progress].sort((a, b) => a - b)).toEqual(progress)
  })

  it('shouldAbort 返回 true 时中止并返回 null', async () => {
    const blob = new Blob([sampleBytes(1024)])
    const digest = await hashBlob(blob, { shouldAbort: () => true })
    expect(digest).toBeNull()
  })

  it('空 Blob 得到空串摘要', async () => {
    expect(await hashBlob(new Blob([]))).toBe(reference(new Uint8Array()))
  })

  it('每块之间让出主线程（定时器可插入）', async () => {
    const blob = new Blob([sampleBytes(3 * 1024 * 1024)])
    const ticks: number[] = []
    const timer = setInterval(() => ticks.push(Date.now()), 0)
    await hashBlob(blob, { chunkSize: 512 * 1024 })
    clearInterval(timer)
    expect(ticks.length).toBeGreaterThan(0)
  })

  it('onProgress 收到的是整数百分比', async () => {
    const blob = new Blob([sampleBytes(1000)])
    const progress: number[] = []
    await hashBlob(blob, { chunkSize: 300, onProgress: (percent) => progress.push(percent) })
    expect(progress.every(Number.isInteger)).toBe(true)
  })
})
