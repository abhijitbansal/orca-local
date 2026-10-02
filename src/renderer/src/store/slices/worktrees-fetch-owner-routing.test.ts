import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import type { ListDetectedWorktreesArgs } from '../../../../shared/detected-worktree-provider-contract'
import type { SshProviderEpoch } from '../../../../shared/ssh-types'
import { clearHugeRepoWarningDismissalsForTests } from '@/lib/source-control-huge-repo-warning-dismissals'
import {
  TEST_SSH_AUTHORITY,
  makeDetectedResult,
  qualifyDetectedResult
} from './worktrees-detected-listing-fixtures'
import { makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory,
  runtimeEnvironmentCall
} from './worktrees-slice-test-harness'

const requestWorktreeBaseFallbackNotice = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn()
  }
}))

vi.mock('@/components/worktree-base-fallback-notice', () => ({
  requestWorktreeBaseFallbackNotice
}))

beforeEach(resetWorktreeSliceModuleMemory)

describe('fetchWorktrees', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
    clearHugeRepoWarningDismissalsForTests()
  })

  it('pins the list fetch to the local host when forceLocalOwner is set', async () => {
    // Regression: a local `worktrees:changed` event for an unbound
    // repo while a remote runtime is active must refresh against the local
    // host, not the runtime — otherwise CLI-created local worktrees stay
    // invisible in the sidebar until an app restart.
    const store = createTestStore()
    const local = makeWorktree({
      id: 'repo1::/local/wt1',
      repoId: 'repo1',
      path: '/local/wt1',
      branch: 'refs/heads/local'
    })
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-1' } as never })
    mockApi.worktrees.listDetected.mockResolvedValueOnce(makeDetectedResult('repo1', [local]))

    await store.getState().fetchWorktrees('repo1', { forceLocalOwner: true })

    expect(store.getState().worktreesByRepo.repo1).toEqual([local])
    expect(mockApi.worktrees.listDetected).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('pins a duplicate repo id to its local owner without replacing runtime worktrees', async () => {
    const store = createTestStore()
    const local = makeWorktree({
      id: 'same-repo::/local/wt',
      repoId: 'same-repo',
      path: '/local/wt',
      hostId: 'local'
    })
    const remote = makeWorktree({
      id: 'same-repo::/remote/wt',
      repoId: 'same-repo',
      path: '/remote/wt',
      hostId: 'runtime:env-1'
    })
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [
        {
          id: 'same-repo',
          path: '/repos/local',
          displayName: 'local',
          badgeColor: '#000',
          addedAt: 0,
          executionHostId: 'local'
        },
        {
          id: 'same-repo',
          path: '/repos/remote',
          displayName: 'remote',
          badgeColor: '#111',
          addedAt: 1,
          executionHostId: 'runtime:env-1'
        }
      ],
      worktreesByRepo: { 'same-repo': [remote] },
      detectedWorktreesByRepo: {
        'same-repo': makeDetectedResult('same-repo', [remote])
      }
    } as Partial<AppState>)
    mockApi.worktrees.listDetected.mockResolvedValueOnce(makeDetectedResult('same-repo', [local]))

    await store.getState().fetchWorktrees('same-repo', { forceLocalOwner: true })

    expect(mockApi.worktrees.listDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'same-repo',
        executionHostId: 'local'
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['same-repo']).toEqual([remote, local])
    expect(store.getState().detectedWorktreesByRepo['same-repo']?.worktrees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: remote.id, hostId: 'runtime:env-1' }),
        expect.objectContaining({ id: local.id, hostId: 'local' })
      ])
    )
  })

  it('fetches SSH repo worktrees through local IPC even when a runtime is focused', async () => {
    const store = createTestStore()
    const sshWorktree = makeWorktree({
      id: 'repo-ssh::/home/orca/wt1',
      repoId: 'repo-ssh',
      path: '/home/orca/wt1',
      branch: 'refs/heads/ssh'
    })
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [
        {
          id: 'repo-ssh',
          path: '/home/orca/repo',
          displayName: 'SSH Repo',
          badgeColor: '#000',
          addedAt: 0,
          connectionId: 'ssh-1'
        }
      ]
    } as Partial<AppState>)
    mockApi.worktrees.listDetected.mockImplementationOnce(async (args: ListDetectedWorktreesArgs) =>
      qualifyDetectedResult(args, makeDetectedResult('repo-ssh', [sshWorktree], { source: 'git' }))
    )

    await store.getState().fetchWorktrees('repo-ssh', { forceLocalOwner: true })

    expect(mockApi.worktrees.listDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-ssh',
        executionHostId: 'ssh:ssh-1',
        expectedAuthority: TEST_SSH_AUTHORITY
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    // Why: SSH worktrees are fetched via local IPC but belong to the SSH host, so they carry the repo's ssh host id.
    expect(store.getState().worktreesByRepo['repo-ssh']).toEqual([
      { ...sshWorktree, hostId: 'ssh:ssh-1' }
    ])
  })

  it('fetches the requested host when duplicate repo ids exist', async () => {
    const store = createTestStore()
    const localWorktree = makeWorktree({
      id: 'same-repo::/local/wt',
      repoId: 'same-repo',
      path: '/local/wt'
    })
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [
        {
          id: 'same-repo',
          path: '/local/repo',
          displayName: 'Local',
          badgeColor: '#000',
          addedAt: 0,
          executionHostId: 'local'
        },
        {
          id: 'same-repo',
          path: '/remote/repo',
          displayName: 'Runtime',
          badgeColor: '#111',
          addedAt: 1,
          executionHostId: 'runtime:env-1'
        }
      ]
    } as Partial<AppState>)
    mockApi.worktrees.listDetected.mockResolvedValueOnce(
      makeDetectedResult('same-repo', [localWorktree])
    )

    await store.getState().fetchWorktrees('same-repo', { executionHostId: 'local' })

    expect(mockApi.worktrees.listDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'same-repo',
        executionHostId: 'local'
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['same-repo']).toEqual([localWorktree])
  })

  it('honors an explicit SSH owner before the repo catalog is hydrated', async () => {
    const store = createTestStore()
    const remote = makeWorktree({
      id: 'repo-missing::/ssh/wt',
      repoId: 'repo-missing',
      path: '/ssh/wt',
      hostId: 'local'
    })
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-ambient' } as never,
      repos: []
    } as Partial<AppState>)
    mockApi.worktrees.listDetected.mockImplementationOnce(async (args: ListDetectedWorktreesArgs) =>
      qualifyDetectedResult(args, makeDetectedResult('repo-missing', [remote]))
    )

    await store.getState().fetchWorktrees('repo-missing', {
      executionHostId: 'ssh:ssh-1',
      requireAuthoritative: true
    })

    expect(mockApi.worktrees.listDetected).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo-missing',
        executionHostId: 'ssh:ssh-1',
        expectedAuthority: TEST_SSH_AUTHORITY
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['repo-missing']).toEqual([
      { ...remote, hostId: 'ssh:ssh-1' }
    ])
  })

  it('rejects a missing-owner SSH result after the repo catalog changes', async () => {
    const store = createTestStore()
    const remote = makeWorktree({
      id: 'repo-missing::/ssh/wt',
      repoId: 'repo-missing',
      path: '/ssh/wt'
    })
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      mockApi.worktrees.listDetected.mockImplementationOnce(
        async (args: ListDetectedWorktreesArgs) => {
          resolve()
          await new Promise<void>((resume) => {
            release = resume
          })
          return qualifyDetectedResult(args, makeDetectedResult('repo-missing', [remote]))
        }
      )
    })

    const refresh = store.getState().fetchWorktrees('repo-missing', {
      executionHostId: 'ssh:ssh-1',
      requireAuthoritative: true
    })
    await started
    store.setState({ repos: [] })
    release()

    await expect(refresh).resolves.toBe(false)
    expect(store.getState().worktreesByRepo['repo-missing']).toBeUndefined()
  })

  it('rejects a missing-owner SSH result after the provider reconnects', async () => {
    const store = createTestStore()
    const remote = makeWorktree({
      id: 'repo-missing::/ssh/wt',
      repoId: 'repo-missing',
      path: '/ssh/wt'
    })
    let release!: () => void
    const started = new Promise<void>((resolve) => {
      mockApi.worktrees.listDetected.mockImplementationOnce(
        async (args: ListDetectedWorktreesArgs) => {
          resolve()
          await new Promise<void>((resume) => {
            release = resume
          })
          return qualifyDetectedResult(args, makeDetectedResult('repo-missing', [remote]))
        }
      )
    })

    const refresh = store.getState().fetchWorktrees('repo-missing', {
      executionHostId: 'ssh:ssh-1',
      requireAuthoritative: true
    })
    await started
    store.setState({
      sshConnectionStates: new Map([
        [
          TEST_SSH_AUTHORITY.targetId,
          {
            targetId: TEST_SSH_AUTHORITY.targetId,
            status: 'connected',
            error: null,
            reconnectAttempt: 0,
            providerEpoch: 'provider-ssh-2' as SshProviderEpoch,
            connectionGeneration: TEST_SSH_AUTHORITY.connectionGeneration + 1
          }
        ]
      ])
    })
    release()

    await expect(refresh).resolves.toBe(false)
    expect(store.getState().worktreesByRepo['repo-missing']).toBeUndefined()
  })
})
