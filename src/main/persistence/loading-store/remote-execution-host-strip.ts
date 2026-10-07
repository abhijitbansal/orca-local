import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../shared/execution-host'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { getWorktreeIdFromHostIdentity } from '../../../shared/worktree/host-qualified-identity'
import { getRepoIdFromWorktreeId } from '../../../shared/worktree/id'
import { worktreeWorkspaceKey } from '../../../shared/workspace-scope'

// A prefix test, not a parse: an id the parser rejects must strip, never fall back to local (I4).
const REMOTE_HOST_ID_PREFIX = /^(?:ssh|runtime):/

export const STRIPPED_REMOTE_STATE_KEYS = [
  'sshTargets',
  'sshTargetGenerationCounter',
  'deletedSshConfigAliases',
  'removedSshTargetTombstones',
  'sshRemotePtyLeases',
  'sshPtyConsumerRecoveries'
] as const

type StrippedRemoteStateKey = (typeof STRIPPED_REMOTE_STATE_KEYS)[number]

// What the defaults spread puts back; a legacy value equal to it is not a change worth a rewrite.
const STRIPPED_KEY_DEFAULTS: Record<StrippedRemoteStateKey, unknown> = {
  sshTargets: [],
  sshTargetGenerationCounter: 0,
  deletedSshConfigAliases: [],
  removedSshTargetTombstones: undefined,
  sshRemotePtyLeases: [],
  sshPtyConsumerRecoveries: []
}

export type RemoteExecutionHostStripResult = {
  changed: boolean
  strippedRepoIds: string[]
  /** targetIds of legacy consumer-recovery records; the caller drops their keychain blobs. */
  legacyRecoveryTargetIds: string[]
}

export function isRemoteHostId(value: unknown): boolean {
  return typeof value === 'string' && REMOTE_HOST_ID_PREFIX.test(value.trim())
}

export function isRemoteExecutionHostRow(row: {
  connectionId?: string | null
  executionHostId?: string | null
}): boolean {
  if (typeof row.connectionId === 'string' && row.connectionId.trim().length > 0) {
    return true
  }
  if (isRemoteHostId(row.executionHostId)) {
    return true
  }
  return getRepoExecutionHostId(row) !== LOCAL_EXECUTION_HOST_ID
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function differsFromDefault(key: StrippedRemoteStateKey, value: unknown): boolean {
  const fallback = STRIPPED_KEY_DEFAULTS[key]
  if (fallback === undefined) {
    return value !== undefined
  }
  if (Array.isArray(fallback)) {
    return !Array.isArray(value) || value.length > 0
  }
  return value !== fallback
}

// canonicalWorktreeIdentity: `wt2:${encodeURIComponent(hostId)}:${encodeURIComponent(instanceId)}`
function identityKeyHostIsRemote(identityKey: string): boolean {
  if (!identityKey.startsWith('wt2:')) {
    return false
  }
  const end = identityKey.indexOf(':', 4)
  const encodedHost = identityKey.slice(4, end === -1 ? undefined : end)
  try {
    return isRemoteHostId(decodeURIComponent(encodedHost))
  } catch {
    return false
  }
}

// composeWorktreeHostIdentity: `${hostId ?? ''}|${worktreeId}`
function aliasHostIsRemote(alias: string): boolean {
  const separator = alias.indexOf('|')
  return separator > 0 && isRemoteHostId(alias.slice(0, separator))
}

function filterRemoteRows<
  T extends { connectionId?: string | null; executionHostId?: string | null }
>(rows: readonly T[] | undefined, onStripped?: (row: T) => void): { rows: T[]; changed: boolean } {
  if (!Array.isArray(rows)) {
    return { rows: [], changed: false }
  }
  const kept = rows.filter((row) => {
    if (!row || typeof row !== 'object' || !isRemoteExecutionHostRow(row)) {
      return true
    }
    onStripped?.(row)
    return false
  })
  return { rows: kept, changed: kept.length !== rows.length }
}

/**
 * Drops every persisted row that names an `ssh:`/`runtime:` execution host, before any
 * normalizer, migration or GC can read it. Nothing is migrated to local: a remote checkout path
 * probed on this machine is a different (or missing) directory, and a remote PTY lease cannot be
 * reattached here. Legacy profiles from an upstream build hydrate to a local-only state in one
 * load; `changed` asks for a save so the rows also leave the SQLite document set.
 */
export function stripRemoteExecutionHostState(
  parsed: PersistedState
): RemoteExecutionHostStripResult {
  let changed = false
  const legacyRecoveryTargetIds: string[] = []
  const persistedValues = new Map<string, unknown>(Object.entries(parsed))

  for (const key of STRIPPED_REMOTE_STATE_KEYS) {
    if (!Object.hasOwn(parsed, key)) {
      continue
    }
    const value = persistedValues.get(key)
    if (key === 'sshPtyConsumerRecoveries' && Array.isArray(value)) {
      for (const record of value) {
        if (isRecord(record) && typeof record.targetId === 'string' && record.targetId.length > 0) {
          legacyRecoveryTargetIds.push(record.targetId)
        }
      }
    }
    // A key already at its default is inert; deleting only non-default values keeps a clean profile untouched.
    if (differsFromDefault(key, value)) {
      changed = true
      Reflect.deleteProperty(parsed, key)
    }
  }

  const strippedRepoIds = new Set<string>()
  const repos = filterRemoteRows(parsed.repos, (repo) => {
    if (typeof repo.id === 'string') {
      strippedRepoIds.add(repo.id)
    }
  })
  if (repos.changed) {
    parsed.repos = repos.rows
    changed = true
  }
  const projectGroups = filterRemoteRows(parsed.projectGroups)
  if (projectGroups.changed) {
    parsed.projectGroups = projectGroups.rows
    changed = true
  }
  const folderWorkspaces = filterRemoteRows(parsed.folderWorkspaces)
  if (folderWorkspaces.changed) {
    parsed.folderWorkspaces = folderWorkspaces.rows
    changed = true
  }
  if (Array.isArray(parsed.projectHostSetups)) {
    const setups = parsed.projectHostSetups.filter(
      (setup) =>
        !setup ||
        typeof setup !== 'object' ||
        (!isRemoteHostId(setup.hostId) && !isRemoteExecutionHostRow(setup))
    )
    if (setups.length !== parsed.projectHostSetups.length) {
      parsed.projectHostSetups = setups
      changed = true
    }
  }

  if (isRecord(parsed.worktreeMeta)) {
    for (const [key, meta] of Object.entries(parsed.worktreeMeta)) {
      const ownedByStrippedRepo = strippedRepoIds.has(getRepoIdFromWorktreeId(key))
      const onRemoteHost = isRecord(meta) && isRemoteHostId(meta.hostId)
      if (!ownedByStrippedRepo && !onRemoteHost) {
        continue
      }
      delete parsed.worktreeMeta[key]
      if (isRecord(parsed.worktreeLineageById)) {
        delete parsed.worktreeLineageById[key]
      }
      if (isRecord(parsed.workspaceLineageByChildKey)) {
        delete parsed.workspaceLineageByChildKey[worktreeWorkspaceKey(key)]
      }
      changed = true
    }
  }
  if (isRecord(parsed.worktreeMetaByIdentity)) {
    for (const identityKey of Object.keys(parsed.worktreeMetaByIdentity)) {
      if (identityKeyHostIsRemote(identityKey)) {
        delete parsed.worktreeMetaByIdentity[identityKey]
        changed = true
      }
    }
  }
  if (isRecord(parsed.worktreeIdentityAliases)) {
    for (const [alias, identityKeys] of Object.entries(parsed.worktreeIdentityAliases)) {
      const ownerRepoId = getRepoIdFromWorktreeId(getWorktreeIdFromHostIdentity(alias))
      if (aliasHostIsRemote(alias) || strippedRepoIds.has(ownerRepoId)) {
        delete parsed.worktreeIdentityAliases[alias]
        changed = true
        continue
      }
      if (!Array.isArray(identityKeys)) {
        continue
      }
      const kept = identityKeys.filter(
        (key) => typeof key !== 'string' || !identityKeyHostIsRemote(key)
      )
      if (kept.length !== identityKeys.length) {
        parsed.worktreeIdentityAliases[alias] = kept
        changed = true
      }
    }
  }

  // Every non-local partition is a remote host by definition; 'local' lives in workspaceSession.
  if (
    isRecord(parsed.workspaceSessionsByHostId) &&
    Object.keys(parsed.workspaceSessionsByHostId).length > 0
  ) {
    parsed.workspaceSessionsByHostId = {}
    changed = true
  }

  if (isRecord(parsed.retiredWorktreeNamesByNamespace)) {
    for (const namespaceKey of Object.keys(parsed.retiredWorktreeNamesByNamespace)) {
      if (isRemoteHostId(namespaceKey)) {
        delete parsed.retiredWorktreeNamesByNamespace[namespaceKey]
        changed = true
      }
    }
  }
  for (const repoId of strippedRepoIds) {
    if (
      isRecord(parsed.retiredWorktreeNamesByRepo) &&
      Object.hasOwn(parsed.retiredWorktreeNamesByRepo, repoId)
    ) {
      delete parsed.retiredWorktreeNamesByRepo[repoId]
      changed = true
    }
    if (isRecord(parsed.sparsePresetsByRepo) && Object.hasOwn(parsed.sparsePresetsByRepo, repoId)) {
      delete parsed.sparsePresetsByRepo[repoId]
      changed = true
    }
  }

  return { changed, strippedRepoIds: [...strippedRepoIds], legacyRecoveryTargetIds }
}
