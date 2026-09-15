import { apiClient } from './client'
import type {
  ImageAccelerationSettings,
  MiniProgramFeatures,
  WebhookChannelSettings,
  WebhookChannelSettingsWrite,
  WebhookPlatform,
  WebhookTestInput,
  WebhookTestResult,
} from './generated'

export const systemSettingsApi = {
  // 两个 3000ms 探针都在启动路径上（main.ts 先取图片加速、再等二级库模式，之后才 mount 首屏），
  // 各自带回退值：刻意快速失败，不参与弱网重试，否则弱网下要等满 3 次才渲染界面。
  imageAcceleration: () =>
    apiClient
      .get<ImageAccelerationSettings>('/system-settings/image-acceleration', {
        timeout: 3000,
        retry: false,
      })
      .then((response) => response.data),
  miniProgramFeatures: () =>
    apiClient
      .get<MiniProgramFeatures>('/system-settings/mini-program-features', {
        timeout: 3000,
        retry: false,
      })
      .then((response) => response.data),
  webhooks: () =>
    apiClient
      .get<WebhookChannelSettings[]>('/system-settings/webhooks')
      .then((response) => response.data),
  updateWebhook: (platform: WebhookPlatform, data: WebhookChannelSettingsWrite) =>
    apiClient
      .put<WebhookChannelSettings>(`/system-settings/webhooks/${platform}`, data)
      .then((response) => response.data),
  testWebhook: (platform: WebhookPlatform, data: WebhookTestInput) =>
    apiClient
      .post<WebhookTestResult>(`/system-settings/webhooks/${platform}/test`, data)
      .then((response) => response.data),
}
