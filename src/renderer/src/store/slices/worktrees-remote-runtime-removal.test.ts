import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
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

describe('worktree remote runtime mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
  })

  it('fails HUB-owned SSH removal closed when the exact id has two HUB owners', async () => {
    const store = createTestStore()
    const worktreeId = 'repo-ssh::/srv/same-wt'
    store.setState({
      worktreesByRepo: {
        'repo-ssh': [
          makeWorktree({
            id: worktreeId,
            repoId: 'repo-ssh',
            hostId: 'ssh:same-private-target',
            runtimeOwnerEnvironmentId: 'hub-a'
          }),
          makeWorktree({
            id: worktreeId,
            repoId: 'repo-ssh',
            hostId: 'ssh:same-private-target',
            runtimeOwnerEnvironmentId: 'hub-b'
          })
        ]
      }
    } as Partial<AppState>)

    const result = await store.getState().removeWorktree({ id: worktreeId, executionHostId: null })

    expect(result).toEqual({
      ok: false,
      error: 'Workspace identity is ambiguous across hosts. Refresh projects and try again.'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(mockApi.worktrees.remove).not.toHaveBeenCalled()
  })

  it('refuses an unqualified forget-local when same-id rows exist on two hosts', async () => {
    const store = createTestStore()
    const worktreeId = 'repo-shared::/path/stale'
    const local = makeWorktree({
      id: worktreeId,
      repoId: 'repo-shared',
      hostId: 'local'
    })
    const remote = makeWorktree({
      id: worktreeId,
      repoId: 'repo-shared',
      hostId: 'runtime:env-1'
    })
    store.setState({
      worktreesByRepo: { 'repo-shared': [local, remote] }
    } as Partial<AppState>)

    const result = await store
      .getState()
      .removeWorktree({ id: worktreeId, executionHostId: null }, false, {
        mode: 'forget-local'
      })

    expect(result).toEqual({
      ok: false,
      error: 'Workspace identity is ambiguous across hosts. Refresh projects and try again.'
    })
    expect(mockApi.worktrees.forgetLocal).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['repo-shared']).toEqual([local, remote])
  })

  // Why (#11960): the store is where `force` and the PTY-stop waiver could most
  // easily be collapsed back into one flag. The ordinary delete confirmation
  // passes force:true, so that alone must never reach the gate as a waiver.
  it('sends force without the PTY-stop waiver unless a caller asks for it', async () => {
    const store = createTestStore()
    const wt = makeWorktree({ id: 'repo1::/w/one', repoId: 'repo1', path: '/w/one' })
    store.setState({ worktreesByRepo: { repo1: [wt] } } as Partial<AppState>)

    await store.getState().removeWorktree({ id: wt.id, executionHostId: null }, true)
    expect(mockApi.worktrees.remove).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: true, allowUnverifiedPtyStop: false })
    )

    // Re-seed: the first removal dropped the row, and a second call for a missing
    // worktree never reaches the API — which would silently re-read the call above.
    const retry = makeWorktree({ id: 'repo1::/w/two', repoId: 'repo1', path: '/w/two' })
    store.setState({ worktreesByRepo: { repo1: [retry] } } as Partial<AppState>)

    await store.getState().removeWorktree({ id: retry.id, executionHostId: null }, true, {
      allowUnverifiedPtyStop: true
    })
    expect(mockApi.worktrees.remove).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: true, allowUnverifiedPtyStop: true })
    )
  })

  it('removes SSH-owned worktrees through local IPC even when a runtime is focused', async () => {
    const store = createTestStore()
    const wt = makeWorktree({
      id: 'repo-ssh::/home/orca/wt1',
      repoId: 'repo-ssh',
      path: '/home/orca/wt1'
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
      ],
      worktreesByRepo: { 'repo-ssh': [wt] }
    } as Partial<AppState>)

    const result = await store.getState().removeWorktree({ id: wt.id, executionHostId: null })

    expect(result).toEqual({ ok: true })
    expect(mockApi.worktrees.remove).toHaveBeenCalledWith({
      worktreeId: wt.id,
      hostId: 'ssh:ssh-1',
      force: undefined,
      // Why (#11960): an ordinary remove never waives the PTY-stop proof.
      allowUnverifiedPtyStop: false,
      // Why (#19334): nor a failed archive hook — only the explicit "Delete anyway" retry does.
      allowFailedArchiveHook: false,
      skipArchive: false
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['repo-ssh']).toEqual([])
  })

  it('fails closed before deleting an exact worktree id owned by multiple hosts', async () => {
    const store = createTestStore()
    const worktreeId = 'repo-shared::/same/path'
    store.setState({
      repos: [
        { id: 'repo-shared', path: '/local', displayName: 'Local', badgeColor: '#000', addedAt: 0 },
        {
          id: 'repo-shared',
          path: '/remote',
          displayName: 'SSH',
          badgeColor: '#111',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ],
      worktreesByRepo: {
        'repo-shared': [
          makeWorktree({ id: worktreeId, repoId: 'repo-shared', hostId: 'local' }),
          makeWorktree({ id: worktreeId, repoId: 'repo-shared', hostId: 'ssh:ssh-1' })
        ]
      }
    } as Partial<AppState>)

    const result = await store.getState().removeWorktree({ id: worktreeId, executionHostId: null })

    expect(result).toEqual({
      ok: false,
      error: 'Workspace identity is ambiguous across hosts. Refresh projects and try again.'
    })
    expect(mockApi.worktrees.remove).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
