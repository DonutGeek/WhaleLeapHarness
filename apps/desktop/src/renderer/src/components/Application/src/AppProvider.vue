<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { App, ConfigProvider, theme } from 'antdv-next'
import type { ThemeConfig } from 'antdv-next'
// 走包导出的 locale 路径；本包没有 antdv-next/es/locale
import zhCN from 'antdv-next/locale/zh_CN'
import enUS from 'antdv-next/locale/en_US'
import { useLocale } from '@/locales/useLocale'
import { FontSizeEnum, ThemeEnum } from '@/enums/appEnum'
import setting from '@/settings/projectSetting'
import { resolveTheme, useAppStore } from '@/store/modules/app'

// AppProvider 是应用最外层的组件上下文。
// 在这里集中配置 antdv-next 的主题算法、token、语言，以及 App 提供的
// message / notification / modal 上下文，后续页面不要再散落 ConfigProvider。
defineOptions({ name: 'AppProvider' })

const appStore = useAppStore()
const { getLocale } = useLocale()

// 旧版把主题色存成了品牌绿，启动时改回 antdv-next 默认主色
if (appStore.getProjectConfig.themeColor.toLowerCase() === '#43a65d') {
  appStore.setProjectConfig({ themeColor: setting.themeColor })
}

// 系统模式要跟着操作系统变，matchMedia 本身不会触发 Vue 更新
const prefersDark = ref(window.matchMedia('(prefers-color-scheme: dark)').matches)
const colorSchemeMedia = window.matchMedia('(prefers-color-scheme: dark)')
const onColorSchemeChange = (event: MediaQueryListEvent) => {
  prefersDark.value = event.matches
}

onMounted(() => {
  prefersDark.value = colorSchemeMedia.matches
  colorSchemeMedia.addEventListener('change', onColorSchemeChange)
})

onUnmounted(() => {
  colorSchemeMedia.removeEventListener('change', onColorSchemeChange)
})

const resolvedTheme = computed(() => {
  if (appStore.getDarkMode === ThemeEnum.SYSTEM) {
    return prefersDark.value ? ThemeEnum.DARK : ThemeEnum.LIGHT
  }
  return resolveTheme(appStore.getDarkMode)
})

const isDark = computed(() => resolvedTheme.value === ThemeEnum.DARK)

const antdFontSize = computed(() => {
  if (appStore.getFontSize === FontSizeEnum.SMALL) return 12
  if (appStore.getFontSize === FontSizeEnum.LARGE) return 16
  return 14
})

const antdTheme = computed<ThemeConfig>(() => {
  return {
    algorithm: isDark.value ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: appStore.getProjectConfig.themeColor,
      fontSize: antdFontSize.value
    },
    cssVar: true
  }
})

const antdLocale = computed(() => (getLocale.value === 'zh-CN' ? zhCN : enUS))

/** 把当前 Ant Design token 写到根节点，自定义区域才能跟主题走 */
function applyAntdThemeVars() {
  const token = theme.getDesignToken(antdTheme.value)
  const root = document.documentElement
  const vars: Record<string, string> = {
    '--ant-color-text': token.colorText,
    '--ant-color-text-secondary': token.colorTextSecondary,
    '--ant-color-text-tertiary': token.colorTextTertiary,
    '--ant-color-text-placeholder': token.colorTextPlaceholder,
    '--ant-color-text-light-solid': token.colorTextLightSolid,
    '--ant-color-bg-container': token.colorBgContainer,
    '--ant-color-bg-elevated': token.colorBgElevated,
    '--ant-color-bg-layout': token.colorBgLayout,
    '--ant-color-border': token.colorBorder,
    '--ant-color-border-secondary': token.colorBorderSecondary,
    '--ant-color-fill-tertiary': token.colorFillTertiary,
    '--ant-color-fill-secondary': token.colorFillSecondary,
    '--ant-color-fill-quaternary': token.colorFillQuaternary,
    '--ant-color-primary': token.colorPrimary,
    '--ant-color-primary-hover': token.colorPrimaryHover,
    '--ant-color-primary-active': token.colorPrimaryActive,
    '--ant-color-primary-bg': token.colorPrimaryBg,
    '--ant-color-primary-bg-hover': token.colorPrimaryBgHover,
    '--ant-color-primary-border': token.colorPrimaryBorder,
    '--ant-color-primary-border-hover': token.colorPrimaryBorderHover,
    '--ant-color-icon': token.colorIcon,
    '--ant-color-info': token.colorInfo,
    '--ant-color-success': token.colorSuccess,
    '--ant-color-warning': token.colorWarning,
    '--ant-color-error': token.colorError,
    '--ant-border-radius': `${token.borderRadius}px`,
    '--ant-border-radius-sm': `${token.borderRadiusSM}px`,
    '--ant-border-radius-lg': `${token.borderRadiusLG}px`,
    '--ant-font-size': `${token.fontSize}px`,
    '--ant-line-height': String(token.lineHeight),
    '--ant-box-shadow-secondary': token.boxShadowSecondary,
    '--ant-motion-ease-in-out': token.motionEaseInOut
  }
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
  root.style.backgroundColor = token.colorBgLayout
  document.body.style.backgroundColor = token.colorBgLayout
}

watchEffect(() => {
  dayjs.locale(getLocale.value === 'zh-CN' ? 'zh-cn' : 'en')
  document.documentElement.dataset.theme = resolvedTheme.value
  document.documentElement.dataset.fontSize = appStore.getFontSize
  applyAntdThemeVars()
})
</script>

<template>
  <ConfigProvider :theme="antdTheme" :locale="antdLocale">
    <!-- App 提供静态 message/notification/modal 的上下文，并撑满 #app 高度 -->
    <App class="h-full bg-(--ant-color-bg-layout)">
      <slot />
    </App>
  </ConfigProvider>
</template>
