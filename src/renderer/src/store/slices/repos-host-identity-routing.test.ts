import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestStore, makeWorktree } from './store-test-helpers'
import type { Project, ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'

const localDuplicate: Repo = {
  id: 'same-repo',
  path: '/local',
  displayName: 'Local',
  badgeColor: '#000',
  addedAt: 1,
  executionHostId: 'local'
}

const remoteDuplicate: Repo = {
  id: 'same-repo',
  path: '/remote',
  displayName: 'Remote',
  badgeColor: '#111',
  addedAt: 2,
  executionHostId: 'runtime:env-1'
}

const sshDuplicate: Repo = {
  id: 'same-repo',
  path: '/ssh',
  displayName: 'SSH',
  badgeColor: '#222',
  addedAt: 3,
  connectionId: 'server',
  executionHostId: 'ssh:server'
}

const reposRemove = vi.fn()
const reposRemoveForHost = vi.fn()
const reposUpdate = vi.fn()
const reposReorder = vi.fn()
const reposReorderForHost = vi.fn()
const ptyKill = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const uiSet = vi.fn()

function projectHostSetup(overrides: Pick<ProjectHostSetup, 'id' | 'hostId'>): ProjectHostSetup {
  return {
    projectId: 'repo:same-repo',
    repoId: 'same-repo',
    path: '/same-repo',
    displayName: 'Same Repo',
    setupState: 'ready',
    setupMethod: 'legacy-repo',
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  }
}

beforeEach(() => {
  reposRemove.mockReset()
  reposRemoveForHost.mockReset()
  reposUpdate.mockReset()
  reposReorder.mockReset()
  reposReorderForHost.mockReset()
  ptyKill.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  uiSet.mockReset()
  uiSet.mockResolvedValue(undefined)
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      repos: {
        remove: reposRemove,
        removeForHost: reposRemoveForHost,
        update: reposUpdate,
        reorder: reposReorder,
        reorderForHost: reposReorderForHost
      },
      pty: { kill: ptyKill },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall },
      ui: { set: uiSet }
    }
  })
})

describe('repo slice host identity routing', () => {
  it('updates a legacy local duplicate without overwriting an explicit remote sibling', async () => {
    const { executionHostId: _executionHostId, ...legacyLocalDuplicate } = localDuplicate
    reposUpdate.mockResolvedValue(undefined)
    const store = createTestStore()
    store.setState({ repos: [legacyLocalDuplicate as Repo, remoteDuplicate] })

    await store.getState().updateRepo('same-repo', { displayName: 'Local Renamed' })

    expect(store.getState().repos).toEqual([
      { ...legacyLocalDuplicate, displayName: 'Local Renamed' },
      remoteDuplicate
    ])
    expect(reposUpdate).toHaveBeenCalledWith({
      repoId: 'same-repo',
      updates: { displayName: 'Local Renamed' }
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'repo.update' })
    )
  })

  it('updateRepo with an explicit local hostId stays local even when a runtime is focused', async () => {
    // The self-pair case: a repo id exists on both local and a focused runtime.
    // An explicit local hostId must route to local IPC, not the runtime RPC.
    reposUpdate.mockResolvedValue(undefined)
    const store = createTestStore()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localDuplicate, remoteDuplicate]
    })

    await store
      .getState()
      .updateRepo('same-repo', { displayName: 'Local via host' }, { hostId: 'local' })

    expect(reposUpdate).toHaveBeenCalledWith({
      repoId: 'same-repo',
      hostId: 'local',
      updates: { displayName: 'Local via host' }
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'repo.update' })
    )
    expect(store.getState().repos).toEqual([
      { ...localDuplicate, displayName: 'Local via host' },
      remoteDuplicate
    ])
  })

  it('updateRepo preserves an explicit SSH host through local IPC', async () => {
    reposUpdate.mockResolvedValue(undefined)
    const store = createTestStore()
    store.setState({ repos: [localDuplicate, sshDuplicate] })

    await store
      .getState()
      .updateRepo('same-repo', { displayName: 'SSH Renamed' }, { hostId: 'ssh:server' })

    expect(reposUpdate).toHaveBeenCalledWith({
      repoId: 'same-repo',
      hostId: 'ssh:server',
      updates: { displayName: 'SSH Renamed' }
    })
    expect(store.getState().repos).toEqual([
      localDuplicate,
      { ...sshDuplicate, displayName: 'SSH Renamed' }
    ])
  })

  it('removes only the focused host row and worktrees for duplicate repo ids', async () => {
    const localWorktree = makeWorktree({
      id: 'same-repo::/local/wt',
      repoId: 'same-repo'
    })
    const remoteWorktree = makeWorktree({
      id: 'same-repo::/remote/wt',
      repoId: 'same-repo',
      hostId: 'runtime:env-1'
    })
    const store = createTestStore()
    store.setState({
      repos: [localDuplicate, remoteDuplicate],
      activeRepoId: 'same-repo',
      filterRepoIds: ['same-repo'],
      projects: [
        {
          id: 'repo:same-repo',
          displayName: 'Same Repo',
          badgeColor: '#000',
          sourceRepoIds: ['same-repo'],
          createdAt: 1,
          updatedAt: 1
        } satisfies Project
      ],
      projectHostSetups: [
        projectHostSetup({ id: 'local-setup', hostId: 'local' }),
        projectHostSetup({ id: 'remote-setup', hostId: 'runtime:env-1' })
      ],
      worktreesByRepo: { 'same-repo': [localWorktree, remoteWorktree] },
      tabsByWorktree: {
        [localWorktree.id]: [{ id: 'local-tab', worktreeId: localWorktree.id }] as never,
        [remoteWorktree.id]: [{ id: 'remote-tab', worktreeId: remoteWorktree.id }] as never
      },
      ptyIdsByTabId: {
        'local-tab': ['local-pty'],
        'remote-tab': ['remote-pty']
      },
      lastVisitedAtByWorktreeId: {
        [localWorktree.id]: 10,
        [remoteWorktree.id]: 20
      }
    })

    await store.getState().removeProject('same-repo')

    expect(store.getState().repos).toEqual([remoteDuplicate])
    // Current contract: bare-ID UI selections clear even though the sibling host row survives.
    expect(store.getState().activeRepoId).toBeNull()
    expect(store.getState().filterRepoIds).toEqual([])
    expect(store.getState().worktreesByRepo['same-repo']).toEqual([remoteWorktree])
    expect(store.getState().tabsByWorktree[localWorktree.id]).toBeUndefined()
    expect(store.getState().tabsByWorktree[remoteWorktree.id]).toEqual([
      { id: 'remote-tab', worktreeId: remoteWorktree.id }
    ])
    expect(store.getState().projectHostSetups).toEqual([
      expect.objectContaining({ hostId: 'runtime:env-1', repoId: 'same-repo' })
    ])
    expect(store.getState().lastVisitedAtByWorktreeId).toEqual({ [remoteWorktree.id]: 20 })
    expect(store.getState().projects).toEqual([
      expect.objectContaining({ id: 'repo:same-repo', sourceRepoIds: ['same-repo'] })
    ])
    // Why: the id also exists on runtime:env-1, so the local-side removal must be
    // host-scoped in main to avoid deleting the other host's persisted repo row.
    expect(reposRemoveForHost).toHaveBeenCalledWith({ repoId: 'same-repo', hostId: 'local' })

    expect(reposRemove).not.toHaveBeenCalled()
    expect(ptyKill).toHaveBeenCalledWith('local-pty')
    expect(ptyKill).not.toHaveBeenCalledWith('remote-pty')
  })
  it('purges hostless worktree state when two hosts collide on repoId and path', async () => {
    const sharedWorktreeId = 'same-repo::/shared'
    const localWorktree = makeWorktree({
      id: sharedWorktreeId,
      repoId: 'same-repo'
    })
    const remoteWorktree = makeWorktree({
      id: sharedWorktreeId,
      repoId: 'same-repo',
      hostId: 'runtime:env-1'
    })
    const store = createTestStore()
    store.setState({
      repos: [localDuplicate, remoteDuplicate],
      worktreesByRepo: { 'same-repo': [localWorktree, remoteWorktree] },
      tabsByWorktree: {
        [sharedWorktreeId]: [{ id: 'shared-tab', worktreeId: sharedWorktreeId }] as never
      },
      lastVisitedAtByWorktreeId: { [sharedWorktreeId]: 10 }
    })

    await store.getState().removeProject('same-repo', { hostId: 'local' })

    expect(store.getState().worktreesByRepo['same-repo']).toEqual([remoteWorktree])
    // Terminal/editor maps are keyed by hostless worktree ID and are purged, but the
    // host-scoped purge deliberately leaves the sibling's legacy bare recency key intact.
    expect(store.getState().tabsByWorktree[sharedWorktreeId]).toBeUndefined()
    expect(store.getState().lastVisitedAtByWorktreeId[sharedWorktreeId]).toBe(10)
  })

  it('allows two removals of the same owner row to overlap', async () => {
    const { promise: firstRemoval, resolve: resolveFirstRemoval } = Promise.withResolvers<void>()
    const { promise: secondRemoval, resolve: resolveSecondRemoval } = Promise.withResolvers<void>()
    reposRemove.mockReturnValueOnce(firstRemoval).mockReturnValueOnce(secondRemoval)
    const store = createTestStore()
    store.setState({ repos: [localDuplicate] })

    const first = store.getState().removeProject(localDuplicate.id)
    const second = store.getState().removeProject(localDuplicate.id)
    expect(reposRemove).toHaveBeenCalledTimes(2)

    resolveSecondRemoval()
    resolveFirstRemoval()
    await Promise.all([first, second])

    expect(store.getState().repos).toEqual([])
  })

  it('preserves qualified recency for an exact-id sibling host', async () => {
    const worktreeId = 'same-repo::/shared/wt'
    const localWorktree = makeWorktree({ id: worktreeId, repoId: 'same-repo' })
    const remoteWorktree = makeWorktree({
      id: worktreeId,
      repoId: 'same-repo',
      hostId: 'runtime:env-1'
    })
    const store = createTestStore()
    store.setState({
      repos: [localDuplicate, remoteDuplicate],
      worktreesByRepo: { 'same-repo': [localWorktree, remoteWorktree] },
      lastVisitedAtByWorktreeId: {
        [`local|${worktreeId}`]: 10,
        [`runtime:env-1|${worktreeId}`]: 20
      }
    })

    await store.getState().removeProject('same-repo', { hostId: 'local' })

    expect(store.getState().lastVisitedAtByWorktreeId).toEqual({
      [`runtime:env-1|${worktreeId}`]: 20
    })
  })

  it('removeProject of an SSH host row routes local even when a runtime is focused', async () => {
    // Regression: removing an SSH host's repo (explicit ssh hostId) must NOT route
    // repo.rm to the focused runtime env. settingsForRepoOwner clears the focused
    // runtime for SSH owners, so removal stays on the host-scoped local path.
    const sshDuplicate: Repo = {
      id: 'same-repo',
      path: '/home/orca/project',
      displayName: 'SSH',
      badgeColor: '#222',
      addedAt: 3,
      connectionId: 'ssh-1',
      executionHostId: 'ssh:ssh-1'
    }
    const sshWorktree = makeWorktree({
      id: 'same-repo::/home/orca/wt',
      repoId: 'same-repo',
      hostId: 'ssh:ssh-1'
    })
    const store = createTestStore()
    // A runtime env is focused, but the row being removed is SSH-owned.
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localDuplicate, sshDuplicate],
      worktreesByRepo: { 'same-repo': [sshWorktree] }
    })

    await store.getState().removeProject('same-repo', { hostId: 'ssh:ssh-1' })

    // Host-scoped local removal (id also exists on local), never the runtime RPC.
    expect(reposRemoveForHost).toHaveBeenCalledWith({ repoId: 'same-repo', hostId: 'ssh:ssh-1' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: 'repo.rm' })
    )
    expect(store.getState().repos).toEqual([localDuplicate])
  })

  it('persists local and direct SSH permutations through host-scoped IPC', async () => {
    reposReorderForHost.mockResolvedValue({ status: 'applied' })
    const alpha = { ...localDuplicate, id: 'alpha' }
    const bravo = { ...localDuplicate, id: 'bravo' }
    const charlie = {
      ...localDuplicate,
      id: 'charlie',
      path: '/ssh/charlie',
      connectionId: 'target',
      executionHostId: undefined
    }
    const delta = { ...charlie, id: 'delta', path: '/ssh/delta' }
    const store = createTestStore()
    store.setState({ repos: [alpha, charlie, bravo, delta] })

    await store.getState().reorderRepos(['bravo', 'delta', 'alpha', 'charlie'])

    expect(reposReorderForHost).toHaveBeenCalledTimes(2)
    expect(reposReorderForHost).toHaveBeenCalledWith({
      hostId: 'local',
      orderedIds: ['bravo', 'alpha']
    })
    expect(reposReorderForHost).toHaveBeenCalledWith({
      hostId: 'ssh:target',

      orderedIds: ['delta', 'charlie']
    })
    expect(reposReorder).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
  it('treats an occurrence-invalid reorder as a total no-op', async () => {
    const store = createTestStore()
    store.setState({ repos: [localDuplicate, remoteDuplicate] })

    await store.getState().reorderRepos(['same-repo'])

    expect(store.getState().repos).toEqual([localDuplicate, remoteDuplicate])
    expect(reposReorderForHost).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(uiSet).not.toHaveBeenCalled()
  })

  it('resyncs after a host rejects an optimistic reorder', async () => {
    reposReorderForHost.mockResolvedValue({ status: 'rejected' })
    const resync = vi.fn().mockResolvedValue(undefined)
    const alpha = { ...localDuplicate, id: 'alpha' }
    const bravo = { ...localDuplicate, id: 'bravo' }
    const store = createTestStore()
    store.setState({
      repos: [alpha, bravo],
      fetchReposForAllHosts: resync
    })

    await store.getState().reorderRepos(['bravo', 'alpha'])

    expect(store.getState().repos).toEqual([bravo, alpha])
    expect(resync).toHaveBeenCalledOnce()
  })

  it('resyncs after host persistence throws during an optimistic reorder', async () => {
    reposReorderForHost.mockRejectedValue(new Error('persist failed'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const resync = vi.fn().mockResolvedValue(undefined)
    const alpha = { ...localDuplicate, id: 'alpha' }
    const bravo = { ...localDuplicate, id: 'bravo' }
    const store = createTestStore()
    store.setState({
      repos: [alpha, bravo],
      fetchReposForAllHosts: resync
    })
    try {
      await store.getState().reorderRepos(['bravo', 'alpha'])
    } finally {
      errorSpy.mockRestore()
    }

    expect(store.getState().repos).toEqual([bravo, alpha])
    expect(resync).toHaveBeenCalledOnce()
  })
})
