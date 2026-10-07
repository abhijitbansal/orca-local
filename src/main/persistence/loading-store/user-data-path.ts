import { getAppEnvironment } from '../../../shared/app-environment'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { PersistedState } from '../../../shared/persisted-state-types'

// Why capture once (not a module const, not per-call): a const resolves before configureDevUserDataPath() redirects userData (dev/prod collide);
// per-call resolves after app.setName('Orca') flips path case and loses data on case-sensitive FS. index.ts calls initDataPath() at the right moment.
let _dataFile: string | null = null
let _userDataDir: string | null = null

export function initDataPath(): void {
  const userDataDir = getAppEnvironment().getPath('userData')
  _userDataDir = userDataDir
  _dataFile = join(userDataDir, 'orca-data.json')
}

export function getDataFile(): string {
  if (!_dataFile) {
    // Safety fallback — should not be hit in normal startup.
    const userDataDir = getAppEnvironment().getPath('userData')
    _userDataDir = userDataDir
    _dataFile = join(userDataDir, 'orca-data.json')
  }
  return _dataFile
}

// Why a sidecar: githubCache refreshes every poll and would rewrite the whole multi-MB orca-data.json each cycle.
// Snapshotted best-effort at quit for instant badges next launch; safe to lose.
export function getGithubCacheFile(dataFile = getDataFile()): string {
  return join(dirname(dataFile), 'orca-github-cache.json')
}

export function readGithubCacheSnapshot(dataFile: string): PersistedState['githubCache'] | null {
  try {
    const parsed = JSON.parse(readFileSync(getGithubCacheFile(dataFile), 'utf-8')) as unknown
    const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
    if (
      isPlainRecord(parsed) &&
      isPlainRecord((parsed as { pr?: unknown }).pr) &&
      isPlainRecord((parsed as { issue?: unknown }).issue)
    ) {
      return parsed as PersistedState['githubCache']
    }
  } catch {
    // Missing or corrupt snapshot: start with an empty cache and refetch.
  }
  return null
}

/**
 * Return the userData directory captured at initDataPath() time, before app.setName() can change how getAppEnvironment().getPath('userData') resolves.
 *
 * Subsystems sharing storage with orca-data.json read this instead of resolving late, which on case-sensitive FS can lose paired devices.
 */
export function getCanonicalUserDataPath(): string {
  if (!_userDataDir) {
    // Safety fallback — should not be hit in normal startup.
    _userDataDir = getAppEnvironment().getPath('userData')
  }
  return _userDataDir
}
