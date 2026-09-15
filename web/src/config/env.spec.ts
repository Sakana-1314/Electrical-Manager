import { describe, expect, it } from 'vitest'
import {
  joinUrl,
  normalizeBaseUrl,
  publicUrl,
  resolveApiBaseUrl,
  resolveImageBaseUrl,
  resolveMcpUrl,
} from './env'

describe('构建环境配置', () => {
  it('清理地址末尾斜杠', () => {
    expect(normalizeBaseUrl('https://api.example.com/api/v1/', '/api/v1')).toBe(
      'https://api.example.com/api/v1',
    )
    expect(normalizeBaseUrl(undefined, '/api/v1')).toBe('/api/v1')
  })

  it('稳定拼接绝对和相对地址', () => {
    expect(joinUrl('https://img.example.com/api/v1/files/images/', '/019abc')).toBe(
      'https://img.example.com/api/v1/files/images/019abc',
    )
    expect(joinUrl('/api/v1', 'files/images')).toBe('/api/v1/files/images')
  })

  it('后端服务器地址自动补全 API 路径', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe('https://api.example.com/api/v1')
    expect(resolveApiBaseUrl('https://api.example.com/api/v1')).toBe(
      'https://api.example.com/api/v1',
    )
  })

  it('图床服务器地址自动补全图片接口路径', () => {
    expect(resolveImageBaseUrl('https://img.example.com', '/api/v1')).toBe(
      'https://img.example.com/api/v1/files/images',
    )
    expect(resolveImageBaseUrl(undefined, 'https://api.example.com/api/v1')).toBe(
      'https://api.example.com/api/v1/files/images',
    )
  })

  it('把 public 资源按构建 base 拼成路径', () => {
    // 根路径部署：与原来的 '/logo.png' 一致，不引入行为变化
    expect(publicUrl('logo.png', '/')).toBe('/logo.png')
    // 子路径部署（演示站）：必须带上前缀，否则会去站点根找资源
    expect(publicUrl('logo.png', '/Electrical-Manager/demo/')).toBe(
      '/Electrical-Manager/demo/logo.png',
    )
    // 容错：路径前后多余的斜杠
    expect(publicUrl('/logo.png', '/Electrical-Manager/demo')).toBe(
      '/Electrical-Manager/demo/logo.png',
    )
  })

  it('生成带令牌的绝对 MCP 地址', () => {
    expect(resolveMcpUrl('/api/v1', 'token-value', null, 'https://app.example.com')).toBe(
      'https://app.example.com/api/v1/mcp/?token=token-value',
    )
    expect(
      resolveMcpUrl('https://api.example.com/api/v1', 'a+b/c', null, 'https://app.example.com'),
    ).toBe('https://api.example.com/api/v1/mcp/?token=a%2Bb%2Fc')
  })

  it('MCP 地址带上当前项目 id，未选择项目时不带', () => {
    expect(resolveMcpUrl('/api/v1', 'token-value', 6, 'https://app.example.com')).toBe(
      'https://app.example.com/api/v1/mcp/?token=token-value&project_id=6',
    )
    expect(resolveMcpUrl('/api/v1', 'token-value', null, 'https://app.example.com')).not.toContain(
      'project_id',
    )
  })
})
