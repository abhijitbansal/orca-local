import { useCallback } from 'react'
import type { CmdJTaskSearchResult } from './cmd-j/task-search-results'
import type { Worktree } from '../../../shared/worktree/types'
import type { WorktreeJumpPaletteLocalState } from './use-worktree-jump-palette-local-state'
import type { WorktreeJumpPaletteStoreState } from './use-worktree-jump-palette-store-state'
import type { WorktreeJumpPaletteTaskSearch } from './use-worktree-jump-palette-task-search'

type Input = Pick<
  WorktreeJumpPaletteStoreState,
  'visible' | 'workspaces' | 'recordFeatureInteraction'
> &
  Pick<WorktreeJumpPaletteLocalState, 'skipRestoreFocusRef' | 'setSelectedItemId'> &
  Pick<WorktreeJumpPaletteTaskSearch, 'taskItems'> & {
    handleSelectWorktree: (worktree: Worktree) => void
  }

export function useWorktreeJumpPaletteTaskSelection({
  visible,
  taskItems,
  workspaces,
  handleSelectWorktree,
  recordFeatureInteraction,
  skipRestoreFocusRef,
  setSelectedItemId
}: Input) {
  return useCallback(
    (result: CmdJTaskSearchResult, _createWorkspace = false) => {
      if (!visible || !taskItems.some((item) => item.id === result.id)) {
        return
      }
      skipRestoreFocusRef.current = true
      setSelectedItemId('')
      // Local-only: provider tasks are removed, so a task result has nothing to open.
      recordFeatureInteraction('cmd-j')
    },
    [
      visible,
      taskItems,
      workspaces,
      handleSelectWorktree,
      recordFeatureInteraction,
      skipRestoreFocusRef,
      setSelectedItemId
    ]
  )
}
