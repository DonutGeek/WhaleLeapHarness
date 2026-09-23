// 给 vue-router 的 RouteMeta 补字段（"声明合并" declaration merging）。
//
// 背景：路由 meta 是给自己路由附加信息的地方，比如：
//   { path: '/x', component: X, meta: { title: '首页', ignoreKeepAlive: true } }
// vue-router 默认把 meta 的类型定义成"任意键值对"（Record<string | number | symbol, unknown>），
// 所以直接读 route.meta.title 拿到的是 unknown 类型——想当字符串用就编译不过。
//
// 这个文件做的事：打开 vue-router 的模块类型声明，往 RouteMeta 接口里"追加"我们自己的字段。
// 追加之后，全项目所有 route.meta.xxx 都能获得准确类型，不用到处写 as。
// （vben v2 是在 src/router/types.ts 里做的同类事情；我们放在 types/ 下，和其它类型定义在一起）
//
// 注意：这个文件没有任何 import/export 是必须的——加了 import 它才被当成"模块"，
// 模块里的 declare module 才能参与合并
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题：面包屑和浏览器标题都用它 */
    title?: string
    /** 关闭页面缓存：true = 这个页面切走后就销毁，不留在内存里 */
    ignoreKeepAlive?: boolean
    /** 内嵌 iframe 的地址：填了它就说明这是个 iframe 页面（见 layouts/iframe） */
    frameSrc?: string
    /** 这个页面单独指定切换动画名，覆盖全局默认动画 */
    transitionName?: string
  }
}
