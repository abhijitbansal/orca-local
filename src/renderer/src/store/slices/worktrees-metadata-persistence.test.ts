import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import { toast } from 'sonner'
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

  it('suppresses per-branch feedback for an aggregate delete', async () => {
    const store = createTestStore()
    const wt = makeWorktree({ id: 'repo1::/path/wt1', repoId: 'repo1', path: '/path/wt1' })
    store.setState({ worktreesByRepo: { repo1: [wt] } } as Partial<AppState>)
    vi.mocked(toast.success).mockClear()
    vi.mocked(toast.error).mockClear()

    const result = await store
      .getState()
      .forceDeletePreservedBranch(wt.id, 'feature/test', 'abc123', { suppressToast: true })

    expect(result).toEqual({ ok: true, deleted: true })
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('fails preserved branch deletion closed for two HUB owners', async () => {
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

    const result = await store
      .getState()
      .forceDeletePreservedBranch(worktreeId, 'feature/nested', 'abc123')

    expect(result).toEqual({
      ok: false,
      error: 'Workspace identity is ambiguous across hosts. Refresh projects and try again.'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(mockApi.worktrees.forceDeletePreservedBranch).not.toHaveBeenCalled()
  })

  it('persists SSH-owned worktree metadata through local IPC even when a runtime is focused', async () => {
    const store = createTestStore()
    const wt = makeWorktree({
      id: 'repo-ssh::/home/orca/wt1',
      repoId: 'repo-ssh',
      path: '/home/orca/wt1',
      hostId: 'ssh:ssh-1'
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

    await store.getState().updateWorktreeMeta(wt.id, { comment: 'ssh note' })

    expect(mockApi.worktrees.updateMeta).toHaveBeenCalledWith({
      worktreeId: wt.id,
      executionHostId: 'ssh:ssh-1',
      updates: expect.objectContaining({ comment: 'ssh note' })
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo['repo-ssh'][0]?.comment).toBe('ssh note')
  })

  it('clears pending first-agent rename when the title is updated', async () => {
    const store = createTestStore()
    const wt = makeWorktree({
      id: 'repo1::/path/wt1',
      repoId: 'repo1',
      path: '/path/wt1',
      displayName: 'Nautilus',
      pendingFirstAgentMessageRename: true
    })
    store.setState({
      worktreesByRepo: { repo1: [wt] }
    } as Partial<AppState>)

    await store.getState().updateWorktreeMeta(wt.id, { displayName: 'Fix auth' })

    expect(mockApi.worktrees.updateMeta).toHaveBeenCalledWith({
      worktreeId: wt.id,
      executionHostId: 'local',
      updates: {
        displayName: 'Fix auth',
        displayNameIsPinned: true,
        pendingFirstAgentMessageRename: false,
        firstAgentMessageRenameError: null
      }
    })
    expect(store.getState().worktreesByRepo.repo1[0]).toMatchObject({
      displayName: 'Fix auth',
      pendingFirstAgentMessageRename: false,
      firstAgentMessageRenameError: null
    })
  })

  it('clears the linked PR metadata locally when removing a linked PR', async () => {
    const store = createTestStore()
    const wt = makeWorktree({
      id: 'repo1::/path/wt1',
      repoId: 'repo1',
      path: '/path/wt1',
      branch: 'refs/heads/pr-branch',
      linkedPR: 456
    })
    store.setState({
      repos: [
        {
          id: 'repo1',
          path: '/repo1',
          displayName: 'repo1',
          badgeColor: '#000',
          addedAt: 0,
          kind: 'git'
        }
      ],
      worktreesByRepo: { repo1: [wt] }
    })

    await store.getState().updateWorktreeMeta(wt.id, { linkedPR: null })

    expect(store.getState().worktreesByRepo.repo1[0]?.linkedPR).toBeNull()
  })

  it('applies batch metadata updates in one store transition', async () => {
    const store = createTestStore()
    const first = makeWorktree({ id: 'repo1::/path/wt1', repoId: 'repo1', path: '/path/wt1' })
    const second = makeWorktree({ id: 'repo1::/path/wt2', repoId: 'repo1', path: '/path/wt2' })
    const subscriber = vi.fn()
    store.setState({
      worktreesByRepo: { repo1: [first, second] },
      sortEpoch: 7
    } as Partial<AppState>)

    const unsubscribe = store.subscribe(subscriber)
    await store.getState().updateWorktreesMeta([
      { worktreeId: first.id, updates: { workspaceStatus: 'in-review' } },
      { worktreeId: second.id, updates: { workspaceStatus: 'completed' } }
    ])
    unsubscribe()

    expect(store.getState().worktreesByRepo.repo1.map((w) => w.workspaceStatus)).toEqual([
      'in-review',
      'completed'
    ])
    expect(store.getState().sortEpoch).toBe(8)
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(mockApi.worktrees.updateMeta).toHaveBeenCalledTimes(2)
  })
})
