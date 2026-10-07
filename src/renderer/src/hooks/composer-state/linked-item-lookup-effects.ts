import type { ComposerModel } from './composer-model'

type LinkedItemLookupEffectsInput = Pick<
  ComposerModel,
  | 'baseBranch'
  | 'linkQuery'
  | 'prefetchWorktreeCreateBase'
  | 'repoId'
  | 'selectedRepoConnectionId'
  | 'selectedRepoIsGit'
  | 'selectedRepoSshStatus'
  | 'setLinkDebouncedQuery'
  | 'setSetupDecision'
  | 'setupConfig'
  | 'setupPolicy'
  | 'shouldWaitForSetupCheck'
  | 'sshConnectedGeneration'
>

import { canUseRepoBackedComposerSources } from '@/lib/new-workspace-ssh-gate'
import { useEffect } from 'react'

export function useLinkedItemLookupEffects(input: LinkedItemLookupEffectsInput) {
  const {
    baseBranch,
    linkQuery,
    prefetchWorktreeCreateBase,
    repoId,
    selectedRepoConnectionId,
    selectedRepoIsGit,
    selectedRepoSshStatus,
    setLinkDebouncedQuery,
    setSetupDecision,
    setupConfig,
    setupPolicy,
    shouldWaitForSetupCheck,
    sshConnectedGeneration
  } = input

  // Why: repo-backed prefetch is only valid while the repo's SSH connection (if any) is usable.
  const canPrefetchSelectedRepoWorkItems = canUseRepoBackedComposerSources({
    connectionId: selectedRepoConnectionId,
    status: selectedRepoSshStatus
  })

  const prefetchSshConnectedGeneration =
    selectedRepoConnectionId && selectedRepoSshStatus === 'connected' ? sshConnectedGeneration : 0

  useEffect(() => {
    if (!repoId || !selectedRepoIsGit || !canPrefetchSelectedRepoWorkItems) {
      return
    }
    void prefetchWorktreeCreateBase(repoId, baseBranch)
  }, [
    baseBranch,
    canPrefetchSelectedRepoWorkItems,
    prefetchSshConnectedGeneration,
    prefetchWorktreeCreateBase,
    repoId,
    selectedRepoIsGit
  ])

  // Reset setup decision when config / policy changes.
  useEffect(() => {
    if (shouldWaitForSetupCheck) {
      setSetupDecision(null)
      return
    }
    if (!setupConfig) {
      setSetupDecision(null)
      return
    }
    if (setupPolicy === 'ask') {
      setSetupDecision(null)
      return
    }
    setSetupDecision(setupPolicy === 'run-by-default' ? 'run' : 'skip')
  }, [setupConfig, setupPolicy, shouldWaitForSetupCheck, setSetupDecision])

  // Link popover: debounce + load recent items + resolve direct number.
  useEffect(() => {
    const timeout = window.setTimeout(() => setLinkDebouncedQuery(linkQuery), 250)
    return () => window.clearTimeout(timeout)
  }, [linkQuery, setLinkDebouncedQuery])

  return {
    canPrefetchSelectedRepoWorkItems,
    prefetchSshConnectedGeneration
  }
}
