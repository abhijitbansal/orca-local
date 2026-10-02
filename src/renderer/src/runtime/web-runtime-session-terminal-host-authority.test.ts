import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebRuntimeSessionTerminal } from './web-runtime-session'
import { resetWebSessionCloseIntentForTests } from './web-session-close-intent'
import {
  ENVIRONMENT_ID,
  FOCUS_LEAF_ID,
  RUNTIME_EXECUTION_HOST_ID,
  WORKTREE_ID,
  makeSnapshot,
  resetTerminalCreateEnvironment,
  stubTerminalCreateEnvironment
} from './web-runtime-session-test-harness'

const mocks = vi.hoisted(() => ({
  getState: vi.fn(),
  setState: vi.fn(),
  subscribe: vi.fn(),
  setActiveWorktree: vi.fn(),
  createBrowserTab: vi.fn(),
  closeEmptyGroup: vi.fn(),
  moveUnifiedTabToGroup: vi.fn(),
  setRemoteBrowserPageHandle: vi.fn(),
  focusBrowserTabInWorktree: vi.fn(),
  applyWebSessionTabsSnapshot: vi.fn(),
  decideWebSessionTabsSnapshot: vi.fn(() => ({ apply: true, settlesHostMirror: true })),
  getWebSessionTabsTrackingGeneration: vi.fn(() => 0),
  acceptReplayedWebSessionTabsSnapshot: vi.fn(),
  resolveHostSessionTabIdForWebSessionTab: vi.fn(),
  trackTerminalPaneSplit: vi.fn(),
  deliverLaunchPromptToAgentTab: vi.fn(),
  seedNativeChatLaunchDraftForAgentTab: vi.fn(),
  getRuntimeEnvironmentIdForWorktree: vi.fn(),
  hasMaterializedWebRuntimeBrowserPage: vi.fn()
}))

vi.mock('../store', () => ({
  useAppStore: {
    getState: mocks.getState,
    setState: mocks.setState,
    subscribe: mocks.subscribe
  }
}))

vi.mock('./web-session-tabs-sync', () => ({
  acceptReplayedWebSessionTabsSnapshot: mocks.acceptReplayedWebSessionTabsSnapshot,
  applyWebSessionTabsSnapshot: mocks.applyWebSessionTabsSnapshot,
  decideWebSessionTabsSnapshot: mocks.decideWebSessionTabsSnapshot,
  getWebSessionTabsTrackingGeneration: mocks.getWebSessionTabsTrackingGeneration,
  applyWebSessionTabsStorePatch: (buildPatch: (state: unknown) => unknown) => {
    mocks.setState(buildPatch)
    // The production caller invokes the returned settle receipt.
    return () => {}
  },
  resolveHostSessionTabIdForWebSessionTab: mocks.resolveHostSessionTabIdForWebSessionTab
}))

vi.mock('@/lib/feature-education-telemetry', () => ({
  trackTerminalPaneSplit: mocks.trackTerminalPaneSplit
}))

vi.mock('@/lib/worktree-runtime-owner', () => ({
  getRuntimeEnvironmentIdForWorktree: mocks.getRuntimeEnvironmentIdForWorktree
}))

vi.mock('@/lib/agent-launch-prompt-delivery', () => ({
  deliverLaunchPromptToAgentTab: mocks.deliverLaunchPromptToAgentTab,
  seedNativeChatLaunchDraftForAgentTab: mocks.seedNativeChatLaunchDraftForAgentTab
}))

vi.mock('./web-runtime-browser-materialization', () => ({
  hasMaterializedWebRuntimeBrowserPage: mocks.hasMaterializedWebRuntimeBrowserPage
}))

afterEach(() => resetWebSessionCloseIntentForTests())

describe('createWebRuntimeSessionTerminal', () => {
  beforeEach(() => {
    stubTerminalCreateEnvironment(mocks)
  })

  afterEach(() => {
    resetTerminalCreateEnvironment()
  })

  it('keeps same-ID local and runtime worktrees on the selected runtime owner', async () => {
    const selectedHosts: (string | undefined)[] = []
    mocks.setActiveWorktree.mockImplementation((_worktreeId: string, executionHostId?: string) => {
      selectedHosts.push(executionHostId)
    })
    const runtimeCall = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'create',
        ok: true,
        result: { tab: { id: 'host-tab-1', leafId: 'host-leaf-1' } }
      })
      .mockResolvedValueOnce({ id: 'list', ok: true, result: makeSnapshot() })
    vi.stubGlobal('window', {
      api: { runtimeEnvironments: { call: runtimeCall } }
    })

    await expect(
      createWebRuntimeSessionTerminal({
        worktreeId: WORKTREE_ID,
        environmentId: ENVIRONMENT_ID
      })
    ).resolves.toEqual({ status: 'created' })

    expect(selectedHosts).toEqual([RUNTIME_EXECUTION_HOST_ID])
  })

  it.each([{ gated: false, authority: false }])(
    'routes a Kimi resume by capability (advertised=$gated) instead of the generic host-authority probe',
    async ({ gated, authority }) => {
      // Why: an old host answers the widened ensureAgentSession enum with invalid_argument, which
      // runRemoteAgentSessionLaunch does not retry on — the per-agent probe is the only thing
      // keeping a remote Kimi resume from dying instead of degrading to a legacy launch.
      const runtimeCall = vi.fn(async (request: { method: string }) => {
        if (request.method === 'status.get') {
          return {
            id: 'status',
            ok: true,
            result: {
              runtimeId: 'runtime-1',
              graphStatus: 'ready',
              runtimeProtocolVersion: 3,
              minCompatibleRuntimeClientVersion: 2,
              capabilities: [
                'agent-session.host-authority.v1',
                ...(gated ? ['agent-session.kimi-resume.v1'] : [])
              ]
            }
          }
        }
        if (request.method === 'terminal.ensureAgentSession') {
          return {
            id: 'ensure',
            ok: true,
            result: {
              terminal: {
                handle: 'term-kimi',
                worktreeId: WORKTREE_ID,
                tabId: 'host-tab-kimi',
                paneKey: `host-tab-kimi:${FOCUS_LEAF_ID}`
              },
              disposition: 'created'
            }
          }
        }
        if (request.method === 'session.tabs.createTerminal') {
          return {
            id: 'legacy-create',
            ok: true,
            result: { tab: { id: 'host-tab-kimi', leafId: FOCUS_LEAF_ID } }
          }
        }
        return { id: 'list', ok: true, result: makeSnapshot() }
      })
      vi.stubGlobal('window', {
        api: { runtimeEnvironments: { call: runtimeCall } }
      })

      await expect(
        createWebRuntimeSessionTerminal({
          worktreeId: WORKTREE_ID,
          agentSessionKind: 'resume',
          launchAgent: 'kimi',
          command: "kimi '--session' 'session_431324d7'",
          providerSession: { key: 'session_id', id: 'session_431324d7' }
        })
      ).resolves.toEqual({ status: 'created' })

      const methods = runtimeCall.mock.calls.map(([request]) => request.method)
      expect(methods.includes('terminal.ensureAgentSession')).toBe(authority)
      expect(methods.includes('session.tabs.createTerminal')).toBe(!authority)
    }
  )
})
