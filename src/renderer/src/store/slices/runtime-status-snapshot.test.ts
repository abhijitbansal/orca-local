import { beforeEach, expect, it, vi } from 'vitest'
import { create } from 'zustand'
import {
  createRuntimeStatusSlice,
  clearRuntimeEnvironmentConnectionGenerationsForTests,
  type RuntimeStatusSlice
} from './runtime-status'
import type { RuntimeHostStatusSnapshot } from '../../../../shared/runtime-host-status'
import type { RuntimeStatus } from '../../../../shared/runtime-types'
import type { PublicKnownRuntimeEnvironment } from '../../../../shared/runtime-environments'

vi.mock('sonner', () => ({ toast: { warning: vi.fn(), dismiss: vi.fn() } }))
vi.mock('@/runtime/restored-client-hosted-browser-host-attach', () => ({
  ensureBrowserClientHostsForRestoredPages: vi.fn(),
  ensureBrowserClientHostOnRuntimeContact: vi.fn()
}))
vi.mock('@/runtime/client-hosted-browser-close-intent-replay', () => ({
  replayClientHostedBrowserCloseIntents: vi.fn()
}))

beforeEach(() => {
  clearRuntimeEnvironmentConnectionGenerationsForTests()
  vi.clearAllMocks()
})
const environment = {
  id: 'env-a',
  name: 'Host',
  createdAt: 1,
  pairingRevision: 1,
  endpoints: [],
  preferredEndpointId: ''
} as unknown as PublicKnownRuntimeEnvironment
function store() {
  const value = create<RuntimeStatusSlice>()((...args) =>
    createRuntimeStatusSlice(...(args as unknown as Parameters<typeof createRuntimeStatusSlice>))
  )
  value.getState().setRuntimeEnvironments([environment])
  return value
}
function snapshot(
  sequence: number,
  patch: Partial<RuntimeHostStatusSnapshot> = {}
): RuntimeHostStatusSnapshot {
  return {
    environmentId: 'env-a',
    pairingRevision: 1,
    sequence,
    checkedAt: sequence,
    transport: 'ready',
    verification: 'verified',
    status: { runtimeId: 'rt-1' } as RuntimeStatus,
    ...patch
  }
}

it('hydrates both viewers and rejects an older read after a newer publication', () => {
  for (const viewer of [store(), store()]) {
    viewer.getState().applyRuntimeHostStatusSnapshot(snapshot(2))
    viewer
      .getState()
      .applyRuntimeHostStatusSnapshot(snapshot(1, { status: null, verification: 'unavailable' }))
    expect(viewer.getState().runtimeStatusByEnvironmentId.get('env-a')?.status?.runtimeId).toBe(
      'rt-1'
    )
  }
})
