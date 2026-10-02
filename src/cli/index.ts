#!/usr/bin/env node
import {
  findCommandSpec,
  isCommandGroup,
  normalizeCommandPositionals,
  parseArgs,
  resolveHelpPath,
  specPaths,
  validateCommandAndFlags
} from './args'
import { readOrcaCliVersion } from './cli-version'
import { dispatch } from './dispatch'
import { reportCliError } from './cli-error'
import { printHelp } from './help'
import type { RuntimeClient } from './runtime-client'
import { COMMAND_SPECS } from './specs'
import { resolveOrchestrationCliExecutable } from './runtime/orchestration-recovery-command'
import { refusePairedServerEnvironment } from './paired-server-env-rejection'
import { refuseConflictingSessionCallerFlags } from './session-caller-flags'

export { COMMAND_SPECS } from './specs'
export { buildCurrentWorktreeSelector, normalizeWorktreeSelector } from './selectors'

const COMMAND_PATHS = COMMAND_SPECS.flatMap((spec) => specPaths(spec))

// Why: the RuntimeClient graph is most of the CLI's eager modules. Loading it here
// rather than at module scope means --help, `help <cmd>`, and command/flag
// errors — which all return before this call — never pay for it. Awaited
// before dispatch so `ctx.client` stays a synchronous getter.
async function loadRuntimeClientClass(): Promise<typeof RuntimeClient> {
  return (await import('./runtime-client.js')).RuntimeClient
}

// Why: the SSH relay bridge executes this CLI on the Orca host while the
// caller's shell cwd lives on the remote machine (which cannot be chdir'd
// into). ORCA_CLI_CWD carries that remote cwd so cwd-based selectors like
// `--worktree active` resolve against the caller's directory.
function resolveInvocationCwd(): string {
  const override = process.env.ORCA_CLI_CWD
  return typeof override === 'string' && override.length > 0 ? override : process.cwd()
}

export async function main(
  argv = process.argv.slice(2),
  cwd = resolveInvocationCwd()
): Promise<void> {
  // Why: version audits use the bundled launcher; Electron intercepts direct binary version flags.
  if (argv.length === 1 && (argv[0] === '--version' || argv[0] === '-v')) {
    const version = readOrcaCliVersion()
    if (!version) {
      process.stderr.write('Could not determine the Orca version for this build.\n')
      process.exitCode = 1
      return
    }
    process.stdout.write(`${version}\n`)
    return
  }
  if (argv[0] === 'agent-teams-tmux') {
    await runAgentTeamsTmuxShim(argv.slice(1))
    return
  }
  if (argv[0] === 'claude-teams') {
    await runClaudeTeams(argv.slice(1), cwd)
    return
  }
  const parsed = normalizeCommandPositionals(
    COMMAND_SPECS,
    parseArgs(argv, COMMAND_PATHS, COMMAND_SPECS)
  )
  const helpPath = resolveHelpPath(parsed)
  if (helpPath !== null) {
    printHelp(COMMAND_SPECS, helpPath)
    if (
      helpPath.length > 0 &&
      !findCommandSpec(COMMAND_SPECS, helpPath) &&
      !isCommandGroup(COMMAND_SPECS, helpPath)
    ) {
      process.exitCode = 1
    }
    return
  }
  if (parsed.commandPath.length === 0) {
    printHelp(COMMAND_SPECS, [])
    return
  }
  const json = parsed.flags.has('json')

  try {
    // Why: CLI syntax and flag errors should be reported before any runtime
    // lookup so users do not get misleading "Orca is not running" failures for
    // simple command typos or unsupported flags.
    validateCommandAndFlags(COMMAND_SPECS, parsed)
    refuseConflictingSessionCallerFlags(
      findCommandSpec(COMMAND_SPECS, parsed.commandPath),
      parsed.flags
    )
    refusePairedServerEnvironment()
    const RuntimeClientClass = await loadRuntimeClientClass()
    let client: RuntimeClient | undefined
    await dispatch(parsed.commandPath, {
      flags: parsed.flags,
      // Why: local-only handlers must not resolve runtime metadata just to dispatch.
      get client() {
        client ??= new RuntimeClientClass(
          undefined,
          undefined,
          resolveOrchestrationCliExecutable(),
          argv
        )
        return client
      },
      cwd,
      json
    })
  } catch (error) {
    const worktreeSelector = parsed.flags.get('worktree')
    reportCliError(error, json, {
      commandPath: parsed.commandPath,
      ...(typeof worktreeSelector === 'string' ? { worktreeSelector } : {})
    })
    process.exitCode = 1
  }
}

async function runClaudeTeams(argv: string[], cwd: string): Promise<void> {
  try {
    // Why: everything after `orca claude-teams` belongs to Claude Code, not
    // Orca's own flag parser, so new Claude flags work without Orca changes.
    const client = new (await loadRuntimeClientClass())()
    await dispatch(['claude-teams'], {
      flags: new Map(),
      client,
      cwd,
      json: false,
      rawArgs: argv
    })
  } catch (error) {
    reportCliError(error, false, { commandPath: ['claude-teams'] })
    process.exitCode = 1
  }
}

async function runAgentTeamsTmuxShim(argv: string[]): Promise<void> {
  try {
    const client = new (await loadRuntimeClientClass())(undefined, 10_000)
    const response = await client.call<{
      tmux: { stdout: string; stderr: string; exitCode: number }
    }>(
      'agentTeams.tmuxCompat',
      {
        teamId: process.env.ORCA_AGENT_TEAMS_TEAM_ID,
        token: process.env.ORCA_AGENT_TEAMS_TOKEN,
        envPane: process.env.TMUX_PANE,
        cwd: process.cwd(),
        argv
      },
      { timeoutMs: 10_000 }
    )
    process.stdout.write(response.result.tmux.stdout)
    process.stderr.write(response.result.tmux.stderr)
    process.exitCode = response.result.tmux.exitCode
  } catch (error) {
    reportCliError(error, false, { commandPath: ['agent-teams-tmux'] })
    process.exitCode = 1
  }
}

if (require.main === module) {
  void main()
}
