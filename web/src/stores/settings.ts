import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { systemSettingsApi } from '@/api/systemSettings'
import type { SecondaryWarehouseMode, WebFeatureVisibility } from '@/api/generated'
import {
  ALL_NAV_FEATURES_VISIBLE,
  isNavFeatureVisible,
  type NavFeatureKey,
} from '@/utils/navigation'

/**
 * 全局系统模式与后台可见性（公开配置端点在启动时拉取，供菜单/路由守卫在首次导航前同步读取）。
 * - 二级库精简模式下：后台「二级库」tab 变为单一一级 tab（Excel 导入 + 只读查询）；
 * - `webFeatures` 决定侧栏一级菜单（主 tab）是否渲染，`isFeatureVisible()` 全项目共用一份判断；
 *   拉取失败或响应缺字段时回落「全部可见」，不因一次网络失败把功能藏起来。
 */
export const useSettingsStore = defineStore('settings', () => {
  const secondaryWarehouseMode = ref<SecondaryWarehouseMode>('full')
  const isLiteMode = computed(() => secondaryWarehouseMode.value === 'lite')
  const webFeatures = ref<WebFeatureVisibility>({ ...ALL_NAV_FEATURES_VISIBLE })
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    try {
      const features = await systemSettingsApi.miniProgramFeatures()
      secondaryWarehouseMode.value = features.secondary_warehouse_mode
      webFeatures.value = features.web_features ?? { ...ALL_NAV_FEATURES_VISIBLE }
    } catch {
      // 拉取失败回退完整模式 + 全部可见，保证现有功能不受影响
      secondaryWarehouseMode.value = 'full'
      webFeatures.value = { ...ALL_NAV_FEATURES_VISIBLE }
    } finally {
      loaded.value = true
    }
  }

  /** 侧栏一级菜单（主 tab）是否可见；系统管理不在可见性开关内，不走这里。 */
  function isFeatureVisible(key: NavFeatureKey) {
    return isNavFeatureVisible(webFeatures.value, key)
  }

  return { secondaryWarehouseMode, isLiteMode, webFeatures, isFeatureVisible, loaded, load }
})
