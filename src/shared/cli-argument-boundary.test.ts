import { describe, expect, it } from 'vitest'
import { findCliCommandIndex } from './cli-argument-boundary'

const COMMAND_PATHS = [['project'], ['serve'], ['status'], ['worktree']] as const

describe('findCliCommandIndex', () => {
  it.each([
    { argv: ['--json', 'status'], expected: 1, name: 'global boolean' },
    { argv: ['--selector', 'status'], expected: 1, name: 'missing global value' },
    {
      argv: ['--selector', 'status', 'worktree', 'list'],
      expected: 2,
      name: 'command-named value'
    },
    {
      argv: ['--project', 'github:stablyai/orca', 'project', 'setups'],
      expected: 2,
      name: 'selector value'
    },
    { argv: ['--project=github:stablyai/orca', 'project'], expected: 1, name: 'assignment' },
    { argv: ['--', 'status'], expected: 1, name: 'bare double dash' },
    { argv: ['workspace', 'status'], expected: -1, name: 'first non-command positional' },
    { argv: ['serve'], expected: 0, name: 'direct serve' }
  ])('$name', ({ argv, expected }) => {
    expect(findCliCommandIndex(argv, COMMAND_PATHS)).toBe(expected)
  })

  it('consumes known global values at the launch boundary', () => {
    expect(findCliCommandIndex(['--selector', 'status'], COMMAND_PATHS, ['selector'])).toBe(-1)
  })
})
