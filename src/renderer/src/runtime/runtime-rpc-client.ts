import { waitForPromiseWithSignal } from '../../../shared/abort-signal-reason'
import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type { RuntimeStatus } from '../../../shared/runtime-types'
import type { RuntimeCapability } from '../../../shared/protocol-version'
import { withBrowserPaneUiRuntimeRpcSource } from '../../../shared/runtime-rpc-feature-interaction-source'
import { isRuntimeStatusCompatible } from './runtime-protocol-compat'
import { createRuntimeRpcAbortError } from './abortable-runtime-environment-call'
import { createUnsupportedInLocalBuildError } from './runtime-environment-unsupported'
import { unwrapRuntimeRpcResult } from './runtime-rpc-result'
import { captureRuntimeEnvironmentRequestRevision } from './runtime-environment-revision'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

const RUNTIME_COMPATIBILITY_CACHE_MAX = 32
const RECENT_RUNTIME_COMPATIBILITY_FAILURE_TTL_MS = 60_000

type RuntimeCompatibilityCacheEntry = {
  check: Promise<void>
  failedAt: number | null
  // False while probing so recovery can drop a doomed pending compatibility check.
  provenCompatible: boolean
  status: RuntimeStatus | null
  statusCheckedAt: number | null
}

const runtimeCompatibilityChecks = new Map<string, RuntimeCompatibilityCacheEntry>()

/** A pending probe by default; an observed status is proof of itself. */
function compatibilityEntry(
  status: RuntimeStatus | null = null,
  provenCompatible = status !== null
): RuntimeCompatibilityCacheEntry {
  const statusCheckedAt = status ? Date.now() : null
  return { check: Promise.resolve(), failedAt: null, provenCompatible, status, statusCheckedAt }
}

export async function callRuntimeRpc<TResult>(
  target: RuntimeClientTarget,
  method: string,
  params?: unknown,
  options: {
    timeoutMs?: number
    suppressFeatureInteraction?: boolean
    reuseRecentCompatibilityFailure?: boolean
    skipCompatibilityCheck?: boolean
    signal?: AbortSignal
    expectedEnvironmentPairingRevision?: number
    expectedEnvironmentRuntimeId?: string
    beforeSend?: () => void
  } = {}
): Promise<TResult> {
  if (options.signal?.aborted) {
    throw createRuntimeRpcAbortError()
  }
  const expectedEnvironmentPairingRevision =
    target.kind === 'environment'
      ? captureRuntimeEnvironmentRequestRevision(
          target.environmentId,
          options.expectedEnvironmentPairingRevision
        )
      : undefined
  if (
    target.kind === 'environment' &&
    method !== 'status.get' &&
    options.skipCompatibilityCheck !== true
  ) {
    await waitForPromiseWithSignal(
      ensureRuntimeEnvironmentCompatible(target.environmentId, {
        ...options,
        expectedEnvironmentPairingRevision
      }),
      options.signal
    )
  }
  if (options.signal?.aborted) {
    throw createRuntimeRpcAbortError()
  }
  const nextParams = options.suppressFeatureInteraction
    ? withBrowserPaneUiRuntimeRpcSource(params)
    : params
  options.beforeSend?.()
  const response =
    target.kind === 'local'
      ? await window.api.runtime.call({ method, params: nextParams })
      : (() => {
          // Local-only: remote runtimes are removed, so a runtime: owner fails closed.
          throw createUnsupportedInLocalBuildError()
        })()
  return unwrapRuntimeRpcResult<TResult>(response as RuntimeRpcResponse<TResult>)
}

export async function ensureRuntimeEnvironmentCompatible(
  environmentId: string,
  options: {
    timeoutMs?: number
    reuseRecentCompatibilityFailure?: boolean
    expectedEnvironmentPairingRevision?: number
  } = {}
): Promise<void> {
  const cached = getCachedRuntimeCompatibilityCheck(environmentId, options)
  if (cached) {
    return cached.check
  }
  const entry = compatibilityEntry()
  const check = (async () => {
    // Local-only: remote runtimes are removed, so no environment can be probed.
    throw createUnsupportedInLocalBuildError()
  })()
  entry.check = check
  rememberRuntimeEnvironmentCompatibility(environmentId, entry)
  try {
    await check
    if (runtimeCompatibilityChecks.get(environmentId) === entry) {
      entry.provenCompatible = true
    }
  } catch (error) {
    if (runtimeCompatibilityChecks.get(environmentId) === entry) {
      // Why: startup asks each remote for repos, groups, then folders; an
      // offline runtime should pay one timeout during that burst, not three.
      entry.failedAt = Date.now()
    }
    throw error
  }
}

function getCachedRuntimeCompatibilityCheck(
  environmentId: string,
  options: { reuseRecentCompatibilityFailure?: boolean }
): RuntimeCompatibilityCacheEntry | null {
  const cached = runtimeCompatibilityChecks.get(environmentId)
  if (!cached) {
    return null
  }
  if (
    cached.failedAt !== null &&
    Date.now() - cached.failedAt >= RECENT_RUNTIME_COMPATIBILITY_FAILURE_TTL_MS
  ) {
    runtimeCompatibilityChecks.delete(environmentId)
    return null
  }
  if (cached.failedAt !== null && options.reuseRecentCompatibilityFailure !== true) {
    return null
  }
  runtimeCompatibilityChecks.delete(environmentId)
  runtimeCompatibilityChecks.set(environmentId, cached)
  return cached
}

function rememberRuntimeEnvironmentCompatibility(
  environmentId: string,
  entry: RuntimeCompatibilityCacheEntry
): void {
  // Why: saved/removed remote runtimes can churn through unique ids in long
  // renderer sessions; compatibility cache entries should not grow forever.
  runtimeCompatibilityChecks.delete(environmentId)
  runtimeCompatibilityChecks.set(environmentId, entry)
  while (runtimeCompatibilityChecks.size > RUNTIME_COMPATIBILITY_CACHE_MAX) {
    const oldest = runtimeCompatibilityChecks.keys().next().value
    if (oldest === undefined) {
      break
    }
    runtimeCompatibilityChecks.delete(oldest)
  }
}

// Why: a live status answer invalidates failures and pending probes from the
// dropped connection; only proven-compatible successes remain reusable.
export function clearRecentRuntimeCompatibilityFailure(
  environmentId: string,
  observedStatus?: RuntimeStatus
): void {
  const trimmed = environmentId.trim()
  if (!trimmed) {
    return
  }
  const cached = runtimeCompatibilityChecks.get(trimmed)
  if (
    cached &&
    (!cached.provenCompatible ||
      (observedStatus &&
        cached.status !== null &&
        cached.status.runtimeId !== observedStatus.runtimeId))
  ) {
    // Why: a saved endpoint can reconnect to a different runtime version; its predecessor's
    // positive capability verdict must not route a structured request to the replacement.
    runtimeCompatibilityChecks.delete(trimmed)
    // Why (STA-11921): the host publishes a probe's answer before settling it, so the detached
    // probe never records it; the published answer is the proof synchronous readers need.
    const answersPendingProbe = cached.failedAt === null && !cached.provenCompatible
    if (observedStatus && answersPendingProbe && isRuntimeStatusCompatible(observedStatus)) {
      rememberRuntimeEnvironmentCompatibility(trimmed, compatibilityEntry(observedStatus))
    }
  }
}

export function clearRuntimeCompatibilityCache(environmentId?: string | null): void {
  const trimmed = environmentId?.trim()
  if (trimmed) {
    runtimeCompatibilityChecks.delete(trimmed)
    return
  }
  runtimeCompatibilityChecks.clear()
}

export function markRuntimeEnvironmentCompatible(environmentId: string): void {
  const trimmed = environmentId.trim()
  if (!trimmed) {
    return
  }
  rememberRuntimeEnvironmentCompatibility(trimmed, compatibilityEntry(null, true))
}

// Why: kept as fail-closed stubs so environment-target branches in kept callers compile;
// no paired runtime exists to probe, so every capability reads as unsupported.
export function getRuntimeEnvironmentStatus(
  _environmentId: string,
  _timeoutMs?: number
): Promise<RuntimeStatus> {
  return Promise.reject(createUnsupportedInLocalBuildError())
}

/** The capability as last probed, without waiting (for synchronous terminal replies); null before
 *  the environment's first status probe. */
export function readCachedRuntimeEnvironmentCapability(
  environmentId: string,
  capability: RuntimeCapability
): boolean | null {
  const status = runtimeCompatibilityChecks.get(environmentId.trim())?.status
  return status ? status.capabilities?.includes(capability) === true : null
}

export function runtimeEnvironmentSupportsCapability(
  _environmentId: string,
  _capability: RuntimeCapability,
  _timeoutMs?: number
): Promise<boolean> {
  return Promise.reject(createUnsupportedInLocalBuildError())
}

export function assertRuntimeEnvironmentCapability(
  _environmentId: string,
  _capability: RuntimeCapability,
  _message: string,
  _timeoutMs?: number
): Promise<void> {
  return Promise.reject(createUnsupportedInLocalBuildError())
}

export function clearRuntimeCompatibilityCacheForTests(): void {
  clearRuntimeCompatibilityCache()
}
