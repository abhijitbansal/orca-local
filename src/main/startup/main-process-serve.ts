import { mainProcessState as state } from './main-process-state'
import { getServeOptions, type ServeOptions } from './serve-options'

export { getServeOptions, type ServeOptions }

export async function printServeReady(options: ServeOptions): Promise<void> {
  const runtime = state.runtime
  if (!runtime) {
    throw new Error('Runtime must be initialized before printing serve readiness')
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
    { mode: options.json ? 'json' : 'human' }
  )
}
