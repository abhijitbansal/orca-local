import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import { clearHugeRepoWarningDismissalsForTests } from '@/lib/source-control-huge-repo-warning-dismissals'
import { makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  forgetRemovedForExecutionHostMock,
  listKnownForExecutionHostMock,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory,
  worktreeListMock
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

  it('leaves local metadata to the persistence GC after an authoritative local scan', async () => {
    const store = createTestStore()
    const localRepo = {
      id: 'repo-local',
      path: '/local/repo',
      displayName: 'Local Repo',
      badgeColor: '#000',
      addedAt: 0
    }
    const removed = makeWorktree({
      id: 'repo-local::/local/removed',
      repoId: localRepo.id,
      path: '/local/removed'
    })
    const survivor = makeWorktree({
      id: 'repo-local::/local/survivor',
      repoId: localRepo.id,
      path: '/local/survivor'
    })
    store.setState({
      repos: [localRepo],
      worktreesByRepo: { [localRepo.id]: [removed, survivor] }
    } as Partial<AppState>)
    worktreeListMock.mockResolvedValueOnce([survivor])

    await store.getState().fetchWorktrees(localRepo.id)

    expect(store.getState().worktreesByRepo[localRepo.id]).toEqual([survivor])
    // Local metas are GC-eligible on their own; only the SSH exemption needs this IPC.
    expect(forgetRemovedForExecutionHostMock).not.toHaveBeenCalled()
  })

  it('skips the metadata fallback entirely for authoritative-only callers', async () => {
    const store = createTestStore()
    const sshRepo = {
      id: 'repo-ssh',
      path: '/home/orca/repo',
      displayName: 'SSH Repo',
      badgeColor: '#000',
      addedAt: 0,
      connectionId: 'ssh-1'
    }
    store.setState({ repos: [sshRepo], sshConnectionStates: new Map() } as Partial<AppState>)
    const worktreesByRepo = store.getState().worktreesByRepo
    const detectedWorktreesByRepo = store.getState().detectedWorktreesByRepo

    await expect(
      store.getState().fetchWorktrees(sshRepo.id, { requireAuthoritative: true })
    ).resolves.toBe(false)

    // Why: these callers asked for authoritative-or-nothing; non-authoritative rows must not land as a side effect.
    expect(listKnownForExecutionHostMock).not.toHaveBeenCalled()
    expect(mockApi.worktrees.listDetected).not.toHaveBeenCalled()
    expect(store.getState().worktreesByRepo).toBe(worktreesByRepo)
    expect(store.getState().detectedWorktreesByRepo).toBe(detectedWorktreesByRepo)
  })
})
