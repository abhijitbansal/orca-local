import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { createTestStore } from './store-test-helpers'

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

beforeEach(() => {})

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
    settings: { ...getDefaultSettings('/test'), activeRuntimeEnvironmentId: runtimeEnvironmentId },
    projectGroups: [otherHostGroup]
  })
  const ownerHostId = runtimeEnvironmentId ? `runtime:${runtimeEnvironmentId}` : 'local'
  return { store, created, createStarted, ownerHostId }
}

describe.each([null, 'env-1'])('project group creation on host %s', (runtimeEnvironmentId) => {
  it('does not roll back a successful refresh if the create response fails', async () => {
    const { store, created, createStarted } = setup(runtimeEnvironmentId)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const pendingCreate = store.getState().createProjectGroup('Platform')
    await createStarted.promise
    await store.getState().fetchProjectGroups()
    const refreshedState = store.getState()
    created.reject(new Error('Create response lost'))
    await expect(pendingCreate).resolves.toBeNull()
    expect(store.getState()).toBe(refreshedState)
  })
})

it('recognizes an unstamped local group without conflating an SSH catalog row', async () => {
  const { store, created } = setup(null)
  const sshGroup = { ...projectGroup, connectionId: 'server' }
  store.setState({ projectGroups: [sshGroup, refreshedGroup] })
  const state = store.getState()
  const pendingCreate = state.createProjectGroup('Platform')
  created.resolve(projectGroup)
  await pendingCreate
  expect(store.getState()).toBe(state)
})

it('does not suppress a local group whose ID matches a direct SSH group', async () => {
  const { store, created } = setup(null)
  const sshGroup = { ...projectGroup, connectionId: 'server' }
  store.setState({ projectGroups: [sshGroup] })
  const pendingCreate = store.getState().createProjectGroup('Platform')
  created.resolve(projectGroup)
  await pendingCreate
  expect(store.getState().projectGroups).toEqual([
    sshGroup,
    { ...projectGroup, executionHostId: 'local' }
  ])
})
