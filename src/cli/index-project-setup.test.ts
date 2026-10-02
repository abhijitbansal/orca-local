import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const {
  callMock,
  runtimeClientConstructorMock,
  serveOrcaAppMock,
  getDefaultUserDataPathMock,
  spawnMock
} = vi.hoisted(() => ({
  callMock: vi.fn(),
  runtimeClientConstructorMock: vi.fn(),
  serveOrcaAppMock: vi.fn(),
  getDefaultUserDataPathMock: vi.fn(() => '/tmp/orca-user-data'),
  spawnMock: vi.fn()
}))

vi.mock('./runtime-client', async () => {
  const { createRuntimeClientModuleMock } = await import('./index-test-harness.js')
  return createRuntimeClientModuleMock({
    callMock,
    runtimeClientConstructorMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock
  })
})

vi.mock('child_process', async () => {
  const { createChildProcessModuleMock } = await import('./index-test-harness.js')
  return createChildProcessModuleMock(spawnMock)
})

import { main } from './index'
import { okFixture, queueFixtures } from './test-fixtures'
import { useWorktreeAwarenessEnvironment } from './index-test-harness'

describe('orca cli worktree awareness', () => {
  useWorktreeAwarenessEnvironment({
    callMock,
    serveOrcaAppMock,
    getDefaultUserDataPathMock,
    spawnMock
  })

  it('resolves repo.add paths against the invoking cli cwd', async () => {
    queueFixtures(
      callMock,
      okFixture('req_repo_add', {
        repo: {
          id: 'repo-1',
          path: path.resolve('/tmp/repo/apps/web'),
          displayName: 'web'
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['repo', 'add', '--path', './apps/web', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('repo.add', {
      path: path.resolve('/tmp/repo/apps/web')
    })
  })

  it('lists projects through the project-first runtime API', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project_list', {
        projects: [
          {
            id: 'github:stablyai/orca',
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            providerIdentity: {
              provider: 'github',
              owner: 'stablyai',
              repo: 'orca'
            },
            sourceRepoIds: ['repo-1'],
            createdAt: 1,
            updatedAt: 1
          }
        ]
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['project', 'list', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('project.list')
  })

  // Why: ssh: was never validated, so an unknown target answered ok:true with an empty list —
  // the same silent wrong-machine answer unknown runtime ids used to give.
  it('rejects an unknown ssh host instead of answering empty', async () => {
    queueFixtures(callMock, okFixture('req_ssh_targets', { targets: [] }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(['project', 'setups', '--host', 'ssh:openclaw', '--json'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalledWith('projectHostSetup.list')
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
      'no SSH target named or with id openclaw'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })

  it('resolves an ssh label to its target id before filtering', async () => {
    queueFixtures(
      callMock,
      okFixture('req_ssh_targets', { targets: [{ id: 'ssh-123-abc', label: 'openclaw' }] }),
      okFixture('req_project_setups', {
        setups: [
          {
            id: 'setup-openclaw',
            projectId: 'github:stablyai/orca',
            hostId: 'ssh:ssh-123-abc',
            repoId: 'repo-openclaw',
            path: '/home/me/orca',
            displayName: 'Orca',
            setupState: 'ready',
            setupMethod: 'legacy-repo',
            createdAt: 1,
            updatedAt: 1
          }
        ]
      })
    )
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['project', 'setups', '--host', 'ssh:openclaw'], '/tmp/repo')

    expect(logSpy.mock.calls[0]?.[0]).toContain('setup-openclaw')
  })

  it('rejects a malformed --host value before contacting any runtime', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(['project', 'setups', '--host', 'runtime:', '--json'], '/tmp/repo')

    expect(callMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
      'Invalid --host value: runtime:'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })

  it('sets up an existing project folder with a path resolved against the local cli cwd', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project_setup', {
        result: {
          project: {
            id: 'github:stablyai/orca',
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            sourceRepoIds: ['repo-1'],
            createdAt: 1,
            updatedAt: 1
          },
          setup: {
            id: 'setup-local',
            projectId: 'github:stablyai/orca',
            hostId: 'local',
            repoId: 'repo-1',
            path: path.resolve('/tmp/orca'),
            displayName: 'Orca',
            setupState: 'ready',
            setupMethod: 'imported-existing-folder',
            createdAt: 1,
            updatedAt: 1
          },
          repo: {
            id: 'repo-1',
            path: path.resolve('/tmp/orca'),
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            addedAt: 1
          }
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'project',
        'setup-existing-folder',
        '--project',
        'github:stablyai/orca',
        '--host',
        'local',
        '--path',
        '..',
        '--kind',
        'git',
        '--display-name',
        'Orca',
        '--json'
      ],
      '/tmp/orca/worktrees/feature'
    )

    expect(callMock).toHaveBeenCalledWith('projectHostSetup.setupExistingFolder', {
      projectId: 'github:stablyai/orca',
      hostId: 'local',
      path: path.resolve('/tmp/orca/worktrees'),
      kind: 'git',
      displayName: 'Orca'
    })
  })

  it('rejects SSH project setup relative paths, which name the client filesystem', async () => {
    // A local CLI reaching an `ssh:*` host is still off-client: resolving `./orca` against the
    // CLI cwd would register a path that exists on the wrong machine.
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const priorExitCode = process.exitCode

    await main(
      [
        'project',
        'setup-existing-folder',
        '--project',
        'github:stablyai/orca',
        '--host',
        'ssh:openclaw',
        '--path',
        './orca',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).not.toHaveBeenCalled()
    expect([...logSpy.mock.calls, ...errSpy.mock.calls].flat().join('\n')).toContain(
      'Remote project setup requires --path to be an absolute path on the remote server.'
    )
    expect(process.exitCode).toBe(1)

    process.exitCode = priorExitCode
  })

  it('updates project host setup metadata through the project-first runtime API', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project_setup_update', {
        result: {
          project: {
            id: 'github:stablyai/orca',
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            sourceRepoIds: [],
            createdAt: 1,
            updatedAt: 1
          },
          setup: {
            id: 'setup-gpu',
            projectId: 'github:stablyai/orca',
            hostId: 'runtime:gpu',
            repoId: '',
            path: '/srv/orca',
            displayName: 'GPU VM',
            setupState: 'ready',
            setupMethod: 'imported-existing-folder',
            createdAt: 1,
            updatedAt: 2
          }
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'project',
        'setup-update',
        '--setup',
        'setup-gpu',
        '--display-name',
        'GPU VM',
        '--path',
        '/srv/orca',
        '--worktree-base-path',
        '../worktrees',
        '--state',
        'ready',
        '--method',
        'imported-existing-folder',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('projectHostSetup.update', {
      setupId: 'setup-gpu',
      updates: {
        displayName: 'GPU VM',
        path: path.resolve('/tmp/repo', '/srv/orca'),
        worktreeBasePath: '../worktrees',
        gitUsername: undefined,
        kind: undefined,
        setupState: 'ready',
        setupMethod: 'imported-existing-folder'
      }
    })
  })

  it('creates independent project host setup metadata through the project-first runtime API', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project_setup_create', {
        result: {
          project: {
            id: 'github:stablyai/orca',
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            sourceRepoIds: [],
            createdAt: 1,
            updatedAt: 1
          },
          setup: {
            id: 'setup-gpu',
            projectId: 'github:stablyai/orca',
            hostId: 'local',
            repoId: '',
            path: '',
            displayName: 'GPU VM',
            setupState: 'setting-up',
            setupMethod: 'provisioned',
            createdAt: 1,
            updatedAt: 2
          }
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(
      [
        'project',
        'setup-create',
        '--project',
        'github:stablyai/orca',
        '--host',
        'local',
        '--setup-id',
        'setup-gpu',
        '--display-name',
        'GPU VM',
        '--state',
        'setting-up',
        '--method',
        'provisioned',
        '--json'
      ],
      '/tmp/repo'
    )

    expect(callMock).toHaveBeenCalledWith('projectHostSetup.create', {
      projectId: 'github:stablyai/orca',
      hostId: 'local',
      setupId: 'setup-gpu',
      path: undefined,
      kind: undefined,
      displayName: 'GPU VM',
      worktreeBasePath: undefined,
      gitUsername: undefined,
      setupState: 'setting-up',
      setupMethod: 'provisioned'
    })
  })

  it('deletes project host setup metadata through the project-first runtime API', async () => {
    queueFixtures(
      callMock,
      okFixture('req_project_setup_delete', {
        result: {
          project: {
            id: 'github:stablyai/orca',
            displayName: 'Orca',
            badgeColor: '#7c3aed',
            sourceRepoIds: [],
            createdAt: 1,
            updatedAt: 1
          },
          setup: {
            id: 'setup-gpu',
            projectId: 'github:stablyai/orca',
            hostId: 'runtime:gpu',
            repoId: '',
            path: '/srv/orca',
            displayName: 'GPU VM',
            setupState: 'ready',
            setupMethod: 'imported-existing-folder',
            createdAt: 1,
            updatedAt: 2
          }
        }
      })
    )
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await main(['project', 'setup-delete', '--setup', 'setup-gpu', '--json'], '/tmp/repo')

    expect(callMock).toHaveBeenCalledWith('projectHostSetup.delete', {
      setupId: 'setup-gpu'
    })
  })
})
