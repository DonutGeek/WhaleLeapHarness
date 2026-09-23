// 通用文案：页面上到处都可能用到的词。
// 这是"文案文件"的标准写法：export default 一个普通对象，
// key 是文案名（组件里 t("common.xxx") 的后半段），value 是文案内容。
// 文件放在 lang/zh-CN/ 目录下，所以第一级 key 就是文件名 common（见 ../zh-CN.ts）
export default {
  appName: 'gito',
  slogan: '本地 Git 工作台',
  openRepo: '打开仓库',
  noRepo: '未选择仓库',
  refresh: '刷新状态',
  workspace: '工作区',
  commit: '提交',
  pull: '拉取',
  push: '推送',
  selectAll: '全选',
  stageSelected: '暂存所选',
  stageAll: '暂存全部',
  emptyWorkspace: '工作区是干净的，没有待提交的变更。'
}
