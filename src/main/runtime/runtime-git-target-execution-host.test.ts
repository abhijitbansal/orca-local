// `resolveRuntimeGitTarget` read `store.getRepo(worktree.repoId)?.connectionId` and never looked at
// `worktree.hostId`, so one arbitrarily chosen row decided the execution host for ~36 downstream
// Git dispatches. `undefined` there meant "runtime host", "unresolved" and "genuinely local" at
// once (#11163). These cases pin the answers that remain without a registered SSH provider (none can register in this build).
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp'), isPackaged: false }
}))

import type * as GitStatusModule from '../git/status'

const mocks = vi.hoisted(() => ({ getStatus: vi.fn() }))

vi.mock('../git/status', async () => ({
  ...(await vi.importActual<typeof GitStatusModule>('../git/status')),
  getStatus: mocks.getStatus
}))

import { ExecutionHostNotDispatchableError } from '../providers/execution-host-provider-dispatch'
import { OrcaRuntimeService } from './orca-runtime'

const REMOTE_PATH = '/srv/app-feature'
const WORKTREE_ID = 'repo-shared::/srv/app-feature'

type RuntimeInternals = {
  resolveWorktreeSelector: (selector: string) => Promise<unknown>
}

function makeRuntime(repos: readonly Record<string, unknown>[], hostId?: string) {
  const store = {
    getSettings: () => ({ disabledTuiAgents: [], workspaceDir: '/tmp/workspaces' }),
    getProjectHostSetups: () => [],
    getProjects: () => [],
    getRepos: () => repos,
    getRepo: (id: string) => repos.find((repo) => repo.id === id)
  }
  const runtime = new OrcaRuntimeService(store as never)
  vi.spyOn(runtime as unknown as RuntimeInternals, 'resolveWorktreeSelector').mockResolvedValue({
    id: WORKTREE_ID,
    repoId: 'repo-shared',
    path: REMOTE_PATH,
    git: { path: REMOTE_PATH, branch: 'main', isBare: false, isMainWorktree: false },
    ...(hostId ? { hostId } : {})
  })
  return runtime
}

describe('runtime Git target execution host', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.getStatus.mockReset().mockResolvedValue({ entries: [] })
  })

  // The case whose absence let the original cross-host leak through review: two SSH hosts, and the
  // rival row is the one `getRepo` returns first.
  // `local` has no SSH namespace to nest in, so a surviving `connectionId` is a row contradicting
  // itself. The old shape handed it out and dialled a remote host for a local workspace.
  it('ignores a stale connection on a row that declares itself local', async () => {
    const runtime = makeRuntime(
      [
        {
          id: 'repo-shared',
          path: '/home/me/app',
          executionHostId: 'local',
          connectionId: 'm4air'
        }
      ],
      'local'
    )

    await runtime.getRuntimeGitStatus(`id:${WORKTREE_ID}`)

    expect(mocks.getStatus).toHaveBeenCalled()
  })

  // A `runtime:` row's `connectionId` names a target in the *server's* namespace. Dialling it here
  // reaches a same-named target on this client — a silent-wrong-host answer, worse than the
  // silent-local one it replaced.
  it('refuses a runtime host whose nested ssh target is also registered on this client', async () => {
    const runtime = makeRuntime(
      [
        {
          id: 'repo-shared',
          path: '/srv/app',
          executionHostId: 'runtime:env-a',
          connectionId: 'nested-1'
        }
      ],
      'runtime:env-a'
    )

    await expect(runtime.getRuntimeGitStatus(`id:${WORKTREE_ID}`)).rejects.toThrow(
      ExecutionHostNotDispatchableError
    )
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })

  it('refuses a runtime host with no nested ssh target rather than answering locally', async () => {
    const runtime = makeRuntime(
      [{ id: 'repo-shared', path: '/srv/app', executionHostId: 'runtime:env-a' }],
      'runtime:env-a'
    )

    await expect(runtime.getRuntimeGitStatus(`id:${WORKTREE_ID}`)).rejects.toThrow(
      ExecutionHostNotDispatchableError
    )
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })

  it('refuses rather than guessing when rival rows disagree and the worktree names no host', async () => {
    const runtime = makeRuntime([
      { id: 'repo-shared', path: '/srv/app', connectionId: 'm4air' },
      { id: 'repo-shared', path: '/home/me/app' }
    ])

    await expect(runtime.getRuntimeGitStatus(`id:${WORKTREE_ID}`)).rejects.toThrow(
      'worktree_execution_host_unresolved'
    )
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })

  // Losing contact with a remote host is never evidence that its files are here
  // (docs/reference/ssh-execution-boundary.md).
  it('reports the dropped connection instead of reading a remote path locally', async () => {
    const runtime = makeRuntime(
      [{ id: 'repo-shared', path: '/srv/app', connectionId: 'm4air' }],
      'ssh:m4air'
    )

    await expect(runtime.getRuntimeGitStatus(`id:${WORKTREE_ID}`)).rejects.toThrow(
      /Remote connection dropped/
    )
    expect(mocks.getStatus).not.toHaveBeenCalled()
  })
})
