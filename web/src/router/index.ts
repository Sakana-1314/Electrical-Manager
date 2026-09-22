import { createRouter, createWebHistory } from 'vue-router'
import type { Permission } from '@/types/navigation'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { resolveLandingRouteName } from '@/utils/navigation'

declare module 'vue-router' {
  interface RouteMeta {
    /** 顶栏面包屑与浏览器标题里展示的页面名（详情页同样用这个短名） */
    title?: string
    /**
     * 上一级标题：桌面端顶栏面包屑按「上级 / 当前」展示，移动端只展示当前标题（宽度不够）。
     * 二级条目用所属菜单分组名（二级库 / 申购管理 / 系统管理），详情页与操作页用所属列表页标题，
     * 让「当前在哪、能返回哪里」一眼可读。
     * 顶级条目（工作台、备忘录、二级库、华星总库存）不设本字段：顶栏不再挂「备件管理」这类根名称，
     * 页面只展示自己的标题，只有二级菜单才展示两级。
     */
    parent?: string
    permission?: Permission
    public?: boolean
    keepAlive?: boolean
  }
}

/** 完整模式二级库的路由：精简模式下统一重定向到精简视图 */
const FULL_WAREHOUSE_ROUTES = new Set([
  'stock-materials',
  'stock-material-detail',
  'inbound',
  'outbound',
  'stock',
  'operations',
  'operation-detail',
])

/**
 * 落地页：当前可见的第一个主 tab（高级设置的「后台可见功能」可关闭主 tab）。
 * 工作台被关掉后不能还往 `/dashboard` 跳，否则用户一进来就落在侧栏里没有入口的页面；
 * 可见性只影响渲染，不做路由拦截，被关闭的页面仍可直达。
 */
function landingRoute() {
  const settings = useSettingsStore()
  return {
    name: resolveLandingRouteName(settings.webFeatures, { isLiteMode: settings.isLiteMode }),
  }
}

const router = createRouter({
  // import.meta.env.BASE_URL 即 vite 的 base（默认 '/'，子路径部署时为该前缀），
  // 路由随之生成正确前缀，代码里无需硬编码部署路径。
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      redirect: () => landingRoute(),
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/dashboard/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'memos',
          name: 'memos',
          component: () => import('@/views/MemosView.vue'),
          meta: { title: '备忘录' },
        },
        {
          path: 'warehouse/materials',
          name: 'stock-materials',
          component: () => import('@/views/warehouse/StockMaterialsView.vue'),
          meta: { title: '物资档案', parent: '二级库' },
        },
        {
          path: 'warehouse/materials/:id',
          name: 'stock-material-detail',
          component: () => import('@/views/warehouse/StockMaterialDetailView.vue'),
          meta: { title: '物资详情', parent: '物资档案' },
        },
        {
          path: 'warehouse/inbound',
          name: 'inbound',
          component: () => import('@/views/warehouse/OperationEditorView.vue'),
          props: { operationType: 'INBOUND' },
          meta: { title: '入库', parent: '二级库', permission: 'warehouse:write' },
        },
        {
          path: 'warehouse/outbound',
          name: 'outbound',
          component: () => import('@/views/warehouse/OperationEditorView.vue'),
          props: { operationType: 'OUTBOUND' },
          meta: { title: '出库', parent: '二级库', permission: 'warehouse:write' },
        },
        {
          path: 'warehouse/stock',
          name: 'stock',
          component: () => import('@/views/warehouse/StockView.vue'),
          meta: { title: '库存查询', parent: '二级库' },
        },
        {
          path: 'warehouse/hua-xing-stock',
          name: 'hua-xing-stock',
          component: () => import('@/views/warehouse/HuaXingStockView.vue'),
          meta: { title: '华星总库存' },
        },
        {
          path: 'warehouse/lite',
          name: 'warehouse-lite',
          component: () => import('@/views/warehouse/SecondaryWarehouseLiteView.vue'),
          meta: { title: '二级库' },
        },
        {
          path: 'warehouse/operations',
          name: 'operations',
          component: () => import('@/views/warehouse/OperationsView.vue'),
          meta: { title: '操作记录', parent: '二级库' },
        },
        {
          path: 'warehouse/operations/:id',
          name: 'operation-detail',
          component: () => import('@/views/warehouse/OperationDetailView.vue'),
          meta: { title: '流水详情', parent: '操作记录' },
        },
        {
          path: 'procurement/materials',
          name: 'purchase-materials',
          component: () => import('@/views/procurement/PurchaseMaterialsView.vue'),
          meta: { title: '申购计划', parent: '申购管理', keepAlive: true },
        },
        {
          path: 'procurement/materials/:id',
          name: 'purchase-material-detail',
          component: () => import('@/views/procurement/PurchaseMaterialDetailView.vue'),
          meta: { title: '申购计划详情', parent: '申购计划' },
        },
        {
          path: 'procurement/purchase-plan-templates',
          name: 'purchase-plan-templates',
          component: () => import('@/views/procurement/PurchasePlanTemplatesView.vue'),
          meta: { title: '周期性计划', parent: '申购管理', keepAlive: true },
        },
        {
          path: 'procurement/uncoded-materials',
          name: 'uncoded-materials',
          component: () => import('@/views/procurement/UncodedMaterialsView.vue'),
          meta: { title: '未编码物资', parent: '申购管理' },
        },
        {
          path: 'procurement/material-code-library',
          name: 'material-code-library',
          component: () => import('@/views/procurement/MaterialCodeLibraryView.vue'),
          meta: { title: '物料编码库', parent: '申购管理' },
        },
        {
          path: 'procurement/records',
          name: 'purchase-records',
          component: () => import('@/views/procurement/PurchaseRequestsView.vue'),
          meta: { title: '申购记录', parent: '申购管理', keepAlive: true },
        },
        {
          path: 'procurement/records/:id',
          name: 'purchase-record-detail',
          component: () => import('@/views/procurement/PurchaseRequestDetailView.vue'),
          meta: { title: '申购记录详情', parent: '申购记录' },
        },
        {
          path: 'hazards',
          name: 'hazard-records',
          component: () => import('@/views/hazard/HazardRecordsView.vue'),
          meta: { title: '隐患管理', parent: '隐患管理', keepAlive: true },
        },
        {
          path: 'hazard-types',
          name: 'hazard-types',
          component: () => import('@/views/hazard/HazardTypesView.vue'),
          meta: { title: '隐患类型', parent: '隐患管理' },
        },
        {
          path: 'hazard-units',
          name: 'hazard-units',
          component: () => import('@/views/hazard/HazardUnitsView.vue'),
          meta: { title: '责任单位', parent: '隐患管理' },
        },
        {
          path: 'ledger/items',
          name: 'ledger-items',
          component: () => import('@/views/ledger/LedgerItemsView.vue'),
          meta: { title: '台账总览', parent: '台账管理', keepAlive: true },
        },
        {
          path: 'ledger/tags',
          name: 'ledger-tags',
          component: () => import('@/views/ledger/LedgerTagsView.vue'),
          meta: { title: '标签管理', parent: '台账管理' },
        },
        {
          path: 'work/overview',
          name: 'work-overview',
          component: () => import('@/views/work/WorkOverviewView.vue'),
          meta: { title: '工作总览', parent: '工作管理', keepAlive: true },
        },
        {
          path: 'work/tasks',
          name: 'work-tasks',
          component: () => import('@/views/work/WorkTasksView.vue'),
          meta: { title: '任务视图', parent: '工作管理', keepAlive: true },
        },
        {
          path: 'work/workers',
          name: 'work-workers',
          component: () => import('@/views/work/WorkWorkersView.vue'),
          meta: { title: '人员视图', parent: '工作管理', keepAlive: true },
        },
        {
          path: 'settings/advanced',
          name: 'advanced-settings',
          component: () => import('@/views/settings/AdvancedSettingsView.vue'),
          meta: { title: '高级设置', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/ai-search',
          redirect: { name: 'advanced-settings' },
        },
        {
          path: 'settings/projects',
          name: 'projects',
          component: () => import('@/views/settings/ProjectsView.vue'),
          meta: { title: '项目管理', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/users',
          name: 'users',
          component: () => import('@/views/settings/UsersView.vue'),
          meta: { title: '管理端用户', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/mini-program-users',
          name: 'mini-program-users',
          component: () => import('@/views/settings/MiniProgramUsersView.vue'),
          meta: { title: '小程序用户', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/attachments',
          name: 'attachments',
          component: () => import('@/views/settings/AttachmentsView.vue'),
          meta: { title: '附件管理', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/about',
          name: 'about',
          component: () => import('@/views/settings/AboutView.vue'),
          meta: { title: '关于', parent: '系统管理', permission: 'settings:write' },
        },
        {
          path: 'settings/share-links',
          name: 'share-links',
          component: () => import('@/views/settings/ShareLinksView.vue'),
          meta: { title: '分享链接', parent: '系统管理', permission: 'settings:write' },
        },
      ],
    },
    {
      path: '/share/:token',
      name: 'share',
      component: () => import('@/views/public/ShareView.vue'),
      meta: { public: true, title: '分享预览' },
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { public: true, title: '页面不存在' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // 浏览器标题带上级路径（如「申购管理 / 申购记录 - HXNI 电气无忧」），与顶栏面包屑同一套元信息
  const pageTitle = to.meta.parent
    ? `${to.meta.parent} / ${to.meta.title || '系统'}`
    : to.meta.title
  document.title = `${pageTitle || '系统'} - HXNI 电气无忧`
  if (!to.meta.public && !auth.isAuthenticated)
    return { name: 'login', query: { redirect: to.fullPath } }
  if (to.name === 'login' && auth.isAuthenticated) return landingRoute()
  // 业务请求都要带 X-Project-Id：进入受保护页面前先确保当前项目已解析出来
  // （拉取失败保持未加载，不拦导航，本次由后端按 PROJECT_REQUIRED / PROJECT_NOT_FOUND 提示）
  if (!to.meta.public) await useProjectStore().ensureLoaded()
  if (to.meta.permission && !auth.can(to.meta.permission)) return landingRoute()
  // 二级库精简模式下，完整模式仓库路由不可访问，统一重定向到精简视图。
  if (useSettingsStore().isLiteMode && to.name && FULL_WAREHOUSE_ROUTES.has(String(to.name))) {
    return { name: 'warehouse-lite' }
  }
})

export default router
