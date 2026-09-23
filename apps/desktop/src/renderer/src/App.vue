<script setup lang="ts">
// App.vue 是应用的"外壳"：本身不放具体页面内容，
// 具体页面由 vue-router 根据当前地址匹配路由表后，渲染到下面的 <router-view /> 里
import { AppProvider } from '@/components/Application'
</script>

<template>
  <!-- AppProvider 为全站组件提供统一的 antdv-next 主题、语言和 App 上下文。 -->
  <AppProvider>
    <!-- router-view 是路由出口：地址变化时，对应该路径的页面组件会替换渲染在这里 -->
    <router-view />
  </AppProvider>
</template>
