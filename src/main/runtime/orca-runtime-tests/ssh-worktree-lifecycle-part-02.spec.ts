import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetWorktreeTestSshHostHome } from '../../worktree-removal-test-ssh-host-home'

import {
  OrcaRuntimeService,
  closeRemoteWatcherForWorktreePathMock,
  deleteWorktreeHistoryDirMock,
  getEffectiveHooks,
  hasHooksFile,
  listWorktrees,
  loadHooks,
  registerSshGitProvider,
  removeWorktree,
  unregisterSshGitProvider
} from '../orca-runtime-test-mocks.spec'
import {
  TEST_REPO_ID,
  TEST_REPO_PATH,
  store,
  syncSinglePty
} from '../orca-runtime-test-fixtures.spec'

// Why: these fixtures register an SSH provider, which models a connected relay session — and a
// connected session has always read the host's `$HOME`. The removal guards refuse without it.
beforeEach(resetWorktreeTestSshHostHome)

describe('OrcaRuntimeService', () => {
  it('removes SSH-backed runtime worktrees through the SSH git provider', async () => {
    vi.mocked(listWorktrees).mockClear()
    const remoteStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: '/remote/repo',
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ],
      getRepo: () => ({
        id: TEST_REPO_ID,
        path: '/remote/repo',
        displayName: 'repo',
        badgeColor: 'blue',
        addedAt: 1,
        connectionId: 'ssh-1'
      })
    }
    const gitProvider = {
      listWorktrees: vi.fn().mockResolvedValue([
        {
          path: '/remote/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        },
        {
          path: '/remote/feature',
          head: 'abc',
          branch: 'feature/foo',
          isBare: false,
          isMainWorktree: false
        }
      ]),
      removeWorktree: vi.fn().mockResolvedValue(undefined)
    }
    registerSshGitProvider('ssh-1', gitProvider as never)
    const ptyProvider = {
      listProcesses: vi.fn().mockResolvedValue([
        {
          id: 'pty-remote',
          cwd: '/remote/feature',
          title: 'shell',
          worktreeId: `${TEST_REPO_ID}::/remote/feature`
        }
      ]),
      shutdown: vi.fn().mockResolvedValue(undefined),
      deleteWorktreeHistory: vi.fn().mockResolvedValue(undefined)
    }
    const runtime = new OrcaRuntimeService(remoteStore as never, undefined, {
      getSshProvider: () => ptyProvider as never
    })

    try {
      await runtime.removeManagedWorktree('path:/remote/feature', { force: true, runHooks: false })
    } finally {
      unregisterSshGitProvider('ssh-1')
    }

    expect(gitProvider.removeWorktree).toHaveBeenCalledWith('/remote/feature', true)
    expect(ptyProvider.shutdown).toHaveBeenCalledWith(
      'pty-remote',
      expect.objectContaining({ immediate: true })
    )
    expect(ptyProvider.deleteWorktreeHistory).toHaveBeenCalledWith(
      `${TEST_REPO_ID}::/remote/feature`
    )
    expect(ptyProvider.shutdown.mock.invocationCallOrder[0]).toBeLessThan(
      gitProvider.removeWorktree.mock.invocationCallOrder[0]
    )
    expect(closeRemoteWatcherForWorktreePathMock).toHaveBeenCalledWith('ssh-1', '/remote/feature')
    expect(closeRemoteWatcherForWorktreePathMock.mock.invocationCallOrder[0]).toBeLessThan(
      gitProvider.removeWorktree.mock.invocationCallOrder[0]
    )
    expect(removeWorktree).not.toHaveBeenCalled()
    expect(listWorktrees).not.toHaveBeenCalled()
    expect(deleteWorktreeHistoryDirMock).toHaveBeenCalledWith(`${TEST_REPO_ID}::/remote/feature`)
  })

  // Regression: `repoId::path` ids repeat across hosts, so the SSH delete's runtime sweep used to
  // stop the same-id local workspace's terminals too.
  it('leaves a same-id local terminal running when the SSH copy is removed', async () => {
    const remoteRepo = {
      id: TEST_REPO_ID,
      path: '/remote/repo',
      displayName: 'repo',
      badgeColor: 'blue',
      addedAt: 1,
      connectionId: 'ssh-1'
    }
    const remoteStore = { ...store, getRepos: () => [remoteRepo], getRepo: () => remoteRepo }
    const gitProvider = {
      listWorktrees: vi.fn().mockResolvedValue([
        {
          path: '/remote/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        },
        {
          path: '/remote/feature',
          head: 'abc',
          branch: 'feature/foo',
          isBare: false,
          isMainWorktree: false
        }
      ]),
      removeWorktree: vi.fn().mockResolvedValue(undefined)
    }
    registerSshGitProvider('ssh-1', gitProvider as never)
    const ptyProvider = {
      listProcesses: vi.fn().mockResolvedValue([]),
      shutdown: vi.fn().mockResolvedValue(undefined)
    }
    const runtime = new OrcaRuntimeService(remoteStore as never, undefined, {
      getSshProvider: () => ptyProvider as never
    })
    const stopAndWait = vi.fn(async () => true)
    runtime.setPtyController({
      write: () => true,
      kill: vi.fn(() => true),
      stopAndWait,
      getForegroundProcess: async () => null
    })
    syncSinglePty(runtime, null)
    runtime.registerPty('pty-remote', `${TEST_REPO_ID}::/remote/feature`, 'ssh-1')
    runtime.registerPty('pty-local-same-id', `${TEST_REPO_ID}::/remote/feature`, null)

    try {
      await runtime.removeManagedWorktree('path:/remote/feature', { force: true, runHooks: false })
    } finally {
      unregisterSshGitProvider('ssh-1')
    }

    expect(stopAndWait).toHaveBeenCalledWith('pty-remote', expect.anything())
    expect(stopAndWait).not.toHaveBeenCalledWith('pty-local-same-id', expect.anything())
  })

  it('rejects SSH-backed runtime removal of the main worktree before provider deletion', async () => {
    const remoteStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: '/remote/repo',
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ],
      getRepo: () => ({
        id: TEST_REPO_ID,
        path: '/remote/repo',
        displayName: 'repo',
        badgeColor: 'blue',
        addedAt: 1,
        connectionId: 'ssh-1'
      })
    }
    const gitProvider = {
      listWorktrees: vi.fn().mockResolvedValue([
        {
          path: '/remote/repo',
          head: 'main',
          branch: 'refs/heads/main',
          isBare: false,
          isMainWorktree: true
        }
      ]),
      removeWorktree: vi.fn().mockResolvedValue(undefined)
    }
    registerSshGitProvider('ssh-1', gitProvider as never)
    const runtime = new OrcaRuntimeService(remoteStore as never)

    try {
      await expect(
        runtime.removeManagedWorktree('path:/remote/repo', { force: true })
      ).rejects.toThrow('Refusing to delete protected worktree path: /remote/repo')
    } finally {
      unregisterSshGitProvider('ssh-1')
    }

    expect(gitProvider.removeWorktree).not.toHaveBeenCalled()
    expect(removeWorktree).not.toHaveBeenCalled()
  })

  it('hashes only the shared orca.yaml setup script for local run-both hooks', async () => {
    vi.mocked(hasHooksFile).mockReturnValue(true)
    vi.mocked(loadHooks).mockReturnValue({ scripts: { setup: 'echo yaml setup' } })
    vi.mocked(getEffectiveHooks).mockReturnValue({
      scripts: { setup: 'echo yaml setup\necho local setup' }
    })
    const runtimeStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: TEST_REPO_PATH,
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          hookSettings: {
            commandSourcePolicy: 'run-both' as const,
            scripts: { setup: 'echo local setup' }
          }
        }
      ]
    }
    const runtime = new OrcaRuntimeService(runtimeStore as never)

    await expect(runtime.getRepoHooks('id:repo-1')).resolves.toMatchObject({
      hooks: { scripts: { setup: 'echo yaml setup\necho local setup' } },
      setupTrust: {
        contentHash: '9bc9f57699fe0390d263cca1aec01235cccc8fa5fc87cd87fd51ba1c8483ec84',
        scriptContent: 'echo yaml setup'
      }
    })
  })
})
