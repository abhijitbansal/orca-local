import { inspectRuntimeTerminalProcess } from '@/runtime/runtime-terminal-inspection'
import {
  probePtyRunningWorkWithInspection,
  type PtyRunningWorkProbe
} from '../../../../shared/pty-running-work-probe'

/**
 * One probe answer in the fixed `live` / `unverifiable` / `exited` vocabulary of
 * `AGENTS.md`. `exited` is only ever produced by a host that
 * answered; every failure to reach the owner — a rejection, a closed transport, or a deadline
 * that expired first — stays `unverifiable`, because loss of contact is not evidence of death.
 */
export type PtyRunningWorkVerdict = 'live' | 'unverifiable' | 'exited'

export function probePtyRunningWork(
  ptyIds: readonly string[],
  options: { timeoutMs: number }
): Promise<PtyRunningWorkProbe[]> {
  return probePtyRunningWorkWithInspection(ptyIds, options, (ptyId) =>
    // Close guards require host child-process evidence before acting.
    inspectRuntimeTerminalProcess(ptyId, { scanChildProcesses: true })
  )
}
