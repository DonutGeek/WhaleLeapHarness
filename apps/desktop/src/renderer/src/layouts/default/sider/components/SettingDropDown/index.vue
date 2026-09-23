<script setup lang="ts">
import { Button, Dropdown } from 'antdv-next'
import { Icon } from '@/components/Icon'
import { useSiderMenu } from '../useSiderMenu'

const emit = defineEmits<{ logout: [] }>()
const { menuItems, onMenuClick } = useSiderMenu(() => emit('logout'))
</script>

<template>
  <!-- 原生元素承接定位，和用户按钮共用同一份菜单 -->
  <Dropdown
    :trigger="['click']"
    placement="topRight"
    :menu="{ items: menuItems, triggerSubMenuAction: 'hover', onClick: onMenuClick }"
  >
    <span class="inline-flex">
      <Button>
        <template #icon><Icon icon="settings" :size="16" /></template>
      </Button>
    </span>
  </Dropdown>
</template>
