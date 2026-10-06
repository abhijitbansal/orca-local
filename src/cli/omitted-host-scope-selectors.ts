import {
  parseExecutionHostId,
  type ExecutionHostId,
  type ParsedExecutionHost
} from '../shared/execution-host'
import type { RuntimeListingHostScope } from '../shared/runtime-listing-host-scope'

export type OmittedHostScopeSelector = {
  hostId: ExecutionHostId
  /** The flag that routes a follow-up query to this host, or null when it names nothing here. */
  selector: string | null
}

/** A host scope annotated on this machine. The runtime never sends `omittedHostSelectors`. */
export type ListingHostScopeWithSelectors = RuntimeListingHostScope & {
  omittedHostSelectors?: OmittedHostScopeSelector[]
}

export type WithAnnotatedHostScope<TResult> = Omit<TResult, 'hostScope'> & {
  hostScope?: ListingHostScopeWithSelectors
}

/**
 * Resolves how to reach each host a listing did not cover.
 *
 * `hostScope` is the documented way to complete a partial listing, but `omittedHostIds` is built
 * from the runtime's own bookkeeping — repos, folder workspaces, and workspace sessions — so it
 * names `runtime:` ids for servers this build cannot reach. An agent looping over the list to
 * finish the job hard-errors on those.
 *
 * The ids are kept rather than filtered: dropping one would shrink what the listing admits it did
 * not cover. A `null` selector marks the ones this machine cannot name, which is the part a
 * caller needs. This answers "can I select it", never "is it up".
 */
export function resolveOmittedHostScopeSelectors(
  omittedHostIds: readonly ExecutionHostId[]
): OmittedHostScopeSelector[] {
  return omittedHostIds.map((hostId) => ({
    hostId,
    selector: resolveSelector(parseExecutionHostId(hostId))
  }))
}

function resolveSelector(host: ParsedExecutionHost | null): string | null {
  return host?.kind === 'local' ? '--host local' : null
}

/** Renders a scope line; an absent scope means the host never reported one, not full coverage. */
export function formatListingHostScope(scope: ListingHostScopeWithSelectors | undefined): string {
  if (!scope) {
    return 'scope: unverifiable — this host does not report which hosts it lists'
  }
  const covered = scope.hostIds.length > 0 ? scope.hostIds.join(', ') : 'none'
  if (scope.omittedHostIds.length === 0) {
    return `scope: ${covered}`
  }
  const selectorByHostId = new Map(
    (scope.omittedHostSelectors ?? []).map((entry) => [entry.hostId, entry.selector])
  )
  const omitted = scope.omittedHostIds.map((hostId) => {
    if (!selectorByHostId.has(hostId)) {
      return hostId
    }
    const selector = selectorByHostId.get(hostId)
    return selector ? `${hostId} (${selector})` : `${hostId} (not selectable from this machine)`
  })
  return `scope: ${covered} — not covered: ${omitted.join(', ')}`
}

/** Attaches the resolved selectors in place; a listing with no omitted hosts pays nothing. */
export function annotateOmittedHostScope(result: {
  hostScope?: ListingHostScopeWithSelectors
}): void {
  const scope = result.hostScope
  if (!scope || scope.omittedHostIds.length === 0) {
    return
  }
  scope.omittedHostSelectors = resolveOmittedHostScopeSelectors(scope.omittedHostIds)
}
