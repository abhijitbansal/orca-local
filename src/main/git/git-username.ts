import type { SshGitProvider } from '../providers/ssh-git-provider'
import { gitExecFileAsync } from './runner'

const EXPLICIT_USERNAME_CONFIG_KEYS = ['github.user', 'user.username'] as const

const LOCAL_GIT_READ_TIMEOUT_MS = 5000

export function normalizeGitUsername(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const localPart = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed
  return localPart.replace(/^\d+\+/, '')
}

/**
 * Hosted account logins used as branch-prefix segments must be single-path
 * tokens. Reject multi-line / JSON error bodies from a failed `gh api user`
 * (rate-limit 403 still prints JSON on stdout) so they never become branch names.
 */
export function isPlausibleHostedLogin(value: string): boolean {
  // Preserve GitHub's length/separator limits while allowing the EMU _shortcode suffix.
  return (
    /^[A-Za-z0-9]$/.test(value) ||
    (/^[A-Za-z0-9][A-Za-z0-9_-]{0,37}[A-Za-z0-9]$/.test(value) && !value.includes('--'))
  )
}

// Not a check-ref-format rule: a login becomes one slash-free branch component,
// which a loose ref stores as a single filename (255-byte cap on ext4/APFS/NTFS).
// The ASCII-only charset below makes character count equal byte count.
const MAX_BRANCH_SAFE_LOGIN_LENGTH = 255

/**
 * Provider-agnostic branch-safe token: GitLab/Bitbucket/self-hosted logins may
 * carry `_`/`.` and run longer than GitHub's 39-char limit, so the strict
 * GitHub rule must not gate explicitly configured usernames.
 */
export function isBranchSafeHostedLogin(value: string): boolean {
  if (value.length > MAX_BRANCH_SAFE_LOGIN_LENGTH) {
    return false
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    return false
  }
  // Dot placements git check-ref-format rejects; `.lock` is case-sensitive there too.
  return !value.includes('..') && !value.endsWith('.') && !value.endsWith('.lock')
}

/** Explicit `github.user`/`user.username` config is provider-agnostic; only reject non-tokens. */
function normalizeConfiguredLogin(value: string): string {
  const normalized = normalizeGitUsername(value)
  return normalized && isBranchSafeHostedLogin(normalized) ? normalized : ''
}

/**
 * A resolved username plus whether every probe on the way to it completed.
 * Non-authoritative '' (a probe timed out) must not overwrite a previously
 * persisted username; authoritative '' should clear one.
 */
export type ResolvedGitUsername = { username: string; authoritative: boolean }

export async function getSshGitUsername(
  provider: SshGitProvider,
  repoPath: string
): Promise<string> {
  // Why: SSH targets cannot rely on the local `gh` account, and git email/name
  // are author identity rather than hosted-account usernames.
  for (const key of EXPLICIT_USERNAME_CONFIG_KEYS) {
    try {
      const { stdout } = await provider.exec(['config', '--get', key], repoPath)
      const username = normalizeConfiguredLogin(stdout)
      if (username) {
        return username
      }
    } catch {
      // Missing config keys are expected; try the next explicit username key.
    }
  }
  return ''
}

/**
 * Async replacement for the old sync `getGitUsername`: explicit config keys
 * only, since no hosted-account lookup runs. Never rejects; unknown resolves
 * to { username: '', authoritative: true }.
 */
export async function resolveLocalGitUsernameDetailed(
  repoPath: string
): Promise<ResolvedGitUsername> {
  for (const key of EXPLICIT_USERNAME_CONFIG_KEYS) {
    try {
      const { stdout } = await gitExecFileAsync(['config', '--get', key], {
        cwd: repoPath,
        timeout: LOCAL_GIT_READ_TIMEOUT_MS
      })
      // Why: config can hold free-form strings; only branch-safe logins become prefixes.
      const username = normalizeConfiguredLogin(stdout)
      if (username) {
        return { username, authoritative: true }
      }
    } catch {
      // Missing config keys are expected; try the next explicit username key.
    }
  }
  return { username: '', authoritative: true }
}

export async function resolveLocalGitUsername(repoPath: string): Promise<string> {
  return (await resolveLocalGitUsernameDetailed(repoPath)).username
}
