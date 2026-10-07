import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleMock,
  removeHandlerMock,
  createProfileMock,
  detectBrowsersMock,
  setBrowserIdentityModeMock
} = vi.hoisted(() => ({
  handleMock: vi.fn(),
  removeHandlerMock: vi.fn(),
  createProfileMock: vi.fn(),
  detectBrowsersMock: vi.fn(() => []),
  setBrowserIdentityModeMock: vi.fn(async () => ({ ok: true }))
}))

vi.mock('../browser/browser-identity-mode-store', () => ({
  setBrowserIdentityMode: setBrowserIdentityModeMock,
  getBrowserIdentityModeStatus: vi.fn(() => ({ identity: {}, migrationNotice: null }))
}))

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: handleMock, removeHandler: removeHandlerMock },
  webContents: { fromId: vi.fn() }
}))

vi.mock('../browser/browser-manager', () => ({
  browserCertificateTrustController: { proceed: vi.fn() },
  browserManager: {
    getWebContentsIdByTabId: vi.fn(() => new Map())
  }
}))

vi.mock('../browser/browser-session-registry', () => ({
  browserSessionRegistry: {
    createProfile: createProfileMock
  }
}))

vi.mock('../browser/browser-cookie-import', () => ({
  detectInstalledBrowsers: detectBrowsersMock,
  importCookiesFromBrowser: vi.fn(),
  importCookiesFromFile: vi.fn(),
  pickCookieFile: vi.fn(),
  selectBrowserProfile: vi.fn()
}))

import { registerBrowserHandlers } from './browser'
import { setTrustedBrowserRendererWebContentsId } from './browser-renderer-trust'

describe('browser session profile IPC', () => {
  beforeEach(() => {
    handleMock.mockReset()
    removeHandlerMock.mockReset()
    createProfileMock.mockReset()
    detectBrowsersMock.mockReset()
    detectBrowsersMock.mockReturnValue([])
    setBrowserIdentityModeMock.mockReset()
    setBrowserIdentityModeMock.mockResolvedValue({ ok: true })
    setTrustedBrowserRendererWebContentsId(null)
  })

  function trustedSender(): Electron.WebContents {
    return {
      id: 91,
      isDestroyed: () => false,
      getType: () => 'window',
      getURL: () => 'file:///renderer/index.html'
    } as Electron.WebContents
  }

  function identitySetHandler(): (
    event: { sender: Electron.WebContents },
    mode: unknown
  ) => Promise<unknown> {
    registerBrowserHandlers()
    return handleMock.mock.calls.find(([channel]) => channel === 'browser:identity:set')?.[1]
  }

  // Why reject rather than coerce: the RPC door validates mode against z.enum(['clean','native'])
  // and rejects. Coercing an unrecognized value to 'clean' here made one concept answer an unknown
  // value two different ways, and reported success for a mode that was quietly replaced.
  it('refuses an unrecognized identity mode instead of silently selecting Cleaned', async () => {
    setTrustedBrowserRendererWebContentsId(91)
    const handler = identitySetHandler()

    await expect(handler({ sender: trustedSender() }, 'rotating')).rejects.toThrow(/rotating/)
    expect(setBrowserIdentityModeMock).not.toHaveBeenCalled()
  })

  it('commits a recognized identity mode unchanged', async () => {
    setTrustedBrowserRendererWebContentsId(91)
    const handler = identitySetHandler()

    await expect(handler({ sender: trustedSender() }, 'native')).resolves.toEqual({ ok: true })
    expect(setBrowserIdentityModeMock).toHaveBeenCalledWith('native')
  })

  it('creates a profile for a trusted renderer', async () => {
    const profile = {
      id: 'profile-google',
      scope: 'isolated',
      partition: 'persist:orca-browser-session-profile-google',
      label: 'Google',
      source: null
    }
    createProfileMock.mockReturnValue(profile)
    registerBrowserHandlers()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registered test handler is selected by its exact channel and called with its declared boundary shape.
    const createHandler = handleMock.mock.calls.find(
      ([channel]) => channel === 'browser:session:createProfile'
    )?.[1] as (
      event: { sender: Electron.WebContents },
      args: { scope: 'isolated'; label: string }
    ) => unknown
    const sender = {
      id: 91,
      isDestroyed: () => false,
      getType: () => 'window',
      getURL: () => 'file:///renderer/index.html'
    } as Electron.WebContents

    await expect(
      createHandler({ sender }, { scope: 'isolated', label: 'Google' })
    ).resolves.toEqual(profile)
    expect(createProfileMock).toHaveBeenCalledWith('isolated', 'Google')
  })
})
