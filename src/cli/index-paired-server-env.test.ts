import { afterEach, describe, expect, it, vi } from 'vitest'

const { callMock, runtimeClientConstructorMock, serveOrcaAppMock, getDefaultUserDataPathMock } =
  vi.hoisted(() => ({
    callMock: vi.fn(),
    runtimeClientConstructorMock: vi.fn(),
    serveOrcaAppMock: vi.fn(),
    getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data')
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

import { main } from './index'

describe('paired-server environment variables in the local-only build', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    callMock.mockReset()
    runtimeClientConstructorMock.mockReset()
    process.exitCode = undefined
  })

  it.each(['ORCA_ENVIRONMENT', 'ORCA_PAIRING_CODE', 'ORCA_REMOTE_PAIRING'])(
    'fails closed on %s without sending any RPC',
    async (name) => {
      vi.stubEnv(name, 'env-1')
      const output: string[] = []
      vi.spyOn(console, 'log').mockImplementation((line) => output.push(String(line)))

      await main(['status', '--json'], '/tmp/not-a-worktree')

      expect(callMock).not.toHaveBeenCalled()
      expect(runtimeClientConstructorMock).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
      expect(output.join('\n')).toContain('remote runtimes are unsupported in this build')
    }
  )
})
