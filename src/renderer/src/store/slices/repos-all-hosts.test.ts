import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestStore } from './store-test-helpers'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Project, ProjectHostSetup } from '../../../../shared/project-types'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'

const localRepo: Repo = {
  id: 'local-repo',
  path: '/local',
  displayName: 'Local',
  badgeColor: '#000',
  addedAt: 1
}

const remoteRepo: Repo = {
  id: 'remote-repo',
  path: '/srv/repo',
  displayName: 'Remote',
  badgeColor: '#000',
  addedAt: 1
}

const localProject: Project = {
  id: 'local-project',
  displayName: 'Local project',
  badgeColor: '#000',
  sourceRepoIds: ['local-repo'],
  createdAt: 1,
  updatedAt: 1
}

const localProjectHostSetup: ProjectHostSetup = {
  id: 'local-setup',
  projectId: 'local-project',
  hostId: 'local',
  repoId: 'local-repo',
  path: '/local',
  displayName: 'Local setup',
  setupState: 'setting-up',
  setupMethod: 'imported-existing-folder',
  createdAt: 1,
  updatedAt: 1
}

const localProjectGroup: ProjectGroup = {
  id: 'local-group',
  name: 'Local group',
  parentPath: '/local',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const remoteProjectGroup: ProjectGroup = {
  id: 'remote-group',
  name: 'Remote group',
  parentPath: '/srv',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const localFolderWorkspace: FolderWorkspace = {
  id: 'local-folder',
  projectGroupId: 'local-group',
  name: 'Local folder',
  folderPath: '/local',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1
}

const remoteFolderWorkspace: FolderWorkspace = {
  id: 'remote-folder',
  projectGroupId: 'remote-group',
  name: 'Remote folder',
  folderPath: '/srv',
  linkedTask: null,
  comment: '',
  isArchived: false,
  isUnread: false,
  isPinned: false,
  sortOrder: 0,
  lastActivityAt: 1,
  createdAt: 1,
  updatedAt: 1
}

const reposList = vi.fn()
const projectsList = vi.fn()
const listHostSetups = vi.fn()
const projectGroupsList = vi.fn()
const folderWorkspacesList = vi.fn()
const runtimeEnvironmentsList = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const dispatchEventMock = vi.fn()

beforeEach(() => {
  reposList.mockReset()
  projectsList.mockReset()
  listHostSetups.mockReset()
  projectGroupsList.mockReset()
  folderWorkspacesList.mockReset()
  runtimeEnvironmentsList.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  dispatchEventMock.mockReset()

  reposList.mockResolvedValue([localRepo])
  projectsList.mockResolvedValue([localProject])
  listHostSetups.mockResolvedValue([localProjectHostSetup])
  projectGroupsList.mockResolvedValue([localProjectGroup])
  folderWorkspacesList.mockResolvedValue([localFolderWorkspace])
  runtimeEnvironmentsList.mockResolvedValue([{ id: 'env-1', name: 'lobster' }])
  runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    if (args.method === 'repo.list') {
      return {
        id: 'rpc-repo-list',
        ok: true,
        result: { repos: [remoteRepo] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    if (args.method === 'projectGroup.list') {
      return {
        id: 'rpc-project-group-list',
        ok: true,
        result: { groups: [remoteProjectGroup] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    if (args.method === 'folderWorkspace.list') {
      return {
        id: 'rpc-folder-workspace-list',
        ok: true,
        result: { folderWorkspaces: [remoteFolderWorkspace] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    return {
      id: 'rpc-other',
      ok: true,
      result: { projects: [], setups: [] },
      _meta: { runtimeId: 'runtime-remote' }
    }
  })
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })

  vi.stubGlobal('window', {
    api: {
      repos: { list: reposList },
      projects: { list: projectsList, listHostSetups: listHostSetups },
      projectGroups: { list: projectGroupsList },
      folderWorkspaces: { list: folderWorkspacesList },
      runtimeEnvironments: {
        call: runtimeEnvironmentTransportCall,
        list: runtimeEnvironmentsList
      }
    },
    dispatchEvent: dispatchEventMock
  })
})

function configureSharedProjectCompatibilityMocks(
  options: {
    localRepoHasProviderIdentity?: boolean
    remoteProjectRuntimePreference?: Project['localWindowsRuntimePreference']
  } = {}
): {
  sharedProjectId: string
  sharedRemoteProject: Project
} {
  const sharedProjectId = 'github:stablyai/orca'
  const localRepoForSharedProject: Repo =
    options.localRepoHasProviderIdentity === false
      ? localRepo
      : {
          ...localRepo,
          upstream: { owner: 'stablyai', repo: 'orca' }
        }
  const remoteRepoWithIdentity: Repo = {
    ...remoteRepo,
    upstream: { owner: 'stablyai', repo: 'orca' }
  }
  const sharedLocalProject: Project = {
    id: sharedProjectId,
    displayName: 'Orca',
    badgeColor: '#000',
    sourceRepoIds: ['local-repo'],
    localWindowsRuntimePreference: { kind: 'windows-host' },
    createdAt: 1,
    updatedAt: 1
  }
  const sharedRemoteProject: Project = {
    id: sharedProjectId,
    displayName: 'Orca',
    badgeColor: '#111',
    sourceRepoIds: ['remote-repo'],
    ...(options.remoteProjectRuntimePreference
      ? { localWindowsRuntimePreference: options.remoteProjectRuntimePreference }
      : {}),
    createdAt: 2,
    updatedAt: 2
  }
  const sharedLocalSetup: ProjectHostSetup = {
    ...localProjectHostSetup,
    projectId: sharedProjectId
  }
  const sharedRemoteSetup: ProjectHostSetup = {
    ...localProjectHostSetup,
    id: 'remote-setup',
    projectId: sharedProjectId,
    repoId: 'remote-repo',
    path: '/srv/repo',
    displayName: 'Remote setup'
  }
  reposList.mockResolvedValue([localRepoForSharedProject])
  projectsList.mockResolvedValue([sharedLocalProject])
  listHostSetups.mockResolvedValue([sharedLocalSetup])
  runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    if (args.method === 'repo.list') {
      return {
        id: 'rpc-repo-list',
        ok: true,
        result: { repos: [remoteRepoWithIdentity] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    if (args.method === 'project.list') {
      return {
        id: 'rpc-project-list',
        ok: true,
        result: { projects: [sharedRemoteProject] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    if (args.method === 'projectHostSetup.list') {
      return {
        id: 'rpc-project-host-setup-list',
        ok: true,
        result: { setups: [sharedRemoteSetup] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    return {
      id: 'rpc-other',
      ok: true,
      result: {},
      _meta: { runtimeId: 'runtime-remote' }
    }
  })
  return { sharedProjectId, sharedRemoteProject }
}

function directSshRepo(targetId: string): Repo {
  return {
    ...localRepo,
    id: 're-adopted-repo',
    connectionId: targetId,
    executionHostId: `ssh:${targetId}`
  }
}

const repoReadoption = {
  oldTargetId: 'ssh-old',
  newTargetId: 'ssh-new',
  repoIds: ['re-adopted-repo']
}

describe('fetchReposForAllHosts', () => {
  it('prunes a superseded direct SSH row during a local catalog transaction', async () => {
    const staleRepo = directSshRepo('ssh-old')
    const liveRepo = directSshRepo('ssh-new')
    reposList.mockResolvedValue([liveRepo])
    const store = createTestStore()
    store.setState({
      repos: [staleRepo],
      pendingSshRepoReadoptions: [repoReadoption]
    })

    await store.getState().fetchReposForAllHosts({ remoteHosts: 'skip' })

    expect(store.getState().repos).toEqual([liveRepo])
  })

  it('preserves an old direct SSH row when no re-adoption evidence exists', async () => {
    const staleRepo = directSshRepo('ssh-old')
    const liveRepo = directSshRepo('ssh-new')
    reposList.mockResolvedValue([liveRepo])
    const store = createTestStore()
    store.setState({ repos: [staleRepo] })

    await store.getState().fetchReposForAllHosts({ remoteHosts: 'skip' })

    expect(store.getState().repos).toEqual([staleRepo, liveRepo])
  })

  it('keeps local Windows runtime preference when remote project metadata has its own preference', async () => {
    const { sharedProjectId } = configureSharedProjectCompatibilityMocks({
      remoteProjectRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' }
    })
    const store = createTestStore()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-1' } as never })

    await store.getState().fetchReposForAllHosts()

    expect(
      store.getState().projects.find((project) => project.id === sharedProjectId)
        ?.localWindowsRuntimePreference
    ).toEqual({ kind: 'windows-host' })
  })

  it('keeps the local side of a shared project when a runtime refresh removes its repos', async () => {
    const { sharedProjectId } = configureSharedProjectCompatibilityMocks()
    const store = createTestStore()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-1' } as never })

    await store.getState().fetchReposForAllHosts()
    runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
      if (args.method === 'repo.list') {
        return {
          id: 'rpc-repo-list-empty',
          ok: true,
          result: { repos: [] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      if (args.method === 'project.list') {
        return {
          id: 'rpc-project-list-empty',
          ok: true,
          result: { projects: [] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      if (args.method === 'projectHostSetup.list') {
        return {
          id: 'rpc-project-host-setup-list-empty',
          ok: true,
          result: { setups: [] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      return {
        id: 'rpc-other',
        ok: true,
        result: {},
        _meta: { runtimeId: 'runtime-remote' }
      }
    })

    await store.getState().fetchRuntimeEnvironmentRepos('env-1')

    const sharedProject = store
      .getState()
      .projects.find((project) => project.id === sharedProjectId)
    expect(sharedProject?.sourceRepoIds).toEqual(['local-repo'])
    expect(sharedProject?.localWindowsRuntimePreference).toEqual({ kind: 'windows-host' })
    expect(store.getState().projectHostSetups).toEqual([
      expect.objectContaining({
        projectId: sharedProjectId,
        hostId: 'local',
        repoId: 'local-repo'
      })
    ])
  })

  it('drops stale runtime repo ownership when project metadata lags behind repo removal', async () => {
    const { sharedProjectId, sharedRemoteProject } = configureSharedProjectCompatibilityMocks()
    const store = createTestStore()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-1' } as never })

    await store.getState().fetchReposForAllHosts()
    runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
      if (args.method === 'repo.list') {
        return {
          id: 'rpc-repo-list-empty',
          ok: true,
          result: { repos: [] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      if (args.method === 'project.list') {
        return {
          id: 'rpc-project-list-stale',
          ok: true,
          result: { projects: [sharedRemoteProject] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      if (args.method === 'projectHostSetup.list') {
        return {
          id: 'rpc-project-host-setup-list-empty',
          ok: true,
          result: { setups: [] },
          _meta: { runtimeId: 'runtime-remote' }
        }
      }
      return {
        id: 'rpc-other',
        ok: true,
        result: {},
        _meta: { runtimeId: 'runtime-remote' }
      }
    })

    await store.getState().fetchRuntimeEnvironmentRepos('env-1')

    expect(
      store.getState().projects.find((project) => project.id === sharedProjectId)?.sourceRepoIds
    ).toEqual(['local-repo'])
  })

  it('fails soft when a runtime environment is unreachable, keeping local repos', async () => {
    runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
      if (args.method === 'repo.list') {
        throw new Error('runtime_unreachable')
      }
      return {
        id: 'rpc-other',
        ok: true,
        result: { projects: [], setups: [] },
        _meta: { runtimeId: 'runtime-remote' }
      }
    })
    const store = createTestStore()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-1' } as never })

    await store.getState().fetchReposForAllHosts()

    expect(store.getState().repos.map((repo) => repo.id)).toEqual(['local-repo'])
  })

  it('can load only the local catalog slice for first-paint startup', async () => {
    const store = createTestStore()

    await store.getState().fetchReposForAllHosts({ remoteHosts: 'skip' })
    await store.getState().fetchProjectGroupsForAllHosts({ remoteHosts: 'skip' })
    await store.getState().fetchFolderWorkspacesForAllHosts({ remoteHosts: 'skip' })

    expect(runtimeEnvironmentsList).not.toHaveBeenCalled()
    expect(runtimeEnvironmentTransportCall).not.toHaveBeenCalled()
    expect(store.getState().repos).toEqual([{ ...localRepo, executionHostId: 'local' }])
    expect(store.getState().projectGroups).toEqual([
      { ...localProjectGroup, executionHostId: 'local' }
    ])
    expect(store.getState().folderWorkspaces).toEqual([
      { ...localFolderWorkspace, executionHostId: 'local' }
    ])
  })
})
