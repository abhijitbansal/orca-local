import { describe, expect, it } from 'vitest'
import { runtimeEnvironmentsApi } from './runtime-environments-bridge'

describe('runtimeEnvironments preload stub', () => {
  it('lists no paired servers and reports no status', async () => {
    await expect(runtimeEnvironmentsApi.list()).resolves.toEqual([])
    await expect(runtimeEnvironmentsApi.getStatusSnapshots()).resolves.toEqual([])
  })

  it('fails closed for every call that would dial a paired server', async () => {
    await expect(runtimeEnvironmentsApi.call()).rejects.toThrow(/unsupported_in_local_build/)
    await expect(runtimeEnvironmentsApi.subscribe()).rejects.toThrow(/unsupported_in_local_build/)
  })
})
