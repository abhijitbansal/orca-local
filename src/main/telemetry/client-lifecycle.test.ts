import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  _setShuttingDownForTests,
  _setSinkForTests,
  persistBannerAcknowledgeWithoutEmitting,
  setOptIn,
  shutdownTelemetry
} from './client'
import {
  BASE_COMMON,
  cleanupTelemetryClientTest,
  makeMockSink,
  setupTelemetryClientTest,
  type MockSink,
  type TelemetryClientTestState
} from './client-test-harness'

function pushedEvents(mock: MockSink): string[] {
  return mock.push.mock.calls.map((call) => call[0].event)
}

describe('setOptIn()', () => {
  let state: TelemetryClientTestState
  let mock: MockSink

  beforeEach(() => {
    state = setupTelemetryClientTest()
    mock = state.mock
  })

  afterEach(() => {
    cleanupTelemetryClientTest(state.envStash)
  })

  it('writes telemetry_opted_out to the sink when turning off', async () => {
    await setOptIn('settings', false)
    expect(pushedEvents(mock)).toEqual(['telemetry_opted_out'])
    expect(state.settings.telemetry?.optedIn).toBe(false)
  })

  it('writes telemetry_opted_in without app_opened for settings opt-in', async () => {
    state.settings.telemetry!.optedIn = false
    await setOptIn('settings', true)
    expect(pushedEvents(mock)).toEqual(['telemetry_opted_in'])
  })

  it('persists opt-in but writes nothing when no sink is installed', async () => {
    state.settings.telemetry!.optedIn = false
    _setSinkForTests(null)

    await setOptIn('settings', true)

    expect(state.settings.telemetry?.optedIn).toBe(true)
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('fires app_opened once after pending-banner opt-in', async () => {
    state.settings.telemetry = {
      optedIn: null,
      installId: BASE_COMMON.install_id,
      existedBeforeTelemetryRelease: true
    }

    await setOptIn('settings', true)

    expect(pushedEvents(mock)).toEqual(['app_opened', 'telemetry_opted_in'])
  })
})

describe('persistBannerAcknowledgeWithoutEmitting()', () => {
  let state: TelemetryClientTestState
  let mock: MockSink

  beforeEach(() => {
    state = setupTelemetryClientTest({
      optedIn: null,
      installId: BASE_COMMON.install_id,
      existedBeforeTelemetryRelease: true
    })
    mock = state.mock
  })

  afterEach(() => {
    cleanupTelemetryClientTest(state.envStash)
  })

  it('writes app_opened and does not emit telemetry_opted_in', async () => {
    await persistBannerAcknowledgeWithoutEmitting()

    expect(pushedEvents(mock)).toEqual(['app_opened'])
    expect(state.settings.telemetry?.optedIn).toBe(true)
  })
})

describe('shutdownTelemetry()', () => {
  afterEach(() => {
    _setShuttingDownForTests(false)
    _setSinkForTests(null)
  })

  it('sets the shutdown gate and flushes + closes the sink', async () => {
    const mock = makeMockSink()
    _setSinkForTests(mock)
    _setShuttingDownForTests(false)
    await shutdownTelemetry()
    expect(mock.flush).toHaveBeenCalledTimes(1)
    expect(mock.close).toHaveBeenCalledTimes(1)
    expect(mock.push).not.toHaveBeenCalled()
  })

  it('is a no-op when no sink is initialized', async () => {
    _setSinkForTests(null)
    await expect(shutdownTelemetry()).resolves.toBeUndefined()
  })
})
