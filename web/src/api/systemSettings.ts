import { apiClient } from './client'
import type { AdvancedSettings, AdvancedSettingsWrite } from './generated'

export const systemSettingsApi = {
  advancedSettings: () =>
    apiClient.get<AdvancedSettings>('/system-settings/advanced-settings').then((r) => r.data),
  updateAdvancedSettings: (data: AdvancedSettingsWrite) =>
    apiClient.put<AdvancedSettings>('/system-settings/advanced-settings', data).then((r) => r.data),
}
