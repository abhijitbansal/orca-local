import type { WorktreeSlice } from '../../worktree-helpers'
import { ipcOrRuntimeTargetForHostId } from '@/runtime/runtime-client-target'
import type { WorktreeSliceGet, WorktreeSliceSet } from '../listing/worktree-slice-types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../../shared/execution-host'
import { translate } from '@/i18n/i18n'
import { displayNameUpdatePinsLabel } from '../../../../../../shared/worktree/display-name-provenance'
import { parseWorkspaceKey } from '../../../../../../shared/workspace-scope'
import { ORCA_SIDEBAR_INPUTS_IS_MAIN } from '../../../../../../shared/sidebar-inputs-switch'
import { applyWorktreeUpdates, getRepoIdFromWorktreeId } from '../../worktree-helpers'
import {
  applyDetectedWorktreeUpdates,
  findKnownWorktreeById,
  getFolderWorkspaceMetaUpdates
} from '../listing/detected-worktree-meta'
import {
  bumpHostedReviewLinkMutationGeneration,
  hasHostedReviewLinkUpdates
} from './hosted-review-link-mutation'
import { getHostedReviewPushTargetLookup } from './hosted-review-push-target'
import { persistWorktreeMeta } from './worktree-meta-persist'
import { withPendingSidebarRowWrites } from '@/lib/sidebar-pending-layer'
import { isRuntimeSelectorNotFoundError } from '../listing/runtime-worktree-rpc-errors'

export function createUpdateWorktreeMeta(
  set: WorktreeSliceSet,
  get: WorktreeSliceGet
): WorktreeSlice['updateWorktreeMeta'] {
  const update: WorktreeSlice['updateWorktreeMeta'] = async (worktreeId, updates, options) => {
    const shouldApplyUpdate = options?.shouldApply
    const requestedHostId = options?.executionHostId
    const existingWorktree = findKnownWorktreeById(get(), worktreeId, requestedHostId)
    const executionHostId =
      requestedHostId ??
      existingWorktree?.hostId ??
      (get().settings?.activeRuntimeEnvironmentId ? undefined : 'local')
    if (shouldApplyUpdate && !shouldApplyUpdate(existingWorktree)) {
      return { ok: true }
    }
    const workspaceScope = parseWorkspaceKey(worktreeId)
    if (workspaceScope?.type === 'folder') {
      const folderUpdates = getFolderWorkspaceMetaUpdates(updates)
      if (Object.keys(folderUpdates).length === 0) {
        return { ok: true }
      }
      try {
        // Why: a rejected folder update reconciles the optimistic write away, so
        // reporting ok would show the dialog a save that silently undid itself.
        const updated = await get().updateFolderWorkspace(
          workspaceScope.folderWorkspaceId,
          folderUpdates
        )
        return updated
          ? { ok: true }
          : {
              ok: false,
              error: translate(
                'auto.store.slices.worktrees.a17f4d2e93',
                'Could not update this workspace.'
              )
            }
      } catch (err) {
        console.error('Failed to update folder workspace meta:', err)
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
    const normalizedUpdates = updates
    const existingHostedReviewPushTargetLookup = existingWorktree
      ? getHostedReviewPushTargetLookup(existingWorktree)
      : null
    const nextHostedReviewPushTargetLookup = existingWorktree
      ? getHostedReviewPushTargetLookup({ ...existingWorktree, ...normalizedUpdates })
      : null
    // Why: a pushTarget derived from a linked review must not keep steering pushes after it's unlinked or replaced.
    const shouldClearStaleHostedReviewPushTarget =
      Boolean(existingWorktree?.pushTarget) &&
      normalizedUpdates.pushTarget === undefined &&
      existingHostedReviewPushTargetLookup !== null &&
      existingHostedReviewPushTargetLookup.key !== nextHostedReviewPushTargetLookup?.key
    const worktreeForUpdate = get().getKnownWorktreeById(worktreeId, executionHostId)
    if (shouldApplyUpdate && !shouldApplyUpdate(worktreeForUpdate)) {
      return { ok: true }
    }

    // Why: bump lastActivityAt on comment edits so the time-decay sort doesn't drop a just-touched worktree.
    const displayNameProvenance =
      'displayName' in normalizedUpdates
        ? { displayNameIsPinned: displayNameUpdatePinsLabel(normalizedUpdates.displayName) }
        : {}
    const targetEnriched = shouldClearStaleHostedReviewPushTarget
      ? { ...normalizedUpdates, ...displayNameProvenance, pushTarget: undefined }
      : { ...normalizedUpdates, ...displayNameProvenance }
    const renameCleared =
      'displayName' in targetEnriched
        ? {
            ...targetEnriched,
            pendingFirstAgentMessageRename: false,
            firstAgentMessageRenameError: null
          }
        : targetEnriched
    // Switch point: a comment edit is not a Recent event once the host owns the stamps.
    const enriched =
      'comment' in renameCleared && !ORCA_SIDEBAR_INPUTS_IS_MAIN
        ? { ...renameCleared, lastActivityAt: Date.now() }
        : renameCleared

    let didApply = false
    set((s) => {
      if (
        shouldApplyUpdate &&
        !shouldApplyUpdate(findKnownWorktreeById(s, worktreeId, executionHostId))
      ) {
        return s
      }
      didApply = true
      const nextWorktrees = applyWorktreeUpdates(
        s.worktreesByRepo,
        worktreeId,
        enriched,
        executionHostId
      )
      const nextDetectedWorktrees = applyDetectedWorktreeUpdates(
        s.detectedWorktreesByRepo,
        worktreeId,
        enriched,
        executionHostId
      )
      if (
        nextWorktrees === s.worktreesByRepo &&
        nextDetectedWorktrees === s.detectedWorktreesByRepo
      ) {
        return s
      }
      return {
        ...(nextWorktrees !== s.worktreesByRepo
          ? { worktreesByRepo: nextWorktrees, sortEpoch: s.sortEpoch + 1 }
          : {}),
        ...(nextDetectedWorktrees !== s.detectedWorktreesByRepo
          ? { detectedWorktreesByRepo: nextDetectedWorktrees }
          : {})
      }
    })
    if (shouldApplyUpdate && !didApply) {
      return { ok: true }
    }
    if (hasHostedReviewLinkUpdates(enriched)) {
      bumpHostedReviewLinkMutationGeneration(worktreeId)
    }

    try {
      const ownerTarget = ipcOrRuntimeTargetForHostId(
        executionHostId ?? existingWorktree?.hostId ?? LOCAL_EXECUTION_HOST_ID
      )
      if (!ownerTarget) {
        throw new Error('The workspace host is unresolved. Refresh and retry.')
      }
      await persistWorktreeMeta(
        ownerTarget,
        worktreeId,
        enriched,
        executionHostId ?? existingWorktree?.hostId,
        worktreeForUpdate?.identity?.key
      )
    } catch (err) {
      if (isRuntimeSelectorNotFoundError(err)) {
        void get().fetchWorktrees(getRepoIdFromWorktreeId(worktreeId))
        return {
          ok: false,
          error: translate(
            'auto.store.slices.worktrees.c6cf133786',
            'This workspace is no longer available.'
          )
        }
      }
      console.error('Failed to update worktree meta:', err)
      void get().fetchWorktrees(getRepoIdFromWorktreeId(worktreeId))
      // Why: the refetch above reverts the optimistic write, so a caller that
      // closes its surface on this path shows the user a save that undid itself.
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
    return { ok: true }
  }
  // A conditional write may not apply, so only an unconditional one shows ahead of main.
  return (worktreeId, updates, options) =>
    options?.shouldApply
      ? update(worktreeId, updates, options)
      : withPendingSidebarRowWrites(
          () => [
            {
              worktreeId,
              updates,
              executionHostId:
                options?.executionHostId ?? findKnownWorktreeById(get(), worktreeId)?.hostId
            }
          ],
          () => update(worktreeId, updates, options)
        )
}
