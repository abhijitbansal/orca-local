import type { PreloadApi } from '../api-types'

// Why a stub and not a deletion: ~50 renderer call sites gate on a paired environment id that
// this build can never mint; keeping the shape lets them compile while every call fails closed.
function unsupported(): never {
  throw new Error('unsupported_in_local_build: remote Orca runtimes were removed from this build')
}

export const runtimeEnvironmentsApi = {
  getStatusSnapshots: async () => [],
  onStatusChanged: () => () => {},
  list: async () => [],
  disconnect: async () => unsupported(),
  connect: async () => unsupported(),
  getStatus: async () => unsupported(),
  prepareBrowserClientHostPlacement: async () => unsupported(),
  retryConnectionsNow: async () => {},
  call: async () => unsupported(),
  subscribe: async () => unsupported()
} satisfies PreloadApi['runtimeEnvironments']
