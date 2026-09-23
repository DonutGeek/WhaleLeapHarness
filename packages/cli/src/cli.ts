#!/usr/bin/env node

import { createAgentRuntime } from './index.js'

type CliOptions = {
  input?: string
  json: boolean
  sessionId: string
}

type RuntimeCliOptions = CliOptions & { input: string }

const usage = `Usage: whale-agent run --input <text> [--session-id <id>] [--json]`

const readOptions = (argumentsList: string[]): RuntimeCliOptions => {
  if (argumentsList[0] !== 'run') throw new Error(usage)

  const options: CliOptions = {
    json: false,
    sessionId: crypto.randomUUID()
  }

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]

    if (argument === '--') continue

    if (argument === '--json') {
      options.json = true
      continue
    }

    if (argument === '--input' || argument === '--session-id') {
      const value = argumentsList[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)

      if (argument === '--input') options.input = value
      else options.sessionId = value
      index += 1
      continue
    }

    throw new Error(`Unknown option: ${argument}`)
  }

  if (!options.input) throw new Error('Missing required option: --input')

  return {
    ...options,
    input: options.input
  }
}

const main = async (): Promise<void> => {
  const options = readOptions(process.argv.slice(2))
  const runtime = createAgentRuntime()

  for await (const event of runtime.run({ sessionId: options.sessionId, input: options.input })) {
    console.log(
      options.json ? JSON.stringify(event) : `${event.status}: ${event.output ?? event.sessionId}`
    )
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
