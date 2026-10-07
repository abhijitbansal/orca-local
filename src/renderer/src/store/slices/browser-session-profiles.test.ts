import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getExecutionHostLabel } from '../../../../shared/execution-host'
import {
  createBrowserMockApi,
  createTestStore,
  resetBrowserRuntimeMocks,
  settingsWithRuntime
} from './browser-slice-test-harness'

const createWebRuntimeSessionBrowserTabMock = vi.hoisted(() => vi.fn())
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

vi.mock('@/runtime/web-runtime-session', () => ({
  createWebRuntimeSessionBrowserTab: createWebRuntimeSessionBrowserTabMock
}))

const mockApi = createBrowserMockApi(runtimeEnvironmentTransportCall)

// @ts-expect-error test window mock
globalThis.window = { api: mockApi }

describe('createBrowserSlice runtime guard', () => {
  beforeEach(() => {
    resetBrowserRuntimeMocks({
      runtimeEnvironmentCall,
      runtimeEnvironmentTransportCall,
      createWebRuntimeSessionBrowserTabMock
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not import local browser cookies while a runtime environment is active', async () => {
    const store = createTestStore()
    store.setState({ settings: settingsWithRuntime('env-1') })

    const result = await store.getState().importCookiesToProfile('default')

    expect(mockApi.browser.sessionImportCookies).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      ok: false,
      executionHostId: 'runtime:env-1',
      executionHostLabel: 'env-1'
    })
    expect(store.getState().browserSessionImportState).toMatchObject({
      profileId: 'default',
      status: 'error'
    })
  })

  it('retains the host display label used by browser settings', async () => {
    const store = createTestStore()
    store.setState({
      settings: {
        ...settingsWithRuntime('env-1')!,
        hostSettingOverrides: {
          'runtime:env-1': { displayLabel: 'Production Browser Host' }
        }
      },
      runtimeEnvironments: [{ id: 'env-1', name: 'Remote Mac' }] as never
    })

    const result = await store.getState().importCookiesToProfile('default')

    expect(result.executionHostLabel).toBe('Production Browser Host')
  })

  it('retains the local execution host for a successful browser import', async () => {
    mockApi.browser.sessionImportFromBrowser.mockResolvedValueOnce({
      ok: true,
      profileId: 'default',
      summary: { totalCookies: 2, importedCookies: 2, skippedCookies: 0, domains: [] }
    })
    const store = createTestStore()

    const result = await store.getState().importCookiesFromBrowser('default', 'chrome', 'Default')

    expect(result).toMatchObject({
      ok: true,
      executionHostId: 'local',
      executionHostLabel: getExecutionHostLabel('local'),
      executionMachine: 'client',
      executionRemoteEnvironment: false
    })
  })

  it('uses local browser IPC when no runtime environment is active', async () => {
    const store = createTestStore()
    mockApi.browser.sessionListProfiles.mockResolvedValueOnce([
      {
        id: 'default',
        scope: 'default',
        partition: 'persist:orca-default',
        label: 'Default',
        source: null
      }
    ])

    await store.getState().fetchBrowserSessionProfiles()

    expect(mockApi.browser.sessionListProfiles).toHaveBeenCalledTimes(1)
    expect(store.getState().browserSessionProfiles).toEqual([
      {
        id: 'default',
        scope: 'default',
        partition: 'persist:orca-default',
        label: 'Default',
        source: null
      }
    ])
  })

  it('creates a profile through local browser IPC', async () => {
    const store = createTestStore()
    const profile = {
      id: 'local-google',
      scope: 'isolated' as const,
      partition: 'persist:local-google',
      label: 'Google',
      source: null
    }
    mockApi.browser.sessionCreateProfile.mockResolvedValueOnce(profile)

    await expect(
      store.getState().createBrowserSessionProfile('isolated', 'Google')
    ).resolves.toEqual(profile)
    expect(mockApi.browser.sessionCreateProfile).toHaveBeenCalledWith({
      scope: 'isolated',
      label: 'Google'
    })
  })
})
