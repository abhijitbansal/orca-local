import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { PersistedState } from '../shared/persisted-state-types'
import { canonicalWorktreeIdentity } from '../shared/worktree/identity'
import {
  composeWorktreeHostIdentity,
  hostWorktreeTarget
} from '../shared/worktree/host-qualified-identity'
import type { Store } from './persistence/loading-store/store'
import {
  createStore,
  makeRepo,
  readDataFile,
  testState,
  writeDataFile
} from './persistence/persistence-test-harness'
import { removeWorktreeMetaRow } from './persistence/host-qualified-worktree-meta'

describe('host-qualified worktree metadata', () => {
  const worktreeId = 'repo-1::/workspace/feature'
  const ROTATED_INSTANCE_ID = '44444444-4444-4444-8444-444444444444'

  // Register the repo so load-time orphan cleanup retains its metadata.
  const createStoreWithRepo = (): Store => {
    const store = createStore()
    store.addRepo(makeRepo({ id: 'repo-1', path: '/workspace' }))
    return store
  }

  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-worktree-identity-'))
  })

  afterEach(() => {
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('stores independent metadata for colliding locators on two hosts', () => {
    const store = createStore()

    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })

    expect(store.getWorktreeMetaForHost(worktreeId, 'local')?.displayName).toBe('Local feature')
    expect(store.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')?.displayName).toBe(
      'Remote feature'
    )
    store.flush()
    const persisted = readDataFile() as PersistedState
    expect(Object.keys(persisted.worktreeMetaByIdentity ?? {})).toHaveLength(2)
    expect(store.getWorktreeMeta(worktreeId)?.displayName).toBe('Local feature')
  })
  it('projects canonical-only metadata for exactly one host', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })

    expect(store.getAllWorktreeMetaForHost('local')).toEqual({
      [worktreeId]: expect.objectContaining({ displayName: 'Local feature', hostId: 'local' })
    })
    expect(store.getAllWorktreeMetaForHost('ssh:build-box')).toEqual({
      [worktreeId]: expect.objectContaining({
        displayName: 'Remote feature',
        hostId: 'ssh:build-box'
      })
    })
  })
  it('reloads local metadata and strips the remote host row', () => {
    const store = createStoreWithRepo()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })
    store.flush()

    const reloaded = createStore()
    expect(reloaded.getWorktreeMetaForHost(worktreeId, 'local')?.displayName).toBe('Local feature')
    // Local-only build: remote host metadata is stripped at load.
    expect(
      reloaded.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')?.displayName
    ).toBeUndefined()
  })
  it('keeps canonical metadata current for legacy writers on a known owner', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      comment: 'before'
    })

    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      comment: 'after'
    })

    expect(store.getWorktreeMetaForHost(worktreeId, 'local')?.comment).toBe('after')
  })
  it('backfills one stable instance for legacy metadata that omitted it', () => {
    const seed = createStoreWithRepo()
    seed.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Legacy feature'
    })
    seed.flush()
    const legacy = readDataFile() as PersistedState
    delete legacy.worktreeMeta[worktreeId]?.instanceId
    delete legacy.worktreeMetaByIdentity
    delete legacy.worktreeIdentityAliases
    writeDataFile(legacy)

    const store = createStore()
    const first = store.getWorktreeMetaForHost(worktreeId, 'local')
    const second = store.getWorktreeMetaForHost(worktreeId, 'local')
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      comment: 'after migration'
    })
    store.flush()

    expect(first?.instanceId).toBeTruthy()
    expect(second?.instanceId).toBe(first?.instanceId)
    expect(store.getWorktreeMetaForHost(worktreeId, 'local')?.comment).toBe('after migration')
    const migrated = readDataFile() as PersistedState
    expect(migrated.worktreeMeta[worktreeId]?.hostId).toBe('local')
    expect(Object.keys(migrated.worktreeMetaByIdentity ?? {})).toHaveLength(1)
  })
  it('collapses an ambiguous locator onto its most recently active instance', () => {
    const seed = createStoreWithRepo()
    const first = seed.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'First'
    })
    seed.flush()
    const persisted = readDataFile() as PersistedState
    const alias = composeWorktreeHostIdentity('local', worktreeId)
    const secondKey = canonicalWorktreeIdentity({
      worktreeId,
      executionHostId: 'local',
      instanceId: '33333333-3333-4333-8333-333333333333'
    })
    persisted.worktreeMetaByIdentity ??= {}
    persisted.worktreeIdentityAliases ??= {}
    persisted.worktreeMetaByIdentity[secondKey] = {
      ...first,
      instanceId: '33333333-3333-4333-8333-333333333333',
      displayName: 'Second',
      lastActivityAt: 1
    }
    persisted.worktreeIdentityAliases[alias] = [
      ...(persisted.worktreeIdentityAliases[alias] ?? []),
      secondKey
    ]
    writeDataFile(persisted)

    const store = createStore()
    expect(() =>
      store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
        comment: 'ambiguous write'
      })
    ).toThrow('Worktree identity is ambiguous for this host and locator.')

    const repaired = createStore()
    expect(repaired.getWorktreeMetaForHost(worktreeId, 'local')?.displayName).toBe('Second')
    repaired.flush()
    const afterRead = readDataFile() as PersistedState
    expect(afterRead.worktreeIdentityAliases?.[alias]).toEqual([
      persisted.worktreeIdentityAliases?.[alias]?.[0],
      secondKey
    ])
    expect(Object.keys(afterRead.worktreeMetaByIdentity ?? {})).toHaveLength(2)
  })

  it('removes only the selected legacy-owner metadata when locators collide', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })

    store.removeWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }))

    expect(store.getWorktreeMetaForHost(worktreeId, 'local')).toBeUndefined()
    expect(store.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')?.displayName).toBe(
      'Remote feature'
    )
  })

  it('removes only the selected host metadata when locators collide', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })

    store.removeWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }))

    expect(store.getWorktreeMetaForHost(worktreeId, 'local')?.displayName).toBe('Local feature')
    expect(store.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')).toBeUndefined()
    store.flush()
    expect(
      Object.keys((readDataFile() as PersistedState).worktreeMetaByIdentity ?? {})
    ).toHaveLength(1)
  })

  it('moves the locator alias without changing canonical identity', () => {
    const store = createStore()
    const meta = store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Feature'
    })
    const identityKey = canonicalWorktreeIdentity({
      worktreeId,
      executionHostId: 'local',
      instanceId: meta.instanceId!
    })
    const renamedId = 'repo-1::/workspace/renamed-feature'

    store.migrateWorktreeIdentity(
      hostWorktreeTarget({ id: worktreeId, hostId: 'local' }),
      renamedId
    )

    expect(store.getWorktreeMetaForHost(worktreeId, 'local')).toBeUndefined()
    expect(store.getWorktreeMetaForHost(renamedId, 'local')?.instanceId).toBe(meta.instanceId)
    store.flush()
    const persisted = readDataFile() as PersistedState
    expect(persisted.worktreeMetaByIdentity?.[identityKey]?.displayName).toBe('Feature')
    expect(
      persisted.worktreeIdentityAliases?.[composeWorktreeHostIdentity('local', renamedId)]
    ).toEqual([identityKey])
  })

  it('keeps the canonical identity stable when the locator changes', () => {
    const store = createStore()
    const meta = store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Feature'
    })

    const before = canonicalWorktreeIdentity({
      worktreeId,
      executionHostId: 'local',
      instanceId: meta.instanceId!
    })
    const after = canonicalWorktreeIdentity({
      worktreeId: 'repo-1::/workspace/renamed-feature',
      executionHostId: 'local',
      instanceId: meta.instanceId!
    })

    expect(after).toBe(before)
    expect(composeWorktreeHostIdentity('local', worktreeId)).toBe(
      'local|repo-1::/workspace/feature'
    )
  })
  it('honours a deliberate instanceId rotation instead of pinning the stored one', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Feature'
    })

    // A proven-missing parent rotates its identity so path reuse cannot validate old lineage.
    const rotated = store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      instanceId: ROTATED_INSTANCE_ID
    })

    expect(rotated.instanceId).toBe(ROTATED_INSTANCE_ID)
    expect(store.getWorktreeMetaForHost(worktreeId, 'local')?.instanceId).toBe(ROTATED_INSTANCE_ID)
    store.flush()
    const persisted = readDataFile() as PersistedState
    expect(Object.keys(persisted.worktreeMetaByIdentity ?? {})).toEqual([
      canonicalWorktreeIdentity({
        worktreeId,
        executionHostId: 'local',
        instanceId: ROTATED_INSTANCE_ID
      })
    ])
  })

  it('leaves other hosts at the old locator when one host renames its folder', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })
    const renamedId = 'repo-1::/workspace/renamed-feature'

    store.migrateWorktreeIdentity(
      hostWorktreeTarget({ id: worktreeId, hostId: 'local' }),
      renamedId
    )

    expect(store.getWorktreeMetaForHost(renamedId, 'local')?.displayName).toBe('Local feature')
    expect(store.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')?.displayName).toBe(
      'Remote feature'
    )
  })

  it('drops every host identity row once each host removes its copy', () => {
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'local' }), {
      displayName: 'Local feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }), {
      displayName: 'Remote feature'
    })

    expect(store.removeUnhostedWorktreeMeta(worktreeId)).toBe(false)
    removeWorktreeMetaRow(store, worktreeId, undefined)
    expect(store.getWorktreeMetaForHost(worktreeId, 'ssh:build-box')?.displayName).toBe(
      'Remote feature'
    )
    store.removeWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: 'ssh:build-box' }))

    store.flush()
    const persisted = readDataFile() as PersistedState
    expect(persisted.worktreeMetaByIdentity ?? {}).toEqual({})
    expect(persisted.worktreeIdentityAliases ?? {}).toEqual({})
  })

  it('preserves source metadata when the re-adoption destination is divergent', () => {
    const oldHostId = 'ssh:old-target' as const
    const newHostId = 'ssh:new-target' as const
    const store = createStore()
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: oldHostId }), {
      displayName: 'Source feature'
    })
    store.setWorktreeMeta(hostWorktreeTarget({ id: worktreeId, hostId: newHostId }), {
      displayName: 'Destination feature'
    })

    store.reassignSshTargetId('old-target', 'new-target')

    expect(store.getWorktreeMetaForHost(worktreeId, oldHostId)?.displayName).toBe('Source feature')
    expect(store.getWorktreeMetaForHost(worktreeId, newHostId)?.displayName).toBe(
      'Destination feature'
    )
    expect(store.getWorktreeMeta(worktreeId)?.hostId).toBe(oldHostId)
    store.flush()
    const persisted = readDataFile() as PersistedState
    expect(
      persisted.worktreeIdentityAliases?.[composeWorktreeHostIdentity(oldHostId, worktreeId)]
    ).toHaveLength(1)
    expect(
      persisted.worktreeIdentityAliases?.[composeWorktreeHostIdentity(newHostId, worktreeId)]
    ).toHaveLength(1)
  })
})
