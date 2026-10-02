import {
  normalizeExecutionHostId,
  parseExecutionHostId,
  toSshExecutionHostId,
  type ParsedExecutionHost
} from '../shared/execution-host'
import { resolveSshHostTargetId } from './host-selector-alternatives'
import type { RuntimeClient } from './runtime-client'
import { RuntimeClientError } from './runtime/types'

export function parseHostFlag(
  flags: Map<string, string | boolean>
): ParsedExecutionHost | undefined {
  if (!flags.has('host')) {
    return undefined
  }
  const raw = flags.get('host')
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new RuntimeClientError('invalid_argument', 'Missing value for --host')
  }
  const parsed = parseExecutionHostId(raw)
  if (!parsed) {
    throw new RuntimeClientError(
      'invalid_argument',
      `Invalid --host value: ${raw}. Expected local or ssh:<target-id>.`
    )
  }
  if (parsed.kind === 'runtime') {
    // Why fail closed: a runtime: id names a paired Orca server this build cannot dial; routing
    // it to the local runtime would answer for the wrong machine.
    throw new RuntimeClientError(
      'invalid_argument',
      `--host ${raw} names a paired Orca server; remote Orca runtimes are unsupported in this build. Use --host local or --host ssh:<target-id>.`
    )
  }
  return parsed
}

export function hostFilterMatchesHostId(
  filter: ParsedExecutionHost,
  candidateHostId: string | null | undefined
): boolean {
  return normalizeExecutionHostId(candidateHostId) === filter.id
}

// Why: `ssh:` reaches a machine the connected runtime owns, so it can only be checked against
// that runtime. Callers that act on a --host value run this so an unknown target fails loudly
// instead of quietly filtering to nothing.
export async function resolveHostFlagTarget(
  flags: Map<string, string | boolean>,
  client: RuntimeClient
): Promise<ParsedExecutionHost | undefined> {
  const host = parseHostFlag(flags)
  if (host?.kind !== 'ssh') {
    return host
  }
  const targetId = await resolveSshHostTargetId(client, host.targetId)
  return parseExecutionHostId(toSshExecutionHostId(targetId)) ?? host
}
