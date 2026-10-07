/**
 * A runtime-owned project cannot be removed in the local-only build: removal fails closed,
 * keeps the row, and never falls back to a local `repos.remove`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { createTestStore } from './store-test-helpers'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const staleRemoteRepo: Repo = {
  id: 'project-b',
  path: '/Users/mini/project-b',
  displayName: 'Project B',
  badgeColor: '#000',
  addedAt: 1,
  executionHostId: 'runtime:env-1'
}

const liveRemoteRepo: Repo = {
  id: 'project-a',
  path: '/Users/mini/project-a',
  displayName: 'Project A',
  badgeColor: '#111',
  addedAt: 2,
  executionHostId: 'runtime:env-1'
}

const localTwinRepo: Repo = {
  id: 'project-b',
  path: '/Users/laptop/project-b',
  displayName: 'Project B (local)',
  badgeColor: '#222',
  addedAt: 3
}

const reposRemove = vi.fn()
const reposRemoveForHost = vi.fn()
const ptyKill = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

function answerRepoRmWith(code: string): void {
  runtimeEnvironmentCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    if (args.method === 'repo.rm') {
      return {
        id: 'rpc-repo-rm',
        ok: false,
        error: { code, message: code },
        _meta: { runtimeId: 'runtime-remote' }
      }
    }
    return { id: 'rpc-other', ok: true, result: {}, _meta: { runtimeId: 'runtime-remote' } }
  })
}

function seedRemoteProjects(repos: readonly Repo[]): ReturnType<typeof createTestStore> {
  const store = createTestStore()
  store.setState({
    settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
    repos: [...repos]
  })
  return store
}

beforeEach(() => {
  vi.mocked(toast.error).mockReset()
  for (const mock of [
    reposRemove,
    reposRemoveForHost,
    ptyKill,
    runtimeEnvironmentCall,
    runtimeEnvironmentTransportCall
  ]) {
    mock.mockReset()
  }
  runtimeEnvironmentTransportCall.mockImplementation(
    (args: RuntimeEnvironmentCallRequest) =>
      createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  )
  vi.stubGlobal('window', {
    api: {
      repos: { remove: reposRemove, removeForHost: reposRemoveForHost },
      pty: { kill: ptyKill },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall },
      ui: { set: vi.fn().mockResolvedValue(undefined) }
    }
  })
})

describe('removeProject for a runtime-owned project in the local-only build', () => {
  it('fails closed and keeps the row instead of purging it locally', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    answerRepoRmWith('repo_not_found')
    const store = seedRemoteProjects([liveRemoteRepo, staleRemoteRepo])

    await store.getState().removeProject('project-b', { hostId: 'runtime:env-1' })

    expect(store.getState().repos.map((repo) => repo.id)).toEqual(['project-a', 'project-b'])
    expect(reposRemove).not.toHaveBeenCalled()
    expect(reposRemoveForHost).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('leaves a same-id project on another host untouched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = seedRemoteProjects([liveRemoteRepo, staleRemoteRepo, localTwinRepo])

    await store.getState().removeProject('project-b', { hostId: 'runtime:env-1' })

    expect(store.getState().repos.map((repo) => repo.path)).toEqual([
      '/Users/mini/project-a',
      '/Users/mini/project-b',
      '/Users/laptop/project-b'
    ])
    expect(reposRemove).not.toHaveBeenCalled()
    expect(reposRemoveForHost).not.toHaveBeenCalled()
  })
})
