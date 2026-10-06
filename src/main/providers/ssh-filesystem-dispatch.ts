import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
import type { IFilesystemProvider } from './types'

export const SSH_FILESYSTEM_PROVIDER_UNAVAILABLE_MESSAGE =
  'Remote connection dropped. Click Reconnect on the SSH target before retrying.'

// Why kept: filesystem-watcher-handlers.ts subscribes at registration; a no-op unsubscribe leaves that file untouched.
export function onSshFilesystemProviderRegistered(
  _listener: (connectionId: string) => void
): () => void {
  return () => {}
}

export function registerSshFilesystemProvider(
  connectionId: string,
  _provider: IFilesystemProvider
): never {
  throw new LocalOnlyUnsupportedError('ssh', `registerSshFilesystemProvider(${connectionId})`)
}

export function unregisterSshFilesystemProvider(_connectionId: string): void {}

export function getSshFilesystemProvider(_connectionId: string): IFilesystemProvider | undefined {
  return undefined
}

export function requireSshFilesystemProvider(connectionId: string): IFilesystemProvider {
  throw new LocalOnlyUnsupportedError('ssh', `requireSshFilesystemProvider(${connectionId})`)
}
