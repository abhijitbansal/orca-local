// Refresh slightly ahead of expiry so a token doesn't expire mid-launch. The
// CLI uses the same 5-minute skew for its own refresh decision.
const OAUTH_EXPIRY_BUFFER_MS = 5 * 60 * 1000

type ClaudeOauthBlob = {
  accessToken?: unknown
  refreshToken?: unknown
  expiresAt?: unknown
  scopes?: unknown
  [key: string]: unknown
}

type ClaudeCredentials = {
  claudeAiOauth?: ClaudeOauthBlob
  [key: string]: unknown
}

/**
 * Parse the `claudeAiOauth` object from a credentials JSON string.
 * Returns null when the string is not parseable or lacks the OAuth block.
 */
export function parseClaudeOauthBlob(credentialsJson: string): ClaudeOauthBlob | null {
  try {
    const parsed = JSON.parse(credentialsJson) as ClaudeCredentials
    const oauth = parsed?.claudeAiOauth
    return oauth && typeof oauth === 'object' && !Array.isArray(oauth) ? oauth : null
  } catch {
    return null
  }
}

/** Read a stored refresh token, or null when absent/blank. */
export function readRefreshToken(credentialsJson: string): string | null {
  const oauth = parseClaudeOauthBlob(credentialsJson)
  const token = oauth?.refreshToken
  return typeof token === 'string' && token.trim() !== '' ? token.trim() : null
}

/**
 * Whether the stored access token is expired or within the refresh buffer.
 *
 * A missing/non-numeric `expiresAt` is treated as "needs refresh" so a blob
 * with no usable expiry metadata still gets a proactive refresh attempt rather
 * than being trusted indefinitely. `now` is injectable for tests.
 */
export function isOauthTokenExpiring(credentialsJson: string, now: number = Date.now()): boolean {
  const oauth = parseClaudeOauthBlob(credentialsJson)
  if (!oauth) {
    return false
  }
  const expiresAt = oauth.expiresAt
  if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) {
    return true
  }
  return now + OAUTH_EXPIRY_BUFFER_MS >= expiresAt
}
