import type { LinearConnectionStatus } from '../../../../shared/linear/workspace-types'

type LinearSourceConnection = { status: LinearConnectionStatus | null; loaded: boolean }

const NO_LINEAR_CONNECTION: LinearSourceConnection = { status: null, loaded: true }

// Local-only stub: Linear is removed, so there is never a connection to read.
export function useLinearSourceConnection(_args: unknown): LinearSourceConnection {
  return NO_LINEAR_CONNECTION
}
