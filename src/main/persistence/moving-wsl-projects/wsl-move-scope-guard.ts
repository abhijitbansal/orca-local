// Local-only stub: WSL project moves are not supported in this build, so no move is ever in progress.
export type WslMoveProjectRef = { repoId?: string; folderWorkspaceId?: string }

export class WslMoveProjectFencedError extends Error {}

export function assertWslMoveHostSetupIdWritable(..._args: unknown[]): void {}
export function assertWslMoveHostSetupWritable(..._args: unknown[]): void {}
export function assertWslMoveProjectWritable(..._args: unknown[]): void {}
export function assertWslMoveRepoWritable(..._args: unknown[]): void {}
export function assertWslMoveReposWritable(..._args: unknown[]): void {}
export function assertWslMoveWorkspaceWritable(..._args: unknown[]): void {}
export function isLocalWslMoveRow(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveProjectBlocked(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveProjectSessionFrozen(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveSourceHost(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveWorkspaceBlocked(..._args: unknown[]): boolean {
  return false
}
export function isWslMoveWorkspaceSessionFrozen(..._args: unknown[]): boolean {
  return false
}
export function loadWslMoveFence(..._args: unknown[]): void {}
export function resetWslMoveFenceForTests(): void {}
export function shouldDropWslMoveProjectUpdate(..._args: unknown[]): boolean {
  return false
}
export function wslMoveProjectRefForWorkspace(..._args: unknown[]): WslMoveProjectRef | undefined {
  return undefined
}
