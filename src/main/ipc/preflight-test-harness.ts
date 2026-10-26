import path from 'node:path'
import type { Mock } from 'vitest'
import { _resetPreflightCache } from '../preflight/agent-detection'

export type HandlerMap = Record<string, (_event?: unknown, args?: unknown) => Promise<unknown>>

export type PreflightMocks = {
  handleMock: Mock
  execFileAsyncMock: Mock
  runWslProcessMock?: Mock
  hydrateShellPathMock: Mock
  mergePathSegmentsMock: Mock
  resolveCliCommandsMock: Mock
  isCommandOnLocalPathMock: Mock
  listLocalCommandPathsMock: Mock
  mergePersistedWindowsPathAsyncMock: Mock
  mergePersistedWindowsPathMock: Mock
}

export function resetPreflightMocks(mocks: PreflightMocks, handlers: HandlerMap): void {
  const {
    handleMock,
    execFileAsyncMock,
    runWslProcessMock,
    hydrateShellPathMock,
    mergePathSegmentsMock,
    resolveCliCommandsMock,
    isCommandOnLocalPathMock,
    listLocalCommandPathsMock,
    mergePersistedWindowsPathAsyncMock,
    mergePersistedWindowsPathMock
  } = mocks

  handleMock.mockReset()
  execFileAsyncMock.mockReset()
  runWslProcessMock?.mockReset()
  hydrateShellPathMock.mockReset()
  hydrateShellPathMock.mockResolvedValue({ segments: [], ok: false, failureReason: 'no_shell' })
  mergePathSegmentsMock.mockReset()
  // No filesystem candidates keeps bare command names for tests using the existing lookup/exec mocks.
  listLocalCommandPathsMock.mockReset()
  listLocalCommandPathsMock.mockResolvedValue([])
  mergePersistedWindowsPathAsyncMock.mockReset()
  mergePersistedWindowsPathAsyncMock.mockResolvedValue(undefined)
  mergePersistedWindowsPathMock.mockReset()
  // Keep install-directory fallback opt-in for cases that otherwise use only the command lookup mock.
  resolveCliCommandsMock.mockReset()
  resolveCliCommandsMock.mockImplementation(
    (commands: string[]) => new Map(commands.map((command) => [command, command]))
  )
  // Preserve existing lookup fixtures while production uses filesystem PATH resolution (#9297).
  isCommandOnLocalPathMock.mockReset()
  isCommandOnLocalPathMock.mockImplementation(async (command: string) => {
    const finder = process.platform === 'win32' ? 'where' : 'which'
    try {
      const { stdout } = await execFileAsyncMock(finder, [command])
      return String(stdout)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .some((line) => path.isAbsolute(line))
    } catch {
      return false
    }
  })
  _resetPreflightCache()
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: 'darwin'
  })

  for (const key of Object.keys(handlers)) {
    delete handlers[key]
  }

  handleMock.mockImplementation((channel, handler) => {
    handlers[channel] = handler
  })
}
