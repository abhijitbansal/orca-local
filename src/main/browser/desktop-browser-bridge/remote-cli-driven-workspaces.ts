// Local-only stub: no workspace is ever driven by a remote CLI.
export function markRemoteCliDrivenWorkspace(_workspaceId: string): void {}

export function isRemoteCliDrivenGuest(_webContentsId: number | undefined): boolean {
  return false
}
