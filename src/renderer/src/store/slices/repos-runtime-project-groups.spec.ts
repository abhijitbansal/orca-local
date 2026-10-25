import { beforeEach, describe, vi } from 'vitest'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { stubRuntimeEnvironmentBridge } from '../../runtime/runtime-environment-bridge-fixture'

export function registerReposRuntimeProjectGroupTests(): void {
  const runtimeEnvironmentCall = vi.fn()
  const runtimeEnvironmentTransportCall = vi.fn()

  describe('repo slice runtime project groups', () => {
    beforeEach(() => {
      clearRuntimeCompatibilityCacheForTests()
      runtimeEnvironmentCall.mockReset()
      runtimeEnvironmentTransportCall.mockReset()
      runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
        return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
      })
      stubRuntimeEnvironmentBridge({ call: runtimeEnvironmentTransportCall })
    })
  })

  // The catalog these tests read is the one the focused host would have shown.
}
