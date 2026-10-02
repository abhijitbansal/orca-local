import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ClaudeRateLimitAccountsState,
  CodexRateLimitAccountsState
} from '../../../shared/managed-account-types'
import {
  fetchProviderAccountsSnapshot,
  selectClaudeProviderAccount,
  selectCodexProviderAccount,
  watchProviderAccounts,
  type ProviderAccountsSnapshot
} from './runtime-provider-accounts-client'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'

const LOCAL = { activeRuntimeEnvironmentId: null }

function emptyClaudeState(): ClaudeRateLimitAccountsState {
  return { accounts: [], activeAccountId: null, activeAccountIdsByRuntime: { host: null, wsl: {} } }
}

function emptyCodexState(): CodexRateLimitAccountsState {
  return { accounts: [], activeAccountId: null, activeAccountIdsByRuntime: { host: null, wsl: {} } }
}

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const runtimeEnvironmentSubscribe = vi.fn()
const claudeListLocal = vi.fn()
const codexListLocal = vi.fn()
const claudeSelectLocal = vi.fn()
const codexSelectLocal = vi.fn()
const claudeRemoveLocal = vi.fn()
const codexRemoveLocal = vi.fn()
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.restoreAllMocks()
  for (const mock of [
    runtimeEnvironmentCall,
    runtimeEnvironmentTransportCall,
    runtimeEnvironmentSubscribe,
    claudeListLocal,
    codexListLocal,
    claudeSelectLocal,
    codexSelectLocal,
    claudeRemoveLocal,
    codexRemoveLocal,
    unsubscribe
  ]) {
    mock.mockReset()
  }
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  runtimeEnvironmentSubscribe.mockImplementation(async () => ({
    unsubscribe,
    sendBinary: () => false
  }))
  vi.stubGlobal('window', {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    api: {
      runtimeEnvironments: {
        call: runtimeEnvironmentTransportCall,
        subscribe: runtimeEnvironmentSubscribe
      },
      claudeAccounts: {
        list: claudeListLocal,
        select: claudeSelectLocal,
        remove: claudeRemoveLocal
      },
      codexAccounts: {
        list: codexListLocal,
        select: codexSelectLocal,
        remove: codexRemoveLocal
      }
    }
  })
})

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('watchProviderAccounts', () => {
  it('reads local services once when no runtime environment is active', async () => {
    claudeListLocal.mockResolvedValue(emptyClaudeState())
    codexListLocal.mockResolvedValue(emptyCodexState())
    const snapshots: ProviderAccountsSnapshot[] = []

    watchProviderAccounts(LOCAL, {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: () => {
        throw new Error('unexpected error')
      }
    })
    await flushMicrotasks()

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.rateLimits).toBeNull()
    expect(claudeListLocal).toHaveBeenCalledTimes(1)
    expect(codexListLocal).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentSubscribe).not.toHaveBeenCalled()
  })

  it('does not deliver a late local snapshot after close', async () => {
    let resolveClaude: (state: ClaudeRateLimitAccountsState) => void = () => {}
    claudeListLocal.mockImplementation(
      () => new Promise<ClaudeRateLimitAccountsState>((resolve) => (resolveClaude = resolve))
    )
    codexListLocal.mockResolvedValue(emptyCodexState())
    const snapshots: ProviderAccountsSnapshot[] = []

    const watcher = watchProviderAccounts(LOCAL, {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: () => {}
    })
    watcher.close()
    resolveClaude(emptyClaudeState())
    await flushMicrotasks()

    expect(snapshots).toHaveLength(0)
  })

  it('keeps a healthy local provider snapshot when the other provider fails', async () => {
    const codexState = { ...emptyCodexState(), activeAccountId: 'codex-local' }
    claudeListLocal.mockRejectedValue(new Error('Claude keychain unavailable'))
    codexListLocal.mockResolvedValue(codexState)
    const snapshots: ProviderAccountsSnapshot[] = []
    const errors: unknown[] = []

    watchProviderAccounts(LOCAL, {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: (error) => errors.push(error)
    })
    await flushMicrotasks()

    expect(snapshots).toEqual([
      {
        claude: emptyClaudeState(),
        codex: codexState,
        rateLimits: null,
        failedProviders: ['claude']
      }
    ])
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe(
      'Could not load Claude accounts: Claude keychain unavailable'
    )
  })

  it('keeps a healthy Claude snapshot when only Codex fails', async () => {
    const claudeState = { ...emptyClaudeState(), activeAccountId: 'claude-local' }
    claudeListLocal.mockResolvedValue(claudeState)
    codexListLocal.mockRejectedValue(new Error('Codex home missing'))
    const snapshots: ProviderAccountsSnapshot[] = []
    const errors: unknown[] = []

    watchProviderAccounts(LOCAL, {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: (error) => errors.push(error)
    })
    await flushMicrotasks()

    expect(snapshots).toEqual([
      {
        claude: claudeState,
        codex: emptyCodexState(),
        rateLimits: null,
        failedProviders: ['codex']
      }
    ])
    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('Could not load Codex accounts: Codex home missing')
  })

  it('aggregates errors without a snapshot when both local providers fail', async () => {
    claudeListLocal.mockRejectedValue(new Error('Claude keychain unavailable'))
    codexListLocal.mockRejectedValue(new Error('Codex home missing'))
    const snapshots: ProviderAccountsSnapshot[] = []
    const errors: unknown[] = []

    watchProviderAccounts(LOCAL, {
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: (error) => errors.push(error)
    })
    await flushMicrotasks()

    expect(snapshots).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(AggregateError)
    expect((errors[0] as AggregateError).message).toContain('Could not load Claude accounts')
    expect((errors[0] as AggregateError).message).toContain('Could not load Codex accounts')
    expect((errors[0] as AggregateError).errors).toHaveLength(2)
  })
})

describe('fetchProviderAccountsSnapshot', () => {
  it('deduplicates concurrent local reads but does not cache completed snapshots', async () => {
    let resolveClaude!: (state: ClaudeRateLimitAccountsState) => void
    let resolveCodex!: (state: CodexRateLimitAccountsState) => void
    claudeListLocal.mockImplementation(
      () => new Promise<ClaudeRateLimitAccountsState>((resolve) => (resolveClaude = resolve))
    )
    codexListLocal.mockImplementation(
      () => new Promise<CodexRateLimitAccountsState>((resolve) => (resolveCodex = resolve))
    )

    const first = fetchProviderAccountsSnapshot(LOCAL)
    const second = fetchProviderAccountsSnapshot(LOCAL)

    expect(second).toBe(first)
    expect(claudeListLocal).toHaveBeenCalledTimes(1)
    expect(codexListLocal).toHaveBeenCalledTimes(1)

    resolveClaude(emptyClaudeState())
    resolveCodex(emptyCodexState())
    await Promise.all([first, second])

    claudeListLocal.mockResolvedValue(emptyClaudeState())
    codexListLocal.mockResolvedValue(emptyCodexState())
    await fetchProviderAccountsSnapshot(LOCAL)
    expect(claudeListLocal).toHaveBeenCalledTimes(2)
    expect(codexListLocal).toHaveBeenCalledTimes(2)
  })
})

describe('provider account mutations', () => {
  it('routes select through local IPC with the full runtime target when local', async () => {
    codexSelectLocal.mockResolvedValue(emptyCodexState())
    claudeSelectLocal.mockResolvedValue(emptyClaudeState())

    await selectCodexProviderAccount(LOCAL, {
      accountId: 'acc-1',
      runtime: 'wsl',
      wslDistro: 'Ubuntu'
    })
    await selectClaudeProviderAccount(LOCAL, { accountId: null, runtime: 'host', wslDistro: null })

    expect(codexSelectLocal).toHaveBeenCalledWith({
      accountId: 'acc-1',
      runtime: 'wsl',
      wslDistro: 'Ubuntu'
    })
    expect(claudeSelectLocal).toHaveBeenCalledWith({
      accountId: null,
      runtime: 'host',
      wslDistro: null
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
