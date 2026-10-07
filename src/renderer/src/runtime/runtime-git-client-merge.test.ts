import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'
import { abortRuntimeGitMerge, abortRuntimeGitRebase } from './runtime-git-client'

const gitAbortMerge = vi.fn()
const gitAbortRebase = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const runtimeCall = vi.fn()

beforeEach(() => {
  gitAbortMerge.mockReset()
  gitAbortRebase.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      git: { abortMerge: gitAbortMerge, abortRebase: gitAbortRebase },
      runtime: { call: runtimeCall },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('runtime git client merge operations', () => {
  it('uses local git IPC when no remote runtime is active', async () => {
    gitAbortMerge.mockResolvedValue(undefined)

    await abortRuntimeGitMerge({
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: 'wt-1',
      worktreePath: '/repo'
    })

    expect(gitAbortMerge).toHaveBeenCalledWith({ connectionId: undefined, worktreePath: '/repo' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('uses local git IPC when aborting a rebase without an active runtime', async () => {
    gitAbortRebase.mockResolvedValue(undefined)

    await abortRuntimeGitRebase({
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: 'wt-1',
      worktreePath: '/repo',
      connectionId: 'ssh-1'
    })

    expect(gitAbortRebase).toHaveBeenCalledWith({ connectionId: 'ssh-1', worktreePath: '/repo' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
