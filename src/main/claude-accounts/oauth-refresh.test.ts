import { describe, expect, it } from 'vitest'
import * as module from './oauth-refresh'
import { isOauthTokenExpiring, parseClaudeOauthBlob, readRefreshToken } from './oauth-refresh'

const NOW = 1_700_000_000_000

function credentials(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    claudeAiOauth: {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      expiresAt: NOW + 60 * 60 * 1000,
      scopes: ['user:inference', 'user:profile'],
      ...overrides
    }
  })
}

describe('parseClaudeOauthBlob', () => {
  it('returns the oauth block', () => {
    expect(parseClaudeOauthBlob(credentials())?.accessToken).toBe('old-access')
  })

  it('returns null for non-JSON or missing block', () => {
    expect(parseClaudeOauthBlob('not json')).toBeNull()
    expect(parseClaudeOauthBlob('{}')).toBeNull()
    expect(parseClaudeOauthBlob('{"claudeAiOauth":[]}')).toBeNull()
  })
})

describe('readRefreshToken', () => {
  it('reads a present token', () => {
    expect(readRefreshToken(credentials())).toBe('old-refresh')
  })

  it('returns null for blank or missing tokens', () => {
    expect(readRefreshToken(credentials({ refreshToken: '   ' }))).toBeNull()
    expect(readRefreshToken(credentials({ refreshToken: undefined }))).toBeNull()
  })
})

describe('isOauthTokenExpiring', () => {
  it('is false when well within validity', () => {
    expect(isOauthTokenExpiring(credentials(), NOW)).toBe(false)
  })

  it('is true within the 5-minute buffer', () => {
    expect(isOauthTokenExpiring(credentials({ expiresAt: NOW + 60 * 1000 }), NOW)).toBe(true)
  })

  it('is true when already expired', () => {
    expect(isOauthTokenExpiring(credentials({ expiresAt: NOW - 1000 }), NOW)).toBe(true)
  })

  it('treats missing/non-numeric expiry as expiring', () => {
    expect(isOauthTokenExpiring(credentials({ expiresAt: undefined }), NOW)).toBe(true)
    expect(isOauthTokenExpiring(credentials({ expiresAt: 'soon' }), NOW)).toBe(true)
  })

  it('is false for credentials without an oauth block', () => {
    expect(isOauthTokenExpiring('{}', NOW)).toBe(false)
  })
})

describe('oauth-refresh module surface', () => {
  it('exports no network refresh', () => {
    expect('refreshClaudeOauthCredentials' in module).toBe(false)
  })
})
