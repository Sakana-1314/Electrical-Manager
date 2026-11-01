import { publicUrl } from '@/config/env'

/** 站点 Logo（512px，登录页大图、分享封面）；经 publicUrl 拼接构建 base，子路径部署时也能正确加载。 */
export const LOGO_URL = publicUrl('logo.png')

/** 侧栏 / 抽屉品牌行的小尺寸 Logo（显示 30px，96px 足够覆盖 3 倍屏），只有几 KB。 */
export const LOGO_MARK_URL = publicUrl('logo-96.png')
