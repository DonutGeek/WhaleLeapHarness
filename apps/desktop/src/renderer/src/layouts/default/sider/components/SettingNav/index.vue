<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, Input } from 'antdv-next'
import { Icon } from '@/components/Icon'

interface SettingNavItem {
  key: string
  label: string
  icon: string
}

interface SettingNavGroup {
  label: string
  items: SettingNavItem[]
}

/** 侧栏分组和图里一致。目前只有「模型」有对应页面 */
const groups: SettingNavGroup[] = [
  {
    label: '个人',
    items: [
      { key: 'profile', label: '个人资料', icon: 'user' },
      { key: 'general', label: '常规', icon: 'settings' },
      { key: 'modes', label: '模式配置', icon: 'sliders-horizontal' },
      { key: 'tasks', label: '任务监控', icon: 'list' },
      { key: 'shortcuts', label: '快捷键', icon: 'keyboard' },
      { key: 'appearance', label: '外观', icon: 'palette' },
      { key: 'language', label: '语言', icon: 'languages' },
      { key: 'models', label: '模型', icon: 'box' },
      { key: 'pet', label: '桌面宠物', icon: 'paw-print' },
      { key: 'memory', label: '记忆', icon: 'brain' },
      { key: 'import', label: '数据导入', icon: 'database' }
    ]
  },
  {
    label: '集成',
    items: [
      { key: 'extensions', label: '扩展管理', icon: 'puzzle' },
      { key: 'hooks', label: '钩子', icon: 'webhook' },
      { key: 'computer', label: '电脑操控', icon: 'monitor' },
      { key: 'mobile', label: '移动端', icon: 'smartphone' }
    ]
  },
  {
    label: '编码',
    items: [
      { key: 'git', label: 'Git', icon: 'git-branch' },
      { key: 'worktrees', label: 'Worktrees', icon: 'folder-git-2' },
      { key: 'index', label: '工作区索引', icon: 'search' },
      { key: 'connections', label: '连接', icon: 'link' }
    ]
  }
]

const router = useRouter()
const keyword = ref('')

const visibleGroups = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return groups
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(query))
    }))
    .filter((group) => group.items.length > 0)
})

function backToApp() {
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <Button block @click="backToApp">
      <template #icon><Icon icon="arrow-left" :size="16" /></template>
      返回应用
    </Button>

    <Input v-model:value="keyword" placeholder="搜索设置..." allow-clear>
      <template #prefix>
        <Icon icon="search" :size="14" />
      </template>
    </Input>

    <nav class="-mr-2.5 min-h-0 flex-1 overflow-y-auto pr-2.5" aria-label="设置">
      <section v-for="group in visibleGroups" :key="group.label" class="mb-4">
        <h2 class="mb-1 px-2 text-xs font-medium text-(--ant-color-text-tertiary)">
          {{ group.label }}
        </h2>
        <button
          v-for="item in group.items"
          :key="item.key"
          class="flex w-full items-center gap-2 rounded-(--ant-border-radius) border-0 px-2 py-1.5 text-left text-sm text-(--ant-color-text)"
          :class="
            item.key === 'models'
              ? 'bg-(--ant-color-fill-secondary)'
              : 'bg-transparent hover:bg-(--ant-color-fill-tertiary)'
          "
          type="button"
        >
          <Icon :icon="item.icon" :size="16" />
          <span class="truncate">{{ item.label }}</span>
        </button>
      </section>
    </nav>
  </div>
</template>
