import { WORKTREE_REMOVAL_AMBIGUOUS_ERROR } from '@/store/slices/worktrees/listing/worktree-slice-constants'

// Local-only: no paired servers exist, so an ambiguous owner never has a duplicate-server cause.
export function ambiguousWorkspaceOwnerMessage(_state: unknown, _workspaceId: string): string {
  return WORKTREE_REMOVAL_AMBIGUOUS_ERROR
}
