import { RuntimeError, ToolError, throwIfAborted } from './errors.js'
import type { JsonValue, PermissionCategory, ToolDefinition } from './types.js'
import type { Workspace } from './workspace.js'

export interface ToolContext {
  sessionId: string
  cwd: string
  workspace: Workspace
  signal: AbortSignal
}

export interface Tool<TInput = unknown> extends ToolDefinition {
  permission: PermissionCategory
  parse(input: unknown): TInput
  execute(input: TInput, context: ToolContext): Promise<JsonValue>
}

export interface RegisteredTool extends ToolDefinition {
  permission: PermissionCategory
  prepare(input: unknown): (context: ToolContext) => Promise<JsonValue>
  execute(input: unknown, context: ToolContext): Promise<JsonValue>
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>()

  register<TInput>(tool: Tool<TInput>): this {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name) || this.tools.has(tool.name)) {
      throw new RuntimeError('INVALID_TOOL', `Invalid or duplicate tool name: ${tool.name}`)
    }
    const prepare = (input: unknown): ((context: ToolContext) => Promise<JsonValue>) => {
      let parsed: TInput
      try {
        parsed = tool.parse(structuredClone(input))
      } catch (cause) {
        throw new ToolError(
          'INVALID_TOOL_INPUT',
          `Invalid input for ${tool.name}: ${cause instanceof Error ? cause.message : 'validation failed'}`,
          { cause }
        )
      }
      return async (context) => {
        throwIfAborted(context.signal)
        return tool.execute(parsed, context)
      }
    }
    this.tools.set(
      tool.name,
      Object.freeze({
        name: tool.name,
        description: tool.description,
        inputSchema: structuredClone(tool.inputSchema),
        permission: tool.permission,
        prepare,
        execute: async (input: unknown, context: ToolContext) => {
          throwIfAborted(context.signal)
          return prepare(input)(context)
        }
      })
    )
    return this
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name)
  }

  list(): readonly RegisteredTool[] {
    return [...this.tools.values()]
  }

  definitions(): ToolDefinition[] {
    return this.list().map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema: structuredClone(inputSchema)
    }))
  }

  async execute(name: string, input: unknown, context: ToolContext): Promise<JsonValue> {
    const tool = this.get(name)
    if (!tool) throw new ToolError('UNKNOWN_TOOL', `Unknown tool: ${name}`)
    return tool.execute(input, context)
  }
}
