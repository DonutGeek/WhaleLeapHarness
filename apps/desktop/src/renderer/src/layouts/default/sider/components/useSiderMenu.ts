import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { App, type MenuProps } from 'antdv-next'
import { renderIcon } from '@/components/Icon'

const CHANGELOG_URL = 'https://zcode.z.ai/cn/changelog'
const ABOUT_URL = 'https://zcode.z.ai/cn'

/** 用系统浏览器打开；开发预览不可用时退回新标签页。 */
async function openInBrowser(url: string) {
  try {
    await window.api.shell.openExternal(url)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
import { ContentEnum, FontSizeEnum, ThemeEnum } from '@/enums/appEnum'
import { useLocale } from '@/locales/useLocale'
import { useAppStore } from '@/store/modules/app'

/** 侧栏用户按钮和齿轮按钮暂时共用这一份菜单 */
export function useSiderMenu(_onLogout?: () => void) {
  const router = useRouter()
  const { modal } = App.useApp()
  const appStore = useAppStore()
  const { getLocale, changeLocale } = useLocale()

  const themeMode = computed(() => appStore.getDarkMode)
  const fontSize = computed(() => appStore.getFontSize)
  const contentMode = computed(() => appStore.getProjectConfig.contentMode)

  const menuItems = computed<NonNullable<MenuProps['items']>>(() => [
    {
      key: 'settings',
      label: '设置',
      icon: renderIcon('settings')
    },
    {
      key: 'appearance',
      type: 'submenu',
      label: '外观',
      icon: renderIcon('palette'),
      children: [
        {
          key: 'language',
          type: 'submenu',
          label: '语言',
          icon: renderIcon('languages'),
          children: [
            {
              key: 'zh-CN',
              label: '简体中文',
              extra: getLocale.value === 'zh-CN' ? renderIcon('check', 14) : undefined
            },
            {
              key: 'en-US',
              label: 'English',
              extra: getLocale.value === 'en-US' ? renderIcon('check', 14) : undefined
            }
          ]
        },
        {
          key: 'theme',
          type: 'submenu',
          label: '昼夜模式',
          icon: renderIcon('sun'),
          children: [
            {
              key: 'theme-system',
              label: '系统',
              extra: themeMode.value === ThemeEnum.SYSTEM ? renderIcon('check', 14) : undefined
            },
            {
              key: 'theme-light',
              label: '浅色',
              extra: themeMode.value === ThemeEnum.LIGHT ? renderIcon('check', 14) : undefined
            },
            {
              key: 'theme-dark',
              label: '深色',
              extra: themeMode.value === ThemeEnum.DARK ? renderIcon('check', 14) : undefined
            }
          ]
        },
        {
          key: 'theme-preset',
          type: 'submenu',
          label: '主题',
          icon: renderIcon('leaf'),
          children: [
            {
              key: 'theme-antd',
              label: 'Ant Design',
              // 目前只有这一套主题，默认勾选
              extra: renderIcon('check', 14)
            }
          ]
        },
        {
          key: 'font-size',
          type: 'submenu',
          label: '文字大小',
          icon: renderIcon('a-large-small'),
          children: [
            {
              key: 'font-small',
              label: '小',
              extra: fontSize.value === FontSizeEnum.SMALL ? renderIcon('check', 14) : undefined
            },
            {
              key: 'font-medium',
              label: '标准',
              extra: fontSize.value === FontSizeEnum.MEDIUM ? renderIcon('check', 14) : undefined
            },
            {
              key: 'font-large',
              label: '大',
              extra: fontSize.value === FontSizeEnum.LARGE ? renderIcon('check', 14) : undefined
            }
          ]
        },
        {
          key: 'content-width',
          type: 'submenu',
          label: '内容宽度',
          icon: renderIcon('columns-2'),
          children: [
            {
              key: 'content-full',
              label: '自适应',
              extra: contentMode.value === ContentEnum.FULL ? renderIcon('check', 14) : undefined
            },
            {
              key: 'content-fixed',
              label: '固定宽度',
              extra: contentMode.value === ContentEnum.FIXED ? renderIcon('check', 14) : undefined
            }
          ]
        }
      ]
    },
    {
      key: 'changelog',
      label: '更新日志',
      icon: renderIcon('rotate-ccw-clock'),
      extra: renderIcon('arrow-up-right', 14)
    },
    {
      key: 'about',
      label: '关于 Gito',
      icon: renderIcon('info'),
      extra: renderIcon('arrow-up-right', 14)
    },
    { type: 'divider', key: 'logout-divider' },
    {
      key: 'logout',
      label: '退出登录',
      icon: renderIcon('log-out'),
      danger: true
    }
  ])

  function onMenuClick(info: { key: string | number }) {
    const key = String(info.key)
    if (key === 'theme-dark') appStore.setDarkMode(ThemeEnum.DARK)
    if (key === 'theme-light') appStore.setDarkMode(ThemeEnum.LIGHT)
    if (key === 'theme-system') appStore.setDarkMode(ThemeEnum.SYSTEM)
    if (key === 'zh-CN' || key === 'en-US') void changeLocale(key)
    if (key === 'font-small') appStore.setFontSize(FontSizeEnum.SMALL)
    if (key === 'font-medium') appStore.setFontSize(FontSizeEnum.MEDIUM)
    if (key === 'font-large') appStore.setFontSize(FontSizeEnum.LARGE)
    if (key === 'content-full') appStore.setProjectConfig({ contentMode: ContentEnum.FULL })
    if (key === 'content-fixed') appStore.setProjectConfig({ contentMode: ContentEnum.FIXED })
    if (key === 'settings') void router.push({ name: 'settings' })
    if (key === 'changelog') void openInBrowser(CHANGELOG_URL)
    if (key === 'about') void openInBrowser(ABOUT_URL)
    if (key === 'logout') {
      // 只做确认界面，确认后不执行退出
      modal.confirm({
        title: '退出登录',
        content: '确定要退出当前账号吗？',
        okText: '退出登录',
        cancelText: '取消',
        okType: 'danger',
        centered: true
      })
    }
  }

  return { menuItems, onMenuClick }
}
