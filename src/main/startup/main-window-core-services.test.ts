import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  attachMainWindowServicesMock,
  initTccPromptNoticeMock,
  preserveAgentAuthBeforeRestartMock,
  registerCoreHandlersMock,
  state
} = vi.hoisted(() => {
  const store = {
    writeLatestProfileStateJsonCompatibilityExportAsync: vi.fn(async () => {}),
    writeLatestProfileStateJsonExportAsync: vi.fn(async () => {}),
    getSettings: vi.fn(() => ({}))
  }
  return {
    attachMainWindowServicesMock: vi.fn(),
    initTccPromptNoticeMock: vi.fn(),
    preserveAgentAuthBeforeRestartMock: vi.fn(() => Promise.resolve()),
    registerCoreHandlersMock: vi.fn(),
    state: {
      store,
      runtime: {},
      stats: {},
      claudeUsage: {},
      codexUsage: {},
      openCodeUsage: {},
      museUsage: {},
      codexAccounts: {},
      claudeAccounts: {},
      rateLimits: { attach: vi.fn(), start: vi.fn() },
      automations: { setWebContents: vi.fn(), start: vi.fn() },
      keybindings: {},
      codexRuntimeHome: {},
      claudeRuntimeAuth: { prepareForClaudeLaunch: vi.fn() },
      agentAwakeService: null,
      crashReports: null,
      pluginService: null,
      pluginMarketplaceService: null,
      pluginMarketplaceInstaller: null,
      desktopRelayService: null,
      isServeMode: false,
      localPtyStartupReady: Promise.resolve(),
      localPtyProviderStartupReady: Promise.resolve()
    }
  }
})

vi.mock('../ipc/register-core-handlers/register-core-handlers', () => ({
  registerCoreHandlers: registerCoreHandlersMock
}))
vi.mock('../window/attach-main-window-services', () => ({
  attachMainWindowServices: attachMainWindowServicesMock
}))
vi.mock('../macos-tcc-prompt-notice', () => ({ initTccPromptNotice: initTccPromptNoticeMock }))
vi.mock('./main-process-state', () => ({ mainProcessState: state }))
vi.mock('../agent-auth-restart-preservation', () => ({
  preserveAgentAuthBeforeRestart: preserveAgentAuthBeforeRestartMock
}))
vi.mock('../codex/codex-ai-vault-session-resume', () => ({
  prepareCodexAiVaultSessionResume: vi.fn()
}))
vi.mock('../codex/codex-session-source-home', () => ({
  resolveHostCodexSessionSourceHome: vi.fn()
}))
vi.mock('./main-process-pty-startup', () => ({
  emitPluginWorktreeLifecycle: vi.fn(),
  handleCodexHomePtySpawned: vi.fn(),
  handlePtyExit: vi.fn()
}))
vi.mock('./codex-launch-preparation', () => ({ prepareCodexRuntimeHomeForLaunch: vi.fn() }))
vi.mock('./codex-session-resume-launch', () => ({ prepareCodexSessionResumeForLaunch: vi.fn() }))
vi.mock('./main-window-lifecycle-flags', () => ({ isRecoveryReloadInFlight: vi.fn() }))

const { attachMainWindowCoreServices } = await import('./main-window-core-services')

describe('main window profile-state update preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('wires no update-quit cleanup now that the auto-updater is gone', () => {
    const window = { webContents: { id: 17 } }

    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: mocked BrowserWindow only needs webContents for this composition-root wiring test.
    attachMainWindowCoreServices(window as never, {
      markExpectedRendererReload: vi.fn(),
      recordRendererReload: vi.fn()
    })

    const options = attachMainWindowServicesMock.mock.calls[0]?.[5]
    expect(options).not.toHaveProperty('onBeforeUpdateQuit')
    expect(options).not.toHaveProperty('updateInstallMode')
  })
})
