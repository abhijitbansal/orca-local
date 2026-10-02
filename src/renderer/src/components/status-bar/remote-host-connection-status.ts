import type { SshConnectionStatus } from '../../../../shared/ssh-types'
import type { HostStatus } from '@/runtime/runtime-host-connection-state'
import { isConnectingSshStatus } from '@/ssh/ssh-connection-recoverability'

export function overallStatus(
  statuses: HostStatus[]
): 'connected' | 'partial' | 'disconnected' | 'connecting' {
  if (statuses.length === 0) {
    return 'disconnected'
  }
  if (statuses.every((s) => s === 'connected')) {
    return 'connected'
  }
  if (statuses.some((s) => s === 'connecting')) {
    return 'connecting'
  }
  if (statuses.some((s) => s === 'connected')) {
    return 'partial'
  }
  return 'disconnected'
}

export function overallDotColor(
  status: 'connected' | 'partial' | 'disconnected' | 'connecting',
  connectedCount: number
): string {
  switch (status) {
    case 'connected':
      return 'bg-emerald-500'
    case 'partial':
      return connectedCount > 0 ? 'bg-emerald-500' : 'bg-muted-foreground/40'
    case 'connecting':
      return 'bg-yellow-500'
    case 'disconnected':
      return 'bg-muted-foreground/40'
  }
}

export function sshStatusForOverall(status: SshConnectionStatus): HostStatus {
  if (status === 'connected') {
    return 'connected'
  }
  return isConnectingSshStatus(status) ? 'connecting' : 'disconnected'
}
