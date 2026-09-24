import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, opendir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { ToolError, throwIfAborted } from '../errors.js'
import type { Tool, ToolContext } from '../tool.js'
import type { JsonValue } from '../types.js'
import { integerInput, objectInput, requiredString, stringInput } from './validation.js'

const MAX_FILE_BYTES = 1_048_576
const MAX_READ_BYTES = 262_144

async function readText(
  file: string,
  maximum: number,
  signal: AbortSignal
): Promise<{ content: string; truncated: boolean }> {
  throwIfAborted(signal)
  const handle = await open(
    file,
    constants.O_RDONLY | constants.O_NONBLOCK | (constants.O_NOFOLLOW ?? 0)
  )
  try {
    if (!(await handle.stat()).isFile())
      throw new ToolError('NOT_A_FILE', 'Path must be a regular file')
    const buffer = Buffer.alloc(maximum + 1)
    let size = 0
    while (size < buffer.length) {
      throwIfAborted(signal)
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null)
      if (bytesRead === 0) break
      size += bytesRead
    }
    throwIfAborted(signal)
    if (buffer.subarray(0, size).includes(0))
      throw new ToolError('BINARY_FILE', 'Only text files are supported')
    const truncated = size > maximum
    try {
      // Streaming decode omits an incomplete trailing character when the byte limit cuts it.
      // Preserve a UTF-8 BOM so an exact patch cannot silently remove it from the file.
      const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })
      return {
        content: decoder.decode(buffer.subarray(0, Math.min(size, maximum)), {
          stream: truncated
        }),
        truncated
      }
    } catch (cause) {
      throw new ToolError('INVALID_UTF8', 'File contains invalid UTF-8 text', { cause })
    }
  } finally {
    await handle.close()
  }
}

async function existingFileMode(file: string): Promise<number | undefined> {
  try {
    const metadata = await lstat(file)
    if (!metadata.isFile()) throw new ToolError('NOT_A_FILE', 'Path must be a regular file')
    return metadata.mode & 0o7777
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
}

async function writeText(
  inputPath: string,
  content: string,
  context: ToolContext
): Promise<string> {
  const target = await context.workspace.resolve(inputPath)
  throwIfAborted(context.signal)
  await mkdir(path.dirname(target), { recursive: true })
  const verified = await context.workspace.resolve(target)
  const mode = await existingFileMode(verified)
  const temporary = await context.workspace.resolve(
    path.join(path.dirname(verified), `.whale-${randomUUID()}.tmp`)
  )
  throwIfAborted(context.signal)
  let staged = false
  try {
    const handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0),
      mode === undefined ? 0o666 : 0o600
    )
    staged = true
    try {
      await handle.writeFile(content, { encoding: 'utf8', signal: context.signal })
      throwIfAborted(context.signal)
      if (mode !== undefined) await handle.chmod(mode)
    } finally {
      await handle.close()
    }
    if ((await context.workspace.resolve(verified)) !== verified) {
      throw new ToolError('PATH_CHANGED', 'File path changed while preparing the write')
    }
    await context.workspace.resolve(temporary)
    await existingFileMode(verified)
    throwIfAborted(context.signal)
    // Commit only complete content. Cancellation before this point leaves the original intact.
    await rename(temporary, verified)
    staged = false
  } finally {
    if (staged) {
      await unlink(temporary).catch((error: unknown) => {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      })
    }
  }
  return path.relative(context.workspace.cwd, verified)
}

export const readFileTool: Tool<{ path: string; maxBytes: number }> = {
  name: 'read_file',
  description:
    'Read a UTF-8 text file inside the workspace. Output is capped; truncated indicates omitted content.',
  permission: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      maxBytes: { type: 'integer', minimum: 1, maximum: MAX_READ_BYTES }
    },
    required: ['path'],
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['path', 'maxBytes'])
    return {
      path: requiredString(object, 'path'),
      maxBytes: integerInput(object, 'maxBytes', 131_072, MAX_READ_BYTES)
    }
  },
  async execute(input, context) {
    const target = await context.workspace.resolve(input.path)
    return {
      path: path.relative(context.workspace.cwd, target),
      ...(await readText(target, input.maxBytes, context.signal))
    }
  }
}

export const writeFileTool: Tool<{ path: string; content: string }> = {
  name: 'write_file',
  description:
    'Create or overwrite a UTF-8 text file inside the workspace, creating parent directories. Read existing files before overwriting.',
  permission: 'write',
  inputSchema: {
    type: 'object',
    properties: { path: { type: 'string' }, content: { type: 'string' } },
    required: ['path', 'content'],
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['path', 'content'])
    return {
      path: requiredString(object, 'path'),
      content: requiredString(object, 'content', { empty: true, maxBytes: MAX_FILE_BYTES })
    }
  },
  async execute(input, context) {
    return {
      path: await writeText(input.path, input.content, context),
      bytesWritten: Buffer.byteLength(input.content)
    }
  }
}

export const applyPatchTool: Tool<{ path: string; oldText: string; newText: string }> = {
  name: 'apply_patch',
  description:
    'Replace exactly one occurrence of oldText with newText in one UTF-8 file. This is an exact text replacement, not a unified diff. Ambiguous or missing matches are rejected.',
  permission: 'write',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      oldText: { type: 'string', minLength: 1 },
      newText: { type: 'string' }
    },
    required: ['path', 'oldText', 'newText'],
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['path', 'oldText', 'newText'])
    return {
      path: requiredString(object, 'path'),
      oldText: requiredString(object, 'oldText', { maxBytes: MAX_FILE_BYTES }),
      newText: requiredString(object, 'newText', { empty: true, maxBytes: MAX_FILE_BYTES })
    }
  },
  async execute(input, context) {
    const target = await context.workspace.resolve(input.path)
    const { content, truncated } = await readText(target, MAX_FILE_BYTES, context.signal)
    if (truncated)
      throw new ToolError('FILE_TOO_LARGE', 'Exact replacement supports files up to 1 MiB')
    const index = content.indexOf(input.oldText)
    if (index < 0)
      throw new ToolError(
        'PATCH_NOT_FOUND',
        'oldText was not found; read the file before trying again'
      )
    if (content.indexOf(input.oldText, index + 1) >= 0)
      throw new ToolError('PATCH_AMBIGUOUS', 'oldText matches more than once; provide more context')
    const updated =
      content.slice(0, index) + input.newText + content.slice(index + input.oldText.length)
    if (Buffer.byteLength(updated) > MAX_FILE_BYTES)
      throw new ToolError('FILE_TOO_LARGE', 'Patched file would exceed 1 MiB')
    return { path: await writeText(target, updated, context), replacements: 1 }
  }
}

export const listDirectoryTool: Tool<{ path: string; maxEntries: number }> = {
  name: 'list_directory',
  description:
    'List immediate directory entries inside the workspace. Symbolic links are listed but not followed.',
  permission: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      maxEntries: { type: 'integer', minimum: 1, maximum: 1000 }
    },
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['path', 'maxEntries'])
    return {
      path: stringInput(object, 'path', { optional: true }) ?? '.',
      maxEntries: integerInput(object, 'maxEntries', 200, 1000)
    }
  },
  async execute(input, context) {
    const target = await context.workspace.resolve(input.path)
    const entries: { name: string; type: string }[] = []
    let truncated = false
    for await (const entry of await opendir(target)) {
      throwIfAborted(context.signal)
      if (entries.length >= input.maxEntries) {
        truncated = true
        break
      }
      entries.push({
        name: entry.name,
        type: entry.isSymbolicLink()
          ? 'symlink'
          : entry.isDirectory()
            ? 'directory'
            : entry.isFile()
              ? 'file'
              : 'other'
      })
    }
    entries.sort((a, b) => a.name.localeCompare(b.name))
    return { path: path.relative(context.workspace.cwd, target) || '.', entries, truncated }
  }
}

export const searchFilesTool: Tool<{ path: string; query: string; maxResults: number }> = {
  name: 'search_files',
  description:
    'Search for literal, case-sensitive text in workspace files. Skips symlinks, binary files, .git, node_modules, dist and .turbo. Bounded to 2,000 entries, 8 MiB total and the first 64 KiB per file; truncated signals any limit.',
  permission: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      query: { type: 'string', minLength: 1 },
      maxResults: { type: 'integer', minimum: 1, maximum: 200 }
    },
    required: ['query'],
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['path', 'query', 'maxResults'])
    const query = requiredString(object, 'query', { maxBytes: 4096 })
    if (query.includes('\n') || query.includes('\r')) throw new Error('query must be a single line')
    return {
      path: stringInput(object, 'path', { optional: true }) ?? '.',
      query,
      maxResults: integerInput(object, 'maxResults', 50, 200)
    }
  },
  async execute(input, context) {
    const root = await context.workspace.resolve(input.path)
    const matches: JsonValue[] = []
    const pending = [root]
    let entries = 0
    let bytes = 0
    let truncated = false
    let stopped = false
    const skipped = new Set(['.git', 'node_modules', 'dist', '.turbo'])
    while (pending.length > 0 && !stopped) {
      throwIfAborted(context.signal)
      const directory = pending.pop()
      if (directory === undefined) break
      for await (const entry of await opendir(await context.workspace.resolve(directory))) {
        throwIfAborted(context.signal)
        if (++entries > 2000 || bytes >= 8_388_608) {
          truncated = true
          stopped = true
          break
        }
        if (entry.isSymbolicLink()) continue
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!skipped.has(entry.name)) pending.push(entryPath)
          continue
        }
        if (!entry.isFile()) continue
        let text: { content: string; truncated: boolean }
        try {
          text = await readText(await context.workspace.resolve(entryPath), 65_536, context.signal)
        } catch (error) {
          if (
            error instanceof ToolError &&
            (error.code === 'BINARY_FILE' || error.code === 'INVALID_UTF8')
          )
            continue
          throw error
        }
        bytes += Buffer.byteLength(text.content)
        truncated ||= text.truncated
        const lines = text.content.split('\n')
        for (let line = 0; line < lines.length; line++) {
          if (!lines[line].includes(input.query)) continue
          if (matches.length >= input.maxResults) {
            truncated = true
            stopped = true
            break
          }
          matches.push({
            path: path.relative(context.workspace.cwd, entryPath),
            line: line + 1,
            text: lines[line].slice(0, 500)
          })
        }
        if (stopped) break
      }
    }
    return { matches, truncated }
  }
}
