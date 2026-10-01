import { app } from 'electron'
import { RateLimitService } from '../rate-limits/service'
import { CodexRuntimeHomeService } from '../codex-accounts/runtime-home-service'
import { CodexAccountService } from '../codex-accounts/service'
import { ClaudeRuntimeAuthService } from '../claude-accounts/runtime-auth-service'
import { ClaudeAccountService } from '../claude-accounts/service'
import { KeybindingService } from '../keybindings/keybinding-service'
import { createCodexSessionMigrationScheduler } from '../codex/codex-session-migration-scheduler'
import { startCodexSessionBackfillInBackground } from '../codex/codex-session-backfill'
import { startCodexSessionIndexHealInBackground } from '../codex/codex-session-index-heal'
import { startCodexStateDbBackfillRecoveryInBackground } from '../codex/codex-state-db-backfill-recovery'
import { getOrcaManagedCodexHomePath } from '../codex/codex-home-paths'
import { getInitialCodexRateLimitTarget } from '../rate-limits/codex-rate-limit-target'
import { getInitialClaudeRateLimitTarget } from '../rate-limits/claude-rate-limit-target'
import { createAccountRuntimeTargetSettingsSync } from '../rate-limits/account-runtime-target-sync'
import { agentHookServer } from '../agent-hooks/server'
import {
  isRealHomeCodexHookLaneUsable,
  setRealHomeCodexHooksEnabledReader
} from '../codex/codex-real-home-hook-install'
import { isAgentStatusHooksEnabledForAgent } from '../agent-hooks/managed-agent-hook-controls'
import { resolveHostCodexSessionSourceHome } from '../codex/codex-session-source-home'
import { browserManager } from '../browser/browser-manager'
import { mainProcessState as state } from './main-process-state'

export function initializeMainProcessAccountServices(): void {
  const store = state.store
  if (
    !store ||
    !state.claudeUsage ||
    !state.codexUsage ||
    !state.openCodeUsage ||
    !state.museUsage
  ) {
    throw new Error('Usage stores must be initialized before account services')
  }
  state.rateLimits = new RateLimitService()
  state.codexRuntimeHome = new CodexRuntimeHomeService(store)
  void startCodexStateDbBackfillRecoveryInBackground(getOrcaManagedCodexHomePath())
  // Why: an incapable trust-grant host must fall back to the managed home for
  // every consumer (PTY env, rate limits, commit messages) in one place.
  state.codexRuntimeHome.setRealHomeLaneGate(() => isRealHomeCodexHookLaneUsable())
  setRealHomeCodexHooksEnabledReader(() =>
    isAgentStatusHooksEnabledForAgent(store.getSettings(), 'codex')
  )
  state.codexSessionMigration = createCodexSessionMigrationScheduler({
    isEligible: () =>
      state.codexRuntimeHome?.isHostSystemDefaultSessionMigrationEligible() === true,
    isQuitting: () => state.isQuitting,
    resolveSystemCodexHomePathOverride: () =>
      resolveHostCodexSessionSourceHome(store.getSettings()),
    prepareScheduledRun: (scanDates) =>
      state.codexRuntimeHome?.prepareHostSystemDefaultSessionMigrationPass(scanDates),
    finishScheduledRun: () => state.codexRuntimeHome?.finishHostSystemDefaultSessionMigrationPass(),
    startBackfill: startCodexSessionBackfillInBackground,
    startIndexHeal: startCodexSessionIndexHealInBackground
  })
  state.codexAccounts = new CodexAccountService(store, state.rateLimits, state.codexRuntimeHome, {
    onHostSystemDefaultSelected: state.codexSessionMigration.requestRun
  })
  // Why: migrate historical shared-home sessions after startup; compatibility
  // launches re-arm the non-destructive pass for new rollouts (#4444, #8612, #12480).
  state.codexSessionMigration.scheduleInitialRun()
  state.claudeRuntimeAuth = new ClaudeRuntimeAuthService(store)
  state.claudeAccounts = new ClaudeAccountService(store, state.rateLimits, state.claudeRuntimeAuth)
  state.rateLimits.setCodexFetchTarget(getInitialCodexRateLimitTarget(store.getSettings()))
  state.rateLimits.setClaudeFetchTarget(getInitialClaudeRateLimitTarget(store.getSettings()))
  const syncAccountRuntimeTargets = createAccountRuntimeTargetSettingsSync(
    state.rateLimits,
    store.getSettings()
  )
  store.onSettingsChanged((updates, settings) => {
    // Why: auto is a live policy; retarget only providers whose settings-derived runtime changed.
    void syncAccountRuntimeTargets(updates, settings).catch((error) =>
      console.warn('[rate-limits] Failed to apply account runtime target:', error)
    )
  })
  state.rateLimits.setClaudeAuthPreparationResolver((target) =>
    state.claudeRuntimeAuth!.prepareForRateLimitFetch(target)
  )
  // Why: live Claude sessions stream usage windows through their statusLine command; feeding them here avoids OAuth usage-endpoint polling (and its 429s).
  agentHookServer.setClaudeStatusLineListener((event) => {
    state.rateLimits!.ingestLiveClaudeRateLimits(event)
  })
  state.keybindings = new KeybindingService({
    homePath: app.getPath('home'),
    getLegacyOverrides: () => store.getSettings().keybindings,
    legacyTabSwitchSeed: {
      isPending: () => store.getSettings().tabSwitchKeybindingSeed === 'pending',
      markSeeded: () => store.updateSettings({ tabSwitchKeybindingSeed: 'done' })
    }
  })
  browserManager.setSettingsResolver(() => ({ keybindings: state.keybindings?.getOverrides() }))
}
