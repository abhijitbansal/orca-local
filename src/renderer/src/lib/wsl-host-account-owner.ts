import type { PublicKnownRuntimeEnvironment } from '../../../shared/runtime-environments'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'

type AccountOwnerEnvironments = readonly Pick<
  PublicKnownRuntimeEnvironment,
  'id' | 'orcadDeployment'
>[]

/** Who owns a host's provider accounts. A WSL host's orcad has no account services, so this
 *  desktop owns its distro's accounts as it does for a WSL pane (WSL-via-orcad D10). */
export type AccountOwner = {
  target: RuntimeClientTarget
  /** Set when `target` is this desktop standing in for that WSL host's distro. */
  wslHostDistro: string | null
}

const LOCAL_TARGET: RuntimeClientTarget = { kind: 'local' }

/** The distro behind a WSL host target; null for any other target. */
// Local-only: WSL-via-orcad hosts are removed, so no target stands in for a WSL host distro.
export function wslHostDistroForTarget(
  _target: RuntimeClientTarget,
  _environments: AccountOwnerEnvironments
): string | null {
  return null
}

/** `target` as an account owner, given the WSL host distro (if any) behind it. */
export function accountOwnerFor(
  target: RuntimeClientTarget,
  wslHostDistro: string | null
): AccountOwner {
  return wslHostDistro ? { target: LOCAL_TARGET, wslHostDistro } : { target, wslHostDistro: null }
}

export function resolveAccountOwner(
  target: RuntimeClientTarget,
  environments: AccountOwnerEnvironments
): AccountOwner {
  return accountOwnerFor(target, wslHostDistroForTarget(target, environments))
}
