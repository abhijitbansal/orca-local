import { defineMethod } from '../core'

export const STATUS_METHODS = [
  defineMethod({
    name: 'status.get',
    params: null,
    handler: async (_params, { runtime, pairedDeviceId }) => {
      // Why: a status answered while the friendly-name lookup is still in flight publishes the bare
      // hostname; the wait is capped below the CLI's status probe so a slow lookup never reads as down.
      await runtime.machineNameReady()
      return {
        ...runtime.getStatus(),
        ...(pairedDeviceId ? { pairedDeviceId } : {}),
        appVersion: process.env.ORCA_APP_VERSION ?? '0.0.0-dev'
      }
    }
  })
]
