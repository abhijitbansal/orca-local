import { expect, it, vi } from 'vitest'
import {
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
  RUNTIME_PROTOCOL_VERSION
} from '../../../../shared/protocol-version'
import { createTestStore } from './store-test-helpers'

it('preserves focused support when runtime default hydration fails', async () => {
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: {
        call: vi.fn(({ method }: { method: string }) =>
          method === 'settings.get'
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({
                ok: true,
                result:
                  method === 'status.get'
                    ? {
                        runtimeId: 'runtime-1',
                        graphStatus: 'ready',
                        runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
                        minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
                      }
                    : { repos: [] },
                _meta: { runtimeId: 'runtime-1' }
              })
        )
      }
    }
  })
  const store = createTestStore()
  store.setState({
    settings: {
      activeRuntimeEnvironmentId: 'env-1',
      worktreeVisibilityDefaults: { external: 'show' }
    } as never,
    worktreeVisibilityDefaultsByHost: { 'runtime:env-1': { external: 'show' } },
    worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId: 'env-1',
    worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId: 'env-1'
  })

  await store.getState().fetchRuntimeEnvironmentRepos('env-1')

  expect(store.getState().worktreeVisibilityDefaultsByHost['runtime:env-1']).toEqual({
    external: 'show'
  })
  expect(store.getState().settings?.worktreeVisibilityDefaults).toEqual({ external: 'show' })
  expect(store.getState().worktreeVisibilityDefaultsSupportedRuntimeEnvironmentId).toBe('env-1')
  expect(store.getState().worktreeVisibilitySourceDefaultsSupportedRuntimeEnvironmentId).toBe(
    'env-1'
  )
})
