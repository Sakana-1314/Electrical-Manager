import { apiClient } from './client'
import type { Memo, MemoCreate, MemoUpdate } from './generated'

/** 管理端个人备忘录：纯文本记录，左侧列表切换多条、右侧单编辑区（按登录用户隔离）。 */
export const memoApi = {
  /** 当前用户的全部备忘录，最近更新的排前面。 */
  listMemos: () => apiClient.get<Memo[]>('/memos').then((r) => r.data),
  /** 新建一条备忘录（title 为空时后端回退为「未命名备忘录」）。 */
  createMemo: (payload: MemoCreate = { title: '', content: '' }) =>
    apiClient.post<Memo>('/memos', payload).then((r) => r.data),
  /** 更新标题 / 内容（乐观锁：version 必须与当前一致）。 */
  updateMemo: (id: number, payload: MemoUpdate) =>
    apiClient.patch<Memo>(`/memos/${id}`, payload).then((r) => r.data),
  /** 删除一条备忘录。 */
  deleteMemo: (id: number) => apiClient.delete(`/memos/${id}`).then((r) => r.data),
}
