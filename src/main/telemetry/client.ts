// Main-process telemetry transport: one local NDJSON sink, one `track()` entry that every
// event (main + IPC) funnels through. The ordering inside `track()` — shutdown gate, burst cap,
// consent, validator, write — MUST be preserved: burst cap runs before consent so a compromised
// opted-out renderer can't force a settings read per event. Nothing here opens a socket: the sink
// appends to `<userData>/logs/telemetry.ndjson` (rotated by local-file-sink) and no code reads it back.

import { randomUUID } from 'node:crypto'
import { arch as osArch, platform as osPlatform, release as osRelease } from 'node:os'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import type { CommonProps, EventName, EventProps, OptInVia } from '../../shared/telemetry-events'
import { createLocalFileSink, type LocalFileSink } from '../observability/local-file-sink'
import type { Store } from '../persistence'
import { consumeBurstToken, resetBurstCapsForSession } from './burst-cap'
import { getCohortAtEmit } from './cohort-classifier'
import { resolveConsent } from './consent'
import { commonPropsSchema, validate } from './validator'

export const TELEMETRY_FILE_NAME = 'telemetry.ndjson'
export const TELEMETRY_RECORD_TYPE = 'telemetry-event'

// Module-level singletons — one Store / process / telemetry session.
let sink: LocalFileSink | null = null
let sessionId: string | null = null
let commonProps: CommonProps | null = null
let shuttingDown = false
let storeRef: Store | null = null

// First-launch `app_opened` gate: no events are written until the banner resolves; keep mark+emit atomic.
let appOpenedTrackedThisSession = false

export function getTelemetryFilePath(): string {
  return join(getAppEnvironment().getPath('userData'), 'logs', TELEMETRY_FILE_NAME)
}

function buildCommonProps(installId: string, sid: string): CommonProps {
  // Don't truncate here; the validator's `.max(64)` is authoritative, so an over-long string drops rather than being silently masked.
  return {
    app_version: getAppEnvironment().getVersion(),
    platform: osPlatform(),
    arch: osArch(),
    os_release: osRelease(),
    install_id: installId,
    session_id: sid,
    orca_channel: 'local'
  }
}

export function initTelemetry(store: Store): void {
  // Set unconditionally so `setOptIn` can persist opt-out to disk even when the sink never opens.
  storeRef = store
  resetBurstCapsForSession()
  shuttingDown = false
  // Reset per session: the "no app_opened until banner resolution" invariant is per-launch, not per-install.
  appOpenedTrackedThisSession = false

  // Why: vitest and plain-node entries have no AppEnvironment; there is no userData dir to write under.
  if (!hasAppEnvironment()) {
    return
  }
  const settings = store.getSettings()
  const installId = settings.telemetry?.installId
  if (!installId) {
    // Migration guarantees installId; if missing, don't write with an absent distinct_id.
    console.warn('[telemetry] installId missing after migration; skipping sink init')
    return
  }

  sessionId = randomUUID()
  commonProps = buildCommonProps(installId, sessionId)

  // Fail-closed: a bad `install_id` (e.g. empty from a migration bug) would collapse all events into one distinct_id.
  const parsedCommon = commonPropsSchema.safeParse(commonProps)
  if (!parsedCommon.success) {
    console.warn('[telemetry] common props failed schema validation; skipping sink init')
    commonProps = null
    return
  }

  try {
    sink = createLocalFileSink({ filePath: getTelemetryFilePath() })
  } catch (err) {
    // Telemetry must never block startup; a read-only userData just means no local record.
    console.warn('[telemetry] could not open local telemetry sink (ignored):', err)
    sink = null
  }
}

/** Lets producers avoid preparing usage payloads when nothing would be written. */
export function isTelemetryEnabled(): boolean {
  return (
    !shuttingDown &&
    sink !== null &&
    commonProps !== null &&
    storeRef !== null &&
    resolveConsent(storeRef.getSettings()).effective === 'enabled'
  )
}

function writeRecord(
  client: LocalFileSink,
  common: CommonProps,
  name: EventName,
  props: object
): void {
  client.push({
    type: TELEMETRY_RECORD_TYPE,
    event: name,
    distinct_id: common.install_id,
    timestamp: new Date().toISOString(),
    properties: { ...common, ...props }
  })
}

export function track<N extends EventName>(name: N, props: EventProps<N>): boolean {
  // (1) Shutdown gate: late IPC arrivals must not enqueue against a closing sink.
  if (shuttingDown) {
    return false
  }
  if (!sink || !commonProps || !storeRef) {
    return false
  }
  // (2) Burst cap before consent: the O(1) cap drops floods before the costly settings read, so a compromised opted-out renderer can't burn CPU.
  if (!consumeBurstToken(name)) {
    return false
  }
  // (3) Consent resolve — reads live settings every call so it can't drift from persisted state / env-var precedence.
  const consent = resolveConsent(storeRef.getSettings())
  if (consent.effective !== 'enabled') {
    return false
  }
  // (4) Validator — single enforcement point for schema, enum, key set, and length caps.
  const result = validate(name, props)
  if (!result.ok) {
    return false
  }
  // (5) Write.
  writeRecord(sink, commonProps, name, result.props)
  return true
}

export async function setOptIn(via: OptInVia, optedIn: boolean): Promise<void> {
  if (!storeRef) {
    return
  }
  const settings = storeRef.getSettings()
  const telemetryBeforeUpdate = settings.telemetry
  const wasPendingBanner =
    telemetryBeforeUpdate?.existedBeforeTelemetryRelease === true &&
    telemetryBeforeUpdate.optedIn === null
  // Deep-merge (persistence.ts:552) so flipping `optedIn` won't clobber `installId` / `existedBeforeTelemetryRelease`.
  storeRef.updateSettings({
    telemetry: {
      ...(settings.telemetry ?? { installId: '', existedBeforeTelemetryRelease: true }),
      optedIn
    }
  })

  if (optedIn) {
    if (wasPendingBanner) {
      trackAppOpenedOnce()
    }
    track('telemetry_opted_in', { via })
    return
  }
  // Record the opt-out itself against the new preference (track() would drop it under `user_opt_out`).
  if (!sink || shuttingDown || !commonProps || !consumeBurstToken('telemetry_opted_out')) {
    return
  }
  const validated = validate('telemetry_opted_out', { via })
  if (validated.ok) {
    writeRecord(sink, commonProps, 'telemetry_opted_out', validated.props)
  }
}

// Banner ✕: silent persisted opt-in. Separate from `setOptIn` because that always emits a
// `telemetry_opted_in/out` event; here `app_opened` fires but no opt-in event does.
export async function persistBannerAcknowledgeWithoutEmitting(): Promise<void> {
  if (!storeRef) {
    return
  }
  const settings = storeRef.getSettings()
  storeRef.updateSettings({
    telemetry: {
      ...(settings.telemetry ?? { installId: '', existedBeforeTelemetryRelease: true }),
      optedIn: true
    }
  })
  // Why: banner resolution is the first eligible moment for app_opened.
  trackAppOpenedOnce()
}

export function trackAppOpenedOnce(): void {
  if (appOpenedTrackedThisSession) {
    return
  }
  appOpenedTrackedThisSession = true
  // Why: `nth_repo_added: 0` marks the session-zero / pre-repo cohort. See docs/onboarding-funnel-cohort-addendum.md.
  track('app_opened', { ...getCohortAtEmit() })
}

export async function shutdownTelemetry(): Promise<void> {
  // Set the gate before flush so late IPC-arrived tracks drop instead of enqueuing mid-flush.
  shuttingDown = true
  const instance = sink
  if (!instance) {
    return
  }
  try {
    instance.flush()
    instance.close()
  } catch (err) {
    // Telemetry must never crash the app on quit. Swallow.
    console.warn('[telemetry] shutdown error (ignored):', err)
  } finally {
    sink = null
  }
}

// Test-only introspection: `_`-prefixed helpers inject a fake sink and observe writes; not a runtime API.

export function _setSinkForTests(client: LocalFileSink | null): void {
  sink = client
}

export function _setCommonPropsForTests(props: CommonProps | null): void {
  commonProps = props
}

export function _setStoreForTests(store: Store | null): void {
  storeRef = store
}

export function _setShuttingDownForTests(value: boolean): void {
  shuttingDown = value
}

export function _resetFirstAppOpenedFiredForTests(): void {
  appOpenedTrackedThisSession = false
}
