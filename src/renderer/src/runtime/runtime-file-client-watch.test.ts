import { describe, expect, it, vi } from 'vitest'
import { subscribeRuntimeFileChanges } from './runtime-file-client'
import {
  fsOnChanged,
  runtimeEnvironmentSubscribe,
  installRuntimeFileClientEnvironment
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

describe('runtime file client', () => {
  it('uses the local fs changed stream when no runtime environment is active', async () => {
    const unsubscribe = vi.fn()
    const onPayload = vi.fn()
    fsOnChanged.mockReturnValue(unsubscribe)

    await expect(
      subscribeRuntimeFileChanges(
        {
          settings: { activeRuntimeEnvironmentId: null },
          worktreeId: 'wt-1',
          worktreePath: '/repo'
        },
        onPayload
      )
    ).resolves.toBe(unsubscribe)

    expect(fsOnChanged).toHaveBeenCalledWith(onPayload)
    expect(runtimeEnvironmentSubscribe).not.toHaveBeenCalled()
  })
})
