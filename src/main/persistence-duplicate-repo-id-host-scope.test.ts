import { closeTestStores, createSqliteTestStore } from './persistence-test-harness'
/**
 * The same repo id may be registered on two execution hosts (see `removeProjectForHost`).
 * Every deletion that resolves a *row* must therefore delete only that row: `removeProject`
 * is id-only and would take the sibling host's registration with it. Since #11994 those
 * deletions fan out to every paired device, so a cross-host over-delete is no longer local.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Project, ProjectHostSetup } from '../shared/project-types'
import type { Repo } from '../shared/repo-types'
import { getDefaultPersistedState } from '../shared/constants'
import { toRuntimeExecutionHostId } from '../shared/execution-host'
import { installFakeAppEnvironment } from '../../config/scripts/vitest-host-ports-setup'

const testState = { dir: '' }

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: { isEncryptionAvailable: () => false }
}))
vi.mock('./telemetry/client', () => ({ track: vi.fn() }))
vi.mock('./telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn() }))

function duplicateIdRepos(): Repo[] {
  return [
    {
      id: 'dup',
      path: '/laptop/dup',
      displayName: 'Dup Local',
      badgeColor: '#000',
      addedAt: 1,
      executionHostId: 'local'
    } as Repo,
    {
      id: 'dup',
      path: '/remote/dup',
      displayName: 'Dup Remote',
      badgeColor: '#000',
      addedAt: 2,
      connectionId: 'ssh-1'
    } as Repo
  ]
}

async function createStoreFromState(state: Record<string, unknown>) {
  mkdirSync(testState.dir, { recursive: true })
  writeFileSync(
    join(testState.dir, 'orca-data.json'),
    JSON.stringify({ ...getDefaultPersistedState(testState.dir), ...state }),
    'utf-8'
  )
  vi.resetModules()
  const { Store, initDataPath } = await import('./persistence')
  // Why here: userData resolves through AppEnvironment, and this must point at this
  // file's temp dir rather than the global fake's shared one, after resetModules.
  installFakeAppEnvironment({ getPath: () => testState.dir })
  initDataPath()
  return createSqliteTestStore(Store, { dataFile: join(testState.dir, 'orca-data.json') })
}

function createStoreWithDuplicateRepoId() {
  return createStoreFromState({ repos: duplicateIdRepos() })
}

/** A persisted local setup pointing at a repo id that only exists on ssh:ssh-1. */
function staleLocalSetupState() {
  const project: Project = {
    id: 'project-dup',
    displayName: 'Dup',
    badgeColor: '#000',
    sourceRepoIds: ['dup'],
    createdAt: 1,
    updatedAt: 1
  }
  const setup: ProjectHostSetup = {
    id: 'project-dup::local',
    projectId: project.id,
    hostId: 'local',
    repoId: 'dup',
    path: '/laptop/dup',
    displayName: 'Dup Local',
    setupState: 'ready',
    setupMethod: 'imported-existing-folder',
    createdAt: 1,
    updatedAt: 1
  }
  return {
    repos: [duplicateIdRepos()[1]],
    projects: [project],
    projectHostSetups: [setup],
    setupId: setup.id
  }
}

beforeEach(() => {
  testState.dir = mkdtempSync(join(tmpdir(), 'orca-dup-repo-id-'))
})

afterEach(async () => {
  await closeTestStores()
  rmSync(testState.dir, { recursive: true, force: true })
})

describe('deleting one host copy of a repo id shared by two hosts', () => {
  it('strips the remote copy at load and keeps the local row resolvable', async () => {
    const store = await createStoreWithDuplicateRepoId()

    expect(store.getRepos().map((repo) => repo.path)).toEqual(['/laptop/dup'])
  })

  it('removeProjectForHost drops only the addressed host row', async () => {
    const store = await createStoreWithDuplicateRepoId()

    store.removeProjectForHost('dup', 'ssh:ssh-1')

    expect(store.getRepos().map((repo) => repo.path)).toEqual(['/laptop/dup'])
  })

  it('deleteProjectHostSetup drops only the local row once the remote copy is stripped', async () => {
    const store = await createStoreWithDuplicateRepoId()

    const result = store.deleteProjectHostSetup({ setupId: 'dup' })

    expect(result?.repo?.path).toBe('/laptop/dup')
    expect(store.getRepos()).toEqual([])
  })

  it('setResolvedRepoGitUsername never lands on the local row for a stripped runtime host', async () => {
    const store = await createStoreFromState({
      repos: [
        {
          id: 'dup',
          path: '/work/dup',
          displayName: 'Dup Local',
          badgeColor: '#000',
          addedAt: 1,
          executionHostId: 'local'
        } as Repo,
        {
          id: 'dup',
          path: '/work/dup',
          displayName: 'Dup Runtime',
          badgeColor: '#000',
          addedAt: 2,
          executionHostId: toRuntimeExecutionHostId('env-1')
        } as Repo
      ]
    })

    expect(
      store.setResolvedRepoGitUsername(
        { id: 'dup', executionHostId: toRuntimeExecutionHostId('env-1') },
        'runtime-user'
      )
    ).toBe(false)

    expect(store.getRepos().map((repo) => [repo.displayName, repo.gitUsername])).toEqual([
      ['Dup Local', '']
    ])
  })

  it('a stale local setup for an id that only existed on ssh resolves no repo', async () => {
    const { setupId, ...state } = staleLocalSetupState()
    const store = await createStoreFromState(state)

    const result = store.deleteProjectHostSetup({ setupId })

    expect(result?.repo).toBeUndefined()
    expect(store.getProjectHostSetups().map((setup) => setup.id)).not.toContain(setupId)
    expect(store.getRepos()).toEqual([])
  })
})
