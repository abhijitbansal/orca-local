import { describe, expect, it, vi } from 'vitest'
import {
  deleteRuntimePath,
  readRuntimeDirectory,
  readRuntimeFileContent,
  renameRuntimePath,
  writeRuntimeFile
} from './runtime-file-client'
import { getRuntimeGitDiff, getRuntimeGitStatus } from './runtime-git-client'
import {
  inspectRuntimeTerminalProcess,
  sendRuntimePtyInputVerified
} from './runtime-terminal-inspection'
import { toRemoteRuntimePtyId } from '../../../shared/remote-runtime-pty-id'
import {
  fsDeletePath,
  fsReadFile,
  fsRename,
  fsWriteFile,
  installRuntimeFileClientEnvironment,
  runtimeCall
} from './runtime-file-client-test-harness'

// Why: a legacy runtime:-owned item must reject, never run its operation against the local disk.
installRuntimeFileClientEnvironment()

const OWNER_SETTINGS = { activeRuntimeEnvironmentId: 'legacy-env' }
const UNSUPPORTED = { code: 'unsupported_in_local_build' }
const fileContext = {
  settings: OWNER_SETTINGS,
  worktreeId: 'wt-1',
  worktreePath: '/remote/repo'
}
const gitContext = { settings: OWNER_SETTINGS, worktreeId: 'wt-1', worktreePath: '/remote/repo' }

describe('runtime-owned operations fail closed in the local-only build', () => {
  it('rejects a runtime-owned file write without writing the local disk', async () => {
    await expect(writeRuntimeFile(fileContext, '/remote/repo/a.ts', 'x')).rejects.toMatchObject(
      UNSUPPORTED
    )
    expect(fsWriteFile).not.toHaveBeenCalled()
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('rejects a runtime-owned file read without reading the local disk', async () => {
    await expect(
      readRuntimeFileContent({
        settings: OWNER_SETTINGS,
        filePath: '/remote/repo/a.ts',
        relativePath: 'a.ts',
        worktreeId: 'wt-1'
      })
    ).rejects.toMatchObject(UNSUPPORTED)
    expect(fsReadFile).not.toHaveBeenCalled()
  })

  it('rejects a runtime-owned delete and rename without touching the local disk', async () => {
    await expect(deleteRuntimePath(fileContext, '/remote/repo/a.ts')).rejects.toMatchObject(
      UNSUPPORTED
    )
    await expect(
      renameRuntimePath(fileContext, '/remote/repo/a.ts', '/remote/repo/b.ts')
    ).rejects.toMatchObject(UNSUPPORTED)
    expect(fsDeletePath).not.toHaveBeenCalled()
    expect(fsRename).not.toHaveBeenCalled()
  })

  it('rejects a runtime-owned directory read', async () => {
    await expect(readRuntimeDirectory(fileContext, '/remote/repo')).rejects.toMatchObject(
      UNSUPPORTED
    )
    expect(runtimeCall).not.toHaveBeenCalled()
  })

  it('rejects runtime-owned git status and diff without running local git', async () => {
    const gitStatus = vi.fn()
    const gitDiff = vi.fn()
    vi.stubGlobal('window', { api: { git: { status: gitStatus, diff: gitDiff } } })

    await expect(getRuntimeGitStatus(gitContext)).rejects.toMatchObject(UNSUPPORTED)
    await expect(
      getRuntimeGitDiff(gitContext, { filePath: 'a.ts', staged: false })
    ).rejects.toMatchObject(UNSUPPORTED)
    expect(gitStatus).not.toHaveBeenCalled()
    expect(gitDiff).not.toHaveBeenCalled()
  })

  it('rejects a runtime-owned terminal pty without touching the local pty bridge', async () => {
    const pty = { inspectProcess: vi.fn(), write: vi.fn(), writeAccepted: vi.fn() }
    vi.stubGlobal('window', { api: { pty } })
    const ptyId = toRemoteRuntimePtyId('terminal-1', 'legacy-env')

    await expect(inspectRuntimeTerminalProcess(null, ptyId)).rejects.toMatchObject(UNSUPPORTED)
    await expect(sendRuntimePtyInputVerified(null, ptyId, 'ls\n', 'driving')).rejects.toMatchObject(
      UNSUPPORTED
    )
    expect(pty.inspectProcess).not.toHaveBeenCalled()
    expect(pty.writeAccepted).not.toHaveBeenCalled()
    expect(pty.write).not.toHaveBeenCalled()
  })
})
