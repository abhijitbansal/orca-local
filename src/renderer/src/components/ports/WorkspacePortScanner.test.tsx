// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import {
  MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION,
  RUNTIME_PROTOCOL_VERSION
} from '../../../../shared/protocol-version'
import type { WorkspacePortScanResult } from '../../../../shared/workspace-ports'
import { useAppStore } from '@/store'
import { WorkspacePortScanner } from './WorkspacePortScanner'

const localScan = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const remoteWorktreeId = 'repo-1::/remote/repo'
let container: HTMLDivElement | null = null
let root: Root | null = null

const emptyScan: WorkspacePortScanResult = {
  platform: 'darwin',
  scannedAt: 1,
  ports: []
}
const liveScan: WorkspacePortScanResult = {
  platform: 'linux',
  scannedAt: 1,
  ports: [
    {
      id: 'tcp:3000',
      bindHost: '127.0.0.1',
      connectHost: '127.0.0.1',
      port: 3000,
      protocol: 'http',
      kind: 'workspace',
      owner: {
        worktreeId: remoteWorktreeId,
        repoId: 'repo-1',
        displayName: 'main',
        path: '/remote/repo',
        confidence: 'cwd'
      }
    }
  ]
}

function removeAllWorktrees(): void {
  const state = useAppStore.getState()
  useAppStore.setState({
    worktreesByRepo: Object.fromEntries(
      Object.keys(state.worktreesByRepo).map((repoId) => [repoId, []])
    ) as never
  })
}

function overrideDocumentVisibilityState(
  getVisibilityState: () => DocumentVisibilityState
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: getVisibilityState
  })
  return () => {
    if (descriptor) {
      Object.defineProperty(document, 'visibilityState', descriptor)
    } else {
      Reflect.deleteProperty(document, 'visibilityState')
    }
  }
}

const compatibleStatus = {
  runtimeId: 'env-1',
  graphStatus: 'ready',
  runtimeProtocolVersion: RUNTIME_PROTOCOL_VERSION,
  minCompatibleRuntimeClientVersion: MIN_COMPATIBLE_RUNTIME_CLIENT_VERSION
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

function seedRemoteWorkspace(environmentId = 'env-1'): void {
  useAppStore.setState({
    settings: {
      ...getDefaultSettings('/tmp/orca-workspaces'),
      activeRuntimeEnvironmentId: environmentId
    },
    repos: [
      {
        id: 'repo-1',
        path: '/remote/repo',
        displayName: 'Remote Repo',
        connectionId: null,
        executionHostId: toRuntimeExecutionHostId(environmentId)
      }
    ] as never,
    worktreesByRepo: {
      'repo-1': [
        {
          id: 'repo-1::/remote/repo',
          repoId: 'repo-1',
          path: '/remote/repo',
          displayName: 'main'
        }
      ]
    } as never,
    workspacePortScan: null,
    workspacePortScansByKey: {},
    workspacePortScanRefreshing: false
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  localScan.mockReset()
  runtimeEnvironmentCall.mockReset()
  localScan.mockResolvedValue(emptyScan)
  runtimeEnvironmentCall.mockImplementation(({ method }) => {
    if (method === 'status.get') {
      return Promise.resolve({ ok: true, result: compatibleStatus })
    }
    if (method === 'workspacePorts.scan') {
      return Promise.resolve({ ok: true, result: emptyScan })
    }
    return Promise.resolve({ ok: false, error: { code: 'method_not_found', message: method } })
  })
  vi.stubGlobal('window', {
    ...window,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
    api: {
      workspacePorts: {
        scan: localScan,
        onAdvertisedUrlChanged: vi.fn(() => vi.fn())
      },
      runtimeEnvironments: {
        call: runtimeEnvironmentCall
      }
    }
  })
  seedRemoteWorkspace()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  if (root) {
    act(() => root?.unmount())
  }
  root = null
  container?.remove()
  container = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('WorkspacePortScanner', () => {
  // Why: a manual publish (the ports popover) can resolve after the host-set
  // change already pruned its key, re-adding it. Per-key writes never delete, so
  // that removed host would otherwise hold its ports and a permanent
  // unavailable notice until the next host-set change.
  it('drops a stale host re-added after pruning on the next poll', async () => {
    await act(async () => {
      root?.render(<WorkspacePortScanner />)
      await flushPromises()
    })

    const staleKey = 'environment:env-removed:all'
    act(() => {
      const state = useAppStore.getState()
      state.replaceWorkspacePortScans(
        {
          ...state.workspacePortScansByKey,
          [staleKey]: { ...emptyScan, unavailableReason: 'gone' }
        },
        state.workspacePortScan
      )
    })
    expect(useAppStore.getState().workspacePortScansByKey[staleKey]).toBeDefined()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
      await flushPromises()
    })

    expect(useAppStore.getState().workspacePortScansByKey[staleKey]).toBeUndefined()
  })

  it('clears ports immediately when the final worktree is removed', async () => {
    runtimeEnvironmentCall.mockImplementation(({ method }) => {
      if (method === 'workspacePorts.scan') {
        return Promise.resolve({ ok: true, result: liveScan })
      }
      return Promise.resolve({ ok: false, error: { code: 'method_not_found', message: method } })
    })

    await act(async () => {
      root?.render(<WorkspacePortScanner />)
      await flushPromises()
    })
    expect(useAppStore.getState().workspacePortScan).not.toBeNull()

    await act(async () => {
      removeAllWorktrees()
      await flushPromises()
    })

    expect(useAppStore.getState().workspacePortScan).toBeNull()
    expect(useAppStore.getState().workspacePortScansByKey).toEqual({})
    expect(useAppStore.getState().workspacePortScanRefreshing).toBe(false)
  })
})

describe('advertised URL refresh bursts', () => {
  async function mountLocalScanner(): Promise<() => void> {
    useAppStore.setState({ settings: getDefaultSettings('/tmp/orca-workspaces') })
    await act(async () => {
      root?.render(<WorkspacePortScanner />)
      await flushPromises()
    })
    localScan.mockClear()
    return vi.mocked(window.api.workspacePorts.onAdvertisedUrlChanged).mock
      .calls[0][0] as () => void
  }

  it('coalesces sequential URL changes into one immediate scan and one settled scan', async () => {
    const changed = await mountLocalScanner()
    for (let index = 0; index < 5; index++) {
      await act(async () => {
        changed()
        await flushPromises()
        await vi.advanceTimersByTimeAsync(100)
      })
    }
    expect(localScan).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(localScan).toHaveBeenCalledTimes(2)
    await act(async () => {
      changed()
      await flushPromises()
    })
    expect(localScan).toHaveBeenCalledTimes(3)
  })

  it('cancels the settled scan on unmount', async () => {
    const changed = await mountLocalScanner()
    await act(async () => {
      changed()
      await flushPromises()
    })
    act(() => root?.unmount())
    root = null
    await vi.advanceTimersByTimeAsync(2_000)
    expect(localScan).toHaveBeenCalledTimes(1)
  })

  it('skips the settled scan while hidden and accepts the next visible URL change', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    const restore = overrideDocumentVisibilityState(() => visibility)
    try {
      const changed = await mountLocalScanner()
      await act(async () => {
        changed()
        await flushPromises()
      })
      visibility = 'hidden'
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000)
      })
      expect(localScan).toHaveBeenCalledTimes(1)
      visibility = 'visible'
      await act(async () => {
        changed()
        await flushPromises()
      })
      expect(localScan).toHaveBeenCalledTimes(2)
    } finally {
      restore()
    }
  })
})

it('releases the URL burst when its leading scan finishes while hidden', async () => {
  let visibility: DocumentVisibilityState = 'visible'
  const restore = overrideDocumentVisibilityState(() => visibility)
  try {
    useAppStore.setState({ settings: getDefaultSettings('/tmp/orca-workspaces') })
    await act(async () => {
      root?.render(<WorkspacePortScanner />)
      await flushPromises()
    })
    const changed = vi.mocked(window.api.workspacePorts.onAdvertisedUrlChanged).mock
      .calls[0][0] as () => void
    let finish!: (scan: WorkspacePortScanResult) => void
    localScan.mockClear()
    localScan.mockImplementationOnce(
      () =>
        new Promise<WorkspacePortScanResult>((resolve) => {
          finish = resolve
        })
    )
    await act(async () => {
      changed()
      await flushPromises()
    })
    visibility = 'hidden'
    await act(async () => {
      finish(emptyScan)
      await flushPromises()
    })
    visibility = 'visible'
    await act(async () => {
      changed()
      await flushPromises()
    })
    expect(localScan).toHaveBeenCalledTimes(2)
  } finally {
    restore()
  }
})
