import type { BrowserWindow } from 'electron'
import type { Store } from '../persistence'
import type { OrcaRuntimeService } from '../runtime/orca-runtime'
import type { ExecutionHostId } from '../../shared/execution-host'
import type { RemoteHostPlatform } from '../ssh/ssh-remote-platform'
import type { SshTarget } from '../../shared/ssh-types'
import type {
  SshAiVaultRelayListParams,
  SshAiVaultRelayTitleParams
} from '../../shared/ssh-ai-vault-relay'
import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'

// Why re-exported: ai-vault, nested-repo and precheck callers import the registry through this module.
export {
  connectRegisteredSshTarget,
  getActiveMultiplexer,
  getRegisteredSshState,
  listRegisteredRemovedSshTargetLabels,
  listRegisteredSshTargets
} from '../ssh/ssh-target-registry'

export type SshRelayAiVaultHostInfo = {
  targetId: string
  executionHostId: ExecutionHostId
  remoteHome: string
  hostPlatform: RemoteHostPlatform
}

export function getActiveSshAiVaultHostInfo(_targetId: string): SshRelayAiVaultHostInfo | null {
  return null
}

export function getActiveSshAiVaultHostInfos(): SshRelayAiVaultHostInfo[] {
  return []
}

export function requestActiveSshSessionSearch(
  targetId: string,
  method: string,
  _params: unknown
): Promise<unknown> {
  return Promise.reject(
    new LocalOnlyUnsupportedError('ssh', `requestActiveSshSessionSearch(${targetId}, ${method})`)
  )
}

export function requestActiveSshAiVaultSessionList(
  targetId: string,
  _params: SshAiVaultRelayListParams,
  _options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<unknown> {
  return Promise.reject(
    new LocalOnlyUnsupportedError('ssh', `requestActiveSshAiVaultSessionList(${targetId})`)
  )
}

export function requestActiveSshAiVaultSessionTitles(
  targetId: string,
  _params: SshAiVaultRelayTitleParams,
  _options: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<unknown> {
  return Promise.reject(
    new LocalOnlyUnsupportedError('ssh', `requestActiveSshAiVaultSessionTitles(${targetId})`)
  )
}

// Why a no-op with the upstream signature: the 17 `ssh:*` channels and `ssh:submitCredential` left with
// the connection manager; keeping the call at attach-main-window-services.ts:116 leaves that file untouched.
export function registerSshHandlers(
  _store: Store,
  _getMainWindow: () => BrowserWindow | null,
  _runtime?: OrcaRuntimeService
): void {}

export function resetSshHandlerStateForTests(): Promise<void> {
  return Promise.resolve()
}

export type SshConnectionStoreView = {
  getTarget(targetId: string): SshTarget | undefined
  listTargets(): SshTarget[]
}

// Why kept: ipc/remote-workspace*.ts still reads the store through this accessor; null means "no targets".
export function getSshConnectionStore(): SshConnectionStoreView | null {
  return null
}
