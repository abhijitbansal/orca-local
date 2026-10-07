import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectHostSetup } from '../../../../shared/project-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { createTestStore } from './store-test-helpers'

const projectsCreateHostSetup = vi.fn()
const projectsUpdateHostSetup = vi.fn()
const projectsDeleteHostSetup = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

const project: Project = {
  id: 'project-1',
  displayName: 'Project',
  badgeColor: '#000',
  sourceRepoIds: ['local-repo'],
  createdAt: 1,
  updatedAt: 1
}

const runtimeSetup: ProjectHostSetup = {
  id: 'setup-gpu',
  projectId: project.id,
  hostId: 'runtime:env-1',
  repoId: '',
  path: '/srv/project',
  displayName: 'GPU VM',
  setupState: 'ready',
  setupMethod: 'provisioned',
  createdAt: 1,
  updatedAt: 1
}

beforeEach(() => {
  projectsCreateHostSetup.mockReset()
  projectsUpdateHostSetup.mockReset()
  projectsDeleteHostSetup.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      repos: {
        list: vi.fn()
      },
      projects: {
        createHostSetup: projectsCreateHostSetup,
        updateHostSetup: projectsUpdateHostSetup,
        deleteHostSetup: projectsDeleteHostSetup
      },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice project host setup lifecycle', () => {
  it('creates independent project host setup metadata through local IPC', async () => {
    const setup: ProjectHostSetup = {
      ...runtimeSetup,
      hostId: 'local',
      path: '',
      setupState: 'setting-up'
    }
    projectsCreateHostSetup.mockResolvedValue({ project, setup })
    const store = createTestStore()

    await expect(
      store.getState().createProjectHostSetup({
        projectId: project.id,
        hostId: 'local',
        setupId: setup.id,
        setupState: 'setting-up',
        setupMethod: 'provisioned'
      })
    ).resolves.toEqual({ project, setup })

    expect(store.getState().projects).toEqual([project])
    expect(store.getState().projectHostSetups).toEqual([setup])
    expect(projectsCreateHostSetup).toHaveBeenCalledWith({
      projectId: project.id,
      hostId: 'local',
      setupId: setup.id,
      setupState: 'setting-up',
      setupMethod: 'provisioned'
    })
  })

  it('routes duplicate setup IDs through the first row and replaces every collision', async () => {
    const localSetup: ProjectHostSetup = {
      ...runtimeSetup,
      hostId: 'local',
      displayName: 'Local setup'
    }
    const updatedLocalSetup = { ...localSetup, displayName: 'Local renamed', updatedAt: 2 }
    projectsUpdateHostSetup.mockResolvedValue({
      project,
      setup: updatedLocalSetup
    })
    const store = createTestStore()
    store.setState({
      projectHostSetups: [localSetup, runtimeSetup],
      settings: { activeRuntimeEnvironmentId: null } as never
    })

    await store.getState().updateProjectHostSetup({
      setupId: localSetup.id,
      updates: { displayName: 'Local renamed' }
    })

    expect(projectsUpdateHostSetup).toHaveBeenCalledWith({
      setupId: localSetup.id,
      updates: { displayName: 'Local renamed' }
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    // Current contract: setup mutations are keyed by bare setup ID after the first row selects routing.
    expect(store.getState().projectHostSetups).toEqual([updatedLocalSetup, updatedLocalSetup])
  })

  it('routes duplicate setup-ID deletion through the first row and removes every collision', async () => {
    const localSetup: ProjectHostSetup = {
      ...runtimeSetup,
      hostId: 'local',
      displayName: 'Local setup'
    }
    projectsDeleteHostSetup.mockResolvedValue({ project, setup: localSetup })
    const store = createTestStore()
    store.setState({
      projects: [project],
      projectHostSetups: [localSetup, runtimeSetup],
      settings: { activeRuntimeEnvironmentId: null } as never
    })

    await store.getState().deleteProjectHostSetup({ setupId: localSetup.id })

    expect(projectsDeleteHostSetup).toHaveBeenCalledWith({ setupId: localSetup.id })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    // Current contract: delete filters the full catalog by bare setup ID.
    expect(store.getState().projectHostSetups).toEqual([])
  })
})
