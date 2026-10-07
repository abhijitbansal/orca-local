import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type { RuntimeStatus } from '../../../shared/runtime-types'
import type { RuntimeCapability } from '../../../shared/protocol-version'
import { withBrowserPaneUiRuntimeRpcSource } from '../../../shared/runtime-rpc-feature-interaction-source'
import { createRuntimeRpcAbortError } from './abortable-runtime-environment-call'
import { createUnsupportedInLocalBuildError } from './runtime-environment-unsupported'
import { RuntimeRpcCallError, unwrapRuntimeRpcResult } from './runtime-rpc-result'
import type { RuntimeClientTarget } from './runtime-client-target'

export {
  getActiveRuntimeTarget,
  settingsForRuntimeOwner,
  type RuntimeClientTarget
} from './runtime-client-target'
export {
  hasRuntimeRpcErrorCode,
  RuntimeRpcCallError,
  unwrapRuntimeRpcResult
} from './runtime-rpc-result'

// Why: mobile-scope device tokens are denied non-allowlisted runtime methods
// with code 'forbidden'. Callers use this to surface one scope-mismatch banner
// instead of silently swallowing the failure into empty/retry-looping UI.
export function isRuntimeScopeForbiddenError(error: unknown): boolean {
  return error instanceof RuntimeRpcCallError && error.code === 'forbidden'
}

export async function callRuntimeRpc<TResult>(
  target: RuntimeClientTarget,
  method: string,
  params?: unknown,
  options: {
    timeoutMs?: number
    suppressFeatureInteraction?: boolean
    signal?: AbortSignal
    // Why: environment-only knobs, ignored now; kept so the inert environment branches still compile.
    reuseRecentCompatibilityFailure?: boolean
    skipCompatibilityCheck?: boolean
    expectedEnvironmentPairingRevision?: number
    expectedEnvironmentRuntimeId?: string
  } = {}
): Promise<TResult> {
  if (target.kind !== 'local') {
    throw createUnsupportedInLocalBuildError()
  }
  if (options.signal?.aborted) {
    throw createRuntimeRpcAbortError()
  }
  const nextParams = options.suppressFeatureInteraction
    ? withBrowserPaneUiRuntimeRpcSource(params)
    : params
  const response = await window.api.runtime.call({ method, params: nextParams })
  return unwrapRuntimeRpcResult<TResult>(response as RuntimeRpcResponse<TResult>)
}

// Why: kept as fail-closed stubs so environment-target branches in kept callers compile;
// no paired runtime exists to probe, so every capability reads as unsupported.
export function getRuntimeEnvironmentStatus(
  _environmentId: string,
  _timeoutMs?: number
): Promise<RuntimeStatus> {
  return Promise.reject(createUnsupportedInLocalBuildError())
}

export function runtimeEnvironmentSupportsCapability(
  _environmentId: string,
  _capability: RuntimeCapability,
  _timeoutMs?: number
): Promise<boolean> {
  return Promise.resolve(false)
}

export function assertRuntimeEnvironmentCapability(
  _environmentId: string,
  _capability: RuntimeCapability,
  _message: string,
  _timeoutMs?: number
): Promise<void> {
  return Promise.reject(createUnsupportedInLocalBuildError())
}
