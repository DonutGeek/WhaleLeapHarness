import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ModelError, RuntimeAbortError } from '../src/errors.js'
import { ChatCompletionsProvider } from '../src/model/chat-completions.js'
import type { ModelDelta, ModelRequest } from '../src/types.js'

function request(overrides: Partial<ModelRequest> = {}): ModelRequest {
  return {
    messages: [{ role: 'user', content: 'Read package.json' }],
    tools: [],
    signal: new AbortController().signal,
    ...overrides
  }
}

function completion(content = 'This project uses Vue.'): object {
  return {
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  }
}

function providerWith(response: Response, stream = false): ChatCompletionsProvider {
  return new ChatCompletionsProvider({
    baseUrl: 'https://model.example/v1',
    model: 'test-model',
    stream,
    fetch: async () => response
  })
}

function chunk(delta: object, finishReason: string | null = null): object {
  return { choices: [{ index: 0, delta, finish_reason: finishReason }] }
}

function sse(events: readonly (object | string)[], newline = '\n', chunkSize = 1): Response {
  const encoded = new TextEncoder().encode(
    `: keepalive${newline}${newline}` +
      events
        .map((event) => `data: ${typeof event === 'string' ? event : JSON.stringify(event)}`)
        .join(`${newline}${newline}`) +
      `${newline}${newline}`
  )
  let offset = 0
  return new Response(
    new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset === encoded.length) controller.close()
        else {
          const end = Math.min(offset + chunkSize, encoded.length)
          controller.enqueue(encoded.slice(offset, end))
          offset = end
        }
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
}

test('converts runtime messages and tools to HTTP wire format without SDK types', async () => {
  let called = false
  const signal = new AbortController().signal
  const model = new ChatCompletionsProvider({
    baseUrl: 'https://model.example/v1/',
    model: 'test-model',
    apiKey: 'test-only-key',
    stream: false,
    fetch: async (url, init) => {
      called = true
      assert.equal(String(url), 'https://model.example/v1/chat/completions')
      assert.equal(init?.method, 'POST')
      assert.equal(init?.signal, signal)
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-only-key')
      assert.equal(typeof init.body, 'string')
      assert.deepEqual(JSON.parse(String(init.body)), {
        model: 'test-model',
        messages: [
          { role: 'system', content: 'You are a coding agent.' },
          { role: 'user', content: 'Read package.json' },
          {
            role: 'assistant',
            content: '',
            reasoning_content: 'Inspect the manifest.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'read_file', arguments: '{"path":"package.json"}' }
              }
            ]
          },
          { role: 'tool', content: '{"dependencies":{"vue":"3"}}', tool_call_id: 'call_1' }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'read_file',
              description: 'Read a file',
              parameters: { type: 'object', properties: { path: { type: 'string' } } }
            }
          }
        ],
        stream: false
      })
      return Response.json(completion())
    }
  })
  const result = await model.generate(
    request({
      signal,
      messages: [
        { role: 'system', content: 'You are a coding agent.' },
        { role: 'user', content: 'Read package.json' },
        {
          role: 'assistant',
          content: '',
          reasoning: 'Inspect the manifest.',
          toolCalls: [{ id: 'call_1', name: 'read_file', input: { path: 'package.json' } }]
        },
        {
          role: 'tool',
          content: '{"dependencies":{"vue":"3"}}',
          toolCallId: 'call_1',
          name: 'read_file',
          isError: false
        }
      ],
      tools: [
        {
          name: 'read_file',
          description: 'Read a file',
          inputSchema: { type: 'object', properties: { path: { type: 'string' } } }
        }
      ]
    })
  )
  assert.equal(called, true)
  assert.equal(result.text, 'This project uses Vue.')
  assert.equal(result.finishReason, 'stop')
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 })
})

test('decodes non-streaming tool calls with stable IDs and parsed inputs', async () => {
  const result = await providerWith(
    Response.json({
      choices: [
        {
          index: 0,
          finish_reason: 'tool_calls',
          message: {
            role: 'assistant',
            content: null,
            reasoning_content: 'Need a file.',
            tool_calls: [
              {
                id: 'call_1',
                type: 'function',
                function: { name: 'read_file', arguments: '{"path":"package.json"}' }
              }
            ]
          }
        }
      ]
    })
  ).generate(request())
  assert.equal(result.text, '')
  assert.equal(result.reasoning, 'Need a file.')
  assert.deepEqual(result.toolCalls, [
    { id: 'call_1', name: 'read_file', input: { path: 'package.json' } }
  ])
})

test('streams UTF-8 deltas across arbitrary byte boundaries and CRLF separators', async () => {
  const deltas: ModelDelta[] = []
  const model = providerWith(
    sse(
      [
        chunk({ role: 'assistant' }),
        chunk({ reasoning_content: '先读文件' }),
        chunk({ content: '你好' }),
        chunk({ content: '，Vue。' }),
        {
          ...chunk({}, 'stop'),
          usage: { prompt_tokens: 9, completion_tokens: 4, total_tokens: 13 }
        },
        '[DONE]'
      ],
      '\r\n'
    ),
    true
  )
  const result = await model.generate(request({ onDelta: (delta) => deltas.push(delta) }))
  assert.equal(result.text, '你好，Vue。')
  assert.equal(result.reasoning, '先读文件')
  assert.deepEqual(result.usage, { inputTokens: 9, outputTokens: 4, totalTokens: 13 })
  assert.deepEqual(deltas, [
    { type: 'reasoning', text: '先读文件' },
    { type: 'text', text: '你好' },
    { type: 'text', text: '，Vue。' }
  ])
})

test('assembles interleaved streaming tools by index before parsing JSON', async () => {
  const deltas: ModelDelta[] = []
  const result = await providerWith(
    sse([
      chunk({
        tool_calls: [
          {
            index: 1,
            id: 'call_2',
            type: 'function',
            function: { name: 'list_directory', arguments: '{"path":' }
          },
          {
            index: 0,
            id: 'call_1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"pack' }
          }
        ]
      }),
      chunk({
        tool_calls: [
          { index: 0, function: { arguments: 'age.json"}' } },
          { index: 1, function: { arguments: '"src"}' } }
        ]
      }),
      chunk({}, 'tool_calls'),
      { choices: [], usage: { prompt_tokens: 6, completion_tokens: 8, total_tokens: 14 } },
      '[DONE]'
    ]),
    true
  ).generate(request({ onDelta: (delta) => deltas.push(delta) }))
  assert.deepEqual(result.toolCalls, [
    { id: 'call_1', name: 'read_file', input: { path: 'package.json' } },
    { id: 'call_2', name: 'list_directory', input: { path: 'src' } }
  ])
  assert.equal(result.finishReason, 'tool_calls')
  assert.equal(deltas.length, 4)
  assert.deepEqual(result.usage, { inputTokens: 6, outputTokens: 8, totalTokens: 14 })
})

test('sends streaming configuration and omits empty tools and absent authentication', async () => {
  const model = new ChatCompletionsProvider({
    baseUrl: 'https://model.example',
    model: 'test-model',
    fetch: async (_url, init) => {
      assert.equal(new Headers(init?.headers).has('Authorization'), false)
      assert.deepEqual(JSON.parse(String(init?.body)), {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Read package.json' }],
        stream: true,
        stream_options: { include_usage: true }
      })
      return sse([chunk({ content: 'Done.' }, 'stop'), '[DONE]'])
    }
  })
  assert.equal((await model.generate(request())).text, 'Done.')
})

test('rejects HTTP failures without exposing the API response body', async () => {
  await assert.rejects(
    providerWith(new Response('Do not expose this body.', { status: 401 })).generate(request()),
    (error: unknown) =>
      error instanceof ModelError &&
      error.code === 'MODEL_HTTP_ERROR' &&
      error.message.includes('401') &&
      !error.message.includes('Do not expose')
  )
})

test('rejects invalid JSON and malformed tool arguments', async () => {
  await assert.rejects(providerWith(new Response('{')).generate(request()), {
    code: 'MODEL_INVALID_JSON'
  })
  await assert.rejects(
    providerWith(
      sse([
        chunk({
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'read_file', arguments: '{"path":' }
            }
          ]
        }),
        chunk({}, 'tool_calls'),
        '[DONE]'
      ]),
      true
    ).generate(request()),
    { code: 'MODEL_INVALID_JSON' }
  )
})

test('rejects truncated streams even when a partial answer or finish reason exists', async () => {
  for (const events of [
    [chunk({ content: 'Partial' })],
    [chunk({ content: 'Partial' }, 'stop')],
    [chunk({ content: 'Partial' }), '[DONE]']
  ]) {
    await assert.rejects(providerWith(sse(events), true).generate(request()), {
      code: 'MODEL_TRUNCATED_STREAM'
    })
  }
})

test('rejects unsupported or inconsistent provider completions', async () => {
  for (const body of [
    { error: { message: 'Provider failed.' } },
    { choices: [] },
    { choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' } }] },
    {
      choices: [{ index: 1, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }]
    },
    { choices: [{ index: 0, message: { role: 'user', content: 'Hi' }, finish_reason: 'stop' }] },
    { choices: [{ index: 0, message: { role: 'assistant', content: '' }, finish_reason: 'stop' }] },
    { choices: [{ index: 0, message: { role: 'assistant' }, finish_reason: 'tool_calls' }] },
    { ...completion(), usage: { prompt_tokens: -1, completion_tokens: 2, total_tokens: 1 } }
  ]) {
    await assert.rejects(providerWith(Response.json(body)).generate(request()), ModelError)
  }
})

test('does not execute truncated tool calls or accept duplicate call IDs', async () => {
  const tool = {
    id: 'call_1',
    type: 'function',
    function: { name: 'read_file', arguments: '{}' }
  }
  for (const [reason, calls] of [
    ['length', [tool]],
    ['tool_calls', [tool, tool]]
  ] as const) {
    await assert.rejects(
      providerWith(
        Response.json({
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: null, tool_calls: calls },
              finish_reason: reason
            }
          ]
        })
      ).generate(request()),
      { code: 'MODEL_INVALID_RESPONSE' }
    )
  }
})

test('preserves non-success finish reasons for runtime policy', async () => {
  for (const reason of ['length', 'content_filter', 'insufficient_system_resource']) {
    const result = await providerWith(
      Response.json({
        choices: [
          { index: 0, message: { role: 'assistant', content: null }, finish_reason: reason }
        ]
      })
    ).generate(request())
    assert.equal(result.finishReason, reason === 'insufficient_system_resource' ? 'other' : reason)
  }
})

test('propagates cancellation before any HTTP request', async () => {
  const controller = new AbortController()
  controller.abort()
  let called = false
  const model = new ChatCompletionsProvider({
    baseUrl: 'https://model.example',
    model: 'test-model',
    fetch: async () => {
      called = true
      return Response.json(completion())
    }
  })
  await assert.rejects(model.generate(request({ signal: controller.signal })), RuntimeAbortError)
  assert.equal(called, false)
})

test('stops waiting for an in-flight HTTP request on abort', async () => {
  const controller = new AbortController()
  let started: () => void = () => {}
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  const model = new ChatCompletionsProvider({
    baseUrl: 'https://model.example',
    model: 'test-model',
    fetch: (_url, init) => {
      assert.equal(init?.signal, controller.signal)
      started()
      return new Promise<Response>(() => {})
    }
  })
  const pending = model.generate(request({ signal: controller.signal }))
  await ready
  controller.abort()
  await assert.rejects(pending, RuntimeAbortError)
})

test('aborting a stalled response cancels its body reader in both modes', async () => {
  for (const stream of [true, false]) {
    const controller = new AbortController()
    let started: () => void = () => {}
    const ready = new Promise<void>((resolve) => {
      started = resolve
    })
    let cancelled = false
    const response = new Response(
      new ReadableStream<Uint8Array>(
        {
          pull() {
            started()
          },
          cancel() {
            cancelled = true
          }
        },
        { highWaterMark: 0 }
      )
    )
    const pending = providerWith(response, stream).generate(request({ signal: controller.signal }))
    await ready
    controller.abort()
    await assert.rejects(pending, RuntimeAbortError)
    assert.equal(cancelled, true)
  }
})

test('wraps transport errors and rejects invalid configuration', async () => {
  const model = new ChatCompletionsProvider({
    baseUrl: 'https://model.example',
    model: 'test-model',
    fetch: async () => {
      throw new TypeError('Network unavailable')
    }
  })
  await assert.rejects(model.generate(request()), { code: 'MODEL_REQUEST_FAILED' })
  for (const baseUrl of ['/v1', 'file:///tmp/model', 'https://model.example?key=secret']) {
    assert.throws(() => new ChatCompletionsProvider({ baseUrl, model: 'test-model' }), {
      code: 'MODEL_CONFIGURATION'
    })
  }
})
