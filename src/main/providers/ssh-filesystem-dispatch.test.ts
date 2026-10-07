import { describe, expect, it, vi } from 'vitest'
import { isLocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'
import {
  getSshFilesystemProvider,
  onSshFilesystemProviderRegistered,
  registerSshFilesystemProvider,
  requireSshFilesystemProvider,
  unregisterSshFilesystemProvider
} from './ssh-filesystem-dispatch'
import type { IFilesystemProvider } from './types'

describe('ssh-filesystem-dispatch (local-only stub)', () => {
  it('never resolves a provider for any connection id', () => {
    expect(getSshFilesystemProvider('target-1')).toBeUndefined()
  })

  it('fails closed on require', () => {
    expect(() => requireSshFilesystemProvider('target-1')).toThrow(
      expect.objectContaining({ code: 'unsupported_in_local_only_build', capability: 'ssh' })
    )
  })

  it('refuses registration and never notifies listeners', () => {
    const listener = vi.fn()
    const unsubscribe = onSshFilesystemProviderRegistered(listener)
    expect(typeof unsubscribe).toBe('function')
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stub never dereferences the provider; this only proves registration is refused.
    const provider = {} as IFilesystemProvider
    let caught: unknown
    try {
      registerSshFilesystemProvider('target-1', provider)
    } catch (error) {
      caught = error
    }
    expect(isLocalOnlyUnsupportedError(caught)).toBe(true)
    expect(listener).not.toHaveBeenCalled()
    expect(getSshFilesystemProvider('target-1')).toBeUndefined()
    expect(() => unregisterSshFilesystemProvider('target-1')).not.toThrow()
    unsubscribe()
  })
})
