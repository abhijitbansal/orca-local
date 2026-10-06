import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
import type { SshGitProvider } from './ssh-git-provider'

// Why a stub: the SSH connection layer is removed, so no git provider is ever registered. The ~40
// `if (connectionId)` callers keep compiling; every arm resolves to "unavailable" and never to local (I4).
export const SSH_GIT_PROVIDER_UNAVAILABLE_MESSAGE =
  'Remote connection dropped. Click Reconnect on the SSH target before retrying.'

export function registerSshGitProvider(connectionId: string, _provider: SshGitProvider): never {
  throw new LocalOnlyUnsupportedError('ssh', `registerSshGitProvider(${connectionId})`)
}

export function unregisterSshGitProvider(_connectionId: string): void {}

export function getSshGitProviderGeneration(_connectionId: string): number {
  return 0
}

export function getSshGitProvider(_connectionId: string): SshGitProvider | undefined {
  return undefined
}

export function requireSshGitProvider(connectionId: string): SshGitProvider {
  throw new LocalOnlyUnsupportedError('ssh', `requireSshGitProvider(${connectionId})`)
}
