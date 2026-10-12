import React from 'react'
import { LocalWorkspacePortsPanel } from './local-workspace-ports-panel'

export { getLocalWorkspacePortSections } from './local-workspace-port-sections'
export {
  killWorkspacePortForTarget,
  openWorkspacePortInBrowser,
  scanWorkspacePortsForTarget
} from '@/lib/workspace-port-actions'

export default function PortsPanel({ isVisible }: { isVisible: boolean }): React.JSX.Element {
  // Why: workspaces run on this machine only; remote runtime owners are removed in this build.
  return <LocalWorkspacePortsPanel isVisible={isVisible} runtimeTarget={null} />
}
