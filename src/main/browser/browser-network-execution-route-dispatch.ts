import {
  resolveNativeBrowserNetworkExecutionRoute,
  type BrowserNetworkExecutionRouteResolver
} from './browser-network-execution-route'
import { LocalOnlyUnsupportedError } from '../../shared/local-only-unsupported-error'

/**
 * Dispatches an execution-host descriptor to its transport-specific route
 * resolver. Imports stay dynamic so the WSL route loads only when a WSL host is used; the
 * runtime bundles this module, so it must not import Electron.
 */
export const resolveBrowserNetworkExecutionRoute: BrowserNetworkExecutionRouteResolver = async (
  context
) => {
  if (context.executionHost.kind === 'native') {
    return resolveNativeBrowserNetworkExecutionRoute(context)
  }
  if (context.executionHost.kind === 'wsl') {
    const wslRoute = await import('./wsl-browser-network-execution-route')
    return wslRoute.resolveWslBrowserNetworkExecutionRoute(context)
  }
  // Why: no other execution-host kind can be tunnelled in this build; fail closed, never route locally (I4).
  throw new LocalOnlyUnsupportedError('ssh', `browser tunnel for ${context.executionHost.kind}`)
}
