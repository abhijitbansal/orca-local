import type { ChildProcess } from 'node:child_process'
import {
  QUIT_RENDERER_ACK_TIMEOUT_MS,
  WILL_QUIT_TEARDOWN_DEADLINE_MS
} from '../../shared/quit-teardown-deadline'
import { serveSignalExitError } from './serve-signal-exit-diagnostic'

export const SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS = 5_000
export const SERVE_CHILD_FORCE_KILL_GRACE_MS =
  QUIT_RENDERER_ACK_TIMEOUT_MS +
  WILL_QUIT_TEARDOWN_DEADLINE_MS +
  SERVE_CHILD_FORCE_KILL_SCHEDULING_MARGIN_MS

/** Keeps a foreground `orca serve` child under the CLI's signals and propagates its exit. */
export async function superviseForegroundServe(child: ChildProcess): Promise<number> {
  const result = await waitForForegroundChild(child)
  if (typeof result.code === 'number' || result.signalWasForwarded) {
    return result.code ?? 0
  }
  throw serveSignalExitError(result.signal)
}

function waitForForegroundChild(child: ChildProcess): Promise<{
  code: number | null
  signal: NodeJS.Signals | null
  signalWasForwarded: boolean
}> {
  return new Promise((resolveWait, reject) => {
    const forwardsHangup = process.platform === 'linux'
    const forwardedSignals = new Set<NodeJS.Signals>()
    let forceKillTimer: ReturnType<typeof setTimeout> | null = null
    const forwardSignal = (signal: NodeJS.Signals): void => {
      // A Windows console delivers Ctrl-C to parent and child; child.kill would terminate the child mid-teardown.
      if (process.platform !== 'win32') {
        forwardedSignals.add(signal)
        child.kill(signal)
      }
      forceKillTimer ??= setTimeout(() => child.kill('SIGKILL'), SERVE_CHILD_FORCE_KILL_GRACE_MS)
    }
    const cleanup = (): void => {
      process.off('SIGINT', forwardSignal)
      process.off('SIGTERM', forwardSignal)
      if (forwardsHangup) {
        process.off('SIGHUP', forwardSignal)
      }
      if (forceKillTimer) {
        clearTimeout(forceKillTimer)
      }
    }
    process.on('SIGINT', forwardSignal)
    process.on('SIGTERM', forwardSignal)
    if (forwardsHangup) {
      process.on('SIGHUP', forwardSignal)
    }
    const handleExit = (code: number | null, signal: NodeJS.Signals | null): void => {
      cleanup()
      resolveWait({
        code,
        signal,
        signalWasForwarded: signal !== null && forwardedSignals.has(signal)
      })
    }
    child.once('error', (error) => {
      cleanup()
      child.off('exit', handleExit)
      reject(error)
    })
    child.once('exit', handleExit)
  })
}
