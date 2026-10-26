import { spawn } from 'node:child_process'
import { buildWslExecArgs, buildWslLoginShellCommand } from '../../shared/wsl-login-shell-command'
import { quotePosixShell } from '../../shared/shell-argument-quoting'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { printResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import { stripElectronRunAsNode } from '../runtime/launch'
import {
  getVersionManagerBinPaths,
  resolveCliCommand,
  withCliRuntimeOnPath
} from '../../shared/node-cli-command-resolution'
import {
  getSpawnArgsForWindows,
  UnsafeWindowsBatchArgumentsError,
  WINDOWS_BATCH_UNSAFE_CHARACTERS_LABEL
} from '../../shared/windows-batch-spawn'
import { stdioForWindowsInteractiveChild } from '../../shared/windows-console-input'
import { ACCOUNT_IMPORT_RUNTIME_CAPABILITY } from '../../shared/account-runtime-capabilities'
import type { RuntimeStatus } from '../../shared/runtime-types'
import type {
  ClaudeAccountSignIn,
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../shared/managed-account-types'
import {
  type InteractiveLoginSession,
  withInteractiveLoginCleanup
} from './interactive-login-interruption'
import { getWslAccountTarget } from './account-wsl-location'

type AccountsListSnapshot = {
  claude: ClaudeRateLimitAccountsState
  codex: CodexRateLimitAccountsState
}

// Why: Claude and Codex managed-account summaries both carry id+email+active id,
// so one formatter renders either provider's block.
type AccountsBlock = {
  accounts: readonly { id: string; email: string; needsSignIn?: true }[]
  activeAccountId: string | null
  activeAccountIdsByRuntime?: {
    host: string | null
    wsl: Record<string, string | null>
  }
}

/** Renders a provider's managed-account list as a human-readable block, marking the active account. */
function formatAccountsBlock(label: string, block: AccountsBlock): string {
  if (block.accounts.length === 0) {
    return `No managed ${label} accounts.`
  }
  const activeAccountIds = new Set([
    block.activeAccountId,
    block.activeAccountIdsByRuntime?.host,
    ...Object.values(block.activeAccountIdsByRuntime?.wsl ?? {})
  ])
  const lines = block.accounts.map(
    (account) =>
      `  ${account.email}${activeAccountIds.has(account.id) ? ' (active)' : ''}${
        account.needsSignIn ? ' (sign in again in Orca Settings > AI Provider Accounts)' : ''
      }`
  )
  return `Managed ${label} accounts (${block.accounts.length}):\n${lines.join('\n')}`
}

function addAgentNodePaths(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const pathKey =
    process.platform === 'win32' && env.Path !== undefined && env.PATH === undefined
      ? 'Path'
      : 'PATH'
  const currentEntries = (env[pathKey] ?? '').split(delimiter).filter(Boolean)
  const existing = new Set(currentEntries)
  const missing = getVersionManagerBinPaths().filter((entry) => !existing.has(entry))
  if (missing.length > 0) {
    env[pathKey] = [...missing, ...currentEntries].join(delimiter)
  }
  return env
}

/** Attach login to the terminal so device-code authentication works on headless hosts. */
async function runAgentLoginInTerminal(
  command: string,
  args: string[],
  extraEnv: Record<string, string>,
  json: boolean,
  session: InteractiveLoginSession
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const resolvedCommand = resolveCliCommand(command)
    let spawnCmd: string
    let spawnArgs: string[]
    try {
      ;({ spawnCmd, spawnArgs } = getSpawnArgsForWindows(resolvedCommand, args))
    } catch (error) {
      rejectPromise(
        error instanceof UnsafeWindowsBatchArgumentsError
          ? new RuntimeClientError(
              'invalid_environment',
              `Cannot run \`${command}\` from "${resolvedCommand}": the path contains characters ` +
                `cmd.exe would reinterpret. Install it somewhere without ` +
                `${WINDOWS_BATCH_UNSAFE_CHARACTERS_LABEL} in the path.`
            )
          : error
      )
      return
    }
    // Put the CLI's own Node ahead of newer version-manager bins to keep the command/runtime pair intact.
    const env = withCliRuntimeOnPath(
      resolvedCommand,
      addAgentNodePaths({ ...stripElectronRunAsNode(process.env), ...extraEnv })
    )
    const consoleStdio = stdioForWindowsInteractiveChild(json)
    let child: ReturnType<typeof spawn>
    try {
      child = spawn(spawnCmd, spawnArgs, {
        // Reserve stdout for JSON; keep interactive login on the terminal via stderr.
        stdio: consoleStdio.stdio,
        env
      })
    } finally {
      consoleStdio.dispose()
    }
    session.child = child
    child.once('error', (error) =>
      rejectPromise(
        new RuntimeClientError(
          'internal',
          `Could not launch \`${command}\`. Is it installed and on PATH? (${
            error instanceof Error ? error.message : String(error)
          })`
        )
      )
    )
    child.once('exit', (code) => {
      session.child = null
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(
        new RuntimeClientError(
          'internal',
          `\`${command} ${args.join(' ')}\` exited with code ${code ?? 'null'}.`
        )
      )
    })
  })
}

async function addClaudeAccount({ client, cwd, json }: HandlerContext): Promise<void> {
  const { result: signIn } = await client.call<ClaudeAccountSignIn>(
    'accounts.beginClaudeSignIn',
    getWslAccountTarget(cwd) ?? {},
    { timeoutMs: 300_000 }
  )
  const session: InteractiveLoginSession = {
    child: null,
    registering: false,
    terminationPromise: null
  }
  const result = await withInteractiveLoginCleanup(
    session,
    // Cancel cleans abandoned folders and preserves registered accounts; older hosts may lack the method.
    async () => {
      const { accountId, runtime, wslDistro } = signIn
      await client
        .call('accounts.cancelClaudeSignIn', { accountId, runtime, wslDistro })
        .catch((error: unknown) => console.warn('[account] Could not clean up sign-in:', error))
    },
    async () => {
      if (signIn.runtime === 'wsl' && signIn.wslDistro) {
        const login = `exec env CLAUDE_CONFIG_DIR=${quotePosixShell(signIn.configDir)} claude auth login`
        await runAgentLoginInTerminal(
          'wsl.exe',
          buildWslExecArgs(signIn.wslDistro, ['/bin/sh', '-c', buildWslLoginShellCommand(login)]),
          {},
          json,
          session
        )
      } else {
        await runAgentLoginInTerminal(
          'claude',
          ['auth', 'login'],
          { CLAUDE_CONFIG_DIR: signIn.configDir },
          json,
          session
        )
      }
      session.registering = true
      return client.call<ClaudeRateLimitAccountsState>(
        'accounts.finishClaudeSignIn',
        { accountId: signIn.accountId, runtime: signIn.runtime, wslDistro: signIn.wslDistro },
        { timeoutMs: 300_000 }
      )
    }
  )
  printResult(result, json, (state) => formatAccountsBlock('Claude', state))
}

async function addCodexAccount({ client, cwd, json }: HandlerContext): Promise<void> {
  const codexHome = mkdtempSync(join(tmpdir(), 'orca-account-add-codex-'))
  const session: InteractiveLoginSession = {
    child: null,
    registering: false,
    terminationPromise: null
  }
  const result = await withInteractiveLoginCleanup(
    session,
    async () => {
      rmSync(codexHome, { recursive: true, force: true })
    },
    async () => {
      // Why: plain OAuth binds a loopback callback the user's browser cannot reach
      // on a headless host; device auth is explicitly designed for this flow.
      await runAgentLoginInTerminal(
        'codex',
        ['login', '--device-auth'],
        { CODEX_HOME: codexHome },
        json,
        session
      )
      session.registering = true
      return client.call<CodexRateLimitAccountsState>('accounts.addCodexFromHome', {
        sourceHome: codexHome,
        ...getWslAccountTarget(cwd)
      })
    }
  )
  printResult(result, json, (state) => formatAccountsBlock('Codex', state))
}

async function assertAccountImportSupported({ client }: HandlerContext): Promise<void> {
  const status = await client.call<RuntimeStatus>('status.get')
  if (!status.result.capabilities?.includes(ACCOUNT_IMPORT_RUNTIME_CAPABILITY)) {
    throw new RuntimeClientError(
      'incompatible_runtime',
      'The running Orca runtime is too old to add accounts from the CLI. Update or restart Orca and try again.'
    )
  }
}

/** CLI handlers for `orca account add [--agent claude|codex]` and `orca account list`. */
export const ACCOUNT_HANDLERS: Record<string, CommandHandler> = {
  'account add': async (ctx) => {
    const agentFlag = ctx.flags.get('agent')
    // Why: a valueless `--agent` parses as boolean true; defaulting it to claude
    // would silently run a full OAuth login for the provider the user did not ask for.
    if (agentFlag !== undefined && typeof agentFlag !== 'string') {
      throw new RuntimeClientError(
        'invalid_argument',
        'Missing a value for --agent. Use `--agent claude` or `--agent codex`.'
      )
    }
    const agent = agentFlag ?? 'claude'
    if (agent !== 'claude' && agent !== 'codex') {
      throw new RuntimeClientError(
        'invalid_argument',
        `Unsupported --agent "${agent}". Use "claude" or "codex".`
      )
    }
    // Check runtime support before spending an OAuth round trip.
    await assertAccountImportSupported(ctx)
    await ctx.client.call('accounts.list', { refreshUsage: false })
    await (agent === 'claude' ? addClaudeAccount(ctx) : addCodexAccount(ctx))
  },
  'account list': async (ctx) => {
    const { client, json } = ctx
    // Listing shows no usage, so avoid a serial provider refresh for every account.
    const result = await client.call<AccountsListSnapshot>('accounts.list', {
      refreshUsage: false
    })
    printResult(
      result,
      json,
      (snapshot) =>
        `${formatAccountsBlock('Claude', snapshot.claude)}\n\n${formatAccountsBlock('Codex', snapshot.codex)}`
    )
  }
}
