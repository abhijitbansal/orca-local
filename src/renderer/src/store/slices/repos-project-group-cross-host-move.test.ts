/**
 * #13699: a project can only join a group in its own host's catalog. The host stores any other
 * group id as "no group" and still returns the row, so the move used to look successful.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import type { ProjectGroup } from '../../../../shared/project-group-types'
import type { Repo } from '../../../../shared/repo-types'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const REMOTE_HOST: ExecutionHostId = 'runtime:env-b'

const remoteRepo: Repo = {
  id: 'remote-only',
  path: '/srv/remote-only',
  displayName: 'remote-only',
  badgeColor: '#111',
  addedAt: 1,
  executionHostId: REMOTE_HOST,
  projectGroupId: 'remote-group'
}

function group(id: string, executionHostId: ExecutionHostId): ProjectGroup {
  return {
    id,
    name: id,
    parentPath: null,
    executionHostId,
    parentGroupId: null,
    createdFrom: 'manual',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: 1,
    updatedAt: 1
  }
}

const moveProject = vi.fn()
const runtimeCall = vi.fn<(request: RuntimeEnvironmentCallRequest) => Promise<unknown>>()

function moveCalls(): RuntimeEnvironmentCallRequest[] {
  return runtimeCall.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === 'projectGroup.moveProject')
}

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  vi.mocked(toast.error).mockReset()
  moveProject.mockReset()
  runtimeCall.mockReset()
  vi.stubGlobal('window', {
    api: {
      projectGroups: { moveProject },
      runtimeEnvironments: {
        call: (request: RuntimeEnvironmentCallRequest) =>
          createCompatibleRuntimeStatusResponseIfNeeded(request) ?? runtimeCall(request)
      }
    }
  })
})

function storeWith(projectGroups: ProjectGroup[]) {
  const store = createTestStore()
  store.setState({ repos: [remoteRepo], projectGroups })
  return store
}

describe('moving a project into a group on another host', () => {
  it('refuses with a toast instead of sending a move that would ungroup the project', async () => {
    const store = storeWith([group('local-group', 'local'), group('remote-group', REMOTE_HOST)])

    await expect(store.getState().moveProjectToGroup(remoteRepo, 'local-group', 0)).resolves.toBe(
      false
    )

    expect(moveCalls()).toEqual([])
    expect(moveProject).not.toHaveBeenCalled()
    expect(store.getState().repos).toEqual([remoteRepo])
    expect(toast.error).toHaveBeenCalledTimes(1)
  })
})

describe('moving one twin of a repo id shared by a local and an SSH row', () => {})

describe('moving one twin of a repo id on a paired server (server-local and server-SSH rows)', () => {})
