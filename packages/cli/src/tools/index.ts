import { ToolRegistry } from '../tool.js'
import {
  applyPatchTool,
  listDirectoryTool,
  readFileTool,
  searchFilesTool,
  writeFileTool
} from './files.js'
import { shellTool } from './shell.js'

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry()
    .register(readFileTool)
    .register(writeFileTool)
    .register(applyPatchTool)
    .register(listDirectoryTool)
    .register(searchFilesTool)
    .register(shellTool)
}

export {
  applyPatchTool,
  listDirectoryTool,
  readFileTool,
  searchFilesTool,
  writeFileTool,
  shellTool
}
