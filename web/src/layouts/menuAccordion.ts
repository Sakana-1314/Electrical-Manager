/**
 * 左侧导航折叠分组的「手风琴」逻辑（纯函数，便于单测）。
 *
 * 同一时刻只允许展开一个分组：用户点开第二个分组时，前一个自动收起；
 * 收起当前分组时不再展开别的。菜单自身的 `expanded-keys` 是「当前所有展开项」的数组，
 * 这里只负责把它收敛成最多一项。
 */
export interface MenuLikeOption {
  key?: string | number
  children?: MenuLikeOption[]
}

/** 计算下一次应展开的分组：新增了哪个就只留哪个；只是收起时保留剩余（至多一个）。 */
export function accordionExpandedKeys(
  previous: readonly string[],
  next: readonly string[],
): string[] {
  const added = next.filter((key) => !previous.includes(key))
  if (added.length) return [added[added.length - 1]]
  return next.slice(-1)
}

/** 找到当前路由页所在的折叠分组（用于进入页面时自动展开该组）。 */
export function groupKeyForRoute(
  options: readonly MenuLikeOption[],
  routeName?: string | null,
): string | null {
  if (!routeName) return null
  for (const option of options) {
    if (option.children?.some((child) => String(child.key) === routeName))
      return option.key == null ? null : String(option.key)
  }
  return null
}
