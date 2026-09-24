<script setup lang="ts">
import { computed, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Button, Dropdown, Tooltip } from 'antdv-next'
import { Icon, renderIcon } from '@/components/Icon'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    sending?: boolean
    paused?: boolean
    placeholder?: string
    project?: string
    branch?: string
    showContext?: boolean
  }>(),
  {
    disabled: false,
    sending: false,
    paused: false,
    placeholder: '给 Agent 发送消息…',
    project: 'gito',
    branch: 'main',
    showContext: true
  }
)

const emit = defineEmits<{
  send: [prompt: string]
  stop: []
  resume: []
}>()

const isEmpty = ref(true)
const modelOptions = ['GLM-5.2', 'GLM-5-Turbo']
const model = ref(modelOptions[0])

function optionMenu(options: string[], current: string) {
  return options.map((label) => ({
    key: label,
    label,
    extra: current === label ? renderIcon('check', 14) : undefined
  }))
}

const modelMenuItems = computed(() => optionMenu(modelOptions, model.value))

function onModelClick(info: { key: string | number }) {
  const key = String(info.key)
  if (modelOptions.includes(key)) model.value = key
}

type AccessKey = 'ask' | 'assist' | 'full'

const accessOptions: {
  key: AccessKey
  title: string
  desc: string
  icon: string
  warning?: boolean
}[] = [
  {
    key: 'ask',
    title: '请求批准',
    desc: '编辑外部文件和使用互联网时始终询问',
    icon: 'hand'
  },
  {
    key: 'assist',
    title: '帮我批准',
    desc: '仅对检测到的风险操作请求批准',
    icon: 'shield'
  },
  {
    key: 'full',
    title: '完全访问权限',
    desc: '可不受限制地访问互联网和你电脑上的任何文件',
    icon: 'triangle-alert',
    warning: true
  }
]

/** 默认「帮我批准」，目前只切换展示，不接权限逻辑 */
const accessMode = ref<AccessKey>('assist')
const currentAccess = computed(
  () => accessOptions.find((item) => item.key === accessMode.value) ?? accessOptions[1]
)

const accessMenuItems = computed(() =>
  accessOptions.map((item) => {
    const warningColor = 'var(--ant-color-warning)'
    return {
      key: item.key,
      icon: item.warning
        ? h(Icon, { icon: item.icon, size: 16, color: warningColor })
        : renderIcon(item.icon),
      label: h(
        'span',
        {
          class: 'flex min-w-0 flex-col py-0.5',
          style: item.warning ? { color: warningColor } : undefined
        },
        [
          h('span', { class: 'text-sm leading-5' }, item.title),
          h(
            'span',
            {
              class: 'text-xs leading-5 whitespace-normal',
              style: item.warning ? undefined : { color: 'var(--ant-color-text-secondary)' }
            },
            item.desc
          )
        ]
      ),
      extra: accessMode.value === item.key ? renderIcon('check', 14) : undefined
    }
  })
)

function onAccessClick(info: { key: string | number }) {
  const key = String(info.key)
  if (key === 'ask' || key === 'assist' || key === 'full') accessMode.value = key
}

/** 发送按钮三种态：生成中停、空输入且已暂停则继续、其余为发送 */
const action = computed<'send' | 'stop' | 'start'>(() => {
  if (props.sending) return 'stop'
  if (props.paused && isEmpty.value) return 'start'
  return 'send'
})

const sendDisabled = computed(() => action.value === 'send' && (props.disabled || isEmpty.value))

const editor = useEditor({
  content: '',
  editable: !props.disabled,
  extensions: [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      listKeymap: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      trailingNode: false,
      gapcursor: false
    })
  ],
  editorProps: {
    attributes: {
      class:
        'relative min-h-14 max-h-58 overflow-y-auto p-4 text-sm leading-5.5 break-words text-(--ant-color-text) outline-none [&_p]:m-0 [&_p+p]:mt-[0.35em]',
      role: 'textbox',
      'aria-multiline': 'true',
      'data-placeholder': props.placeholder
    },
    handleKeyDown(_view, event) {
      if (!shouldSendByEnter(event)) return false
      event.preventDefault()
      submit()
      return true
    }
  },
  onCreate({ editor: instance }) {
    isEmpty.value = instance.isEmpty
  },
  onUpdate({ editor: instance }) {
    isEmpty.value = instance.isEmpty
  }
})

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled)
  }
)

function shouldSendByEnter(event: KeyboardEvent) {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229
}

function editorText() {
  return (editor.value?.getText({ blockSeparator: '\n' }) ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n]+$/g, '')
    .trim()
}

function submit() {
  if (action.value === 'stop') {
    emit('stop')
    return
  }
  if (action.value === 'start') {
    emit('resume')
    return
  }
  const prompt = editorText()
  if (!prompt || props.disabled) return
  emit('send', prompt)
  editor.value?.commands.clearContent(true)
  isEmpty.value = true
  editor.value?.commands.focus()
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || !props.sending) {
    return
  }
  event.preventDefault()
  emit('stop')
}

onMounted(() => {
  window.addEventListener('keydown', onEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <div class="flex flex-col">
    <div
      class="agent-sender flex flex-col overflow-hidden rounded-(--ant-border-radius-lg) border border-solid border-(--ant-color-border) bg-(--ant-color-bg-container) transition-[border-color,box-shadow] duration-200 ease-(--ant-motion-ease-in-out) hover:border-(--ant-color-primary-hover) focus-within:border-(--ant-color-primary) focus-within:shadow-[0_0_0_2px_var(--ant-color-primary-bg)]"
    >
      <div
        v-if="showContext"
        class="flex h-10 items-center gap-4 px-4 text-sm text-(--ant-color-text-secondary)"
      >
        <button class="inline-flex items-center gap-1.5 border-0 bg-transparent p-0" type="button">
          <Icon icon="folder-git-2" :size="16" />{{ project
          }}<Icon icon="chevron-down" :size="14" />
        </button>
        <button class="inline-flex items-center gap-1.5 border-0 bg-transparent p-0" type="button">
          <Icon icon="git-branch" :size="15" />{{ branch }}<Icon icon="chevron-down" :size="14" />
        </button>
      </div>

      <div class="relative">
        <EditorContent :editor="editor" />
      </div>

      <div class="flex h-14 items-center gap-1.5 px-4">
        <Tooltip title="添加上下文">
          <Button>
            <template #icon><Icon icon="plus" :size="16" /></template>
          </Button>
        </Tooltip>
        <Dropdown
          :trigger="['click']"
          placement="topLeft"
          :styles="{
            item: {
              height: 'auto',
              whiteSpace: 'normal',
              alignItems: 'center'
            }
          }"
          :menu="{
            items: accessMenuItems,
            selectable: false,
            onClick: onAccessClick
          }"
        >
          <span class="inline-flex">
            <Button>
              <template #icon>
                <Icon :icon="currentAccess.icon" :size="16" />
              </template>
              {{ currentAccess.title }}
            </Button>
          </span>
        </Dropdown>
        <span class="ml-auto"></span>
        <Dropdown
          :trigger="['click']"
          placement="topRight"
          :menu="{
            items: modelMenuItems,
            selectable: false,
            onClick: onModelClick
          }"
        >
          <span class="inline-flex">
            <Button icon-placement="end">
              <template #icon>
                <Icon icon="chevron-down" :size="16" />
              </template>
              {{ model }}
            </Button>
          </span>
        </Dropdown>
        <Button type="primary" :data-action="action" :disabled="sendDisabled" @click="submit">
          <template #icon>
            <Icon v-if="action === 'stop'" icon="square" :size="16" fill="currentColor" />
            <Icon v-else icon="arrow-up" :size="16" />
          </template>
        </Button>
      </div>
    </div>
    <div
      class="flex items-center gap-2 px-1 py-1 text-sm text-(--ant-color-text-tertiary) bg-(--ant-color-bg-container)"
    >
      <span class="inline-flex items-center gap-1.5">
        <Icon icon="folder" :size="16" />
        <span>{{ project }}</span>
      </span>
      <span class="inline-flex items-center gap-1.5">
        <Icon icon="monitor" :size="16" />
        <span>本地</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* 仅在空输入框失焦时显示，避免与编辑器光标重叠。 */
.agent-sender
  :deep(.ProseMirror:not(:focus):has(> p:only-child > br.ProseMirror-trailingBreak)::before) {
  position: absolute;
  inset: 1rem;
  content: attr(data-placeholder);
  color: var(--ant-color-text-placeholder);
  pointer-events: none;
}
</style>
