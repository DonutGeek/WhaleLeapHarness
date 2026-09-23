<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import {
  Col,
  Form,
  FormItem,
  InputPassword,
  Modal,
  Row,
  Select,
  type FormInstance
} from 'antdv-next'

/** 计费类型。值和界面文案分开，方便以后对接接口 */
export type ModelPlan = 'token' | 'coding' | 'usage'

interface SelectOption {
  label: string
  value: string
}

export interface ModelFormData {
  provider: string
  plan: ModelPlan | ''
  models: string[]
  apiKey: string
}

/** 编辑时带上已有数据；不传就是新增 */
export interface ModelFormOpenPayload {
  mode: 'edit'
  data: ModelFormData
}

export interface ModelFormModalExpose {
  open: (payload?: ModelFormOpenPayload) => void
  close: () => void
  resetForm: () => void
}

const emit = defineEmits<{
  finish: [data: ModelFormData]
}>()

/** 供应商和它自己的模型放在一起，切换供应商时模型列表跟着换 */
const providers: { label: string; value: string; models: SelectOption[] }[] = [
  {
    label: 'Kimi',
    value: 'kimi',
    models: [
      { label: 'kimi-k2.5', value: 'kimi-k2.5' },
      { label: 'kimi-k2-turbo-preview', value: 'kimi-k2-turbo-preview' },
      { label: 'kimi-k3', value: 'kimi-k3' },
      { label: 'k3-256k', value: 'k3-256k' }
    ]
  },
  {
    label: 'DeepSeek',
    value: 'deepseek',
    models: [
      { label: 'deepseek-v4-flash', value: 'deepseek-v4-flash' },
      { label: 'deepseek-chat', value: 'deepseek-chat' },
      { label: 'deepseek-reasoner', value: 'deepseek-reasoner' }
    ]
  },
  {
    label: 'OpenAI',
    value: 'openai',
    models: [
      { label: 'gpt-5', value: 'gpt-5' },
      { label: 'gpt-5-mini', value: 'gpt-5-mini' },
      { label: 'gpt-4.1', value: 'gpt-4.1' },
      { label: 'o3', value: 'o3' }
    ]
  },
  {
    label: 'Google',
    value: 'google',
    models: [
      { label: 'gemini-2.5-pro', value: 'gemini-2.5-pro' },
      { label: 'gemini-2.5-flash', value: 'gemini-2.5-flash' },
      { label: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite' }
    ]
  },
  {
    label: 'OpenRouter',
    value: 'openrouter',
    models: [
      { label: 'anthropic/claude-sonnet-4.5', value: 'anthropic/claude-sonnet-4.5' },
      { label: 'openai/gpt-5', value: 'openai/gpt-5' },
      { label: 'google/gemini-2.5-pro', value: 'google/gemini-2.5-pro' },
      { label: 'deepseek/deepseek-chat', value: 'deepseek/deepseek-chat' }
    ]
  },
  {
    label: '智谱-中国',
    value: 'zhipu-cn',
    models: [
      { label: 'GLM-5.3', value: 'GLM-5.3' },
      { label: 'GLM-5.3-Flash', value: 'GLM-5.3-Flash' },
      { label: 'GLM-4.6', value: 'GLM-4.6' }
    ]
  },
  {
    label: '智谱-国际',
    value: 'zhipu-intl',
    models: [
      { label: 'GLM-5.3', value: 'GLM-5.3' },
      { label: 'GLM-5.2', value: 'GLM-5.2' },
      { label: 'GLM-5-Turbo', value: 'GLM-5-Turbo' }
    ]
  },
  {
    label: '阿里云百炼-中国',
    value: 'bailian-cn',
    models: [
      { label: 'qwen3-max', value: 'qwen3-max' },
      { label: 'qwen3-plus', value: 'qwen3-plus' },
      { label: 'qwen-vl-max', value: 'qwen-vl-max' },
      { label: 'qwen-turbo', value: 'qwen-turbo' }
    ]
  },
  {
    label: '阿里云百炼-新加坡',
    value: 'bailian-sg',
    models: [
      { label: 'qwen3-plus', value: 'qwen3-plus' },
      { label: 'qwen-plus', value: 'qwen-plus' },
      { label: 'qwen2.5-vl-72b-instruct', value: 'qwen2.5-vl-72b-instruct' }
    ]
  },
  {
    label: '阿里云百炼-美国',
    value: 'bailian-us',
    models: [
      { label: 'qwen-plus', value: 'qwen-plus' },
      { label: 'qwen-turbo', value: 'qwen-turbo' },
      { label: 'qwen-vl-plus', value: 'qwen-vl-plus' }
    ]
  },
  {
    label: 'Anthropic',
    value: 'anthropic',
    models: [
      { label: 'claude-opus-4.7', value: 'claude-opus-4.7' },
      { label: 'claude-sonnet-4.5', value: 'claude-sonnet-4.5' },
      { label: 'claude-haiku-4.5', value: 'claude-haiku-4.5' }
    ]
  },
  {
    label: 'MiniMax',
    value: 'minimax',
    models: [
      { label: 'MiniMax-M2', value: 'MiniMax-M2' },
      { label: 'MiniMax-Text-01', value: 'MiniMax-Text-01' }
    ]
  },
  {
    label: '小米 MiMo',
    value: 'mimo',
    models: [
      { label: 'mimo-v2-pro', value: 'mimo-v2-pro' },
      { label: 'mimo-v2-flash', value: 'mimo-v2-flash' }
    ]
  }
]

const providerOptions: SelectOption[] = providers.map(({ label, value }) => ({ label, value }))

const planOptions: { label: string; value: ModelPlan }[] = [
  { label: 'Token plan', value: 'token' },
  { label: 'Coding plan', value: 'coding' },
  { label: '按量付费', value: 'usage' }
]

const modelCatalog: Record<string, SelectOption[]> = Object.fromEntries(
  providers.map((item) => [item.value, item.models])
)

function createFormData(): ModelFormData {
  return {
    provider: '',
    plan: 'token',
    models: [],
    apiKey: ''
  }
}

function cloneForm(data: ModelFormData): ModelFormData {
  return {
    provider: data.provider,
    plan: data.plan,
    models: [...data.models],
    apiKey: data.apiKey
  }
}

const visible = ref(false)
const mode = ref<'create' | 'edit'>('create')
const submitting = ref(false)
const formRef = ref<FormInstance>()
/** 表单字段只在弹窗内部维护，父组件通过 open 传入编辑数据 */
const formData = reactive<ModelFormData>(createFormData())
/** 本次打开时的初始值，重置时回到这里，而不是清空编辑中的 Key */
let openedSnapshot = createFormData()

const isEdit = computed(() => mode.value === 'edit')
const title = computed(() => (isEdit.value ? '编辑模型' : '添加模型'))
const modelOptions = computed(() => modelCatalog[formData.provider] ?? [])

const rules = {
  provider: [{ required: true, message: '请选择供应商' }],
  plan: [{ required: true, message: '请选择类型' }],
  models: [{ required: true, type: 'array' as const, min: 1, message: '请选择模型' }],
  apiKey: [{ required: true, message: '请输入 API Key' }]
}

function applyForm(data: ModelFormData) {
  formData.provider = data.provider
  formData.plan = data.plan
  formData.models = [...data.models]
  formData.apiKey = data.apiKey
}

function open(payload?: ModelFormOpenPayload) {
  mode.value = payload?.mode === 'edit' ? 'edit' : 'create'
  openedSnapshot = payload?.mode === 'edit' ? cloneForm(payload.data) : createFormData()
  applyForm(openedSnapshot)
  visible.value = true
  void nextTick(() => formRef.value?.clearValidate())
}

function close() {
  if (submitting.value) return
  visible.value = false
}

function resetForm() {
  applyForm(openedSnapshot)
  formRef.value?.clearValidate()
}

function onProviderChange() {
  if (isEdit.value) return
  formData.models = []
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  try {
    await formRef.value?.validate()
  } catch {
    submitting.value = false
    return
  }
  emit('finish', cloneForm(formData))
  submitting.value = false
  visible.value = false
}

defineExpose<ModelFormModalExpose>({ open, close, resetForm })
</script>

<template>
  <Modal
    :open="visible"
    :title="title"
    :confirm-loading="submitting"
    :ok-text="isEdit ? '保存' : '添加'"
    cancel-text="取消"
    :width="520"
    destroy-on-hidden
    @update:open="
      (value: boolean) => {
        if (!value) close()
      }
    "
    @ok="submit"
  >
    <Form
      ref="formRef"
      layout="vertical"
      :colon="false"
      :model="formData"
      :rules="rules"
      autocomplete="off"
      @finish="submit"
    >
      <Row :gutter="16">
        <Col :span="24">
          <FormItem label="供应商" name="provider">
            <Select
              v-model:value="formData.provider"
              class="w-full"
              :options="providerOptions"
              :disabled="isEdit"
              show-search
              option-filter-prop="label"
              placeholder="请选择供应商"
              @change="onProviderChange"
            />
          </FormItem>
        </Col>
        <Col :span="24">
          <FormItem label="类型" name="plan">
            <Select
              v-model:value="formData.plan"
              class="w-full"
              :options="planOptions"
              :disabled="isEdit"
              placeholder="请选择类型"
            />
          </FormItem>
        </Col>
        <Col :span="24">
          <FormItem label="模型" name="models">
            <Select
              v-model:value="formData.models"
              class="w-full"
              mode="multiple"
              :options="modelOptions"
              :disabled="isEdit || !formData.provider"
              placeholder="请选择模型"
            />
          </FormItem>
        </Col>
        <Col :span="24">
          <FormItem label="API Key" name="apiKey">
            <InputPassword
              v-model:value="formData.apiKey"
              placeholder="请输入 API Key"
              :visibility-toggle="true"
              autocomplete="new-password"
            />
          </FormItem>
        </Col>
      </Row>
    </Form>
  </Modal>
</template>
