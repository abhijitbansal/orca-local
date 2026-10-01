import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))
vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))
vi.mock('../minimax/minimax-cookie-store', () => ({ hasMiniMaxSessionCookie: () => false }))
vi.mock('../minimax/minimax-api-key-store', () => ({ hasMiniMaxApiKey: () => false }))
vi.mock('./grok-auth', () => ({ readGrokAuthSession: () => ({ status: 'missing' }) }))

import type { ClaudeRuntimeAuthPreparation } from '../claude-accounts/runtime-auth-service'
import { RateLimitService } from './service'

const HOST_TARGET = { runtime: 'host', wslDistro: null } as const

function authPreparation(configDir: string): ClaudeRuntimeAuthPreparation {
  return {
    configDir,
    provenance: 'managed',
    stripAuthEnv: false,
    envPatch: { CLAUDE_CONFIG_DIR: configDir }
  }
}

describe('RateLimitService (local-only)', () => {
  const globalFetch = vi.fn()
  beforeEach(() => {
    vi.stubGlobal('fetch', globalFetch)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    netFetchMock.mockReset()
    globalFetch.mockReset()
  })

  it('never opens a connection on target changes or account switches', async () => {
    const service = new RateLimitService()
    await service.refreshClaudeForTarget(HOST_TARGET)
    await service.refreshCodexForTarget(HOST_TARGET)
    await service.refreshForClaudeAccountChange('old-account', HOST_TARGET)
    await service.refreshForCodexAccountChange(null, HOST_TARGET)
    expect(netFetchMock).not.toHaveBeenCalled()
    expect(globalFetch).not.toHaveBeenCalled()
    expect(service.getState().claude).toBeNull()
    expect(service.getState().codex).toBeNull()
  })

  it('publishes live Claude statusline windows for the selected config dir', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => authPreparation('/tmp/claude-a'))
    const states: unknown[] = []
    service.onStateChange((state) => states.push(state))
    await service.refreshClaudeForTarget(HOST_TARGET)
    service.ingestLiveClaudeRateLimits({
      configDir: '/tmp/claude-a',
      fiveHour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 60 },
      sevenDay: null
    })
    const claude = service.getState().claude
    expect(claude?.status).toBe('ok')
    expect(claude?.usageMetadata?.source).toBe('live-session')
    expect(states.length).toBeGreaterThan(0)
    expect(netFetchMock).not.toHaveBeenCalled()
  })

  it('drops statusline posts from another config dir', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => authPreparation('/tmp/claude-a'))
    await service.refreshClaudeForTarget(HOST_TARGET)
    service.ingestLiveClaudeRateLimits({
      configDir: '/tmp/claude-b',
      fiveHour: { used_percentage: 10, resets_at: Math.floor(Date.now() / 1000) + 60 },
      sevenDay: null
    })
    expect(service.getState().claude).toBeNull()
  })
})
