import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  callRuntimeRpc,
  getActiveRuntimeTarget,
  RuntimeRpcCallError,
  unwrapRuntimeRpcResult
} from './runtime-rpc-client'
import {
  ORCA_RUNTIME_RPC_BROWSER_UI_SOURCE,
  ORCA_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY
} from '../../../shared/runtime-rpc-feature-interaction-source'

const runtimeCall = vi.fn()
const runtimeEnvironmentCall = vi.fn()

beforeEach(() => {
  runtimeCall.mockReset()
  runtimeEnvironmentCall.mockReset()
  vi.stubGlobal('window', {
    api: {
      runtime: { call: runtimeCall },
      runtimeEnvironments: { call: runtimeEnvironmentCall }
    }
  })
})

describe('runtime RPC client routing', () => {
  it('uses the local runtime when no active environment is selected', () => {
    expect(getActiveRuntimeTarget(null)).toEqual({ kind: 'local' })
    expect(getActiveRuntimeTarget({ activeRuntimeEnvironmentId: null })).toEqual({ kind: 'local' })
    expect(getActiveRuntimeTarget({ activeRuntimeEnvironmentId: '   ' })).toEqual({ kind: 'local' })
  })

  it('getActiveRuntimeTarget ignores a persisted activeRuntimeEnvironmentId', () => {
    expect(getActiveRuntimeTarget({ activeRuntimeEnvironmentId: 'env-1' })).toEqual({
      kind: 'local'
    })
  })

  it('refuses an environment target without touching the preload bridge', async () => {
    await expect(
      callRuntimeRpc({ kind: 'environment', environmentId: 'env-1' }, 'status.get')
    ).rejects.toMatchObject({ code: 'unsupported_in_local_build' })
    expect(runtimeCall).not.toHaveBeenCalled()
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('routes local runtime calls through window.api.runtime.call', async () => {
    runtimeCall.mockResolvedValue({
      id: 'local',
      ok: true,
      result: [{ id: 'repo-1' }],
      _meta: { runtimeId: 'local-runtime' }
    })

    await expect(callRuntimeRpc({ kind: 'local' }, 'repo.list')).resolves.toEqual([
      { id: 'repo-1' }
    ])
    expect(runtimeCall).toHaveBeenCalledWith({ method: 'repo.list', params: undefined })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('marks local UI-owned runtime calls so feature interaction tracking can ignore them', async () => {
    runtimeCall.mockResolvedValue({
      id: 'local',
      ok: true,
      result: { ok: true },
      _meta: { runtimeId: 'local-runtime' }
    })

    await callRuntimeRpc(
      { kind: 'local' },
      'browser.viewport',
      { page: 'page-1' },
      { suppressFeatureInteraction: true }
    )

    expect(runtimeCall).toHaveBeenCalledWith({
      method: 'browser.viewport',
      params: {
        page: 'page-1',
        [ORCA_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY]: ORCA_RUNTIME_RPC_BROWSER_UI_SOURCE
      }
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('throws structured runtime RPC failures', () => {
    const failure = {
      id: 'rpc-1',
      ok: false as const,
      error: { code: 'method_not_found', message: 'Unknown method: nope' },
      _meta: { runtimeId: 'runtime-1' }
    }

    expect(() => unwrapRuntimeRpcResult(failure)).toThrow(RuntimeRpcCallError)
    try {
      unwrapRuntimeRpcResult(failure)
    } catch (error) {
      expect(error).toBeInstanceOf(RuntimeRpcCallError)
      expect((error as RuntimeRpcCallError).code).toBe('method_not_found')
      expect((error as RuntimeRpcCallError).response).toBe(failure)
    }
  })
})
