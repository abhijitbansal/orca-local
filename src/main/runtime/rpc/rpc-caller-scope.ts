/**
 * Which permissions each kind of caller holds, checked once by the dispatcher for every transport.
 *
 * Local-only build: every caller is this host's own desktop or owner-token CLI. Paired desktops,
 * web clients and phones do not exist here, so there is no non-owner row.
 */
import type { RpcMethodPermission } from './rpc-method-permission'

export type RpcCallerScope = { kind: 'owner' }

export const OWNER_RPC_CALLER_SCOPE: RpcCallerScope = { kind: 'owner' }

/** Returns the refusal message, or null when the caller may invoke the method. */
export function denyRpcMethodForCaller(
  _scope: RpcCallerScope,
  _methodName: string,
  _permission: RpcMethodPermission | undefined
): string | null {
  return null
}
