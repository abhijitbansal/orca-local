import { describe, expect, it } from 'vitest'
import {
  LOCAL_ONLY_UNSUPPORTED_CODE,
  LocalOnlyUnsupportedError,
  isLocalOnlyUnsupportedError
} from './local-only-unsupported-error'

describe('LocalOnlyUnsupportedError', () => {
  it('carries a stable code, the capability and the operation', () => {
    const error = new LocalOnlyUnsupportedError('ssh', 'requireSshGitProvider(t1)')
    expect(error.code).toBe(LOCAL_ONLY_UNSUPPORTED_CODE)
    expect(error.capability).toBe('ssh')
    expect(error.message).toBe('ssh is unsupported in this build (requireSshGitProvider(t1))')
    expect(error.name).toBe('LocalOnlyUnsupportedError')
    expect(isLocalOnlyUnsupportedError(error)).toBe(true)
    expect(isLocalOnlyUnsupportedError(new Error('x'))).toBe(false)
  })
})
