import path from 'node:path'
import process from 'node:process'
import type { Store } from '../../../src/main/persistence'
import { createProfileStateStore } from '../../../src/main/persistence/profile-state/profile-state-store-factory'
import { setAppEnvironment } from '../../../src/shared/app-environment'
import { setSecretStore } from '../../../src/shared/secret-store'

// Plain-Node host adapters for the fixture child: no Electron, no OS keyring.
function installFixtureHostAdapters(directory: string): void {
  setAppEnvironment({
    getPath: () => directory,
    getAppPath: () => directory,
    getVersion: () => '0.0.0-fixture',
    isPackaged: () => true,
    onWillQuit: () => {},
    exit: (code = 0) => process.exit(code),
    getAppMetrics: () => []
  })
  setSecretStore({
    isEncryptionAvailable: () => false,
    encryptString: () => {
      throw new Error('fixture_secret_sealing_unavailable')
    },
    decryptString: () => {
      throw new Error('fixture_secret_sealing_unavailable')
    },
    describeProtectionGap: () => 'Fixture host has no OS keyring.'
  })
}

export function createDaemonGenerationProfileStore(directory: string): Store {
  installFixtureHostAdapters(directory)
  // The bundled fixture has no profile writer worker; use the synchronous SQLite authority.
  return createProfileStateStore({
    dataFile: path.join(directory, 'orca-data.json'),
    databaseFile: path.join(directory, 'profile-state.sqlite'),
    profileId: 'legacy-close-fixture'
  }).store
}
