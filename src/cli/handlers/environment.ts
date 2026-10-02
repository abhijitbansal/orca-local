import type { CommandHandler } from '../dispatch'
import { formatHostList, formatHostName, printResult, type HostNameResult } from '../format'
import { listSshTargets } from '../host-selector-alternatives'
import { RuntimeClientError } from '../runtime-client'
import type { RuntimeClient, RuntimeRpcSuccess } from '../runtime-client'
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
  },
  // Why: an agent told "run it on <name>" had nowhere to look; this is the one place that lists
  // this machine and the SSH targets registered on it.
  'host list': async ({ client, json }) => {
    const sshTargets = (await listSshTargets(client)).map((target) => ({
      kind: 'ssh' as const,
      name: target.label,
      id: target.id,
      selector: `--host ssh:${target.id}`,
      ...(target.connected === undefined ? {} : { connected: target.connected }),
      ...(target.connectionStatus ? { connectionStatus: target.connectionStatus } : {}),
      ...(target.remotePlatform ? { platform: target.remotePlatform } : {})
    }))
    const localStatus = await readLocalHostDescriptor(client)
    const hosts = [
      {
        kind: 'local' as const,
        name: 'this machine',
        id: 'local',
        selector: '--host local',
        ...localStatus,
        platform: localStatus.platform ?? process.platform
      },
      ...sshTargets
    ]
    printResult(localSuccess({ hosts }), json, formatHostList)
  }
}

function describeRuntimeHost(status: RuntimeStatus): HostNameResult {
  return {
    ...(status.machineName ? { machineName: status.machineName } : {}),
    ...(status.hostPlatform ? { platform: status.hostPlatform } : {})
  }
}

/** The local row of `host list` still prints when this machine's runtime is not running. */
async function readLocalHostDescriptor(client: RuntimeClient): Promise<HostNameResult> {
  try {
    return describeRuntimeHost((await client.call<RuntimeStatus>('status.get')).result)
  } catch {
    return {}
  }
}

function localSuccess<TResult>(result: TResult): RuntimeRpcSuccess<TResult> {
  return {
    id: 'local',
    ok: true,
    result,
    _meta: {
      runtimeId: 'local'
    }
  }
}
