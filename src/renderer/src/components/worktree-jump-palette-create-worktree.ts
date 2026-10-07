import { parseGitHubIssueOrPRNumber } from '@/lib/github-links'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { queueWorkspaceActivationTerminalFocus } from '@/lib/workspace-activation-terminal-focus'
import { useAppStore } from '@/store'
import { isWorktreePaletteCreateActivationAllowed } from '@/lib/worktree-palette-create-action'
import type { WorktreeJumpPaletteFilter } from './use-worktree-jump-palette-filter'
import type { WorktreeJumpPaletteLocalState } from './use-worktree-jump-palette-local-state'
import type { WorktreeJumpPaletteQuickActions } from './use-worktree-jump-palette-quick-actions'
import type { WorktreeJumpPaletteSelectionLifecycle } from './use-worktree-jump-palette-selection-lifecycle'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'

type WorktreeJumpPaletteCreateWorktreeInput = Pick<
  WorktreeJumpPaletteStoreState,
  'allWorktrees' | 'closeModal' | 'openModal' | 'recordFeatureInteraction'
> &
  Pick<WorktreeJumpPaletteFilter, 'repoMap'> &
  Pick<
    WorktreeJumpPaletteLocalState,
    'createWorktreeName' | 'liveQueryRef' | 'selectionMovedByUserRef' | 'skipRestoreFocusRef'
  > &
  Pick<WorktreeJumpPaletteQuickActions, 'prefetchCreateWorkspaceBaseForComposer'> &
  Pick<WorktreeJumpPaletteSelectionLifecycle, 'focusFallbackSurface'>

export function createWorktreeJumpPaletteWorktreeHandler({
  allWorktrees,
  closeModal,
  createWorktreeName,
  focusFallbackSurface,
  liveQueryRef,
  openModal,
  prefetchCreateWorkspaceBaseForComposer,
  recordFeatureInteraction,
  selectionMovedByUserRef,
  skipRestoreFocusRef
}: WorktreeJumpPaletteCreateWorktreeInput): () => void {
  return () => {
    const trimmed = createWorktreeName.trim()
    if (liveQueryRef.current.trim() !== trimmed) {
      return
    }
    if (
      !isWorktreePaletteCreateActivationAllowed({
        hasCreateName: trimmed.length > 0,
        selectionMovedByUser: selectionMovedByUserRef.current
      })
    ) {
      return
    }
    const ghNumber = parseGitHubIssueOrPRNumber(trimmed)
    const openComposer = (data: Record<string, unknown>): void => {
      skipRestoreFocusRef.current = true
      prefetchCreateWorkspaceBaseForComposer(
        typeof data.initialRepoId === 'string' ? data.initialRepoId : undefined
      )
      closeModal()
      recordFeatureInteraction('cmd-j-create-workspace')
      queueMicrotask(() =>
        openModal('new-workspace-composer', { ...data, telemetrySource: 'command_palette' })
      )
    }

    if (ghNumber !== null) {
      const state = useAppStore.getState()
      const matches = allWorktrees.filter(
        (worktree) =>
          !worktree.isArchived &&
          (worktree.linkedIssue === ghNumber || worktree.linkedPR === ghNumber)
      )
      const activeMatch =
        matches.find((worktree) => worktree.repoId === state.activeRepoId) ?? matches[0]
      if (activeMatch) {
        skipRestoreFocusRef.current = true
        closeModal()
        const activation = activateAndRevealWorktree(
          activeMatch.id,
          activeMatch.hostId ? { executionHostId: activeMatch.hostId } : {}
        )
        if (!queueWorkspaceActivationTerminalFocus(activeMatch.id, activation)) {
          focusFallbackSurface()
        }
        recordFeatureInteraction('cmd-j-workspace-open')
        return
      }
      openComposer({ prefilledName: trimmed })
      return
    }
    openComposer(trimmed ? { prefilledName: trimmed } : {})
  }
}
