import type { SecretAtRestProtection } from '../../shared/secret-at-rest-protection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ipcState = vi.hoisted(() => ({
  handleHandlers: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
      ipcState.handleHandlers.set(channel, handler)
    }
  }
}))

const saveMiniMaxSessionCookieMock = vi.hoisted(() => vi.fn())
const clearMiniMaxSessionCookieMock = vi.hoisted(() => vi.fn())
const hasMiniMaxSessionCookieMock = vi.hoisted(() => vi.fn(() => false))
const saveMiniMaxApiKeyMock = vi.hoisted(() => vi.fn())
const clearMiniMaxApiKeyMock = vi.hoisted(() => vi.fn())
const hasMiniMaxApiKeyMock = vi.hoisted(() => vi.fn(() => false))
const getCookieProtectionMock = vi.hoisted(() =>
  vi.fn((): SecretAtRestProtection | null => 'sealed')
)
const getApiKeyProtectionMock = vi.hoisted(() =>
  vi.fn((): SecretAtRestProtection | null => 'sealed')
)

vi.mock('../minimax/minimax-cookie-store', () => ({
  getMiniMaxSessionCookieProtection: getCookieProtectionMock,
  saveMiniMaxSessionCookie: saveMiniMaxSessionCookieMock,
  clearMiniMaxSessionCookie: clearMiniMaxSessionCookieMock,
  hasMiniMaxSessionCookie: hasMiniMaxSessionCookieMock
}))

vi.mock('../minimax/minimax-api-key-store', () => ({
  getMiniMaxApiKeyProtection: getApiKeyProtectionMock,
  saveMiniMaxApiKey: saveMiniMaxApiKeyMock,
  clearMiniMaxApiKey: clearMiniMaxApiKeyMock,
  hasMiniMaxApiKey: hasMiniMaxApiKeyMock
}))

import { registerMiniMaxCredentialsHandlers } from './minimax-credentials'
async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = ipcState.handleHandlers.get(channel)
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`)
  }
  return (await handler({}, ...args)) as T
}

describe('registerMiniMaxCredentialsHandlers', () => {
  beforeEach(() => {
    ipcState.handleHandlers.clear()
    saveMiniMaxSessionCookieMock.mockReset()
    clearMiniMaxSessionCookieMock.mockReset()
    hasMiniMaxSessionCookieMock.mockReset()
    hasMiniMaxSessionCookieMock.mockReturnValue(false)
    saveMiniMaxApiKeyMock.mockReset()
    clearMiniMaxApiKeyMock.mockReset()
    hasMiniMaxApiKeyMock.mockReset()
    hasMiniMaxApiKeyMock.mockReturnValue(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers all five MiniMax credential channels', () => {
    registerMiniMaxCredentialsHandlers()
    expect(ipcState.handleHandlers.has('minimaxCredentials:getStatus')).toBe(true)
    expect(ipcState.handleHandlers.has('minimaxCredentials:saveCookie')).toBe(true)
    expect(ipcState.handleHandlers.has('minimaxCredentials:clearCookie')).toBe(true)
    expect(ipcState.handleHandlers.has('minimaxCredentials:saveApiKey')).toBe(true)
    expect(ipcState.handleHandlers.has('minimaxCredentials:clearApiKey')).toBe(true)
  })

  it('returns the configured state on getStatus from the cookie store', async () => {
    hasMiniMaxSessionCookieMock.mockReturnValue(true)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:getStatus')
    expect(status).toEqual({
      configured: true,
      cookieConfigured: true,
      apiKeyConfigured: false,
      cookieProtection: 'sealed',
      // Null, not 'sealed': nothing is stored, so there is nothing to make a claim about.
      apiKeyProtection: null
    })
  })

  it('returns apiKeyConfigured true on getStatus when the API key store has a key', async () => {
    hasMiniMaxApiKeyMock.mockReturnValue(true)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:getStatus')
    expect(status).toEqual({
      configured: true,
      cookieConfigured: false,
      apiKeyConfigured: true,
      cookieProtection: null,
      apiKeyProtection: 'sealed'
    })
  })

  it('persists the cookie and reports configured after saveCookie', async () => {
    hasMiniMaxSessionCookieMock.mockReturnValueOnce(true)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:saveCookie', '_token=abc; minimax_group_id_v2=42')
    expect(saveMiniMaxSessionCookieMock).toHaveBeenCalledWith('_token=abc; minimax_group_id_v2=42')
    expect(status).toMatchObject({ configured: true, cookieConfigured: true })
  })

  it('clears the cookie and reports unconfigured on clearCookie', async () => {
    hasMiniMaxSessionCookieMock.mockReturnValueOnce(false)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:clearCookie')
    expect(clearMiniMaxSessionCookieMock).toHaveBeenCalledTimes(1)
    expect(status).toMatchObject({ configured: false, cookieConfigured: false })
  })

  it('persists the API key and reports apiKeyConfigured after saveApiKey', async () => {
    hasMiniMaxApiKeyMock.mockReturnValueOnce(true)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:saveApiKey', 'sk-test-1234567890')
    expect(saveMiniMaxApiKeyMock).toHaveBeenCalledWith('sk-test-1234567890')
    expect(status).toMatchObject({ configured: true, apiKeyConfigured: true })
  })

  it('rejects non-string API keys on saveApiKey', async () => {
    registerMiniMaxCredentialsHandlers()
    await expect(invoke('minimaxCredentials:saveApiKey', 12345)).rejects.toThrow(/must be a string/)
    expect(saveMiniMaxApiKeyMock).not.toHaveBeenCalled()
  })

  it('clears the API key and reports unconfigured on clearApiKey', async () => {
    hasMiniMaxApiKeyMock.mockReturnValueOnce(false)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:clearApiKey')
    expect(clearMiniMaxApiKeyMock).toHaveBeenCalledTimes(1)
    expect(status).toMatchObject({ configured: false, apiKeyConfigured: false })
  })

  it('reports configured true when either cookie or API key is set', async () => {
    hasMiniMaxSessionCookieMock.mockReturnValue(true)
    hasMiniMaxApiKeyMock.mockReturnValue(true)
    registerMiniMaxCredentialsHandlers()
    const status = await invoke<{
      configured: boolean
      cookieConfigured: boolean
      apiKeyConfigured: boolean
    }>('minimaxCredentials:getStatus')
    expect(status.configured).toBe(true)
    expect(status.cookieConfigured).toBe(true)
    expect(status.apiKeyConfigured).toBe(true)
  })

  it('reports a plaintext key through the status so Settings can warn about it', async () => {
    hasMiniMaxApiKeyMock.mockReturnValue(true)
    getApiKeyProtectionMock.mockReturnValue('plaintext')
    registerMiniMaxCredentialsHandlers()
    const status = await invoke('minimaxCredentials:getStatus')
    expect(status).toMatchObject({ apiKeyConfigured: true, apiKeyProtection: 'plaintext' })
  })
})
