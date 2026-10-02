import { describe, expect, it } from 'vitest'
import {
  deleteRuntimePath,
  readRuntimeFileContent,
  readRuntimeFilePreview,
  renameRuntimePath,
  writeRuntimeFile,
  type RuntimeReadableFileContent
} from './runtime-file-client'
import {
  fsReadFile,
  fsWriteFile,
  fsRename,
  fsDeletePath,
  runtimeEnvironmentCall,
  installRuntimeFileClientEnvironment
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

describe('runtime file client', () => {
  it('uses local filesystem reads when no remote runtime is active', async () => {
    const localResult: RuntimeReadableFileContent = { content: 'hello', isBinary: false }
    fsReadFile.mockResolvedValue(localResult)

    await expect(
      readRuntimeFileContent({
        settings: { activeRuntimeEnvironmentId: null },
        filePath: '/repo/readme.md',
        relativePath: 'readme.md',
        worktreeId: 'wt-1',
        connectionId: 'ssh-1'
      })
    ).resolves.toBe(localResult)

    expect(fsReadFile).toHaveBeenCalledWith({ filePath: '/repo/readme.md', connectionId: 'ssh-1' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('reads an external SSH file only from its owning target', async () => {
    const sshResult: RuntimeReadableFileContent = { content: 'remote', isBinary: false }
    fsReadFile.mockResolvedValue(sshResult)

    await expect(
      readRuntimeFileContent({
        settings: { activeRuntimeEnvironmentId: null },
        filePath: '/tmp/external.md',
        relativePath: '/tmp/external.md',
        worktreeId: 'wt-1',
        connectionId: 'ssh-1',
        expectedExternalSshTargetId: 'ssh-1'
      })
    ).resolves.toBe(sshResult)

    expect(fsReadFile).toHaveBeenCalledWith({
      filePath: '/tmp/external.md',
      connectionId: 'ssh-1',
      includeLocalLogMetadata: undefined
    })
  })

  it('rejects an external SSH file read after the target changes', async () => {
    await expect(
      readRuntimeFileContent({
        settings: { activeRuntimeEnvironmentId: null },
        filePath: '/tmp/external.md',
        relativePath: '/tmp/external.md',
        worktreeId: 'wt-1',
        connectionId: 'ssh-2',
        expectedExternalSshTargetId: 'ssh-1'
      })
    ).rejects.toThrow('External SSH files are not available after the workspace host changes.')

    expect(fsReadFile).not.toHaveBeenCalled()
  })

  it('binds direct SSH mutations to the captured target and generation', async () => {
    const context = {
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: 'wt-1',
      worktreePath: '/repo',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1' as const,
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    }

    await writeRuntimeFile(context, '/repo/a.ts', 'a')
    await renameRuntimePath(context, '/repo/a.ts', '/repo/b.ts')
    await deleteRuntimePath(context, '/repo/b.ts')

    expect(fsWriteFile).toHaveBeenCalledWith({
      filePath: '/repo/a.ts',
      content: 'a',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1',
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    })
    expect(fsRename).toHaveBeenCalledWith({
      oldPath: '/repo/a.ts',
      newPath: '/repo/b.ts',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1',
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    })
    expect(fsDeletePath).toHaveBeenCalledWith({
      targetPath: '/repo/b.ts',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1',
      recursive: undefined,
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    })
  })

  it('keeps external absolute-path files on the local filesystem path', async () => {
    const localResult: RuntimeReadableFileContent = { content: 'scratch', isBinary: false }
    fsReadFile.mockResolvedValue(localResult)

    await expect(
      readRuntimeFileContent({
        settings: { activeRuntimeEnvironmentId: 'env-1' },
        filePath: '/Users/me/scratch.md',
        relativePath: '/Users/me/scratch.md'
      })
    ).resolves.toBe(localResult)

    expect(fsReadFile).toHaveBeenCalledWith({
      filePath: '/Users/me/scratch.md',
      connectionId: undefined
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('rejects an external SSH image preview after the target changes', async () => {
    await expect(
      readRuntimeFilePreview(
        {
          settings: { activeRuntimeEnvironmentId: null },
          worktreeId: 'wt-1',
          worktreePath: '/remote/repo',
          connectionId: 'ssh-2',
          expectedExternalSshTargetId: 'ssh-1'
        },
        '/tmp/logo.png'
      )
    ).rejects.toThrow('External SSH files are not available after the workspace host changes.')

    expect(fsReadFile).not.toHaveBeenCalled()
  })
})
