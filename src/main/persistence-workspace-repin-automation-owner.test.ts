import { closeTestStores, createSqliteTestStore } from './persistence-test-harness'
/**
 * A folder workspace that was pinned to an SSH host is stripped at load in a local-only build, so
 * the automation records inside it can no longer follow a re-pin onto another registration.
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
const PROD_GENERATION = 4
const STAGING_GENERATION = 9

function target(id: string, generation: number): SshTarget {
  return {
    id,
    label: id,
    host: `${id}.example.com`,
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

function folderWorkspace(connectionId: string): FolderWorkspace {
  return {
    id: 'fw-1',
    projectGroupId: 'group-1',
    name: 'Pinned workspace',
    folderPath: '/srv/remote',
    connectionId,
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

function pinnedAutomation() {
  return {
    id: 'auto-1',
    name: 'Nightly',
    prompt: 'go',
    precheck: null,
    agentId: 'codex',
    projectId: 'repo-1',
    executionTargetType: 'local',
    executionTargetId: 'local',
    executionTargetGeneration: PROD_GENERATION,
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
}

function initialState(): Record<string, unknown> {
  return {
    repos: [localRepo()],
    projectGroups: [projectGroup()],
    folderWorkspaces: [folderWorkspace('prod')],
    sshTargets: [target('prod', PROD_GENERATION), target('staging', STAGING_GENERATION)],
    sshTargetGenerationCounter: STAGING_GENERATION,
    automations: [pinnedAutomation()]
  }
}

async function loadStore(state: Record<string, unknown>) {
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
  testState.dir = mkdtempSync(join(tmpdir(), 'orca-workspace-repin-'))
})

afterEach(async () => {
  await closeTestStores()
  rmSync(testState.dir, { recursive: true, force: true })
  vi.resetModules()
})

describe('a workspace pinned to an SSH host in a local-only build', () => {
  it('is stripped at load with its target, so its records never project onto a host', async () => {
    const store = await loadStore(initialState())

    expect(store.getFolderWorkspace('fw-1')).toBeUndefined()
    expect(store.getSshTargets()).toEqual([])
    expect(store.listAutomations()).toHaveLength(1)
    expect(store.listAutomationsForScope().items[0].selector.kind).not.toBe('ssh')
  })
})
