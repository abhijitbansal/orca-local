// Local-only stub: WSL project moves are not supported in this build, so no move is ever in progress.
export function keepWslMoveFrozenSessionsForStore<T>(session: T, ..._rest: unknown[]): T {
  return session
}
