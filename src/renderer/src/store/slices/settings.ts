import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { normalizeTerminalQuickCommands } from '../../../../shared/terminal-quick-commands'
import { normalizeTerminalCustomThemes } from '../../../../shared/terminal-custom-themes'
import { normalizeTaskProviderSettings } from '../../../../shared/task-providers'
import { normalizeOpenInApplications } from '../../../../shared/open-in-applications'
import { createSettingsSearchState, type SettingsSearchState } from './settings-search-state'
import { isRuntimeCatalogListingStale } from './runtime-status-hydration'
import { normalizeDisabledTuiAgents } from '../../../../shared/tui-agent-selection'
import {
  normalizeTuiAgentArgsRecord,
  normalizeTuiAgentEnvRecord
} from '../../../../shared/tui-agent-launch-defaults'
import { normalizeUiLanguage } from '../../../../shared/ui-language'
import { normalizeDesktopTerminalScrollbackRows } from '../../../../shared/terminal-scrollback-policy'
import {
  normalizeMobilePairingCustomAddress,
  normalizeMobilePairingCustomAddresses
} from '../../../../shared/mobile-pairing-custom-address'
import type { WorktreeVisibilityDefaultsByHost } from './worktree-visibility-owner-settings'
import * as ownerHydration from './settings-owner-hydration-publication'
import { persistVisibilityAwareSettings } from './worktree-visibility-settings-write'
import { getSettingsFocusedExecutionHostId } from '../../../../shared/execution-host'
import { createBrowserUuid } from '@/lib/browser-uuid'

export type SettingsSlice = SettingsSearchState & {
  settings: GlobalSettings | null
  worktreeVisibilityDefaultsByHost: WorktreeVisibilityDefaultsByHost
  worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId: string | null
  worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId: string | null
  fetchSettings: (options?: ownerHydration.FetchSettingsOptions) => Promise<void>
  awaitOwnerWorktreeVisibilityDefaultsHydration: () => Promise<void>
  updateSettings: (updates: Partial<GlobalSettings>) => Promise<void>
  updateSettingsOrThrow: (updates: Partial<GlobalSettings>) => Promise<void>
}

type LegacyTerminalScrollbackSettingsUpdate = Partial<GlobalSettings> & {
  terminalScrollbackBytes?: unknown
}

function normalizeSettingsUpdates(
  updates: Partial<GlobalSettings>,
  currentSettings: GlobalSettings | null
): Partial<GlobalSettings> {
  const { terminalScrollbackBytes: _legacyScrollbackBytes, ...sanitizedUpdates } =
    updates as LegacyTerminalScrollbackSettingsUpdate
  void _legacyScrollbackBytes
  if ('terminalQuickCommands' in updates) {
    sanitizedUpdates.terminalQuickCommands = normalizeTerminalQuickCommands(
      updates.terminalQuickCommands
    )
  }
  if ('terminalCustomThemes' in updates) {
    sanitizedUpdates.terminalCustomThemes = normalizeTerminalCustomThemes(
      updates.terminalCustomThemes
    )
  }
  if ('visibleTaskProviders' in updates || 'defaultTaskSource' in updates) {
    const taskProviderSettings = normalizeTaskProviderSettings({
      visibleTaskProviders:
        'visibleTaskProviders' in updates
          ? updates.visibleTaskProviders
          : currentSettings?.visibleTaskProviders,
      defaultTaskSource:
        'defaultTaskSource' in updates
          ? updates.defaultTaskSource
          : currentSettings?.defaultTaskSource
    })
    sanitizedUpdates.defaultTaskSource = taskProviderSettings.defaultTaskSource
    sanitizedUpdates.visibleTaskProviders = taskProviderSettings.visibleTaskProviders
  }
  if ('openInApplications' in updates) {
    sanitizedUpdates.openInApplications = normalizeOpenInApplications(updates.openInApplications, {
      createId: createBrowserUuid
    })
  }
  if ('disabledTuiAgents' in updates) {
    sanitizedUpdates.disabledTuiAgents = normalizeDisabledTuiAgents(updates.disabledTuiAgents)
  }
  if ('agentDefaultArgs' in updates) {
    sanitizedUpdates.agentDefaultArgs = normalizeTuiAgentArgsRecord(updates.agentDefaultArgs)
    sanitizedUpdates.agentYoloDefaultsMigrated = true
  }
  if ('agentDefaultEnv' in updates) {
    sanitizedUpdates.agentDefaultEnv = normalizeTuiAgentEnvRecord(updates.agentDefaultEnv)
    sanitizedUpdates.agentYoloDefaultsMigrated = true
  }
  if ('uiLanguage' in updates) {
    sanitizedUpdates.uiLanguage = normalizeUiLanguage(updates.uiLanguage)
  }
  if ('terminalScrollbackRows' in updates) {
    sanitizedUpdates.terminalScrollbackRows = normalizeDesktopTerminalScrollbackRows(
      updates.terminalScrollbackRows
    )
  }
  if ('mobilePairingCustomAddress' in updates) {
    sanitizedUpdates.mobilePairingCustomAddress = normalizeMobilePairingCustomAddress(
      updates.mobilePairingCustomAddress
    )
  }
  if ('mobilePairingCustomAddresses' in updates) {
    sanitizedUpdates.mobilePairingCustomAddresses = normalizeMobilePairingCustomAddresses(
      updates.mobilePairingCustomAddresses
    )
  }
  return sanitizedUpdates
}

async function persistSettingsUpdates(
  set: ownerHydration.SettingsStateSetter,
  updates: Partial<GlobalSettings>,
  currentSettings: GlobalSettings | null,
  supportedRuntimeEnvironmentId: string | null,
  sourceDefaultsSupportedRuntimeEnvironmentId: string | null,
  shouldPublish: () => boolean
): Promise<void> {
  const normalizedUpdates = normalizeSettingsUpdates(updates, currentSettings)
  await persistVisibilityAwareSettings({
    normalizedUpdates,
    currentSettings,
    supportedRuntimeEnvironmentId,
    sourceDefaultsSupportedRuntimeEnvironmentId,
    shouldPublish,
    set
  })
}

/** Every known host has a recorded status entry, and no entry survives for a host that is gone. */
function hasCompleteRuntimeStatusCoverage(
  runtimeEnvironments: AppState['runtimeEnvironments'],
  runtimeStatusByEnvironmentId: AppState['runtimeStatusByEnvironmentId']
): boolean {
  return (
    new Set(runtimeEnvironments.map(({ id }) => id)).size === runtimeStatusByEnvironmentId.size &&
    runtimeEnvironments.every(({ id }) => runtimeStatusByEnvironmentId.has(id))
  )
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get) => ({
  settings: null,
  worktreeVisibilityDefaultsByHost: {},
  worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId: null,
  worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId: null,
  ...createSettingsSearchState((state) => set(state)),

  fetchSettings: async (options) => {
    await ownerHydration.fetchSettingsWithOwnerHydration({ options, set, get })
    const { runtimeEnvironmentCatalogHydrated, runtimeEnvironments, runtimeStatusByEnvironmentId } =
      get()
    // Why: settings refreshes are frequent, but only incomplete host coverage needs
    // the all-host boot probe. A recorded null still means the host was checked.
    if (
      !runtimeEnvironmentCatalogHydrated ||
      !hasCompleteRuntimeStatusCoverage(runtimeEnvironments, runtimeStatusByEnvironmentId) ||
      // Why: coverage is blind to catalog edits from another client or the orca CLI.
      isRuntimeCatalogListingStale()
    ) {
      void get().hydrateRuntimeEnvironmentStatuses()
    }
  },

  awaitOwnerWorktreeVisibilityDefaultsHydration: () =>
    ownerHydration.awaitOwnerWorktreeVisibilityDefaultsHydration(get),

  updateSettings: async (updates) => {
    const shouldPublish = ownerHydration.createSettingsPublicationFence(
      'activeRuntimeEnvironmentId' in updates || 'worktreeVisibilityDefaults' in updates
    )
    const visibilityOwnerHostId = getSettingsFocusedExecutionHostId(get().settings)
    try {
      await persistSettingsUpdates(
        set,
        updates,
        get().settings,
        get().worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId,
        get().worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId,
        shouldPublish
      )
      if ('worktreeVisibilityDefaults' in updates) {
        await get().fetchAllWorktrees({ visibilityOwnerHostId })
      }
    } catch (err) {
      console.error('Failed to update settings:', err)
    }
  },

  updateSettingsOrThrow: async (updates) => {
    const shouldPublish = ownerHydration.createSettingsPublicationFence(
      'activeRuntimeEnvironmentId' in updates || 'worktreeVisibilityDefaults' in updates
    )
    const visibilityOwnerHostId = getSettingsFocusedExecutionHostId(get().settings)
    await persistSettingsUpdates(
      set,
      updates,
      get().settings,
      get().worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId,
      get().worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId,
      shouldPublish
    )
    if ('worktreeVisibilityDefaults' in updates) {
      await get().fetchAllWorktrees({ visibilityOwnerHostId })
    }
  }
})
