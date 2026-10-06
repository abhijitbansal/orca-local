import { closeTestStores, createSqliteTestStore } from './persistence-test-harness'
/**
 * A `local`-typed automation whose folder workspace pinned it to an SSH host used to be projected
 * as SSH-owned. A local-only build strips that workspace at load, so the record can never project
 * onto a remote host. These tests drive the real Store through load.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { FolderWorkspace } from '../shared/folder-workspace-types'
import type { ProjectGroup } from '../shared/project-group-types'
import type { Repo } from '../shared/repo-types'
import type { SshTarget } from '../shared/ssh-types'
import { getDefaultPersistedState } from '../shared/constants'
import { folderWorkspaceKey } from '../shared/workspace-scope'
import { installFakeAppEnvironment } from '../../config/scripts/vitest-host-ports-setup'

const testState = { dir: '' }

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: { isEncryptionAvailable: () => false }
}))
vi.mock('./telemetry/client', () => ({ track: vi.fn() }))
vi.mock('./telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))

const NOW = 1_700_000_000_000
const TARGET_ID = 'prod'
const FIRST_GENERATION = 4

function prodTarget(generation: number): SshTarget {
  return {
    id: TARGET_ID,
    label: 'Prod box',
    host: 'prod.example.com',
    port: 22,
    username: 'tim',
    generation
  } as SshTarget
}

/** Local project outside the pinned folder scope: only the pin makes the record SSH-owned. */
function localRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/other/repo',
    displayName: 'Repo',
    badgeColor: '#000',
    addedAt: 1
  } as Repo
}

function projectGroup(): ProjectGroup {
  return {
    id: 'group-1',
    name: 'Group',
    // A folder-backed group: folder workspaces only survive normalization under one.
    parentPath: '/srv',
    parentGroupId: null,
    createdFrom: 'folder-scan',
    tabOrder: 0,
    isCollapsed: false,
    color: null,
    createdAt: NOW,
    updatedAt: NOW
  } as ProjectGroup
}

/** A remote-rooted folder workspace: its scope connection is the pin. */
function pinnedFolderWorkspace(): FolderWorkspace {
  return {
    id: 'fw-1',
    projectGroupId: 'group-1',
    name: 'Pinned workspace',
    folderPath: '/srv/remote',
    connectionId: TARGET_ID,
    linkedTask: null,
    comment: '',
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW
  } as FolderWorkspace
}

function pinnedState(generation: number, overrides: Record<string, unknown> = {}) {
  return {
    repos: [localRepo()],
    projectGroups: [projectGroup()],
    folderWorkspaces: [pinnedFolderWorkspace()],
    sshTargets: [prodTarget(generation)],
    sshTargetGenerationCounter: generation,
    automations: [],
    ...overrides
  }
}

async function createStoreFromState(state: Record<string, unknown>) {
  mkdirSync(testState.dir, { recursive: true })
  writeFileSync(
    join(testState.dir, 'orca-data.json'),
    JSON.stringify({ ...getDefaultPersistedState(testState.dir), ...state }),
    'utf-8'
  )
  vi.resetModules()
  installFakeAppEnvironment({ getPath: () => testState.dir })
  const { Store, initDataPath } = await import('./persistence')
  initDataPath()
  return createSqliteTestStore(Store, { dataFile: join(testState.dir, 'orca-data.json') })
}

beforeEach(() => {
  testState.dir = mkdtempSync(join(tmpdir(), 'orca-pinned-fence-'))
})

afterEach(async () => {
  await closeTestStores()
  rmSync(testState.dir, { recursive: true, force: true })
  vi.resetModules()
})

describe('workspace-pinned automations in a local-only build', () => {
  it('strips the SSH-pinned folder workspace and its target at load, so nothing can project onto them', async () => {
    const store = await createStoreFromState(pinnedState(FIRST_GENERATION))

    expect(store.getFolderWorkspace('fw-1')).toBeUndefined()
    expect(store.getSshTargets()).toEqual([])
    expect(store.getRepos().map((repo) => repo.id)).toEqual(['repo-1'])
  })

  it('leaves a local-typed automation without a pinned workspace owned by this machine', async () => {
    const legacy = {
      id: 'auto-legacy',
      name: 'Legacy',
      prompt: 'go',
      precheck: null,
      agentId: 'codex',
      projectId: 'repo-1',
      executionTargetType: 'local',
      executionTargetId: 'local',
      executionTargetGeneration: FIRST_GENERATION,
      schedulerOwner: 'local_host_service',
      workspaceMode: 'existing',
      workspaceId: folderWorkspaceKey('fw-1'),
      baseBranch: null,
      reuseSession: false,
      timezone: 'UTC',
      rrule: 'FREQ=DAILY',
      dtstart: NOW,
      enabled: true,
      nextRunAt: NOW,
      missedRunPolicy: 'run_once_within_grace',
      missedRunGraceMinutes: 720,
      createdAt: NOW,
      updatedAt: NOW
    }
    const store = await createStoreFromState(
      pinnedState(FIRST_GENERATION, { automations: [legacy] })
    )

    expect(store.getFolderWorkspace('fw-1')).toBeUndefined()
    expect(store.listAutomations()).toHaveLength(1)
    expect(store.listAutomationsForScope().items[0].selector.kind).not.toBe('ssh')
  })
})
