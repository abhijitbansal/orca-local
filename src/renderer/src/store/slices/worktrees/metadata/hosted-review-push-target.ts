import { isPositiveHostedReviewNumber } from '../../../../../../shared/hosted-review'
import type { Worktree } from '../../../../../../shared/worktree/types'

export function getHostedReviewPushTargetLookup(worktree: Worktree): { key: string } | null {
  const hostScope = worktree.hostId ?? ''
  if (isPositiveHostedReviewNumber(worktree.linkedPR)) {
    return { key: `${worktree.id}:${hostScope}:github:${worktree.linkedPR}` }
  }
  if (isPositiveHostedReviewNumber(worktree.linkedGitLabMR)) {
    return { key: `${worktree.id}:${hostScope}:gitlab:${worktree.linkedGitLabMR}` }
  }
  return null
}
