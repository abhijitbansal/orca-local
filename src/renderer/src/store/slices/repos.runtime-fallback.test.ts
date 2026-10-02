import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestStore } from './store-test-helpers'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'

const toastError = vi.hoisted(() => vi.fn())
const toastInfo = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    info: toastInfo,
    success: toastSuccess
  }
}))

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  toastError.mockReset()
  toastInfo.mockReset()
  toastSuccess.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice runtime folder fallback', () => {
  it('adds a local non-git folder directly without runtime metadata or a worktree', async () => {
    // Local analogue of the runtime fallback above: with no active runtime the add
    // routes through window.api.repos.add (not runtime RPC). A non-git path returns
    // Orca's own "Not a valid git repository" sentinel, so addRepoPath surfaces the
    // confirmation modal with no runtime/SSH metadata instead of throwing.
    const folderRepo: Repo = {
      id: 'local-folder',
      path: '/local/non-git',
      displayName: 'non-git',
      badgeColor: '#000',
      addedAt: 1,
      kind: 'folder'
    }
    const reposAdd = vi.fn(
      (args: { path: string; kind: string }): { repo: Repo } | { error: string } =>
        args.kind === 'folder'
          ? { repo: folderRepo }
          : { error: 'Not a valid git repository: /local/non-git' }
    )
    vi.stubGlobal('window', {
      api: {
        repos: { add: reposAdd },
        runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
      }
    })
    const store = createTestStore()
    // fetchWorktrees is stubbed so the post-add activation chain (which needs
    // worktrees/onboarding APIs absent from this stub) stays out of scope.
    store.setState({ fetchWorktrees: vi.fn().mockResolvedValue(undefined) as never })

    await expect(store.getState().addRepoPath('/local/non-git', 'git')).resolves.toBeNull()

    expect(runtimeEnvironmentTransportCall).not.toHaveBeenCalled()
    expect(reposAdd).toHaveBeenNthCalledWith(1, {
      path: '/local/non-git',
      kind: 'git'
    })
    expect(store.getState().activeModal).toBe('confirm-non-git-folder')
    expect(store.getState().modalData).toEqual({ folderPath: '/local/non-git' })
    expect(store.getState().repos).toEqual([])

    // Completing the flow via "Open as Folder" adds a kind:'folder' project whose
    // workspace path IS the folder itself — proving no git worktree is created.
    const added = await store.getState().addNonGitFolder('/local/non-git')

    expect(reposAdd).toHaveBeenNthCalledWith(2, {
      path: '/local/non-git',
      kind: 'folder'
    })
    expect(added?.kind).toBe('folder')
    expect(added?.path).toBe('/local/non-git')
  })
})
