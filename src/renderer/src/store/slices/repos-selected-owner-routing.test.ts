import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { createTestStore } from './store-test-helpers'

const projectGroup: ProjectGroup = {
  id: 'group-runtime',
  name: 'Platform',
  parentPath: '/runtime/platform',
  parentGroupId: null,
  createdFrom: 'manual',
  tabOrder: 0,
  isCollapsed: false,
  color: null,
  createdAt: 1,
  updatedAt: 1
}

const reposList = vi.fn()
const projectGroupsList = vi.fn()
const projectGroupsImportNested = vi.fn()
const projectGroupsScanNested = vi.fn()
const projectGroupsCancelNestedScan = vi.fn()
const folderWorkspacesList = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      repos: { list: reposList },
      projectGroups: {
        list: projectGroupsList,
        importNested: projectGroupsImportNested,
        scanNested: projectGroupsScanNested,
        cancelNestedScan: projectGroupsCancelNestedScan,
        onNestedScanProgress: vi.fn(() => vi.fn())
      },
      folderWorkspaces: { list: folderWorkspacesList },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('selected Add Project owner routing', () => {
  it('prunes deleted desktop and direct-SSH catalog rows without erasing runtime siblings', async () => {
    const sshGroup = {
      ...projectGroup,
      id: 'ssh-group',
      connectionId: 'ssh-1',
      executionHostId: 'ssh:ssh-1'
    }
    const runtimeGroup = {
      ...projectGroup,
      id: sshGroup.id,
      executionHostId: 'runtime:env-1'
    }
    const sshFolder: FolderWorkspace = {
      id: 'ssh-folder',
      projectGroupId: sshGroup.id,
      name: 'SSH folder',
      folderPath: '/srv/folder',
      connectionId: 'ssh-1',
      linkedTask: null,
      comment: '',
      isArchived: false,
      isUnread: false,
      isPinned: false,
      sortOrder: 0,
      lastActivityAt: 0,
      createdAt: 1,
      updatedAt: 1
    }
    const runtimeFolder = {
      ...sshFolder,
      id: sshFolder.id,
      projectGroupId: runtimeGroup.id,
      connectionId: null,
      executionHostId: 'runtime:env-1' as const
    }
    projectGroupsList.mockResolvedValue([])
    folderWorkspacesList.mockResolvedValue([])
    const store = createTestStore()
    store.setState({
      projectGroups: [sshGroup, runtimeGroup],
      folderWorkspaces: [sshFolder, runtimeFolder]
    })

    await store.getState().fetchProjectGroups({ runtimeEnvironmentId: null })
    await store.getState().fetchFolderWorkspaces({ runtimeEnvironmentId: null })

    expect(store.getState().projectGroups).toEqual([runtimeGroup])
    expect(store.getState().folderWorkspaces).toEqual([runtimeFolder])
  })

  it('pins selected SSH scans and cancellation to local IPC over an ambient runtime', async () => {
    const scan = {
      selectedPath: '/srv/platform',
      selectedPathKind: 'git_repo' as const,
      repos: [],
      truncated: false,
      timedOut: false,
      stopped: false,
      durationMs: 1,
      maxDepth: 3,
      maxRepos: 100,
      timeoutMs: null
    }
    projectGroupsScanNested.mockResolvedValue(scan)
    projectGroupsCancelNestedScan.mockResolvedValue(true)
    const store = createTestStore()
    store.setState({ settings: { activeRuntimeEnvironmentId: 'env-ambient' } as never })

    await expect(
      store.getState().scanNestedRepos('/srv/platform', 'ssh-1', {
        scanId: 'scan-ssh',
        runtimeEnvironmentId: null
      })
    ).resolves.toEqual(scan)
    await expect(
      store.getState().cancelNestedRepoScan('scan-ssh', { runtimeEnvironmentId: null })
    ).resolves.toBe(true)

    expect(projectGroupsScanNested).toHaveBeenCalledWith({
      path: '/srv/platform',
      connectionId: 'ssh-1',
      scanId: 'scan-ssh'
    })
    expect(projectGroupsCancelNestedScan).toHaveBeenCalledWith({ scanId: 'scan-ssh' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
