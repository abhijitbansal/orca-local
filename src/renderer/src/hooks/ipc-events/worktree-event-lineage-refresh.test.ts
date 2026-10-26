import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTestStore,
  resetRemoteRuntimeMocks,
  resetWorktreeSliceModuleMemory
} from '../../store/slices/worktrees-slice-test-harness'
import { makeLineage } from '../../store/slices/worktrees-slice-test-fixtures'
import { createWorktreeEventRuntime } from './worktree-event-runtime'
import { beginWorktreeLineageRefresh } from '../../store/slices/worktrees/metadata/worktree-lineage-readiness'

let store: ReturnType<typeof createTestStore>
let unsubs: (() => void)[]

vi.mock('../../store', () => ({
  useAppStore: {
    get getState() {
      return store.getState
    }
  }
}))
vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: vi.fn()
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))
vi.mock('@/components/worktree-base-fallback-notice', () => ({
  requestWorktreeBaseFallbackNotice: vi.fn()
}))

async function flushPromises() {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRemoteRuntimeMocks()
  resetWorktreeSliceModuleMemory()
  store = createTestStore()
  unsubs = []
  store.setState({
    fetchWorktrees: vi.fn().mockResolvedValue(true),
    fetchWorktreeLineage: vi.fn().mockResolvedValue(undefined),
    purgeWorktreeTerminalState: vi.fn(),
    removeWorkspaceSpaceWorktrees: vi.fn(),
    migrateWorktreeIdentity: vi.fn(),
    setActiveWorktree: vi.fn()
  })
  beginWorktreeLineageRefresh(store.getState, {
    kind: 'environment',
    environmentId: 'env-1'
  })(true)
})

afterEach(() => {
  for (const unsubscribe of unsubs) {
    unsubscribe()
  }
  vi.restoreAllMocks()
})

describe('remote worktree event lineage refresh', () => {
  it('downloads zero lineage copies for a 25-repository order save, then refreshes structural changes', async () => {
    const { worktreeChangeRefreshQueue: queue } = createWorktreeEventRuntime(unsubs, () => false)
    for (let index = 0; index < 25; index += 1) {
      queue.enqueue({
        repoId: `repo-${index}`,
        executionHostId: 'runtime:env-1',
        sortOrderOnly: true
      })
    }
    await flushPromises()
    expect(store.getState().fetchWorktrees).toHaveBeenCalledTimes(25)
    expect(store.getState().fetchWorktreeLineage).not.toHaveBeenCalled()
    expect(store.getState().fetchWorktrees).toHaveBeenCalledWith('repo-0', {
      executionHostId: 'runtime:env-1',
      suppressRemoteLineageRefresh: true
    })

    queue.enqueue({ repoId: 'repo-0', executionHostId: 'runtime:env-1' })
    await flushPromises()
    expect(store.getState().fetchWorktreeLineage).toHaveBeenCalledWith({
      executionHostId: 'runtime:env-1'
    })

    const lineage = Object.fromEntries(
      Array.from({ length: 105 }, (_, index) => {
        const row = makeLineage({
          worktreeId: `repo-${index % 25}::/home/orca/workspaces/project/feature-${index}`,
          parentWorktreeId: `repo-${index % 25}::/home/orca/projects/project`
        })
        return [row.worktreeId, row]
      })
    )
    const responseBytes = Buffer.byteLength(JSON.stringify({ lineage }))
    expect(responseBytes * 25).toBeGreaterThan(900_000)
  })

  it.each([undefined, false])(
    'keeps the full refresh for an older or unmarked event (%s)',
    async (sortOrderOnly) => {
      const { worktreeChangeRefreshQueue: queue } = createWorktreeEventRuntime(unsubs, () => false)
      queue.enqueue({
        repoId: 'repo',
        executionHostId: 'runtime:env-1',
        sortOrderOnly
      })
      await flushPromises()
      expect(store.getState().fetchWorktreeLineage).toHaveBeenCalledWith({
        executionHostId: 'runtime:env-1'
      })
    }
  )

  it('leaves concurrent unmarked host reads independent when one read hangs', async () => {
    const slow = Promise.withResolvers<void>()
    const fetchWorktreeLineage = vi
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue(undefined)
    store.setState({ fetchWorktreeLineage })
    const { worktreeChangeRefreshQueue: queue } = createWorktreeEventRuntime(unsubs, () => false)
    queue.enqueue({ repoId: 'repo-first', executionHostId: 'runtime:env-1' })
    await flushPromises()
    queue.enqueue({ repoId: 'repo-second', executionHostId: 'runtime:env-1' })
    queue.enqueue({
      repoId: 'repo-other-host',
      executionHostId: 'runtime:env-2'
    })
    await flushPromises()
    expect(fetchWorktreeLineage).toHaveBeenCalledTimes(3)
    expect(fetchWorktreeLineage).toHaveBeenLastCalledWith({
      executionHostId: 'runtime:env-2'
    })
    slow.resolve()
    await flushPromises()
  })

  it('still fetches lineage when an unmarked listing resolves non-authoritatively', async () => {
    store.setState({ fetchWorktrees: vi.fn().mockResolvedValue(false) })
    const { worktreeChangeRefreshQueue: queue } = createWorktreeEventRuntime(unsubs, () => false)
    queue.enqueue({ repoId: 'repo', executionHostId: 'runtime:env-1' })
    await flushPromises()
    expect(store.getState().fetchWorktreeLineage).toHaveBeenCalledOnce()
  })

  it('keeps forced-local and unowned notifications on their existing refresh paths', async () => {
    const { worktreeChangeRefreshQueue: queue } = createWorktreeEventRuntime(unsubs, () => false)
    queue.enqueue({
      repoId: 'local',
      forceLocalOwner: true,
      sortOrderOnly: true
    })
    queue.enqueue({ repoId: 'unowned', sortOrderOnly: true })
    await flushPromises()
    expect(store.getState().fetchWorktreeLineage).toHaveBeenCalledWith({
      forceLocalOwner: true
    })
    expect(store.getState().fetchWorktreeLineage).toHaveBeenCalledWith(undefined)
  })
})
