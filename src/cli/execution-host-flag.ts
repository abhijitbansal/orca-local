import {
  normalizeExecutionHostId,
  parseExecutionHostId,
  type ParsedExecutionHost
} from '../shared/execution-host'
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
      `Invalid --host value: ${raw}. Expected local.`
    )
  }
  if (parsed.kind !== 'local') {
    // Why: ssh: and runtime: ids still parse (the unions are inert) but nothing can host them in
    // this build, so a legacy selector fails closed here rather than filtering to nothing.
    throw new RuntimeClientError(
      'invalid_argument',
      `Unsupported --host value: ${raw}. This build runs on this machine only; use --host local.`
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
