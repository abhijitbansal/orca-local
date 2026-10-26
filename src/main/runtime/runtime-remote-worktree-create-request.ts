import type { CreateWorktreeResult } from '../../shared/worktree/create-types'
import type { Repo } from '../../shared/repo-types'
import { getRepoRoutingConnectionId } from '../../shared/execution-host'
import { SshHostNotServedError } from '../providers/ssh-host-not-served-error'
import type { RuntimeStore } from './runtime-store-contract'
import type { RuntimeManagedWorktreeCreateArgs } from './runtime-managed-worktree-create-types'
import type { WorktreeStartupFollowup } from './runtime-worktree-agent-startup'

export type RuntimeRemoteWorktreeCreateArgs = Omit<
  RuntimeManagedWorktreeCreateArgs,
  'repoSelector'
> & {
  startupFollowup?: WorktreeStartupFollowup
}

export async function requestRuntimeRemoteWorktree(
  repo: Repo,
  _args: RuntimeRemoteWorktreeCreateArgs,
  _store: RuntimeStore
): Promise<CreateWorktreeResult> {
  // Why: SSH remotes are removed; a connection-owned repo fails closed and never creates locally.
  throw new SshHostNotServedError(getRepoRoutingConnectionId(repo) ?? '')
}
