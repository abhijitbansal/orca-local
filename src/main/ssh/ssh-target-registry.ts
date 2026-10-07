import type { SshConnectionState, SshTarget } from '../../shared/ssh-types'
import type { SshChannelMultiplexer } from './ssh-channel-multiplexer'
import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'

// Why a stub: no SSH target can be registered or connected in this build. Readers
// (agent-detection, client-events, orca-runtime-*, nested-repo-*, remote-repo-*) keep compiling.
export function connectRegisteredSshTarget(targetId: string): Promise<SshConnectionState> {
  return Promise.reject(
    new LocalOnlyUnsupportedError('ssh', `connectRegisteredSshTarget(${targetId})`)
  )
}

export function getRegisteredSshState(_targetId: string): SshConnectionState | undefined {
  return undefined
}

export function listRegisteredSshTargets(): SshTarget[] {
  return []
}

export function listRegisteredRemovedSshTargetLabels(): Record<string, string> {
  return {}
}

export function getActiveMultiplexer(_connectionId: string): SshChannelMultiplexer | undefined {
  return undefined
}
