import type { ExecutionHostId } from '../../../../shared/execution-host'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppState } from '../types'
import { TEST_REPO, makeWorktree } from './worktrees-slice-test-fixtures'
import {
  createTestStore,
  mockApi,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory,
  runtimeEnvironmentCall
} from './worktrees-slice-test-harness'

const requestWorktreeBaseFallbackNotice = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn()
  }
}))

vi.mock('@/components/worktree-base-fallback-notice', () => ({
  requestWorktreeBaseFallbackNotice
}))

beforeEach(resetWorktreeSliceModuleMemory)

describe('worktree remote runtime mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRemoteRuntimeMocks()
  })

  it('passes startup commands through local worktree creation IPC', async () => {
    const store = createRepoTestStore()
    const wt = makeWorktree({
      id: 'repo1::/path/local-agent-startup',
      repoId: 'repo1',
      path: '/path/local-agent-startup'
    })
    mockApi.worktrees.create.mockResolvedValue({
      worktree: wt,
      startupTerminal: { spawned: true, surface: 'visible' }
    })
    store.setState({
      worktreesByRepo: { repo1: [] }
    } as Partial<AppState>)

    await store
      .getState()
      .createWorktree(
        'repo1',
        'local-agent-startup',
        undefined,
        'skip',
        undefined,
        'sidebar',
        'Launch local agent',
        undefined,
        undefined,
        undefined,
        'claude',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          command: "claude --prefill 'summarize repo'",
          env: { ORCA_AGENT_MODE: 'direct' },
          telemetry: {
            agent_kind: 'claude-code',
            launch_source: 'new_workspace_composer',
            request_kind: 'new'
          }
        }
      )

    expect(mockApi.worktrees.create).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: 'repo1',
        name: 'local-agent-startup',
        setupDecision: 'skip',
        telemetrySource: 'sidebar',
        displayName: 'Launch local agent',
        createdWithAgent: 'claude',
        startup: {
          command: "claude --prefill 'summarize repo'",
          env: { ORCA_AGENT_MODE: 'direct' },
          telemetry: {
            agent_kind: 'claude-code',
            launch_source: 'new_workspace_composer',
            request_kind: 'new'
          }
        }
      })
    )
    expect(runtimeEnvironmentCall).not.toHaveBeenCalled()
  })
})

// Creation routes by the project row's own host, so every test seeds that row.
function seedRepoHost(store: ReturnType<typeof createTestStore>, hostId: ExecutionHostId): void {
  store.setState({ repos: [{ ...TEST_REPO, executionHostId: hostId }] })
}

function createRepoTestStore(): ReturnType<typeof createTestStore> {
  const store = createTestStore()
  seedRepoHost(store, 'local')
  return store
}
