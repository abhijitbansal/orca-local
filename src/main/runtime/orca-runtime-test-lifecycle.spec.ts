import * as mocks from './orca-runtime-test-mocks.spec'
import type { MockInstance } from 'vitest'
import * as worktreeChangeInvalidators from '../ipc/worktree-change-invalidators'
import { awaitBackgroundRemovalsInRuntimeTests } from './orca-runtime-background-removal-test-support'
import { commitFakeSpawnsInRuntimeTests } from './bind-first-pane.test-fixture'
import {
  _resetPendingWorktreeRemovalsForTests,
  _settlePendingWorktreeRemovalsForTests
} from '../worktree-background-removal'
import { _resetCanonicalRepoKeyCacheForTests } from '../git/canonical-repo-key'

const { MOCK_GIT_WORKTREES, RuntimeBrowserCommands, _resetTerminalViewAttributesForTest } = mocks
const { addSparseWorktree, addWorktree, advertisedUrlWatcher } = mocks
const { afterEach, applyAgentStatusHooksEnabledMock, assertWorktreeCleanForRemoval, beforeEach } =
  mocks
const { cancelLegacyWorkerTerminalRecoveryRetriesForTests } = mocks
const { clearConfiguredWorktreeSharedDirectoriesCacheForTests } = mocks
const { closeLocalWatcherForWorktreePathMock } = mocks
const { computeWorktreePathMock } = mocks
const { createSetupRunnerScript } = mocks
const { detectInstalledAgentsWithShellPathHydrationMock } = mocks
const { electronMocks, ensurePathWithinWorkspaceMock } = mocks
const { findExistingWorktreeSymlinkPathsMock, forceDeleteLocalBranchMock } = mocks
const { forgetLocalWatcherRemovalSnapshotMock } = mocks
const { describeCreatedWorktree } = mocks
const { getDefaultTabsLaunch, getEffectiveHooks } = mocks
const { getEffectiveHooksFromConfig } = mocks
const { hasHooksFile } = mocks
const { installFakeAppEnvironment, invalidateAuthorizedRootsCacheMock } = mocks
const { listWorktrees, listWorktreesSharedStrict } = mocks
const { listWorktreesStrict, loadHooks, markCodexProjectTrustedMock } = mocks
const { markCopilotFolderTrustedMock, markCursorWorkspaceTrustedMock } = mocks
const { parseOrcaYaml, prepareLocalWorktreeRootForRepoMock } = mocks
const { removeWorktree } = mocks
const { removeWorktreeLinkedPathsMock } = mocks
const { resetPlatform } = mocks
const { resolveLocalGitUsernameMock, resolveSetupRunnerShell } = mocks
const { restoreLocalWatcherAfterFailedRemovalMock } = mocks
const { runHook, scanLocalRepoWorktreesForResolutionMock } = mocks
const { setRuntimeBrowserCommandsFactory } = mocks
const { setRuntimeBrowserUnavailableCause, setRuntimeDesktopSurface } = mocks
const { setRuntimeTerminalUnavailableCause, shouldRunSetupForCreate } = mocks
const { vi } = mocks

awaitBackgroundRemovalsInRuntimeTests(mocks.OrcaRuntimeService.prototype)
commitFakeSpawnsInRuntimeTests(mocks.OrcaRuntimeService.prototype)

function resetRuntimeTestMocks(): void {
  _resetCanonicalRepoKeyCacheForTests()
  _resetPendingWorktreeRemovalsForTests()
  // Why: constructing the browser commands is what pulls the Chromium cluster in, so
  // production installs this at the Electron entry. A Node host installs none and the
  // browser RPCs reject rather than silently succeeding.
  setRuntimeBrowserCommandsFactory((host) => new RuntimeBrowserCommands(host), {
    clientHosting: true
  })
  setRuntimeBrowserUnavailableCause(null)
  setRuntimeTerminalUnavailableCause(null)
  // Why: the runtime's notification, window lookup and tab-create-reply channel are
  // injected now, so the electron mock alone is inert. Back the surface with the same
  // mocks so every existing expectation still holds.
  setRuntimeDesktopSurface({
    showNotification: () => true,
    findWindowById: (id) => electronMocks.BrowserWindow.fromId(id) as never,
    onIpc: (channel, listener) => electronMocks.ipcMain.on(channel, listener as never),
    removeIpcListener: (channel, listener) =>
      electronMocks.ipcMain.removeListener(channel, listener as never)
  })
  resetPlatform()
  electronMocks.app.isPackaged = false
  // Why here and not the electron mock: the runtime reads paths and the packaged flag
  // through the AppEnvironment port now, so the electron mock alone is inert. Reading
  // electronMocks.app keeps the existing per-test toggles below working unchanged.
  installFakeAppEnvironment({
    getPath: () => electronMocks.app.getPath(),
    isPackaged: () => electronMocks.app.isPackaged
  })
  // Why: a worker-recovery retry re-arms itself for as long as a deferred worker exists, so one
  // left armed keeps rescanning worktrees through the shared git stubs for the rest of the run.
  cancelLegacyWorkerTerminalRecoveryRetriesForTests()
  clearConfiguredWorktreeSharedDirectoriesCacheForTests()
  _resetTerminalViewAttributesForTest()
  advertisedUrlWatcher.clear()
  electronMocks.BrowserWindow.fromId.mockReset()
  electronMocks.BrowserWindow.fromId.mockReturnValue(null)
  electronMocks.webContents.fromId.mockReset()
  electronMocks.webContents.fromId.mockReturnValue(null)
  electronMocks.ipcMain.on.mockClear()
  electronMocks.ipcMain.removeListener.mockClear()
  electronMocks.ipcMain.emit.mockClear()
  closeLocalWatcherForWorktreePathMock.mockReset().mockResolvedValue(undefined)
  restoreLocalWatcherAfterFailedRemovalMock.mockReset().mockResolvedValue(undefined)
  forgetLocalWatcherRemovalSnapshotMock.mockReset()
  vi.mocked(listWorktrees).mockResolvedValue(MOCK_GIT_WORKTREES)
  vi.mocked(listWorktreesStrict).mockResolvedValue(MOCK_GIT_WORKTREES)
  vi.mocked(describeCreatedWorktree).mockResolvedValue(undefined)
  // Why delegate: production reads both from one repo state, so a test that stubs the listing must
  // see the same rows through the create path's strict read.
  vi.mocked(listWorktreesSharedStrict).mockImplementation((repoPath, options) =>
    options ? listWorktrees(repoPath, options) : listWorktrees(repoPath)
  )
  scanLocalRepoWorktreesForResolutionMock
    .mockReset()
    .mockImplementation(async (repoPath: string, options: { wslDistro?: string }) => {
      try {
        const worktrees = options.wslDistro
          ? await listWorktrees(repoPath, options)
          : await listWorktrees(repoPath)
        return { ok: true, worktrees }
      } catch {
        return { ok: false, worktrees: [] }
      }
    })
  vi.mocked(addWorktree).mockReset()
  vi.mocked(addSparseWorktree).mockReset()
  vi.mocked(assertWorktreeCleanForRemoval).mockReset()
  vi.mocked(assertWorktreeCleanForRemoval).mockResolvedValue(undefined)
  vi.mocked(removeWorktree).mockReset()
  findExistingWorktreeSymlinkPathsMock.mockReset().mockResolvedValue([])
  removeWorktreeLinkedPathsMock.mockReset()
  resolveLocalGitUsernameMock.mockReset().mockResolvedValue('')
  vi.mocked(forceDeleteLocalBranchMock).mockReset()
  vi.mocked(forceDeleteLocalBranchMock).mockResolvedValue(undefined)
  applyAgentStatusHooksEnabledMock.mockReset().mockResolvedValue([])
  vi.mocked(createSetupRunnerScript).mockReset()
  vi.mocked(getEffectiveHooks).mockReset()
  vi.mocked(getEffectiveHooksFromConfig).mockReset()
  vi.mocked(getDefaultTabsLaunch).mockReset()
  vi.mocked(loadHooks).mockReset()
  vi.mocked(resolveSetupRunnerShell).mockReset()
  vi.mocked(hasHooksFile).mockReset()
  vi.mocked(parseOrcaYaml).mockReset()
  vi.mocked(runHook).mockReset()
  vi.mocked(shouldRunSetupForCreate).mockReset()
  vi.mocked(shouldRunSetupForCreate).mockImplementation((_repo, decision) => decision === 'run')
  vi.mocked(getEffectiveHooks).mockReturnValue(null)
  vi.mocked(getEffectiveHooksFromConfig).mockReturnValue(null)
  vi.mocked(getDefaultTabsLaunch).mockReturnValue(undefined)
  vi.mocked(loadHooks).mockReturnValue(null)
  vi.mocked(resolveSetupRunnerShell).mockReturnValue(undefined)
  vi.mocked(hasHooksFile).mockReturnValue(false)
  vi.mocked(parseOrcaYaml).mockReturnValue(null)
  computeWorktreePathMock.mockReset()
  ensurePathWithinWorkspaceMock.mockReset()
  invalidateAuthorizedRootsCacheMock.mockReset()
  prepareLocalWorktreeRootForRepoMock.mockReset().mockResolvedValue(undefined)
  detectInstalledAgentsWithShellPathHydrationMock.mockReset()
  detectInstalledAgentsWithShellPathHydrationMock.mockResolvedValue([])
  markCodexProjectTrustedMock.mockReset()
  markCopilotFolderTrustedMock.mockReset()
  markCursorWorkspaceTrustedMock.mockReset()
}

let registrationSpy:
  | MockInstance<typeof worktreeChangeInvalidators.registerWorktreeChangeInvalidator>
  | undefined

beforeEach(() => {
  resetRuntimeTestMocks()
  registrationSpy = vi.spyOn(worktreeChangeInvalidators, 'registerWorktreeChangeInvalidator')
})
afterEach(async () => {
  try {
    await _settlePendingWorktreeRemovalsForTests()
  } finally {
    try {
      // Runtime fixtures share a process; invalidators must end with their case.
      for (const result of registrationSpy?.mock.results ?? []) {
        if (result.type === 'return') {
          result.value()
        }
      }
    } finally {
      registrationSpy?.mockRestore()
      registrationSpy = undefined
      resetRuntimeTestMocks()
    }
  }
})

export { resetRuntimeTestMocks }
