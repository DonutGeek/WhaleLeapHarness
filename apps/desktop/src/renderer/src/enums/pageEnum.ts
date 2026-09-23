// 页面的"固定路径"常量（对应 vben v2 的 src/enums/pageEnum.ts）。
// 为什么单独抽成枚举：代码里好多个地方要"跳回首页""判断是不是错误页"，
// 如果到处直接写字符串 '/'、'/exception'，哪天路径改了就会漏改某一处。
// 集中在这里之后，用的时候写 PageEnum.BASE_HOME，编辑器能补全、写错立刻报红。
export enum PageEnum {
  // 登录页：还没做登录功能，先把名字占住，以后写登录页时用它
  BASE_LOGIN = '/login',
  // 首页：我们项目的首页路由就是 '/'（见 router/routes/modules/home.ts）。
  // 注意 vben 那边首页是 '/dashboard'，我们按自己的路由表来
  BASE_HOME = '/',
  // 异常页（404 / 500 这类）：同样还没做，先占名字
  ERROR_PAGE = '/exception'
}
