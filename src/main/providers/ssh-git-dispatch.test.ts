import { describe, expect, it } from 'vitest'
import { isLocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
import type { SshGitProvider } from './ssh-git-provider'
import {
  getSshGitProvider,
  getSshGitProviderGeneration,
  registerSshGitProvider,
  requireSshGitProvider,
  unregisterSshGitProvider
} from './ssh-git-dispatch'

describe('ssh-git-dispatch (local-only stub)', () => {
  it('never resolves a provider for any connection id', () => {
    expect(getSshGitProvider('target-1')).toBeUndefined()
    expect(getSshGitProviderGeneration('target-1')).toBe(0)
  })

  it('fails closed on require', () => {
    expect(() => requireSshGitProvider('target-1')).toThrow(
      expect.objectContaining({ code: 'unsupported_in_local_only_build', capability: 'ssh' })
    )
  })

  it('refuses registration so no producer can reintroduce SSH git', () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub never dereferences the provider; this only proves registration is refused.
    const provider = {} as SshGitProvider
    let caught: unknown
    try {
      registerSshGitProvider('target-1', provider)
    } catch (error) {
      caught = error
    }
    expect(isLocalOnlyUnsupportedError(caught)).toBe(true)
    expect(getSshGitProvider('target-1')).toBeUndefined()
    expect(() => unregisterSshGitProvider('target-1')).not.toThrow()
  })
})
