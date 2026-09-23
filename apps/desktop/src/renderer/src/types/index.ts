export interface FileChange {
  path: string
  index: string
  worktree: string
  staged: boolean
  label: string
}

export interface RepoStatus {
  repoPath: string
  branch: string
  upstream: string | null
  ahead: number
  behind: number
  dirty: boolean
  files: FileChange[]
  raw: string
}

export interface GitOutput {
  command: string
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
}

// Rust 侧 GitError 序列化后的形状（serde tag/content 格式）：
// { kind: "notARepo", message: "不是 Git 仓库：..." }
// kind 用于程序化区分错误类型，message 是可直接显示的中文描述
export interface GitError {
  kind: string
  message: string
}
