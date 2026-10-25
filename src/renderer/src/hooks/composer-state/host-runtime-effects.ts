import type { ComposerModel } from './composer-model'

type HostRuntimeEffectsInput = Pick<
  ComposerModel,
  | 'commitHookCheckIfCurrent'
  | 'connectionId'
  | 'disabledTuiAgents'
  | 'ensureDetectedAgents'
  | 'ensureRemoteDetectedAgents'
  | 'ensureRuntimeDetectedAgents'
  | 'fallbackDefaultAgent'
  | 'folderTargetConnectionId'
  | 'isRemote'
  | 'loadHookCheckForRepo'
  | 'newWorkspaceDraft'
  | 'repoId'
  | 'repoIdRef'
  | 'runtimeEnvironmentId'
  | 'selectedRepoConnectionIdRef'
  | 'selectedRepoExecutionHostId'
  | 'selectedRepoHookContextKey'
  | 'selectedRepoIsGit'
  | 'selectedRepoSshStatus'
  | 'setTuiAgent'
  | 'settings'
  | 'tuiAgent'
>

import { useEffect, useCallback } from 'react'
import { filterEnabledTuiAgents, isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import { getAgentCatalog } from '@/lib/agent-catalog'

export function useHostRuntimeEffects(input: HostRuntimeEffectsInput) {
  const {
    commitHookCheckIfCurrent,
    connectionId,
    disabledTuiAgents,
    ensureDetectedAgents,
    ensureRemoteDetectedAgents,
    ensureRuntimeDetectedAgents,
    fallbackDefaultAgent,
    isRemote,
    loadHookCheckForRepo,
    newWorkspaceDraft,
    repoId,
    runtimeEnvironmentId,
    selectedRepoHookContextKey,
    selectedRepoIsGit,
    selectedRepoSshStatus,
    setTuiAgent,
    settings,
    tuiAgent
  } = input

  // Why: re-detect agents when the selected repo changes so the list matches the correct host (local runs once, deduped by the store).
  useEffect(() => {
    if (isRemote && selectedRepoSshStatus !== 'connected') {
      return
    }
    let cancelled = false
    const detect = isRemote
      ? ensureRemoteDetectedAgents(connectionId!)
      : runtimeEnvironmentId
        ? ensureRuntimeDetectedAgents(runtimeEnvironmentId)
        : ensureDetectedAgents()
    void detect.then((ids) => {
      if (cancelled) {
        return
      }
      const enabledIds = filterEnabledTuiAgents(ids, disabledTuiAgents)
      if (!newWorkspaceDraft?.agent && !settings?.defaultTuiAgent && enabledIds.length > 0) {
        const firstInCatalogOrder = getAgentCatalog().find((a) => enabledIds.includes(a.id))
        if (firstInCatalogOrder) {
          setTuiAgent(firstInCatalogOrder.id)
        }
      } else if (!isTuiAgentEnabled(tuiAgent, disabledTuiAgents)) {
        const firstEnabledDetected = getAgentCatalog().find((a) => enabledIds.includes(a.id))
        setTuiAgent(firstEnabledDetected?.id ?? fallbackDefaultAgent)
      }
    })
    return () => {
      cancelled = true
    }
    // Why: deps narrowed to host identity (connectionId/runtimeEnvironmentId); detection is a best-effort PATH snapshot, so draft/settings are excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connectionId,
    runtimeEnvironmentId,
    isRemote,
    selectedRepoSshStatus,
    disabledTuiAgents,
    setTuiAgent
  ])

  // Per-repo: load yaml hooks.
  useEffect(() => {
    if (!repoId || !selectedRepoIsGit || !selectedRepoHookContextKey) {
      return
    }

    let cancelled = false

    void loadHookCheckForRepo(repoId)
      .then((result) => {
        if (!cancelled) {
          commitHookCheckIfCurrent(selectedRepoHookContextKey, result.hooks)
        }
      })
      .catch(() => {
        if (!cancelled) {
          commitHookCheckIfCurrent(selectedRepoHookContextKey, null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    commitHookCheckIfCurrent,
    loadHookCheckForRepo,
    repoId,
    selectedRepoHookContextKey,
    selectedRepoIsGit,
    runtimeEnvironmentId
  ])

  // Local-only: there are no remote projects to connect.
  const onConnectSelectedRepo = useCallback(async (): Promise<void> => {}, [])
  const onConnectSelectedProjectGroup = useCallback(async (): Promise<void> => {}, [])

  return {
    onConnectSelectedRepo,
    onConnectSelectedProjectGroup
  }
}
