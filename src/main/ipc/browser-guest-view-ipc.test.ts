import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handleMock } = vi.hoisted(() => ({ handleMock: vi.fn() }))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock, removeHandler: vi.fn(), removeAllListeners: vi.fn() }
}))

vi.mock('../browser/browser-manager', () => ({ browserManager: {} }))
vi.mock('./browser-renderer-trust', () => ({ isTrustedBrowserRenderer: () => true }))

import { registerBrowserGuestViewHandlers } from './browser-guest-view-ipc'

describe('browser guest view IPC in the local-only build', () => {
  beforeEach(() => {
    handleMock.mockClear()
  })

  it('does not register the paired-runtime client page metadata channel', () => {
    registerBrowserGuestViewHandlers()
    const channels = handleMock.mock.calls.map(([channel]) => channel)
    expect(channels).not.toContain('browser:publishClientPageMetadata')
    expect(channels).toContain('browser:cancelDownload')
  })
})
