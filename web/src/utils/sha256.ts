/**
 * 纯 JS SHA-256（同步增量实现，无依赖）。
 *
 * 为什么不用 `crypto.subtle.digest`：生产是局域网 **HTTP**（`docker-compose` 前端容器映射 80 端口），
 * 浏览器只在安全上下文（HTTPS 或 localhost）里提供 `crypto.subtle`，实测 `http://<局域网 IP>` 下
 * `window.crypto.subtle === undefined`。图片去重要求「上传前先算摘要」，因此这里自带实现，
 * 任何协议下都可用。
 *
 * 用增量接口而不是一次性实现的原因：最大 10 MB 的图片要分块喂进来，块与块之间让出主线程，
 * 界面才能刷新进度、用户才能中途移除（见 `hashBlob`）。比对用途不涉及密码学安全的对抗场景。
 */

/** SHA-256 轮常量：前 32 位为小数部分平方根，后 64 位为立方根。 */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const INITIAL_HASH = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
])

const BLOCK_BYTES = 64

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

/** 对单块 64 字节做一轮压缩（`h` 原地更新）。 */
function compress(h: Uint32Array, block: Uint8Array, w: Uint32Array): void {
  for (let i = 0; i < 16; i += 1) {
    const o = i * 4
    w[i] = (block[o] << 24) | (block[o + 1] << 16) | (block[o + 2] << 8) | block[o + 3]
  }
  for (let i = 16; i < 64; i += 1) {
    const w15 = w[i - 15]
    const w2 = w[i - 2]
    const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)
    const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)
    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
  }

  let a = h[0]
  let b = h[1]
  let c = h[2]
  let d = h[3]
  let e = h[4]
  let f = h[5]
  let g = h[6]
  let hh = h[7]

  for (let i = 0; i < 64; i += 1) {
    const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
    const ch = (e & f) ^ (~e & g)
    const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
    const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
    const maj = (a & b) ^ (a & c) ^ (b & c)
    const temp2 = (S0 + maj) >>> 0

    hh = g
    g = f
    f = e
    e = (d + temp1) >>> 0
    d = c
    c = b
    b = a
    a = (temp1 + temp2) >>> 0
  }

  h[0] = (h[0] + a) >>> 0
  h[1] = (h[1] + b) >>> 0
  h[2] = (h[2] + c) >>> 0
  h[3] = (h[3] + d) >>> 0
  h[4] = (h[4] + e) >>> 0
  h[5] = (h[5] + f) >>> 0
  h[6] = (h[6] + g) >>> 0
  h[7] = (h[7] + hh) >>> 0
}

function toHex(h: Uint32Array): string {
  let out = ''
  for (let i = 0; i < 8; i += 1) out += h[i].toString(16).padStart(8, '0')
  return out
}

export interface Sha256Hasher {
  /** 追加一段字节（任意长度，内部自行切块）。 */
  update(chunk: Uint8Array): void
  /** 输出 64 位小写十六进制摘要；可重复调用，不破坏已累积的状态。 */
  digestHex(): string
}

/** 创建增量哈希器：分块喂数据，块间可以让出主线程。 */
export function createSha256(): Sha256Hasher {
  const h = INITIAL_HASH.slice()
  const w = new Uint32Array(64)
  const pending = new Uint8Array(BLOCK_BYTES)
  let pendingLength = 0
  let totalBytes = 0

  function update(chunk: Uint8Array): void {
    totalBytes += chunk.length
    let offset = 0
    if (pendingLength > 0) {
      const take = Math.min(BLOCK_BYTES - pendingLength, chunk.length)
      pending.set(chunk.subarray(0, take), pendingLength)
      pendingLength += take
      offset = take
      if (pendingLength === BLOCK_BYTES) {
        compress(h, pending, w)
        pendingLength = 0
      }
    }
    while (offset + BLOCK_BYTES <= chunk.length) {
      compress(h, chunk.subarray(offset, offset + BLOCK_BYTES), w)
      offset += BLOCK_BYTES
    }
    if (offset < chunk.length) {
      pending.set(chunk.subarray(offset), 0)
      pendingLength = chunk.length - offset
    }
  }

  function digestHex(): string {
    // 在副本上收尾：填充（0x80 + 若干 0，使总长为 56 mod 64，末尾 8 字节大端位长）
    const tail = new Uint8Array(pendingLength < 56 ? BLOCK_BYTES : 2 * BLOCK_BYTES)
    tail.set(pending.subarray(0, pendingLength))
    tail[pendingLength] = 0x80
    const view = new DataView(tail.buffer)
    const bitLength = totalBytes * 8
    // 位长可能超过 32 位，拆成高低两半写入（大端）
    view.setUint32(tail.length - 8, Math.floor(bitLength / 2 ** 32))
    view.setUint32(tail.length - 4, bitLength >>> 0)

    const state = h.slice()
    for (let offset = 0; offset < tail.length; offset += BLOCK_BYTES) {
      compress(state, tail.subarray(offset, offset + BLOCK_BYTES), w)
    }
    return toHex(state)
  }

  return { update, digestHex }
}

/** 计算 `bytes` 的 SHA-256 十六进制摘要（小写）。 */
export function sha256Hex(bytes: Uint8Array): string {
  const hasher = createSha256()
  hasher.update(bytes)
  return hasher.digestHex()
}

/** 计算一段文本的摘要；测试里的已知向量用得到。 */
export function sha256HexOfText(text: string): string {
  return sha256Hex(new TextEncoder().encode(text))
}

export interface HashBlobOptions {
  /** 每块读取的字节数，默认 1 MiB。 */
  chunkSize?: number
  /** 已哈希百分比（0~100），用于展示进度。 */
  onProgress?: (percent: number) => void
  /** 返回 true 时中止哈希并返回 null（用户移除该项 / 组件卸载）。 */
  shouldAbort?: () => boolean
}

/**
 * 读取一段 `Blob` / `File` 的字节。
 *
 * 优先用原生 `Blob.arrayBuffer()`；老 WebView（以及 jsdom 测试环境）没有这个 API，回退 `FileReader`。
 * 两条路径拿到的字节相同，摘要结果一致。
 */
export function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件内容失败'))
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * 分块计算 `Blob` / `File` 的 SHA-256 摘要。
 *
 * 每块之间 `await` 一次宏任务让出主线程：10 MB 的图片在主线程上一口气算完会卡住界面，
 * 进度条不刷新、用户也点不动「移除」。中止时返回 `null`（调用方据此丢弃该项）。
 */
export async function hashBlob(blob: Blob, options: HashBlobOptions = {}): Promise<string | null> {
  const chunkSize = Math.max(1, options.chunkSize ?? 1024 * 1024)
  const hasher = createSha256()
  let loaded = 0
  options.onProgress?.(0)
  while (loaded < blob.size) {
    if (options.shouldAbort?.()) return null
    const end = Math.min(loaded + chunkSize, blob.size)
    hasher.update(await readBlobBytes(blob.slice(loaded, end)))
    loaded = end
    options.onProgress?.(Math.min(100, Math.round((loaded / blob.size) * 100)))
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  if (options.shouldAbort?.()) return null
  return hasher.digestHex()
}
