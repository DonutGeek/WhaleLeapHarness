import { abortable, ModelError, RuntimeAbortError, throwIfAborted } from '../errors.js'
import type {
  AgentMessage,
  JsonValue,
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelUsage,
  ToolCall
} from '../types.js'

export interface ChatCompletionsOptions {
  /** API root, for example https://api.deepseek.com or http://localhost:1234/v1. */
  baseUrl: string
  model: string
  apiKey?: string
  stream?: boolean
  fetch?: typeof globalThis.fetch
}

function invalid(message: string): never {
  throw new ModelError('MODEL_INVALID_RESPONSE', message)
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid('Expected an object in the model response')
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    return invalid(`Missing or invalid ${field} in the model response`)
  }
  return value
}

function optionalText(value: unknown, field: string): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return invalid(`Invalid ${field} in the model response`)
  return value
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw new ModelError('MODEL_INVALID_JSON', 'Model returned invalid JSON', { cause })
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') return Object.values(value).every(isJsonValue)
  return false
}

function parseArguments(text: string): JsonValue {
  const value = parseJson(text)
  if (!isJsonValue(value)) return invalid('Tool arguments are not valid JSON values')
  return value
}

function usage(value: unknown): ModelUsage | undefined {
  if (value === undefined || value === null) return undefined
  const record = object(value)
  const count = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      return invalid('Invalid token usage in the model response')
    }
    return value
  }
  return {
    inputTokens: count(record.prompt_tokens),
    outputTokens: count(record.completion_tokens),
    totalTokens: count(record.total_tokens)
  }
}

function finishReason(value: unknown): ModelResponse['finishReason'] {
  const reason = requiredString(value, 'finish_reason')
  if (
    reason === 'stop' ||
    reason === 'tool_calls' ||
    reason === 'length' ||
    reason === 'content_filter'
  ) {
    return reason
  }
  return 'other'
}

function singleChoice(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== 1) {
    return invalid('Expected exactly one model choice')
  }
  const choice = object(value[0])
  if (choice.index !== 0) return invalid('Expected model choice index 0')
  return choice
}

function validateResponse(response: ModelResponse): ModelResponse {
  const calls = response.toolCalls ?? []
  if (response.finishReason === 'tool_calls' && calls.length === 0) {
    return invalid('Model finished with tool_calls but supplied no tools')
  }
  if (calls.length > 0 && response.finishReason !== 'tool_calls') {
    return invalid('Model tool calls did not finish successfully')
  }
  if (new Set(calls.map((call) => call.id)).size !== calls.length) {
    return invalid('Model returned duplicate tool call IDs')
  }
  if (response.finishReason === 'stop' && response.text.length === 0 && calls.length === 0) {
    return invalid('Model returned an empty completion')
  }
  return response
}

function parseToolCalls(value: unknown): ToolCall[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value)) return invalid('Invalid tool_calls in the model response')
  return value.map((entry) => {
    const call = object(entry)
    if (call.type !== 'function') return invalid('Unsupported model tool call type')
    const fn = object(call.function)
    return {
      id: requiredString(call.id, 'tool call ID'),
      name: requiredString(fn.name, 'tool name'),
      input: parseArguments(requiredString(fn.arguments, 'tool arguments'))
    }
  })
}

function parseResponse(value: unknown): ModelResponse {
  const body = object(value)
  if (body.error !== undefined) return invalid('Model API returned an error response')
  const choice = singleChoice(body.choices)
  const message = object(choice.message)
  if (message.role !== 'assistant') return invalid('Expected an assistant message')
  return validateResponse({
    text: optionalText(message.content, 'content'),
    reasoning: optionalText(message.reasoning_content, 'reasoning_content') || undefined,
    toolCalls: parseToolCalls(message.tool_calls),
    usage: usage(body.usage),
    finishReason: finishReason(choice.finish_reason)
  })
}

function wireMessage(message: AgentMessage): object {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId }
  }
  if (message.role === 'assistant') {
    return {
      role: 'assistant',
      content: message.content,
      ...(message.reasoning !== undefined ? { reasoning_content: message.reasoning } : {}),
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.input) }
            }))
          }
        : {})
    }
  }
  return { role: message.role, content: message.content }
}

interface PartialToolCall {
  id: string
  name: string
  arguments: string
}

async function parseStream(response: Response, request: ModelRequest): Promise<ModelResponse> {
  if (!response.body) return invalid('Model returned no streaming body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const calls = new Map<number, PartialToolCall>()
  let text = ''
  let reasoning = ''
  let tokenUsage: ModelUsage | undefined
  let reason: ModelResponse['finishReason'] | undefined
  let done = false
  let buffer = ''
  let eventData: string[] = []

  const consumeEvent = () => {
    throwIfAborted(request.signal)
    if (eventData.length === 0) return
    const data = eventData.join('\n')
    eventData = []
    if (data === '[DONE]') {
      done = true
      return
    }
    const body = object(parseJson(data))
    if (body.error !== undefined) return invalid('Model API returned a streaming error')
    tokenUsage = usage(body.usage) ?? tokenUsage
    // Some compatible APIs send usage as a final event with no choices.
    if (Array.isArray(body.choices) && body.choices.length === 0 && body.usage != null) return
    const choice = singleChoice(body.choices)
    if (reason !== undefined) return invalid('Model sent a choice after finishing')
    const delta = object(choice.delta)
    if (delta.role !== undefined && delta.role !== 'assistant') {
      return invalid('Expected an assistant streaming delta')
    }
    const content = optionalText(delta.content, 'content delta')
    const thought = optionalText(delta.reasoning_content, 'reasoning delta')
    if (content) {
      text += content
      request.onDelta?.({ type: 'text', text: content })
    }
    if (thought) {
      reasoning += thought
      request.onDelta?.({ type: 'reasoning', text: thought })
    }
    if (delta.tool_calls !== undefined && delta.tool_calls !== null) {
      if (!Array.isArray(delta.tool_calls)) return invalid('Invalid streaming tool_calls')
      for (const entry of delta.tool_calls) {
        const call = object(entry)
        const index = call.index
        if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) {
          return invalid('Invalid streaming tool index')
        }
        if (call.type !== undefined && call.type !== 'function') {
          return invalid('Unsupported streaming tool type')
        }
        const fn = call.function === undefined ? {} : object(call.function)
        const id = optionalText(call.id, 'tool call ID delta')
        const name = optionalText(fn.name, 'tool name delta')
        const args = optionalText(fn.arguments, 'tool arguments delta')
        const current = calls.get(index) ?? { id: '', name: '', arguments: '' }
        current.id += id
        current.name += name
        current.arguments += args
        calls.set(index, current)
        request.onDelta?.({
          type: 'tool_call',
          index,
          ...(id ? { id } : {}),
          ...(name ? { name } : {}),
          ...(args ? { arguments: args } : {})
        })
      }
    }
    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      reason = finishReason(choice.finish_reason)
    }
  }

  const consumeLine = (line: string) => {
    if (line === '') consumeEvent()
    else if (line === 'data') eventData.push('')
    else if (line.startsWith('data:')) eventData.push(line.slice(5).replace(/^ /, ''))
  }

  const consumeBuffer = (atEnd: boolean) => {
    while (!done) {
      const end = buffer.search(/[\r\n]/)
      if (end === -1) break
      if (!atEnd && buffer[end] === '\r' && end === buffer.length - 1) break
      const line = buffer.slice(0, end)
      const separatorLength = buffer.slice(end, end + 2) === '\r\n' ? 2 : 1
      buffer = buffer.slice(end + separatorLength)
      consumeLine(line)
    }
    if (atEnd && !done) {
      if (buffer) consumeLine(buffer)
      buffer = ''
      consumeEvent()
    }
  }

  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  request.signal.addEventListener('abort', cancel, { once: true })
  try {
    while (!done) {
      const chunk = await abortable(() => reader.read(), request.signal)
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      consumeBuffer(chunk.done)
      if (chunk.done) break
    }
    throwIfAborted(request.signal)
    if (!done || reason === undefined) {
      throw new ModelError('MODEL_TRUNCATED_STREAM', 'Model stream ended before completion')
    }
    const toolCalls = [...calls.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, call]) => ({
        id: requiredString(call.id, 'tool call ID'),
        name: requiredString(call.name, 'tool name'),
        input: parseArguments(requiredString(call.arguments, 'tool arguments'))
      }))
    return validateResponse({
      text,
      reasoning: reasoning || undefined,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: tokenUsage,
      finishReason: reason
    })
  } finally {
    request.signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}

async function readText(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return invalid('Model returned no response body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const cancel = () => {
    void reader.cancel().catch(() => {})
  }
  let text = ''
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      const chunk = await abortable(() => reader.read(), signal)
      text += decoder.decode(chunk.value, { stream: !chunk.done })
      if (chunk.done) return text
    }
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}

/** An HTTP adapter; credentials and model configuration are supplied by the client. */
export class ChatCompletionsProvider implements ModelProvider {
  private readonly endpoint: URL
  private readonly fetcher: typeof globalThis.fetch

  constructor(private readonly options: ChatCompletionsOptions) {
    try {
      this.endpoint = new URL(options.baseUrl)
    } catch (cause) {
      throw new ModelError('MODEL_CONFIGURATION', 'Model baseUrl must be an absolute URL', {
        cause
      })
    }
    if (
      !['http:', 'https:'].includes(this.endpoint.protocol) ||
      this.endpoint.search ||
      this.endpoint.hash ||
      this.endpoint.username ||
      this.endpoint.password ||
      !options.model.trim()
    ) {
      throw new ModelError('MODEL_CONFIGURATION', 'Invalid model endpoint or model name')
    }
    this.endpoint.pathname = `${this.endpoint.pathname.replace(/\/+$/, '')}/chat/completions`
    this.fetcher = options.fetch ?? globalThis.fetch
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    throwIfAborted(request.signal)
    const stream = this.options.stream ?? true
    try {
      const response = await abortable(async () => {
        const response = await this.fetcher(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {})
          },
          body: JSON.stringify({
            model: this.options.model,
            messages: request.messages.map(wireMessage),
            ...(request.tools.length
              ? {
                  tools: request.tools.map((tool) => ({
                    type: 'function',
                    function: {
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.inputSchema
                    }
                  }))
                }
              : {}),
            stream,
            ...(stream ? { stream_options: { include_usage: true } } : {})
          }),
          signal: request.signal
        })
        // A custom fetch may settle after cancellation; dispose its unused response as well.
        if (request.signal.aborted) {
          void response.body?.cancel().catch(() => {})
          throw new RuntimeAbortError()
        }
        return response
      }, request.signal)
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        throw new ModelError(
          'MODEL_HTTP_ERROR',
          `Model request failed with HTTP ${response.status}`
        )
      }
      if (stream) return await parseStream(response, request)
      const body = await readText(response, request.signal)
      throwIfAborted(request.signal)
      return parseResponse(parseJson(body))
    } catch (cause) {
      if (request.signal.aborted || cause instanceof RuntimeAbortError) {
        throw new RuntimeAbortError()
      }
      if (cause instanceof ModelError) throw cause
      throw new ModelError('MODEL_REQUEST_FAILED', 'Model request or response processing failed', {
        cause
      })
    }
  }
}
