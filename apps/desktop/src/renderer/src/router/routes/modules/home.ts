import type { RouteRecordRaw } from 'vue-router'
import DefaultLayout from '@/layouts/default/index.vue'
import Home from '@/views/home/index.vue'
import Settings from '@/views/settings/index.vue'

// 首页挂在默认布局下：侧栏由 layout 渲染，页面只填内容区
const home: RouteRecordRaw = {
  path: '/',
  component: DefaultLayout,
  children: [
    {
      path: '',
      name: 'home',
      component: Home
    },
    {
      path: 'settings',
      name: 'settings',
      component: Settings
    }
  ]
}

export default home
