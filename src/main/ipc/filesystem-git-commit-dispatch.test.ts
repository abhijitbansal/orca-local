import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handlers,
  store,
  WORKTREE_FEATURE_PATH,
  commitChangesMock,
  resetFilesystemIpcMocks
} from './filesystem-test-harness'

vi.mock('electron', async () => (await import('./filesystem-test-harness')).electronMock)
vi.mock('fs/promises', async () => (await import('./filesystem-test-harness')).fsPromisesMock)
vi.mock(
  '../wsl-unc-delete',
  async () => (await import('./filesystem-test-harness')).wslUncDeleteMock
)
vi.mock(
  '../crash-reporting/crash-breadcrumb-store',
  async () => (await import('./filesystem-test-harness')).crashBreadcrumbMock
)
vi.mock(
  '../git/status',
  async () => (await import('./filesystem-test-harness')).gitStatusModuleMock
)
vi.mock(
  '../git/check-ignored-paths',
  async () => (await import('./filesystem-test-harness')).gitIgnoredPathsMock
)
vi.mock('../git/worktree', async () => (await import('./filesystem-test-harness')).gitWorktreeMock)
vi.mock(
  '../text-generation/commit-message-text-generation',
  async () => (await import('./filesystem-test-harness')).textGenerationModuleMock
)
vi.mock(
  '../text-generation/pull-request-context',
  async () => (await import('./filesystem-test-harness')).pullRequestContextMock
)
vi.mock(
  '../source-control/pull-request-template',
  async () => (await import('./filesystem-test-harness')).pullRequestTemplateMock
)

import { registerFilesystemHandlers } from './filesystem'
import { invalidateAuthorizedRootsCache } from './registered-worktree-roots-cache'

describe('registerFilesystemHandlers', () => {
  beforeEach(() => {
    resetFilesystemIpcMocks()
    // Drop cached roots between fixtures.
    invalidateAuthorizedRootsCache()
  })

  it('routes local git:commit through commitChanges and returns success', async () => {
    commitChangesMock.mockResolvedValue({ success: true })

    registerFilesystemHandlers(store as never)

    await expect(
      handlers.get('git:commit')!(null, {
        worktreePath: WORKTREE_FEATURE_PATH,
        message: 'feat: ship commit'
      })
    ).resolves.toEqual({ success: true })

    expect(commitChangesMock).toHaveBeenCalledWith(WORKTREE_FEATURE_PATH, 'feat: ship commit', {
      admissionTier: 'interactive'
    })
  })

  it('rejects git:remoteCommitUrl with a short hash before SSH dispatch', async () => {
    const sshRemoteCommitUrlMock = vi.fn()

    registerFilesystemHandlers(store as never)

    await expect(
      handlers.get('git:remoteCommitUrl')!(null, {
        worktreePath: '/remote/repo',
        sha: 'abc123',
        connectionId: 'conn-1'
      })
    ).rejects.toThrow('sha must be a full git object id')

    expect(sshRemoteCommitUrlMock).not.toHaveBeenCalled()
  })

  it('rejects git:commit with whitespace-only message and does not call commitChanges', async () => {
    registerFilesystemHandlers(store as never)

    await expect(
      handlers.get('git:commit')!(null, {
        worktreePath: WORKTREE_FEATURE_PATH,
        message: '   '
      })
    ).rejects.toThrow('Commit message is required')

    expect(commitChangesMock).not.toHaveBeenCalled()
  })

  it('rejects git:commit with whitespace-only message before SSH dispatch', async () => {
    const sshCommitMock = vi.fn().mockResolvedValue({ success: true })

    registerFilesystemHandlers(store as never)

    await expect(
      handlers.get('git:commit')!(null, {
        worktreePath: '/remote/repo',
        message: '\n',
        connectionId: 'conn-1'
      })
    ).rejects.toThrow('Commit message is required')

    expect(sshCommitMock).not.toHaveBeenCalled()
  })
})
