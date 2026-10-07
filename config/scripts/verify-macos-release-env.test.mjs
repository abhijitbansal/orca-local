import { describe, expect, it } from 'vitest'
import { findMissingMacReleaseEnv } from './verify-macos-release-env.mjs'

const P12_SIGNING = { CSC_LINK: '/certs/developer-id.p12', CSC_KEY_PASSWORD: 'pw' }
const APPLE_ID_NOTARY = {
  APPLE_ID: 'dev@example.com',
  APPLE_APP_SPECIFIC_PASSWORD: 'abcd-efgh',
  APPLE_TEAM_ID: 'TEAM123456'
}
const API_KEY_NOTARY = {
  APPLE_API_KEY: '/keys/AuthKey_ABC.p8',
  APPLE_API_KEY_ID: 'ABC',
  APPLE_API_ISSUER: 'issuer-uuid'
}

describe('findMissingMacReleaseEnv', () => {
  it('accepts a .p12 certificate with Apple ID notarization', () => {
    expect(findMissingMacReleaseEnv({ ...P12_SIGNING, ...APPLE_ID_NOTARY })).toEqual([])
  })

  it('accepts a keychain identity with App Store Connect API key notarization', () => {
    expect(findMissingMacReleaseEnv({ CSC_NAME: 'ABCDEF0123', ...API_KEY_NOTARY })).toEqual([])
  })

  it('names both alternatives when no signing certificate is configured', () => {
    expect(findMissingMacReleaseEnv({ ...API_KEY_NOTARY })).toEqual([
      'signing: CSC_NAME, or CSC_LINK + CSC_KEY_PASSWORD'
    ])
  })

  it('names both alternatives when no notarization credentials are configured', () => {
    expect(findMissingMacReleaseEnv({ CSC_NAME: 'ABCDEF0123' })).toEqual([
      'notarization: APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER, or APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID'
    ])
  })

  it('treats a partial or blank credential set as missing', () => {
    expect(
      findMissingMacReleaseEnv({
        CSC_LINK: '/certs/developer-id.p12',
        CSC_KEY_PASSWORD: ' ',
        ...API_KEY_NOTARY,
        APPLE_API_ISSUER: ''
      })
    ).toHaveLength(2)
  })
})
