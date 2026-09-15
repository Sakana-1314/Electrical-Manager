import type { GlobalThemeOverrides } from 'naive-ui'

/**
 * Naive UI 全局主题覆盖（明 / 暗两套）。
 *
 * 维护约定：
 * - 两套覆盖是同一个结构的两个调色板（`createThemeOverrides(palette)`），改动一处即明暗同步生效，
 *   不允许只在浅色里加属性——否则切到深色时该处会掉回 Naive UI 内置值。
 * - 调色板里的品牌语义色（主色 / 成功）与 styles.css 的 `--color-*` 保持一致，
 *   深色档位是浅色档位的提亮版本（深底上保证对比度），不代表新的语义。
 * - 界面外观档位（自动 / 浅色 / 深色）由 `stores/theme.ts` 决定，这里只按传入档位返回覆盖值。
 */
export interface ThemePalette {
  primaryColor: string
  primaryColorHover: string
  primaryColorPressed: string
  successColor: string
  successColorHover: string
  successColorPressed: string
  textColorBase: string
  textColor1: string
  textColor2: string
  textColor3: string
  placeholderColor: string
  dividerColor: string
  borderColor: string
  bodyColor: string
  cardColor: string
  cardBorderColor: string
  tableHeaderColor: string
  tableHeaderTextColor: string
  hoverColor: string
  tableColorHover: string
  boxShadow1: string
  boxShadow2: string
  menuItemColorHover: string
  menuItemColorActive: string
  menuItemColorActiveHover: string
  menuTextColorActive: string
}

const light: ThemePalette = {
  primaryColor: '#3f63d8',
  primaryColorHover: '#5376e4',
  primaryColorPressed: '#3151bd',
  successColor: '#229b6b',
  successColorHover: '#32ad7c',
  successColorPressed: '#198057',
  textColorBase: '#172033',
  textColor1: '#172033',
  textColor2: '#4b5565',
  textColor3: '#7d8798',
  placeholderColor: '#a1a9b7',
  dividerColor: '#edf0f5',
  borderColor: '#e2e7ef',
  bodyColor: '#f4f6fa',
  cardColor: '#ffffff',
  cardBorderColor: '#e7ebf2',
  tableHeaderColor: '#f7f9fc',
  tableHeaderTextColor: '#3d4758',
  hoverColor: '#f3f6ff',
  tableColorHover: '#f4f7ff',
  boxShadow1: '0 8px 24px rgba(15, 23, 42, 0.05)',
  boxShadow2: '0 14px 36px rgba(15, 23, 42, 0.08)',
  menuItemColorHover: '#f4f6fb',
  menuItemColorActive: '#edf2ff',
  menuItemColorActiveHover: '#e7edff',
  menuTextColorActive: '#3658c7',
}

const dark: ThemePalette = {
  primaryColor: '#6b8cf0',
  primaryColorHover: '#86a2f5',
  primaryColorPressed: '#5578dd',
  successColor: '#3fbf8a',
  successColorHover: '#57d29e',
  successColorPressed: '#2fa273',
  textColorBase: '#e6eaf2',
  textColor1: '#e6eaf2',
  textColor2: '#aeb8c9',
  textColor3: '#8791a3',
  placeholderColor: '#737e91',
  dividerColor: '#2a313b',
  borderColor: '#333b47',
  bodyColor: '#13171d',
  cardColor: '#191e26',
  cardBorderColor: '#2a313b',
  tableHeaderColor: '#1e242d',
  tableHeaderTextColor: '#c9d1de',
  hoverColor: '#1f2630',
  tableColorHover: '#212936',
  boxShadow1: '0 8px 24px rgba(0, 0, 0, 0.32)',
  boxShadow2: '0 14px 36px rgba(0, 0, 0, 0.42)',
  menuItemColorHover: '#232a35',
  menuItemColorActive: '#232f4a',
  menuItemColorActiveHover: '#2a3757',
  menuTextColorActive: '#9fb5ff',
}

/** 解析后的外观档位（与 stores/theme.ts 的解析结果一致：auto 已展开为系统实际外观）。 */
export type ResolvedThemeMode = 'light' | 'dark'

function createThemeOverrides(palette: ThemePalette): GlobalThemeOverrides {
  return {
    common: {
      primaryColor: palette.primaryColor,
      primaryColorHover: palette.primaryColorHover,
      primaryColorPressed: palette.primaryColorPressed,
      primaryColorSuppl: palette.primaryColor,
      infoColor: palette.primaryColor,
      infoColorHover: palette.primaryColorHover,
      infoColorPressed: palette.primaryColorPressed,
      infoColorSuppl: palette.primaryColor,
      successColor: palette.successColor,
      successColorHover: palette.successColorHover,
      successColorPressed: palette.successColorPressed,
      successColorSuppl: palette.successColor,
      textColorBase: palette.textColorBase,
      textColor1: palette.textColor1,
      textColor2: palette.textColor2,
      textColor3: palette.textColor3,
      placeholderColor: palette.placeholderColor,
      dividerColor: palette.dividerColor,
      borderColor: palette.borderColor,
      bodyColor: palette.bodyColor,
      cardColor: palette.cardColor,
      tableHeaderColor: palette.tableHeaderColor,
      hoverColor: palette.hoverColor,
      tableColorHover: palette.tableColorHover,
      borderRadius: '10px',
      borderRadiusSmall: '8px',
      boxShadow1: palette.boxShadow1,
      boxShadow2: palette.boxShadow2,
    },
    Card: {
      borderRadius: '14px',
      borderColor: palette.cardBorderColor,
      paddingMedium: '20px 22px',
      titleTextColor: palette.textColorBase,
      titleFontWeight: '600',
      boxShadow: palette.boxShadow1,
    },
    Button: {
      borderRadiusMedium: '9px',
      borderRadiusSmall: '8px',
      fontWeight: '500',
    },
    Input: {
      borderRadius: '9px',
    },
    Select: {
      peers: {
        InternalSelection: {
          borderRadius: '9px',
        },
      },
    },
    DataTable: {
      borderRadius: '10px',
      borderColor: palette.dividerColor,
      thColor: palette.tableHeaderColor,
      thColorHover: palette.hoverColor,
      thTextColor: palette.tableHeaderTextColor,
      thFontWeight: '600',
      tdColorHover: palette.tableColorHover,
    },
    Menu: {
      borderRadius: '10px',
      // 左侧导航（侧栏 + 移动端抽屉）比正文小 1px，让导航更紧凑；图标尺寸由菜单 iconSize 决定，不随字号变
      fontSize: '13px',
      itemColorHover: palette.menuItemColorHover,
      itemColorActive: palette.menuItemColorActive,
      itemColorActiveHover: palette.menuItemColorActiveHover,
      itemColorActiveCollapsed: palette.menuItemColorActive,
      itemTextColorActive: palette.menuTextColorActive,
      itemTextColorActiveHover: palette.primaryColorHover,
      itemTextColorChildActive: palette.menuTextColorActive,
      itemTextColorChildActiveHover: palette.primaryColorHover,
      arrowColorActive: palette.menuTextColorActive,
      arrowColorChildActive: palette.menuTextColorActive,
    },
    Layout: {
      color: palette.bodyColor,
      siderColor: palette.cardColor,
      headerColor: palette.cardColor,
    },
  }
}

const overrides: Record<ResolvedThemeMode, GlobalThemeOverrides> = {
  light: createThemeOverrides(light),
  dark: createThemeOverrides(dark),
}

/** 取对应外观的 Naive UI 主题覆盖；明暗各构建一次，切换时不重复构建对象。 */
export function themeOverrides(mode: ResolvedThemeMode): GlobalThemeOverrides {
  return overrides[mode]
}
