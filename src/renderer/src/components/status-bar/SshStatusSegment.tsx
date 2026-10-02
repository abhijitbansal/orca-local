import React from 'react'
import { AlertTriangle, Loader2, MonitorSmartphone, Server, ServerOff } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '../../store'
import type { SshConnectionStatus } from '../../../../shared/ssh-types'
import { translate } from '@/i18n/i18n'
import { isRuntimeOwnedSshTargetId } from '../../../../shared/execution-host'
import {
  connectedHostCountLabel,
  connectingHostsLabel,
  workspaceSyncProblemLabel
} from './ssh-status-segment-copy'
import { SshTargetStatusRow } from './SshTargetStatusRow'
import {
  overallDotColor,
  overallStatus,
  sshStatusForOverall
} from './remote-host-connection-status'

export function SshStatusSegment({
  compact,
  iconOnly
}: {
  compact: boolean
  iconOnly: boolean
}): React.JSX.Element | null {
  const sshConnectionStates = useAppStore((s) => s.sshConnectionStates)
  const sshTargetLabels = useAppStore((s) => s.sshTargetLabels)
  const remoteWorkspaceSyncStatusByTargetId = useAppStore(
    (s) => s.remoteWorkspaceSyncStatusByTargetId
  )
  const recordFeatureInteraction = useAppStore((s) => s.recordFeatureInteraction)

  const targets = Array.from(sshTargetLabels.entries())
    // Why: runtime-owned (per-workspace-env) SSH targets are hidden — never list them
    // as a user-facing SSH host in the status bar.
    .filter(([id]) => !isRuntimeOwnedSshTargetId(id))
    .map(([id, label]) => {
      const state = sshConnectionStates.get(id)
      return {
        id,
        label,
        status: (state?.status ?? 'disconnected') as SshConnectionStatus,
        syncStatus: remoteWorkspaceSyncStatusByTargetId[id]
      }
    })
  const connectedTargets = targets.filter((target) => target.status === 'connected')
  const disconnectedTargets = targets.filter((target) => target.status !== 'connected')
  if (targets.length === 0) {
    return null
  }

  const statuses = targets.map((t) => sshStatusForOverall(t.status))
  const overall = overallStatus(statuses)
  const connectedHostCount = statuses.filter((status) => status === 'connected').length
  const anyConnecting = overall === 'connecting'
  const syncProblem = targets.find(
    (t) => t.syncStatus?.phase === 'conflict' || t.syncStatus?.phase === 'error'
  )
  const syncProblemLabel = syncProblem
    ? workspaceSyncProblemLabel(syncProblem.syncStatus?.phase)
    : null
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) {
          recordFeatureInteraction('ssh')
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 hover:bg-accent/70"
          aria-label={translate(
            'auto.components.status.bar.SshStatusSegment.fdc57e9970',
            'Remote host connection status'
          )}
        >
          {iconOnly ? (
            <span className="inline-flex items-center gap-1">
              <span
                className={`inline-block size-2 rounded-full ${
                  syncProblem ? 'bg-destructive' : overallDotColor(overall, connectedHostCount)
                }`}
              />
              {syncProblem ? (
                <AlertTriangle className="size-3 text-destructive" />
              ) : anyConnecting ? (
                <Loader2 className="size-3 animate-spin text-muted-foreground" />
              ) : (
                <MonitorSmartphone className="size-3 text-muted-foreground" />
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {syncProblem ? (
                <AlertTriangle className="size-3 text-destructive" />
              ) : anyConnecting ? (
                <Loader2 className="size-3 animate-spin text-yellow-500" />
              ) : overall === 'connected' ? (
                <Server className="size-3 text-emerald-500" />
              ) : overall === 'partial' ? (
                <Server className="size-3 text-muted-foreground" />
              ) : (
                <ServerOff className="size-3 text-muted-foreground" />
              )}
              {!compact && (
                <span className="text-[11px]">
                  <span className={syncProblem ? 'text-destructive' : 'text-muted-foreground'}>
                    {syncProblemLabel ??
                      (anyConnecting
                        ? connectingHostsLabel()
                        : connectedHostCountLabel(connectedHostCount))}
                  </span>
                </span>
              )}
              <span
                className={`inline-block size-1.5 rounded-full ${
                  syncProblem ? 'bg-destructive' : overallDotColor(overall, connectedHostCount)
                }`}
              />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1rem))]"
      >
        <div className="px-2 pt-1.5 pb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {translate('auto.components.status.bar.SshStatusSegment.6e8a9a4242', 'Remote Hosts')}
        </div>
        {connectedTargets.map((t) => (
          <SshTargetStatusRow
            key={t.id}
            targetId={t.id}
            label={t.label}
            status={t.status}
            syncStatus={t.syncStatus}
          />
        ))}
        {disconnectedTargets.map((t) => (
          <SshTargetStatusRow
            key={t.id}
            targetId={t.id}
            label={t.label}
            status={t.status}
            syncStatus={t.syncStatus}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
