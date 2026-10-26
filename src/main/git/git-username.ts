type SshGitProvider = {
  exec(args: string[], cwd: string): Promise<{ stdout: string; stderr: string }>
}
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

/** Reject failed API JSON/multiline output before it can become a branch prefix. */
export function isPlausibleHostedLogin(value: string): boolean {
  // Preserve GitHub's length/separator limits while allowing the EMU _shortcode suffix.
  return (
    /^[A-Za-z0-9]$/.test(value) ||
    (/^[A-Za-z0-9][A-Za-z0-9_-]{0,37}[A-Za-z0-9]$/.test(value) && !value.includes('--'))
  )
}

// A login occupies one loose-ref filename; ASCII length equals the 255-byte filesystem limit.
const MAX_BRANCH_SAFE_LOGIN_LENGTH = 255

/** Configured logins accept provider-specific characters and lengths beyond GitHub's rules. */
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
      const username = normalizeConfiguredLogin(stdout)
      if (username) {
        return { username, authoritative: true }
      }
    } catch {}
  }
  return { username: '', authoritative: true }
}

export async function resolveLocalGitUsername(repoPath: string): Promise<string> {
  return (await resolveLocalGitUsernameDetailed(repoPath)).username
}
