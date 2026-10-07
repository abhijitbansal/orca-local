import { describe, expect, it } from 'vitest'
import { importExternalPathsToRuntime } from './runtime-file-client'
import {
  fsImportExternalPaths,
  runtimeEnvironmentCall,
  installRuntimeFileClientEnvironment
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

/** The upload request main receives; `never[]` mock args widen to it without a cast. */
describe('runtime file client', () => {
  it('keeps local external imports on filesystem IPC when no runtime is active', async () => {
    fsImportExternalPaths.mockResolvedValue({
      results: [
        {
          sourcePath: '/Users/me/readme.md',
          status: 'imported',
          destPath: '/repo/readme.md',
          kind: 'file',
          renamed: false
        }
      ]
    })

    await importExternalPathsToRuntime(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1',
        expectedSshTargetId: 'ssh-1',
        expectedSshConnectionGeneration: 5
      },
      ['/Users/me/readme.md'],
      '/repo',
      { ensureDestinationDir: true }
    )

    expect(fsImportExternalPaths).toHaveBeenCalledWith({
      sourcePaths: ['/Users/me/readme.md'],
      destDir: '/repo',
      connectionId: 'ssh-1',
      expectedExecutionHostId: 'ssh:ssh-1',
      ensureDir: true,
      expectedSshTargetId: 'ssh-1',
      expectedSshConnectionGeneration: 5
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})
