// 英文语言包入口。结构和 zh-CN.ts 完全一样，只是收集 en-US/ 目录。
// 两个文件唯一的差别：glob 的路径和 genMessage 的前缀都换成 "en-US"
import type { MessageFile } from '../helper'
import { genMessage } from '../helper'

// 收集 lang/en-US/ 目录下所有文案文件（.json，格式说明见 zh-CN.ts 的注释）
const modules = import.meta.glob<MessageFile>('./en-US/**/*.json', {
  eager: true
})

// 组装成 { message: { common: {...} } }
export default {
  message: genMessage(modules, 'en-US')
}
