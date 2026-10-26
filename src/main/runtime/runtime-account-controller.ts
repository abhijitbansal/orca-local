import type { ClaudeAccountService } from '../claude-accounts/service'
import type { CodexAccountService } from '../codex-accounts/service'
import type { CodexAccountSelectionTarget } from '../codex-accounts/runtime-selection'
import type { RateLimitService } from '../rate-limits/service'
import type {
  ClaudeAccountSignIn,
  ClaudeRateLimitAccountsState,
  ClaudeSignInRequest,
  CodexRateLimitAccountsState
} from '../../shared/managed-account-types'
import type { RateLimitState } from '../../shared/rate-limit-types'
import type { CommitMessageAgentEnvironmentResolvers } from '../text-generation/commit-message-agent-environment'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'
import type { HostAccountLaunchEnv } from '../../shared/host-account-launch-env'
import type {
  HostAccountSignInChannel,
  HostAccountSignInProvider,
  HostAccountSignInStatus
} from '../../shared/host-account-sign-in-types'
import {
  hostAccountLaunchEnvFor,
  hostAccountsManagedByDesktopMessage
} from '../../shared/host-account-launch-env'
import { retireAtRestCommandContext } from '../native-chat/agent-session-wire/at-rest-command-context'

export type RuntimeAccountServices = {
  claudeAccounts: ClaudeAccountService
  codexAccounts: CodexAccountService
  rateLimits: RateLimitService
}

export type AccountsSnapshot = {
  claude: ClaudeRateLimitAccountsState
  codex: CodexRateLimitAccountsState
  rateLimits: RateLimitState
}

export class RuntimeAccountController {
  private services: RuntimeAccountServices | null = null
  private commitMessageAgentEnvironment: CommitMessageAgentEnvironmentResolvers | null = null
  /** Pushed by the desktop that owns this host's accounts; held in memory, re-pushed on connect. */
  private hostLaunchEnv: HostAccountLaunchEnv | null = null
  private persistHostLaunchEnv: ((launchEnv: HostAccountLaunchEnv) => void) | null = null

  setServices(services: RuntimeAccountServices): void {
    this.services = services
  }

  setCommitMessageAgentEnvironment(resolvers: CommitMessageAgentEnvironmentResolvers): void {
    this.commitMessageAgentEnvironment = resolvers
  }

  getCommitMessageAgentEnvironment(): CommitMessageAgentEnvironmentResolvers | undefined {
    if (this.commitMessageAgentEnvironment) {
      return this.commitMessageAgentEnvironment
    }
    const hostLaunchEnv = this.hostLaunchEnv
    if (!hostLaunchEnv) {
      return undefined
    }
    return {
      prepareForCodexLaunch: () => hostLaunchEnv.terminal.CODEX_HOME ?? null,
      prepareForClaudeLaunch: async () => ({
        configDir: hostLaunchEnv.claude.CLAUDE_CONFIG_DIR ?? '',
        envPatch: { ...hostLaunchEnv.claude },
        provenance: 'desktop-host-launch-env'
      })
    }
  }

  /** Refused where this host has account services of its own: they already decide every launch. */
  setHostLaunchEnv(launchEnv: HostAccountLaunchEnv): void {
    if (this.services) {
      throw new Error('This host manages its own provider accounts.')
    }
    const previous = this.hostLaunchEnv
    this.hostLaunchEnv = launchEnv
    if (JSON.stringify(previous) !== JSON.stringify(launchEnv)) {
      retireAtRestCommandContext()
    }
    try {
      this.persistHostLaunchEnv?.(launchEnv)
    } catch (error) {
      // Why not refuse: the env already applies; only a restart before the next push loses it.
      console.warn('[accounts] Could not save the host account env:', error)
    }
  }

  /** orcad's store: starts from the last pushed env, so launches before a reconnect keep it. */
  restoreHostLaunchEnv(
    saved: HostAccountLaunchEnv | null,
    persist: (launchEnv: HostAccountLaunchEnv) => void
  ): void {
    this.persistHostLaunchEnv = persist
    if (saved && !this.services) {
      const previous = this.hostLaunchEnv
      this.hostLaunchEnv = saved
      if (JSON.stringify(previous) !== JSON.stringify(saved)) {
        retireAtRestCommandContext()
      }
    }
  }

  /** The desktop-selected account env for a process `agent` starts here; empty when none. */
  hostLaunchEnvFor(agent: string | null | undefined): Readonly<Record<string, string>> {
    return hostAccountLaunchEnvFor(this.hostLaunchEnv, agent)
  }

  /** Null where the desktop that owns this host's accounts polls usage instead (a WSL host). */
  usageRateLimits(): RateLimitService | null {
    return this.services?.rateLimits ?? null
  }

  /** Refuses where no poller would read a saved key, so a save is never reported for nothing. */
  requireUsageRateLimits(): RateLimitService {
    return this.requireServices().rateLimits
  }

  getClaudeConfigDirectory(target: ClaudeAccountSelectionTarget): string | null {
    return this.services?.claudeAccounts.getRuntimeConfigDir(target) ?? null
  }

  getSnapshot(): AccountsSnapshot {
    const { claudeAccounts, codexAccounts, rateLimits } = this.requireServices()
    return {
      claude: claudeAccounts.listAccounts(),
      codex: codexAccounts.listAccounts(),
      rateLimits: rateLimits.getState()
    }
  }

  selectClaude(accountId: string | null): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.selectAccount(accountId)
  }

  selectCodex(accountId: string | null): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.selectAccount(accountId)
  }

  selectCodexForTarget(
    accountId: string | null,
    target: CodexAccountSelectionTarget
  ): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.selectAccountForTarget(accountId, target)
  }

  removeClaude(accountId: string): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.removeAccount(accountId)
  }

  beginClaudeSignIn(request: ClaudeSignInRequest): Promise<ClaudeAccountSignIn> {
    return this.requireServices().claudeAccounts.beginSignIn(request)
  }

  finishClaudeSignIn(
    signIn: Omit<ClaudeAccountSignIn, 'configDir'>
  ): Promise<ClaudeRateLimitAccountsState> {
    return this.requireServices().claudeAccounts.finishSignIn(signIn)
  }

  cancelClaudeSignIn(signIn: Omit<ClaudeAccountSignIn, 'configDir'>): Promise<void> {
    return this.requireServices().claudeAccounts.cancelSignIn(signIn)
  }

  /** Adds a host account whose login a client on another device finishes. */
  async runHostSignIn(
    provider: HostAccountSignInProvider,
    channel: HostAccountSignInChannel
  ): Promise<Pick<HostAccountSignInStatus, 'claude' | 'codex'>> {
    const { claudeAccounts, codexAccounts } = this.requireServices()
    return provider === 'claude'
      ? { claude: await claudeAccounts.addAccountWithPastedCode(channel) }
      : { codex: await codexAccounts.addAccountWithDeviceCode(channel) }
  }

  removeCodex(accountId: string): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.removeAccount(accountId)
  }

  addCodexFromHome(
    sourceHome: string,
    target?: { runtime?: 'host' | 'wsl'; wslDistro?: string | null }
  ): Promise<CodexRateLimitAccountsState> {
    return this.requireServices().codexAccounts.addAccountFromHome(sourceHome, target)
  }

  onChanged(listener: (snapshot: AccountsSnapshot) => void): () => void {
    const services = this.requireServices()
    return services.rateLimits.onStateChange((rateLimits) => {
      listener({
        claude: services.claudeAccounts.listAccounts(),
        codex: services.codexAccounts.listAccounts(),
        rateLimits
      })
    })
  }

  private requireServices(): RuntimeAccountServices {
    if (!this.services) {
      throw new Error(
        this.hostLaunchEnv
          ? hostAccountsManagedByDesktopMessage(this.hostLaunchEnv.wslDistro)
          : 'Account services are not configured on this runtime'
      )
    }
    return this.services
  }
}
