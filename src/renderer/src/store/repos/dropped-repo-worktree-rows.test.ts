import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore, makeWorktree, seedStore } from '../slices/store-test-helpers'

const SERVER = toRuntimeExecutionHostId('env-1')

function serverRepo(id: string, path = '/srv/app'): Repo {
  return {
    id,
    path,
    displayName: 'app',
    badgeColor: '#737373',
    addedAt: 1,
    executionHostId: SERVER
  }
}

function serverRow(repoId: string, path = '/srv/app') {
  return makeWorktree({ id: `${repoId}::${path}`, repoId, path, hostId: SERVER })
}

let serverRepos: Repo[] = []
let repoListGate: Promise<void> | null = null
const call = vi.fn(async (args: RuntimeEnvironmentCallRequest) => {
  const compatible = createCompatibleRuntimeStatusResponseIfNeeded(args)
  if (compatible) {
    return compatible
  }
  if (args.method === 'repo.list') {
    const answer = structuredClone(serverRepos)
    await repoListGate
    return { id: 'rpc-repo.list', ok: true, result: { repos: answer }, _meta: {} }
  }
  return { id: `rpc-${args.method}`, ok: true, result: {}, _meta: { runtimeId: 'remote-runtime' } }
})

describe('a fetched catalog that drops a repo registration', () => {
  beforeEach(() => {
    clearRuntimeCompatibilityCacheForTests()
    call.mockClear()
    repoListGate = null
    vi.stubGlobal('window', {
      api: { runtimeEnvironments: { call, list: vi.fn().mockResolvedValue([]) } },
      dispatchEvent: vi.fn()
    })
  })

  it('keeps the rows of a repo added while the catalog was in flight', async () => {
    const store = createTestStore()
    seedStore(store, {
      repos: [serverRepo('kept')],
      worktreesByRepo: { kept: [serverRow('kept')] }
    })
    serverRepos = [serverRepo('kept')]
    const { promise, resolve } = Promise.withResolvers<void>()
    repoListGate = promise

    const fetching = store.getState().fetchRuntimeEnvironmentRepos('env-1')
    // The add lands after the request went out, so the answer cannot list it.
    store.setState((s) => ({
      repos: [...s.repos, serverRepo('added', '/srv/added')],
      worktreesByRepo: { ...s.worktreesByRepo, added: [serverRow('added', '/srv/added')] }
    }))
    resolve()
    await fetching

    expect(store.getState().worktreesByRepo.added?.map((worktree) => worktree.id)).toEqual([
      'added::/srv/added'
    ])
  })
})
