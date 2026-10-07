// End-to-end behavior of the track() wrapper against a mock local sink. These
// tests pin record payload drift, shutdown gating, burst caps, consent order,
// and the per-session event ceiling.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommonProps } from '../../shared/telemetry-events'
import type { Store } from '../persistence'
import { _setShuttingDownForTests, _setSinkForTests, track, trackAppOpenedOnce } from './client'
import {
  BASE_COMMON,
  cleanupTelemetryClientTest,
  setupTelemetryClientTest,
  type MockSink,
  type TelemetryClientTestState
} from './client-test-harness'

describe('track()', () => {
  let state: TelemetryClientTestState
  let mock: MockSink
  let store: Store

  beforeEach(() => {
    state = setupTelemetryClientTest()
    mock = state.mock
    store = state.store
  })

  afterEach(() => {
    cleanupTelemetryClientTest(state.envStash)
  })

  it('writes a validated event record with merged common + event props to the local sink', () => {
    track('app_opened', {})
    expect(mock.push).toHaveBeenCalledTimes(1)
    const record = mock.push.mock.calls[0]![0]
    expect(record.type).toBe('telemetry-event')
    expect(record.event).toBe('app_opened')
    expect(record.distinct_id).toBe(BASE_COMMON.install_id)
    expect(typeof record.timestamp).toBe('string')
    for (const key of Object.keys(BASE_COMMON) as (keyof CommonProps)[]) {
      expect(record.properties[key]).toBe(BASE_COMMON[key])
    }
    expect(record.properties.$process_person_profile).toBeUndefined()
  })

  // Drift-check: the full set of keys on the record properties is bounded by
  // CommonProps and EventProps. A future change widening `properties` should fail loudly for review.
  it('serialized property set is exactly CommonProps plus EventProps', () => {
    track('workspace_created', { source: 'command_palette', from_existing_branch: true })
    const record = mock.push.mock.calls[0]![0]
    const allowed = new Set([...Object.keys(BASE_COMMON), 'source', 'from_existing_branch'])
    for (const key of Object.keys(record.properties)) {
      expect(allowed.has(key)).toBe(true)
    }
  })

  it('writes nothing when consent is off', () => {
    state.settings.telemetry!.optedIn = false
    expect(track('app_opened', {})).toBe(false)
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('does not write when no sink is installed', () => {
    _setSinkForTests(null)
    track('app_opened', {})
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('respects the shutdown gate', () => {
    _setShuttingDownForTests(true)
    track('app_opened', {})
    expect(mock.push).not.toHaveBeenCalled()
  })

  // Core security-ordering invariant: a compromised renderer of an opted-out
  // user should not be able to burn consent-resolve CPU. The observable signal
  // is store.getSettings(), which resolveConsent calls once per evaluation.
  it('burst cap runs BEFORE consent resolve', () => {
    ;(store.getSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      telemetry: {
        optedIn: false,
        installId: BASE_COMMON.install_id,
        existedBeforeTelemetryRelease: false
      }
    })
    for (let i = 0; i < 30; i++) {
      track('app_opened', {})
    }
    const callsAtBoundary = (store.getSettings as ReturnType<typeof vi.fn>).mock.calls.length
    for (let i = 0; i < 20; i++) {
      track('app_opened', {})
    }
    expect((store.getSettings as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAtBoundary)
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('enforces per-event burst cap (30 per minute default)', () => {
    for (let i = 0; i < 50; i++) {
      track('app_opened', {})
    }
    expect(mock.push).toHaveBeenCalledTimes(30)
  })

  it('enforces the per-session 1000-event global ceiling across event names', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-03T00:00:00Z'))
    // Advance time between calls so the per-event token buckets refill; the
    // only remaining cap is the session ceiling.
    for (let i = 0; i < 1500; i++) {
      vi.advanceTimersByTime(10_000)
      track('app_opened', {})
    }
    expect(mock.push).toHaveBeenCalledTimes(1000)
    vi.useRealTimers()
  })

  it('drops invalid events before writing', () => {
    track('agent_error', {
      error_class: 'unknown',
      agent_kind: 'claude-code',
      error_message: 'leaked message'
    } as never)
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('trackAppOpenedOnce emits app_opened at most once per session', () => {
    trackAppOpenedOnce()
    trackAppOpenedOnce()
    expect(mock.push).toHaveBeenCalledTimes(1)
    expect(mock.push.mock.calls[0]![0].event).toBe('app_opened')
  })
})
