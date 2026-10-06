import type { CommandHandler } from '../dispatch'
import { formatHostName, printResult, type HostNameResult } from '../format'
import { RuntimeClientError } from '../runtime-client'
import type { RuntimeStatus } from '../../shared/runtime-types'

export const ENVIRONMENT_HANDLERS: Record<string, CommandHandler> = {
  'host name': async ({ client, flags, json }) => {
    const requestedName = flags.get('name')
    if (requestedName !== undefined && typeof requestedName !== 'string') {
      throw new RuntimeClientError('invalid_argument', 'Missing value for --name')
    }
    if (typeof requestedName === 'string') {
      // Why: an older runtime rejects the unknown settings field with a bare `invalid_params`;
      // a runtime that does not publish a name cannot store one either, so say so plainly.
      const current = await client.call<RuntimeStatus>('status.get')
      if (current.result.machineName === undefined) {
        throw new RuntimeClientError(
          'incompatible_runtime',
          'This Orca runtime does not support machine names. Update Orca on that host and try again.'
        )
      }
      await client.call('settings.update', { machineName: requestedName })
    }
    // Why: print what the runtime publishes after the write (a blank `--name` means the detected
    // name), inside the runtime's own envelope so a routed answer is stamped with that runtime.
    const status = await client.call<RuntimeStatus>('status.get')
    printResult({ ...status, result: describeRuntimeHost(status.result) }, json, formatHostName)
  }
}

function describeRuntimeHost(status: RuntimeStatus): HostNameResult {
  return {
    ...(status.machineName ? { machineName: status.machineName } : {}),
    ...(status.hostPlatform ? { platform: status.hostPlatform } : {})
  }
}
