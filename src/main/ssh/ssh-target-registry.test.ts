import { describe, expect, it } from 'vitest'
import {
  connectRegisteredSshTarget,
  getActiveMultiplexer,
  getRegisteredSshState,
  listRegisteredRemovedSshTargetLabels,
  listRegisteredSshTargets
} from './ssh-target-registry'

describe('ssh-target-registry (local-only stub)', () => {
  it('reports no registered targets, state or multiplexer', () => {
    expect(getRegisteredSshState('t1')).toBeUndefined()
    expect(listRegisteredSshTargets()).toEqual([])
    expect(listRegisteredRemovedSshTargetLabels()).toEqual({})
    expect(getActiveMultiplexer('t1')).toBeUndefined()
  })

  it('rejects connect with the typed unsupported error', async () => {
    await expect(connectRegisteredSshTarget('t1')).rejects.toMatchObject({
      code: 'unsupported_in_local_only_build'
    })
  })
})
