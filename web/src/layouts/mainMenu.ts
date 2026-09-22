import { h, type Component as VueComponent } from 'vue'
import { RouterLink } from 'vue-router'
import { NIcon, type MenuOption } from 'naive-ui'
import {
  BusinessOutline,
  CalendarOutline,
  CartOutline,
  CubeOutline,
  DocumentTextOutline,
  GridOutline,
  LibraryOutline,
  SettingsOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import type { Permission } from '@/types/navigation'
import type { NavFeatureKey } from '@/utils/navigation'

/**
 * 后台侧栏一级菜单（主 tab）拼装。
 *
 * 从 `AppLayout.vue` 抽出来便于单测（沿用 `appearanceMenu.ts` / `projectMenu.ts` 的做法）：
 * 结构、图标与“哪些项该出现”都是纯逻辑，不需要挂载布局组件。
 *
 * 一级项的可见性来自高级设置的「后台可见功能」开关（`isFeatureVisible`，由 `utils/navigation.ts`
 * 的 `NAV_FEATURES` 定义顺序与兜底规则）：被隐藏的项**整个分组**不渲染。
 * 系统管理不参与可见性开关，始终显示（仍按 `settings:write` 权限判断），
 * 保证高级设置本身永远能从侧栏进入。
 */
export interface MainMenuContext {
  /** 精简模式下二级库是单一一级项（Excel 导入 + 只读查询），与华星总库存同层级 */
  isLiteMode: boolean
  can: (permission: Permission) => boolean
  isFeatureVisible: (key: NavFeatureKey) => boolean
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

  /** 一级项定义：key 决定是否渲染（可见性开关），build 产出该项（单个链接或分组）。 */
  const sections: Array<{ key: NavFeatureKey; build: () => MenuOption }> = [
    { key: 'dashboard', build: () => link('工作台', 'dashboard', GridOutline) },
    { key: 'memos', build: () => link('备忘录', 'memos', DocumentTextOutline) },
    {
      key: 'warehouse',
      build: () =>
        context.isLiteMode
          ? link('二级库', 'warehouse-lite', CubeOutline)
          : {
              label: '二级库',
              key: 'warehouse-group',
              icon: renderIcon(CubeOutline),
              children: [
                link('库存查询', 'stock'),
                link('物资档案', 'stock-materials'),
                link('操作记录', 'operations'),
                ...(context.can('warehouse:write')
                  ? [link('入库', 'inbound'), link('出库', 'outbound')]
                  : []),
              ],
            },
    },
    {
      key: 'huaxing_inventory',
      build: () => link('华星总库存', 'hua-xing-stock', BusinessOutline),
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
    .filter((section) => context.isFeatureVisible(section.key))
    .map((section) => section.build())

  // 系统管理：不参与「后台可见功能」开关（始终显示），只按权限判断。
  if (context.can('settings:write'))
    items.push({
      label: '系统管理',
      key: 'settings-group',
      icon: renderIcon(SettingsOutline),
      children: [
        link('管理端用户', 'users'),
        link('小程序用户', 'mini-program-users'),
        link('项目管理', 'projects'),
        link('附件管理', 'attachments'),
        link('高级设置', 'advanced-settings'),
        link('分享链接', 'share-links'),
        link('关于', 'about'),
      ],
    })

  return items
}
