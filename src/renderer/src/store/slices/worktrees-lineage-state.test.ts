import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { folderWorkspaceKey, worktreeWorkspaceKey } from '../../../../shared/workspace-scope'
import { makeLineage, makeWorkspaceLineage, makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createLocalLineageTestStore,
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

describe('worktree lineage state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
  })

  it('fetches persisted lineage into the renderer store', async () => {
    const store = createTestStore()
    const lineage = makeLineage()
    mockApi.worktrees.listLineage.mockResolvedValue({ [lineage.worktreeId]: lineage })

    await store.getState().fetchWorktreeLineage()

    expect(mockApi.worktrees.listLineage).toHaveBeenCalled()
    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
    expect(store.getState().workspaceLineageByChildKey).toEqual({})
  })

  it('fetches workspace lineage from the expanded local lineage response', async () => {
    const store = createTestStore()
    const lineage = makeLineage()
    const workspaceLineage = makeWorkspaceLineage()
    mockApi.worktrees.listLineage.mockResolvedValue({
      lineage: { [lineage.worktreeId]: lineage },
      workspaceLineage: { [workspaceLineage.childWorkspaceKey]: workspaceLineage }
    })

    await store.getState().fetchWorktreeLineage()

    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
    expect(store.getState().workspaceLineageByChildKey).toEqual({
      [workspaceLineage.childWorkspaceKey]: workspaceLineage
    })
  })

  it('keeps lineage map and entry identity across a cloned no-op refresh', async () => {
    const lineage = makeLineage({
      capture: { source: 'orchestration-context', confidence: 'explicit' },
      taskId: 'task-42',
      coordinatorHandle: 'coord-1'
    })
    const workspaceLineage = makeWorkspaceLineage({
      childWorkspaceKey: worktreeWorkspaceKey(lineage.worktreeId),
      parentWorkspaceKey: worktreeWorkspaceKey(lineage.parentWorktreeId),
      childInstanceId: lineage.worktreeInstanceId,
      parentInstanceId: lineage.parentWorktreeInstanceId,
      origin: lineage.origin,
      capture: lineage.capture,
      taskId: lineage.taskId,
      coordinatorHandle: lineage.coordinatorHandle,
      createdAt: lineage.createdAt
    })
    const store = createLocalLineageTestStore(lineage)
    const payload = {
      lineage: { [lineage.worktreeId]: lineage },
      workspaceLineage: { [workspaceLineage.childWorkspaceKey]: workspaceLineage }
    }
    mockApi.worktrees.listLineage.mockImplementation(async () => structuredClone(payload))

    await store.getState().fetchWorktreeLineage()
    const afterFirst = store.getState()
    const lineageById = afterFirst.worktreeLineageById
    const workspaceByKey = afterFirst.workspaceLineageByChildKey
    const lineageEntry = lineageById[lineage.worktreeId]
    const workspaceEntry = workspaceByKey[workspaceLineage.childWorkspaceKey]
    expect(lineageEntry).toEqual(lineage)
    expect(lineageEntry).not.toBe(lineage)
    const subscriber = vi.fn()
    const unsubscribe = store.subscribe(subscriber)

    await store.getState().fetchWorktreeLineage()
    unsubscribe()

    expect(store.getState().worktreeLineageById).toBe(lineageById)
    expect(store.getState().workspaceLineageByChildKey).toBe(workspaceByKey)
    expect(store.getState().worktreeLineageById[lineage.worktreeId]).toBe(lineageEntry)
    expect(store.getState().workspaceLineageByChildKey[workspaceLineage.childWorkspaceKey]).toBe(
      workspaceEntry
    )
    expect(subscriber).not.toHaveBeenCalled()
    expect(mockApi.worktrees.listLineage).toHaveBeenCalledTimes(2)
  })

  it('preserves other-host lineage row identity across a cloned same-host refresh', async () => {
    const store = createTestStore()
    const localWorktree = makeWorktree({
      id: 'repo1::/local/child',
      repoId: 'repo1',
      hostId: LOCAL_EXECUTION_HOST_ID
    })
    const sshWorktree = makeWorktree({
      id: 'repo2::/ssh/child',
      repoId: 'repo2',
      hostId: 'ssh:ssh-1'
    })
    const localLineage = makeLineage({
      worktreeId: localWorktree.id,
      parentWorktreeId: 'repo1::/local/parent',
      capture: { source: 'orchestration-context', confidence: 'explicit' },
      taskId: 'task-local',
      coordinatorHandle: 'coord-local'
    })
    const sshLineage = makeLineage({
      worktreeId: sshWorktree.id,
      parentWorktreeId: 'repo2::/ssh/parent',
      capture: { source: 'cwd-context', confidence: 'inferred' },
      taskId: 'task-ssh',
      coordinatorHandle: 'coord-ssh'
    })
    const localWorkspace = makeWorkspaceLineage({
      childWorkspaceKey: worktreeWorkspaceKey(localWorktree.id),
      parentWorkspaceKey: worktreeWorkspaceKey(localLineage.parentWorktreeId),
      childInstanceId: localLineage.worktreeInstanceId,
      parentInstanceId: localLineage.parentWorktreeInstanceId,
      origin: localLineage.origin,
      capture: localLineage.capture,
      taskId: localLineage.taskId,
      coordinatorHandle: localLineage.coordinatorHandle
    })
    const sshWorkspace = makeWorkspaceLineage({
      childWorkspaceKey: worktreeWorkspaceKey(sshWorktree.id),
      parentWorkspaceKey: worktreeWorkspaceKey(sshLineage.parentWorktreeId),
      childInstanceId: sshLineage.worktreeInstanceId,
      parentInstanceId: sshLineage.parentWorktreeInstanceId,
      origin: sshLineage.origin,
      capture: sshLineage.capture,
      taskId: sshLineage.taskId,
      coordinatorHandle: sshLineage.coordinatorHandle
    })
    store.setState({
      worktreesByRepo: {
        repo1: [localWorktree],
        repo2: [sshWorktree]
      },
      worktreeLineageById: {
        [localWorktree.id]: localLineage,
        [sshWorktree.id]: sshLineage
      },
      workspaceLineageByChildKey: {
        [localWorkspace.childWorkspaceKey]: localWorkspace,
        [sshWorkspace.childWorkspaceKey]: sshWorkspace
      }
    } as Partial<AppState>)
    const payload = {
      lineage: { [localWorktree.id]: localLineage },
      workspaceLineage: { [localWorkspace.childWorkspaceKey]: localWorkspace }
    }
    mockApi.worktrees.listLineage.mockImplementation(async () => structuredClone(payload))
    const before = store.getState()

    await store.getState().fetchWorktreeLineage()

    expect(store.getState().worktreeLineageById).toBe(before.worktreeLineageById)
    expect(store.getState().workspaceLineageByChildKey).toBe(before.workspaceLineageByChildKey)
    expect(store.getState().worktreeLineageById[localWorktree.id]).toBe(localLineage)
    expect(store.getState().worktreeLineageById[sshWorktree.id]).toBe(sshLineage)
    expect(store.getState().workspaceLineageByChildKey[localWorkspace.childWorkspaceKey]).toBe(
      localWorkspace
    )
    expect(store.getState().workspaceLineageByChildKey[sshWorkspace.childWorkspaceKey]).toBe(
      sshWorkspace
    )
  })

  it('clears workspace lineage on successful old-shape lineage refresh', async () => {
    const store = createTestStore()
    const lineage = makeLineage()
    const workspaceLineage = makeWorkspaceLineage()
    store.setState({
      workspaceLineageByChildKey: { [workspaceLineage.childWorkspaceKey]: workspaceLineage }
    } as Partial<AppState>)
    mockApi.worktrees.listLineage.mockResolvedValue({ [lineage.worktreeId]: lineage })

    await store.getState().fetchWorktreeLineage()

    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
    expect(store.getState().workspaceLineageByChildKey).toEqual({})
  })

  it('updates a child lineage entry and bumps sortEpoch', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    mockApi.worktrees.updateLineage.mockResolvedValue(lineage)
    store.setState({ sortEpoch: 3 } as Partial<AppState>)

    await store.getState().updateWorktreeLineage(lineage.worktreeId, {
      parentWorktreeId: lineage.parentWorktreeId
    })

    expect(mockApi.worktrees.updateLineage).toHaveBeenCalledWith({
      worktreeId: lineage.worktreeId,
      parentWorktreeId: lineage.parentWorktreeId
    })
    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
    expect(store.getState().sortEpoch).toBe(4)
  })

  it('removes child lineage entries when the backend clears the parent link', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    const workspaceLineage = makeWorkspaceLineage({
      childWorkspaceKey: worktreeWorkspaceKey(lineage.worktreeId)
    })
    mockApi.worktrees.updateLineage.mockResolvedValue(null)
    store.setState({
      worktreeLineageById: { [lineage.worktreeId]: lineage },
      workspaceLineageByChildKey: { [workspaceLineage.childWorkspaceKey]: workspaceLineage },
      sortEpoch: 3
    } as Partial<AppState>)

    await store.getState().updateWorktreeLineage(lineage.worktreeId, { noParent: true })

    expect(store.getState().worktreeLineageById).toEqual({})
    expect(store.getState().workspaceLineageByChildKey).toEqual({})
    expect(store.getState().sortEpoch).toBe(4)
  })

  it('clears inline local lineage immediately when an inline-only child is unnested', async () => {
    const store = createTestStore()
    const lineage = makeLineage()
    const parent = {
      ...makeWorktree({
        id: lineage.parentWorktreeId,
        instanceId: lineage.parentWorktreeInstanceId,
        repoId: 'repo1'
      }),
      childWorktreeIds: [lineage.worktreeId],
      lineage: null
    }
    const child = {
      ...makeWorktree({
        id: lineage.worktreeId,
        instanceId: lineage.worktreeInstanceId,
        repoId: 'repo1'
      }),
      parentWorktreeId: lineage.parentWorktreeId,
      childWorktreeIds: [],
      lineage
    }
    mockApi.worktrees.updateLineage.mockResolvedValue(null)
    store.setState({
      worktreesByRepo: { repo1: [parent, child] },
      worktreeLineageById: {}
    } as Partial<AppState>)

    await store.getState().updateWorktreeLineage(child.id, { noParent: true })

    expect(store.getState().worktreesByRepo.repo1).toMatchObject([
      { id: parent.id, childWorktreeIds: [] },
      { id: child.id, parentWorktreeId: null, lineage: null }
    ])
  })

  it('syncs workspace lineage when a child is manually reparented', async () => {
    const lineage = makeLineage({
      origin: 'manual',
      capture: { source: 'manual-action', confidence: 'explicit' }
    })
    const store = createLocalLineageTestStore(lineage)
    const oldWorkspaceLineage = makeWorkspaceLineage({
      childWorkspaceKey: worktreeWorkspaceKey(lineage.worktreeId),
      parentWorkspaceKey: folderWorkspaceKey('folder-1')
    })
    mockApi.worktrees.updateLineage.mockResolvedValue(lineage)
    store.setState({
      workspaceLineageByChildKey: { [oldWorkspaceLineage.childWorkspaceKey]: oldWorkspaceLineage }
    } as Partial<AppState>)

    await store.getState().updateWorktreeLineage(lineage.worktreeId, {
      parentWorktreeId: lineage.parentWorktreeId
    })

    expect(store.getState().workspaceLineageByChildKey).toEqual({
      [worktreeWorkspaceKey(lineage.worktreeId)]: {
        childWorkspaceKey: worktreeWorkspaceKey(lineage.worktreeId),
        childInstanceId: lineage.worktreeInstanceId,
        parentWorkspaceKey: worktreeWorkspaceKey(lineage.parentWorktreeId),
        parentInstanceId: lineage.parentWorktreeInstanceId,
        origin: lineage.origin,
        capture: lineage.capture,
        createdAt: lineage.createdAt
      }
    })
  })

  it('refetches lineage and rethrows after an update failure', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    mockApi.worktrees.updateLineage.mockRejectedValueOnce(new Error('stale parent'))
    mockApi.worktrees.listLineage.mockResolvedValue({ [lineage.worktreeId]: lineage })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      store.getState().updateWorktreeLineage(lineage.worktreeId, {
        parentWorktreeId: lineage.parentWorktreeId
      })
    ).rejects.toThrow('stale parent')

    expect(mockApi.worktrees.listLineage).toHaveBeenCalled()
    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
  })

  it('refetches lineage and rethrows when explicit parent assignment fails', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    mockApi.worktrees.updateLineage.mockRejectedValueOnce(new Error('stale parent'))
    mockApi.worktrees.listLineage.mockResolvedValue({ [lineage.worktreeId]: lineage })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      store.getState().assignWorktreeParent(lineage.worktreeId, {
        parentWorktreeId: lineage.parentWorktreeId
      })
    ).rejects.toThrow('stale parent')

    expect(mockApi.worktrees.listLineage).toHaveBeenCalled()
    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
  })

  it('pins lineage refresh to the local host when forceLocalOwner is set', async () => {
    const store = createTestStore()
    const lineage = makeLineage()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      worktreesByRepo: {}
    } as Partial<AppState>)
    mockApi.worktrees.listLineage.mockResolvedValue({ [lineage.worktreeId]: lineage })

    await store.getState().fetchWorktreeLineage({ forceLocalOwner: true })

    expect(mockApi.worktrees.listLineage).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(store.getState().worktreeLineageById).toEqual({ [lineage.worktreeId]: lineage })
  })

  // An unresolvable owner route must reach the caller so the sidebar can toast it, rather than
  // becoming a silent no-op. Both callers catch; see WorktreeContextMenu.handleRemoveParentLink.
  it('rejects the lineage update when the owner route cannot be resolved', async () => {
    const store = createTestStore()
    const worktreeId = 'repo-shared::/same/path'
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'hub-c' } as never,
      worktreesByRepo: {
        'repo-shared': [
          makeWorktree({
            id: worktreeId,
            repoId: 'repo-shared',
            hostId: 'ssh:ssh-a',
            runtimeOwnerEnvironmentId: 'hub-a'
          }),
          makeWorktree({
            id: worktreeId,
            repoId: 'repo-shared',
            hostId: 'ssh:ssh-b',
            runtimeOwnerEnvironmentId: 'hub-b'
          })
        ]
      }
    } as Partial<AppState>)

    await expect(
      store.getState().updateWorktreeLineage(worktreeId, { noParent: true })
    ).rejects.toThrow()

    expect(mockApi.worktrees.updateLineage).not.toHaveBeenCalled()
  })

  it('rethrows the original update failure when the recovery refresh fails', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    mockApi.worktrees.updateLineage.mockRejectedValueOnce(new Error('unnest failed'))
    mockApi.worktrees.listLineage.mockRejectedValueOnce(new Error('refresh failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      store.getState().updateWorktreeLineage(lineage.worktreeId, { noParent: true })
    ).rejects.toThrow('unnest failed')
  })

  it('rethrows the original assign failure when the recovery refresh fails', async () => {
    const lineage = makeLineage()
    const store = createLocalLineageTestStore(lineage)
    mockApi.worktrees.updateLineage.mockRejectedValueOnce(new Error('stale parent'))
    mockApi.worktrees.listLineage.mockRejectedValueOnce(new Error('refresh failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // A failed recovery refresh must not replace the cause the caller toasts.
    await expect(
      store.getState().assignWorktreeParent(lineage.worktreeId, {
        parentWorktreeId: lineage.parentWorktreeId
      })
    ).rejects.toThrow('stale parent')
  })
})
