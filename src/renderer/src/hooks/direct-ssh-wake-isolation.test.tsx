// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirectSshAuthority, SshProviderEpoch } from '../../../shared/ssh-types'
import { createTestStore, makeTab, makeWorktree } from '@/store/slices/store-test-helpers'
import { registerDirectSshWakeRouting } from './direct-ssh-state-routing'

function authority(): DirectSshAuthority {
  return {
    targetId: 'direct-target',
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: branded test fixture id.
    providerEpoch: 'direct-epoch' as SshProviderEpoch,
    connectionGeneration: 7
  }
}

describe('direct SSH wake isolation', () => {
  const resumeCallbacks = new Set<() => void>()
  const onSystemResumed = vi.fn((callback: () => void) => {
    resumeCallbacks.add(callback)
    return () => resumeCallbacks.delete(callback)
  })

  beforeEach(() => {
    onSystemResumed.mockClear()
    resumeCallbacks.clear()
  })

  it('advances one exact direct wake without rebumping a healthy pane', () => {
    const currentAuthority = authority()
    const directWorktreeId = 'repo-direct::/work/direct'
    const directPtyId = 'ssh:direct-target@@pty-live'
    const store = createTestStore()
    store.setState({
      repos: [
        {
          id: 'repo-direct',
          path: '/work/direct',
          displayName: 'direct',
          badgeColor: '#000',
          addedAt: 1,
          connectionId: 'direct-target',
          executionHostId: 'ssh:direct-target'
        }
      ],
      worktreesByRepo: {
        'repo-direct': [
          makeWorktree({
            id: directWorktreeId,
            repoId: 'repo-direct',
            path: '/work/direct',
            hostId: 'ssh:direct-target'
          })
        ]
      },
      tabsByWorktree: {
        [directWorktreeId]: [
          makeTab({
            id: 'tab-direct',
            worktreeId: directWorktreeId,
            ptyId: directPtyId,
            generation: 0
          })
        ]
      },
      ptyIdsByTabId: { 'tab-direct': [directPtyId] },
      directSshLivePtyBindingByTabId: {
        'tab-direct': {
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: branded test fixture id.
          attemptId: 'direct-attempt' as never,
          authority: currentAuthority,
          tabGeneration: 0,
          ptyId: directPtyId
        }
      },
      sshConnectionStates: new Map([
        [
          'direct-target',
          {
            targetId: 'direct-target',
            status: 'connected',
            error: null,
            reconnectAttempt: 0,
            providerEpoch: currentAuthority.providerEpoch,
            connectionGeneration: currentAuthority.connectionGeneration
          }
        ]
      ])
    })
    const wakePreparation = vi.fn()
    const correctedCounts: number[] = []
    const unregisterDirectWake = registerDirectSshWakeRouting({
      getConnectionStates: () => store.getState().sshConnectionStates,
      wakeAuthority: (nextAuthority) => {
        correctedCounts.push(store.getState().retryDirectSshTargetPanes(nextAuthority, 1_000))
        wakePreparation(nextAuthority)
      },
      onSystemResumed
    })

    window.dispatchEvent(new Event('online'))

    expect(wakePreparation).toHaveBeenCalledOnce()
    expect(wakePreparation).toHaveBeenCalledWith(currentAuthority)
    expect(correctedCounts).toEqual([0])
    expect(store.getState().tabsByWorktree[directWorktreeId][0]).toMatchObject({
      generation: 0,
      ptyId: directPtyId
    })
    expect(store.getState().directSshPaneRetryByTabId).toEqual({})

    unregisterDirectWake()
    window.dispatchEvent(new Event('online'))
    expect(wakePreparation).toHaveBeenCalledTimes(1)
  })
})
