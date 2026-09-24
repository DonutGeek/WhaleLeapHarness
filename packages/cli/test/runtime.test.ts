import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'
import { abortable } from '../src/errors.js'
import {
  AgentRuntime,
  AgentSession,
  DefaultContextManager,
  ModelError,
  RuntimeAbortError,
  RuntimeError,
  ToolRegistry,
  type ModelProvider,
  type ModelRequest,
  type ModelResponse,
  type RuntimeEvent,
  type ToolCall
} from '../src/index.js'

class FakeModelProvider implements ModelProvider {
  readonly requests: ModelRequest[] = []
  constructor(private readonly responses: ModelResponse[]) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push({ ...request, messages: structuredClone(request.messages) })
    const response = this.responses.shift()
    assert.ok(response, 'Unexpected model request')
    return response
  }
}

const final = (text = 'Done'): ModelResponse => ({ text, finishReason: 'stop' })
const calls = (...toolCalls: ToolCall[]): ModelResponse => ({
  text: '',
  toolCalls,
  finishReason: 'tool_calls'
})
const read = (id = 'call_1', path = 'package.json'): ToolCall => ({
  id,
  name: 'read_file',
  input: { path }
})

async function fixture(t: TestContext): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'whaleleap-runtime-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  await writeFile(join(path, 'package.json'), JSON.stringify({ dependencies: { vue: '^3.5.0' } }))
  return path
}

test('plain response completes with one model turn and isolated session snapshots', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([final('Hello')])
  const runtime = new AgentRuntime({ model })
  const events: RuntimeEvent[] = []
  const off = runtime.on('event', (event) => events.push(event))
  runtime.on('event', (event) => {
    if (event.type === 'agent.started')
      event.session.messages.push({ role: 'user', content: 'tampered' })
    if (event.type === 'model.completed') event.response.text = 'tampered'
    throw new Error('UI render failed')
  })
  runtime.on('event', async () => {
    throw new Error('Async UI render failed')
  })
  const result = await runtime.run({ prompt: 'Hello', cwd, parentSessionId: 'parent' })
  off()
  assert.equal(result.text, 'Hello')
  assert.equal(result.turns, 1)
  assert.equal(result.session.status, 'completed')
  assert.equal(result.session.parentSessionId, 'parent')
  assert.ok(result.session.createdAt instanceof Date)
  assert.deepEqual(
    result.session.messages.map((message) => message.role),
    ['user', 'assistant']
  )
  assert.deepEqual(
    events.map((event) => event.type),
    ['agent.started', 'model.started', 'model.completed', 'agent.completed']
  )
  assert.equal(model.requests[0].messages[0].role, 'system')
  assert.match(model.requests[0].messages[0].content, /coding agent/)
})

test('real read_file result feeds the next context with stable tool IDs', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([calls(read()), final('This project uses Vue.')])
  const runtime = new AgentRuntime({ model })
  const events: RuntimeEvent[] = []
  runtime.on('event', (event) => events.push(event))
  const result = await runtime.run({
    prompt: 'Read package.json and tell me what framework this project uses.',
    cwd
  })
  assert.equal(result.text, 'This project uses Vue.')
  assert.equal(result.turns, 2)
  assert.deepEqual(
    model.requests[1].messages.map((message) => message.role),
    ['system', 'user', 'assistant', 'tool']
  )
  const message = model.requests[1].messages[3]
  assert.equal(message.role, 'tool')
  if (message.role !== 'tool') return
  assert.equal(message.toolCallId, 'call_1')
  assert.equal(message.isError, false)
  assert.ok(message.content.includes('vue'))
  assert.equal(result.session.messages[1].role, 'assistant')
  assert.equal(events.filter((event) => event.type === 'tool.completed').length, 1)
  assert.deepEqual(
    events.filter((event) => event.type.startsWith('permission.')).map((event) => event.type),
    ['permission.resolved']
  )
})

test('multiple calls and multiple model turns preserve declaration order', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([calls(read('a'), read('b')), calls(read('c')), final()])
  const result = await new AgentRuntime({ model }).run({ prompt: 'Inspect', cwd })
  assert.equal(result.turns, 3)
  assert.deepEqual(
    result.session.messages.map((message) => message.role),
    ['user', 'assistant', 'tool', 'tool', 'assistant', 'tool', 'assistant']
  )
  assert.deepEqual(
    result.session.messages.flatMap((message) =>
      message.role === 'tool' ? [message.toolCallId] : []
    ),
    ['a', 'b', 'c']
  )
  assert.equal(model.requests[2].messages.filter((message) => message.role === 'tool').length, 3)
})

for (const [name, call, code] of [
  ['unknown tool', { id: 'unknown', name: 'missing_tool', input: {} }, 'UNKNOWN_TOOL'],
  ['missing file', read('missing', 'missing.json'), 'TOOL_EXECUTION_FAILED'],
  ['invalid input', { id: 'bad', name: 'read_file', input: { path: 123 } }, 'INVALID_TOOL_INPUT'],
  ['workspace traversal', read('escape', '../outside'), 'WORKSPACE']
] satisfies [string, ToolCall, string][]) {
  test(`${name} returns an error result and allows model recovery`, async (t) => {
    const cwd = await fixture(t)
    const model = new FakeModelProvider([calls(call), final('Recovered')])
    const events: RuntimeEvent[] = []
    const runtime = new AgentRuntime({ model })
    runtime.on('event', (event) => events.push(event))
    const result = await runtime.run({ prompt: 'Inspect', cwd })
    assert.equal(result.text, 'Recovered')
    const message = model.requests[1].messages.at(-1)
    assert.equal(message?.role, 'tool')
    if (message?.role !== 'tool') return
    assert.equal(message.isError, true)
    assert.equal(message.toolCallId, call.id)
    assert.ok(message.content.includes(code), message.content)
    assert.equal(events.filter((event) => event.type === 'tool.failed').length, 1)
  })
}

test('deny and unhandled ask never execute a write', async (t) => {
  const cwd = await fixture(t)
  for (const decision of ['deny', 'ask'] as const) {
    const model = new FakeModelProvider([
      calls({
        id: decision,
        name: 'write_file',
        input: { path: 'package.json', content: 'changed' }
      }),
      final()
    ])
    await new AgentRuntime({ model, permissions: { rules: { write: decision } } }).run({
      prompt: 'Write',
      cwd
    })
    assert.match(model.requests[1].messages.at(-1)!.content, /PERMISSION_DENIED/)
    assert.match(await readFile(join(cwd, 'package.json'), 'utf8'), /vue/)
  }
})

test('ask emits correlated events, receives a snapshot and executes only after allow', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([calls(read()), final()])
  const events: RuntimeEvent[] = []
  const runtime = new AgentRuntime({
    model,
    permissions: {
      rules: { read: 'ask' },
      request: async (request, signal) => {
        assert.equal(signal.aborted, false)
        assert.equal(events.at(-1)?.type, 'permission.requested')
        request.toolCall.name = 'tampered'
        return 'allow'
      }
    }
  })
  runtime.on('event', (event) => events.push(event))
  await runtime.run({ prompt: 'Read', cwd })
  const requested = events.find((event) => event.type === 'permission.requested')
  const resolved = events.find((event) => event.type === 'permission.resolved')
  assert.ok(requested?.type === 'permission.requested' && resolved?.type === 'permission.resolved')
  assert.equal(requested.request.id, resolved.request.id)
  assert.equal(resolved.request.toolCall.name, 'read_file')
  assert.match(model.requests[1].messages.at(-1)!.content, /vue/)
})

test('a rejected permission callback becomes a recoverable permission result', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([calls(read()), final()])
  await new AgentRuntime({
    model,
    permissions: {
      rules: { read: 'ask' },
      request: async () => {
        throw new Error('offline')
      }
    }
  }).run({ prompt: 'Read', cwd })
  assert.match(model.requests[1].messages.at(-1)!.content, /PERMISSION_HANDLER_FAILED/)
})

test('malformed tool input fails before permission or pre-tool hooks', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([
    calls({ id: 'bad', name: 'write_file', input: {} }),
    final()
  ])
  let prompted = false
  let preTool = false
  await new AgentRuntime({
    model,
    permissions: {
      request: async () => {
        prompted = true
        return 'allow'
      }
    },
    hooks: [
      (event) => {
        if (event.type === 'PreToolUse') preTool = true
      }
    ]
  }).run({ prompt: 'Write', cwd })
  assert.equal(prompted, false)
  assert.equal(preTool, false)
  assert.match(model.requests[1].messages.at(-1)!.content, /INVALID_TOOL_INPUT/)
})

test('abort before an operation microtask prevents starting it', async () => {
  const controller = new AbortController()
  let started = false
  const operation = abortable(async () => {
    started = true
  }, controller.signal)
  controller.abort()
  await assert.rejects(operation, RuntimeAbortError)
  assert.equal(started, false)
})

test('maxTurns terminates an endless loop with a typed failure and complete history', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([calls(read('a')), calls(read('b'))])
  const events: RuntimeEvent[] = []
  const runtime = new AgentRuntime({ model, maxTurns: 2 })
  runtime.on('event', (event) => events.push(event))
  await assert.rejects(runtime.run({ prompt: 'Read forever', cwd }), (error: unknown) => {
    assert.ok(error instanceof RuntimeError)
    assert.equal(error.code, 'MAX_TURNS')
    assert.equal(error.session?.status, 'failed')
    assert.equal(error.session?.messages.at(-1)?.role, 'tool')
    return true
  })
  assert.equal(model.requests.length, 2)
  assert.equal(events.filter((event) => event.type === 'agent.failed').length, 1)
})

test('model failure and incomplete responses are fatal, never successful finals', async (t) => {
  const cwd = await fixture(t)
  for (const model of [
    {
      generate: async () => {
        throw new Error('network')
      }
    },
    new FakeModelProvider([{ text: 'partial', finishReason: 'length' }]),
    new FakeModelProvider([calls(read('duplicate'), read('duplicate'))])
  ]) {
    await assert.rejects(
      new AgentRuntime({ model }).run({ prompt: 'Read', cwd }),
      (error: unknown) => {
        assert.ok(error instanceof ModelError)
        assert.equal(error.session?.status, 'failed')
        return true
      }
    )
  }
})

test('pre-abort invokes no model', async (t) => {
  const cwd = await fixture(t)
  const model = new FakeModelProvider([])
  await assert.rejects(
    new AgentRuntime({ model }).run({ prompt: 'Read', cwd, signal: AbortSignal.abort() }),
    RuntimeAbortError
  )
  assert.equal(model.requests.length, 0)
})

test('abort stops an uncooperative model and suppresses late deltas', async (t) => {
  const cwd = await fixture(t)
  const controller = new AbortController()
  const events: RuntimeEvent[] = []
  let request: ModelRequest | undefined
  const model: ModelProvider = {
    generate: async (value) => {
      request = value
      assert.equal(value.signal, controller.signal)
      value.onDelta?.({ type: 'text', text: 'hello' })
      controller.abort()
      return new Promise<ModelResponse>(() => {})
    }
  }
  const runtime = new AgentRuntime({ model })
  runtime.on('event', (event) => events.push(event))
  await assert.rejects(
    runtime.run({ prompt: 'Read', cwd, signal: controller.signal }),
    RuntimeAbortError
  )
  request?.onDelta?.({ type: 'text', text: 'late' })
  assert.equal(events.filter((event) => event.type === 'model.delta').length, 1)
  assert.equal(events.at(-1)?.type, 'agent.aborted')
})

test('abort during permission settles and pairs every pending call', async (t) => {
  const cwd = await fixture(t)
  const controller = new AbortController()
  const model = new FakeModelProvider([calls(read('a'), read('b'))])
  const runtime = new AgentRuntime({
    model,
    permissions: {
      rules: { read: 'ask' },
      request: async () => {
        controller.abort()
        return new Promise<'allow' | 'deny'>(() => {})
      }
    }
  })
  await assert.rejects(
    runtime.run({ prompt: 'Read', cwd, signal: controller.signal }),
    (error: unknown) => {
      assert.ok(error instanceof RuntimeAbortError)
      assert.equal(error.session?.status, 'aborted')
      const messages = error.session!.messages.filter((message) => message.role === 'tool')
      assert.deepEqual(
        messages.map((message) => message.toolCallId),
        ['a', 'b']
      )
      assert.ok(messages.every((message) => message.isError && message.content.includes('ABORTED')))
      return true
    }
  )
  assert.equal(model.requests.length, 1)
})

test('hooks execute in order and do not own session state', async (t) => {
  const cwd = await fixture(t)
  const seen: string[] = []
  const runtime = new AgentRuntime({
    model: new FakeModelProvider([calls(read()), final()]),
    hooks: [
      async (event, context) => {
        seen.push(event.type)
        context.session.messages.length = 0
      }
    ]
  })
  const result = await runtime.run({ prompt: 'Read', cwd })
  assert.deepEqual(seen, ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'])
  assert.equal(result.session.messages.length, 4)
})

test('hook failures preserve actual results and close remaining calls', async (t) => {
  const cwd = await fixture(t)
  const runtime = new AgentRuntime({
    model: new FakeModelProvider([calls(read('a'), read('b'))]),
    hooks: [
      async (event) => {
        if (event.type === 'PostToolUse') throw new Error('hook failed')
      }
    ]
  })
  await assert.rejects(runtime.run({ prompt: 'Read', cwd }), (error: unknown) => {
    assert.ok(error instanceof RuntimeError)
    assert.equal(error.code, 'HOOK_FAILED')
    const messages = error.session!.messages.filter((message) => message.role === 'tool')
    assert.deepEqual(
      messages.map((message) => [message.toolCallId, message.isError]),
      [
        ['a', false],
        ['b', true]
      ]
    )
    return true
  })
})

test('parallel runs share no session history', async (t) => {
  const cwd = await fixture(t)
  const runtime = new AgentRuntime({
    model: { generate: async (request) => final(request.messages.at(-1)!.content) }
  })
  const [a, b] = await Promise.all([
    runtime.run({ prompt: 'a', cwd }),
    runtime.run({ prompt: 'b', cwd })
  ])
  assert.notEqual(a.session.id, b.session.id)
  assert.equal(a.text, 'a')
  assert.equal(b.text, 'b')
})

test('Session and Context provide defensive copies', () => {
  const session = new AgentSession({ cwd: '/project', workspaceRoot: '/project' })
  session.append({ role: 'user', content: 'original' })
  const snapshot = session.snapshot()
  snapshot.messages[0].content = 'changed'
  const context = new DefaultContextManager('custom prompt').build(session.snapshot())
  context[1].content = 'changed again'
  assert.equal(session.snapshot().messages[0].content, 'original')
  assert.equal(context[0].content, 'custom prompt')
  session.finish('completed')
  assert.throws(() => session.append({ role: 'user', content: 'late' }), RuntimeError)
})

test('custom typed tools validate inputs and duplicate registrations are rejected', async (t) => {
  const cwd = await fixture(t)
  const tool = {
    name: 'double',
    description: 'Double a number',
    permission: 'read' as const,
    inputSchema: { type: 'number' },
    parse(input: unknown): number {
      if (typeof input !== 'number') throw new Error('Expected number')
      return input
    },
    async execute(input: number) {
      return input * 2
    }
  }
  const tools = new ToolRegistry().register(tool)
  assert.throws(() => tools.register(tool), RuntimeError)
  const model = new FakeModelProvider([calls({ id: 'double', name: 'double', input: 3 }), final()])
  await new AgentRuntime({ model, tools }).run({ prompt: 'Double 3', cwd })
  assert.equal(model.requests[1].messages.at(-1)!.content, '6')
})
