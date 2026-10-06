import { afterEach, describe, expect, it, vi } from 'vitest'
import { deriveAutomationExecutionTargetForCreate } from '../../shared/automation-execution-target'
import {
  assertAutomationDestination,
  assertExecutionTargetMatchesDestination
} from '../../shared/automation-owner-precondition'
import { AUTOMATION_HANDLERS } from './automations'

function ok(result: unknown): unknown {
  return { id: 'request-1', ok: true, result, _meta: { runtimeId: 'runtime-1' } }
}

/**
 * Stands in for the storing authority: it answers the reads the CLI makes and
 * enforces the destination exactly where persistence does — with the real
 * assertions, and only when the client actually supplies one.
 */
function authority(): {
  call: ReturnType<typeof vi.fn>
  writes: { method: string; params: unknown }[]
} {
  const writes: { method: string; params: unknown }[] = []
  const call = vi.fn(async (method: string, params?: Record<string, unknown>) => {
    if (method === 'automation.show') {
      return ok({
        automation: { id: 'a1' },
        owner: { selector: { kind: 'ssh', targetId: 'box-0', targetGeneration: 3 } }
      })
    }
    if (method === 'repo.show') {
      return ok({ repo: { id: 'r1' } })
    }
    if (method === 'automation.create' || method === 'automation.update') {
      writes.push({ method, params: params ?? {} })
      const destination = (params as { destination?: never } | undefined)?.destination
      if (destination) {
        assertAutomationDestination(destination, { sshTargetGeneration: () => undefined })
        assertExecutionTargetMatchesDestination(
          deriveAutomationExecutionTargetForCreate({
            repo: { connectionId: null },
            sshTargetGeneration: undefined
          }),
          destination
        )
      }
      return ok({ automation: { id: 'a1' } })
    }
    return ok({})
  })
  return { call, writes }
}

const CREATE_FLAGS: [string, string][] = [
  ['name', 'nightly'],
  ['prompt', 'go'],
  ['provider', 'claude'],
  ['trigger', 'daily']
]

afterEach(() => vi.restoreAllMocks())

// The expected owner only fences the host the record is leaving; the destination names where
// it lands, which is always this machine in the local-only build.
describe('CLI automation writes fence the host they land on', () => {
  it('sends a self destination for a local project', async () => {
    const { call, writes } = authority()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await AUTOMATION_HANDLERS['automations create']!({
      client: { call } as never,
      cwd: '/tmp',
      flags: new Map([...CREATE_FLAGS, ['repo', 'local-repo']]),
      json: true
    })

    expect(writes[0]?.params).toMatchObject({ destination: { selector: { kind: 'self' } } })
  })

  // Nothing moves, so there is no arrival to fence and no reason to spend the reads.
  it('sends no destination when the edit names no project or workspace', async () => {
    const { call, writes } = authority()
    vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await AUTOMATION_HANDLERS['automations edit']!({
      client: { call } as never,
      cwd: '/tmp',
      flags: new Map([
        ['id', 'a1'],
        ['name', 'renamed']
      ]),
      json: true
    })

    expect(call).not.toHaveBeenCalledWith('repo.show', expect.anything())
    expect(writes[0]?.params).not.toHaveProperty('destination')
  })
})
