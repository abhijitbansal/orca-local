import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync
} from 'node:fs'
import { fsyncFileSync } from '../shared/secure-file'
import { writeRestrictedWindowsFile } from '../shared/secure-path-windows-acl'

// Stage and fsync before rename so failed writes cannot truncate the saved credential (STA-3941).
export function writeCredentialFileAtomic(
  path: string,
  data: Buffer,
  shouldPublish?: () => boolean
): boolean {
  // Unique temp names prevent concurrent writers from truncating staged bytes.
  const tempPath = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  let handle: number | null = null
  try {
    if (process.platform === 'win32') {
      // Create owner-only staging files so replacement cannot inherit a permissive Windows DACL.
      writeRestrictedWindowsFile(tempPath, data)
      fsyncFileSync(tempPath)
      return publishStagedCredential(tempPath, path, shouldPublish)
    }
    handle = openSync(tempPath, 'w', 0o600)
    // writeSync can return a short count; publish only after all bytes are written.
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
    return publishStagedCredential(tempPath, path, shouldPublish)
  } catch (error) {
    if (handle !== null) {
      try {
        closeSync(handle)
      } catch {}
    }
    try {
      unlinkSync(tempPath)
    } catch {}
    throw error
  }
}
function publishStagedCredential(
  tempPath: string,
  path: string,
  shouldPublish: (() => boolean) | undefined
): boolean {
  if (shouldPublish && !shouldPublish()) {
    unlinkSync(tempPath)
    return false
  }
  renameSync(tempPath, path)
  restrictCredentialFileToOwner(path)
  return true
}

// Creation mode does not tighten existing files; Windows hardens the staging ACL instead.
export function restrictCredentialFileToOwner(path: string): void {
  try {
    chmodSync(path, 0o600)
  } catch {
    // Best-effort hardening; the write itself already succeeded.
  }
}
