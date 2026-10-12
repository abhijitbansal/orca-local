import { describe, expect, it } from 'vitest'
import {
  listRuntimeFiles,
  runtimePathExists,
  searchRuntimeFilePaths,
  searchRuntimeFiles
} from './runtime-file-client'
import {
  fsStat,
  fsPathExists,
  fsSearch,
  fsListFiles,
  runtimeEnvironmentCall,
  installRuntimeFileClientEnvironment
} from './runtime-file-client-test-harness'

installRuntimeFileClientEnvironment()

describe('runtime file client', () => {
  it('rejects oversized text search input before local IPC or runtime RPC', async () => {
    const oversizedQuery = 'x'.repeat(9 * 1024)

    await expect(
      searchRuntimeFiles(
        {
          target: { kind: 'environment' as const, environmentId: 'env-1' },
          worktreeId: 'wt-1',
          worktreePath: '/remote/repo'
        },
        {
          query: oversizedQuery,
          rootPath: '/remote/repo',
          maxResults: 50
        }
      )
    ).resolves.toEqual({ files: [], totalMatches: 0, truncated: false })

    await expect(
      searchRuntimeFiles(
        {
          target: { kind: 'local' as const },
          worktreeId: 'wt-1',
          worktreePath: '/repo',
          connectionId: 'ssh-1'
        },
        {
          query: 'needle',
          rootPath: '/repo',
          includePattern: 'secret-token-value'.repeat(1024),
          maxResults: 50
        }
      )
    ).resolves.toEqual({ files: [], totalMatches: 0, truncated: false })

    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
    expect(fsSearch).not.toHaveBeenCalled()
  })

  it('routes bounded quick-open queries through an SSH-owned workspace', async () => {
    fsListFiles.mockResolvedValue(['src/target.ts', 'lib/target.ts', 'extra/target.ts'])

    await expect(
      searchRuntimeFilePaths(
        {
          target: { kind: 'local' as const },
          worktreeId: 'wt-1',
          worktreePath: '/remote/repo',
          connectionId: 'ssh-1'
        },
        {
          query: 'target',
          limit: 2,
          excludePaths: ['/remote/repo/nested'],
          requestToken: 'quick-open-ssh-1'
        }
      )
    ).resolves.toEqual({
      files: ['src/target.ts', 'lib/target.ts'],
      truncated: true
    })

    expect(fsListFiles).toHaveBeenCalledWith({
      rootPath: '/remote/repo',
      connectionId: 'ssh-1',
      excludePaths: ['/remote/repo/nested'],
      requestToken: 'quick-open-ssh-1',
      maxResults: 3,
      searchQuery: 'target'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('passes the cancellation token through the IPC file listing path (#7721)', async () => {
    fsListFiles.mockResolvedValue(['src/index.ts'])

    await expect(
      listRuntimeFiles(
        {
          target: { kind: 'local' as const },
          worktreeId: 'wt-1',
          worktreePath: '/remote/repo',
          connectionId: 'ssh-1'
        },
        {
          rootPath: '/remote/repo',
          requestToken: 'token-1'
        }
      )
    ).resolves.toEqual(['src/index.ts'])

    expect(fsListFiles).toHaveBeenCalledWith({
      rootPath: '/remote/repo',
      connectionId: 'ssh-1',
      excludePaths: undefined,
      requestToken: 'token-1'
    })
  })

  it('sends the Explorer name filter to local listings only', async () => {
    fsListFiles.mockResolvedValue([])
    const local = { target: { kind: 'local' as const }, worktreeId: 'wt-1', worktreePath: '/repo' }

    await listRuntimeFiles(local, { rootPath: '/repo', nameFilter: 'AppDelegate' })
    await listRuntimeFiles(
      { ...local, connectionId: 'ssh-1' },
      { rootPath: '/repo', nameFilter: 'AppDelegate' }
    )

    expect(fsListFiles.mock.calls[0][0]).toMatchObject({ nameFilter: 'AppDelegate' })
    expect(fsListFiles.mock.calls[1][0]).not.toHaveProperty('nameFilter')
  })

  it('uses quiet local path existence checks when no runtime environment is active', async () => {
    fsPathExists.mockResolvedValueOnce(false)

    await expect(
      runtimePathExists(
        {
          target: { kind: 'local' as const },
          worktreeId: 'wt-1',
          worktreePath: '/repo',
          connectionId: 'ssh-1'
        },
        '/repo/untitled.md'
      )
    ).resolves.toBe(false)

    expect(fsPathExists).toHaveBeenCalledWith({
      filePath: '/repo/untitled.md',
      connectionId: 'ssh-1'
    })
    expect(fsStat).not.toHaveBeenCalled()
  })
})

it.each([{ includeIgnored: false }, { followSymlinks: true }])(
  'rejects unsupported listing options on a version-one host: %o',
  async (options) => {
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-options',
      ok: true,
      result: { files: [], quickOpenSearchVersion: 1 },
      _meta: { runtimeId: 'remote-runtime' }
    })
    const context = {
      target: { kind: 'environment' as const, environmentId: 'env-1' },
      worktreeId: 'options-workspace',
      worktreePath: '/remote/repo'
    }
    await expect(
      searchRuntimeFilePaths(context, { query: '.env api', ...options })
    ).rejects.toThrow('Remote Orca runtimes are unsupported')
    await expect(
      listRuntimeFiles(context, { rootPath: '/remote/repo', ...options })
    ).rejects.toThrow('Remote Orca runtimes are unsupported')
    expect(
      runtimeEnvironmentCall.mock.calls.every(([request]) => request.method === 'files.searchPaths')
    ).toBe(true)
    expect(fsListFiles).not.toHaveBeenCalled()
  }
)
