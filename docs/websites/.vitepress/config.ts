import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

/**
 * 站点源码在 pages/（srcDir），构建产物在 .vitepress/dist/。
 * base 必须与 GitHub Pages 的仓库路径一致：https://Sakana-1314.github.io/Electrical-Manager/
 *
 * withMermaid 包装配置并注册 mermaid：文档里的 ```mermaid 代码块会渲染成图
 * （不包装时只会显示成带高亮的代码块）。开发资料各页的状态机、时序图、ER 图都依赖它。
 */
export default withMermaid(
  defineConfig({
    base: '/Electrical-Manager/',
    srcDir: 'pages',
    lang: 'zh-CN',
    title: 'HXNI 电气无忧',
    // 导航左侧已显示站点名，页面标题不必再带一遍：「页面名 | 站点名」是冗余。
    // 首页在 index.md 的 frontmatter 里单独指定完整标题。
    titleTemplate: ':title',
    description: '华星镍业电气车间业务管理系统：库存、申购、请购与到货、采购跟踪一体化，配套扫码出库小程序与 AI 接口。',
    cleanUrls: true,
    head: [
      ['meta', { name: 'theme-color', content: '#2080f0' }],
      ['link', { rel: 'icon', href: '/Electrical-Manager/logo.png' }],
    ],
    lastUpdated: true,
    themeConfig: {
      siteTitle: 'HXNI 电气无忧',
      outline: { level: [2, 3], label: '本页目录' },
      nav: [
        { text: '功能', link: '/features' },
        { text: '部署', link: '/guide' },
        { text: '接口', link: '/api' },
        { text: '系统设计', link: '/dev-data-model' },
      ],
      sidebar: [
        {
          text: '入门',
          items: [
            { text: '首页', link: '/' },
            { text: '功能总览', link: '/features' },
            { text: '部署指南', link: '/guide' },
            { text: '在线演示', link: '/demo' },
          ],
        },
        {
          text: '接口',
          items: [
            { text: '接口约定', link: '/api-conventions' },
            { text: '接口文档', link: '/api' },
            { text: '错误码总表', link: '/api-error-codes' },
          ],
        },
        {
          text: '系统设计',
          collapsed: false,
          items: [
            { text: '数据模型', link: '/dev-data-model' },
            { text: '状态机', link: '/dev-state-machines' },
            { text: '数据流', link: '/dev-flows' },
            { text: '架构设计', link: '/dev-architecture' },
            { text: 'UI 设计', link: '/ui-design-guidelines' },
          ],
        },
      ],
      docFooter: { prev: '上一篇', next: '下一篇' },
      darkModeSwitchLabel: '主题',
      returnToTopLabel: '回到顶部',
      sidebarMenuLabel: '目录',
      lastUpdatedText: '最后更新',
      search: {
        provider: 'local',
        options: {
          translations: {
            button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
            modal: {
              noResultsText: '未找到相关结果',
              resetButtonTitle: '清除查询条件',
              footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
            },
          },
        },
      },
      footer: {
        message: '本系统为华星镍业检修维护部电气自动化车间内部使用',
        copyright: '版权归 Sakana-1314 所有',
      },
      socialLinks: [{ icon: 'github', link: 'https://github.com/Sakana-1314/Electrical-Manager' }],
    },
  }),
)
