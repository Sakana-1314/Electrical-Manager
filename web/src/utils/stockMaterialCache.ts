import type { StockMaterial } from '@/api/generated'
import { inventoryApi } from '@/api/inventory'

/** 默认候选列表的缓存时长：够一张单据里多行选择器共用，又不至于让「当前库存」明显过期 */
const DEFAULT_LIST_TTL_MS = 15_000

let defaultList: { at: number; promise: Promise<StockMaterial[]> } | null = null
const inflightById = new Map<number, Promise<StockMaterial>>()

/** 物资选择器的默认候选（前 200 条）：短时缓存，同一时段多个选择器只发一次请求。 */
export function fetchDefaultStockMaterials(now = Date.now()): Promise<StockMaterial[]> {
  if (defaultList && now - defaultList.at < DEFAULT_LIST_TTL_MS) return defaultList.promise
  const promise = inventoryApi.materials({ page_size: 200 }).then((page) => page.items)
  defaultList = { at: now, promise }
  // 失败不缓存：下一次调用重新请求
  promise.catch(() => {
    if (defaultList?.promise === promise) defaultList = null
  })
  return promise
}

/** 按 id 取物资：只合并同时发出的重复请求，不做时间缓存（详情需要最新库存）。 */
export function fetchStockMaterial(id: number): Promise<StockMaterial> {
  const existing = inflightById.get(id)
  if (existing) return existing
  const promise = inventoryApi.material(id).finally(() => inflightById.delete(id))
  inflightById.set(id, promise)
  return promise
}

/** 出入库等改变库存的操作成功后调用，让下一次打开的选择器拿到最新库存。 */
export function invalidateStockMaterialCache() {
  defaultList = null
}
