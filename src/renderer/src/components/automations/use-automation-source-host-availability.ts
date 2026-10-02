import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { TaskSourceHostAvailability } from '../task-source-context-summary'
import {
  getRepoBackedAutomationSourceContext,
  getRuntimeSourceHostAvailability
} from './automation-source-context'
import type { AutomationListRow } from './automation-list-row-identity'

/**
 * Availability of each automation's *source* host. No forge or tracker provider is probed any
 * more, so only the paired-runtime host state can make a source unavailable.
 *
 * Keyed by row, not by automation ID: two authorities may hold that ID, and
 * their copies can name different source hosts.
 */
export function useAutomationSourceHostAvailability(
  rows: readonly AutomationListRow[]
): ReadonlyMap<string, TaskSourceHostAvailability[]> {
  const runtimeStatusByEnvironmentId = useAppStore((s) => s.runtimeStatusByEnvironmentId)

  return useMemo(() => {
    const availabilityByRowKey = new Map<string, TaskSourceHostAvailability[]>()
    for (const row of rows) {
      const context = getRepoBackedAutomationSourceContext(row.automation)
      if (!context) {
        continue
      }
      const hostAvailability = getRuntimeSourceHostAvailability(
        context,
        runtimeStatusByEnvironmentId
      )
      if (hostAvailability) {
        availabilityByRowKey.set(row.key, [hostAvailability])
      }
    }
    return availabilityByRowKey
  }, [rows, runtimeStatusByEnvironmentId])
}
