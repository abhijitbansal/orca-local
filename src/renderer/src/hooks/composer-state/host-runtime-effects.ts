import type { ComposerModel } from './composer-model'

type HostRuntimeEffectsInput = Pick<
  ComposerModel,
  | 'commitHookCheckIfCurrent'
  | 'connectionId'
  | 'createGateMode'
  | 'disabledTuiAgents'
  | 'enableIssueAutomation'
  | 'ensureDetectedAgents'
  | 'ensureRemoteDetectedAgents'
  | 'ensureRuntimeDetectedAgents'
  | 'fallbackDefaultAgent'
  | 'isRemote'
  | 'loadHookCheckForRepo'
  | 'newWorkspaceDraft'
  | 'repoId'
  | 'runtimeEnvironmentId'
  | 'selectedRepoExecutionHostId'
  | 'selectedRepoHookContextKey'
  | 'selectedRepoIsGit'
  | 'selectedRepoSettingsRef'
  | 'selectedRepoSshStatus'
  | 'setLoadedIssueCommand'
  | 'setTuiAgent'
  | 'settings'
  | 'tuiAgent'
>

import { useEffect } from 'react'
import { filterEnabledTuiAgents, isTuiAgentEnabled } from '../../../../shared/tui-agent-selection'
import { getAgentCatalog } from '@/lib/agent-catalog'
import { readRuntimeIssueCommand } from '@/runtime/runtime-hooks-client'

export function useHostRuntimeEffects(input: HostRuntimeEffectsInput) {
  const {
    commitHookCheckIfCurrent,
    connectionId,
    createGateMode,
    disabledTuiAgents,
    enableIssueAutomation,
    ensureDetectedAgents,
    ensureRemoteDetectedAgents,
    ensureRuntimeDetectedAgents,
    fallbackDefaultAgent,
    isRemote,
    loadHookCheckForRepo,
    newWorkspaceDraft,
    repoId,
    runtimeEnvironmentId,
    selectedRepoExecutionHostId,
    selectedRepoHookContextKey,
    selectedRepoIsGit,
    selectedRepoSettingsRef,
    selectedRepoSshStatus,
    setLoadedIssueCommand,
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

  // Per-repo: load yaml hooks + issue command template.
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

    if (!enableIssueAutomation) {
      return () => {
        cancelled = true
      }
    }

    if (createGateMode === 'quick') {
      return () => {
        cancelled = true
      }
    }

    void readRuntimeIssueCommand(
      selectedRepoSettingsRef.current,
      repoId,
      selectedRepoExecutionHostId ?? undefined
    )
      .then((result) => {
        if (!cancelled) {
          setLoadedIssueCommand({ contextKey: selectedRepoHookContextKey, result })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadedIssueCommand({
            contextKey: selectedRepoHookContextKey,
            result: {
              status: 'error',
              localContent: null,
              sharedContent: null,
              effectiveContent: null,
              localFilePath: '',
              source: 'none'
            }
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    commitHookCheckIfCurrent,
    createGateMode,
    enableIssueAutomation,
    loadHookCheckForRepo,
    repoId,
    selectedRepoExecutionHostId,
    selectedRepoHookContextKey,
    selectedRepoIsGit,
    runtimeEnvironmentId,
    selectedRepoSettingsRef,
    setLoadedIssueCommand
  ])
}
