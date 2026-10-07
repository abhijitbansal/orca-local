import type { WorkspaceLinkedItem } from '../../shared/worktree/types'

export type PullRequestLinkedIssueMeta = {
  linkedIssue?: number | null
  linkedGitLabIssue?: number | null
  linkedWorkItem?: WorkspaceLinkedItem | null
}
