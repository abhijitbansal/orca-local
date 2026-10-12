import type { AppState } from '../../../types'
import { findRepoForHost } from '../../repo-host-identity'
import {
  getRepoExecutionHostId,
  parseExecutionHostId,
  type ExecutionHostId
} from '../../../../../../shared/execution-host'
import { WORKTREE_REMOVAL_AMBIGUOUS_ERROR } from './worktree-slice-constants'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type { WorktreeMeta } from '../../../../../../shared/worktree/meta-types'
import { getRepoIdFromWorktreeId } from '../../worktree-helpers'
import { isRuntimeSelectorNotFoundError } from './runtime-worktree-rpc-errors'
import { persistWorktreeMeta } from '../metadata/worktree-meta-persist'
import type { WorktreeSliceGet } from './worktree-slice-types'

export function replaceWorktreeInRepoLists(
  worktreesByRepo: Record<string, Worktree[]>,
  updatedWorktree: Worktree
): Record<string, Worktree[]> {
  const repoId = getRepoIdFromWorktreeId(updatedWorktree.id)
  const current = worktreesByRepo[repoId]
  if (!current) {
    return worktreesByRepo
  }
  return {
    ...worktreesByRepo,
    [repoId]: current.map((worktree) =>
      worktree.id === updatedWorktree.id ? updatedWorktree : worktree
    )
  }
}

// Why: activity bumps fire on every PTY event, so an ambiguous workspace would warn continuously.
// One line per workspace is enough to diagnose it (#10634).
export const ambiguousOwnerWarnedWorktreeIds = new Set<string>()

/** Re-arms the once-per-workspace warning; called from every worktree teardown path. */
export function forgetAmbiguousOwnerWarnings(worktreeIds: Iterable<string>): void {
  for (const worktreeId of worktreeIds) {
    ambiguousOwnerWarnedWorktreeIds.delete(worktreeId)
  }
}

export function warnAmbiguousOwnerOnce(worktreeId: string, errorLabel: string): void {
  if (ambiguousOwnerWarnedWorktreeIds.has(worktreeId)) {
    return
  }
  ambiguousOwnerWarnedWorktreeIds.add(worktreeId)
  console.warn(`Skipped ${errorLabel}: workspace identity is ambiguous across hosts`, worktreeId)
}

export function persistPassiveWorktreeMetaForOwner(
  get: WorktreeSliceGet,
  worktreeId: string,
  updates: Partial<WorktreeMeta>,
  errorLabel: string
): void {
  const repoId = getRepoIdFromWorktreeId(worktreeId)
  if (!repoId) {
    warnAmbiguousOwnerOnce(worktreeId, errorLabel)
    return
  }
  const ownerTarget = getActiveRuntimeTarget(settingsForRepoOwner(get(), repoId, undefined, true))
  void persistWorktreeMeta(ownerTarget, worktreeId, updates).catch((err) => {
    if (isRuntimeSelectorNotFoundError(err)) {
      void get().fetchWorktrees(getRepoIdFromWorktreeId(worktreeId))
      return
    }
    console.error(`Failed to ${errorLabel}:`, err)
    void get().fetchWorktrees(getRepoIdFromWorktreeId(worktreeId))
  })
}

function settingsForRuntimeEnvironment(
  settings: AppState['settings'],
  activeRuntimeEnvironmentId: string | null
): AppState['settings'] {
  return settings ? { ...settings, activeRuntimeEnvironmentId } : settings
}

// Why: a runtime: owner keeps its environment id so the RPC seam fails closed instead of running locally.
export function settingsForKnownRepoOwner(
  settings: AppState['settings'],
  repo: { connectionId?: string | null; executionHostId?: ExecutionHostId | null }
): AppState['settings'] {
  if (!repo.executionHostId && !repo.connectionId) {
    return settings
  }
  const parsed = parseExecutionHostId(getRepoExecutionHostId(repo))
  if (parsed?.kind === 'runtime') {
    return settingsForRuntimeEnvironment(settings, parsed.environmentId)
  }
  return settings?.activeRuntimeEnvironmentId
    ? settingsForRuntimeEnvironment(settings, null)
    : settings
}

export function settingsForRepoOwner(
  state: Pick<AppState, 'repos' | 'settings'>,
  repoId: string,
  hostId?: ExecutionHostId | null,
  honorMissingHostId = false
): AppState['settings'] {
  const repo = findRepoForHost(state.repos, repoId, { hostId, settings: state.settings })
  if (repo) {
    return settingsForKnownRepoOwner(state.settings, repo)
  }
  const parsedHost = honorMissingHostId && hostId ? parseExecutionHostId(hostId) : null
  if (parsedHost?.kind === 'runtime') {
    return settingsForRuntimeEnvironment(state.settings, parsedHost.environmentId)
  }
  return parsedHost ? settingsForRuntimeEnvironment(state.settings, null) : state.settings
}

export function trySettingsForWorktreeOwner(
  state: Pick<AppState, 'repos' | 'settings'>,
  worktreeId: string,
  executionHostId?: ExecutionHostId
): AppState['settings'] | null {
  const repoId = getRepoIdFromWorktreeId(worktreeId)
  return repoId ? settingsForRepoOwner(state, repoId, executionHostId, true) : null
}

export function settingsForWorktreeOwner(
  state: Pick<AppState, 'repos' | 'settings'>,
  worktreeId: string,
  executionHostId?: ExecutionHostId
): AppState['settings'] {
  const repoId = getRepoIdFromWorktreeId(worktreeId)
  if (!repoId) {
    throw new Error(WORKTREE_REMOVAL_AMBIGUOUS_ERROR)
  }
  return settingsForRepoOwner(state, repoId, executionHostId, true)
}
