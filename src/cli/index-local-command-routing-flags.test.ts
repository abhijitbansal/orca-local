import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { okFixture } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

/**
 * A runtime that answers `status.get` with the name it currently publishes: the stored override
 * when one is set, else the detected name. `settings.update` replies with the real `{ settings }`
 * envelope so a handler reading a bare `machineName` off it prints `undefined`.
 */
function fakeMachineNameRuntime(detectedName: string): { updates: unknown[] } {
  const updates: unknown[] = []
  let override = ''
  callMock.mockImplementation(async (method: string, params?: unknown) => {
    if (method === 'status.get') {
      return okFixture('req_status', {
        machineName: override || detectedName,
        hostPlatform: 'darwin'
      })
    }
    if (method === 'settings.update') {
      updates.push(params)
      const requested =
        typeof params === 'object' && params !== null && 'machineName' in params
          ? params.machineName
          : ''
      override = String(requested).trim()
      return okFixture('req_settings', { settings: { machineName: override } })
    }
    throw new Error(`unexpected call ${method}`)
  })
  return { updates }
}

describe('runtime-selector flags on locally pinned CLI commands', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    spawnMock
  })

  it('reads and updates the name the answering runtime publishes', async () => {
    const runtime = fakeMachineNameRuntime('m4airs-Air')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['host', 'name', '--json'], '/tmp/repo')
    await main(['host', 'name', '--name', ' build-server ', '--json'], '/tmp/repo')
    await main(['host', 'name', '--name', '', '--json'], '/tmp/repo')
    await main(['host', 'name'], '/tmp/repo')

    const [first, second, third] = logSpy.mock.calls
      .slice(0, 3)
      .map((call) => JSON.parse(String(call[0])))
    expect(first.result).toEqual({ machineName: 'm4airs-Air', platform: 'darwin' })
    // The write reply is `{ settings }`; the printed name must be what the runtime publishes now.
    expect(second.result).toEqual({ machineName: 'build-server', platform: 'darwin' })
    expect(second._meta.runtimeId).toBe('runtime-1')
    // A blank `--name` returns to the detected name — and prints it, not an empty string.
    expect(third.result.machineName).toBe('m4airs-Air')
    expect(logSpy.mock.calls[3]?.[0]).toBe('m4airs-Air (darwin)')
    expect(runtime.updates).toEqual([{ machineName: ' build-server ' }, { machineName: '' }])
  })

  it('refuses to rename a runtime that does not publish a machine name', async () => {
    // Why: an older runtime's strict settings schema answers the write with a bare `invalid_params`;
    // the field's absence from status is the tell, so the CLI refuses before writing anything.
    callMock.mockImplementation(async (method: string) => {
      if (method === 'status.get') {
        return okFixture('req_status', { hostPlatform: 'darwin' })
      }
      throw new Error(`unexpected call ${method}`)
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['host', 'name', '--name', 'build-server', '--json'], '/tmp/repo')

    const printed = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(printed.ok).toBe(false)
    expect(printed.error.code).toBe('incompatible_runtime')
    expect(printed.error.message).toMatch(/does not support machine names/)
    expect(callMock).not.toHaveBeenCalledWith('settings.update', expect.anything())
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
  })

  it('reports an unreachable runtime as an error instead of inventing a name', async () => {
    const { RuntimeClientError } = await import('./runtime/types.js')
    callMock.mockRejectedValue(new RuntimeClientError('runtime_unavailable', 'Orca is not running'))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['host', 'name', '--json'], '/tmp/repo')

    const printed = JSON.parse(String(logSpy.mock.calls[0]?.[0]))
    expect(printed.ok).toBe(false)
    expect(printed.error.code).toBe('runtime_unavailable')
    expect(process.exitCode).toBe(1)
    process.exitCode = 0
  })
})
