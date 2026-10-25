import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  removeHandlerMock,
  listWorktreesMock,
  gitExecFileAsyncMock
} from './worktrees-test-module-mocks'
import { handlers, harnessRepo, setupWorktreeHandlers, store } from './worktrees-test-harness'
import { mergeWorktreeMetaForWrite } from '../persistence/loading-store/worktree-meta-write-normalization'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { makeWorktreeMeta, expectDetectedWorktreeListResult } from './worktrees-test-fixtures'
import type { WorktreeRuntimeStub } from './worktrees-test-runtime-stub'
import {
  hostWorktreeTarget,
  type HostWorktreeTarget
} from '../../shared/worktree/host-qualified-identity'

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
vi.mock('./worktree-symlinks', async () =>
  (await import('./worktrees-test-module-mocks')).worktreeSymlinksModuleMock()
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
vi.mock('./pty/provider/registry', async () =>
  (await import('./worktrees-test-module-mocks')).ptyRegistryModuleMock()
)
vi.mock('./pty/provider/state-cleanup', async () =>
  (await import('./worktrees-test-module-mocks')).ptyStateCleanupModuleMock()
)

describe('registerWorktreeHandlers', () => {
  let runtimeStub: WorktreeRuntimeStub

  beforeEach(() => {
    runtimeStub = setupWorktreeHandlers()
  })

  it('clears the branch rename failure-output handler before re-registering IPC handlers', () => {
    expect(removeHandlerMock).toHaveBeenCalledWith('worktrees:getBranchRenameFailureOutput')
    expect(handlers['worktrees:getBranchRenameFailureOutput']).toBeDefined()
  })

  it('persistSortOrder only reorders existing worktrees and never mints meta for a stale id', () => {
    const liveId = 'repo-1::/workspace/repo'
    const staleId = 'removed-repo::/workspace/gone'
    // Missing metadata on a stale renderer row must not recreate it.
    store.getWorktreeMeta.mockImplementation((id: string) =>
      id === liveId ? ({ instanceId: 'x' } as never) : undefined
    )

    handlers['worktrees:persistSortOrder'](null, {
      orderedIds: [liveId, staleId]
    })

    const orderedTargets = store.setWorktreeMeta.mock.calls.map((call) => call[0].id)
    expect(orderedTargets).toContain(liveId)
    expect(orderedTargets).not.toContain(staleId)
  })

  it('persistSortOrder skips ranks that already represent the requested order', () => {
    const firstId = 'repo-1::/workspace/first'
    const secondId = 'repo-1::/workspace/second'
    store.getWorktreeMeta.mockImplementation((id: string) => ({
      sortOrder: id === firstId ? 200 : 100
    }))

    handlers['worktrees:persistSortOrder'](null, {
      orderedIds: [firstId, secondId]
    })

    expect(store.setWorktreeMeta).not.toHaveBeenCalled()
  })

  it('strips Orca provenance fields from renderer metadata updates', () => {
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    const result = handlers['worktrees:updateMeta'](null, {
      worktreeId: 'repo-1::/workspace/feature-wt',
      updates: {
        comment: 'keep me',
        isPinned: true,
        orcaCreatedAt: 123,
        orcaCreationSource: 'desktop',
        orcaCreationWorkspaceLayout: {
          path: '/workspace',
          nestWorkspaces: false
        }
      }
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/feature-wt',
        hostId: 'local'
      }),
      { comment: 'keep me', isPinned: true }
    )
    expect(result).toMatchObject({ comment: 'keep me', isPinned: true })
  })
  it('routes metadata updates through the explicitly selected host', () => {
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    const result = handlers['worktrees:updateMeta'](null, {
      worktreeId: 'repo-1::/workspace/feature-wt',
      executionHostId: 'ssh:build-box',
      updates: { comment: 'remote note' }
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledExactlyOnceWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/feature-wt',
        hostId: 'ssh:build-box'
      }),
      { comment: 'remote note' }
    )
    expect(result).toMatchObject({ comment: 'remote note' })
  })

  it('rejects malformed execution-host identities at the IPC boundary', () => {
    expect(() =>
      handlers['worktrees:updateMeta'](null, {
        worktreeId: 'repo-1::/workspace/feature-wt',
        executionHostId: 'container:untrusted',
        updates: { comment: 'must not write' }
      })
    ).toThrow('Invalid execution host identity.')

    expect(store.setWorktreeMeta).not.toHaveBeenCalled()
  })

  it('pushes a remote-client invalidation for renames but not read-state updates', () => {
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    handlers['worktrees:updateMeta'](null, {
      worktreeId: 'repo-1::/workspace/feature-wt',
      updates: { isUnread: false }
    })
    // Unread clicks stay event-free; renames must reach remote clients without title polling.
    expect(runtimeStub.notifyWorktreesChangedForRemoteClients).not.toHaveBeenCalled()

    handlers['worktrees:updateMeta'](null, {
      worktreeId: 'repo-1::/workspace/feature-wt',
      updates: { displayName: 'Renamed workspace' }
    })
    expect(runtimeStub.notifyWorktreesChangedForRemoteClients).toHaveBeenCalledWith('repo-1')
  })

  describe('a folder workspace removed while its terminal is still bound (#22712)', () => {
    const folderRepo = { ...harnessRepo, kind: 'folder' as const }
    const workspaceId = `${harnessRepo.id}::${harnessRepo.path}::workspace:0b6f6d2e-1c1d-4c55-9a51-3f1c0f4f2a10`

    function useFolderMetaTable(): Record<string, WorktreeMeta> {
      const table: Record<string, WorktreeMeta> = {}
      store.getRepo.mockReturnValue(folderRepo)
      store.getRepos.mockReturnValue([folderRepo])
      store.getWorktreeMeta.mockImplementation((id: string) => table[id])
      store.getAllWorktreeMeta.mockImplementation(() => table)
      store.setWorktreeMeta.mockImplementation(
        ({ id }: HostWorktreeTarget, meta: Partial<WorktreeMeta>) => {
          table[id] = mergeWorktreeMetaForWrite(table[id], meta)
          return table[id]
        }
      )
      store.removeWorktreeMeta.mockImplementation(({ id }: HostWorktreeTarget) => {
        delete table[id]
      })
      table[workspaceId] = mergeWorktreeMetaForWrite(undefined, {
        displayName: 'Feature work',
        createdAt: 1
      })
      return table
    }

    it('does not bring the workspace back as a blank row when the terminal reports activity', async () => {
      const table = useFolderMetaTable()

      await handlers['worktrees:remove'](null, { worktreeId: workspaceId })
      expect(table[workspaceId]).toBeUndefined()
      // Before renderer teardown, a lingering PTY can still stamp activity on the removed ID.
      handlers['worktrees:updateMeta'](null, {
        worktreeId: workspaceId,
        updates: { lastActivityAt: 2 }
      })
      handlers['worktrees:updateMeta'](null, {
        worktreeId: workspaceId,
        executionHostId: 'local',
        updates: { isUnread: true }
      })

      const result = expectDetectedWorktreeListResult(
        await handlers['worktrees:listDetected'](null, {
          repoId: folderRepo.id
        })
      )
      expect(result.worktrees).not.toContainEqual(expect.objectContaining({ id: workspaceId }))
      expect(table[workspaceId]).toBeUndefined()
    })

    it('refuses the write when a same-id owner on another host sits at a different path', () => {
      const table = useFolderMetaTable()
      delete table[workspaceId]
      const otherOwner = { ...folderRepo, path: '/elsewhere/repo' }
      store.getRepo.mockReturnValue(otherOwner)
      store.getRepos.mockReturnValue([otherOwner, folderRepo])

      handlers['worktrees:updateMeta'](null, {
        worktreeId: workspaceId,
        executionHostId: 'ssh:build-box',
        updates: { lastActivityAt: 2 }
      })

      expect(table[workspaceId]).toBeUndefined()
    })

    it('still persists metadata updates for a folder workspace that exists', () => {
      const table = useFolderMetaTable()

      handlers['worktrees:updateMeta'](null, {
        worktreeId: workspaceId,
        updates: { lastActivityAt: 2 }
      })

      expect(table[workspaceId]).toMatchObject({
        displayName: 'Feature work',
        lastActivityAt: 2
      })
    })
  })

  it('persists display-name provenance at the host boundary', () => {
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    handlers['worktrees:updateMeta'](null, {
      worktreeId: 'repo-1::/workspace/feature-wt',
      updates: { displayName: 'Agent label' }
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/feature-wt',
        hostId: 'local'
      }),
      expect.objectContaining({
        displayName: 'Agent label',
        displayNameIsPinned: true
      })
    )
  })

  it('does not trust renderer-authored automation provenance during local create', async () => {
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      automationProvenance: {
        kind: 'created-by-automation',
        automationId: 'automation-1',
        automationNameSnapshot: 'Forged',
        automationRunId: 'run-1',
        automationRunTitleSnapshot: 'Forged run',
        createdAt: 123,
        executionTargetType: 'local',
        executionTargetId: 'local',
        projectId: 'repo-1'
      }
    })

    const persistedMeta = store.setWorktreeMeta.mock.calls.find(
      ([target]) => target.id === 'repo-1::/workspace/improve-dashboard'
    )?.[1]
    expect(persistedMeta).toBeDefined()
    expect(persistedMeta).not.toHaveProperty('automationProvenance')
  })

  it('persists a sanitized artifact title as the worktree display name', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      displayName: '  Fix: dashboards\nfor PRs\u0000  '
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/improve-dashboard',
        hostId: 'local'
      }),
      expect.objectContaining({
        displayName: 'Fix: dashboards for PRs'
      })
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        displayName: 'Fix: dashboards for PRs'
      })
    })
  })

  it('pins a legacy name-only user create when the branch matches', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/feature',
        head: 'abc123',
        branch: 'feature',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'feature'
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({ id: 'repo-1::/workspace/feature', hostId: 'local' }),
      expect.objectContaining({
        displayName: 'feature',
        displayNameIsPinned: true
      })
    )
  })

  it('persists linked issue and PR metadata during local create', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      linkedIssue: 123,
      linkedPR: 456,
      linkedLinearIssue: 'ENG-123',
      manualOrder: 123_456
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/improve-dashboard',
        hostId: 'local'
      }),
      expect.objectContaining({
        linkedIssue: 123,
        linkedPR: 456,
        linkedLinearIssue: 'ENG-123',
        manualOrder: 123_456
      })
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        linkedIssue: 123,
        linkedPR: 456,
        linkedLinearIssue: 'ENG-123',
        manualOrder: 123_456
      })
    })
  })

  it('persists the selected creation agent during local create', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    const result = await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      createdWithAgent: 'codex'
    })

    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/improve-dashboard',
        hostId: 'local'
      }),
      expect.objectContaining({
        createdWithAgent: 'codex'
      })
    )
    expect(result).toMatchObject({
      worktree: expect.objectContaining({
        createdWithAgent: 'codex'
      })
    })
  })

  it('defers the fork-PR remote during local create and persists the target unmaterialized', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'refs/heads/improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      pushTarget: {
        remoteName: 'pr-prateek-orca',
        branchName: 'prateek/fix-sidebar-agents-toggle',
        remoteUrl: 'git@github.com:prateek/orca.git'
      }
    })

    expect(gitExecFileAsyncMock).not.toHaveBeenCalledWith(
      [
        'remote',
        'add',
        '-t',
        'prateek/fix-sidebar-agents-toggle',
        '--no-tags',
        'pr-prateek-orca',
        'git@github.com:prateek/orca.git'
      ],
      { cwd: '/workspace/repo' }
    )
    expect(gitExecFileAsyncMock).not.toHaveBeenCalledWith(
      [
        'fetch',
        'pr-prateek-orca',
        '+refs/heads/prateek/fix-sidebar-agents-toggle*:refs/remotes/pr-prateek-orca/prateek/fix-sidebar-agents-toggle*'
      ],
      { cwd: '/workspace/repo' }
    )
    expect(gitExecFileAsyncMock).not.toHaveBeenCalledWith(
      [
        'branch',
        '--set-upstream-to',
        'pr-prateek-orca/prateek/fix-sidebar-agents-toggle',
        'improve-dashboard'
      ],
      { cwd: '/workspace/improve-dashboard' }
    )
    // Exact equality rejects premature remoteCreated provenance.
    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/improve-dashboard',
        hostId: 'local'
      }),
      expect.objectContaining({
        pushTarget: {
          remoteName: 'pr-prateek-orca',
          branchName: 'prateek/fix-sidebar-agents-toggle',
          remoteUrl: 'git@github.com:prateek/orca.git'
        }
      })
    )
  })

  it('does not claim the Orca-created marker at create when a sibling worktree minted the fork remote', async () => {
    listWorktreesMock.mockResolvedValue([
      {
        path: '/workspace/improve-dashboard',
        head: 'abc123',
        branch: 'refs/heads/improve-dashboard',
        isBare: false,
        isMainWorktree: false
      }
    ])
    const existingPushTarget = {
      remoteName: 'pr-contributor-orca',
      branchName: 'contributor/previous-fix',
      remoteUrl: 'https://github.com/contributor/orca.git',
      remoteCreated: true
    }
    store.getAllWorktreeMeta.mockReturnValue({
      'repo-1::/workspace/previous-fix': makeWorktreeMeta({
        pushTarget: existingPushTarget
      })
    })
    store.setWorktreeMeta.mockImplementation((_target: HostWorktreeTarget, meta) => meta)
    gitExecFileAsyncMock.mockImplementation(async (args: string[]) => {
      if (args[0] === 'remote' && args.length === 1) {
        return { stdout: 'pr-contributor-orca\n', stderr: '' }
      }
      if (args[0] === 'remote' && args[1] === 'get-url') {
        return {
          stdout: 'https://github.com/contributor/orca.git\n',
          stderr: ''
        }
      }
      return { stdout: '', stderr: '' }
    })

    await handlers['worktrees:create'](null, {
      repoId: 'repo-1',
      name: 'improve-dashboard',
      pushTarget: {
        remoteName: 'pr-contributor-orca',
        branchName: 'contributor/new-fix',
        remoteUrl: 'https://github.com/contributor/orca.git'
      }
    })

    expect(gitExecFileAsyncMock).not.toHaveBeenCalledWith(
      ['remote', 'add', expect.any(String), expect.any(String)],
      expect.any(Object)
    )
    expect(store.setWorktreeMeta).toHaveBeenCalledWith(
      hostWorktreeTarget({
        id: 'repo-1::/workspace/improve-dashboard',
        hostId: 'local'
      }),
      expect.objectContaining({
        pushTarget: {
          remoteName: 'pr-contributor-orca',
          branchName: 'contributor/new-fix',
          remoteUrl: 'https://github.com/contributor/orca.git'
        }
      })
    )
  })
})
