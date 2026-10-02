import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as AgentStatusModule from '@/lib/agent-status'
import { createTestStore, makeTab, makeWorktree, seedStore } from './store-test-helpers'
import { shutdownBufferCaptures } from '@/components/terminal-pane/shutdown-buffer-captures'
import {
  applySleepRuntimeRpcDefault,
  createStoreCascadesMockApi
} from './store-cascades-test-harness'

const mockUnregisterPtyDataHandlers = vi.hoisted(() => vi.fn<() => unknown[]>(() => []))
const mockRestorePtyDataHandlersAfterFailedShutdown = vi.hoisted(() => vi.fn())

// Mock sonner (imported by repos.ts)
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }
}))

vi.mock('@/components/terminal-pane/pty-dispatcher', () => ({
  restorePtyDataHandlersAfterFailedShutdown: mockRestorePtyDataHandlersAfterFailedShutdown,
  unregisterPtyDataHandlers: mockUnregisterPtyDataHandlers
}))

// Mock agent-status (imported by terminal-helpers)
vi.mock('@/lib/agent-status', async (importOriginal) => {
  const actual = await importOriginal<typeof AgentStatusModule>()
  return {
    ...actual,
    detectAgentStatusFromTitle: vi.fn().mockReturnValue(null)
  }
})

const mockApi = createStoreCascadesMockApi()

// Why: sleep must drop live + retained agent-status rows, else a mid-turn agent stays "working" until the 30-min stale TTL.
describe('shutdownWorktreeTerminals (sleep) — agent status hygiene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.pty.kill.mockResolvedValue(undefined)
    mockUnregisterPtyDataHandlers.mockReturnValue([])
    applySleepRuntimeRpcDefault(mockApi)
    shutdownBufferCaptures.clear()
  })

  it('does not consume a colliding raw PTY guard when a scoped remote PTY wakes', () => {
    const store = createTestStore()
    const wt = 'repo1::/path/wt1'

    seedStore(store, {
      worktreesByRepo: {
        repo1: [makeWorktree({ id: wt, repoId: 'repo1', path: '/path/wt1' })]
      },
      tabsByWorktree: {
        [wt]: [makeTab({ id: 'tab-1', worktreeId: wt, title: 'Codex' })]
      },
      ptyIdsByTabId: { 'tab-1': [] }
    })
    store.getState().suppressPtyExit('remote:env-1@@terminal-1')
    store.getState().suppressPtyExit('terminal-1')

    store.getState().updateTabPtyId('tab-1', 'remote:env-1@@terminal-1')

    expect(store.getState().suppressedPtyExitIds['remote:env-1@@terminal-1']).toBeUndefined()
    expect(store.getState().suppressedPtyExitIds['terminal-1']).toBe(true)
  })

  it('migrates legacy remote lifecycle state to the scoped PTY identity on attach', () => {
    const store = createTestStore()
    const wt = 'repo1::/path/wt1'
    const legacyPtyId = 'remote:terminal-1'
    const scopedPtyId = 'remote:env-1@@terminal-1'
    seedStore(store, {
      worktreesByRepo: {
        repo1: [makeWorktree({ id: wt, repoId: 'repo1', path: '/path/wt1' })]
      },
      tabsByWorktree: {
        [wt]: [makeTab({ id: 'tab-1', worktreeId: wt, ptyId: legacyPtyId })]
      },
      ptyIdsByTabId: { 'tab-1': [legacyPtyId] },
      suppressedPtyExitIds: { [legacyPtyId]: true },
      pendingCodexPaneRestartIds: { [legacyPtyId]: true },
      codexRestartNoticeByPtyId: {
        [legacyPtyId]: { previousAccountLabel: 'old', nextAccountLabel: 'new' }
      },
      migrationUnsupportedByPtyId: {
        [legacyPtyId]: {
          ptyId: legacyPtyId,
          paneKey: 'tab-1:leaf-1',
          reason: 'legacy-numeric-pane-key',
          source: 'local',
          updatedAt: 1
        }
      }
    })

    store.getState().updateTabPtyId('tab-1', scopedPtyId)
    const state = store.getState()

    expect(state.ptyIdsByTabId['tab-1']).toEqual([scopedPtyId])
    expect(state.tabsByWorktree[wt][0]?.ptyId).toBe(scopedPtyId)
    expect(state.suppressedPtyExitIds[legacyPtyId]).toBeUndefined()
    expect(state.suppressedPtyExitIds[scopedPtyId]).toBeUndefined()
    expect(state.pendingCodexPaneRestartIds).toEqual({ [scopedPtyId]: true })
    expect(state.codexRestartNoticeByPtyId[scopedPtyId]).toEqual({
      previousAccountLabel: 'old',
      nextAccountLabel: 'new'
    })
    expect(state.migrationUnsupportedByPtyId[scopedPtyId]?.ptyId).toBe(scopedPtyId)
  })
})
