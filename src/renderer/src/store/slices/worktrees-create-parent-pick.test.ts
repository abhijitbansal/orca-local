import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import type { Worktree } from '../../../../shared/worktree/types'
import { toast } from 'sonner'
import { worktreeWorkspaceKey, folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { makeLineage, makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory
} from './worktrees-slice-test-harness'

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
  requestWorktreeBaseFallbackNotice: vi.fn()
}))

beforeEach(resetWorktreeSliceModuleMemory)

describe('createWorktree composer parent pick', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
  })

  function createParentPickStore(parent?: Worktree) {
    const store = createTestStore()
    store.setState({ worktreesByRepo: { repo1: parent ? [parent] : [] } } as Partial<AppState>)
    return store
  }

  function createWithParentPick(
    store: ReturnType<typeof createTestStore>,
    parentWorktreeId: string
  ) {
    const createWorktree = store.getState().createWorktree
    const args: Parameters<typeof createWorktree> = ['repo1', 'feature', 'origin/main']
    args[25] = { parentWorktreeId }
    return createWorktree(...args)
  }

  it('nests the new workspace under the picked parent worktree', async () => {
    const parent = makeWorktree({
      id: 'repo1::/path/parent',
      repoId: 'repo1',
      path: '/path/parent',
      instanceId: 'parent-instance'
    })
    const store = createParentPickStore(parent)
    store.setState({ activeWorkspaceKey: folderWorkspaceKey('folder-1') } as Partial<AppState>)
    mockApi.worktrees.create.mockResolvedValue({
      worktree: makeWorktree({ id: 'repo1::/path/child', repoId: 'repo1', path: '/path/child' })
    })

    await createWithParentPick(store, parent.id)

    expect(mockApi.worktrees.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentWorkspace: worktreeWorkspaceKey(parent.id) })
    )
  })

  it('drops a stale parent pick and falls back to the active folder workspace', async () => {
    const store = createParentPickStore()
    store.setState({ activeWorkspaceKey: folderWorkspaceKey('folder-1') } as Partial<AppState>)
    mockApi.worktrees.create.mockResolvedValue({
      worktree: makeWorktree({ id: 'repo1::/path/child', repoId: 'repo1', path: '/path/child' })
    })

    await createWithParentPick(store, 'repo1::/path/removed')

    expect(mockApi.worktrees.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentWorkspace: folderWorkspaceKey('folder-1') })
    )
  })

  it('warns when an archived parent pick is dropped before create', async () => {
    const parent = makeWorktree({
      id: 'repo1::/path/parent',
      repoId: 'repo1',
      path: '/path/parent',
      displayName: 'parent-wt',
      isArchived: true
    })
    const store = createParentPickStore(parent)
    mockApi.worktrees.create.mockResolvedValue({
      worktree: makeWorktree({ id: 'repo1::/path/child', repoId: 'repo1', path: '/path/child' })
    })

    await createWithParentPick(store, parent.id)

    expect(toast.warning).toHaveBeenCalledWith(
      'Created without nesting under "parent-wt"',
      expect.objectContaining({ description: expect.any(String) })
    )
  })

  it('warns when the backend rejects an accepted parent pick', async () => {
    const parent = makeWorktree({
      id: 'repo1::/path/parent',
      repoId: 'repo1',
      path: '/path/parent',
      displayName: 'parent-wt',
      instanceId: 'parent-instance'
    })
    const store = createParentPickStore(parent)
    mockApi.worktrees.create.mockResolvedValue({
      worktree: makeWorktree({ id: 'repo1::/path/child', repoId: 'repo1', path: '/path/child' }),
      lineage: null
    })

    await createWithParentPick(store, parent.id)

    expect(toast.warning).toHaveBeenCalledWith(
      'Created without nesting under "parent-wt"',
      expect.objectContaining({ description: expect.any(String) })
    )
  })

  it('keeps an accepted parent pick quiet and seeds its lineage', async () => {
    const parent = makeWorktree({
      id: 'repo1::/path/parent',
      repoId: 'repo1',
      path: '/path/parent',
      instanceId: 'parent-instance'
    })
    const created = makeWorktree({
      id: 'repo1::/path/child',
      repoId: 'repo1',
      path: '/path/child',
      instanceId: 'child-instance'
    })
    const lineage = makeLineage({
      worktreeId: created.id,
      worktreeInstanceId: 'child-instance',
      parentWorktreeId: parent.id,
      parentWorktreeInstanceId: 'parent-instance'
    })
    const store = createParentPickStore(parent)
    mockApi.worktrees.create.mockResolvedValue({ worktree: created, lineage })

    await createWithParentPick(store, parent.id)

    expect(toast.warning).not.toHaveBeenCalled()
    expect(store.getState().worktreeLineageById[created.id]).toEqual(lineage)
  })

  // Why: paired web clients route window.api.worktrees.create to their host, which still rejects.
  it('retries without the parent when the create API reports the parent is gone', async () => {
    const parent = makeWorktree({
      id: 'repo1::/path/parent',
      repoId: 'repo1',
      path: '/path/parent',
      displayName: 'parent-wt',
      instanceId: 'parent-instance'
    })
    const store = createParentPickStore(parent)
    mockApi.worktrees.create
      .mockRejectedValueOnce(
        Object.assign(new Error('Parent selector was not found.'), {
          code: 'LINEAGE_PARENT_NOT_FOUND'
        })
      )
      .mockResolvedValue({
        worktree: makeWorktree({ id: 'repo1::/path/child', repoId: 'repo1', path: '/path/child' })
      })

    await createWithParentPick(store, parent.id)

    expect(mockApi.worktrees.create).toHaveBeenCalledTimes(2)
    expect(mockApi.worktrees.create.mock.calls[1][0]).not.toHaveProperty('parentWorkspace')
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('warns once when a dropped pick is followed by branch-conflict retries', async () => {
    const store = createParentPickStore()
    const created = makeWorktree({
      id: 'repo1::/path/child',
      repoId: 'repo1',
      path: '/path/child'
    })
    mockApi.worktrees.create
      .mockRejectedValueOnce(new Error('Branch "feature" already exists locally.'))
      .mockResolvedValue({ worktree: created })

    await createWithParentPick(store, 'repo1::/path/removed')

    expect(mockApi.worktrees.create).toHaveBeenCalledTimes(2)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })
})
