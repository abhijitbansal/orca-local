import { describe, expect, it, vi } from 'vitest'
import {
  OrcaRuntimeService,
  getBaseRefDefault,
  gitRunner,
  listWorktrees,
  parseOrcaYaml,
  registerSshFilesystemProvider,
  registerSshGitProvider,
  setPlatform,
  unregisterSshFilesystemProvider,
  unregisterSshGitProvider
} from '../orca-runtime-test-mocks.spec'
import {
  TEST_REPO_ID,
  TEST_REPO_PATH,
  TEST_WORKTREE_ID,
  TEST_WORKTREE_PATH,
  isOriginMainBaseRefProbe,
  store
} from '../orca-runtime-test-fixtures.spec'

describe('OrcaRuntimeService', () => {
  describe('checkRepoHooks status', () => {
    const remoteStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: '/remote/repo',
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ]
    }

    it('reports an error when the SSH filesystem provider is unavailable', async () => {
      const runtime = new OrcaRuntimeService(remoteStore as never)

      await expect(runtime.checkRepoHooks('id:repo-1')).resolves.toEqual({
        status: 'error',
        hasHooks: false,
        hooks: null,
        mayNeedUpdate: false
      })
    })

    it('reports ok for a missing remote orca.yaml and error for any other read failure', async () => {
      const readFile = vi.fn()
      registerSshFilesystemProvider('ssh-1', { readFile } as never)
      const runtime = new OrcaRuntimeService(remoteStore as never)

      try {
        readFile.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }))
        await expect(runtime.checkRepoHooks('id:repo-1')).resolves.toMatchObject({
          status: 'ok',
          hasHooks: false
        })

        readFile.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'ECONNRESET' }))
        await expect(runtime.checkRepoHooks('id:repo-1')).resolves.toMatchObject({
          status: 'error',
          hasHooks: false
        })
      } finally {
        unregisterSshFilesystemProvider('ssh-1')
      }
    })

    it('reports ok for a local repo hook check', async () => {
      const runtime = new OrcaRuntimeService(store as never)

      await expect(runtime.checkRepoHooks('id:repo-1')).resolves.toMatchObject({ status: 'ok' })
    })
  })

  it('resolves SSH issue commands from shared orca.yaml and deletes empty overrides', async () => {
    const remoteStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: '/remote/repo',
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ]
    }
    vi.mocked(parseOrcaYaml).mockReturnValue({
      scripts: {},
      issueCommand: 'claude -p "Fix #{{issue}}"'
    })
    const fsProvider = {
      readFile: vi.fn(async (filePath: string) => {
        if (filePath.endsWith('.orca/issue-command')) {
          throw Object.assign(new Error('missing'), { code: 'ENOENT' })
        }
        if (filePath.endsWith('orca.yaml')) {
          return { content: 'issueCommand: claude -p "Fix #{{issue}}"', isBinary: false }
        }
        return { content: '', isBinary: false }
      }),
      writeFile: vi.fn().mockResolvedValue(undefined),
      createDir: vi.fn().mockResolvedValue(undefined),
      deletePath: vi.fn().mockResolvedValue(undefined)
    }
    registerSshFilesystemProvider('ssh-1', fsProvider as never)
    const runtime = new OrcaRuntimeService(remoteStore as never)

    try {
      await expect(runtime.readRepoIssueCommand('id:repo-1')).resolves.toMatchObject({
        localContent: null,
        sharedContent: 'claude -p "Fix #{{issue}}"',
        effectiveContent: 'claude -p "Fix #{{issue}}"',
        localFilePath: '/remote/repo/.orca/issue-command',
        source: 'shared'
      })
      await expect(runtime.writeRepoIssueCommand('id:repo-1', '   ')).resolves.toEqual({
        ok: true
      })
    } finally {
      unregisterSshFilesystemProvider('ssh-1')
    }

    expect(fsProvider.readFile).toHaveBeenCalledWith('/remote/repo/orca.yaml')
    expect(fsProvider.deletePath).toHaveBeenCalledWith('/remote/repo/.orca/issue-command', false)
    expect(fsProvider.writeFile).not.toHaveBeenCalledWith(
      '/remote/repo/.orca/issue-command',
      expect.anything()
    )
  })

  it('treats SSH worktree drift as unknown without local git probes', async () => {
    vi.mocked(listWorktrees).mockClear()
    vi.mocked(getBaseRefDefault).mockClear()
    const remoteStore = {
      ...store,
      getRepos: () => [
        {
          id: TEST_REPO_ID,
          path: '/remote/repo',
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          connectionId: 'ssh-1'
        }
      ],
      getWorktreeMeta: () => null
    }
    const gitProvider = {
      listWorktrees: vi.fn().mockResolvedValue([
        {
          path: '/remote/repo',
          head: 'abc',
          branch: 'feature/foo',
          isBare: false,
          isMainWorktree: true
        }
      ])
    }
    registerSshGitProvider('ssh-1', gitProvider as never)
    const runtime = new OrcaRuntimeService(remoteStore as never)

    try {
      await expect(runtime.probeWorktreeDrift('path:/remote/repo')).resolves.toBeNull()
    } finally {
      unregisterSshGitProvider('ssh-1')
    }

    expect(gitProvider.listWorktrees).toHaveBeenCalledWith('/remote/repo')
    expect(getBaseRefDefault).not.toHaveBeenCalled()
    expect(listWorktrees).not.toHaveBeenCalled()
  })

  it('routes local WSL project worktree drift probes through runtime git options', async () => {
    setPlatform('win32')
    const runtimeStore = {
      ...store,
      getProjects: () => [
        {
          id: 'project-1',
          displayName: 'repo',
          badgeColor: 'blue',
          sourceRepoIds: [TEST_REPO_ID],
          localWindowsRuntimePreference: { kind: 'wsl', distro: 'Ubuntu' },
          createdAt: 0,
          updatedAt: 0
        }
      ],
      getSettings: () => ({
        ...store.getSettings(),
        localWindowsRuntimeDefault: { kind: 'windows-host' }
      })
    }
    const runtime = new OrcaRuntimeService(runtimeStore as never)
    const wslGitOptions = { cwd: TEST_REPO_PATH, wslDistro: 'Ubuntu' }
    let driftCounts = '1\t2\n'
    const asyncGitSpy = vi.spyOn(gitRunner, 'gitExecFileAsync').mockImplementation(async (args) => {
      if (args[0] === 'symbolic-ref') {
        return { stdout: 'refs/remotes/origin/main\n', stderr: '' }
      }
      if (isOriginMainBaseRefProbe(args)) {
        return { stdout: 'main-sha\n', stderr: '' }
      }
      if (args[0] === 'remote') {
        return { stdout: 'origin\n', stderr: '' }
      }
      if (args[0] === 'rev-parse' && args.includes('--git-common-dir')) {
        return { stdout: `${TEST_REPO_PATH}/.git\n`, stderr: '' }
      }
      if (args[0] === 'fetch') {
        return { stdout: '', stderr: '' }
      }
      if (args[0] === 'rev-list') {
        return { stdout: driftCounts, stderr: '' }
      }
      if (args[0] === 'log') {
        return { stdout: 'base commit 2\nbase commit 1\n', stderr: '' }
      }
      throw new Error(`unexpected git call: ${args.join(' ')}`)
    })

    try {
      const result = await runtime.probeWorktreeDrift(`id:${TEST_WORKTREE_ID}`)

      expect(result).toEqual({
        base: 'origin/main',
        behind: 2,
        recentSubjects: ['base commit 2', 'base commit 1']
      })
      expect(asyncGitSpy).toHaveBeenCalledWith(
        ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'],
        { ...wslGitOptions, timeout: 15_000 }
      )
      expect(asyncGitSpy).toHaveBeenCalledWith(['remote'], wslGitOptions)
      expect(asyncGitSpy).toHaveBeenCalledWith(
        ['rev-parse', '--path-format=absolute', '--git-common-dir'],
        wslGitOptions
      )
      expect(asyncGitSpy).toHaveBeenCalledWith(['fetch', 'origin'], {
        ...wslGitOptions,
        timeout: 60_000
      })
      expect(asyncGitSpy).toHaveBeenCalledWith(
        ['rev-list', '--left-right', '--count', 'HEAD...origin/main'],
        { cwd: TEST_WORKTREE_PATH, wslDistro: 'Ubuntu', timeout: 15_000 }
      )
      expect(asyncGitSpy).toHaveBeenCalledWith(
        ['log', '--format=%s', '-n', '5', 'HEAD..origin/main'],
        { cwd: TEST_WORKTREE_PATH, wslDistro: 'Ubuntu', timeout: 15_000 }
      )

      driftCounts = '3\t0\n'
      asyncGitSpy.mockClear()

      await expect(runtime.probeWorktreeDrift(`id:${TEST_WORKTREE_ID}`)).resolves.toEqual({
        base: 'origin/main',
        behind: 0,
        recentSubjects: []
      })
      expect(asyncGitSpy).toHaveBeenCalledWith(
        ['rev-list', '--left-right', '--count', 'HEAD...origin/main'],
        { cwd: TEST_WORKTREE_PATH, wslDistro: 'Ubuntu', timeout: 15_000 }
      )
      expect(asyncGitSpy.mock.calls.some(([args]) => args[0] === 'log')).toBe(false)
    } finally {
      asyncGitSpy.mockRestore()
    }
  })
})
