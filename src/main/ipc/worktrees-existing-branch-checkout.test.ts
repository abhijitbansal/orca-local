import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listWorktreesMock,
  addWorktreeMock,
  getBranchConflictKindMock,
  computeWorktreePathMock,
  gitExecFileAsyncMock
} from './worktrees-test-module-mocks'
import { handlers, setupWorktreeHandlers, store } from './worktrees-test-harness'
import type { WorktreeRuntimeStub } from './worktrees-test-runtime-stub'

vi.mock('electron', async () =>
  (await import('./worktrees-test-module-mocks')).electronModuleMock()
)
vi.mock('../git/worktree', async () =>
  (await import('./worktrees-test-module-mocks')).gitWorktreeModuleMock()
)
vi.mock('../git/runner', async () =>
  (await import('./worktrees-test-module-mocks')).gitRunnerModuleMock()
)
vi.mock('../git/repo', async () =>
  (await import('./worktrees-test-module-mocks')).gitRepoModuleMock()
)
vi.mock('../git/git-username', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  resolveLocalGitUsername: (await import('./worktrees-test-module-mocks'))
    .resolveLocalGitUsernameMock
}))
vi.mock('../providers/ssh-git-dispatch', async () =>
  (await import('./worktrees-test-module-mocks')).sshGitDispatchModuleMock()
)
vi.mock('../providers/ssh-filesystem-dispatch', async () =>
  (await import('./worktrees-test-module-mocks')).sshFilesystemDispatchModuleMock()
)
vi.mock('./worktree-symlinks', async () =>
  (await import('./worktrees-test-module-mocks')).worktreeSymlinksModuleMock()
)
vi.mock('./ssh', async () => (await import('./worktrees-test-module-mocks')).sshModuleMock())
vi.mock('../ssh/ssh-target-registry', async () =>
  (await import('./worktrees-test-module-mocks')).sshTargetRegistryModuleMock()
)
vi.mock('../hooks', async () => (await import('./worktrees-test-module-mocks')).hooksModuleMock())
vi.mock('../setup-runner-script-text', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).setupRunnerScriptTextModuleMock(
    (await importOriginal()) as Record<string, unknown>
  )
)
vi.mock('../worktree-runner-script', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).worktreeRunnerScriptModuleMock(
    (await importOriginal()) as Record<string, unknown>
  )
)
vi.mock('../effective-hook-config', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).effectiveHookConfigModuleMock(
    (await importOriginal()) as Record<string, unknown>
  )
)
vi.mock('../setup-hook-env-vars', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).setupHookEnvVarsModuleMock(
    (await importOriginal()) as Record<string, unknown>
  )
)
vi.mock('./worktree-logic', async (importOriginal) =>
  (await import('./worktrees-test-module-mocks')).worktreeLogicModuleMock(
    (await importOriginal()) as Record<string, unknown>
  )
)
vi.mock('../terminal-history-deletion', async () =>
  (await import('./worktrees-test-module-mocks')).terminalHistoryDeletionModuleMock()
)
vi.mock('../ports/advertised-url-watcher', async () =>
  (await import('./worktrees-test-module-mocks')).advertisedUrlWatcherModuleMock()
)
vi.mock('../workspace-cleanup-scan-snapshot', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceCleanupScanSnapshotModuleMock()
)
vi.mock('../workspace-space-analysis-snapshot', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceSpaceAnalysisSnapshotModuleMock()
)
vi.mock('../workspace-cleanup-removal-snapshot-prune', async () =>
  (await import('./worktrees-test-module-mocks')).workspaceCleanupRemovalSnapshotPruneModuleMock()
)
vi.mock('../runtime/worktree-teardown', async () =>
  (await import('./worktrees-test-module-mocks')).worktreeTeardownModuleMock()
)
vi.mock('./pty', async () => (await import('./worktrees-test-module-mocks')).ptyModuleMock())

describe('registerWorktreeHandlers', () => {
  let runtimeStub: WorktreeRuntimeStub

  beforeEach(() => {
    runtimeStub = setupWorktreeHandlers()
  })

  it('checks out a selected existing local branch exactly', async () => {
    listWorktreesMock
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        }
      ])
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        },
        {
          path: '/workspace/fix-bug-0',
          head: 'abc123',
          branch: 'refs/heads/fix/bug-0',
          isBare: false,
          isMainWorktree: false
        }
      ])

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix/bug-0',
      baseBranch: 'fix/bug-0',
      branchNameOverride: 'fix/bug-0'
    })

    expect(getBranchConflictKindMock).not.toHaveBeenCalled()
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-bug-0',
      'fix/bug-0',
      'fix/bug-0',
      false,
      false,
      { checkoutExistingBranch: true }
    )
    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      'repo-1::/workspace/fix-bug-0',
      expect.objectContaining({ preserveBranchOnDelete: true })
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        path: '/workspace/fix-bug-0',
        branch: 'refs/heads/fix/bug-0'
      })
    })
  })

  it('reuses an existing local branch when the worktree folder is renamed (#5181)', async () => {
    // Why: reuse keeps branchNameOverride on the selected branch though the folder is renamed; backend must check out that branch (no -b).
    listWorktreesMock
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        }
      ])
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        },
        {
          path: '/workspace/my-folder',
          head: 'abc123',
          branch: 'refs/heads/fix/bug-0',
          isBare: false,
          isMainWorktree: false
        }
      ])

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'my-folder',
      baseBranch: 'fix/bug-0',
      branchNameOverride: 'fix/bug-0'
    })

    expect(getBranchConflictKindMock).not.toHaveBeenCalled()
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/my-folder',
      'fix/bug-0',
      'fix/bug-0',
      false,
      false,
      { checkoutExistingBranch: true }
    )
    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      'repo-1::/workspace/my-folder',
      expect.objectContaining({ preserveBranchOnDelete: true })
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        path: '/workspace/my-folder',
        branch: 'refs/heads/fix/bug-0'
      })
    })
  })

  it('suffixes only the path when an existing local branch checkout path already exists', async () => {
    const mainWorktree = {
      path: '/workspace/repo',
      head: 'main',
      branch: 'refs/heads/main',
      isBare: false,
      isMainWorktree: true
    }
    computeWorktreePathMock.mockImplementation((sanitizedName: string) =>
      sanitizedName === 'fix-bug-0' ? process.cwd() : `/workspace/${sanitizedName}`
    )
    listWorktreesMock
      .mockResolvedValueOnce([mainWorktree])
      .mockResolvedValueOnce([mainWorktree])
      .mockResolvedValueOnce([
        mainWorktree,
        {
          path: '/workspace/fix-bug-0-2',
          head: 'abc123',
          branch: 'refs/heads/fix/bug-0',
          isBare: false,
          isMainWorktree: false
        }
      ])

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix/bug-0',
      baseBranch: 'fix/bug-0',
      branchNameOverride: 'fix/bug-0'
    })

    expect(getBranchConflictKindMock).not.toHaveBeenCalled()
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-bug-0-2',
      'fix/bug-0',
      'fix/bug-0',
      false,
      false,
      { checkoutExistingBranch: true }
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        path: '/workspace/fix-bug-0-2',
        branch: 'refs/heads/fix/bug-0'
      })
    })
  })

  it('suffixes branchNameOverride when the requested branch collides', async () => {
    getBranchConflictKindMock.mockImplementation(async (_repoPath: string, branch: string) =>
      branch === 'feature/something' ? 'remote' : null
    )
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/feature-something-2',
        head: 'abc123',
        branch: 'refs/heads/feature/something-2',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'feature/something',
      branchNameOverride: 'feature/something'
    })

    expect(gitExecFileAsyncMock).toHaveBeenCalledWith(
      ['check-ref-format', '--branch', 'feature/something-2'],
      { cwd: '/workspace/repo' }
    )
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/feature-something-2',
      'feature/something-2',
      'origin/main',
      false,
      false,
      {}
    )
  })

  it('persists an explicit compare base ahead of the checkout remote-tracking base', async () => {
    runtimeStub.resolveRemoteTrackingBase.mockResolvedValueOnce({
      base: 'origin/source-branch',
      remote: 'origin',
      branch: 'source-branch',
      ref: 'refs/remotes/origin/source-branch'
    })
    runtimeStub.hasRemoteTrackingRef.mockResolvedValueOnce(true)
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/fix-title',
        head: 'abc123',
        branch: 'refs/heads/feature/fix',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_worktreeId, meta) => meta)

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'origin/source-branch',
      compareBaseRef: 'refs/remotes/origin/main',
      branchNameOverride: 'feature/fix',
      linkedGitLabMR: 7,
      pushTarget: { remoteName: 'origin', branchName: 'feature/fix' }
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      'repo-1::/workspace/fix-title',
      expect.objectContaining({
        baseRef: 'refs/remotes/origin/main',
        linkedGitLabMR: 7
      })
    )
  })

  it('suffixes a matching push target branch without selected PR metadata', async () => {
    getBranchConflictKindMock.mockImplementation(async (_repoPath: string, branch: string) =>
      branch === 'feature/fix' ? 'remote' : null
    )
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/fix-title-2',
        head: 'abc123',
        branch: 'refs/heads/feature/fix-2',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'abc123',
      branchNameOverride: 'feature/fix',
      pushTarget: { remoteName: 'origin', branchName: 'feature/fix' }
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-title-2',
      'feature/fix-2',
      'abc123',
      false,
      false,
      {}
    )
  })

  it('suffixes a matching push target branch when selected PR metadata has no PR number', async () => {
    getBranchConflictKindMock.mockImplementation(async (_repoPath: string, branch: string) =>
      branch === 'feature/fix' ? 'remote' : null
    )
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/fix-title-2',
        head: 'abc123',
        branch: 'refs/heads/feature/fix-2',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'abc123',
      branchNameOverride: 'feature/fix',
      linkedPR: null,
      pushTarget: { remoteName: 'origin', branchName: 'feature/fix' }
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-title-2',
      'feature/fix-2',
      'abc123',
      false,
      false,
      {}
    )
  })

  it('checks out an unused existing PR branch only when it is at the resolved head SHA', async () => {
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'rev-parse' && args.includes('refs/heads/feature/fix^{commit}')) {
        return { stdout: 'abc123\n', stderr: '' }
      }
      if (args[0] === 'rev-parse' && args.includes('abc123^{commit}')) {
        return { stdout: 'abc123\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })
    listWorktreesMock
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        }
      ])
      .mockResolvedValueOnce([
        {
          path: '/workspace/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        },
        {
          path: '/workspace/fix-title',
          head: 'abc123',
          branch: 'refs/heads/feature/fix',
          isBare: false,
          isMainWorktree: false
        }
      ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'abc123',
      branchNameOverride: 'feature/fix'
    })

    expect(getBranchConflictKindMock).not.toHaveBeenCalled()
    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-title',
      'feature/fix',
      'abc123',
      false,
      false,
      { checkoutExistingBranch: true }
    )
  })

  it('suffixes an existing PR branch when its tip differs from the resolved head SHA', async () => {
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'rev-parse' && args.includes('refs/heads/feature/fix^{commit}')) {
        return { stdout: 'old123\n', stderr: '' }
      }
      if (args[0] === 'rev-parse' && args.includes('abc123^{commit}')) {
        return { stdout: 'abc123\n', stderr: '' }
      }
      return { stdout: '', stderr: '' }
    })
    getBranchConflictKindMock.mockResolvedValueOnce('local')
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/fix-title-2',
        head: 'abc123',
        branch: 'refs/heads/feature/fix-2',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'fix-title',
      baseBranch: 'abc123',
      branchNameOverride: 'feature/fix'
    })

    expect(addWorktreeMock).toHaveBeenCalledWith(
      '/workspace/repo',
      '/workspace/fix-title-2',
      'feature/fix-2',
      'abc123',
      false,
      false,
      {}
    )
  })
})
