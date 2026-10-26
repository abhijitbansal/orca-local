// Local-only stub: WSL project moves are not supported in this build, so no move is ever in progress.
export function isWslMoveFolderWorkspaceBlocked(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveRepoBlocked(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveWorktreeBlocked(..._args: unknown[]): boolean {
  return false
}
export function wslMoveRepoBackoff(..._args: unknown[]): 'moving' | 'owned' | null {
  return null
}
