import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createAgentBackgroundSessionTestState,
  resetAgentBackgroundSessionTestHarness
} from '@/lib/agent-background-session-test-state'

const mockSpawn = vi.fn()
const mockKill = vi.fn()
const mockWrite = vi.fn()
const mockRuntimeEnvironmentCall = vi.fn()
const mockRuntimeEnvironmentTransportCall = vi.fn()
const mockRuntimeEnvironmentSubscribe = vi.fn()
const mockCreateTab = vi.fn()
const mockSetTabCustomTitle = vi.fn()
const mockUpdateTabPtyId = vi.fn()
const mockCloseTab = vi.fn()
const mockSetTabLayout = vi.fn()
const mockRegisterAgentLaunchConfig = vi.fn()
const mockRegisterEagerPtyBuffer = vi.fn()
const mockSubscribeToPtyData = vi.fn()
const mockSubscribeToPtyExit = vi.fn()
const mockPasteDraftWhenAgentReady = vi.fn()
const mockDispatchEvent = vi.fn()
const mockGetAgentLaunchPlatformForRepo = vi.fn<() => NodeJS.Platform>()
const state = createAgentBackgroundSessionTestState({
  createTab: mockCreateTab,
  setTabCustomTitle: mockSetTabCustomTitle,
  updateTabPtyId: mockUpdateTabPtyId,
  closeTab: mockCloseTab,
  setTabLayout: mockSetTabLayout,
  registerAgentLaunchConfig: mockRegisterAgentLaunchConfig
})

vi.mock('@/store', () => ({
  useAppStore: {
    getState: () => state,
    subscribe: vi.fn(() => () => {})
  }
}))

// Why: the background mount's sleeping-agent scan reads store state these launches never seed.
vi.mock('@/lib/sleeping-agent-wake-requests', () => ({ requestSleepingAgentWakeOnMount: vi.fn() }))

vi.mock('@/lib/telemetry', () => ({
  track: vi.fn(),
  tuiAgentToAgentKind: (agent: string) => agent
}))

vi.mock('@/lib/agent-paste-draft', () => ({
  pasteDraftWhenAgentReady: mockPasteDraftWhenAgentReady
}))

vi.mock('@/lib/execution-host-facts', async (importOriginal) => {
  const hostFact = () => ({
    kind: 'known' as const,
    platform: mockGetAgentLaunchPlatformForRepo(),
    hostKind: 'local' as const
  })
  return {
    ...(await importOriginal<Record<string, unknown>>()),
    resolveRepoExecutionHostPlatform: hostFact,
    resolveWorktreeExecutionHostPlatform: hostFact
  }
})

vi.mock('@/components/terminal-pane/pty-dispatcher', () => ({
  registerEagerPtyBuffer: mockRegisterEagerPtyBuffer,
  subscribeToPtyExit: mockSubscribeToPtyExit
}))

vi.mock('@/components/terminal-pane/pty-data-sidecar-subscriptions', () => ({
  subscribeToPtyData: mockSubscribeToPtyData
}))

describe('launchAgentBackgroundSession remote runtime and SSH startup delivery', () => {
  beforeEach(() => {
    resetAgentBackgroundSessionTestHarness({
      state,
      createTab: mockCreateTab,
      closeTab: mockCloseTab,
      getLaunchPlatform: mockGetAgentLaunchPlatformForRepo,
      runtimeCall: mockRuntimeEnvironmentCall,
      runtimeTransportCall: mockRuntimeEnvironmentTransportCall,
      runtimeSubscribe: mockRuntimeEnvironmentSubscribe,
      subscribeToData: mockSubscribeToPtyData,
      subscribeToExit: mockSubscribeToPtyExit,
      setTabLayout: mockSetTabLayout,
      updateTabPtyId: mockUpdateTabPtyId,
      dispatchEvent: mockDispatchEvent,
      kill: mockKill,
      spawn: mockSpawn,
      write: mockWrite
    })
  })

  it('forwards Hermes startup queries through SSH command transport', async () => {
    state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
    const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

    await launchAgentBackgroundSession({
      agent: 'hermes',
      worktreeId: 'wt-1',
      prompt: 'remote automation prompt'
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({
        command: expect.stringContaining('ORCA_HERMES_STARTUP_QUERY'),
        connectionId: 'ssh-1',
        env: expect.objectContaining({ ORCA_HERMES_STARTUP_QUERY: 'remote automation prompt' })
      })
    )
  })

  it.each(['claude', 'codex'] as const)(
    'has the relay type the %s launch line instead of writing it from the renderer',
    async (agent) => {
      vi.useFakeTimers()
      try {
        state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
        const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

        await launchAgentBackgroundSession({
          agent,
          worktreeId: 'wt-1',
          prompt: 'run the automation'
        })

        expect(mockSpawn.mock.calls[0]?.[0]).toEqual(
          expect.objectContaining({
            command: expect.stringContaining("'run the automation'"),
            connectionId: 'ssh-1',
            commandDelivery: 'provider',
            startupCommandDelivery: 'shell-ready'
          })
        )
        const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
        dataSidecar('\x1b]777;orca-shell-ready\x07user@remote repo % ')
        vi.advanceTimersByTime(20_000)
        expect(mockWrite).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    }
  )

  it('has the relay type a promptless SSH background launch too', async () => {
    state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
    const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

    await launchAgentBackgroundSession({ agent: 'codex', worktreeId: 'wt-1' })

    expect(mockSpawn.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        commandDelivery: 'provider',
        startupCommandDelivery: 'shell-ready'
      })
    )
  })

  it('spawns an SSH folder-workspace automation on the owning host, not locally', async () => {
    // Folder workspaces have no repo row, so launch ownership comes from their scope.
    state.repos = [
      { id: 'repo-1', connectionId: 'ssh-1', path: '/srv/proj/api', projectGroupId: 'grp-1' }
    ]
    state.projectGroups = [{ id: 'grp-1', parentGroupId: null, connectionId: 'ssh-1' }]
    state.folderWorkspaces = [
      { id: 'fw-1', projectGroupId: 'grp-1', folderPath: '/srv/proj', connectionId: 'ssh-1' }
    ]
    state.getKnownWorktreeById = (worktreeId: string) =>
      worktreeId === 'folder:fw-1' ? { id: 'folder:fw-1', path: '/srv/proj' } : undefined
    const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

    await launchAgentBackgroundSession({
      agent: 'codex',
      worktreeId: 'folder:fw-1',
      prompt: 'run the automation'
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'ssh-1', cwd: '/srv/proj' })
    )
  })

  it('keeps a local folder workspace on the local host', async () => {
    state.repos = [
      { id: 'repo-1', connectionId: null, path: '/home/me/proj/api', projectGroupId: 'grp-1' }
    ]
    state.projectGroups = [{ id: 'grp-1', parentGroupId: null, connectionId: null }]
    state.folderWorkspaces = [
      { id: 'fw-1', projectGroupId: 'grp-1', folderPath: '/home/me/proj', connectionId: null }
    ]
    state.getKnownWorktreeById = (worktreeId: string) =>
      worktreeId === 'folder:fw-1' ? { id: 'folder:fw-1', path: '/home/me/proj' } : undefined
    const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

    await launchAgentBackgroundSession({
      agent: 'claude',
      worktreeId: 'folder:fw-1',
      prompt: 'run the automation'
    })

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: null, cwd: '/home/me/proj' })
    )
  })
})
