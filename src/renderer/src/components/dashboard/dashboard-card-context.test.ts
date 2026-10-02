import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { resolveDashboardCardContext } from './dashboard-card-context'

const repo: Repo = {
  id: 'repo-1',
  path: '/repo',
  displayName: 'Repo',
  badgeColor: '#fff',
  addedAt: 1,
  kind: 'git'
}

function worktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'worktree-1',
    repoId: repo.id,
    path: '/repo/worktree',
    head: 'current-head',
    branch: 'refs/heads/feature',
    isBare: false,
    isMainWorktree: false,
    displayName: 'feature',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}

describe('resolveDashboardCardContext', () => {
  it.each([
    ['github', { linkedPR: 42 }],
    ['gitlab', { linkedGitLabMR: 42 }],
    ['bitbucket', { linkedBitbucketPR: 42 }],
    ['azure-devops', { linkedAzureDevOpsPR: 42 }],
    ['gitea', { linkedGiteaPR: 42 }]
  ] as const)('reports a linked %s review from persisted metadata', (_provider, link) => {
    expect(resolveDashboardCardContext({}, repo, worktree(link))).toMatchObject({
      hasReview: true
    })
  })

  it('reports no review for a worktree without a linked review', () => {
    const context = resolveDashboardCardContext({}, repo, worktree())

    expect(context.hasReview).toBe(false)
    expect(context.review).toBeUndefined()
  })
})
