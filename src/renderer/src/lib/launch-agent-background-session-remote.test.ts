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

vi.mock('@/lib/telemetry', () => ({
  track: vi.fn(),
  tuiAgentToAgentKind: (agent: string) => agent
}))

vi.mock('@/lib/agent-paste-draft', () => ({
  pasteDraftWhenAgentReady: mockPasteDraftWhenAgentReady
}))

vi.mock('@/lib/agent-launch-platform', () => ({
  getAgentLaunchPlatformForRepo: mockGetAgentLaunchPlatformForRepo
}))

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

  it('injects fast startup commands into SSH background sessions after shell output arrives', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'claude',
        worktreeId: 'wt-1',
        prompt: 'run the automation',
        title: 'Nightly audit'
      })

      expect(mockSpawn.mock.calls[0]?.[0]?.command).toBe(
        "claude '--dangerously-skip-permissions' 'run the automation'"
      )
      expect(mockSpawn.mock.calls[0]?.[0]?.startupCommandDelivery).toBeUndefined()
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "claude '--dangerously-skip-permissions' 'run the automation'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for shell-ready before injecting payload-bearing SSH background commands', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'codex',
        worktreeId: 'wt-1',
        prompt: 'run the automation',
        title: 'Nightly audit'
      })

      expect(mockSpawn.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          command: "codex '--dangerously-bypass-approvals-and-sandbox' 'run the automation'",
          startupCommandDelivery: 'shell-ready'
        })
      )
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(50)
      expect(mockWrite).not.toHaveBeenCalled()

      dataSidecar('\x1b]777;orca-shell-ready\x07user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex '--dangerously-bypass-approvals-and-sandbox' 'run the automation'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  // #18767: a plain Codex launch carries no shell-ready hint, but the remote host
  // still arms the marker for it, so writing early would display the launch twice.
  it('waits for shell-ready for a promptless SSH background Codex launch', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({ agent: 'codex', worktreeId: 'wt-1' })
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(1_400)

      expect(mockWrite).not.toHaveBeenCalled()

      dataSidecar('\x1b]777;orca-shell-ready\x07user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex '--dangerously-bypass-approvals-and-sandbox'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips the shell-ready wait when the host reports it did not arm the marker', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      mockSpawn.mockResolvedValue({ id: 'pty-1', shellReadyArmed: false })
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({ agent: 'codex', worktreeId: 'wt-1' })
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex '--dangerously-bypass-approvals-and-sandbox'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back when an SSH shell produces no observable startup data', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'codex',
        worktreeId: 'wt-1',
        prompt: 'run the automation'
      })
      // Why the longer wait: a shell that has emitted nothing is still booting,
      // so the fallback holds off rather than pasting before readline arms.
      vi.advanceTimersByTime(1_550)
      expect(mockWrite).not.toHaveBeenCalled()
      vi.advanceTimersByTime(15_050)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex '--dangerously-bypass-approvals-and-sandbox' 'run the automation'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the short fallback for an SSH shell that talks but cannot emit the marker', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'codex',
        worktreeId: 'wt-1',
        prompt: 'run the automation'
      })
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(1_550)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex '--dangerously-bypass-approvals-and-sandbox' 'run the automation'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('waits for shell-ready for SSH background Codex native prefill commands without a hint', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      state.settings = {
        agentCmdOverrides: { codex: "codex --prefill 'draft from override'" },
        activeRuntimeEnvironmentId: null,
        terminalMainSideEffectAuthority: undefined
      }
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'codex',
        worktreeId: 'wt-1',
        title: 'Nightly audit'
      })

      expect(mockSpawn.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          command:
            "codex --prefill 'draft from override' '--dangerously-bypass-approvals-and-sandbox'"
        })
      )
      expect(mockSpawn.mock.calls[0]?.[0]).not.toHaveProperty('startupCommandDelivery')
      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      dataSidecar('user@remote repo % ')
      vi.advanceTimersByTime(50)
      expect(mockWrite).not.toHaveBeenCalled()

      dataSidecar('\x1b]777;orca-shell-ready\x07user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).toHaveBeenCalledWith(
        'pty-1',
        "codex --prefill 'draft from override' '--dangerously-bypass-approvals-and-sandbox'\r",
        'launch'
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not rearm SSH background startup delivery after exit cleanup', async () => {
    vi.useFakeTimers()
    try {
      state.repos = [{ id: 'repo-1', connectionId: 'ssh-1', path: '/repo' }]
      const { launchAgentBackgroundSession } = await import('./launch-agent-background-session')

      await launchAgentBackgroundSession({
        agent: 'codex',
        worktreeId: 'wt-1',
        prompt: 'run the automation',
        title: 'Nightly audit'
      })

      const dataSidecar = mockSubscribeToPtyData.mock.calls[0]?.[1] as (data: string) => void
      const exitSidecar = mockSubscribeToPtyExit.mock.calls[0]?.[1] as (code: number) => void
      exitSidecar(0)

      dataSidecar('\x1b]777;orca-shell-ready\x07user@remote repo % ')
      vi.advanceTimersByTime(50)

      expect(mockWrite).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
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
