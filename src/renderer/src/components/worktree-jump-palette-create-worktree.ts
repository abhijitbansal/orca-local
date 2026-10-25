import { isWorktreePaletteCreateActivationAllowed } from '@/lib/worktree-palette-create-action'
import type { WorktreeJumpPaletteLocalState } from './use-worktree-jump-palette-local-state'
import type { WorktreeJumpPaletteQuickActions } from './use-worktree-jump-palette-quick-actions'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'

type WorktreeJumpPaletteCreateWorktreeInput = Pick<
  WorktreeJumpPaletteStoreState,
  'closeModal' | 'openModal' | 'recordFeatureInteraction'
> &
  Pick<
    WorktreeJumpPaletteLocalState,
    | 'createWorktreeName'
    | 'liveQueryRef'
    | 'selectionMovedByUserRef'
    | 'skipRestoreFocusRef'
    | 'taskSourceUrl'
  > &
  Pick<WorktreeJumpPaletteQuickActions, 'prefetchCreateWorkspaceBaseForComposer'> &
  Record<string, unknown>

export function createWorktreeJumpPaletteWorktreeHandler({
  closeModal,
  createWorktreeName,
  liveQueryRef,
  openModal,
  prefetchCreateWorkspaceBaseForComposer,
  recordFeatureInteraction,
  selectionMovedByUserRef,
  skipRestoreFocusRef,
  taskSourceUrl
}: WorktreeJumpPaletteCreateWorktreeInput): () => void {
  return () => {
    const trimmed = createWorktreeName.trim()
    if (liveQueryRef.current.trim() !== trimmed) {
      return
    }
    if (
      !isWorktreePaletteCreateActivationAllowed({
        hasTaskUrlIntent: taskSourceUrl !== null,
        hasCreateName: trimmed.length > 0,
        selectionMovedByUser: selectionMovedByUserRef.current
      })
    ) {
      return
    }
    skipRestoreFocusRef.current = true
    prefetchCreateWorkspaceBaseForComposer(undefined)
    closeModal()
    recordFeatureInteraction('cmd-j-create-workspace')
    const data = trimmed ? { prefilledName: trimmed } : {}
    queueMicrotask(() =>
      openModal('new-workspace-composer', { ...data, telemetrySource: 'command_palette' })
    )
  }
}
