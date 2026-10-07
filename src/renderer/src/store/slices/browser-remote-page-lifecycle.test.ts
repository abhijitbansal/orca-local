import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('does not notify the local browser manager when selecting tabs under runtime', () => {
    const store = createTestStore()
    store.setState({
      settings: settingsWithRuntime('env-1'),
      unifiedTabsByWorktree: {},
      browserTabsByWorktree: {
        'wt-1': [
          {
            id: 'workspace-1',
            worktreeId: 'wt-1',
            sessionProfileId: null,
            activePageId: 'page-1',
            pageIds: ['page-1'],
            url: 'about:blank',
            title: 'New Tab',
            loading: false,
            faviconUrl: null,
            canGoBack: false,
            canGoForward: false,
            loadError: null,
            createdAt: 1
          }
        ]
      }
    })

    store.getState().setActiveBrowserTab('workspace-1')

    expect(mockApi.browser.notifyActiveTabChanged).not.toHaveBeenCalled()
  })
})
