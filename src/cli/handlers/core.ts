import { spawn } from 'node:child_process'
import type { CommandHandler } from '../dispatch'
import { formatCliStatus, formatStatus, printResult } from '../format'
import { RuntimeClientError, serveOrcaApp } from '../runtime-client'
import { stripElectronRunAsNode } from '../runtime/launch'
import { resolveCliStatusCaller } from '../runtime/status-caller'

function envRecord(): Record<string, string> {
  // Inherited ELECTRON_RUN_AS_NODE would force nested Electron children into plain Node mode.
  const env = stripElectronRunAsNode(process.env)
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
}

function withTeammateModeAuto(args: string[]): string[] {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--teammate-mode' || arg.startsWith('--teammate-mode=')) {
      return args
    }
  }
  return ['--teammate-mode', 'auto', ...args]
}

async function runClaudeAgentTeams(env: Record<string, string>, args: string[]): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn('claude', withTeammateModeAuto(args), {
      stdio: 'inherit',
      env
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (typeof code === 'number') {
        resolve(code)
        return
      }
      resolve(signal ? 1 : 0)
    })
  })
}

export const CORE_HANDLERS: Record<string, CommandHandler> = {
  'claude-teams': async ({ client, rawArgs }) => {
    if (process.platform === 'win32') {
      throw new RuntimeClientError(
        'unsupported_platform',
        'Claude Agent Teams native panes are not supported on Windows.'
      )
    }
    const paneKey = process.env.ORCA_PANE_KEY
    if (!paneKey) {
      throw new RuntimeClientError(
        'invalid_environment',
        'orca claude-teams must be run inside an Orca terminal.'
      )
    }
    const inheritedEnv = envRecord()
    const response = await client.call<{
      launch: { env: Record<string, string>; envToDelete?: string[] }
    }>('agentTeams.prepareLaunch', {
      paneKey,
      env: inheritedEnv,
      prepareAuth: true
    })
    for (const key of response.result.launch.envToDelete ?? []) {
      delete inheritedEnv[key]
    }
    process.exitCode = await runClaudeAgentTeams(
      {
        ...inheritedEnv,
        ...response.result.launch.env
      },
      rawArgs ?? []
    )
  },
  open: async ({ client, json }) => {
    const result = await client.openOrca()
    printResult(result, json, formatCliStatus)
  },
  serve: async ({ json }) => {
    process.exitCode = await serveOrcaApp({ json })
  },
  status: async ({ client, json }) => {
    const result = await client.getCliStatus()
    if (!json && !result.result.runtime.reachable) {
      process.exitCode = 1
    }
    const caller = result.result.runtime.reachable
      ? await resolveCliStatusCaller(client)
      : undefined
    printResult(
      caller === undefined ? result : { ...result, result: { ...result.result, caller } },
      json,
      formatStatus
    )
  }
}
