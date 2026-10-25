import type { RuntimeRpcResponse } from '../../../shared/runtime-rpc-envelope'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { createUnsupportedInLocalBuildError } from './runtime-environment-unsupported'

export type RuntimeRpcSubscriptionHandlers = {
  /** Each successful frame's result. */
  onEvent: (result: unknown) => void
  onError: (error: unknown) => void
  /** The local stream ends with a frame rather than a close. */
  onClose: () => void
}

/** The streaming counterpart of `callRuntimeRpc`: the same method over either transport. */
export async function subscribeRuntimeRpc(
  target: RuntimeClientTarget,
  method: string,
  params: unknown,
  handlers: RuntimeRpcSubscriptionHandlers
): Promise<{ unsubscribe: () => void }> {
  const onResponse = (response: RuntimeRpcResponse<unknown>): void => {
    if (!response.ok) {
      handlers.onError(response.error)
      return
    }
    handlers.onEvent(response.result)
  }
  if (target.kind === 'local') {
    return window.api.runtime.subscribe({ method, params }, onResponse)
  }
  // Why: remote runtimes are removed in this build; a runtime: owner fails closed, never local.
  throw createUnsupportedInLocalBuildError()
}
