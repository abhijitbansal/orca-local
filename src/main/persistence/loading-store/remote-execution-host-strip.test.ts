import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/constants'
import type { PersistedState } from '../../../shared/persisted-state-types'
import type { Repo } from '../../../shared/repo-types'
import {
  isRemoteExecutionHostRow,
  STRIPPED_REMOTE_STATE_KEYS,
  stripRemoteExecutionHostState
} from './remote-execution-host-strip'

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: fixture rows omit fields the strip never reads.
function fixture<T>(value: unknown): T {
  return value as T
}

const LOCAL_WT = 'repo-local::/w/local'
const SSH_WT = 'repo-ssh::/w/ssh'
const RUNTIME_WT = 'repo-runtime::/w/runtime'

function repo(overrides: Partial<Repo>): Repo {
  return {
    id: 'repo-local',
    path: '/w/local',
    displayName: 'r',
    badgeColor: '#737373',
    addedAt: 1,
    ...overrides
  }
}

function legacyProfile(): PersistedState {
  const state = getDefaultPersistedState('/home/test')
  state.repos = [
    repo({}),
    repo({ id: 'repo-ssh', path: '/w/ssh', connectionId: 'build-host' }),
    repo({ id: 'repo-ssh-host-only', path: '/w/ssh2', executionHostId: 'ssh:build-host' }),
    repo({ id: 'repo-runtime', path: '/w/runtime', executionHostId: 'runtime:env-1' }),
    repo({ id: 'repo-malformed', path: '/w/bad', executionHostId: fixture('ssh:') })
  ]
  state.projectHostSetups = [
    {
      id: 'repo-local',
      projectId: 'p',
      hostId: 'local',
      repoId: 'repo-local',
      path: '/w/local',
      displayName: 'l',
      setupState: 'ready',
      setupMethod: 'imported-existing-folder',
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'setup-ssh',
      projectId: 'p',
      hostId: 'ssh:build-host',
      repoId: 'repo-ssh',
      path: '/w/ssh',
      displayName: 's',
      setupState: 'ready',
      setupMethod: 'imported-existing-folder',
      createdAt: 1,
      updatedAt: 1
    }
  ]
  state.projectGroups = [
    fixture({
      id: 'group-local',
      name: 'g',
      createdFrom: 'manual',
      parentPath: '/f/local',
      createdAt: 1
    }),
    fixture({
      id: 'group-ssh',
      name: 'g',
      createdFrom: 'manual',
      parentPath: '/f/ssh',
      connectionId: 'build-host',
      createdAt: 1
    })
  ]
  state.folderWorkspaces = [
    fixture({
      id: 'fw-local',
      projectGroupId: 'group-local',
      name: 'a',
      folderPath: '/f/local',
      createdAt: 1
    }),
    fixture({
      id: 'fw-runtime',
      projectGroupId: 'group-local',
      name: 'b',
      folderPath: '/f/b',
      executionHostId: 'runtime:env-1',
      createdAt: 1
    })
  ]
  state.worktreeMeta = {
    [LOCAL_WT]: fixture({ hostId: 'local', lastActivityAt: 1, createdAt: 1 }),
    [SSH_WT]: fixture({ lastActivityAt: 1, createdAt: 1 }), // legacy row: no hostId, owned by a stripped repo
    [RUNTIME_WT]: fixture({ hostId: 'runtime:env-1', lastActivityAt: 1, createdAt: 1 }),
    'global-floating-terminal': fixture({ lastActivityAt: 1, createdAt: 1 })
  }
  state.worktreeLineageById = { [SSH_WT]: fixture({ parentWorktreeId: LOCAL_WT }) }
  state.workspaceLineageByChildKey = {
    [`worktree:${SSH_WT}`]: fixture({ parentWorkspaceKey: `worktree:${LOCAL_WT}` })
  }
  state.worktreeMetaByIdentity = {
    'wt2:local:instance-local': fixture({ hostId: 'local' }),
    'wt2:ssh%3Abuild-host:instance-ssh': fixture({ hostId: 'ssh:build-host' }),
    'wt2:runtime%3Aenv-1:instance-rt': fixture({ hostId: 'runtime:env-1' })
  }
  state.worktreeIdentityAliases = {
    [`local|${LOCAL_WT}`]: ['wt2:local:instance-local', 'wt2:ssh%3Abuild-host:instance-ssh'],
    [`ssh:build-host|${SSH_WT}`]: ['wt2:ssh%3Abuild-host:instance-ssh'],
    [`|${SSH_WT}`]: ['wt2:local:instance-local']
  }
  state.workspaceSessionsByHostId = {
    'ssh:build-host': state.workspaceSession,
    'runtime:env-1': state.workspaceSession
  }
  state.retiredWorktreeNamesByNamespace = {
    'local:/w': fixture({}),
    'ssh:user@host:22:/w': fixture({}),
    'ssh:?:/w': fixture({}),
    'runtime:env-1:/w': fixture({})
  }
  state.retiredWorktreeNamesByRepo = { 'repo-local': fixture({}), 'repo-ssh': fixture({}) }
  state.sparsePresetsByRepo = { 'repo-local': [], 'repo-ssh': [] }
  state.sshTargets = [
    {
      id: 'build-host',
      label: 'b',
      host: 'b.test',
      port: 22,
      username: 'u',
      source: 'manual',
      generation: 3
    }
  ]
  state.sshTargetGenerationCounter = 3
  state.deletedSshConfigAliases = ['old']
  state.removedSshTargetTombstones = [fixture({ id: 'gone' })]
  state.sshRemotePtyLeases = [
    fixture({ id: 'lease-1', targetId: 'build-host', worktreeId: SSH_WT, state: 'attached' })
  ]
  state.sshPtyConsumerRecoveries = [
    fixture({ targetId: 'build-host', ownerLease: 'sealed', clientInstanceId: 'c' })
  ]
  return state
}

describe('stripRemoteExecutionHostState', () => {
  it('is a no-op on a default profile', () => {
    const state = getDefaultPersistedState('/home/test')
    expect(stripRemoteExecutionHostState(state)).toEqual({
      changed: false,
      strippedRepoIds: [],
      legacyRecoveryTargetIds: []
    })
    expect(state.sshTargets).toEqual([])
  })

  it('drops every repo that names an ssh/runtime host, including a malformed id, and keeps local rows', () => {
    const state = legacyProfile()
    const result = stripRemoteExecutionHostState(state)
    expect(result.changed).toBe(true)
    expect(state.repos.map((r) => r.id)).toEqual(['repo-local'])
    expect(result.strippedRepoIds.sort()).toEqual([
      'repo-malformed',
      'repo-runtime',
      'repo-ssh',
      'repo-ssh-host-only'
    ])
    expect(state.projectHostSetups.map((s) => s.id)).toEqual(['repo-local'])
    expect(state.projectGroups.map((g) => g.id)).toEqual(['group-local'])
    expect(state.folderWorkspaces.map((f) => f.id)).toEqual(['fw-local'])
  })

  it('deletes the six SSH keys so the defaults spread re-supplies empty values', () => {
    const state = legacyProfile()
    stripRemoteExecutionHostState(state)
    for (const key of STRIPPED_REMOTE_STATE_KEYS) {
      expect(Object.hasOwn(state, key)).toBe(false)
    }
  })

  it('returns legacy recovery target ids for keychain cleanup', () => {
    expect(stripRemoteExecutionHostState(legacyProfile()).legacyRecoveryTargetIds).toEqual([
      'build-host'
    ])
  })

  it('removes worktree metadata owned by stripped repos or remote hosts, with lineage companions and identity rows', () => {
    const state = legacyProfile()
    stripRemoteExecutionHostState(state)
    expect(Object.keys(state.worktreeMeta).sort()).toEqual(
      ['global-floating-terminal', LOCAL_WT].sort()
    )
    expect(state.worktreeLineageById).toEqual({})
    expect(state.workspaceLineageByChildKey).toEqual({})
    expect(Object.keys(state.worktreeMetaByIdentity ?? {})).toEqual(['wt2:local:instance-local'])
    expect(state.worktreeIdentityAliases).toEqual({
      [`local|${LOCAL_WT}`]: ['wt2:local:instance-local']
    })
  })

  it('empties every non-local session partition and remote retirement namespaces', () => {
    const state = legacyProfile()
    stripRemoteExecutionHostState(state)
    expect(state.workspaceSessionsByHostId).toEqual({})
    expect(Object.keys(state.retiredWorktreeNamesByNamespace ?? {})).toEqual(['local:/w'])
    expect(Object.keys(state.retiredWorktreeNamesByRepo ?? {})).toEqual(['repo-local'])
    expect(Object.keys(state.sparsePresetsByRepo)).toEqual(['repo-local'])
  })

  it('is idempotent', () => {
    const state = legacyProfile()
    stripRemoteExecutionHostState(state)
    expect(stripRemoteExecutionHostState(state).changed).toBe(false)
  })

  it('does not report a change for a profile that only carries the empty inert keys', () => {
    const state = getDefaultPersistedState('/home/test')
    state.removedSshTargetTombstones = undefined
    expect(stripRemoteExecutionHostState(state).changed).toBe(false)
  })
})

describe('isRemoteExecutionHostRow', () => {
  it('never reads a remote spelling as local', () => {
    expect(isRemoteExecutionHostRow({ connectionId: 'x' })).toBe(true)
    expect(isRemoteExecutionHostRow({ executionHostId: 'ssh:x' })).toBe(true)
    expect(isRemoteExecutionHostRow({ executionHostId: 'runtime:x' })).toBe(true)
    expect(isRemoteExecutionHostRow({ executionHostId: ' ssh: ' })).toBe(true)
    expect(isRemoteExecutionHostRow({ connectionId: null, executionHostId: 'local' })).toBe(false)
    expect(isRemoteExecutionHostRow({})).toBe(false)
  })
})
