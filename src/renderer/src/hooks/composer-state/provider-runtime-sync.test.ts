// @vitest-environment happy-dom

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  useComposerProviderRuntimeSync,
  type ComposerProviderRuntimeSyncInput
} from './provider-runtime-sync'

describe('useComposerProviderRuntimeSync', () => {
  it('never resolves a GitHub repo slug for the selected repo', () => {
    const setSelectedRepoSlug = vi.fn<ComposerProviderRuntimeSyncInput['setSelectedRepoSlug']>()
    const common = {
      promptCaretFrameRef: { current: null },
      selectedRepoExecutionHostId: 'local',
      selectedRepoHookContextKey: 'local:repo',
      selectedRepoSettingsRef: { current: null },
      setCheckedHooksContextKey:
        vi.fn<ComposerProviderRuntimeSyncInput['setCheckedHooksContextKey']>(),
      setSelectedRepoSlug,
      setSetupAgentStartupPolicy:
        vi.fn<ComposerProviderRuntimeSyncInput['setSetupAgentStartupPolicy']>(),
      setYamlHooks: vi.fn<ComposerProviderRuntimeSyncInput['setYamlHooks']>(),
      setupAgentStartupPolicyDraftRef: { current: null },
      setupAgentStartupPolicyRef: { current: 'start-immediately' },
      setupAgentStartupPolicySaveRef: { current: null },
      updateRepo: vi.fn<ComposerProviderRuntimeSyncInput['updateRepo']>()
    } satisfies Omit<ComposerProviderRuntimeSyncInput, 'repoId' | 'selectedRepo'>
    const state = (repoId: string): ComposerProviderRuntimeSyncInput => ({
      ...common,
      repoId,
      selectedRepo: {
        id: repoId,
        path: `/repos/${repoId}`,
        displayName: repoId,
        badgeColor: '#000000',
        addedAt: 0
      }
    })
    const hook = renderHook(({ repoId }) => useComposerProviderRuntimeSync(state(repoId)), {
      initialProps: { repoId: 'first' }
    })

    hook.rerender({ repoId: 'second' })

    expect(setSelectedRepoSlug).toHaveBeenCalledWith(null)
    expect(setSelectedRepoSlug).not.toHaveBeenCalledWith(expect.objectContaining({ owner: 'orca' }))
  })
})
