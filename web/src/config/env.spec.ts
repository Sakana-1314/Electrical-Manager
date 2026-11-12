import { describe, expect, it } from 'vitest'
import {
  joinUrl,
  normalizeBaseUrl,
  publicUrl,
  resolveApiBaseUrl,
  resolveApiBaseUrls,
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

  it('解析逗号分隔的多后端地址并逐项规范化、去重', () => {
    expect(
      resolveApiBaseUrls(
        ' https://api-a.example.com , https://api-b.example.com/api/v1/ ',
        undefined,
      ),
    ).toEqual(['https://api-a.example.com/api/v1', 'https://api-b.example.com/api/v1'])
    // 同一地址的不同写法去重后只留一条
    expect(
      resolveApiBaseUrls('https://api.example.com,https://api.example.com/', undefined),
    ).toEqual(['https://api.example.com/api/v1'])
  })

  it('多地址变量优先，未配置时兼容旧的单地址变量', () => {
    expect(resolveApiBaseUrls(undefined, 'https://legacy.example.com')).toEqual([
      'https://legacy.example.com/api/v1',
    ])
    expect(resolveApiBaseUrls('', '/api/v1')).toEqual(['/api/v1'])
    expect(resolveApiBaseUrls('https://api-a.example.com', 'https://legacy.example.com')).toEqual([
      'https://api-a.example.com/api/v1',
    ])
  })

  it('地址列表为空（纯空白 / 逗号）时退回缺省地址', () => {
    expect(resolveApiBaseUrls(' , ,', undefined)).toEqual(['/api/v1'])
    expect(resolveApiBaseUrls(undefined, undefined)).toEqual(['/api/v1'])
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

  it('MCP 地址带上当前项目 id 且 project_id 排在 token 之前，未选择项目时不带', () => {
    expect(resolveMcpUrl('/api/v1', 'token-value', 6, 'https://app.example.com')).toBe(
      'https://app.example.com/api/v1/mcp/?project_id=6&token=token-value',
    )
    expect(resolveMcpUrl('/api/v1', 'token-value', null, 'https://app.example.com')).not.toContain(
      'project_id',
    )
  })
})
