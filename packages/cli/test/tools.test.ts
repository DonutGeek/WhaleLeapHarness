import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { RuntimeAbortError, ToolError } from '../src/errors.js'
import type { ToolContext } from '../src/tool.js'
import { createToolRegistry } from '../src/tools/index.js'
import { Workspace } from '../src/workspace.js'

async function fixture(): Promise<{
  base: string
  cwd: string
  outside: string
  context: ToolContext
  cleanup: () => Promise<void>
}> {
  const base = await mkdtemp(path.join(os.tmpdir(), 'whale-tools-'))
  const cwd = path.join(base, 'workspace')
  const outside = path.join(base, 'workspace-other')
  await Promise.all([mkdir(cwd), mkdir(outside)])
  return {
    base,
    cwd,
    outside,
    context: {
      sessionId: 'test-session',
      cwd,
      workspace: await Workspace.create(cwd),
      signal: new AbortController().signal
    },
    cleanup: () => rm(base, { recursive: true, force: true })
  }
}

test('workspace permits existing and new internal paths and rejects traversal and prefix siblings', async () => {
  const data = await fixture()
  try {
    await writeFile(path.join(data.cwd, 'a.txt'), 'hello')
    assert.equal(
      await data.context.workspace.resolve('a.txt'),
      path.join(data.context.workspace.root, 'a.txt')
    )
    assert.equal(
      await data.context.workspace.resolve(path.join(data.cwd, 'a.txt')),
      path.join(data.context.workspace.root, 'a.txt')
    )
    assert.equal(
      await data.context.workspace.resolve('new/nested/file.txt'),
      path.join(data.context.workspace.root, 'new/nested/file.txt')
    )
    for (const target of ['../workspace-other/secret.txt', data.outside, '/etc/passwd']) {
      await assert.rejects(data.context.workspace.resolve(target), { code: 'WORKSPACE_BOUNDARY' })
    }
    await assert.rejects(Workspace.create(data.outside, data.cwd), { code: 'INVALID_WORKSPACE' })
  } finally {
    await data.cleanup()
  }
})

test('workspace resolves internal symlinks and rejects external or dangling symlink parents', async () => {
  const data = await fixture()
  try {
    await writeFile(path.join(data.outside, 'secret'), 'outside')
    await writeFile(path.join(data.cwd, 'inside'), 'inside')
    await symlink(data.outside, path.join(data.cwd, 'external-dir'))
    await symlink(path.join(data.outside, 'secret'), path.join(data.cwd, 'external-file'))
    await symlink(path.join(data.cwd, 'inside'), path.join(data.cwd, 'internal-file'))
    await symlink(path.join(data.outside, 'missing'), path.join(data.cwd, 'dangling'))
    for (const target of ['external-dir/secret', 'external-dir/new/deep/file', 'external-file']) {
      await assert.rejects(data.context.workspace.resolve(target), { code: 'WORKSPACE_BOUNDARY' })
    }
    await assert.rejects(data.context.workspace.resolve('dangling/new-file'), {
      code: 'INVALID_PATH'
    })
    assert.equal(
      await data.context.workspace.resolve('internal-file'),
      path.join(data.context.workspace.root, 'inside')
    )
    await assert.rejects(
      createToolRegistry().execute(
        'write_file',
        { path: 'external-dir/new/deep/file', content: 'bad' },
        data.context
      ),
      { code: 'WORKSPACE_BOUNDARY' }
    )
  } finally {
    await data.cleanup()
  }
})

test('workspace uses a canonical cwd while accepting absolute paths through its initial alias', async () => {
  const data = await fixture()
  try {
    const alias = path.join(data.base, 'project-alias')
    await symlink(data.cwd, alias)
    const workspace = await Workspace.create(alias)
    assert.equal(workspace.cwd, data.context.workspace.cwd)
    assert.equal(
      await workspace.resolve(path.join(alias, 'new/file')),
      path.join(workspace.cwd, 'new/file')
    )
    await assert.rejects(workspace.resolve(path.join(alias, '../workspace-other/secret')), {
      code: 'WORKSPACE_BOUNDARY'
    })
  } finally {
    await data.cleanup()
  }
})

test('real file tools write, read, replace exactly once, list and search', async () => {
  const data = await fixture()
  const registry = createToolRegistry()
  try {
    await registry.execute(
      'write_file',
      { path: 'src/app.ts', content: 'const framework = "Vue"\nconst answer = 41\n' },
      data.context
    )
    const read = await registry.execute('read_file', { path: 'src/app.ts' }, data.context)
    assert.deepEqual(read, {
      path: 'src/app.ts',
      content: 'const framework = "Vue"\nconst answer = 41\n',
      truncated: false
    })
    await registry.execute(
      'apply_patch',
      { path: 'src/app.ts', oldText: 'answer = 41', newText: 'answer = 42' },
      data.context
    )
    assert.match(await readFile(path.join(data.cwd, 'src/app.ts'), 'utf8'), /answer = 42/)
    assert.deepEqual(await registry.execute('list_directory', { path: 'src' }, data.context), {
      path: 'src',
      entries: [{ name: 'app.ts', type: 'file' }],
      truncated: false
    })
    assert.deepEqual(await registry.execute('search_files', { query: 'answer' }, data.context), {
      matches: [{ path: 'src/app.ts', line: 2, text: 'const answer = 42' }],
      truncated: false
    })
    await assert.rejects(
      registry.execute(
        'apply_patch',
        { path: 'src/app.ts', oldText: 'const ', newText: 'let ' },
        data.context
      ),
      { code: 'PATCH_AMBIGUOUS' }
    )
    await assert.rejects(
      registry.execute(
        'apply_patch',
        { path: 'src/app.ts', oldText: 'absent', newText: '' },
        data.context
      ),
      { code: 'PATCH_NOT_FOUND' }
    )
    await assert.rejects(
      registry.execute('read_file', { path: 'src/app.ts', maxBytes: -1 }, data.context),
      { code: 'INVALID_TOOL_INPUT' }
    )
    await assert.rejects(
      registry.execute(
        'write_file',
        { path: 'file', content: 'x', unexpected: true },
        data.context
      ),
      { code: 'INVALID_TOOL_INPUT' }
    )
  } finally {
    await data.cleanup()
  }
})

test('file output limits are explicit and search does not follow symlinks', async () => {
  const data = await fixture()
  const registry = createToolRegistry()
  try {
    await writeFile(path.join(data.cwd, 'one'), 'match first\nmatch second\n')
    await writeFile(path.join(data.outside, 'secret'), 'match secret')
    await symlink(data.outside, path.join(data.cwd, 'external'))
    assert.deepEqual(
      await registry.execute('read_file', { path: 'one', maxBytes: 5 }, data.context),
      { path: 'one', content: 'match', truncated: true }
    )
    const result = await registry.execute(
      'search_files',
      { query: 'match', maxResults: 1 },
      data.context
    )
    assert.deepEqual(result, {
      matches: [{ path: 'one', line: 1, text: 'match first' }],
      truncated: true
    })
    await writeFile(path.join(data.cwd, 'binary'), Buffer.from([0, 1, 2]))
    await assert.rejects(registry.execute('read_file', { path: 'binary' }, data.context), {
      code: 'BINARY_FILE'
    })
  } finally {
    await data.cleanup()
  }
})

test(
  'shell returns real output and rejects nonzero exits, timeout and excessive output',
  { skip: process.platform === 'win32' },
  async () => {
    const data = await fixture()
    const registry = createToolRegistry()
    try {
      const result = await registry.execute(
        'shell',
        { command: 'printf hello; printf warning >&2' },
        data.context
      )
      assert.deepEqual(result, {
        stdout: 'hello',
        stderr: 'warning',
        exitCode: 0,
        signal: null,
        truncated: false
      })
      await assert.rejects(
        registry.execute('shell', { command: 'printf failed >&2; exit 7' }, data.context),
        (error: unknown) =>
          error instanceof ToolError &&
          error.code === 'SHELL_EXIT' &&
          error.message.includes('failed') &&
          error.message.includes('"exitCode":7')
      )
      await assert.rejects(
        registry.execute('shell', { command: 'sleep 30', timeoutMs: 30 }, data.context),
        { code: 'SHELL_TIMEOUT' }
      )
      await assert.rejects(
        registry.execute('shell', { command: 'yes output', maxOutputBytes: 32 }, data.context),
        { code: 'SHELL_OUTPUT_LIMIT' }
      )
    } finally {
      await data.cleanup()
    }
  }
)

test(
  'shell cancellation kills the shell process group including a child process',
  { skip: process.platform === 'win32', timeout: 5000 },
  async () => {
    const data = await fixture()
    const controller = new AbortController()
    const registry = createToolRegistry()
    let pid: number | undefined
    try {
      const execution = registry.execute(
        'shell',
        { command: 'sleep 30 & child=$!; printf "$child" > child.pid; wait "$child"' },
        { ...data.context, signal: controller.signal }
      )
      // Attach rejection handling before abort so the test never creates an unhandled rejection.
      const cancelled = assert.rejects(execution, RuntimeAbortError)
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          pid = Number(await readFile(path.join(data.cwd, 'child.pid'), 'utf8'))
          if (Number.isInteger(pid) && pid > 0) break
        } catch {
          /* Wait until the child has actually started. */
        }
        await delay(10)
      }
      assert.ok(pid && pid > 0, 'shell child started before cancellation')
      controller.abort()
      await cancelled
      let alive = true
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          process.kill(pid, 0)
        } catch {
          alive = false
          break
        }
        await delay(10)
      }
      assert.equal(alive, false, 'child process is no longer running')
    } finally {
      controller.abort()
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* Already stopped. */
        }
      }
      await data.cleanup()
    }
  }
)

test(
  'shell success cleans up background children instead of leaving an open process',
  { skip: process.platform === 'win32', timeout: 5000 },
  async () => {
    const data = await fixture()
    let pid: number | undefined
    try {
      const output = await createToolRegistry().execute(
        'shell',
        { command: 'sleep 30 & printf "$!"' },
        data.context
      )
      assert.ok(output !== null && typeof output === 'object' && !Array.isArray(output))
      assert.equal(typeof output.stdout, 'string')
      pid = Number(output.stdout)
      assert.ok(Number.isInteger(pid) && pid > 0)
      let alive = true
      for (let attempt = 0; attempt < 100; attempt++) {
        try {
          process.kill(pid, 0)
        } catch {
          alive = false
          break
        }
        await delay(10)
      }
      assert.equal(alive, false)
    } finally {
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* Already stopped. */
        }
      }
      await data.cleanup()
    }
  }
)

test('already aborted tools cannot write or spawn', async () => {
  const data = await fixture()
  const controller = new AbortController()
  controller.abort()
  const context = { ...data.context, signal: controller.signal }
  try {
    await assert.rejects(
      createToolRegistry().execute('write_file', { path: 'file', content: 'no' }, context),
      RuntimeAbortError
    )
    await assert.rejects(
      createToolRegistry().execute('shell', { command: 'touch file' }, context),
      RuntimeAbortError
    )
    await assert.rejects(readFile(path.join(data.cwd, 'file')), { code: 'ENOENT' })
  } finally {
    await data.cleanup()
  }
})

test('invalid UTF-8 is rejected without changing any bytes during an exact patch', async () => {
  const data = await fixture()
  const registry = createToolRegistry()
  const target = path.join(data.cwd, 'invalid.txt')
  const original = Buffer.concat([Buffer.from('old value\n'), Buffer.from([0xff])])
  try {
    await writeFile(target, original)
    await assert.rejects(registry.execute('read_file', { path: 'invalid.txt' }, data.context), {
      code: 'INVALID_UTF8'
    })
    await assert.rejects(
      registry.execute(
        'apply_patch',
        { path: 'invalid.txt', oldText: 'old', newText: 'new' },
        data.context
      ),
      { code: 'INVALID_UTF8' }
    )
    assert.deepEqual(await readFile(target), original)
    assert.deepEqual(await registry.execute('search_files', { query: 'value' }, data.context), {
      matches: [],
      truncated: false
    })
  } finally {
    await data.cleanup()
  }
})

test('bounded UTF-8 reads omit partial trailing characters and patches retain a BOM', async () => {
  const data = await fixture()
  const registry = createToolRegistry()
  try {
    await writeFile(path.join(data.cwd, 'unicode.txt'), '甲乙')
    for (const [maxBytes, content] of [
      [1, ''],
      [2, ''],
      [3, '甲'],
      [4, '甲'],
      [5, '甲']
    ] as const) {
      assert.deepEqual(
        await registry.execute('read_file', { path: 'unicode.txt', maxBytes }, data.context),
        { path: 'unicode.txt', content, truncated: true }
      )
    }
    await writeFile(path.join(data.cwd, 'bom.txt'), '\uFEFFold value')
    await registry.execute(
      'apply_patch',
      { path: 'bom.txt', oldText: 'old', newText: 'new' },
      data.context
    )
    assert.deepEqual(await readFile(path.join(data.cwd, 'bom.txt')), Buffer.from('\uFEFFnew value'))
  } finally {
    await data.cleanup()
  }
})

test('atomic file writes and exact patches preserve existing file permissions', async () => {
  const fs = await import('node:fs/promises')
  const data = await fixture()
  const registry = createToolRegistry()
  const target = path.join(data.cwd, 'executable.sh')
  try {
    await writeFile(target, 'old')
    await fs.chmod(target, 0o751)
    await registry.execute(
      'write_file',
      { path: 'executable.sh', content: 'replacement' },
      data.context
    )
    assert.equal((await fs.stat(target)).mode & 0o777, 0o751)
    await registry.execute(
      'apply_patch',
      { path: 'executable.sh', oldText: 'replacement', newText: 'patched' },
      data.context
    )
    assert.equal((await fs.stat(target)).mode & 0o777, 0o751)
    assert.equal(await readFile(target, 'utf8'), 'patched')
    assert.deepEqual(await fs.readdir(data.cwd), ['executable.sh'])
  } finally {
    await data.cleanup()
  }
})

test('cancellation during writes preserves originals and removes staging files', async (t) => {
  const fs = await import('node:fs/promises')
  for (const name of ['write_file', 'apply_patch']) {
    const data = await fixture()
    const target = path.join(data.cwd, 'file.txt')
    const original = 'original contents'
    const controller = new AbortController()
    try {
      await writeFile(target, original)
      const reference = await fs.open(target, 'r')
      const prototype = Object.getPrototypeOf(reference) as {
        writeFile: typeof reference.writeFile
      }
      await reference.close()
      assert.equal(typeof prototype.writeFile, 'function')
      const write = prototype.writeFile
      let interrupted = false
      const mocked = t.mock.method(
        prototype,
        'writeFile',
        async function (
          this: import('node:fs/promises').FileHandle,
          ...args: Parameters<typeof write>
        ) {
          await write.call(this, 'partial new contents')
          assert.equal(await readFile(target, 'utf8'), original)
          interrupted = true
          controller.abort()
          return write.call(this, ...args)
        }
      )
      try {
        await assert.rejects(
          createToolRegistry().execute(
            name,
            name === 'write_file'
              ? { path: 'file.txt', content: 'new contents' }
              : { path: 'file.txt', oldText: 'original', newText: 'new' },
            { ...data.context, signal: controller.signal }
          ),
          (error: unknown) => error instanceof Error && error.name === 'AbortError'
        )
        assert.equal(interrupted, true)
        assert.equal(await readFile(target, 'utf8'), original)
        assert.deepEqual(await fs.readdir(data.cwd), ['file.txt'])
      } finally {
        mocked.mock.restore()
      }
    } finally {
      await data.cleanup()
    }
  }
})
