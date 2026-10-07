import type { CliStatusResult } from '../shared/runtime-types'
import { prepareComputerCliJsonResult } from './computer-format'
import type { RuntimeRpcSuccess } from './runtime-client'

export { formatCliError, reportCliError, type CliErrorContext } from './cli-error'

export {
  formatBrowserProfileList,
  formatScreenshot,
  formatSnapshot,
  formatTabList,
  formatTabListWithProfiles,
  formatTabProfileClone,
  formatTabProfileShow,
  formatTabShow
} from './browser-format'

export {
  formatComputerAction,
  formatGetAppState,
  formatListApps,
  formatListWindows
} from './computer-format'
export type { ComputerActionFollowUpTarget } from './computer-format'
export {
  formatProjectHostSetupCreateResult,
  formatProjectHostSetupDeleteResult,
  formatProjectHostSetupList,
  formatProjectHostSetupResult,
  formatProjectHostSetupUpdateResult,
  formatProjectList
} from './project-format'
export {
  formatTerminalClose,
  formatTerminalCreate,
  formatTerminalFocus,
  formatTerminalList,
  formatTerminalRead,
  formatTerminalRename,
  formatTerminalSend,
  formatTerminalShow,
  formatTerminalSplit,
  formatTerminalWait,
  terminalSendWarnings
} from './terminal-format'
export {
  formatAutomationList,
  formatAutomationRemoved,
  formatAutomationRun,
  formatAutomationRuns,
  formatAutomationShow
} from './automation-format'
export type { AutomationListPayload, AutomationShowPayload } from './automation-format'
export {
  formatMemorySnapshot,
  formatRepoList,
  formatRepoRefs,
  formatRepoShow,
  formatWorktreeList,
  formatWorktreePs,
  formatWorktreeShow
} from './workspace-format'

export function printResult<TResult>(
  response: RuntimeRpcSuccess<TResult>,
  json: boolean,
  formatter: (value: TResult) => string
): void {
  if (json) {
    console.log(JSON.stringify(prepareComputerCliJsonResult(response), null, 2))
    return
  }
  console.log(formatter(response.result))
}

/** What one runtime calls itself; `machineName` is absent when the runtime predates the field. */
export type HostNameResult = {
  machineName?: string
  platform?: string
}

export function formatHostName(result: HostNameResult): string {
  return `${result.machineName ?? 'unknown'}${result.platform ? ` (${result.platform})` : ''}`
}

export function formatCliStatus(status: CliStatusResult): string {
  return [
    `appRunning: ${status.app.running}`,
    `pid: ${status.app.pid ?? 'none'}`,
    `desktopWindowStatus: ${status.app.desktopWindowStatus ?? 'unknown'}`,
    `runtimeState: ${status.runtime.state}`,
    `runtimeReachable: ${status.runtime.reachable}`,
    `runtimeConnectionState: ${status.runtime.connectionState ?? 'unknown'}`,
    `runtimeId: ${status.runtime.runtimeId ?? 'none'}`,
    `graphState: ${status.graph.state}`
  ].join('\n')
}

export function formatStatus(status: CliStatusResult): string {
  return formatCliStatus(status)
}
