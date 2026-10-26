// Why: paired runtime parking is removed in this build, so no parked remote session is restorable.
export function canRestorePairedParkedTerminal(_ptyId: string): boolean {
  return false
}

// Why: daemon session IDs use the format `${worktreeId}@@${shortUuid}`, so restore never reattaches
// a session another workspace owns.
export { isPtySessionIdOwnedByWorktree as isSessionOwnedByWorktree } from '../../../../../shared/pty-session-id-format'
