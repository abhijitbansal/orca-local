import { describe, expect, it } from 'vitest'
import { parseAscConfig, pickDeveloperIdIdentity } from './build-mac-release-local.mjs'

const FIND_IDENTITY_WITH_DEVELOPER_ID = `  1) 1111111111111111111111111111111111111111 "Apple Development: dev@example.com (DEVTEAM001)"
  2) 1111111111111111111111111111111111111111 "Apple Development: dev@example.com (DEVTEAM001)"
  3) 2222222222222222222222222222222222222222 "Apple Distribution: Jane Doe (TEAM123456)"
  4) 3333333333333333333333333333333333333333 "Developer ID Application: Jane Doe (TEAM123456)"
     4 valid identities found
`

describe('parseAscConfig', () => {
  it('reads KEY_ID and ISSUER_ID, ignoring blanks and comments', () => {
    expect(parseAscConfig('# asc\nKEY_ID=ABC123\n\nISSUER_ID = issuer-uuid \n')).toEqual({
      keyId: 'ABC123',
      issuerId: 'issuer-uuid'
    })
  })

  it('accepts shell-style export prefixes and quoted values', () => {
    expect(parseAscConfig('export KEY_ID="ABC123"\nexport ISSUER_ID=\'issuer-uuid\'\n')).toEqual({
      keyId: 'ABC123',
      issuerId: 'issuer-uuid'
    })
  })

  it('fails when a required key is missing', () => {
    expect(() => parseAscConfig('KEY_ID=ABC123\n')).toThrow(/ISSUER_ID/)
  })
})

describe('pickDeveloperIdIdentity', () => {
  it('returns the Developer ID Application hash, never an App Store or development cert', () => {
    expect(pickDeveloperIdIdentity(FIND_IDENTITY_WITH_DEVELOPER_ID)).toEqual({
      hash: '3333333333333333333333333333333333333333',
      name: 'Developer ID Application: Jane Doe (TEAM123456)'
    })
  })

  it('fails with setup guidance when the keychain has no Developer ID Application cert', () => {
    const withoutDeveloperId = FIND_IDENTITY_WITH_DEVELOPER_ID.split('\n')
      .filter((line) => !line.includes('Developer ID'))
      .join('\n')
    expect(() => pickDeveloperIdIdentity(withoutDeveloperId)).toThrow(/Developer ID Application/)
  })

  it('refuses to guess between two distinct Developer ID Application certs', () => {
    const twoCerts = `${FIND_IDENTITY_WITH_DEVELOPER_ID}  5) 4444444444444444444444444444444444444444 "Developer ID Application: Jane Doe (TEAM123456)"\n`
    expect(() => pickDeveloperIdIdentity(twoCerts)).toThrow(/CSC_NAME/)
  })
})
