import type { BrowserWindow } from 'electron'
import type { ClaudeStatusLineRateLimits } from '../../shared/claude-statusline-rate-limits'
import type { RateLimitState } from '../../shared/rate-limit-types'
import { hasMiniMaxApiKey } from '../minimax/minimax-api-key-store'
import { hasMiniMaxSessionCookie } from '../minimax/minimax-cookie-store'
import { mapClaudeUsageWindow } from './claude-usage-window'
import { readGrokAuthSession } from './grok-auth'
import {
  LIVE_CLAUDE_INGEST_DEDUPE_MS,
  isSameUsageWindow,
  normalizeClaudeAccountSelectionTarget,
  normalizeClaudeConfigDir,
  normalizeCodexAccountSelectionTarget,
  type ClaudeAccountSelectionTarget,
  type ClaudeAuthPreparationResolver,
  type CodexAccountSelectionTarget,
  type InternalRateLimitState,
  type NormalizedClaudeAccountSelectionTarget,
  type NormalizedCodexAccountSelectionTarget
} from './service/service-types'

export type { InactiveCodexAccountInfo } from './service/service-types'

type ClaudeAuthSnapshot = { configDir: string | null; provenance: string }

/**
 * Local-only rate-limit state. Nothing here polls a vendor: the only producer is the Claude
 * statusline hook (`ingestLiveClaudeRateLimits`), which a running `claude` CLI posts to the
 * loopback hook server. Every other provider slot stays `null`.
 */
export class RateLimitService {
  private state: InternalRateLimitState = {
    claude: null,
    codex: null,
    gemini: null,
    opencodeGo: null,
    kimi: null,
    antigravity: null,
    minimax: null,
    grok: null,
    cursor: null,
    zcode: null
  }
  private claudeFetchTarget: NormalizedClaudeAccountSelectionTarget = {
    runtime: 'host',
    wslDistro: null
  }
  private codexFetchTarget: NormalizedCodexAccountSelectionTarget = {
    runtime: 'host',
    wslDistro: null
  }
  private claudeAuthPreparationResolver: ClaudeAuthPreparationResolver | null = null
  private claudeAuthSnapshot: ClaudeAuthSnapshot | null = null
  // Why: a switch during the resolver await must not attribute the outgoing account's posts to the new bar.
  private claudeSnapshotGeneration = 0
  private readonly stateListeners = new Set<(state: RateLimitState) => void>()
  private mainWindow: BrowserWindow | null = null
  private detachWindowListeners: (() => void) | null = null

  attach(mainWindow: BrowserWindow): void {
    this.detachWindowListeners?.()
    this.mainWindow = mainWindow
    const onClosed = (): void => {
      if (this.mainWindow === mainWindow) {
        this.mainWindow = null
      }
      this.detachWindowListeners = null
    }
    mainWindow.on('closed', onClosed)
    this.detachWindowListeners = () => mainWindow.removeListener('closed', onClosed)
  }

  stop(): void {
    this.detachWindowListeners?.()
    this.detachWindowListeners = null
    this.mainWindow = null
  }

  onStateChange(listener: (state: RateLimitState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  getState(): RateLimitState {
    return {
      ...this.state,
      minimaxCookieConfigured: hasMiniMaxSessionCookie(),
      minimaxApiKeyConfigured: hasMiniMaxApiKey(),
      opencodeGoApiKeyConfigured: false,
      grokAuthConfigured: readGrokAuthSession().status === 'ok',
      cursorAuthConfigured: false,
      claudeTarget: this.claudeFetchTarget,
      codexTarget: this.codexFetchTarget,
      inactiveClaudeAccounts: [],
      inactiveCodexAccounts: []
    }
  }

  // Why no eager capture: the resolver runs `syncForCurrentSelection`, which must not race a surviving daemon
  // Claude at startup (see main-process-ready-foundation.ts); the first statusline post or target change captures it.
  setClaudeAuthPreparationResolver(resolver: ClaudeAuthPreparationResolver): void {
    this.claudeAuthPreparationResolver = resolver
  }

  setClaudeFetchTarget(target?: ClaudeAccountSelectionTarget): void {
    this.claudeFetchTarget = normalizeClaudeAccountSelectionTarget(target)
  }

  setCodexFetchTarget(target?: CodexAccountSelectionTarget): void {
    this.codexFetchTarget = normalizeCodexAccountSelectionTarget(target)
  }

  async refreshForClaudeAccountChange(
    _outgoingAccountId?: string | null,
    target?: ClaudeAccountSelectionTarget
  ): Promise<RateLimitState> {
    return this.refreshClaudeForTarget(target)
  }

  async refreshClaudeForTarget(target?: ClaudeAccountSelectionTarget): Promise<RateLimitState> {
    this.claudeFetchTarget = normalizeClaudeAccountSelectionTarget(target)
    // Why: live windows belong to the previous account; the next statusline post repopulates the bar.
    this.updateState({ ...this.state, claude: null })
    await this.captureClaudeAuthSnapshot()
    return this.getState()
  }

  async refreshForCodexAccountChange(
    _outgoingAccountId?: string | null,
    target?: CodexAccountSelectionTarget
  ): Promise<RateLimitState> {
    return this.refreshCodexForTarget(target)
  }

  async refreshCodexForTarget(target?: CodexAccountSelectionTarget): Promise<RateLimitState> {
    this.codexFetchTarget = normalizeCodexAccountSelectionTarget(target)
    this.updateState({ ...this.state, codex: null })
    return this.getState()
  }

  // Why kept: account services call these on removal; there is no inactive cache any more, so only the snapshot is republished.
  evictInactiveClaudeCache(_accountId: string): void {
    this.pushToRenderer()
  }

  evictInactiveCodexCache(_accountId: string): void {
    this.pushToRenderer()
  }

  /** Live usage windows forwarded from a Claude session's statusLine command. */
  ingestLiveClaudeRateLimits(event: ClaudeStatusLineRateLimits): void {
    const snapshot = this.claudeAuthSnapshot
    if (!snapshot) {
      console.debug('[rate-limits] dropped live Claude usage: no auth snapshot yet', {
        eventConfigDir: event.configDir
      })
      void this.captureClaudeAuthSnapshot()
      return
    }
    // Why: sessions of other accounts (or other runtimes) report their own quota; mixing them into the active account's bar would lie.
    if (normalizeClaudeConfigDir(event.configDir) !== snapshot.configDir) {
      console.debug('[rate-limits] dropped live Claude usage: configDir mismatch', {
        eventConfigDir: event.configDir,
        snapshotConfigDir: snapshot.configDir
      })
      return
    }
    const freshSession = mapClaudeUsageWindow(event.fiveHour ?? undefined, 300)
    const freshWeekly = mapClaudeUsageWindow(event.sevenDay ?? undefined, 10080)
    if (!freshSession && !freshWeekly) {
      return
    }
    const previous = this.state.claude
    // Why: statusline payloads can carry a single window; an absent one means "no update", not "cleared".
    const session = freshSession ?? previous?.session ?? null
    const weekly = freshWeekly ?? previous?.weekly ?? null
    if (
      previous?.status === 'ok' &&
      previous.usageMetadata?.source === 'live-session' &&
      Date.now() - previous.updatedAt < LIVE_CLAUDE_INGEST_DEDUPE_MS &&
      isSameUsageWindow(previous.session, session) &&
      isSameUsageWindow(previous.weekly, weekly)
    ) {
      return
    }
    this.updateState({
      ...this.state,
      claude: {
        provider: 'claude',
        session,
        weekly,
        fableWeekly: previous?.fableWeekly ?? null,
        updatedAt: Date.now(),
        error: null,
        status: 'ok',
        usageMetadata: {
          source: 'live-session',
          lastSuccessfulSource: 'live-session',
          credentialSource: previous?.usageMetadata?.credentialSource,
          retryAtMs: previous?.usageMetadata?.retryAtMs,
          authProvenance: snapshot.provenance
        }
      }
    })
  }

  private async captureClaudeAuthSnapshot(): Promise<void> {
    const resolver = this.claudeAuthPreparationResolver
    if (!resolver) {
      return
    }
    const generation = ++this.claudeSnapshotGeneration
    const target = this.claudeFetchTarget
    try {
      const preparation = await resolver(target)
      if (generation !== this.claudeSnapshotGeneration) {
        return
      }
      this.claudeAuthSnapshot = {
        configDir: normalizeClaudeConfigDir(preparation.envPatch.CLAUDE_CONFIG_DIR),
        provenance: preparation.provenance ?? 'system'
      }
    } catch (error) {
      console.warn('[rate-limits] could not resolve the Claude auth snapshot:', error)
    }
  }

  private updateState(next: InternalRateLimitState): void {
    this.state = next
    this.pushToRenderer()
  }

  private pushToRenderer(): void {
    const state = this.getState()
    for (const listener of this.stateListeners) {
      try {
        listener(state)
      } catch {
        // ignore — one bad listener must not break the others
      }
    }
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }
    this.mainWindow.webContents.send('rateLimits:update', state)
  }
}
