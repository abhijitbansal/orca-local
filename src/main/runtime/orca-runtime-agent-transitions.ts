import { AgentTransitionDetector } from '../agent-hooks/agent-transition-detector'
import { OrcaRuntimeWithResolveWaiter } from './orca-runtime-resolve-waiter'
import type { AgentStatusStoreView } from './sidebar-inputs/workspace-activity-facts-producer'
import { subscribeHookStatusTitles } from './terminal/layout/hook-status-title-subscription'

/**
 * Owns the runtime's agent transition detector.
 */
export abstract class OrcaRuntimeWithAgentTransitions extends OrcaRuntimeWithResolveWaiter {
  readonly agentTransitions = new AgentTransitionDetector({
    resolveTabWorktreeId: (tabId) => this.tabs.get(tabId)?.worktreeId,
    subscribeToPtyExit: (ptyId, listener) => this.subscribeToPtyExit(ptyId, listener),
    now: Date.now
  })

  /** Attaches the detector, and main's generated tab titles; layers above subscribe their readers first. */
  attachAgentStatusStore(store: AgentStatusStoreView): () => void {
    const detachTransitions = this.agentTransitions.attach(store)
    const subscribe = store.subscribeEnrichedStatus?.bind(store)
    const detachTitles = subscribe
      ? subscribeHookStatusTitles({ subscribeEnrichedStatus: subscribe }, this)
      : () => {}
    return () => {
      detachTitles()
      detachTransitions()
    }
  }
}
