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
      // Check name support before an older settings schema can reject the write as invalid_params.
      const current = await client.call<RuntimeStatus>('status.get')
      if (current.result.machineName === undefined) {
        throw new RuntimeClientError(
          'incompatible_runtime',
          'This Orca runtime does not support machine names. Update Orca on that host and try again.'
        )
      }
      await client.call('settings.update', { machineName: requestedName })
    }
    // A blank override restores the detected name; read it from the runtime after writing.
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
