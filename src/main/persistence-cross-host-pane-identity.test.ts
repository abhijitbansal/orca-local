import {
  closeTestStores,
  testState,
  createStore,
  writeDataFile,
  readDataFile,
  makeRepo,
  makeTerminalTab
} from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { WorkspaceSessionState } from '../shared/workspace-session-state-types'
import { getDefaultWorkspaceSession } from '../shared/constants'
import { isTerminalLeafId } from '../shared/stable-pane-id'

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: { isEncryptionAvailable: () => false }
}))

const SHARED_TAB_ID = 'tab-shared'

function makeLegacyPaneSession(repoId: string, ptyId: string): WorkspaceSessionState {
  const worktreeId = `${repoId}::/worktree`
  return {
    ...getDefaultWorkspaceSession(),
    activeRepoId: repoId,
    activeWorktreeId: worktreeId,
    activeTabId: SHARED_TAB_ID,
    tabsByWorktree: {
      [worktreeId]: [makeTerminalTab({ id: SHARED_TAB_ID, worktreeId, ptyId })]
    },
    terminalLayoutsByTabId: {
      [SHARED_TAB_ID]: {
        root: { type: 'leaf', leafId: 'pane:1' },
        activeLeafId: 'pane:1',
        expandedLeafId: null,
        ptyIdsByLeafId: { 'pane:1': ptyId }
      }
    }
  }
}

describe('cross-host pane identity migration', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('drops the remote partition sharing a tab id with the local one and keeps local acknowledgements', async () => {
    writeDataFile({
      schemaVersion: 1,
      // Registered on purpose: rows owned by an unregistered repo id are swept as orphans on load.
      repos: [
        makeRepo({ id: 'repo-local', path: '/repo-local' }),
        makeRepo({ id: 'repo-a', path: '/repo-a' })
      ],
      workspaceSession: makeLegacyPaneSession('repo-local', 'local-pty'),
      workspaceSessionsByHostId: {
        'ssh:host-a': makeLegacyPaneSession('repo-a', 'pty-a')
      },
      ui: { acknowledgedAgentsByPaneKey: { 'tab-shared:pane:1': 500 } },
      sshRemotePtyLeases: [
        {
          targetId: 'host-a',
          ptyId: 'pty-a',
          worktreeId: 'repo-a::/worktree',
          tabId: SHARED_TAB_ID,
          leafId: 'pane:1',
          state: 'detached',
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })

    const store = await createStore()
    const localRoot = store.getWorkspaceSession('local').terminalLayoutsByTabId[SHARED_TAB_ID]?.root
    const localLeaf = localRoot?.type === 'leaf' ? localRoot.leafId : null

    expect(localLeaf && isTerminalLeafId(localLeaf)).toBe(true)
    // Local-only build: the remote partition and its lease are stripped at load, never migrated.
    expect(store.getWorkspaceSession('ssh:host-a').terminalLayoutsByTabId[SHARED_TAB_ID]).toBe(
      undefined
    )
    expect(store.getSshRemotePtyLeases('host-a')).toEqual([])

    store.flush()
    const persisted = readDataFile() as {
      ui?: { acknowledgedAgentsByPaneKey?: Record<string, number> }
    }
    expect(persisted.ui?.acknowledgedAgentsByPaneKey).toEqual({
      [`${SHARED_TAB_ID}:${localLeaf}`]: 500
    })
  })

  it('still bridges legacy pane keys when only one partition owns the tab id', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [makeRepo({ id: 'repo-a', path: '/repo-a' })],
      workspaceSession: makeLegacyPaneSession('repo-a', 'pty-a')
    })

    const store = await createStore()
    store.flush()
    const persisted = readDataFile() as {
      legacyPaneKeyAliasEntries?: { legacyPaneKey: string }[]
    }

    expect(
      persisted.legacyPaneKeyAliasEntries?.some(
        (entry) => entry.legacyPaneKey === `${SHARED_TAB_ID}:1`
      )
    ).toBe(true)
  })
})
