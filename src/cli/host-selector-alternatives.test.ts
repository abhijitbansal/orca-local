import { describe, expect, it, vi } from 'vitest'
import {
  ambiguousSshTargets,
  findSshTargetByName,
  listSshTargets,
  resolveSshHostTargetId
} from './host-selector-alternatives'
import type { RuntimeClient } from './runtime-client'

const SSH_TARGETS = [{ id: 'ssh-1755000000000-a1b2c3', label: 'openclaw' }]

function clientReturning(targets: { id: string; label: string }[]): RuntimeClient {
  return {
    call: vi.fn(async () => ({ result: { targets } }))
  } as unknown as RuntimeClient
}

describe('findSshTargetByName', () => {
  // Why: ids are machine-generated `ssh-<timestamp>-<random>`, so the label is the only name a
  // person or agent ever has. Matching ids alone reports "not found" for a target that exists.
  it('matches the human label as well as the generated id', () => {
    expect(findSshTargetByName(SSH_TARGETS, 'openclaw')?.id).toBe('ssh-1755000000000-a1b2c3')
    expect(findSshTargetByName(SSH_TARGETS, 'ssh-1755000000000-a1b2c3')?.label).toBe('openclaw')
    expect(findSshTargetByName(SSH_TARGETS, 'OpenClaw')?.label).toBe('openclaw')
  })

  it('does not invent a match', () => {
    expect(findSshTargetByName(SSH_TARGETS, 'awin')).toBeUndefined()
  })
})

describe('resolveSshHostTargetId', () => {
  it('resolves a label to the target id', async () => {
    await expect(resolveSshHostTargetId(clientReturning(SSH_TARGETS), 'openclaw')).resolves.toBe(
      'ssh-1755000000000-a1b2c3'
    )
  })

  // Why: this used to answer ok:true with an empty list — a silent wrong-machine result.
  it('rejects an unknown target instead of letting it filter to nothing', async () => {
    await expect(resolveSshHostTargetId(clientReturning(SSH_TARGETS), 'nowhere')).rejects.toThrow(
      'no SSH target named or with id nowhere'
    )
  })

  it('says so plainly when the host has no SSH targets at all', async () => {
    await expect(resolveSshHostTargetId(clientReturning([]), 'openclaw')).rejects.toMatchObject({
      data: { nextSteps: expect.arrayContaining(['This Orca host has no SSH targets registered.']) }
    })
  })
})

describe('listSshTargets', () => {
  // Why: an older host answers listTargets but not listTargetSummaries. Treating that as "no
  // targets" would reject an ssh id that is valid on that host.
  it('falls back to the older listing when the newer method is absent', async () => {
    const { RuntimeClientError } = await import('./runtime/types.js')
    const call = vi.fn(async (method: string) => {
      if (method === 'ssh.listTargetSummaries') {
        throw new RuntimeClientError('method_not_found', 'Unknown method')
      }
      return { result: { targets: SSH_TARGETS } }
    })

    await expect(listSshTargets({ call } as unknown as RuntimeClient)).resolves.toEqual(SSH_TARGETS)
    expect(call).toHaveBeenCalledWith('ssh.listTargets')
  })

  it('enriches legacy target rows from host-owned connection state', async () => {
    const { RuntimeClientError } = await import('./runtime/types.js')
    const call = vi.fn(async (method: string) => {
      if (method === 'ssh.listTargetSummaries') {
        throw new RuntimeClientError('method_not_found', 'Unknown method')
      }
      if (method === 'ssh.getState') {
        return { result: { state: { status: 'connected', remotePlatform: 'win32' } } }
      }
      return { result: { targets: SSH_TARGETS } }
    })

    await expect(listSshTargets({ call } as unknown as RuntimeClient)).resolves.toEqual([
      { ...SSH_TARGETS[0], connected: true, connectionStatus: 'connected', remotePlatform: 'win32' }
    ])
    expect(call).toHaveBeenCalledWith('ssh.getState', { targetId: SSH_TARGETS[0].id })
  })

  // Why: this only ever runs to enrich an error we are already reporting; a failure here must
  // not replace that error with a confusing one about SSH enumeration.
  it('returns nothing rather than masking the error it was enriching', async () => {
    const client = {
      call: vi.fn(async () => {
        throw new Error('boom')
      })
    }

    await expect(listSshTargets(client as unknown as RuntimeClient)).resolves.toEqual([])
  })
})

describe('ambiguous names never resolve silently', () => {
  const twoOpenclaw = [
    { id: 'ssh-1-a', label: 'openclaw' },
    { id: 'ssh-2-b', label: 'openclaw' }
  ]

  // Why: picking the first would choose a machine on the caller's behalf — the exact failure the
  // whole selector path exists to prevent.
  it('refuses to guess between two ssh targets sharing a label', () => {
    expect(findSshTargetByName(twoOpenclaw, 'openclaw')).toBeUndefined()
    expect(ambiguousSshTargets(twoOpenclaw, 'openclaw')).toHaveLength(2)
  })

  // An exact id is never ambiguous, even when labels collide.
  it('still resolves an exact id past a colliding label', () => {
    expect(findSshTargetByName(twoOpenclaw, 'ssh-2-b')?.id).toBe('ssh-2-b')
  })

  it('reports no ambiguity for a unique name', () => {
    expect(ambiguousSshTargets(SSH_TARGETS, 'openclaw')).toEqual([])
  })

  it('names both candidates when an ssh label is ambiguous', async () => {
    await expect(
      resolveSshHostTargetId(clientReturning(twoOpenclaw), 'openclaw')
    ).rejects.toMatchObject({
      data: {
        nextSteps: expect.arrayContaining([
          expect.stringContaining('ssh-1-a'),
          expect.stringContaining('ssh-2-b')
        ])
      }
    })
  })
})
