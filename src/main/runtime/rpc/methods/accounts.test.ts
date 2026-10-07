import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { OrcaRuntimeService } from '../../orca-runtime'
import { eraseRpcMethods, isStreamingMethod } from '../core'
import { ACCOUNT_METHODS } from './accounts'

function method(name: string) {
  const found = eraseRpcMethods(ACCOUNT_METHODS).find((candidate) => candidate.name === name)
  if (!found) {
    throw new Error(`Missing method ${name}`)
  }
  return found
}

describe('account RPC methods', () => {
  it.each([
    {
      methodName: 'accounts.addClaudeFromConfigDir',
      params: {
        configDir: join(tmpdir(), 'claude-login'),
        previousLegacyCredentialsSha256: 'a'.repeat(64)
      },
      runtimeMethod: 'addClaudeAccountFromConfigDir',
      expectedSource: join(tmpdir(), 'claude-login'),
      expectedOptions: {
        runtime: undefined,
        wslDistro: null,
        previousLegacyCredentialsSha256: 'a'.repeat(64)
      }
    },
    {
      methodName: 'accounts.addCodexFromHome',
      params: { sourceHome: join(tmpdir(), 'codex-login') },
      runtimeMethod: 'addCodexAccountFromHome',
      expectedSource: join(tmpdir(), 'codex-login'),
      expectedOptions: { runtime: undefined, wslDistro: null }
    }
  ])('allows local-socket $methodName calls', async (testCase) => {
    const add = vi.fn().mockResolvedValue({ accounts: [] })
    const runtime = { [testCase.runtimeMethod]: add } as unknown as OrcaRuntimeService
    const addMethod = method(testCase.methodName)
    if (isStreamingMethod(addMethod)) {
      throw new Error(`${testCase.methodName} must be a request method`)
    }

    await addMethod.handler(testCase.params, { runtime })

    expect(add).toHaveBeenCalledWith(testCase.expectedSource, testCase.expectedOptions)
  })

  it.each([
    ['accounts.addClaudeFromConfigDir', { configDir: join(tmpdir(), 'claude-login') }],
    ['accounts.addCodexFromHome', { sourceHome: join(tmpdir(), 'codex-login') }]
  ])('rejects paired-device calls to %s', async (methodName, params) => {
    const runtime = {
      addClaudeAccountFromConfigDir: vi.fn(),
      addCodexAccountFromHome: vi.fn()
    } as unknown as OrcaRuntimeService
    const addMethod = method(methodName)
    if (isStreamingMethod(addMethod)) {
      throw new Error(`${methodName} must be a request method`)
    }

    for (const clientKind of ['mobile', 'runtime'] as const) {
      await expect(addMethod.handler(params, { runtime, clientKind })).rejects.toThrow(
        /only available on the Orca host runtime/
      )
    }
    expect(runtime.addClaudeAccountFromConfigDir).not.toHaveBeenCalled()
    expect(runtime.addCodexAccountFromHome).not.toHaveBeenCalled()
  })

  it('returns the local snapshot from accounts.list regardless of refreshUsage', async () => {
    const snapshot = { claude: null, codex: null }
    const runtime = {
      getAccountsSnapshot: vi.fn(() => snapshot)
    } as unknown as OrcaRuntimeService
    const list = method('accounts.list')
    if (isStreamingMethod(list)) {
      throw new Error('accounts.list must be a request method')
    }

    await expect(list.handler(list.params?.parse({}), { runtime })).resolves.toBe(snapshot)
    await expect(
      list.handler(list.params?.parse({ refreshUsage: false }), { runtime })
    ).resolves.toBe(snapshot)
  })

  it('forwards the exact WSL target when selecting a Codex account', async () => {
    const selectCodexAccountForTarget = vi
      .fn()
      .mockResolvedValue({ accounts: [], activeAccountId: null })
    const runtime = { selectCodexAccountForTarget } as unknown as OrcaRuntimeService
    const select = method('accounts.selectCodexForTarget')
    if (isStreamingMethod(select)) {
      throw new Error('accounts.selectCodexForTarget must be a request method')
    }
    const params = {
      accountId: null,
      target: { runtime: 'wsl' as const, wslDistro: 'Ubuntu' }
    }

    expect(select.params?.parse(params)).toEqual(params)
    expect(
      select.params?.parse({
        accountId: null,
        target: { runtime: 'wsl', wslDistro: null }
      })
    ).toEqual({ accountId: null, target: { runtime: 'wsl', wslDistro: null } })
    expect(() =>
      select.params?.parse({
        accountId: null,
        target: { runtime: 'host', wslDistro: 'Ubuntu' }
      })
    ).toThrow()
    expect(() =>
      select.params?.parse({
        accountId: null,
        target: { runtime: 'wsl', wslDistro: '   ' }
      })
    ).toThrow()
    await expect(select.handler(params, { runtime })).resolves.toEqual({
      accounts: [],
      activeAccountId: null
    })
    expect(selectCodexAccountForTarget).toHaveBeenCalledWith(null, params.target)
  })

  it('emits the current snapshot when a subscription starts', async () => {
    const snapshot = { claude: null, codex: null }
    let cleanup: (() => void) | undefined
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub carries the three runtime members accounts.subscribe calls; the rest is unreached.
    const runtime = {
      getAccountsSnapshot: vi.fn(() => snapshot),
      onAccountsChanged: vi.fn(() => vi.fn()),
      registerSubscriptionCleanup: vi.fn((_id: string, nextCleanup: () => void) => {
        cleanup = nextCleanup
      })
    } as unknown as OrcaRuntimeService
    const subscribe = method('accounts.subscribe')
    if (!isStreamingMethod(subscribe)) {
      throw new Error('accounts.subscribe must be a streaming method')
    }
    const emit = vi.fn()

    const running = subscribe.handler(undefined, { runtime, connectionId: 'connection-1' }, emit)
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledWith(expect.objectContaining({ type: 'ready', snapshot }))
    })
    cleanup?.()
    await running
  })
})
