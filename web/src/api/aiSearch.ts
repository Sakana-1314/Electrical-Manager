import { apiClient } from './client'
import type { AiSearchExpandResult, AiSearchStatus } from './generated'

/** AI 搜索：模型服务由服务端环境变量配置，前端只用可用状态与搜索词扩展。 */
export const aiSearchApi = {
  expand: (value: string) =>
    apiClient
      .post<AiSearchExpandResult>('/ai-search/expand', { value })
      .then((response) => response.data),
  status: () =>
    apiClient.get<AiSearchStatus>('/ai-search/status').then((response) => response.data),
}
