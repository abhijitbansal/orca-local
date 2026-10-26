import { afterEach, describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { _resetTracerForTests, setActiveSink } from '../../observability/tracer'
import { makeRepo } from '../persistence-test-harness'
import { makeTerminalTab } from '../persistence-session-fixtures'
import { planTerminalLeafMove } from './terminal-leaf-move'
import {
  closeMoveTestStores,
  FROM,
  LEFT,
  MOVED,
  moveRequest,
  newDataFile,
  openStore,
  ownersOf,
  seedSplitSource,
  sleeping,
  SOURCE,
  TARGET,
  tabsHoldingLeaf,
  TO,
  WT
} from './terminal-leaf-move-fixture'

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getName: () => 'orca-test',
    getVersion: () => '0.0.0-test',
    isPackaged: false,
    on: () => {},
    whenReady: () => Promise.resolve()
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  },
  ipcMain: { on: () => {}, handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

afterEach(closeMoveTestStores)

describe('moving a pane to a new tab', () => {
  it('moves the leaf and its binding in one write and re-keys pane-keyed records', async () => {
    const store = openStore(newDataFile())
    await seedSplitSource(store)
    store.setWorkspaceSession({
      ...store.getWorkspaceSession(),
      sleepingAgentSessionsByPaneKey: { [FROM]: sleeping(FROM, SOURCE) }
    })
    store.updateUI({
      acknowledgedAgentsByPaneKey: { [FROM]: 10 },
      activityClearedAtByPaneKey: { [FROM]: 11 },
      manuallyUnreadTurnsByPaneKey: { [FROM]: 12 }
    })

    await expect(
      store.moveTerminalLeafToNewTab({ ...moveRequest, ptyId: 'pty-agent' })
    ).resolves.toEqual({ status: 'moved', ptyId: 'pty-agent' })

    const session = store.getWorkspaceSession()
    expect(session.tabsByWorktree[WT]?.map((tab) => tab.id)).toEqual([SOURCE, TARGET])
    expect(session.terminalLayoutsByTabId[SOURCE]).toMatchObject({
      root: { type: 'leaf', leafId: LEFT },
      ptyIdsByLeafId: { [LEFT]: 'pty-left' }
    })
    expect(session.terminalLayoutsByTabId[TARGET]).toMatchObject({
      root: { type: 'leaf', leafId: MOVED },
      ptyIdsByLeafId: { [MOVED]: 'pty-agent' }
    })
    expect(session.terminalPtyIncarnationsByPaneKey).toEqual({
      [`${SOURCE}:${LEFT}`]: 'inc-left',
      [TO]: 'inc-1'
    })
    expect(session.sleepingAgentSessionsByPaneKey).toEqual({
      [TO]: expect.objectContaining({ paneKey: TO, tabId: TARGET })
    })
    expect(store.getUI()).toMatchObject({
      acknowledgedAgentsByPaneKey: { [TO]: 10 },
      activityClearedAtByPaneKey: { [TO]: 11 },
      manuallyUnreadTurnsByPaneKey: { [TO]: 12 }
    })
    expect(ownersOf(session, 'pty-agent')).toEqual([TO])
  })

  it('reports a leaf main never held instead of inventing one', async () => {
    const store = openStore(newDataFile())
    await expect(
      store.moveTerminalLeafToNewTab({ ...moveRequest, ptyId: 'pty-agent' })
    ).resolves.toEqual({ status: 'not_held' })
    expect(store.getWorkspaceSession().tabsByWorktree[WT]).toBeUndefined()
  })

  it('refuses a move that names another terminal or an existing tab', async () => {
    const store = openStore(newDataFile())
    await seedSplitSource(store)
    await expect(
      store.moveTerminalLeafToNewTab({ ...moveRequest, ptyId: 'pty-other' })
    ).resolves.toEqual({ status: 'refused', reason: 'pty_mismatch' })
    await expect(
      store.moveTerminalLeafToNewTab({ ...moveRequest, targetTabId: SOURCE, ptyId: 'pty-agent' })
    ).resolves.toEqual({ status: 'refused', reason: 'target_tab_exists' })
    expect(tabsHoldingLeaf(store.getWorkspaceSession(), MOVED)).toEqual([SOURCE])
  })

  it('moves a leaf that a stray layout of a removed tab still names', () => {
    const planned = planTerminalLeafMove(
      [
        {
          hostId: 'local',
          session: {
            activeRepoId: 'repo-1',
            activeWorktreeId: WT,
            activeTabId: SOURCE,
            tabsByWorktree: { [WT]: [makeTerminalTab({ id: SOURCE, worktreeId: WT })] },
            terminalLayoutsByTabId: {
              [SOURCE]: {
                root: {
                  type: 'split',
                  direction: 'vertical',
                  first: { type: 'leaf', leafId: LEFT },
                  second: { type: 'leaf', leafId: MOVED }
                },
                activeLeafId: LEFT,
                expandedLeafId: null
              },
              'tab-removed': {
                root: { type: 'leaf', leafId: MOVED },
                activeLeafId: MOVED,
                expandedLeafId: null
              }
            }
          }
        }
      ],
      { ...moveRequest, ptyId: 'pty-agent' }
    )
    expect(planned.result).toEqual({ status: 'moved', ptyId: 'pty-agent' })
  })

  it('records a persistence.terminal-topology span without pane keys or PTY ids', async () => {
    const records: {
      name: string
      attributes: Record<string, unknown>
      traceId: string
      spanId: string
      parentSpanId?: string
      startTimeUnixNano: string
      endTimeUnixNano: string
      durationMs: number
    }[] = []
    setActiveSink({
      push: (record) => {
        records.push(JSON.parse(JSON.stringify(record)))
      },
      flush: () => {},
      close: () => {}
    })
    try {
      const store = openStore(newDataFile())
      await seedSplitSource(store)
      records.length = 0
      const request = { ...moveRequest, ptyId: 'pty-agent' }
      await store.moveTerminalLeafToNewTab(request)
      await store.moveTerminalLeafToNewTab(request)
      await store.moveTerminalLeafToNewTab({ ...request, targetTabId: 'tab-other' })

      const spans = records.filter((record) => record.name === 'persistence.terminal-topology')
      expect(spans.map((span) => span.attributes)).toEqual([
        { kind: 'persistence', 'topology.kind': 'move_leaf', 'topology.outcome': 'committed' },
        {
          kind: 'persistence',
          'topology.kind': 'move_leaf',
          'topology.outcome': 'refused',
          'topology.refusal': 'target_tab_exists'
        },
        {
          kind: 'persistence',
          'topology.kind': 'move_leaf',
          'topology.outcome': 'refused',
          'topology.refusal': 'leaf_in_other_tab'
        }
      ])
      const transportFields = new Set([
        'traceId',
        'spanId',
        'parentSpanId',
        'startTimeUnixNano',
        'endTimeUnixNano',
        'durationMs'
      ])
      for (const span of spans) {
        expect(span.traceId).toMatch(/^[a-f0-9]{32}$/)
        expect(span.spanId).toMatch(/^[a-f0-9]{16}$/)
        if (span.parentSpanId !== undefined) {
          expect(span.parentSpanId).toMatch(/^[a-f0-9]{16}$/)
        }
        expect(span.startTimeUnixNano).toMatch(/^\d+$/)
        expect(span.endTimeUnixNano).toMatch(/^\d+$/)
        expect(Number.isFinite(span.durationMs)).toBe(true)
        expect(span.durationMs).toBeGreaterThanOrEqual(0)
      }
      // Random IDs and clocks can coincidentally contain the leaf's numeric prefix.
      const payloads = spans.map((span) =>
        Object.fromEntries(Object.entries(span).filter(([key]) => !transportFields.has(key)))
      )
      expect(JSON.stringify(payloads)).not.toMatch(/pty-|tab-source|tab-target|2222/)
    } finally {
      _resetTracerForTests()
    }
  })
})

// After a restart the relay reattach writes the SSH pane into `local` as well as `ssh:`; a move
// that left either copy behind refused the moved pane and the next relay reattach.
// STA-9259: detach, then the moved pane's reattach binding, then a renderer snapshot that still
// shows the pre-move layout, then a restart. Before the move transaction this left one leaf and
// one PTY in both tabs.
describe('STA-9259 move sequence', () => {
  it('keeps one owner through reattach, a stale renderer save and a restart', async () => {
    const dataFile = newDataFile()
    const store = openStore(dataFile)
    // Load sweeps sessions of unregistered repos, so the restart needs a real owner.
    store.addRepo(makeRepo({ id: 'repo-1', path: '/tmp/move-worktree' }))
    await seedSplitSource(store)
    const preMoveRendererSnapshot = structuredClone(store.getWorkspaceSession())

    await store.moveTerminalLeafToNewTab({ ...moveRequest, ptyId: 'pty-agent' })
    // The moved pane mounts in the target tab and reattaches with its stable-owner fence.
    const reattached = await store.persistPtyBinding({
      worktreeId: WT,
      tabId: TARGET,
      leafId: MOVED,
      ptyId: 'pty-agent',
      incarnationId: 'inc-1',
      expectedBinding: { ptyId: 'pty-agent', incarnationId: 'inc-1' },
      origin: 'reattach'
    })
    expect(reattached).toBe(true)
    // A debounced renderer save that predates the move must not resurrect the source copy.
    store.setWorkspaceSession(preMoveRendererSnapshot)
    expect(ownersOf(store.getWorkspaceSession(), 'pty-agent')).toEqual([TO])
    expect(tabsHoldingLeaf(store.getWorkspaceSession(), MOVED)).toEqual([TARGET])

    store.flush()
    const restarted = openStore(dataFile)
    expect(ownersOf(restarted.getWorkspaceSession(), 'pty-agent')).toEqual([TO])
    expect(tabsHoldingLeaf(restarted.getWorkspaceSession(), MOVED)).toEqual([TARGET])
  })
})
