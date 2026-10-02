import { afterEach, beforeEach, vi, type Mock } from 'vitest'

export type RuntimeClientModuleMocks = {
  callMock: Mock
  runtimeClientConstructorMock: Mock
  serveOrcaAppMock: Mock
  getDefaultUserDataPathMock: Mock
}

export type WorktreeAwarenessMocks = {
  callMock: Mock
  serveOrcaAppMock: Mock
  getDefaultUserDataPathMock: Mock
  spawnMock: Mock
}

export async function createRuntimeClientModuleMock(mocks: RuntimeClientModuleMocks) {
  // Why: re-export the REAL error classes rather than redefining them. format.ts
  // narrows with `instanceof` against ./runtime/types, so a look-alike class
  // here would make every CLI error fall through to the generic `runtime_error`
  // shape — mirroring the barrel keeps the mock faithful to production.
  const { RuntimeClientError, RuntimeRpcFailureError } = await import('./runtime/types.js')

  class RuntimeClient {
    call = mocks.callMock
    getCliStatus = vi.fn()
    openOrca = vi.fn()

    constructor() {
      mocks.runtimeClientConstructorMock()
    }
  }

  return {
    RuntimeClient,
    RuntimeClientError,
    RuntimeRpcFailureError,
    serveOrcaApp: mocks.serveOrcaAppMock,
    getDefaultUserDataPath: mocks.getDefaultUserDataPathMock
  }
}

export async function createChildProcessModuleMock(spawnMock: Mock) {
  const { EventEmitter } = await import('node:events')
  return {
    spawn: spawnMock.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), {
        stdout: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }),
        stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn() }),
        stdin: {
          write: vi.fn(),
          end: vi.fn()
        },
        kill: vi.fn()
      })
      process.nextTick(() => {
        child.emit('exit', 0, null)
        child.emit('close', 0, null)
      })
      return child
    })
  }
}

/** Installs the env-var save/restore + mock-reset hooks shared by the CLI worktree-awareness suites. */
export function useWorktreeAwarenessEnvironment(mocks: WorktreeAwarenessMocks): void {
  const originalTerminalHandle = process.env.ORCA_TERMINAL_HANDLE
  const originalUserDataPath = process.env.ORCA_USER_DATA_PATH
  const originalDevCliInvocation = process.env.ORCA_DEV_CLI_INVOCATION
  const originalWorkspaceId = process.env.ORCA_WORKSPACE_ID
  const originalWorktreeId = process.env.ORCA_WORKTREE_ID

  beforeEach(() => {
    mocks.callMock.mockReset()
    delete process.env.ORCA_TERMINAL_HANDLE
    delete process.env.ORCA_USER_DATA_PATH
    delete process.env.ORCA_DEV_CLI_INVOCATION
    delete process.env.ORCA_WORKSPACE_ID
    delete process.env.ORCA_WORKTREE_ID
    // Isolate the pane key so claude-teams tests that set it don't leak a
    // senderPaneKey into later orchestration.send assertions.
    delete process.env.ORCA_PANE_KEY
    mocks.serveOrcaAppMock.mockReset()
    mocks.getDefaultUserDataPathMock.mockClear()
    mocks.spawnMock.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalTerminalHandle === undefined) {
      delete process.env.ORCA_TERMINAL_HANDLE
    } else {
      process.env.ORCA_TERMINAL_HANDLE = originalTerminalHandle
    }
    if (originalUserDataPath === undefined) {
      delete process.env.ORCA_USER_DATA_PATH
    } else {
      process.env.ORCA_USER_DATA_PATH = originalUserDataPath
    }
    if (originalDevCliInvocation === undefined) {
      delete process.env.ORCA_DEV_CLI_INVOCATION
    } else {
      process.env.ORCA_DEV_CLI_INVOCATION = originalDevCliInvocation
    }
    if (originalWorkspaceId === undefined) {
      delete process.env.ORCA_WORKSPACE_ID
    } else {
      process.env.ORCA_WORKSPACE_ID = originalWorkspaceId
    }
    if (originalWorktreeId === undefined) {
      delete process.env.ORCA_WORKTREE_ID
    } else {
      process.env.ORCA_WORKTREE_ID = originalWorktreeId
    }
  })
}
