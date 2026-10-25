import type { Repo } from '../../../../../shared/repo-types'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { WorkspaceLinkedItemRow } from '../../sidebar/workspace-hover-attachments'

// Local-only: linked reviews and issues need a provider API, so the new-tab page lists none.
export function useBrowserNewTabLinkedItems(
  _worktree: Worktree,
  _repo: Repo | undefined
): WorkspaceLinkedItemRow[] {
  return []
}
