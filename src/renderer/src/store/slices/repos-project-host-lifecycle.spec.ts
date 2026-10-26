import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, ProjectHostSetup } from '../../../../shared/project-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

export function registerReposProjectHostLifecycleTests(): void {
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
    clearRuntimeCompatibilityCacheForTests()
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

    it('a setup id shared with another route updates only its own row', async () => {
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
        hostId: 'local',
        updates: { displayName: 'Local renamed' }
      })
      expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
      expect(store.getState().projectHostSetups).toEqual([updatedLocalSetup, runtimeSetup])
    })

    it('a setup id shared with another route removes only its own row', async () => {
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

      expect(projectsDeleteHostSetup).toHaveBeenCalledWith({
        setupId: localSetup.id,
        hostId: 'local'
      })
      expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
      expect(store.getState().projectHostSetups).toEqual([runtimeSetup])
    })

    it('refuses a named host the catalog has no setup for instead of deleting by id', async () => {
      const localSetup: ProjectHostSetup = { ...runtimeSetup, hostId: 'local' }
      const store = createTestStore()
      store.setState({
        projects: [project],
        projectHostSetups: [localSetup],
        settings: { activeRuntimeEnvironmentId: null } as never
      })

      await expect(
        store.getState().deleteProjectHostSetup({ setupId: localSetup.id, hostId: 'ssh:gone' })
      ).resolves.toBeNull()

      expect(projectsDeleteHostSetup).not.toHaveBeenCalled()
      expect(store.getState().projectHostSetups).toEqual([localSetup])
    })

    it('names the SSH twin of a local setup on this computer', async () => {
      const localSetup: ProjectHostSetup = { ...runtimeSetup, hostId: 'local' }
      const sshSetup: ProjectHostSetup = { ...runtimeSetup, hostId: 'ssh:box' }
      projectsDeleteHostSetup.mockResolvedValue({ project, setup: sshSetup })
      const store = createTestStore()
      store.setState({
        projects: [project],
        projectHostSetups: [localSetup, sshSetup],
        settings: { activeRuntimeEnvironmentId: null } as never
      })

      await store.getState().deleteProjectHostSetup({ setupId: sshSetup.id, hostId: 'ssh:box' })

      expect(projectsDeleteHostSetup).toHaveBeenCalledWith({
        setupId: sshSetup.id,
        hostId: 'ssh:box'
      })
      expect(store.getState().projectHostSetups).toEqual([localSetup])
    })
  })

  // The catalog these tests read is the one the focused host would have shown.
}
