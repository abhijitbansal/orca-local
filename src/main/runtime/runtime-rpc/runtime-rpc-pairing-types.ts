import type { OrcaRuntimeService } from '../orca-runtime'
import type { RpcAnyMethodDeclaration } from '../rpc/core'

export type OrcaRuntimeRpcServerOptions = {
  runtime: OrcaRuntimeService
  userDataPath: string
  pid?: number
  platform?: NodeJS.Platform
  // Why: test-only overrides for the two constants below; production must not pass these (defaults set by §3.1).
  keepaliveIntervalMs?: number
  longPollCap?: number
  // Why: test-only override for the ownership reclaim cadence.
  metadataOwnershipPollMs?: number
  // Why: tests may inject inert protocol stages before production authorization registers them.
  methods?: readonly RpcAnyMethodDeclaration[]
}
