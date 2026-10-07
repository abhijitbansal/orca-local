import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { PreloadApi } from './api-types'

const { exposeInMainWorld, invoke, on, removeListener, send, sendSync } = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  send: vi.fn(),
  sendSync: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld },
  ipcRenderer: { invoke, on, removeListener, send, sendSync },
  webFrame: {
    getZoomFactor: vi.fn(() => 1),
    setZoomFactor: vi.fn(),
    setVisualZoomLevelLimits: vi.fn()
  },
  webUtils: { getPathForFile: vi.fn(() => '') }
}))

// Why: the renderer compiles against PreloadApi and runs against the exposed object, so a
// bridge that returns in an upstream merge would silently reopen an SSH call path. The type
// assertions fail typecheck; the runtime assertions fail this test.
describe('local-only preload surface', () => {
  const originalContextIsolated = Object.getOwnPropertyDescriptor(process, 'contextIsolated')

  beforeEach(() => {
    vi.resetModules()
    exposeInMainWorld.mockReset()
    Object.defineProperty(process, 'contextIsolated', { configurable: true, value: true })
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      removeEventListener: vi.fn()
    })
    vi.stubGlobal('document', { addEventListener: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    if (originalContextIsolated) {
      Object.defineProperty(process, 'contextIsolated', originalContextIsolated)
    } else {
      Reflect.deleteProperty(process, 'contextIsolated')
    }
  })

  it('exposes neither an SSH nor a remote-workspace bridge', async () => {
    await import('./index')
    const api = exposeInMainWorld.mock.calls.find(([name]) => name === 'api')?.[1] as PreloadApi
    expect(api).toBeDefined()
    expect(api).not.toHaveProperty('ssh')
    expect(api).not.toHaveProperty('remoteWorkspace')
    expect(api.fs).not.toHaveProperty('downloadFile')
    expect(api.fs).not.toHaveProperty('downloadFolder')
    expect(api.repos).not.toHaveProperty('cloneRemote')
    expect(api.repos).not.toHaveProperty('createRemote')
    expect(api.repos).not.toHaveProperty('addRemote')
  })

  it('types no SSH surface', () => {
    expectTypeOf<PreloadApi>().not.toHaveProperty('ssh')
    expectTypeOf<PreloadApi>().not.toHaveProperty('remoteWorkspace')
    expectTypeOf<PreloadApi['fs']>().not.toHaveProperty('downloadFile')
    expectTypeOf<PreloadApi['fs']>().not.toHaveProperty('downloadFolder')
    expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('cloneRemote')
    expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('createRemote')
    expectTypeOf<PreloadApi['repos']>().not.toHaveProperty('addRemote')
  })
})
