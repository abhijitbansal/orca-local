import type { ConnectPanePtySession } from './connect-pane-pty-session'
import { runDeferredSessionReattachChoice } from './deferred-session-reattach-choice'

export function runDeferredSessionAttach(session: ConnectPanePtySession): void {
  runDeferredSessionReattachChoice(session)
}
