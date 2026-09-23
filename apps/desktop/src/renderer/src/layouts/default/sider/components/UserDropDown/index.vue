<script setup lang="ts">
import { Avatar, Button, Dropdown } from 'antdv-next'
import { useSiderMenu } from '../useSiderMenu'

withDefaults(
  defineProps<{
    name?: string
    avatar?: string
  }>(),
  {
    name: '鲸跃',
    avatar: 'https://github.com/ant-design.png'
  }
)

const emit = defineEmits<{ logout: [] }>()
const { menuItems, onMenuClick } = useSiderMenu(() => emit('logout'))
</script>

<template>
  <!-- 原生元素承接定位，和齿轮按钮共用同一份菜单 -->
  <Dropdown
    class="min-w-0 flex-1"
    :trigger="['click']"
    placement="topLeft"
    :menu="{ items: menuItems, triggerSubMenuAction: 'hover', onClick: onMenuClick }"
  >
    <span class="flex min-w-0 flex-1">
      <Button block class="justify-start! text-left!">
        <span class="flex w-full min-w-0 items-center justify-start gap-2">
          <Avatar :src="avatar" :size="28" />
          <span class="truncate text-left font-medium">{{ name }}</span>
        </span>
      </Button>
    </span>
  </Dropdown>
</template>
