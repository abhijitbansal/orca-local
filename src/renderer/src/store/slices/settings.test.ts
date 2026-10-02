import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createTestStore, makeWorktree } from './store-test-helpers'
import type { AppState } from '../types'
import type { WorktreeLineage } from '../../../../shared/worktree/lineage-types'
import type { PublicKnownRuntimeEnvironment } from '../../../../shared/runtime-environments'
import {
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
  RUNTIME_PROTOCOL_VERSION
} from '../../../../shared/protocol-version'
import {
  RUNTIME_CATALOG_STALE_MS,
  resetRuntimeCatalogListingForTests
} from './runtime-status-hydration'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/agent-status', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    detectAgentStatusFromTitle: vi.fn().mockReturnValue(null)
  }
})

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentGetStatus = vi.fn()
const settingsSet = vi.fn().mockResolvedValue(undefined)
const settingsGet = vi.fn()
const runtimeEnvironmentList = vi.fn()
const worktreesListDetected = vi.fn()

const env2Lineage: WorktreeLineage = {
  worktreeId: 'repo-env-2::/env-2/repo',
  worktreeInstanceId: 'env-2-instance',
  parentWorktreeId: 'repo-env-2::/env-2/parent',
  parentWorktreeInstanceId: 'env-2-parent-instance',
  origin: 'manual',
  capture: { source: 'manual-action', confidence: 'explicit' },
  createdAt: 1
}

function makeRuntimeEnvironment(id: string): PublicKnownRuntimeEnvironment {
  const endpointId = `ws-${id}`
  return {
    id,
    name: id,
    createdAt: 1,
    updatedAt: 1,
    lastUsedAt: null,
    runtimeId: null,
    endpoints: [{ id: endpointId, kind: 'websocket', label: 'WebSocket', endpoint: 'ws://x' }],
    preferredEndpointId: endpointId
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason?: unknown) => void = () => {}
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  delete (globalThis as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__
  resetRuntimeCatalogListingForTests()
  vi.clearAllMocks()
  runtimeEnvironmentGetStatus.mockResolvedValue({
    id: 'status-rpc-1',
    ok: true,
    result: {
      runtimeId: 'runtime-2',
      graphStatus: 'ready',
      runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
      minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
    },
    _meta: { runtimeId: 'runtime-2' }
  })
  settingsGet.mockResolvedValue({ notifications: {} })
  runtimeEnvironmentList.mockResolvedValue([])
  runtimeEnvironmentCall.mockImplementation(
    ({ method, params }: { method: string; params?: { repo?: string } }) => {
      const detectedRepoId = params?.repo ?? 'repo-env-2'
      const detectedPath = detectedRepoId === 'repo-env-1' ? '/env-1/repo' : '/env-2/repo'
      const result =
        method === 'status.get'
          ? {
              runtimeId: 'runtime-2',
              graphStatus: 'ready',
              runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
              minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
            }
          : method === 'repo.list'
            ? {
                repos: [
                  {
                    id: 'repo-env-2',
                    path: '/env-2/repo',
                    displayName: 'Env 2',
                    badgeColor: 'blue',
                    addedAt: 1
                  }
                ]
              }
            : method === 'worktree.list'
              ? {
                  worktrees: [
                    makeWorktree({
                      id: 'repo-env-2::/env-2/repo',
                      repoId: 'repo-env-2',
                      path: '/env-2/repo'
                    })
                  ],
                  totalCount: 1,
                  truncated: false
                }
              : method === 'worktree.detectedList'
                ? {
                    repoId: detectedRepoId,
                    authoritative: true,
                    source: 'git',
                    worktrees: [
                      {
                        ...makeWorktree({
                          id: `${detectedRepoId}::${detectedPath}`,
                          repoId: detectedRepoId,
                          path: detectedPath
                        }),
                        ownership: 'orca-managed',
                        selectedCheckout: true,
                        visible: true
                      }
                    ]
                  }
                : method === 'browser.profileList'
                  ? { profiles: [] }
                  : method === 'projectGroup.list'
                    ? { groups: [] }
                    : method === 'worktree.lineageList'
                      ? { lineage: { [env2Lineage.worktreeId]: env2Lineage } }
                      : method === 'settings.get'
                        ? { settings: {} }
                        : {}
      return Promise.resolve({ id: 'rpc-1', ok: true, result, _meta: { runtimeId: 'runtime-2' } })
    }
  )
  worktreesListDetected.mockResolvedValue({
    repoId: 'repo-env-1',
    authoritative: true,
    source: 'git',
    worktrees: [
      {
        ...makeWorktree({
          id: 'repo-env-1::/env-1/repo',
          repoId: 'repo-env-1',
          path: '/env-1/repo'
        }),
        ownership: 'orca-managed',
        selectedCheckout: true,
        visible: true
      }
    ]
  })
  vi.stubGlobal('window', {
    api: {
      settings: { get: settingsGet, set: settingsSet },
      runtimeEnvironments: {
        call: runtimeEnvironmentCall,
        getStatus: runtimeEnvironmentGetStatus,
        list: runtimeEnvironmentList
      },
      worktrees: { listDetected: worktreesListDetected }
    }
  })
})

describe('createSettingsSlice checked persistence', () => {
  it('stores the authoritative settings after a successful checked update', async () => {
    const authoritativeSettings = {
      pluginSystemEnabled: true,
      notifications: {}
    } as unknown as NonNullable<AppState['settings']>
    settingsSet.mockResolvedValueOnce(authoritativeSettings)
    const store = createTestStore()
    store.setState({
      settings: {
        pluginSystemEnabled: false,
        notifications: {}
      } as unknown as AppState['settings']
    })

    await expect(
      store.getState().updateSettingsOrThrow({ pluginSystemEnabled: true })
    ).resolves.toBeUndefined()

    expect(settingsSet).toHaveBeenCalledWith({ pluginSystemEnabled: true })
    expect(store.getState().settings).toBe(authoritativeSettings)
  })

  it('rejects a failed checked update without changing local settings', async () => {
    const persistenceError = new Error('settings IPC failed')
    const currentSettings = {
      pluginSystemEnabled: false,
      notifications: {}
    } as unknown as NonNullable<AppState['settings']>
    settingsSet.mockRejectedValueOnce(persistenceError)
    const store = createTestStore()
    store.setState({ settings: currentSettings })

    await expect(
      store.getState().updateSettingsOrThrow({ pluginSystemEnabled: true })
    ).rejects.toBe(persistenceError)

    expect(store.getState().settings).toBe(currentSettings)
  })

  it('keeps the existing update action best-effort and logs persistence failures', async () => {
    const persistenceError = new Error('settings IPC failed')
    const currentSettings = {
      pluginSystemEnabled: false,
      notifications: {}
    } as unknown as NonNullable<AppState['settings']>
    settingsSet.mockRejectedValueOnce(persistenceError)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createTestStore()
    store.setState({ settings: currentSettings })

    try {
      await expect(
        store.getState().updateSettings({ pluginSystemEnabled: true })
      ).resolves.toBeUndefined()

      expect(consoleError).toHaveBeenCalledWith('Failed to update settings:', persistenceError)
      expect(store.getState().settings).toBe(currentSettings)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('normalizes malformed mobile pairing addresses before renderer IPC', async () => {
    const store = createTestStore()
    store.setState({
      settings: { notifications: {} } as unknown as AppState['settings']
    })

    await store.getState().updateSettingsOrThrow({
      mobilePairingCustomAddress: 'host:99999' as never,
      mobilePairingCustomAddresses: [' first.example:6768 ', 'host:99999', 'first.example:6768']
    })

    expect(settingsSet).toHaveBeenCalledWith({
      mobilePairingCustomAddress: null,
      mobilePairingCustomAddresses: ['first.example:6768']
    })
  })
})

describe('createSettingsSlice runtime switching', () => {
  it('repairs drifted task provider settings before sending updates', async () => {
    settingsSet.mockResolvedValueOnce({
      visibleTaskProviders: ['github', 'linear'],
      defaultTaskSource: 'github'
    })
    const store = createTestStore()
    store.setState({
      settings: {
        visibleTaskProviders: ['linear'],
        defaultTaskSource: 'github'
      } as AppState['settings']
    })

    await store.getState().updateSettings({
      visibleTaskProviders: ['linear']
    })

    expect(settingsSet).toHaveBeenCalledWith({
      visibleTaskProviders: ['github', 'linear'],
      defaultTaskSource: 'github'
    })
  })

  it('rebases local state to the authoritative settings:set response', async () => {
    settingsSet.mockResolvedValueOnce({
      openInApplications: [{ id: 'cursor', label: 'Cursor', command: 'cursor' }],
      notifications: {}
    })
    const store = createTestStore()
    store.setState({
      settings: {
        openInApplications: [],
        notifications: {}
      } as unknown as AppState['settings']
    })

    await store.getState().updateSettings({
      openInApplications: [{ id: '  ', label: ' Cursor ', command: ' cursor ' }] as never
    })

    expect(store.getState().settings?.openInApplications).toEqual([
      { id: 'cursor', label: 'Cursor', command: 'cursor' }
    ])
  })
})

describe('fetchSettings runtime catalog probe', () => {
  // Why: skill discovery waits for the runtime catalog to settle. If a rejected
  // settings read skipped the probe, every skill badge would sit on a spinner
  // for the whole session with no retry affordance.
  it('still probes the runtime catalog when the settings read fails', async () => {
    settingsGet.mockRejectedValueOnce(new Error('unreadable settings.json'))
    const store = createTestStore()

    await store.getState().fetchSettings()
    await vi.waitFor(() => expect(runtimeEnvironmentList).toHaveBeenCalled())

    expect(store.getState().settings).toBeNull()
    expect(store.getState().runtimeEnvironmentCatalogSettled).toBe(true)
  })

  it('probes the runtime catalog after a successful settings read', async () => {
    const store = createTestStore()

    await store.getState().fetchSettings()
    await vi.waitFor(() => expect(runtimeEnvironmentList).toHaveBeenCalled())

    expect(store.getState().settings).not.toBeNull()
    expect(store.getState().runtimeEnvironmentCatalogSettled).toBe(true)
  })

  it('coalesces concurrent settings refreshes into one all-host sweep', async () => {
    const environments = [makeRuntimeEnvironment('env-a'), makeRuntimeEnvironment('env-b')]
    const catalog = deferred<PublicKnownRuntimeEnvironment[]>()
    runtimeEnvironmentList.mockReturnValueOnce(catalog.promise)
    const store = createTestStore()

    await Promise.all(Array.from({ length: 10 }, () => store.getState().fetchSettings()))

    expect(settingsGet).toHaveBeenCalledTimes(10)
    expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentGetStatus).not.toHaveBeenCalled()

    catalog.resolve(environments)
    await vi.waitFor(() => expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(store.getState().runtimeStatusByEnvironmentId.size).toBe(2))

    await store.getState().fetchSettings()
    expect(settingsGet).toHaveBeenCalledTimes(11)
    expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(2)
  })

  it('fills status coverage after another path publishes only part of the catalog', async () => {
    const environments = [makeRuntimeEnvironment('env-a'), makeRuntimeEnvironment('env-b')]
    runtimeEnvironmentList.mockResolvedValue(environments)
    const store = createTestStore()
    store.getState().setRuntimeEnvironments(environments)
    store.getState().setRuntimeEnvironmentStatus('env-a', { status: null, checkedAt: 1 })

    await store.getState().fetchSettings()
    await vi.waitFor(() => expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(2))

    expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
    expect(store.getState().runtimeStatusByEnvironmentId.has('env-b')).toBe(true)
  })

  it('treats an offline result as checked on later settings refreshes', async () => {
    const environments = [makeRuntimeEnvironment('env-a'), makeRuntimeEnvironment('env-b')]
    runtimeEnvironmentList.mockResolvedValue(environments)
    runtimeEnvironmentGetStatus.mockImplementation(({ selector }: { selector: string }) =>
      selector === 'env-b'
        ? Promise.reject(new Error('offline'))
        : Promise.resolve({
            id: 'status-rpc-a',
            ok: true,
            result: {
              runtimeId: 'runtime-a',
              graphStatus: 'ready',
              runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
              minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
            },
            _meta: { runtimeId: 'runtime-a' }
          })
    )
    const store = createTestStore()

    await store.getState().fetchSettings()
    await vi.waitFor(() =>
      expect(store.getState().runtimeStatusByEnvironmentId.get('env-b')?.status).toBeNull()
    )
    await store.getState().fetchSettings()

    expect(settingsGet).toHaveBeenCalledTimes(2)
    expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
    expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(2)
  })

  it('retries a failed catalog read on the next settings refresh', async () => {
    const firstCatalog = deferred<PublicKnownRuntimeEnvironment[]>()
    runtimeEnvironmentList
      .mockReturnValueOnce(firstCatalog.promise)
      .mockResolvedValueOnce([makeRuntimeEnvironment('env-a')])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = createTestStore()

    try {
      await store.getState().fetchSettings()
      firstCatalog.reject(new Error('unreadable environments.json'))
      await vi.waitFor(() => expect(store.getState().runtimeEnvironmentCatalogSettled).toBe(true))
      expect(store.getState().runtimeEnvironmentCatalogHydrated).toBe(false)

      await store.getState().fetchSettings()
      await vi.waitFor(() => expect(store.getState().runtimeEnvironmentCatalogHydrated).toBe(true))
      await vi.waitFor(() => expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(1))
      await store.getState().fetchSettings()

      expect(settingsGet).toHaveBeenCalledTimes(3)
      expect(runtimeEnvironmentList).toHaveBeenCalledTimes(2)
      expect(runtimeEnvironmentGetStatus).toHaveBeenCalledTimes(1)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('uses an authoritative sweep to remove ghost status entries', async () => {
    const store = createTestStore()
    store.getState().setRuntimeEnvironments([])
    store.getState().setRuntimeEnvironmentStatus('removed-env', { status: null, checkedAt: 1 })

    await store.getState().fetchSettings()
    await vi.waitFor(() => expect(store.getState().runtimeStatusByEnvironmentId.size).toBe(0))

    expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
  })

  it('picks up an externally added host once the listing goes stale', async () => {
    runtimeEnvironmentList.mockResolvedValue([makeRuntimeEnvironment('env-a')])
    const store = createTestStore()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    try {
      await store.getState().fetchSettings()
      await vi.waitFor(() => expect(store.getState().runtimeStatusByEnvironmentId.size).toBe(1))

      // Another client adds a host; coverage still matches, so only staleness can reveal it.
      runtimeEnvironmentList.mockResolvedValue([
        makeRuntimeEnvironment('env-a'),
        makeRuntimeEnvironment('env-b')
      ])
      await store.getState().fetchSettings()
      expect(runtimeEnvironmentList).toHaveBeenCalledTimes(1)
      expect(store.getState().runtimeEnvironments.map(({ id }) => id)).toEqual(['env-a'])

      now.mockReturnValue(1_000_000 + RUNTIME_CATALOG_STALE_MS + 1)
      await store.getState().fetchSettings()
      await vi.waitFor(() =>
        expect(store.getState().runtimeEnvironments.map(({ id }) => id)).toEqual(['env-a', 'env-b'])
      )
      await vi.waitFor(() =>
        expect(store.getState().runtimeStatusByEnvironmentId.has('env-b')).toBe(true)
      )
      expect(runtimeEnvironmentList).toHaveBeenCalledTimes(2)
    } finally {
      now.mockRestore()
    }
  })
})
