import {
  applySessionSearchSettingsChange,
  installChildSessionSearchService
} from '../ai-vault-search/session-search-enablement'
import { resolveTuiAgentLaunchEnv } from '../../shared/tui-agent-launch-defaults'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { sessionSearchScopeCatalogFromStore } from '../ai-vault-search/session-search-store-scope-catalog'
import { getCanonicalUserDataPath } from '../persistence/loading-store/user-data-path'
import { app } from 'electron'
import { OrcaRuntimeService } from '../runtime/orca-runtime'
import { getLocalPtyProvider } from '../ipc/pty/provider/registry'
import { clearProviderPtyState } from '../ipc/pty/provider/state-cleanup'
import { agentHookServer } from '../agent-hooks/server'
import { toAgentStatusIpcPayload } from '../agent-hooks/server/server-status-identity'
import { browserManager } from '../browser/browser-manager'
import { browserSessionRegistry } from '../browser/browser-session-registry'
import { loadAgentSessionClaimSigner } from '../runtime/agent-session/ownership/agent-session-claim-identity'
import { getProfileUserDataPath } from '../orca-profiles/profile-storage-paths'
import { prepareCodexPinnedLaunchHome } from './codex-session-resume-launch'
import { resolveHostCodexSessionSourceHome } from '../codex/codex-session-source-home'
import { agentHookRuntimeDeps } from '../agent-hooks/agent-hook-runtime-deps'
import { getDaemonProvider } from '../daemon/daemon-provider-state'
import type { TerminalSideEffectBatch } from '../../shared/terminal-side-effect-facts'
import { mainProcessState as state } from './main-process-state'
import {
  codexStructuredLaunchHomeResolvers,
  prepareCodexRuntimeHomeForLaunch
} from './codex-launch-preparation'
import { resolveHostAgentBaseEnvironment } from '../runtime/structured-agent-shell-environment'
import type { RuntimeDesktopWindowStatus } from '../../shared/runtime-types'
import {
  AgentStatusObservedPaneIdentities,
  recordObservedAgentStatusPaneIdentity
} from '../runtime/agent-status-observed-pane-identity'
import { ORCA_LAYOUT_OWNER_IS_MAIN } from '../../shared/layout-owner-switch'
import { isAgentStatusHooksEnabled } from '../../shared/agent-status-hooks-setting'
import { prepareCodexAiVaultSessionResume } from '../codex/codex-ai-vault-session-resume'

export function getDesktopWindowStatus(): RuntimeDesktopWindowStatus {
  const activation = state.desktopActivationGate
  if (!activation) {
    return 'available'
  }
  const value = activation.getState()
  return value === 'ready' ? 'openable' : value
}

export function initializeMainProcessRuntime(): OrcaRuntimeService {
  const store = state.store
  const stats = state.stats
  if (!store || !stats) {
    throw new Error('Store and stats must be initialized before runtime')
  }
  // Why here and not in the window listener: `subscribeEnrichedStatus` also fires under headless
  // `orca serve`, which never opens one, and the fleet path runs there too.
  const observedPaneIdentities = new AgentStatusObservedPaneIdentities()
  const runtime = new OrcaRuntimeService(store, stats, {
    ...agentHookRuntimeDeps(agentHookServer, observedPaneIdentities, () =>
      state.store?.getSettings()
    ),
    prepareClaudeAuth: (target) => state.claudeRuntimeAuth!.prepareForClaudeLaunch(target),
    agentSessionClaimSigner: loadAgentSessionClaimSigner(
      getProfileUserDataPath(),
      getProfileUserDataPath()
    ),
    // Why: resolve the PTY provider lazily — a daemon swap happens later, so an eager reference would freeze the pre-daemon provider (design §4.3).
    getLocalProvider: () => getLocalPtyProvider(),
    onPtyStopped: clearProviderPtyState,
    // Why: serve can be promoted in place, so wire the listener from startup; runtime enables desktop-only scanners only for a ready renderer.
    onTerminalSideEffects: (batch: TerminalSideEffectBatch) => {
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('pty:sideEffect', batch)
      }
    },
    getDesktopWindowStatus,
    attestAgentHookCompatibilityAuthority: (candidate) =>
      agentHookServer.attestCompatibilityAuthority(candidate),
    retireAgentHookCompatibilityAuthority: (paneKey) =>
      agentHookServer.retirePaneAuthority(paneKey),
    canRecoverPersistentLocalPtys: () => getDaemonProvider() !== null,
    // Why: source codex-home here (runs in window AND serve) so aiVault.listSessions includes managed-Codex sessions; registerCoreHandlers is window-only.
    getAdditionalAiVaultCodexHomePaths: () =>
      state.codexRuntimeHome?.getHostCodexHomePathsForSessionDiscovery() ?? [],
    prepareAiVaultSessionResume: (args) =>
      prepareCodexAiVaultSessionResume(args, {
        runtimeHome: state.codexRuntimeHome,
        systemCodexHomePath: resolveHostCodexSessionSourceHome(store.getSettings()),
        preparePinnedLaunchHome: (home) => prepareCodexPinnedLaunchHome(home)
      }),
    ...codexStructuredLaunchHomeResolvers,
    prepareCodexCatalogProbeHome: (homePath) =>
      state.codexRuntimeHome?.prepareHostCodexHomeForReadOnlyAppServer(
        homePath,
        resolveTuiAgentLaunchEnv('codex', store.getSettings())
      ),
    buildAgentHookPtyEnv: () =>
      isAgentStatusHooksEnabled(state.store?.getSettings()) ? agentHookServer.buildPtyEnv() : {},
    // Why the same function the settings IPC handler calls: a paired client's write and a
    // local one must reconcile the scanner child through one path, or they can disagree.
    applySessionSearchSettings: applySessionSearchSettingsChange,
    skillTransactionRecovery: state.skillTransactionRecovery
  })
  // Both desktop and headless serve own a host-local search service.
  const sessionSearch = installChildSessionSearchService({
    dataRoot: getCanonicalUserDataPath(),
    getSettings: () => store.getSettings(),
    // Why read per request rather than snapshot: a repo added or a workspace
    // renamed between two searches has to be in scope for the second one.
    // This process answers for its own host, so the catalog is bound to it here.
    getScopeCatalog: () => sessionSearchScopeCatalogFromStore(store, LOCAL_EXECUTION_HOST_ID)
  })
  app.once('will-quit', () => sessionSearch?.dispose())
  state.runtime = runtime
  runtime.attachAgentStatusStore(agentHookServer)
  agentHookServer.subscribeEnrichedStatus((enriched) =>
    recordObservedAgentStatusPaneIdentity(observedPaneIdentities, enriched, runtime)
  )
  agentHookServer.setCliWriterExecutionMatcher(observedPaneIdentities, runtime)
  // Switch point: main keeps the resume record of each pane it holds from the status it accepts.
  if (ORCA_LAYOUT_OWNER_IS_MAIN) {
    agentHookServer.subscribeEnrichedStatus((enriched) =>
      runtime.recordHookStatusResume(toAgentStatusIpcPayload(enriched))
    )
    agentHookServer.subscribePaneStatusClear((clear) => runtime.forgetHookStatusResume(clear))
    agentHookServer.subscribeStatusDrop((paneKey) => runtime.forgetHookStatusResume({ paneKey }))
  }
  // Why before anything can attach: a client host that reattaches to a restarted runtime is only
  // handed its pages back if the runtime found them first.
  runtime.rehydrateClientHostedBrowserPages()
  browserManager.setBrowserGuestStateChangedListener((worktreeId) => {
    runtime.notifyMobileSessionTabsChanged(worktreeId)
  })
  browserSessionRegistry.onProfilesChanged = () => runtime.notifyBrowserProfilesChanged()
  return runtime
}

export function configureRuntimeServices(runtime: OrcaRuntimeService): void {
  const store = state.store
  const claudeAccounts = state.claudeAccounts
  const codexAccounts = state.codexAccounts
  const rateLimits = state.rateLimits
  if (!store || !claudeAccounts || !codexAccounts || !rateLimits) {
    throw new Error('Account services must be initialized before runtime wiring')
  }
  runtime.setAccountServices({ claudeAccounts, codexAccounts, rateLimits })
  runtime.setCommitMessageAgentEnvironmentResolvers({
    // Why: Codex hooks/auth live in Orca's managed runtime home even for the default path, so every launch must resolve CODEX_HOME via runtime-home.
    prepareForCodexLaunch: prepareCodexRuntimeHomeForLaunch,
    prepareForClaudeLaunch: (target) => state.claudeRuntimeAuth!.prepareForClaudeLaunch(target),
    resolveBaseEnvironment: () => resolveHostAgentBaseEnvironment(store.getSettings())
  })
}
