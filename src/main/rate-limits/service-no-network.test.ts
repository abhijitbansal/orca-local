import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { netFetchMock } = vi.hoisted(() => ({ netFetchMock: vi.fn() }))
vi.mock('electron', () => ({ net: { fetch: netFetchMock } }))

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

const LIVE_POST = {
  configDir: '/tmp/claude-a',
  fiveHour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 600 },
  sevenDay: null
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

  it('drops posts from the outgoing account once the target changes and the resolver has not answered', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => authPreparation('/tmp/claude-a'))
    await service.refreshClaudeForTarget(HOST_TARGET)
    // The next account's resolver never settles, so only the cleared snapshot can stop old posts.
    service.setClaudeAuthPreparationResolver(() => new Promise(() => {}))
    void service.refreshForClaudeAccountChange('old-account', HOST_TARGET)
    service.ingestLiveClaudeRateLimits({
      configDir: '/tmp/claude-a',
      fiveHour: { used_percentage: 40, resets_at: Math.floor(Date.now() / 1000) + 60 },
      sevenDay: null
    })
    expect(service.getState().claude).toBeNull()
  })

  it('clears the snapshot and the claude slot when the target changes', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => authPreparation('/tmp/claude-a'))
    await service.refreshClaudeForTarget(HOST_TARGET)
    service.ingestLiveClaudeRateLimits(LIVE_POST)
    expect(service.getState().claude?.status).toBe('ok')
    service.setClaudeAuthPreparationResolver(() => new Promise(() => {}))
    void service.refreshClaudeForTarget({ runtime: 'wsl', wslDistro: 'Ubuntu' })
    expect(service.getState().claude).toBeNull()
    service.ingestLiveClaudeRateLimits(LIVE_POST)
    expect(service.getState().claude).toBeNull()
  })

  it('keeps the snapshot and the claude slot on a same-target refresh', async () => {
    const service = new RateLimitService()
    service.setClaudeAuthPreparationResolver(async () => authPreparation('/tmp/claude-a'))
    await service.refreshClaudeForTarget(HOST_TARGET)
    service.ingestLiveClaudeRateLimits(LIVE_POST)
    service.setClaudeAuthPreparationResolver(() => new Promise(() => {}))
    void service.refreshClaudeForTarget(HOST_TARGET)
    expect(service.getState().claude?.status).toBe('ok')
    service.ingestLiveClaudeRateLimits({
      ...LIVE_POST,
      fiveHour: { ...LIVE_POST.fiveHour, used_percentage: 41 }
    })
    expect(service.getState().claude?.session?.usedPercent).toBe(41)
  })

  it('never reports vendor credentials as configured, so no provider shows a loading skeleton', () => {
    const state = new RateLimitService().getState()
    expect(state).toMatchObject({
      minimaxCookieConfigured: false,
      minimaxApiKeyConfigured: false,
      opencodeGoApiKeyConfigured: false,
      grokAuthConfigured: false,
      cursorAuthConfigured: false
    })
  })
})
