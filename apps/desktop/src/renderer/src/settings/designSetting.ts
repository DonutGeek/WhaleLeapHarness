import { ThemeEnum } from '@/enums/appEnum'

// settings/ 目录：应用的"默认配置"。store 第一次创建时会以这里的值作为初始状态，
// 用户改动由 Pinia 本地持久化插件保存，这里只定义"出厂设置"。
//
// 对应 vben v2 的 settings/designSetting.ts。vben 里还有 prefixCls、
// presetColorList（可选主题色列表）、size 相关常量等，我们用到再加。

/** 默认主题模式：工作台以暗色作为默认外观。 */
export const darkMode = ThemeEnum.DARK
