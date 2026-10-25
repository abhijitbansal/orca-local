/** SSH remotes are removed in this build, so work routed to an `ssh:<target>` host fails closed. */
export const SSH_HOST_NOT_SERVED_MESSAGE = 'SSH remotes are not supported in this build.'

/** The wording SSH review-head fetches have always used. */
export const SSH_GIT_RECONNECT_MESSAGE =
  'SSH Git provider is not available. Reconnect to this target and try again.'

/** The wording project registration on an SSH target has always used. */
export function sshTargetNotConnectedMessage(connectionId: string): string {
  return `SSH connection "${connectionId}" not found or not connected`
}

// Why no custom `name`: Electron IPC rejects with `${error}`, so the renderer keeps seeing
// `Error: <message>`, the text these paths showed before the typed error existed.
export class SshHostNotServedError extends Error {
  readonly code = 'ssh_host_not_served'

  constructor(
    readonly connectionId: string,
    message: string = SSH_HOST_NOT_SERVED_MESSAGE
  ) {
    super(message)
  }
}
