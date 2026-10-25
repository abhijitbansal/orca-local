import type { ExecutionHostId } from '../shared/execution-host'
import type { RepoKind } from '../shared/repo-types'
import type { RepoIcon } from '../shared/repo-icon'
import { resolveFilesystemRouteForHost } from './providers/execution-host-provider-dispatch'
import { detectGitRemoteIdentity } from './repo-git-remote-identity'
import { detectRepoFileIcon } from './repo-icon-file-detection'

export async function detectRepoIcon({
  repoPath,
  executionHostId
}: {
  repoPath: string
  executionHostId: ExecutionHostId
}): Promise<RepoIcon | undefined> {
  try {
    const route = resolveFilesystemRouteForHost(executionHostId)
    const fileIcon = await detectRepoFileIcon(repoPath, route)
    if (fileIcon) {
      return fileIcon
    }
  } catch {
    // Icon failures must not prevent repo creation.
  }
  return undefined
}

// A null upstream marks a resolved non-fork and prevents repeated probes.
export async function detectRepoIconAndUpstream({
  repoPath,
  kind,
  executionHostId
}: {
  repoPath: string
  kind: RepoKind
  executionHostId: ExecutionHostId
}) {
  const upstream = null
  const gitRemoteIdentity =
    kind === 'git' ? await detectGitRemoteIdentity(repoPath, executionHostId) : null
  const repoIcon = await detectRepoIcon({ repoPath, executionHostId })
  return {
    ...(repoIcon ? { repoIcon } : {}),
    ...(gitRemoteIdentity ? { gitRemoteIdentity } : {}),
    ...(kind === 'git' ? { upstream: upstream ?? null } : {})
  }
}
