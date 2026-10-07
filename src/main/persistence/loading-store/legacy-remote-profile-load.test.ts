import type * as NodeFs from 'node:fs'
import { existsSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildProfileStateCutoverFixture } from '../profile-state-cutover-fixture'
import {
  openProfileStateDatabase,
  profileStateDatabaseFile
} from '../profile-state/profile-state-database'
import {
  sshPtyOwnerLeaseSecretSlot,
  ProtectedSecretPersistence
} from '../../protected-secret-persistence'
import {
  closeTestStores,
  createSqliteTestStore,
  readPersistedStateJson
} from '../../persistence-test-harness'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>()
  return { ...actual, existsSync: vi.fn(actual.existsSync) }
})
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
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (value: Buffer) => value.toString().slice(4)
  },
  ipcMain: { on: () => {}, handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))
const { Store } = await import('./store')
const stores: InstanceType<typeof Store>[] = []
afterEach(async () => {
  for (const store of stores.splice(0)) {
    store.freezeWrites()
  }
  await closeTestStores()
  vi.restoreAllMocks()
})

function legacyProfileJson(directory: string): string {
  const fixture = buildProfileStateCutoverFixture(directory)
  return JSON.stringify({
    ...fixture,
    sshTargetGenerationCounter: 7,
    deletedSshConfigAliases: ['old-alias'],
    removedSshTargetTombstones: [{ id: 'gone-host' }],
    sshRemotePtyLeases: [
      {
        id: 'lease-1',
        targetId: 'build-host',
        worktreeId: 'repo-remote::/fixture/remote',
        state: 'attached'
      }
    ],
    sshPtyConsumerRecoveries: [
      { targetId: 'build-host', ownerLease: 'sealed-lease', clientInstanceId: 'client-1' }
    ]
  })
}

function openStore(dataFile: string): InstanceType<typeof Store> {
  const store = createSqliteTestStore(Store, { dataFile })
  stores.push(store)
  return store
}

describe('legacy profile with ssh/runtime rows', () => {
  it('hydrates to a local-only state in one load, probes no remote path, and persists the strip', () => {
    const dataFile = join(
      realpathSync(mkdtempSync(join(tmpdir(), 'orca-legacy-remote-'))),
      'orca-data.json'
    )
    writeFileSync(dataFile, legacyProfileJson(dirname(dataFile)), 'utf-8')
    const purge = vi.spyOn(ProtectedSecretPersistence.prototype, 'removeRetainedBlob')

    const store = openStore(dataFile)
    expect(store.getRepos().map((repo) => repo.id)).toEqual(['repo-local'])
    expect(store.getProjects().map((project) => project.id)).toEqual(['repo:repo-local'])
    expect(store.getProjectHostSetups().map((setup) => setup.id)).toEqual(['repo-local'])
    expect(store.getWorktreeMeta('repo-local::/fixture/local')).toMatchObject({
      comment: 'Preserve this comment'
    })
    expect(store.getWorktreeMeta('repo-remote::/fixture/remote')).toBeUndefined()
    expect(store.getWorkspaceSession().activeTabId).toBe('tab-local')
    expect(store.getWorkspaceSession('ssh:build-host').activeTabId).toBeNull()
    expect(store.getWorkspaceSessionHostIds()).toEqual(['local'])
    expect(purge).toHaveBeenCalledWith(sshPtyOwnerLeaseSecretSlot('build-host'))
    expect(vi.mocked(existsSync).mock.calls.map(([path]) => String(path))).not.toContain(
      '/fixture/remote'
    )

    store.flush()
    const onDisk = JSON.parse(readPersistedStateJson(dataFile))
    expect(onDisk.repos.map((repo: { id: string }) => repo.id)).toEqual(['repo-local'])
    expect(onDisk.sshTargets).toEqual([])
    expect(onDisk.sshRemotePtyLeases).toEqual([])
    expect(onDisk.sshPtyConsumerRecoveries).toEqual([])
    expect(onDisk.deletedSshConfigAliases).toEqual([])
    expect(onDisk.sshTargetGenerationCounter).toBe(0)
    expect(onDisk).not.toHaveProperty('removedSshTargetTombstones')
    expect(onDisk.workspaceSessionsByHostId).toEqual({})
    expect(onDisk).not.toHaveProperty(['worktreeMeta', 'repo-remote::/fixture/remote'])
    expect(onDisk).toHaveProperty('futureTopLevelExtension')

    const opened = openProfileStateDatabase(
      profileStateDatabaseFile(dirname(dataFile)),
      'persistence-test'
    )
    try {
      const byDomain = new Map<unknown, unknown>(
        opened.db
          .prepare('SELECT domain, payload FROM profile_state_documents')
          .all()
          .map((row) => [row.domain, row.payload])
      )
      expect(byDomain.has('removedSshTargetTombstones')).toBe(false)
      expect(byDomain.get('sshTargets')).toBe('[]')
      expect(byDomain.get('sshRemotePtyLeases')).toBe('[]')
    } finally {
      opened.db.close()
    }

    const reloaded = openStore(dataFile)
    expect(reloaded.getRepos().map((repo) => repo.id)).toEqual(['repo-local'])
    reloaded.flush()
    const bytes = readPersistedStateJson(dataFile)
    const again = openStore(dataFile)
    again.flush()
    expect(readPersistedStateJson(dataFile)).toBe(bytes)
  })
})
