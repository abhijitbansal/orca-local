import { vi, type Mock } from 'vitest'
import type { CommonProps } from '../../shared/telemetry-events'
import type { GlobalSettings } from '../../shared/global-settings-types'
import type { LocalFileSink } from '../observability/local-file-sink'
import type { Store } from '../persistence'
import { resetBurstCapsForSession } from './burst-cap'
import {
  _resetFirstAppOpenedFiredForTests,
  _setCommonPropsForTests,
  _setShuttingDownForTests,
  _setSinkForTests,
  _setStoreForTests
} from './client'

export type PushedTelemetryRecord = {
  type: string
  event: string
  distinct_id: string
  timestamp: string
  properties: Record<string, unknown>
}

export type MockSink = {
  filePath: string
  push: Mock<(record: PushedTelemetryRecord) => void>
  flush: Mock<LocalFileSink['flush']>
  close: Mock<LocalFileSink['close']>
}

export type TelemetryClientTestState = {
  mock: MockSink
  store: Store
  settings: GlobalSettings
  envStash: Record<string, string | undefined>
}

export const BASE_COMMON: CommonProps = {
  app_version: '1.3.33',
  platform: 'darwin',
  arch: 'arm64',
  os_release: '25.3.0',
  install_id: '00000000-0000-4000-8000-000000000000',
  session_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  orca_channel: 'local'
}

export function makeMockSink(): MockSink {
  return { filePath: '/tmp/telemetry.ndjson', push: vi.fn(), flush: vi.fn(), close: vi.fn() }
}

export function makeFakeSettings(telemetry: GlobalSettings['telemetry']): GlobalSettings {
  return { telemetry } as unknown as GlobalSettings
}

export function makeFakeStore(settings: GlobalSettings): Store {
  return {
    getSettings: vi.fn(() => settings),
    updateSettings: vi.fn((updates: Partial<GlobalSettings>) => {
      if (updates.telemetry) {
        settings.telemetry = {
          ...settings.telemetry,
          ...updates.telemetry
        } as typeof settings.telemetry
      }
      return settings
    })
  } as unknown as Store
}

const CONSENT_ENV_VARS = [
  'DO_NOT_TRACK',
  'ORCA_TELEMETRY_DISABLED',
  'CI',
  'GITHUB_ACTIONS',
  'GITLAB_CI',
  'CIRCLECI',
  'TRAVIS',
  'BUILDKITE',
  'JENKINS_URL',
  'TEAMCITY_VERSION'
] as const

function stashAndClearConsentEnv(): Record<string, string | undefined> {
  const stash: Record<string, string | undefined> = {}
  for (const name of CONSENT_ENV_VARS) {
    stash[name] = process.env[name]
    delete process.env[name]
  }
  return stash
}

function restoreConsentEnv(stash: Record<string, string | undefined>): void {
  for (const name of CONSENT_ENV_VARS) {
    const prior = stash[name]
    if (prior === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = prior
    }
  }
}

export function setupTelemetryClientTest(
  telemetry: GlobalSettings['telemetry'] = {
    optedIn: true,
    installId: BASE_COMMON.install_id,
    existedBeforeTelemetryRelease: false
  }
): TelemetryClientTestState {
  const envStash = stashAndClearConsentEnv()
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  resetBurstCapsForSession()

  const mock = makeMockSink()
  const settings = makeFakeSettings(telemetry)
  const store = makeFakeStore(settings)
  _setSinkForTests(mock)
  _setCommonPropsForTests(BASE_COMMON)
  _setStoreForTests(store)
  _setShuttingDownForTests(false)
  _resetFirstAppOpenedFiredForTests()

  return { mock, store, settings, envStash }
}

export function cleanupTelemetryClientTest(envStash: Record<string, string | undefined>): void {
  _setSinkForTests(null)
  _setCommonPropsForTests(null)
  _setStoreForTests(null)
  _resetFirstAppOpenedFiredForTests()
  vi.restoreAllMocks()
  restoreConsentEnv(envStash)
}
