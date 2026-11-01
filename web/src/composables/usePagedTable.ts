import { getCurrentInstance, onActivated, onMounted, reactive, ref, type Ref } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useMessage } from 'naive-ui'
import { compactRouteQuery, routeQueryPositiveInteger, routeQueryString } from '@/utils/routeQuery'
import type { Page } from '@/api/generated'

/** 传给 fetch 的分页状态（由 composable 合成，调用方据此构造 typed query） */
export interface PagedFetchParams {
  page: number
  page_size: number
}

/** URL 同步配置：分页与筛选写入 URL，可从 URL 恢复（KeepAlive 页用） */
export interface UsePagedTableUrlSync<F extends object> {
  /** router.replace 的目标路由 name */
  routeName: string
  /** 把筛选状态序列化为 URL query；空值交给 compactRouteQuery 压缩 */
  toQuery: (filters: F) => Record<string, string | number | null | undefined>
  /** 首次挂载时从路由 query 恢复筛选状态 */
  fromQuery: (route: RouteLocationNormalizedLoaded) => F
  /**
   * 不属于筛选状态、但必须原样留在 URL 里的参数名（如详情弹窗的 `detail`）。
   *
   * `syncRoute` 是整体替换 query，不声明就会被翻页 / 筛选 / onActivated 重写冲掉。
   * 这些值**每次从当前 `route.query` 实时读**而不是从本地 ref 推导：keepAlive 列表页被
   * 重新导航进来（只触发 onActivated）时，从本地状态推导会把刚写进来的 `detail` 又抹掉。
   * 不传时行为与现状完全一致。
   */
  preservedQueryKeys?: string[]
}

/** usePagedTable 选项 */
export interface UsePagedTableOptions<T, F extends object> {
  /**
   * 分页查询函数，由调用方提供（不同页面调不同 API）。
   * 第一个参数是 reactive 的筛选状态，第二个是合成好的 page/page_size。
   * 调用方在此构造 typed 查询对象并调 typed API 方法。
   */
  fetch: (filters: F, pager: PagedFetchParams) => Promise<Page<T>>
  /** 初始筛选状态工厂：reactive 化；resetFilters 时再次调用以恢复空值（返回全新对象） */
  initialFilters: () => F
  /**
   * 加载失败回调；缺省时在组件内用全局消息提示错误原因（组件外调用时静默）。
   * 列表加载失败若不提示，页面只会显示「暂无数据」，用户会误以为真的没有记录。
   */
  onError?: (error: unknown) => void
  /** 每次成功加载后回调（清空已选行等） */
  onLoaded?: (data: Page<T>) => void
  /** query() 最前执行的回调（组 B 用于 clearExpandedName） */
  beforeQuery?: () => void
  /** 防空页回退：加载后 items 为空且 page>1 时自动退一页重载 */
  rollbackEmptyPage?: boolean
  /** 是否分页模式；false 时固定 page_size 全量拉取（组 D），默认 true */
  paginated?: boolean
  /** 默认每页条数，默认 20 */
  defaultPageSize?: number
  /** URL 同步；开启后 page/pageSize 从 URL 恢复、用户操作后写回 URL、onActivated 时重写 */
  urlSync?: UsePagedTableUrlSync<F>
  /** 是否挂载后立即加载，默认 true */
  immediate?: boolean
  /** 分页器可选每页条数，默认 [10, 20, 50, 100, 200] */
  pageSizeOptions?: number[]
}

/** usePagedTable 返回值 */
export interface UsePagedTable<T, F extends object> {
  items: Ref<T[]>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  loading: Ref<boolean>
  /** 最近一次加载的错误；成功加载后清空，页面可据此区分「加载失败」与「确实为空」 */
  error: Ref<unknown>
  /** reactive 代理，直接用于模板 v-model 与 fetch 读取 */
  filters: F
  pageSizeOptions: number[]
  load: () => Promise<void>
  query: () => Promise<void>
  changePage: (nextPage?: number) => Promise<void>
  changePageSize: (nextPageSize?: number) => Promise<void>
  resetFilters: () => Promise<void>
  /** 无 urlSync 时为空操作；供 AI 查询等自定义路径复用 */
  syncRoute: () => Promise<void>
}

/**
 * 统一列表分页/加载/筛选/URL 同步逻辑，消除各列表页的重复代码。
 *
 * 设计约定：
 * - fetch 接收 (filters, pager)，由调用方在闭包内构造 typed query（见各 api 模块 XxxListQuery）。
 * - urlSync 开启时，page/pageSize/filters 从 URL 恢复，操作后写回 URL，onActivated 重写（KeepAlive）。
 * - 不传 onError 时在组件内默认弹出错误消息（组件外调用时静默）。
 * - 只采纳最后一次发起的请求结果：快速翻页 / 连续筛选时，先发出、后返回的旧响应直接丢弃，
 *   不会把旧页数据盖到新页码上，也不会提前把 loading 置为 false。
 */
function defaultErrorNotifier(): ((error: unknown) => void) | undefined {
  // useMessage 依赖组件上下文里的 n-message-provider；单测等组件外调用直接静默。
  if (!getCurrentInstance()) return undefined
  try {
    const message = useMessage()
    return (error) =>
      message.error(error instanceof Error && error.message ? error.message : '列表加载失败')
  } catch {
    return undefined
  }
}

export function usePagedTable<T, F extends object>(
  options: UsePagedTableOptions<T, F>,
): UsePagedTable<T, F> {
  const {
    fetch,
    initialFilters,
    onError = defaultErrorNotifier(),
    onLoaded,
    beforeQuery,
    rollbackEmptyPage = false,
    paginated = true,
    defaultPageSize = 20,
    urlSync,
    immediate = true,
    pageSizeOptions = [10, 20, 50, 100, 200],
  } = options

  // 仅 urlSync 页面才需要路由上下文（useRoute/useRouter 必须在 setup 期调用）
  const route = urlSync ? useRoute() : null
  const router = urlSync ? useRouter() : null

  const page = ref(urlSync ? routeQueryPositiveInteger(route!.query.page, 1) : 1)
  const pageSize = ref(
    urlSync ? routeQueryPositiveInteger(route!.query.page_size, defaultPageSize) : defaultPageSize,
  )
  // reactive() 返回 UnwrapNestedRefs<F>，与 F 不完全同构；这里保持外部类型为 F，
  // 内部按 F 语义使用（filters 各字段仍是响应式的，reactive 代理透传读写）。
  const filters = reactive<F>(urlSync ? (urlSync.fromQuery(route!) as F) : initialFilters()) as F

  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const loading = ref(false)
  const error = ref<unknown>(null)
  /** 请求序号：只有最新一次 load 的结果会写回状态 */
  let requestSeq = 0

  /** 本地分页 + 筛选状态对应的 URL 参数（不含 preservedQueryKeys） */
  function stateQuery(): Record<string, string> {
    return compactRouteQuery({
      page: page.value === 1 ? undefined : page.value,
      page_size: pageSize.value === defaultPageSize ? undefined : pageSize.value,
      ...urlSync!.toQuery(filters),
    })
  }

  async function syncRoute() {
    if (!urlSync || !router || !route) return
    // 从当前 URL 实时读回要保留的参数（如详情弹窗的 detail）：不能用本地 ref，
    // 否则 keepAlive 页面重新激活时会把刚导航进来的参数抹掉。
    const preserved: Record<string, string | undefined> = {}
    for (const key of urlSync.preservedQueryKeys ?? []) {
      preserved[key] = routeQueryString(route.query[key]) || undefined
    }
    await router.replace({
      name: urlSync.routeName,
      query: compactRouteQuery({ ...stateQuery(), ...preserved }),
    })
  }

  /**
   * keepAlive 页重新激活时，URL 上带着一组与本地状态不同的筛选参数 → 这是一次「带条件的直达」
   * （工作台指标卡、低库存「查看全部」、别的页面跳过来的链接），按 URL 恢复并重新查询；
   * URL 上没有筛选参数（侧栏点回来）→ 维持原行为，把本地状态写回 URL，列表保持离开时的样子。
   * 原来一律走后者，已访问过的列表页会把直达链接里的条件直接改写掉。
   */
  let activatedOnce = false
  function adoptRouteIfNavigatedWithFilters(): boolean {
    if (!urlSync || !route) return false
    // 首次激活紧跟挂载：状态本来就是从 URL 恢复的，只需按原行为把规范化结果写回 URL
    if (!activatedOnce) {
      activatedOnce = true
      return false
    }
    // create：页面自己消费的一次性动作参数（工作台快捷入口「新建」），不是筛选条件
    const ignored = new Set([...(urlSync.preservedQueryKeys ?? []), 'create'])
    const incoming = Object.entries(route.query).filter(([key]) => !ignored.has(key))
    if (!incoming.length) return false
    const current = stateQuery()
    const same =
      incoming.length === Object.keys(current).length &&
      incoming.every(([key, value]) => current[key] === routeQueryString(value))
    if (same) return false
    Object.assign(filters, urlSync.fromQuery(route))
    page.value = routeQueryPositiveInteger(route.query.page, 1)
    pageSize.value = routeQueryPositiveInteger(route.query.page_size, defaultPageSize)
    void load()
    return true
  }

  async function load() {
    const seq = ++requestSeq
    loading.value = true
    try {
      const data = await fetch(
        filters,
        paginated
          ? { page: page.value, page_size: pageSize.value }
          : { page: 1, page_size: pageSize.value },
      )
      if (seq !== requestSeq) return
      items.value = data.items
      total.value = data.total
      error.value = null
      onLoaded?.(data)
      // 防空页回退：退页后重载，page 收敛到 1 时递归必然终止；URL 里的页码同步回退
      if (rollbackEmptyPage && paginated && data.items.length === 0 && page.value > 1) {
        page.value -= 1
        if (urlSync) await syncRoute()
        await load()
      }
    } catch (caught) {
      if (seq !== requestSeq) return
      error.value = caught
      onError?.(caught)
    } finally {
      if (seq === requestSeq) loading.value = false
    }
  }

  async function query() {
    beforeQuery?.()
    page.value = 1
    if (urlSync) await syncRoute()
    await load()
  }

  async function changePage(nextPage?: number) {
    if (nextPage !== undefined) page.value = nextPage
    if (urlSync) await syncRoute()
    await load()
  }

  async function changePageSize(nextPageSize?: number) {
    if (nextPageSize !== undefined) pageSize.value = nextPageSize
    page.value = 1
    if (urlSync) await syncRoute()
    await load()
  }

  async function resetFilters() {
    Object.assign(filters, initialFilters())
    await query()
  }

  if (urlSync)
    onActivated(() => {
      if (!adoptRouteIfNavigatedWithFilters()) void syncRoute()
    })
  if (immediate) onMounted(() => void load())

  return {
    items,
    total,
    page,
    pageSize,
    loading,
    error,
    filters,
    pageSizeOptions,
    load,
    query,
    changePage,
    changePageSize,
    resetFilters,
    syncRoute,
  }
}
