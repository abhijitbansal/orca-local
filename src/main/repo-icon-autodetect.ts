import { readFile, stat } from 'node:fs/promises'
import type { ExecutionHostId } from '../shared/execution-host'
import type { GitHubRepositoryIdentity } from '../shared/github/pull-request-types'
import type { RepoKind } from '../shared/repo-types'
import { faviconUrlFromWebsite, type RepoIcon } from '../shared/repo-icon'
import { resolveFilesystemRouteForHost } from './providers/execution-host-provider-dispatch'
import type { IFilesystemProvider } from './providers/types'
import { detectGitRemoteIdentity } from './repo-git-remote-identity'
import { detectRepoFileIcon } from './repo-icon-file-detection'
import { joinWorktreeRelativePath } from './runtime/runtime-relative-paths'

const WEBSITE_HOSTS_TO_SKIP = new Set([
  'github.com',
  'www.github.com',
  'gitlab.com',
  'www.gitlab.com',
  'bitbucket.org',
  'www.bitbucket.org'
])

function shouldUseWebsiteFavicon(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return !WEBSITE_HOSTS_TO_SKIP.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

function packageHomepageIcon(packageJson: unknown): RepoIcon | null {
  if (!packageJson || typeof packageJson !== 'object') {
    return null
  }
  const homepage = (packageJson as { homepage?: unknown }).homepage
  if (typeof homepage !== 'string' || !shouldUseWebsiteFavicon(homepage)) {
    return null
  }
  const src = faviconUrlFromWebsite(homepage)
  return src ? { type: 'image', src, source: 'favicon', label: 'Website favicon' } : null
}

async function detectLocalPackageHomepageIcon(repoPath: string): Promise<RepoIcon | null> {
  try {
    const packageJsonPath = joinWorktreeRelativePath(repoPath, 'package.json')
    const info = await stat(packageJsonPath)
    if (!info.isFile() || info.size > 128 * 1024) {
      return null
    }
    return packageHomepageIcon(JSON.parse(await readFile(packageJsonPath, 'utf8')))
  } catch {
    return null
  }
}

async function detectRemotePackageHomepageIcon(
  repoPath: string,
  fsProvider: IFilesystemProvider
): Promise<RepoIcon | null> {
  try {
    const packageJsonPath = joinWorktreeRelativePath(repoPath, 'package.json')
    const info = await fsProvider.stat(packageJsonPath)
    if (info.type !== 'file' || info.size > 128 * 1024) {
      return null
    }
    const result = await fsProvider.readFile(packageJsonPath)
    if (result.isBinary) {
      return null
    }
    return packageHomepageIcon(JSON.parse(result.content))
  } catch {
    return null
  }
}

export async function detectGitHubAvatarIcon(
  _repoPath: string,
  _executionHostId: ExecutionHostId,
  _upstream?: GitHubRepositoryIdentity | null
): Promise<RepoIcon | null> {
  return null
}

export async function detectRepoIcon({
  repoPath,
  kind,
  executionHostId,
  upstream
}: {
  repoPath: string
  kind: RepoKind
  executionHostId: ExecutionHostId
  upstream?: GitHubRepositoryIdentity | null
}): Promise<RepoIcon | undefined> {
  try {
    const route = resolveFilesystemRouteForHost(executionHostId)
    const fileIcon = await detectRepoFileIcon(repoPath, route)
    if (fileIcon) {
      return fileIcon
    }

    // Why the same route again: a remote repoPath with no provider, and every runtime host, must
    // not be probed on the client filesystem — a same-named local path answers for the wrong repo.
    const remoteProvider = route.kind === 'ssh' ? route.provider : null
    const homepageIcon = remoteProvider
      ? await detectRemotePackageHomepageIcon(repoPath, remoteProvider)
      : route.kind === 'local'
        ? await detectLocalPackageHomepageIcon(repoPath)
        : null
    if (homepageIcon) {
      return homepageIcon
    }

    if (kind === 'git') {
      return (await detectGitHubAvatarIcon(repoPath, executionHostId, upstream)) ?? undefined
    }
  } catch {
    // Repo creation must not fail because a best-effort icon probe failed.
  }
  return undefined
}

// Why: `upstream: null` is a resolved "not a fork" marker and prevents
// repeated best-effort probes.
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
  const repoIcon = await detectRepoIcon({ repoPath, kind, executionHostId, upstream })
  return {
    ...(repoIcon ? { repoIcon } : {}),
    ...(gitRemoteIdentity ? { gitRemoteIdentity } : {}),
    ...(kind === 'git' ? { upstream: upstream ?? null } : {})
  }
}
