import { useEffect, useMemo } from 'react'
import { useAppStore } from '../store'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import {
  isConnectedRuntimeHostState,
  runtimeHostConnectionStateForEntry
} from '@/runtime/runtime-host-connection-state'
import { getLandingPreflightIssues, type PreflightIssue } from './landing-preflight-issues'

export function useLandingPreflightRuntime(): { preflightIssues: PreflightIssue[] } {
  const preflightStatus = useAppStore((s) => s.preflightStatus)
  const refreshPreflightStatus = useAppStore((s) => s.refreshPreflightStatus)
  const invalidatePreflightStatus = useAppStore((s) => s.invalidatePreflightStatus)
  const activeRuntimeState = useAppStore((s) => {
    const environmentId = s.settings?.activeRuntimeEnvironmentId?.trim()
    if (!environmentId) {
      return 'local'
    }
    const runtimeStatus = s.runtimeStatusByEnvironmentId.get(environmentId)
    // Why the shared verdict and not `entry.status`: an unverifiable probe nulls it while the
    // transport is still up, and reading that as unreachable discarded the whole preflight
    // result for a host that never went away (AGENTS.md).
    const reachability = runtimeStatus
      ? isConnectedRuntimeHostState(runtimeHostConnectionStateForEntry(runtimeStatus))
        ? 'reachable'
        : 'unreachable'
      : 'unknown'
    return `${environmentId}:${runtimeStatus?.connectionGeneration ?? 0}:${reachability}`
  })

  const preflightIssues = useMemo(
    () => (preflightStatus ? getLandingPreflightIssues(preflightStatus) : []),
    [preflightStatus]
  )

  useEffect(() => {
    if (activeRuntimeState !== 'local' && !activeRuntimeState.endsWith(':reachable')) {
      invalidatePreflightStatus()
      return
    }

    void refreshPreflightStatus()
    const handleWindowActive = (): void => {
      if (document.visibilityState === 'visible') {
        void refreshPreflightStatus({ force: true })
      }
    }
    document.addEventListener('visibilitychange', handleWindowActive)
    window.addEventListener('focus', handleWindowActive)
    return () => {
      document.removeEventListener('visibilitychange', handleWindowActive)
      window.removeEventListener('focus', handleWindowActive)
    }
  }, [activeRuntimeState, invalidatePreflightStatus, refreshPreflightStatus])

  useEffect(() => {
    if (preflightIssues.length === 0) {
      return
    }
    // Why gated: the effect above already force-refreshes on visibilitychange
    // and focus, so a revealed window has fresh data without this poll firing
    // while hidden — hence the no-op `runOnVisible`.
    return installWindowVisibilityInterval({
      run: () => {
        void refreshPreflightStatus({ force: true })
      },
      runOnVisible: () => {},
      intervalMs: 30000
    })
  }, [preflightIssues.length, refreshPreflightStatus])

  return { preflightIssues }
}
