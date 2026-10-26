import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { PACKAGED_BUNDLE_ID } from '../../shared/packaged-app-identity'
import { PROTOCOL_VERSION } from './daemon-protocol-version'

/** Keep labels stable across upgrades, isolated by profile and protocol. */
export function macDaemonJobLabel(
  userDataPath: string,
  protocolVersion = PROTOCOL_VERSION
): string {
  const profileKey = createHash('sha256').update(resolve(userDataPath)).digest('hex').slice(0, 16)
  return `${PACKAGED_BUNDLE_ID}.terminal.${profileKey}.v${protocolVersion}`
}
