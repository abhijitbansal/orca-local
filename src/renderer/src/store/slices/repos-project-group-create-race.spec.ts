import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { createTestStore } from './store-test-helpers'

export function registerReposProjectGroupCreateRaceTests(): void {
  const projectGroup: ProjectGroup = {
    id: 'group-1',
    name: 'Platform',
    parentPath: null,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
  const refreshedGroup = { ...projectGroup, name: 'Renamed after creation', updatedAt: 2 }
  const otherHostGroup = { ...projectGroup, executionHostId: 'runtime:other' }

  beforeEach(() => {
    clearRuntimeCompatibilityCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function setup(runtimeEnvironmentId: string | null) {
    const created = Promise.withResolvers<ProjectGroup>()
    const createStarted = Promise.withResolvers<void>()
    const create = vi.fn(() => {
      createStarted.resolve()
      return created.promise
    })
    const list = vi.fn(async () => [refreshedGroup])
    vi.stubGlobal('window', {
      api: {
        projectGroups: { create, list },
        runtimeEnvironments: {
          call: async (request: RuntimeEnvironmentCallRequest) => {
            const compatibility = createCompatibleRuntimeStatusResponseIfNeeded(request)
            if (compatibility) {
              return compatibility
            }
            expect(request).toMatchObject({ selector: runtimeEnvironmentId })
            switch (request.method) {
              case 'projectGroup.create':
                return { id: 'create', ok: true, result: { group: await create() } }
              case 'projectGroup.list':
                return { id: 'list', ok: true, result: { groups: await list() } }
              default:
                throw new Error(`Unexpected RPC: ${request.method}`)
            }
          }
        }
      }
    })
    const store = createTestStore()
    store.setState({
      settings: {
        ...getDefaultSettings('/test'),
        activeRuntimeEnvironmentId: runtimeEnvironmentId
      },
      projectGroups: [otherHostGroup]
    })
    const ownerHostId: ExecutionHostId = runtimeEnvironmentId
      ? `runtime:${runtimeEnvironmentId}`
      : 'local'
    return { store, created, createStarted, ownerHostId }
  }

  it('recognizes an unstamped local group without conflating an SSH catalog row', async () => {
    const { store, created, ownerHostId } = setup(null)
    const sshGroup = { ...projectGroup, connectionId: 'server' }
    store.setState({ projectGroups: [sshGroup, refreshedGroup] })
    const state = store.getState()
    const pendingCreate = state.createProjectGroup('Platform', ownerHostId)
    created.resolve(projectGroup)
    await pendingCreate
    expect(store.getState()).toBe(state)
  })

  it('does not suppress a local group whose ID matches a direct SSH group', async () => {
    const { store, created, ownerHostId } = setup(null)
    const sshGroup = { ...projectGroup, connectionId: 'server' }
    store.setState({ projectGroups: [sshGroup] })
    const pendingCreate = store.getState().createProjectGroup('Platform', ownerHostId)
    created.resolve(projectGroup)
    await pendingCreate
    expect(store.getState().projectGroups).toEqual([
      sshGroup,
      { ...projectGroup, executionHostId: 'local' }
    ])
  })

  // The catalog these tests read is the one the focused host would have shown.
}
