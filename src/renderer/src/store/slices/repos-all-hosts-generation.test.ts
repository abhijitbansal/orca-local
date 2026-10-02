import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { createTestStore } from './store-test-helpers'

const localRepo: Repo = {
  id: 'local-repo',
  path: '/local',
  displayName: 'Local',
  badgeColor: '#000',
  addedAt: 1
}

const runtimeEnvironmentCall = vi.fn()
const reposList = vi.fn()

beforeEach(() => {
  runtimeEnvironmentCall.mockReset()
  reposList.mockReset()
  reposList.mockResolvedValue([localRepo])
  vi.stubGlobal('window', {
    api: {
      repos: { list: reposList },
      projects: {
        list: vi.fn().mockResolvedValue([]),
        listHostSetups: vi.fn().mockResolvedValue([])
      },
      runtimeEnvironments: {
        list: vi.fn().mockResolvedValue([{ id: 'env-1', name: 'Remote' }]),
        call: (args: RuntimeEnvironmentCallRequest) =>
          createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
      }
    },
    dispatchEvent: vi.fn()
  })
})

describe('fetchReposForAllHosts generation', () => {
  it('invalidates folder path statuses when an all-host repo catalog changes', async () => {
    reposList.mockResolvedValueOnce([{ ...localRepo, path: '/local/changed' }])
    const store = createTestStore()
    store.setState({
      repos: [localRepo],
      folderWorkspacePathStatuses: {
        cached: {
          status: { path: '/local', exists: true },
          checkedAt: 1,
          requestSnapshot: 'before-change'
        }
      }
    })

    await store.getState().fetchReposForAllHosts({ remoteHosts: 'skip' })

    expect(store.getState().folderWorkspacePathStatuses).toEqual({})
  })
})
