// Local-only stub: no remote CLI can drive this desktop's browser, so no remote scope is ever active.
export function runInRemoteCliBrowserScope<T>(_scope: unknown, work: () => T): T {
  return work()
}

export function captureRemoteCliBrowserRevocation(): (webContentsId?: number) => void {
  return () => {}
}

export function captureRemoteCliBrowserScope(): {
  bridged: boolean
  revoked?: AbortSignal
  hostRevoked?: AbortSignal
  run<T>(work: () => T): T
} {
  return { bridged: false, run: (work) => work() }
}

export function runOutsideRemoteCliBrowserScope<T>(work: () => T): T {
  return work()
}

export function assertRemoteCliBrowserAccess(_webContentsId?: number): void {}

export function resolveRemoteCliBrowserScopeSelector(
  _selector: string
): Promise<{ id: string }> | null {
  return null
}

export function captureRemoteCliBrowserWorkBound(): <T>(
  work: Promise<T>,
  cancel: () => void
) => Promise<T> {
  return (work) => work
}
