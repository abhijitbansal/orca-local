import { describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('electron', () => ({
  ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn(), sendSync: vi.fn() }
}))
vi.mock('../preload-runtime-support', () => ({
  awaitBeforeUnloadCheckpoint: vi.fn(),
  startupDiagnosticsEnabled: false
}))
vi.mock('../renderer-restart-wiring', () => ({ prepareAndInvokeAppRestart: vi.fn() }))

describe('appApi.getVersion', () => {
  it('reads the app version over the app:getVersion channel', async () => {
    invoke.mockResolvedValueOnce('1.2.3')
    const { appApi } = await import('./app-bridge')
    await expect(appApi.getVersion()).resolves.toBe('1.2.3')
    expect(invoke).toHaveBeenCalledWith('app:getVersion')
  })
})
