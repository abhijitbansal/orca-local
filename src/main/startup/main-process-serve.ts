import { statSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { notifyServeSupervisorReady } from '../serve-update-handoff'
import { mainProcessState as state } from './main-process-state'
import { getServeOptions, type ServeOptions } from './serve-options'

export { getServeOptions, type ServeOptions }

export async function printServeReady(options: ServeOptions): Promise<void> {
  const runtime = state.runtime
  if (!runtime) {
    throw new Error('Runtime must be initialized before printing serve readiness')
  }
  if (options.recipeJson) {
    if (!options.projectRoot) {
      throw new Error('--serve-recipe-json requires --serve-project-root')
    }
    if (!isAbsolute(options.projectRoot)) {
      throw new Error(`--serve-project-root must be absolute: ${options.projectRoot}`)
    }
    if (!statSync(options.projectRoot).isDirectory()) {
      throw new Error(`--serve-project-root must be a directory: ${options.projectRoot}`)
    }
  }
  await state.serveReadinessPublisher.publish(
    {
      runtimeId: runtime.getRuntimeId(),
      boundEndpoint: null,
      advertisedEndpoint: null,
      // Why: the WSL reconciliation barrier fails open, so 'pending' warns a WSL PTY launch may still race a repair.
      managedWslCliReconciliation: state.managedWslCliReconciliationStatus,
      pairing: {
        available: false,
        reason: 'disabled_by_operator',
        guidance: 'This build has no network listener; connect with the orca CLI on this machine.'
      }
    },
    options.recipeJson
      ? { mode: 'recipe-json', projectRoot: options.projectRoot! }
      : { mode: options.json ? 'json' : 'human' }
  )
  notifyServeSupervisorReady(runtime.getRuntimeId())
}
