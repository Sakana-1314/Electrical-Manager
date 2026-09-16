export function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const baseUrl = value?.trim() || fallback
  return baseUrl === '/' ? baseUrl : baseUrl.replace(/\/+$/, '')
}

/** 把 public/ 下的资源按构建 base 拼成正确路径。
 *
 * Vite 只会重写 index.html 里的绝对路径，代码里的字符串（例如 '/logo.png'）不会自动加 base，
 * 于是子路径部署（如演示站 /Electrical-Manager/demo/）会去站点根找资源而 404。
 * 这里统一经 import.meta.env.BASE_URL 拼接；默认 base='/' 时结果与原来完全一致。
 */
export function publicUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  return joinUrl(base, path)
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl === '/' ? '' : baseUrl.replace(/\/+$/, '')
  return `${normalizedBaseUrl}/${path.replace(/^\/+/, '')}`
}

function isAbsoluteOrigin(value: string): boolean {
  try {
    const url = new URL(value)
    return url.pathname === '/' && !url.search && !url.hash
  } catch {
    return false
  }
}

export function resolveApiBaseUrl(value: string | undefined): string {
  const baseUrl = normalizeBaseUrl(value, '/api/v1')
  return isAbsoluteOrigin(baseUrl) ? joinUrl(baseUrl, 'api/v1') : baseUrl
}

export function resolveImageBaseUrl(value: string | undefined, resolvedApiBaseUrl: string): string {
  if (!value?.trim()) return joinUrl(resolvedApiBaseUrl, 'files/images')
  const baseUrl = normalizeBaseUrl(value, resolvedApiBaseUrl)
  return isAbsoluteOrigin(baseUrl) ? joinUrl(baseUrl, 'api/v1/files/images') : baseUrl
}

export function resolveMcpUrl(
  resolvedApiBaseUrl: string,
  token: string,
  projectId?: number | null,
  origin: string = window.location.origin,
): string {
  const url = new URL(joinUrl(resolvedApiBaseUrl, 'mcp/'), origin)
  // 多项目隔离：链接里带上当前项目，Agent 就按这个项目读写（不带则用系统默认项目）。
  // 参数顺序固定为 project_id 在 token 之前（服务端按名解析，顺序只为可读性与复制口径一致）。
  if (Number.isInteger(projectId) && Number(projectId) > 0) {
    url.searchParams.set('project_id', String(projectId))
  }
  url.searchParams.set('token', token)
  return url.toString()
}

export const apiBaseUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
export const imageBaseUrl = resolveImageBaseUrl(import.meta.env.VITE_IMAGE_BASE_URL, apiBaseUrl)
export const buildTime = __BUILD_TIME__
