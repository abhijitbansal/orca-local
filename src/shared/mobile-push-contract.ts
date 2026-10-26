// Why: the desktop host, the push gateway, and the phone must agree on these
// exact strings. See cloud/packages/push-contract/src.

export const MOBILE_PUSH_SOURCES = ['agent-task-complete', 'terminal-bell', 'plugin'] as const
export type MobilePushSource = (typeof MOBILE_PUSH_SOURCES)[number]

// The only two states a phone can be told about; the host maps its richer
// agent status onto them before it ever reaches the gateway.
export const MOBILE_PUSH_AGENT_STATES = ['needs-input', 'finished'] as const
export type MobilePushAgentState = (typeof MOBILE_PUSH_AGENT_STATES)[number]

export const MOBILE_PUSH_PLATFORMS = ['ios', 'android'] as const
export type MobilePushPlatform = (typeof MOBILE_PUSH_PLATFORMS)[number]

export const MOBILE_PUSH_APNS_ENVIRONMENTS = ['sandbox', 'production'] as const
export type MobilePushApnsEnvironment = (typeof MOBILE_PUSH_APNS_ENVIRONMENTS)[number]

export type MobilePushFilter = {
  onlyWhenDesktopAway?: boolean
  sound?: boolean
}

/** Persisted on the paired DeviceEntry so a host restart can push without the phone re-registering. */
export type MobilePushRegistration = {
  registrationId: string
  filter: MobilePushFilter
  expiresAt: number
}

export type MobilePushRegisterInput = {
  deviceId: string
  platform: MobilePushPlatform
  token: string
  apnsEnvironment?: MobilePushApnsEnvironment
  filter: MobilePushFilter
}

export type MobilePushRegisterResult =
  | { registered: true; registrationId: string }
  | {
      registered: false
      // Storage failures require registration to be retried; throttling leaves the prior route intact.
      reason:
        | 'gateway_unreachable'
        | 'gateway_rejected'
        | 'not_mobile'
        | 'registration_storage_failed'
        | 'throttled'
    }

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return Object.fromEntries(Object.entries(value))
}

function parseFilter(value: unknown): MobilePushFilter | null {
  const filter = readRecord(value)
  if (!filter) {
    return null
  }
  const { onlyWhenDesktopAway, sound } = filter
  if (
    (onlyWhenDesktopAway !== undefined && typeof onlyWhenDesktopAway !== 'boolean') ||
    (sound !== undefined && typeof sound !== 'boolean')
  ) {
    return null
  }
  return {
    ...(typeof onlyWhenDesktopAway === 'boolean' ? { onlyWhenDesktopAway } : {}),
    ...(typeof sound === 'boolean' ? { sound } : {})
  }
}

/**
 * Reads a persisted registration back. Returns undefined for invalid data,
 * so a bad row degrades to "this device has no push"
 * instead of failing the whole registry load.
 */
export function parseMobilePushRegistration(value: unknown): MobilePushRegistration | undefined {
  const registration = readRecord(value)
  if (!registration) {
    return undefined
  }
  const filter = parseFilter(registration.filter)
  if (
    typeof registration.registrationId !== 'string' ||
    registration.registrationId.length === 0 ||
    !filter ||
    typeof registration.expiresAt !== 'number' ||
    !Number.isFinite(registration.expiresAt)
  ) {
    return undefined
  }
  return {
    registrationId: registration.registrationId,
    filter,
    expiresAt: registration.expiresAt
  }
}

export type MobilePushTestResult =
  | { accepted: true }
  | { accepted: false; reason: 'not_registered' | 'unavailable' | 'rate_limited' | 'rejected' }
