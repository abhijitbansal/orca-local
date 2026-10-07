import { describe, expect, it } from 'vitest'
import { copyRuntimePath } from './runtime-file-client'
import {
  fsCopy,
  runtimeEnvironmentCall,
  installRuntimeFileClientEnvironment
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

describe('runtime file client', () => {
  it('keeps copy operations on local filesystem IPC when no runtime is active', async () => {
    await copyRuntimePath(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      '/repo/a.md',
      '/repo/a copy.md'
    )

    expect(fsCopy).toHaveBeenCalledWith({
      sourcePath: '/repo/a.md',
      destinationPath: '/repo/a copy.md',
      connectionId: undefined,
      expectedExecutionHostId: 'local'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('preserves the SSH connection for copy operations when no runtime is active', async () => {
    await copyRuntimePath(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1',
        expectedSshTargetId: 'ssh-1',
        expectedSshConnectionGeneration: 5
      },
      '/repo/a.md',
      '/repo/a copy.md'
    )

    expect(fsCopy).toHaveBeenCalledWith({
      sourcePath: '/repo/a.md',
      destinationPath: '/repo/a copy.md',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1',
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
