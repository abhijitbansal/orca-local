// Local-only stub: SSH targets are not supported in this build, so no target or connection exists.
import type { SshConnectionState, SshTarget } from '../../../shared/ssh-types'

export function getSshTargetRegistryStore(): { listTargets(): SshTarget[] } | undefined {
  return undefined
}

export function getRegisteredSshState(_targetId: string): SshConnectionState | undefined {
  return undefined
}

export function listRegisteredSshTargets(): SshTarget[] {
  return []
}

export function getSshConnectionManager():
  | { getAllStates(): Map<string, SshConnectionState> }
  | undefined {
  return undefined
}
