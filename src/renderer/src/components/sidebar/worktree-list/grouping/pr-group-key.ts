import type { Repo } from '../../../../../../shared/repo-types'
import type { Worktree } from '../../../../../../shared/worktree/types'
import type { PRGroupKey } from '../../../../../../shared/workspace-view/workspace-pr-groups'
import type { SidebarPRGroupReader } from '../../../../../../shared/sidebar-list/row-types'

export type PRCacheView = Record<string, unknown>

// Local-only: hosted reviews are removed, so every workspace stays in the default PR lane.
export function getPRGroupKey(
  _worktree: Worktree,
  _repoMap: Map<string, Repo>,
  _prCache: PRCacheView | null
): PRGroupKey {
  return 'in-progress'
}

/** The PR lane reader the shared builder takes. */
export function createSidebarPRGroupReader(
  repoMap: Map<string, Repo>,
  prCache: PRCacheView | null
): SidebarPRGroupReader {
  return (worktree) => getPRGroupKey(worktree, repoMap, prCache)
}
