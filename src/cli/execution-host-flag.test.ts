import { describe, expect, it } from 'vitest'
import { hostFilterMatchesHostId, parseHostFlag } from './execution-host-flag'
import { parseExecutionHostId } from '../shared/execution-host'

function flags(entries: Record<string, string | boolean>): Map<string, string | boolean> {
  return new Map(Object.entries(entries))
}

describe('parseHostFlag', () => {
  it('returns undefined when --host is absent', () => {
    expect(parseHostFlag(flags({}))).toBeUndefined()
  })

  it('rejects a --host flag with no value', () => {
    expect(() => parseHostFlag(flags({ host: true }))).toThrow('Missing value for --host')
  })

  it.each(['runtime:', 'ssh:', 'nonsense'])('rejects the unparseable host id %s', (value) => {
    expect(() => parseHostFlag(flags({ host: value }))).toThrow(`Invalid --host value: ${value}`)
  })

  it('parses the supported host kinds', () => {
    expect(parseHostFlag(flags({ host: 'local' }))?.kind).toBe('local')
    expect(parseHostFlag(flags({ host: 'ssh:box-1' }))?.kind).toBe('ssh')
  })
})

describe('hostFilterMatchesHostId', () => {
  const localHost = parseExecutionHostId('local')!
  const sshHost = parseExecutionHostId('ssh:box-1')!

  it('matches the identical host id', () => {
    expect(hostFilterMatchesHostId(localHost, 'local')).toBe(true)
    expect(hostFilterMatchesHostId(sshHost, 'ssh:box-1')).toBe(true)
  })

  it('does not widen local or ssh filters', () => {
    expect(hostFilterMatchesHostId(localHost, 'runtime:env-1')).toBe(false)
    expect(hostFilterMatchesHostId(sshHost, 'local')).toBe(false)
  })
})

describe('parseHostFlag in the local-only build', () => {
  it('rejects --host runtime:<id> with invalid_argument instead of routing to a paired server', () => {
    const flags = new Map<string, string | boolean>([['host', 'runtime:env-1']])
    expect(() => parseHostFlag(flags)).toThrowError(
      expect.objectContaining({ code: 'invalid_argument' })
    )
  })
})
