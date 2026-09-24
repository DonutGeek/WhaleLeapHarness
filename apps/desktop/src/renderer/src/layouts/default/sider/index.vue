<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Conversations } from '@/components/Agent'
import { Icon } from '@/components/Icon'
import { Button } from 'antdv-next'
import { useMenuSetting } from '@/hooks/setting/useMenuSetting'
import { useAgentStore } from '@/store/modules/agent'
import UserDropDown from './components/UserDropDown/index.vue'
import SettingDropDown from './components/SettingDropDown/index.vue'
import SettingNav from './components/SettingNav/index.vue'

const { getSiderHidden } = useMenuSetting()
const route = useRoute()
const isSettings = computed(() => route.name === 'settings')
const agent = useAgentStore()

function onSelectConversation(id: string) {
  agent.selectConversation(id)
}
</script>

<template>
  <!-- 外层把宽度锁在展开尺寸再裁切，收起时文字不会被压扁 -->
  <aside
    class="h-full w-full overflow-hidden transition-opacity duration-200 ease-out pt-12"
    :class="getSiderHidden ? 'pointer-events-none opacity-0' : 'opacity-100'"
  >
    <div class="flex h-full w-full flex-col gap-2 px-2.5 pb-2">
      <SettingNav v-if="isSettings" />

      <template v-else>
        <nav class="space-y-2">
          <Button block>
            <template #icon><Icon icon="message-square-plus" :size="16" /></template>
            <template #default>新任务</template>
          </Button>
          <Button block>
            <template #icon><Icon icon="search" :size="16" /></template>
            <template #default>搜索</template>
          </Button>
        </nav>

        <section class="-mr-2.5 min-h-0 flex-1 overflow-y-auto pr-2.5">
          <div class="mb-2 flex items-center justify-between">
            <span>项目</span>
            <Button size="small">
              <template #icon><Icon icon="ellipsis" :size="16" /></template>
            </Button>
          </div>
          <Conversations
            :groups="agent.groups"
            :active-id="agent.activeConversationId"
            @select="onSelectConversation"
          />
          <div class="mt-4 mb-2 flex items-center justify-between">
            <span>最近</span>
            <Button size="small">
              <template #icon><Icon icon="ellipsis" :size="16" /></template>
            </Button>
          </div>
        </section>

        <nav class="space-y-2">
          <Button block>
            <template #icon><Icon icon="library" :size="16" /></template>
            <template #default>知识库</template>
          </Button>
          <Button block>
            <template #icon><Icon icon="puzzle" :size="16" /></template>
            <template #default>插件</template>
          </Button>
        </nav>

        <div class="flex items-center gap-2">
          <UserDropDown />
          <SettingDropDown />
        </div>
      </template>
    </div>
  </aside>
</template>
