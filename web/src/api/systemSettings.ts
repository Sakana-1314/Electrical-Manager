import { apiClient } from './client'
import type { AdvancedSettings, AdvancedSettingsWrite, MiniProgramFeatures } from './generated'

export const systemSettingsApi = {
  // 3000ms 探针都在启动路径上：刻意快速失败、不回退重试，避免弱网下拖住首屏。
  miniProgramFeatures: () =>
    apiClient
      .get<MiniProgramFeatures>('/system-settings/mini-program-features', {
        timeout: 3000,
        retry: false,
      })
      .then((response) => response.data),
  advancedSettings: () =>
    apiClient.get<AdvancedSettings>('/system-settings/advanced-settings').then((r) => r.data),
  updateAdvancedSettings: (data: AdvancedSettingsWrite) =>
    apiClient.put<AdvancedSettings>('/system-settings/advanced-settings', data).then((r) => r.data),
}
