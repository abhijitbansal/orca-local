import type { RuntimeClient } from './runtime-client'

export type SshTargetSummary = {
  id: string
  label: string
  remotePlatform?: 'linux' | 'darwin' | 'win32'
  connected?: boolean
  connectionStatus?: string
}

// Why: SSH target ids are machine-generated (`ssh-<timestamp>-<random>`), so the name a person
// or an agent actually knows is the label. Looking a name up as an id alone reports "not found"
// for a target that is sitting right there.
export function findSshTargetByName(
  targets: readonly SshTargetSummary[],
  name: string
): SshTargetSummary | undefined {
  const byId = targets.find((target) => target.id === name)
  if (byId) {
    return byId
  }
  const byLabel = matchesByLabel(targets, name)
  // Why: two targets can share a label. Picking the first would silently choose a machine for
  // the caller — the failure this whole selector path exists to prevent — so an ambiguous name
  // resolves to nothing and the caller is told to use an id.
  return byLabel.length === 1 ? byLabel[0] : undefined
}

function matchesByLabel(targets: readonly SshTargetSummary[], name: string): SshTargetSummary[] {
  const wanted = name.trim().toLowerCase()
  return targets.filter((target) => target.label.trim().toLowerCase() === wanted)
}

export function ambiguousSshTargets(
  targets: readonly SshTargetSummary[],
  name: string
): SshTargetSummary[] {
  const byLabel = matchesByLabel(targets, name)
  return byLabel.length > 1 ? byLabel : []
}

// Why: only display identity crosses this boundary — the RPC deliberately withholds addresses
// and credentials — and an enumeration failure must never mask the error we are explaining.
export async function listSshTargets(client: RuntimeClient): Promise<SshTargetSummary[]> {
  try {
    const result = await client.call<{ targets: SshTargetSummary[] }>('ssh.listTargetSummaries')
    return result.result.targets
  } catch (error) {
    // Why: hosts predating listTargetSummaries still answer listTargets, and both are served by
    // the same summariser. Without this an old host looks like one with no SSH targets at all,
    // which would reject a target id that is actually valid there.
    if (error instanceof Error && 'code' in error && error.code === 'method_not_found') {
      try {
        const legacy = await client.call<{ targets: SshTargetSummary[] }>('ssh.listTargets')
        return await enrichLegacySshTargetStates(client, legacy.result.targets)
      } catch {
        return []
      }
    }
    return []
  }
}

async function enrichLegacySshTargetStates(
  client: RuntimeClient,
  targets: SshTargetSummary[]
): Promise<SshTargetSummary[]> {
  return Promise.all(
    targets.map(async (target) => {
      try {
        const response = await client.call<{
          state: {
            status?: string
            remotePlatform?: 'linux' | 'darwin' | 'win32'
          } | null
        }>('ssh.getState', { targetId: target.id })
        const state = response.result.state
        return {
          ...target,
          ...(state?.status === undefined
            ? {}
            : { connected: state.status === 'connected', connectionStatus: state.status }),
          ...(state?.remotePlatform === undefined ? {} : { remotePlatform: state.remotePlatform })
        }
      } catch {
        return target
      }
    })
  )
}

// Why: `--host ssh:<id>` was never validated, so an unknown target answered ok:true with an
// empty list — a silent wrong-machine answer. And since
// target ids are machine-generated (`ssh-<timestamp>-<random>`), the label a caller actually
// knows never matches one, so this fires on the common spelling rather than a rare typo.
// Resolving the label and naming the alternative is what makes the failure recoverable.
export async function resolveSshHostTargetId(
  client: RuntimeClient,
  targetId: string
): Promise<string> {
  const targets = await listSshTargets(client)
  const matched = findSshTargetByName(targets, targetId)
  if (matched) {
    return matched.id
  }
  const { RuntimeClientError } = await import('./runtime/types.js')
  const ambiguous = ambiguousSshTargets(targets, targetId)
  if (ambiguous.length > 0) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Ambiguous SSH target in --host ssh:${targetId}: ${ambiguous.length} targets share that label. Use the target id.`,
      {
        knownSshTargets: ambiguous,
        nextSteps: ambiguous.map((target) => `Use --host ssh:${target.id} for ${target.label}.`)
      }
    )
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `Unknown SSH target in --host ssh:${targetId}: this Orca host has no SSH target named or with id ${targetId}.`,
    {
      knownSshTargets: targets,
      nextSteps:
        targets.length > 0
          ? [`Known SSH targets: ${targets.map((target) => target.label).join(', ')}.`]
          : ['This Orca host has no SSH targets registered.']
    }
  )
}
