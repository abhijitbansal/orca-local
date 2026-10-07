import type { AppState } from '@/store/types'
import type { DashboardCardReview } from '../../../../shared/dashboard-snapshot'
import { isPositiveHostedReviewNumber } from '../../../../shared/hosted-review'
import type { Repo } from '../../../../shared/repo-types'
import type { WorkspaceStatusDefinition, Worktree } from '../../../../shared/worktree/types'
import {
  DEFAULT_WORKSPACE_STATUSES,
  getWorkspaceStatus
} from '../../../../shared/workspace-statuses'

export type DashboardCardContextState = Partial<Pick<AppState, 'workspaceStatuses'>>

export type DashboardCardContext = {
  workspaceStatus: WorkspaceStatusDefinition
  hasReview: boolean
  review?: DashboardCardReview
}

function hasLinkedReview(worktree: Worktree): boolean {
  return [
    worktree.linkedPR,
    worktree.linkedGitLabMR,
    worktree.linkedBitbucketPR,
    worktree.linkedAzureDevOpsPR,
    worktree.linkedGiteaPR
  ].some(isPositiveHostedReviewNumber)
}

export function resolveDashboardCardContext(
  state: DashboardCardContextState,
  _repo: Repo | null,
  worktree: Worktree
): DashboardCardContext {
  const statuses =
    state.workspaceStatuses && state.workspaceStatuses.length > 0
      ? state.workspaceStatuses
      : DEFAULT_WORKSPACE_STATUSES
  const workspaceStatusId = getWorkspaceStatus(worktree, statuses)
  return {
    workspaceStatus:
      statuses.find((status) => status.id === workspaceStatusId) ?? DEFAULT_WORKSPACE_STATUSES[0],
    hasReview: hasLinkedReview(worktree)
  }
}
