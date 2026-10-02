import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  generateRuntimeCommitMessage,
  generateRuntimePullRequestFields,
  getRuntimeGitBranchCompare,
  getRuntimeGitDiff,
  getRuntimeGitHistory,
  getRuntimeGitIgnoredPaths,
  getRuntimeGitStatus,
  getRuntimeGitSubmoduleStatus
} from './runtime-git-client'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from './runtime-compatibility-test-fixture'

const gitStatus = vi.fn()
const gitCancelStatus = vi.fn()
const gitCheckIgnored = vi.fn()
const gitSubmoduleStatus = vi.fn()
const gitDiff = vi.fn()
const gitBranchCompare = vi.fn()
const gitHistory = vi.fn()
const gitBulkStage = vi.fn()
const gitBulkDiscard = vi.fn()
const gitCommit = vi.fn()
const gitFetch = vi.fn()
const gitFastForward = vi.fn()
const gitPush = vi.fn()
const gitRebaseFromBase = vi.fn()
const gitGenerateCommitMessage = vi.fn()
const gitGeneratePullRequestFields = vi.fn()
const gitDiscoverCommitMessageModels = vi.fn()
const gitCancelGenerateCommitMessage = vi.fn()
const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()
const runtimeCall = vi.fn()

beforeEach(() => {
  gitStatus.mockReset()
  gitCancelStatus.mockReset()
  gitCancelStatus.mockResolvedValue(undefined)
  gitCheckIgnored.mockReset()
  gitSubmoduleStatus.mockReset()
  gitDiff.mockReset()
  gitBranchCompare.mockReset()
  gitHistory.mockReset()
  gitBulkStage.mockReset()
  gitBulkDiscard.mockReset()
  gitCommit.mockReset()
  gitFetch.mockReset()
  gitFastForward.mockReset()
  gitPush.mockReset()
  gitRebaseFromBase.mockReset()
  gitGenerateCommitMessage.mockReset()
  gitGeneratePullRequestFields.mockReset()
  gitDiscoverCommitMessageModels.mockReset()
  gitCancelGenerateCommitMessage.mockReset()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      git: {
        status: gitStatus,
        cancelStatus: gitCancelStatus,
        checkIgnored: gitCheckIgnored,
        submoduleStatus: gitSubmoduleStatus,
        diff: gitDiff,
        branchCompare: gitBranchCompare,
        history: gitHistory,
        bulkStage: gitBulkStage,
        bulkDiscard: gitBulkDiscard,
        commit: gitCommit,
        fetch: gitFetch,
        fastForward: gitFastForward,
        push: gitPush,
        rebaseFromBase: gitRebaseFromBase,
        generateCommitMessage: gitGenerateCommitMessage,
        generatePullRequestFields: gitGeneratePullRequestFields,
        discoverCommitMessageModels: gitDiscoverCommitMessageModels,
        cancelGenerateCommitMessage: gitCancelGenerateCommitMessage
      },
      runtime: { call: runtimeCall },
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('runtime git client', () => {
  it('preserves branch-compare admission through local IPC', async () => {
    gitBranchCompare.mockResolvedValue({ summary: {}, entries: [] })

    await getRuntimeGitBranchCompare(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1'
      },
      'origin/main',
      'background'
    )

    expect(gitBranchCompare).toHaveBeenCalledWith({
      worktreePath: '/repo',
      baseRef: 'origin/main',
      connectionId: 'ssh-1',
      admissionTier: 'background'
    })
  })

  it('uses local git IPC when no remote runtime is active', async () => {
    gitStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })

    await getRuntimeGitStatus({
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: 'wt-1',
      worktreePath: '/repo',
      connectionId: 'ssh-1'
    })

    expect(gitStatus).toHaveBeenCalledWith({ worktreePath: '/repo', connectionId: 'ssh-1' })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('uses the backing folder path for local folder-workspace status', async () => {
    gitStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'

    await getRuntimeGitStatus({
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: `folder-repo::/home/user::workspace:${workspaceId}`,
      worktreePath: `/home/user::workspace:${workspaceId}`
    })

    expect(gitStatus).toHaveBeenCalledWith({
      worktreePath: '/home/user',
      connectionId: undefined
    })
  })

  it('uses the backing folder path for other local folder-workspace git ops', async () => {
    // Why: status is not the only command run as a subprocess cwd. Every local
    // op (diff, submodule status, upstream, stage, …) must strip the synthetic
    // `::workspace:<uuid>` suffix or Git spawns against a nonexistent directory.
    gitDiff.mockResolvedValue({ hunks: [] })
    gitSubmoduleStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'
    const context = {
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: `folder-repo::/home/user::workspace:${workspaceId}`,
      worktreePath: `/home/user::workspace:${workspaceId}`
    }

    await getRuntimeGitDiff(context, { filePath: 'a.ts', staged: false })
    await getRuntimeGitSubmoduleStatus(context, 'sub')

    expect(gitDiff).toHaveBeenCalledWith(expect.objectContaining({ worktreePath: '/home/user' }))
    expect(gitSubmoduleStatus).toHaveBeenCalledWith(
      expect.objectContaining({ worktreePath: '/home/user' })
    )
  })

  it('forwards includeIgnored to local git status only when enabled', async () => {
    gitStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })

    await getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { includeIgnored: true }
    )
    await getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { includeIgnored: false }
    )

    expect(gitStatus).toHaveBeenNthCalledWith(1, {
      worktreePath: '/repo',
      connectionId: undefined,
      includeIgnored: true
    })
    expect(gitStatus).toHaveBeenNthCalledWith(2, {
      worktreePath: '/repo',
      connectionId: undefined
    })
  })

  it('forwards a false line-stats request and accepts stats from an older local host', async () => {
    const oldHostResult = {
      entries: [{ path: 'src/a.ts', status: 'modified', area: 'unstaged', added: 3, removed: 2 }],
      conflictOperation: 'unknown'
    }
    gitStatus.mockResolvedValue(oldHostResult)

    const result = await getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { includeLineStats: false }
    )

    expect(gitStatus).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: undefined,
      includeLineStats: false
    })
    expect(result).toBe(oldHostResult)
  })

  it('forwards upstream-negative-cache bypass to local git status only when enabled', async () => {
    gitStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })

    await getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { bypassEffectiveUpstreamNegativeCache: true }
    )
    await getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { bypassEffectiveUpstreamNegativeCache: false }
    )

    expect(gitStatus).toHaveBeenNthCalledWith(1, {
      worktreePath: '/repo',
      connectionId: undefined,
      bypassEffectiveUpstreamNegativeCache: true
    })
    expect(gitStatus).toHaveBeenNthCalledWith(2, {
      worktreePath: '/repo',
      connectionId: undefined
    })
  })

  it('forwards line-stat reuse to local status and cancels tokenized work on abort', async () => {
    const controller = new AbortController()
    let resolveStatus!: (value: { entries: never[]; conflictOperation: string }) => void
    gitStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatus = resolve
        })
    )

    const request = getRuntimeGitStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo'
      },
      { reuseLineStats: true, signal: controller.signal }
    )
    await vi.waitFor(() => expect(gitStatus).toHaveBeenCalled())
    const statusArgs = gitStatus.mock.calls[0]?.[0] as { requestToken?: string }
    controller.abort()
    resolveStatus({ entries: [], conflictOperation: 'unknown' })
    // Why: cancel is best-effort on the main process; even if status still
    // settles, the aborted local call must reject rather than look fresh.
    await expect(request).rejects.toMatchObject({ name: 'AbortError' })

    expect(gitStatus).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: undefined,
      reuseLineStats: true,
      requestToken: expect.any(String)
    })
    expect(gitCancelStatus).toHaveBeenCalledWith({ requestToken: statusArgs.requestToken })
  })

  it('checks ignored paths through local git IPC', async () => {
    gitCheckIgnored.mockResolvedValue(['dist/bundle.js'])

    const result = await getRuntimeGitIgnoredPaths(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1'
      },
      ['dist/bundle.js', 'src/index.ts']
    )

    expect(gitCheckIgnored).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: 'ssh-1',
      paths: ['dist/bundle.js', 'src/index.ts']
    })
    expect(result).toEqual(['dist/bundle.js'])
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('passes submodule status area through local git IPC', async () => {
    gitSubmoduleStatus.mockResolvedValue({ entries: [], conflictOperation: 'unknown' })

    await getRuntimeGitSubmoduleStatus(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1'
      },
      'vendor/lib',
      'staged'
    )

    expect(gitSubmoduleStatus).toHaveBeenCalledWith({
      worktreePath: '/repo',
      submodulePath: 'vendor/lib',
      connectionId: 'ssh-1',
      area: 'staged'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('uses local git IPC for history when no remote runtime is active', async () => {
    gitHistory.mockResolvedValue({
      items: [],
      hasIncomingChanges: false,
      hasOutgoingChanges: false,
      hasMore: false,
      limit: 50
    })

    await getRuntimeGitHistory(
      {
        settings: { activeRuntimeEnvironmentId: null },
        worktreeId: 'wt-1',
        worktreePath: '/repo',
        connectionId: 'ssh-1'
      },
      { limit: 25, baseRef: 'origin/main' }
    )

    expect(gitHistory).toHaveBeenCalledWith({
      worktreePath: '/repo',
      connectionId: 'ssh-1',
      limit: 25,
      baseRef: 'origin/main'
    })
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })

  it('passes the raw worktree id to local generation IPC', async () => {
    // Why: the meta key keeps the `::workspace:<uuid>` suffix that the cwd path strips.
    const workspaceId = '123e4567-e89b-12d3-a456-426614174000'
    const worktreeId = `folder-repo::/home/user::workspace:${workspaceId}`
    const context = {
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId,
      worktreePath: `/home/user::workspace:${workspaceId}`
    }

    await generateRuntimeCommitMessage(context)
    await generateRuntimePullRequestFields(context, {
      base: 'main',
      title: '',
      body: '',
      draft: false
    })

    expect(gitGenerateCommitMessage).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId, worktreePath: '/home/user' })
    )
    expect(gitGeneratePullRequestFields).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId, worktreePath: '/home/user' })
    )
  })

  it('omits worktreeId from local generation IPC when the context has none', async () => {
    const context = {
      settings: { activeRuntimeEnvironmentId: null },
      worktreeId: null,
      worktreePath: '/repo'
    }

    await generateRuntimeCommitMessage(context)

    expect(gitGenerateCommitMessage.mock.calls[0][0]).not.toHaveProperty('worktreeId')
  })
})
