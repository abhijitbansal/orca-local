import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveClientEnvironmentInfo } from './client-environment-info'

describe('resolveClientEnvironmentInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the app version from window.api.app.getVersion', async () => {
    vi.stubGlobal('window', {
      ...globalThis.window,
      api: { app: { getVersion: vi.fn().mockResolvedValue('9.9.9') } }
    })
    await expect(resolveClientEnvironmentInfo()).resolves.toMatchObject({ appVersion: '9.9.9' })
  })
})
