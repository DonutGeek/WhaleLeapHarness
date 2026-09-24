import { lstat, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { RuntimeError, ToolError } from './errors.js'

function contains(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  )
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** File-tool boundary. This is not an operating-system sandbox for shell commands. */
export class Workspace {
  private constructor(
    readonly cwd: string,
    readonly root: string,
    private readonly originalRoot: string
  ) {}

  static async create(cwd: string, root = cwd): Promise<Workspace> {
    try {
      const [canonicalCwd, canonicalRoot] = await Promise.all([realpath(cwd), realpath(root)])
      const [cwdStat, rootStat] = await Promise.all([stat(canonicalCwd), stat(canonicalRoot)])
      if (
        !cwdStat.isDirectory() ||
        !rootStat.isDirectory() ||
        !contains(canonicalRoot, canonicalCwd)
      ) {
        throw new Error('cwd must be a directory inside workspaceRoot')
      }
      return new Workspace(canonicalCwd, canonicalRoot, path.resolve(root))
    } catch (cause) {
      throw new RuntimeError(
        'INVALID_WORKSPACE',
        'Cannot open workspace: cwd and workspaceRoot must be existing directories, with cwd inside workspaceRoot',
        { cause }
      )
    }
  }

  async resolve(input: string): Promise<string> {
    if (typeof input !== 'string' || input.length === 0 || input.includes('\0')) {
      throw new ToolError('INVALID_PATH', 'Path must be a non-empty string without null bytes')
    }
    let candidate = path.resolve(this.cwd, input)
    // Accept absolute paths spelled using the caller's original workspace alias (e.g. /var on macOS).
    if (contains(this.originalRoot, candidate)) {
      candidate = path.resolve(this.root, path.relative(this.originalRoot, candidate))
    }
    this.assertContained(candidate)
    let existing = candidate
    const missing: string[] = []
    while (true) {
      try {
        // lstat distinguishes a missing path from a dangling symlink. The latter must fail closed.
        await lstat(existing)
        break
      } catch (error) {
        if (!isMissing(error)) throw error
        const parent = path.dirname(existing)
        if (parent === existing)
          throw new ToolError('INVALID_PATH', 'No existing ancestor for path')
        missing.unshift(path.basename(existing))
        existing = parent
      }
    }
    let canonical: string
    try {
      canonical = await realpath(existing)
    } catch (cause) {
      throw new ToolError('INVALID_PATH', 'Cannot resolve path or symbolic link', { cause })
    }
    this.assertContained(canonical)
    const resolved = path.join(canonical, ...missing)
    this.assertContained(resolved)
    return resolved
  }

  private assertContained(candidate: string): void {
    if (!contains(this.root, candidate)) {
      throw new ToolError('WORKSPACE_BOUNDARY', 'Path is outside the current workspace')
    }
  }
}
