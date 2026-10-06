export const LOCAL_ONLY_UNSUPPORTED_CODE = 'unsupported_in_local_only_build' as const

export type LocalOnlyUnsupportedCapability = 'ssh' | 'runtime'

// Why: invariant I4 — a legacy `ssh:`/`runtime:` value reaching a seam fails closed and never falls back to local.
export class LocalOnlyUnsupportedError extends Error {
  readonly code = LOCAL_ONLY_UNSUPPORTED_CODE

  constructor(
    readonly capability: LocalOnlyUnsupportedCapability,
    readonly operation: string
  ) {
    super(`${capability} is unsupported in this build (${operation})`)
    this.name = 'LocalOnlyUnsupportedError'
  }
}

export function isLocalOnlyUnsupportedError(error: unknown): error is LocalOnlyUnsupportedError {
  return error instanceof LocalOnlyUnsupportedError
}
