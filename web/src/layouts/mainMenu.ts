import { h, type Component as VueComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { NIcon, type MenuOption } from 'naive-ui'
import {
  CalendarOutline,
  CartOutline,
  DocumentTextOutline,
  FileTrayStackedOutline,
  GridOutline,
  LayersOutline,
  LibraryOutline,
  SettingsOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import type { Permission } from '@/types/navigation'
import { visibleNavFeatureKeys, type NavFeatureKey } from '@/utils/navigation'

/**
 * 后台侧栏一级菜单（主 tab）拼装。
 *
 * 从 `AppLayout.vue` 抽出来便于单测（沿用 `appearanceMenu.ts` / `projectMenu.ts` 的做法）：
 * 结构、图标与“哪些项该出现”都是纯逻辑，不需要挂载布局组件。
 *
 * 一级项的可见性来自用户权限位（`utils/navigation.ts` 的 `NAV_FEATURES` 定义顺序与读权限）：
 * 没有对应模块读权限的项**整个分组**不渲染。工作台 / 备忘录不设门禁，始终显示。
 * 系统管理按 `system:admin` 权限判断，保证高级设置本身能从侧栏进入。
 */
export interface MainMenuContext {
  can: (permission: Permission) => boolean
  /** 点击菜单项后收起移动端抽屉 */
  onNavigate?: () => void
}

/** 统一用组件库图标（Naive UI 的 NIcon + @vicons/ionicons5），尺寸与居中由 n-menu 控制。 */
const renderIcon = (icon: VueComponent) => () => h(NIcon, null, { default: () => h(icon) })

/**
 * 导航项：一级项给 icon，二级项不给——侧栏折叠时只显示一级图标，
 * 二级项图标永远看不到，加了只是多余噪音（展开态也靠缩进区分层级）。
 */
export function buildMainMenu(context: MainMenuContext): MenuOption[] {
  const link = (label: string, name: string, icon?: VueComponent): MenuOption => ({
    label: () =>
      h(RouterLink, { to: { name }, onClick: context.onNavigate }, { default: () => label }),
    key: name,
    ...(icon ? { icon: renderIcon(icon) } : {}),
  })

  /** 一级项定义：key 决定是否渲染（权限位），build 产出该项（单个链接或分组）。 */
  const visibleSections = new Set<NavFeatureKey>(visibleNavFeatureKeys(context.can))
  const sections: Array<{ key: NavFeatureKey; build: () => MenuOption }> = [
    { key: 'dashboard', build: () => link('工作台', 'dashboard', GridOutline) },
    { key: 'memos', build: () => link('备忘录', 'memos', DocumentTextOutline) },
    {
      key: 'warehouse',
      build: () => ({
        label: '二级库',
        key: 'warehouse-group',
        icon: renderIcon(FileTrayStackedOutline),
        children: [
          link('库存查询', 'stock'),
          link('物资档案', 'stock-materials'),
          link('操作记录', 'operations'),
          ...(context.can('warehouse:write')
            ? [link('入库', 'inbound'), link('出库', 'outbound')]
            : []),
        ],
      }),
    },
    {
      // 精简二级库：独立权限位（lite:read），Excel 导入 + 只读查询，与标准二级库互不依赖。
      key: 'warehouse_lite',
      build: () => link('二级库', 'warehouse-lite', FileTrayStackedOutline),
    },
    {
      key: 'huaxing_inventory',
      build: () => link('华星总库存', 'hua-xing-stock', LayersOutline),
    },
    {
      key: 'procurement',
      build: () => ({
        label: '申购管理',
        key: 'procurement-group',
        icon: renderIcon(CartOutline),
        children: [
          link('申购计划', 'purchase-materials'),
          link('周期性计划', 'purchase-plan-templates'),
          link('未编码物资', 'uncoded-materials'),
          link('物料编码库', 'material-code-library'),
          link('申购记录', 'purchase-records'),
        ],
      }),
    },
    {
      // 隐患管理：读取对所有登录用户开放，因此菜单不做权限过滤（写操作在页面内按权限隐藏）。
      key: 'hazards',
      build: () => ({
        label: '隐患管理',
        key: 'hazard-group',
        icon: renderIcon(WarningOutline),
        children: [
          link('隐患管理', 'hazard-records'),
          link('隐患类型', 'hazard-types'),
          link('责任单位', 'hazard-units'),
        ],
      }),
    },
    {
      // 台账管理：同样读取开放，菜单不做权限过滤；第一个子 tab 是台账总览。
      key: 'ledger',
      build: () => ({
        label: '台账管理',
        key: 'ledger-group',
        icon: renderIcon(LibraryOutline),
        children: [link('台账总览', 'ledger-items'), link('标签管理', 'ledger-tags')],
      }),
    },
    {
      // 工作管理：三个子 tab 都是读取开放（写操作在页面内按 work:write 隐藏）。
      key: 'work',
      build: () => ({
        label: '工作管理',
        key: 'work-group',
        icon: renderIcon(CalendarOutline),
        children: [
          link('工作总览', 'work-overview'),
          link('任务视图', 'work-tasks'),
          link('人员视图', 'work-workers'),
        ],
      }),
    },
  ]

  const items = sections
    .filter((section) => visibleSections.has(section.key))
    .map((section) => section.build())

  // 系统管理：按 system:admin 权限位显示（与各功能读权限平级，不再是独立「超级管理员角色」）。
  if (context.can('system:admin'))
    items.push({
      label: '系统管理',
      key: 'settings-group',
      icon: renderIcon(SettingsOutline),
      children: [
        link('用户管理', 'users'),
        link('项目管理', 'projects'),
        link('附件管理', 'attachments'),
        link('高级设置', 'advanced-settings'),
        link('分享链接', 'share-links'),
        link('关于', 'about'),
      ],
    })

  return items
}
