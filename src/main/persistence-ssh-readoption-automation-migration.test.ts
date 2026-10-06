import { closeTestStores, createSqliteTestStore } from './persistence-test-harness'
/**
 * SSH re-adoption has to repair the automation with the workspace.
 *
 * `reassignSshTargetId` used to re-point only repos, worktrees, sessions and
 * setups, so a re-added host left every stored automation orphaned on the dead
 * target id and the persisted Automations host filter naming a host that no
 * longer existed. These tests drive the real Store through remove/re-add.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Automation } from '../shared/automations-types'
import type { Repo } from '../shared/repo-types'
import type { RemovedSshTargetTombstone } from '../shared/ssh-types'
import type { SshConnectionStore } from './ssh/ssh-connection-store'
import { getDefaultPersistedState } from '../shared/constants'
import { hostStableKey } from '../shared/automation-owner-key'
import { installFakeAppEnvironment } from '../../config/scripts/vitest-host-ports-setup'

const testState = { dir: '' }

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: { isEncryptionAvailable: () => false }
}))
vi.mock('./telemetry/client', () => ({ track: vi.fn() }))
vi.mock('./telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))

const NOW = 1_700_000_000_000
const OLD_ID = 'ssh-1738000000000-a9f3x'
const IDENTITY = { host: 'dev.example.com', port: 22, username: 'tim' }

function desktopSshKey(targetId: string): string {
  return hostStableKey({ authority: { kind: 'desktop' }, selector: { kind: 'ssh', targetId } })
}

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 'auto-1',
    name: 'Nightly',
    prompt: 'go',
    precheck: null,
    agentId: 'codex',
    projectId: 'repo-1',
    executionTargetType: 'ssh',
    executionTargetId: OLD_ID,
    schedulerOwner: 'local_host_service',
    workspaceMode: 'new_per_run',
    workspaceId: null,
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
    updatedAt: NOW,
    ...overrides
  }
}

function sshRepo(): Repo {
  return {
    id: 'repo-1',
    path: '/srv/repo',
    displayName: 'Repo',
    badgeColor: '#000',
    addedAt: 1,
    connectionId: OLD_ID,
    executionHostId: `ssh:${OLD_ID}`
  } as Repo
}

function tombstone(overrides: Partial<RemovedSshTargetTombstone> = {}): RemovedSshTargetTombstone {
  return {
    oldTargetId: OLD_ID,
    ...IDENTITY,
    configHost: 'dev.example.com',
    label: 'Dev box',
    removedAt: NOW,
    ...overrides
  }
}

/** State as it looks right after the user removed the host: tombstone present, target gone. */
function removedHostState(overrides: Record<string, unknown> = {}) {
  return {
    repos: [sshRepo()],
    sshTargets: [],
    automations: [makeAutomation()],
    removedSshTargetTombstones: [tombstone()],
    ui: { ...getDefaultPersistedState(testState.dir).ui, automationHostFilter: undefined },
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

async function createSshStore(state: Record<string, unknown>) {
  const store = await createStoreFromState(state)
  const { SshConnectionStore } = await import('./ssh/ssh-connection-store')
  return { store, ssh: new SshConnectionStore(store) }
}

/** Re-add the same host the tombstone remembers. */
function readdDevBox(ssh: SshConnectionStore) {
  return ssh.addTarget({ label: 'Dev box', configHost: 'dev.example.com', ...IDENTITY })
}

beforeEach(() => {
  testState.dir = mkdtempSync(join(tmpdir(), 'orca-readopt-'))
})

afterEach(async () => {
  await closeTestStores()
  rmSync(testState.dir, { recursive: true, force: true })
  vi.resetModules()
})

describe('SSH re-adoption migrates automations', () => {
  it('leaves the automation orphaned while the host is gone', async () => {
    const { store } = await createSshStore(removedHostState())
    const [item] = store.listAutomationsForScope().items
    expect(item.selector).toEqual({
      kind: 'orphan',
      issue: 'Its SSH host is no longer registered.'
    })
  })
})

describe('SSH re-adoption tombstone retention', () => {
  it('consumes the tombstone once nothing depends on its removal evidence', async () => {
    const { store, ssh } = await createSshStore(
      removedHostState({
        ui: {
          ...getDefaultPersistedState(testState.dir).ui,
          automationHostFilter: { kind: 'host', hostKey: desktopSshKey(OLD_ID) }
        }
      })
    )

    readdDevBox(ssh)

    expect(store.getRemovedSshTargetTombstones()).toEqual([])
  })
})
