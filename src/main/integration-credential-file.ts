import {
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync
} from 'node:fs'

// Why (STA-3941): a direct write can truncate the previous credential if it
// fails or the app dies mid-write, leaving nothing to authenticate with. Write
// a sibling temp file, fsync it, then rename — readers only ever observe the
// old bytes or the complete new ones.
export function writeCredentialFileAtomic(path: string, data: Buffer): void {
  const tempPath = `${path}.tmp`
  let handle: number | null = null
  try {
    handle = openSync(tempPath, 'w', 0o600)
    // Why: write(2) is allowed to return a short count, so a single writeSync
    // could publish a truncated credential — the very corruption this avoids.
    let written = 0
    while (written < data.length) {
      const bytes = writeSync(handle, data, written, data.length - written)
      if (bytes <= 0) {
        throw new Error(`Credential write stalled at ${written}/${data.length} bytes`)
      }
      written += bytes
    }
    fsyncSync(handle)
    closeSync(handle)
    handle = null
    renameSync(tempPath, path)
    restrictCredentialFileToOwner(path)
  } catch (error) {
    if (handle !== null) {
      try {
        closeSync(handle)
      } catch {
        // Already closed or invalid; the unlink below is what matters.
      }
    }
    try {
      unlinkSync(tempPath)
    } catch {
      // Nothing to clean up.
    }
    throw error
  }
}
// Why: writeFileSync's `mode` only applies when it creates the file, so
// rewriting an existing credential would silently keep looser permissions.
// Best-effort: Windows has no POSIX modes, so chmod is a documented no-op there.
export function restrictCredentialFileToOwner(path: string): void {
  try {
    chmodSync(path, 0o600)
  } catch {
    // Best-effort hardening; the write itself already succeeded.
  }
}
