import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as WindowsPathAccessHost from '../windows-path-access-host'
import type * as ExternalEditorLaunch from '../external-editor-launch'

const { handleMock, launchMock, showItemInFolderMock, statMock, recordForEnvironmentMock } =
  vi.hoisted(() => ({
    handleMock: vi.fn<(channel: string, handler: (...args: unknown[]) => unknown) => void>(),
    launchMock: vi.fn(),
    showItemInFolderMock: vi.fn(),
    statMock: vi.fn(),
    recordForEnvironmentMock: vi.fn()
  }))

vi.mock('electron', () => ({
  ipcMain: { handle: handleMock },
  shell: { showItemInFolder: showItemInFolderMock, openExternal: vi.fn(), openPath: vi.fn() },
  dialog: { showOpenDialog: vi.fn() }
}))

vi.mock('node:fs/promises', () => ({
  constants: { COPYFILE_EXCL: 1 },
  copyFile: vi.fn(),
  readFile: vi.fn(),
  stat: statMock
}))

vi.mock('../codex-cli/command', () => ({
  resolveCliCommand: (command: string) => command
}))

vi.mock('../wsl/wsl-host-service-instance', () => ({
  getWslHostService: () => ({ recordForEnvironment: recordForEnvironmentMock })
}))

// WSL paths require Windows resolution even when this test runs on another platform.
vi.mock('../windows-path-access-host', async (importOriginal) => {
  const actual = await importOriginal<typeof WindowsPathAccessHost>()
  return {
    resolveWindowsPathAccess: (owner: unknown) => actual.resolveWindowsPathAccess(owner, 'win32')
  }
})

vi.mock('../external-editor-launch', async (importOriginal) => {
  const actual = await importOriginal<typeof ExternalEditorLaunch>()
  return {
    ...actual,
    launchExternalEditor: launchMock,
    resolveExternalEditorLaunchSpec: (command: string | undefined, path: string) =>
      actual.resolveExternalEditorLaunchSpec(command, path, {
        platform: 'win32',
        fileExists: () => false
      })
  }
})

import { registerShellHandlers } from './shell'
import { toRuntimeExecutionHostId } from '../../shared/execution-host'

const WSL_OWNER = toRuntimeExecutionHostId('wsl:Ubuntu')

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  registerShellHandlers({ getSshTarget: () => undefined })
  const handler = handleMock.mock.calls.find(([name]) => name === channel)?.[1]
  if (!handler) {
    throw new Error(`${channel} handler not registered`)
  }
  return async (...args) => handler(...args)
}

describe('shell handlers for a WSL-owned path', () => {
  beforeEach(() => {
    handleMock.mockReset()
    launchMock.mockReset().mockResolvedValue(undefined)
    showItemInFolderMock.mockReset()
    statMock.mockReset().mockResolvedValue({ isDirectory: () => true })
    recordForEnvironmentMock
      .mockReset()
      .mockImplementation((id: string) => (id === 'wsl:Ubuntu' ? { distro: 'Ubuntu' } : null))
  })

  it('still refuses a paired server that is not a WSL host', async () => {
    const owner = toRuntimeExecutionHostId('paired-server')
    await expect(getHandler('shell:openInFileManager')({}, '/srv', owner)).resolves.toEqual({
      ok: false,
      reason: 'remote-runtime-unsupported'
    })
    await expect(
      getHandler('shell:openInExternalEditor')({}, { path: '/srv', ownerHostId: owner })
    ).resolves.toEqual({ ok: false, reason: 'remote-runtime-unsupported' })
    expect(statMock).not.toHaveBeenCalled()
    expect(launchMock).not.toHaveBeenCalled()
  })

  it('keeps opening with the system default refused for a WSL owner', async () => {
    await expect(getHandler('shell:openFilePath')({}, '/home/me/a.txt', WSL_OWNER)).resolves.toBe(
      false
    )
    expect(statMock).not.toHaveBeenCalled()
  })
})
