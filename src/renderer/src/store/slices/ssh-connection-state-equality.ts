import type { SshConnectionState } from '../../../../shared/ssh-types'

export function sshConnectionStatesEqual(
  a: SshConnectionState | undefined,
  b: SshConnectionState
): boolean {
  return (
    a?.targetId === b.targetId &&
    a?.status === b.status &&
    a?.error === b.error &&
    a?.reconnectAttempt === b.reconnectAttempt &&
    a?.providerEpoch === b.providerEpoch &&
    a?.connectionGeneration === b.connectionGeneration &&
    a?.supportsFolderDownload === b.supportsFolderDownload &&
    a?.remotePlatform === b.remotePlatform &&
    JSON.stringify(a?.plainSsh ?? null) === JSON.stringify(b.plainSsh ?? null)
  )
}
